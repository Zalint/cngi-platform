const ProjectModel = require('../models/project.model');
const ProjectStructure = require('../models/projectStructure.model');
const { validateProjectData, validateProjectDataForUpdate } = require('../utils/validators');
const { canUserAccessProject } = require('../utils/projectAccess');

exports.getAllProjects = async (req, res, next) => {
    try {
        let projects;

        if (req.user.role === 'superviseur') {
            // Superviseur voit tous les projets (comme admin)
            const filters = {};
            if (req.query.structure_id) filters.structure_id = req.query.structure_id;
            if (req.query.status) filters.status = req.query.status;
            projects = await ProjectModel.findAll(filters);
        } else if (req.user.role === 'commandement_territorial') {
            // Commandement territorial voit les projets de son territoire
            projects = await ProjectModel.findByTerritory(req.user.territorial_level, req.user.territorial_value);
        } else if ((req.user.role === 'utilisateur' || req.user.role === 'directeur') && req.user.structure_id) {
            // Si utilisateur ou directeur, filtrer par sa structure via project_structures
            projects = await ProjectStructure.getProjectsByStructure(req.user.structure_id);
        } else {
            // Admin voit tous les projets
            const filters = {};
            if (req.query.structure_id) filters.structure_id = req.query.structure_id;
            if (req.query.status) filters.status = req.query.status;
            projects = await ProjectModel.findAll(filters);
        }

        res.json({ success: true, count: projects.length, data: projects });
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

        res.json({ success: true, data: project });
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
        
        // Si utilisateur, forcer sa structure
        if (req.user.role === 'utilisateur') {
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
        
        // Vérifier l'accès
        if (req.user.role === 'utilisateur' && req.user.structure_id) {
            const hasAccess = await ProjectStructure.userHasAccessToProject(req.user.id, req.params.id);
            if (!hasAccess) {
                return res.status(403).json({ success: false, message: 'Accès refusé' });
            }
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
        
        // Vérifier l'accès (admin ou utilisateur de la structure principale)
        if (req.user.role === 'utilisateur' && project.structure_id !== req.user.structure_id) {
            return res.status(403).json({ success: false, message: 'Accès refusé' });
        }
        
        await ProjectModel.delete(req.params.id);
        res.json({ success: true, message: 'Projet supprimé avec succès' });
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
            const structureId = (req.user.role === 'utilisateur' || req.user.role === 'directeur') ? req.user.structure_id : req.query.structure_id;
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

        // Vérifier si l'utilisateur est le chef de projet ou admin
        const isManager = await ProjectModel.isProjectManager(req.params.projectId, req.user.id);
        if (!isManager && req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Seul le chef de projet peut assigner des utilisateurs' });
        }

        const updated = await ProjectModel.assignUserToMeasure(measureId, userId);
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
        if (!isManager && req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Seul le chef de projet ou un admin peut réassigner une mesure' });
        }

        // L'UPDATE filtre sur id + project_id : retourne null si la mesure n'appartient pas au projet
        const updated = await ProjectModel.reassignMeasure(measureId, projectId, {
            structure_id: structure_id || null,
            assigned_user_id: assigned_user_id || null
        });

        if (!updated) {
            return res.status(404).json({ success: false, message: 'Mesure non trouvée pour ce projet' });
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
        
        if (!isAssigned && !isManager && req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Accès refusé' });
        }

        const updated = await ProjectModel.updateMeasureStatus(measureId, status, constraints);
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


