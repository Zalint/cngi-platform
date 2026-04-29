const ProjectModel = require('../models/project.model');
const ProjectStructure = require('../models/projectStructure.model');
const NotificationModel = require('../models/notification.model');
const UserModel = require('../models/user.model');
const emailService = require('../services/email.service');
const db = require('../config/db');
const { validateProjectData, validateProjectDataForUpdate } = require('../utils/validators');
const { canUserAccessProject, canUserModifyProject, isDirecteurOfProject } = require('../utils/projectAccess');

/**
 * Helper : envoie un email à un utilisateur s'il a une adresse, sinon no-op.
 * Fire-and-forget : ne casse jamais le flux métier.
 */
async function _emailMeasureAssigned(userId, measure, project) {
    try {
        const user = await UserModel.findById(userId);
        if (user?.email) await emailService.sendMeasureAssignedEmail({ user, measure, project });
    } catch (err) {
        console.error('Email measure_assigned failed:', err?.message || err);
    }
}

async function _emailMeasureStatusChanged(userId, measure, project, oldStatus, newStatus) {
    try {
        const user = await UserModel.findById(userId);
        if (user?.email) {
            await emailService.sendMeasureStatusChangedEmail({ user, measure, project, oldStatus, newStatus });
        }
    } catch (err) {
        console.error('Email measure_status_changed failed:', err?.message || err);
    }
}

const STATUS_LABELS = {
    preconisee:   'Préconisée',
    executee:     'Exécutée',
    non_executee: 'Non exécutée',
    observations: 'Observations'
};

/**
 * Renvoie la liste des IDs utilisateurs qui doivent être informés d'un événement
 * sur une mesure d'un projet : le ou les admins, le directeur de la structure
 * principale du projet, le chef de projet et l'assigné de la mesure.
 * Exclut l'utilisateur qui a provoqué l'événement (excludeUserId).
 *
 * Robustesse : on utilise $N IS NOT NULL plutôt qu'un fallback `|| 0` côté JS,
 * ainsi un user.id qui serait à 0 (edge-case) n'empoisonne pas la logique, et
 * NULL reste correctement géré comme "pas d'assigné / pas d'exclusion".
 */
async function collectMeasureWatchers(projectId, measureAssignedUserId, excludeUserId) {
    try {
        const pid = Number.isFinite(parseInt(projectId)) ? parseInt(projectId) : null;
        if (!pid) return [];
        const assigned = Number.isFinite(parseInt(measureAssignedUserId)) ? parseInt(measureAssignedUserId) : null;
        const exclude  = Number.isFinite(parseInt(excludeUserId)) ? parseInt(excludeUserId) : null;

        const result = await db.query(`
            SELECT DISTINCT u.id
            FROM users u
            LEFT JOIN projects p ON p.id = $1
            WHERE u.is_active = true
              AND ($2::int IS NULL OR u.id <> $2)
              AND (
                    u.role = 'admin'
                 OR (u.role = 'directeur' AND u.structure_id = p.structure_id)
                 OR u.id = p.project_manager_id
                 OR ($3::int IS NOT NULL AND u.id = $3)
              )
        `, [pid, exclude, assigned]);
        return result.rows.map(r => r.id);
    } catch (err) {
        console.error('collectMeasureWatchers failed:', err.message);
        return [];
    }
}

// Masque les données financières pour les rôles qui n'ont pas le droit de les voir.
// Seul `lecteur` est redacté ; `auditeur` a accès complet.
// Champs concernés (observés dans le modèle) :
//   - projects.budget (champ top-level)
//   - project.funding[] — tableau issu de la table `financing`, chaque entrée
//     contient { amount, currency, source, availability }. On retire le tableau
//     entier pour ne pas fuiter le nombre de sources de financement non plus.
// NB : la table `stakeholders` ne contient aucune donnée monétaire (uniquement
// nom, type et contacts), donc rien à redacter côté parties prenantes.
function redactFinancialsFor(user, project) {
    if (!project || !user || user.role !== 'lecteur') return project;

    const redactOne = (p) => {
        if (!p) return p;
        // Shallow-clone l'objet projet puis réaffecter explicitement les champs
        // sensibles. On ne mute jamais l'objet reçu en argument.
        const cloned = { ...p };
        cloned.budget = null;
        if (Array.isArray(cloned.funding)) cloned.funding = [];
        return cloned;
    };

    return Array.isArray(project) ? project.map(redactOne) : redactOne(project);
}

exports.getAllProjects = async (req, res, next) => {
    try {
        let projects;

        const isGlobalReader = (req.user.role === 'lecteur' || req.user.role === 'auditeur') && !req.user.structure_id;
        const isScopedReader = (req.user.role === 'lecteur' || req.user.role === 'auditeur') && req.user.structure_id;

        if (req.user.role === 'superviseur' || isGlobalReader) {
            // Superviseur / lecteur global / auditeur global voient tous les projets (comme admin)
            const filters = {};
            if (req.query.structure_id) filters.structure_id = req.query.structure_id;
            if (req.query.status) filters.status = req.query.status;
            if (req.query.q) filters.q = req.query.q;
            projects = await ProjectModel.findAll(filters);
        } else if (req.user.role === 'commandement_territorial') {
            // Commandement territorial voit les projets de son territoire
            projects = await ProjectModel.findByTerritory(req.user.territorial_level, req.user.territorial_value);
        } else if (
            (req.user.role === 'utilisateur' && req.user.structure_id)
            || isScopedReader
        ) {
            // Utilisateur / lecteur ou auditeur scopés → filtrer par leur structure via project_structures
            projects = await ProjectStructure.getProjectsByStructure(req.user.structure_id);
        } else {
            // Admin et directeur voient tous les projets (directeur = lecture globale,
            // écriture restreinte à sa structure via canUserModifyProject)
            const filters = {};
            if (req.query.structure_id) filters.structure_id = req.query.structure_id;
            if (req.query.status) filters.status = req.query.status;
            if (req.query.q) filters.q = req.query.q;
            projects = await ProjectModel.findAll(filters);
        }

        const safeProjects = redactFinancialsFor(req.user, projects);
        res.json({ success: true, count: safeProjects.length, data: safeProjects });
    } catch (error) {
        next(error);
    }
};

exports.getProjectById = async (req, res, next) => {
    try {
        const project = await ProjectModel.findById(req.params.id);

        if (!project) {
            return res.status(404).json({ success: false, message: 'Projet non trouvé' });
        }

        // Vérifier l'accès pour tous les non-admin (inclut commandement_territorial)
        const hasAccess = await canUserAccessProject(req.user, req.params.id);
        if (!hasAccess) {
            return res.status(403).json({ success: false, message: 'Accès refusé à ce projet' });
        }

        res.json({ success: true, data: redactFinancialsFor(req.user, project) });
    } catch (error) {
        next(error);
    }
};

exports.createProject = async (req, res, next) => {
    try {
        const validation = validateProjectData(req.body);
        if (!validation.valid) {
            return res.status(400).json({ success: false, message: 'Données invalides', errors: validation.errors });
        }
        
        // Ajouter l'ID de l'utilisateur créateur
        req.body.created_by_user_id = req.user.id;
        
        // Si utilisateur ou directeur, forcer sa structure (créer un projet pour
        // une autre structure est réservé à l'admin).
        if (req.user.role === 'utilisateur' || req.user.role === 'directeur') {
            req.body.structure_id = req.user.structure_id;
        }
        
        const project = await ProjectModel.create(req.body);
        
        // Créer automatiquement le mapping projet-structure pour la structure principale
        if (project.structure_id) {
            await ProjectStructure.assignStructure(project.id, project.structure_id, req.user.id);
        }
        
        res.status(201).json({ success: true, message: 'Projet créé avec succès', data: project });
    } catch (error) {
        next(error);
    }
};

exports.updateProject = async (req, res, next) => {
    try {
        const project = await ProjectModel.findById(req.params.id);
        
        if (!project) {
            return res.status(404).json({ success: false, message: 'Projet non trouvé' });
        }
        
        // Vérifier l'accès en écriture (admin = tout, directeur/utilisateur = sa structure)
        const canModify = await canUserModifyProject(req.user, req.params.id);
        if (!canModify) {
            return res.status(403).json({ success: false, message: 'Accès refusé' });
        }

        // Utiliser la validation pour mise à jour (champs partiels)
        const validation = validateProjectDataForUpdate(req.body);
        if (!validation.valid) {
            return res.status(400).json({ success: false, message: 'Données invalides', errors: validation.errors });
        }
        
        // Mettre à jour les champs de base du projet
        const updated = await ProjectModel.update(req.params.id, req.body);
        
        // Mettre à jour les localités si fournies
        if (req.body.localities && Array.isArray(req.body.localities)) {
            await ProjectModel.updateLocalities(req.params.id, req.body.localities);
        }
        
        // Mettre à jour les sites si fournis
        if (req.body.sites && Array.isArray(req.body.sites)) {
            await ProjectModel.updateSites(req.params.id, req.body.sites);
        }
        
        // Mettre à jour les mesures si fournies
        if (req.body.measures && Array.isArray(req.body.measures)) {
            await ProjectModel.updateMeasures(req.params.id, req.body.measures);
        }
        
        // Mettre à jour les parties prenantes si fournies
        if (req.body.stakeholders && Array.isArray(req.body.stakeholders)) {
            await ProjectModel.updateStakeholders(req.params.id, req.body.stakeholders);
        }
        
        // Mettre à jour les financements si fournis
        if (req.body.funding && Array.isArray(req.body.funding)) {
            await ProjectModel.updateFunding(req.params.id, req.body.funding);
        }
        
        res.json({ success: true, message: 'Projet mis à jour avec succès', data: updated });
    } catch (error) {
        next(error);
    }
};

exports.updateProgress = async (req, res, next) => {
    try {
        const { progress_percentage } = req.body;
        
        if (progress_percentage === undefined || progress_percentage < 0 || progress_percentage > 100) {
            return res.status(400).json({ success: false, message: 'Pourcentage invalide (0-100)' });
        }
        
        const project = await ProjectModel.updateProgress(req.params.id, progress_percentage);
        
        if (!project) {
            return res.status(404).json({ success: false, message: 'Projet non trouvé' });
        }
        
        res.json({ success: true, message: 'Avancement mis à jour', data: project });
    } catch (error) {
        next(error);
    }
};

exports.deleteProject = async (req, res, next) => {
    try {
        const project = await ProjectModel.findById(req.params.id);
        
        if (!project) {
            return res.status(404).json({ success: false, message: 'Projet non trouvé' });
        }
        
        // Vérifier l'accès en écriture (admin, ou directeur/utilisateur de la structure)
        const canModify = await canUserModifyProject(req.user, req.params.id);
        if (!canModify) {
            return res.status(403).json({ success: false, message: 'Accès refusé' });
        }

        await ProjectModel.delete(req.params.id);
        res.json({ success: true, message: 'Projet supprimé avec succès (restaurable par un admin)' });
    } catch (error) {
        next(error);
    }
};

/**
 * Lister les projets supprimés (corbeille) — admin uniquement.
 */
exports.listDeleted = async (req, res, next) => {
    try {
        const rows = await ProjectModel.findDeleted();
        res.json({ success: true, count: rows.length, data: rows });
    } catch (error) {
        next(error);
    }
};

/**
 * Restaurer un projet supprimé — admin uniquement.
 */
exports.restoreProject = async (req, res, next) => {
    try {
        const row = await ProjectModel.restore(req.params.id);
        if (!row) return res.status(404).json({ success: false, message: 'Projet non trouvé dans la corbeille' });
        res.json({ success: true, message: 'Projet restauré', data: row });
    } catch (error) {
        next(error);
    }
};

/**
 * Suppression définitive — admin uniquement.
 */
exports.hardDeleteProject = async (req, res, next) => {
    try {
        const row = await ProjectModel.hardDelete(req.params.id);
        if (!row) return res.status(404).json({ success: false, message: 'Projet non trouvé' });
        res.json({ success: true, message: 'Projet supprimé définitivement' });
    } catch (error) {
        next(error);
    }
};

exports.addLocality = async (req, res, next) => {
    try {
        const locality = await ProjectModel.addLocality(req.params.id, req.body);
        res.status(201).json({ success: true, data: locality });
    } catch (error) {
        next(error);
    }
};

exports.addSite = async (req, res, next) => {
    try {
        const site = await ProjectModel.addSite(req.params.id, req.body);
        res.status(201).json({ success: true, data: site });
    } catch (error) {
        next(error);
    }
};

exports.addMeasure = async (req, res, next) => {
    try {
        const measure = await ProjectModel.addMeasure(req.params.id, req.body);
        res.status(201).json({ success: true, data: measure });
    } catch (error) {
        next(error);
    }
};

exports.addStakeholder = async (req, res, next) => {
    try {
        const stakeholder = await ProjectModel.addStakeholder(req.params.id, req.body);
        res.status(201).json({ success: true, data: stakeholder });
    } catch (error) {
        next(error);
    }
};

exports.addFinancing = async (req, res, next) => {
    try {
        const financing = await ProjectModel.addFinancing(req.params.id, req.body);
        res.status(201).json({ success: true, data: financing });
    } catch (error) {
        next(error);
    }
};

exports.getStats = async (req, res, next) => {
    try {
        let stats;
        if (req.user.role === 'commandement_territorial' && req.user.territorial_level && req.user.territorial_value) {
            stats = await ProjectModel.getStatsByTerritory(req.user.territorial_level, req.user.territorial_value);
        } else {
            // Scoping cohérent avec getAllProjects :
            //  - utilisateur : pinné à sa structure
            //  - lecteur / auditeur SCOPÉS (avec structure) : pinnés à leur structure
            //    (sinon ils pourraient passer ?structure_id=autre pour voir les stats
            //    d'une structure non autorisée — privilege escalation)
            //  - admin / superviseur / directeur / lecteur global : peuvent filtrer
            //    librement via ?structure_id
            const role = req.user.role;
            const userSid = req.user.structure_id;
            let structureId;
            if (role === 'utilisateur') structureId = userSid;
            else if ((role === 'lecteur' || role === 'auditeur') && userSid) structureId = userSid;
            else structureId = req.query.structure_id;
            stats = await ProjectModel.getStats(structureId);
        }
        res.json({ success: true, data: stats });
    } catch (error) {
        next(error);
    }
};

// ============================================
// Project-Structure Mapping Controllers
// ============================================

/**
 * Get all structures assigned to a project
 */
exports.getProjectStructures = async (req, res, next) => {
    try {
        const structures = await ProjectStructure.getStructuresByProject(req.params.id);
        res.json({ success: true, count: structures.length, data: structures });
    } catch (error) {
        next(error);
    }
};

/**
 * Assign structures to a project (admin only)
 */
exports.assignStructuresToProject = async (req, res, next) => {
    try {
        const { structure_ids } = req.body;
        
        if (!Array.isArray(structure_ids)) {
            return res.status(400).json({ 
                success: false, 
                message: 'structure_ids doit être un tableau' 
            });
        }
        
        await ProjectStructure.assignMultipleStructures(
            req.params.id, 
            structure_ids, 
            req.user.id
        );
        
        const structures = await ProjectStructure.getStructuresByProject(req.params.id);
        res.json({ 
            success: true, 
            message: 'Structures assignées avec succès',
            data: structures 
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Remove a structure from a project (admin only)
 */
exports.removeStructureFromProject = async (req, res, next) => {
    try {
        const removed = await ProjectStructure.removeStructure(
            req.params.id, 
            req.params.structureId
        );
        
        if (!removed) {
            return res.status(404).json({ 
                success: false, 
                message: 'Mapping non trouvé' 
            });
        }
        
        res.json({ 
            success: true, 
            message: 'Structure retirée du projet' 
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Get all project-structure mappings (admin only)
 */
exports.getAllMappings = async (req, res, next) => {
    try {
        const mappings = await ProjectStructure.getAllMappings();
        res.json({ success: true, count: mappings.length, data: mappings });
    } catch (error) {
        next(error);
    }
};

/**
 * Assigner un utilisateur à une mesure (chef de projet uniquement)
 */
exports.assignUserToMeasure = async (req, res, next) => {
    try {
        const { measureId } = req.params;
        const { userId } = req.body;

        if (!userId) {
            return res.status(400).json({ success: false, message: 'ID utilisateur requis' });
        }

        // Récupérer la mesure pour obtenir le project_id
        const measure = await ProjectModel.findById(req.params.projectId);
        if (!measure) {
            return res.status(404).json({ success: false, message: 'Projet non trouvé' });
        }

        // Vérifier si l'utilisateur est le chef de projet, admin, ou directeur de la
        // structure principale du projet (admin de structure).
        const isManager = await ProjectModel.isProjectManager(req.params.projectId, req.user.id);
        const isDirOfStruct = isDirecteurOfProject(req.user, measure);
        if (!isManager && req.user.role !== 'admin' && !isDirOfStruct) {
            return res.status(403).json({ success: false, message: 'Seul le chef de projet ou le directeur de la structure peut assigner des utilisateurs' });
        }

        const updated = await ProjectModel.assignUserToMeasure(measureId, userId);

        // Notification + email à l'utilisateur assigné (best-effort, non bloquant)
        if (parseInt(userId) !== req.user.id) {
            const projTitle = measure.title || `Projet #${req.params.projectId}`;
            const measureDesc = (updated?.description || '').slice(0, 120);
            NotificationModel.create({
                userId: parseInt(userId),
                type: 'measure_assigned',
                title: `Nouvelle mesure assignée : ${projTitle}`,
                body: measureDesc || null,
                linkUrl: `#/my-measures`
            }).catch(err => console.error('Notification create failed:', err));
            _emailMeasureAssigned(parseInt(userId), updated, { title: projTitle });
        }

        res.json({ success: true, message: 'Utilisateur assigné à la mesure', data: updated });
    } catch (error) {
        next(error);
    }
};

/**
 * Réassigner une mesure à une autre structure et/ou utilisateur (chef de projet ou admin)
 */
exports.reassignMeasure = async (req, res, next) => {
    try {
        const { projectId, measureId } = req.params;
        const { structure_id, assigned_user_id } = req.body;

        const isManager = await ProjectModel.isProjectManager(projectId, req.user.id);
        // Pour le directeur de la structure, on charge le projet (léger) pour vérifier sa structure
        let isDirOfStruct = false;
        if (req.user.role === 'directeur' && !isManager && req.user.role !== 'admin') {
            const proj = await ProjectModel.findById(projectId);
            isDirOfStruct = isDirecteurOfProject(req.user, proj);
        }
        if (!isManager && req.user.role !== 'admin' && !isDirOfStruct) {
            return res.status(403).json({ success: false, message: 'Seul le chef de projet, le directeur de la structure ou un admin peut réassigner une mesure' });
        }

        // L'UPDATE filtre sur id + project_id : retourne null si la mesure n'appartient pas au projet
        const updated = await ProjectModel.reassignMeasure(measureId, projectId, {
            structure_id: structure_id || null,
            assigned_user_id: assigned_user_id || null
        });

        if (!updated) {
            return res.status(404).json({ success: false, message: 'Mesure non trouvée pour ce projet' });
        }

        // Notification + email si nouvelle assignation utilisateur (≠ actuel)
        if (assigned_user_id && parseInt(assigned_user_id) !== req.user.id) {
            NotificationModel.create({
                userId: parseInt(assigned_user_id),
                type: 'measure_assigned',
                title: 'Une mesure vient de vous être assignée',
                body: (updated.description || '').slice(0, 120) || null,
                linkUrl: `#/my-measures`
            }).catch(err => console.error('Notification create failed:', err));
            // On charge le projet une fois pour avoir le titre dans l'email.
            ProjectModel.findById(projectId)
                .then(p => _emailMeasureAssigned(parseInt(assigned_user_id), updated, p))
                .catch(() => {});
        }

        res.json({ success: true, message: 'Mesure réassignée', data: updated });
    } catch (error) {
        next(error);
    }
};

/**
 * Mettre à jour le statut d'une mesure (utilisateur assigné uniquement)
 */
exports.updateMeasureStatus = async (req, res, next) => {
    try {
        const { measureId } = req.params;
        const { status, constraints } = req.body;

        if (!status) {
            return res.status(400).json({ success: false, message: 'Statut requis' });
        }

        // Vérifier que l'utilisateur est assigné à cette mesure ou est admin/chef de projet
        const project = await ProjectModel.findById(req.params.projectId);
        if (!project) {
            return res.status(404).json({ success: false, message: 'Projet non trouvé' });
        }

        const measure = project.measures.find(m => m.id == measureId);
        if (!measure) {
            return res.status(404).json({ success: false, message: 'Mesure non trouvée' });
        }

        const isAssigned = measure.assigned_user_id === req.user.id;
        const isManager = await ProjectModel.isProjectManager(req.params.projectId, req.user.id);
        const isDirOfStruct = isDirecteurOfProject(req.user, project);

        if (!isAssigned && !isManager && req.user.role !== 'admin' && !isDirOfStruct) {
            return res.status(403).json({ success: false, message: 'Accès refusé' });
        }

        const oldStatus = measure.status;
        const updated = await ProjectModel.updateMeasureStatus(measureId, status, constraints);

        // Notifier tous les "watchers" du projet/mesure : admins, directeur de
        // la structure, chef de projet, utilisateur assigné. On exclut celui
        // qui vient d'effectuer le changement pour ne pas se notifier soi-même.
        collectMeasureWatchers(
            req.params.projectId,
            measure.assigned_user_id,
            req.user.id
        ).then(userIds => {
            const statusLabel = STATUS_LABELS[status] || status;
            const projTitle = project.title || `Projet #${req.params.projectId}`;
            const body = (measure.description || '').slice(0, 140) || null;
            const link = `#/projects/${req.params.projectId}`;
            // Notifications in-app
            const notifs = userIds.map(uid => NotificationModel.create({
                userId: uid,
                type: 'measure_status_changed',
                title: `Statut changé → ${statusLabel} · ${projTitle}`,
                body,
                linkUrl: link
            }));
            // Emails (no-op pour ceux sans email)
            for (const uid of userIds) {
                _emailMeasureStatusChanged(uid, measure, project, oldStatus, status);
            }
            return Promise.all(notifs);
        }).catch(err => console.error('Notify watchers failed:', err));

        res.json({ success: true, message: 'Statut de la mesure mis à jour', data: updated });
    } catch (error) {
        next(error);
    }
};

// ============================================
// Project Comments Controllers
// ============================================

exports.getComments = async (req, res, next) => {
    try {
        const comments = await ProjectModel.getComments(req.params.id);
        res.json({ success: true, data: comments });
    } catch (error) { next(error); }
};

exports.addComment = async (req, res, next) => {
    try {
        const { comment } = req.body;
        if (!comment || !comment.trim()) {
            return res.status(400).json({ success: false, message: 'Le commentaire est requis' });
        }
        const result = await ProjectModel.addComment(req.params.id, req.user.id, comment.trim());
        res.status(201).json({ success: true, data: result });
    } catch (error) { next(error); }
};

exports.deleteComment = async (req, res, next) => {
    try {
        const result = await ProjectModel.deleteComment(req.params.commentId, req.user.id);
        if (!result) {
            return res.status(404).json({ success: false, message: 'Commentaire non trouvé' });
        }
        res.json({ success: true, message: 'Commentaire supprimé' });
    } catch (error) { next(error); }
};


