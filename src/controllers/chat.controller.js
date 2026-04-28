const OpenAI = require('openai');
const db = require('../config/db');
const ProjectModel = require('../models/project.model');
const ProjectStructure = require('../models/projectStructure.model');
const StructureModel = require('../models/structure.model');
const ObservationModel = require('../models/observation.model');
const PvModel = require('../models/pv.model');
const { canUserAccessProject } = require('../utils/projectAccess');

// Borne dure sur le nombre de lignes renvoyées aux tools list_*
// pour éviter de gonfler le contexte du LLM (et les coûts). Si l'utilisateur a besoin
// de plus, il doit filtrer (project_id, structure, vulnerability, commune...).
const LIST_CAP = 100;

const STATUS_LABELS = {
    demarrage: 'Démarrage', en_cours: 'En cours', termine: 'Terminé', retard: 'En retard', annule: 'Annulé'
};
const PRIORITY_LABELS = { normale: 'Normale', haute: 'Haute', urgente: 'Urgente' };
const TYPE_LABELS = { renforcement_resilience: 'Renforcement de la résilience', structurant: 'Structurant' };
const MEASURE_STATUS_LABELS = {
    preconisee: 'Préconisée', executee: 'Exécutée', non_executee: 'Non exécutée', observations: 'Observations'
};

// ==================== Helpers ====================

function daysBetween(dateStr, ref = new Date()) {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return null;
    return Math.round((d - ref) / (1000 * 60 * 60 * 24));
}

function isOverdue(p) {
    if (!p.deadline_date) return false;
    if (p.status === 'termine' || p.status === 'annule') return false;
    return new Date(p.deadline_date) < new Date();
}

// ==================== Données visibles selon le rôle ====================

async function getProjectsForUser(user, filters = {}) {
    let projects;
    if (user.role === 'commandement_territorial') {
        projects = await ProjectModel.findByTerritory(user.territorial_level, user.territorial_value);
    } else if (user.role === 'utilisateur' && user.structure_id) {
        projects = await ProjectStructure.getProjectsByStructure(user.structure_id);
    } else {
        projects = await ProjectModel.findAll({});
    }

    if (filters.status) projects = projects.filter(p => p.status === filters.status);
    if (filters.priority) projects = projects.filter(p => p.priority === filters.priority);
    if (filters.project_type) projects = projects.filter(p => p.project_type === filters.project_type);
    if (filters.structure) {
        const code = String(filters.structure).toUpperCase();
        projects = projects.filter(p => (p.structure_code || '').toUpperCase() === code);
    }
    if (filters.q && String(filters.q).trim()) {
        const term = String(filters.q).trim().toLowerCase();
        projects = projects.filter(p =>
            (p.title || '').toLowerCase().includes(term) ||
            (p.description || '').toLowerCase().includes(term)
        );
    }
    if (filters.overdue === true) projects = projects.filter(isOverdue);
    if (filters.deadline_from) {
        const from = new Date(filters.deadline_from);
        projects = projects.filter(p => p.deadline_date && new Date(p.deadline_date) >= from);
    }
    if (filters.deadline_to) {
        const to = new Date(filters.deadline_to);
        projects = projects.filter(p => p.deadline_date && new Date(p.deadline_date) <= to);
    }
    return projects;
}

async function getVisibleProjectIds(user) {
    const projects = await getProjectsForUser(user, {});
    return new Set(projects.map(p => p.id));
}

function projectSummary(p) {
    const overdue = isOverdue(p);
    const days = daysBetween(p.deadline_date);
    return {
        id: p.id,
        titre: p.title,
        structure: p.structure_code,
        statut: STATUS_LABELS[p.status] || p.status,
        priorite: PRIORITY_LABELS[p.priority || 'normale'],
        type: TYPE_LABELS[p.project_type] || null,
        avancement_pct: p.progress_percentage || 0,
        date_debut: p.start_date,
        date_fin: p.end_date,
        echeance: p.deadline_date,
        jours_avant_echeance: days,
        en_retard: overdue,
        budget_fcfa: p.budget ? Number(p.budget) : null,
        chef: p.project_manager_first_name
            ? `${p.project_manager_first_name} ${p.project_manager_last_name || ''}`.trim()
            : null,
        nb_sites: p.sites_count != null ? Number(p.sites_count) : undefined,
        nb_mesures: p.measures_count != null ? Number(p.measures_count) : undefined
    };
}

// ==================== Tools exposés au LLM ====================

const tools = [
    {
        type: 'function',
        function: {
            name: 'list_projects',
            description: "Liste les projets visibles par l'utilisateur. Renvoie un résumé enrichi (id, titre, structure, statut, priorité, dates début/fin/échéance, jours avant échéance, en_retard, avancement, budget, chef, compteurs). Filtres : statut, priorité, type, structure, recherche texte, échéance, en retard.",
            parameters: {
                type: 'object',
                properties: {
                    status: { type: 'string', enum: ['demarrage', 'en_cours', 'termine', 'retard', 'annule'] },
                    priority: { type: 'string', enum: ['normale', 'haute', 'urgente'] },
                    project_type: { type: 'string', enum: ['renforcement_resilience', 'structurant'] },
                    structure: { type: 'string', description: 'Code structure (ex: DPGI, ONAS)' },
                    q: { type: 'string', description: 'Recherche texte (titre + description)' },
                    overdue: { type: 'boolean', description: 'Uniquement les projets dont l\'échéance est passée et qui ne sont ni terminés ni annulés' },
                    deadline_from: { type: 'string', description: 'Échéance ≥ cette date (YYYY-MM-DD)' },
                    deadline_to: { type: 'string', description: 'Échéance ≤ cette date (YYYY-MM-DD)' }
                }
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'get_project',
            description: "Détail complet d'un projet : description, contraintes, mesures attendues, sites, mesures avec statut/avancement et structure/utilisateur assignés, parties prenantes, financements, localités, commentaires récents, structures rattachées.",
            parameters: {
                type: 'object',
                properties: { id: { type: 'integer' } },
                required: ['id']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'get_stats',
            description: "Statistiques agrégées des projets visibles : total, répartition par statut/priorité/structure/type, avancement moyen, retards, échéances proches (7 et 30 jours), budget total, observations urgentes ouvertes.",
            parameters: { type: 'object', properties: {} }
        }
    },
    {
        type: 'function',
        function: {
            name: 'list_structures',
            description: 'Liste toutes les structures du CNGIRI (DPGI, ONAS, BNSP, CETUD, AGEROUTE, DPC, etc.).',
            parameters: { type: 'object', properties: {} }
        }
    },
    {
        type: 'function',
        function: {
            name: 'list_users',
            description: "Liste les utilisateurs visibles (chefs de projet, agents par structure). Filtres : rôle, structure, recherche nom. Utile pour savoir qui pilote quoi ou qui contacter.",
            parameters: {
                type: 'object',
                properties: {
                    role: { type: 'string', enum: ['admin', 'utilisateur', 'directeur', 'commandement_territorial', 'superviseur'] },
                    structure: { type: 'string', description: 'Code structure (ex: DPGI)' },
                    q: { type: 'string', description: 'Recherche nom/prénom/username' },
                    project_managers_only: { type: 'boolean', description: 'Uniquement les utilisateurs qui pilotent au moins un projet' }
                }
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'list_measures',
            description: "Liste les mesures (actions opérationnelles) des projets visibles. Filtres : projet, structure assignée, utilisateur assigné, statut, recherche texte. Renvoie description, type, statut, projet/site, structure et utilisateur assignés.",
            parameters: {
                type: 'object',
                properties: {
                    project_id: { type: 'integer' },
                    structure: { type: 'string', description: 'Code structure assignée à la mesure' },
                    assigned_username: { type: 'string' },
                    status: { type: 'string', enum: ['preconisee', 'executee', 'non_executee', 'observations'] },
                    q: { type: 'string', description: 'Recherche texte dans la description' }
                }
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'list_observations',
            description: "Liste les observations/directives du Ministre. Filtres : projet, priorité, portée. Renvoie titre, contenu, échéance, jours_avant_echeance, projet rattaché, auteur. Important : c'est ici que se trouvent les échéances fixées par le Ministre, pas dans les projets.",
            parameters: {
                type: 'object',
                properties: {
                    project_id: { type: 'integer' },
                    priority: { type: 'string', enum: ['info', 'importante', 'urgente'] },
                    scope: { type: 'string', enum: ['global', 'project'] }
                }
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'list_pv',
            description: "PV de visite du Commandement Territorial visibles par l'utilisateur. Avancement, observations, recommandations + projets/sites/localités/mesures liés.",
            parameters: { type: 'object', properties: {} }
        }
    },
    {
        type: 'function',
        function: {
            name: 'get_pv',
            description: 'Détail complet d\'un PV de visite par ID.',
            parameters: {
                type: 'object',
                properties: { id: { type: 'integer' } },
                required: ['id']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'list_sites',
            description: `Sites d'intervention (points géolocalisés). Filtres : projet, structure, vulnérabilité, région/département/commune, PCS. Capé à ${LIST_CAP}.`,
            parameters: {
                type: 'object',
                properties: {
                    project_id:    { type: 'integer' },
                    structure:     { type: 'string' },
                    vulnerability: { type: 'string', enum: ['normal', 'elevee', 'tres_elevee'] },
                    region:        { type: 'string' },
                    departement:   { type: 'string' },
                    commune:       { type: 'string' },
                    is_pcs:        { type: 'boolean', description: 'PCS uniquement (réservé DPGI)' }
                }
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'list_geometries',
            description: `Tracés sur la carte (polylignes/polygones) : conduites de drainage, zones d'intervention, zones inondables. Capé à ${LIST_CAP}.`,
            parameters: {
                type: 'object',
                properties: {
                    project_id:    { type: 'integer' },
                    structure:     { type: 'string' },
                    usage:         { type: 'string', enum: ['drainage', 'intervention', 'zone_inondable', 'autre'] },
                    kind:          { type: 'string', enum: ['linestring', 'polygon'] },
                    vulnerability: { type: 'string', enum: ['normal', 'elevee', 'tres_elevee'] }
                }
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'search_deadlines',
            description: "Cherche TOUTES les échéances (projets + observations du Ministre + mesures) dans une fenêtre temporelle. Utiliser dès qu'on parle d'une date butoir, deadline, échéance, sans savoir si c'est un projet ou une directive. Trie par date croissante.",
            parameters: {
                type: 'object',
                properties: {
                    from: { type: 'string', description: 'Date min (YYYY-MM-DD). Défaut : aujourd\'hui.' },
                    to:   { type: 'string', description: 'Date max (YYYY-MM-DD). Défaut : +90 jours.' },
                    include_overdue: { type: 'boolean', description: 'Inclure aussi les échéances déjà dépassées (défaut: true)' }
                }
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'search',
            description: "Recherche plein texte transversale (projets, observations, PV) sur titre/contenu. Renvoie un mélange typé avec id, type, titre, extrait. Utile pour 'parle-moi de X' sans savoir où chercher.",
            parameters: {
                type: 'object',
                properties: {
                    q: { type: 'string', description: 'Terme à chercher' }
                },
                required: ['q']
            }
        }
    }
];

// ==================== Exécution d'un tool ====================

async function executeTool(name, args, user) {
    try {
        if (name === 'list_projects') {
            const projects = await getProjectsForUser(user, args);
            return projects.map(projectSummary);
        }

        if (name === 'get_project') {
            const project = await ProjectModel.findById(args.id);
            if (!project) return { error: 'Projet non trouvé' };
            const access = await canUserAccessProject(user, args.id);
            if (!access) return { error: 'Accès refusé à ce projet' };

            const comments = await ProjectModel.getComments(args.id).catch(() => []);

            return {
                id: project.id,
                titre: project.title,
                structure: project.structure_code,
                statut: STATUS_LABELS[project.status] || project.status,
                priorite: PRIORITY_LABELS[project.priority || 'normale'],
                type: TYPE_LABELS[project.project_type] || null,
                avancement_pct: project.progress_percentage || 0,
                date_debut: project.start_date,
                date_fin: project.end_date,
                echeance: project.deadline_date,
                jours_avant_echeance: daysBetween(project.deadline_date),
                en_retard: isOverdue(project),
                budget_fcfa: project.budget ? Number(project.budget) : null,
                chef: project.project_manager_first_name
                    ? `${project.project_manager_first_name} ${project.project_manager_last_name || ''}`.trim()
                    : null,
                description: project.description,
                contraintes: project.constraints,
                mesures_attendues: project.expected_measures,
                structures_assignees: (project.assigned_structures || []).map(s => s.code),
                nb_sites: (project.sites || []).length,
                sites: (project.sites || []).slice(0, 20).map(s => ({
                    id: s.id, nom: s.name, region: s.region, departement: s.departement, commune: s.commune,
                    pcs: !!s.is_pcs, vulnerabilite: s.vulnerability_level
                })),
                localites: (project.localities || []).map(l => ({
                    region: l.region, departement: l.departement, arrondissement: l.arrondissement, commune: l.commune
                })),
                nb_mesures: (project.measures || []).length,
                mesures: (project.measures || []).map(m => ({
                    id: m.id,
                    description: m.description,
                    type: m.type,
                    statut: MEASURE_STATUS_LABELS[m.status] || m.status,
                    structure_assignee: m.structure_code,
                    utilisateur_assigne: m.assigned_username
                        ? `${m.assigned_first_name || ''} ${m.assigned_last_name || ''}`.trim() || m.assigned_username
                        : null,
                    nb_commentaires: (m.comments || []).length
                })),
                parties_prenantes: (project.stakeholders || []).map(s => ({
                    nom: s.name, type: s.type, contact: s.contact_name, email: s.contact_email, tel: s.contact_phone
                })),
                financements: (project.funding || []).map(f => ({
                    montant: f.amount ? Number(f.amount) : null,
                    devise: f.currency || 'FCFA',
                    source: f.source,
                    disponibilite: f.availability
                })),
                budget_total_finance: (project.funding || []).reduce((sum, f) => sum + (Number(f.amount) || 0), 0) || null,
                nb_commentaires: comments.length,
                derniers_commentaires: comments.slice(0, 5).map(c => ({
                    auteur: `${c.first_name || ''} ${c.last_name || ''}`.trim() || c.username,
                    commentaire: c.comment,
                    date: c.created_at
                }))
            };
        }

        if (name === 'get_stats') {
            const projects = await getProjectsForUser(user, {});
            const stats = {
                total: projects.length,
                par_statut: { demarrage: 0, en_cours: 0, termine: 0, retard: 0, annule: 0 },
                par_priorite: { normale: 0, haute: 0, urgente: 0 },
                par_structure: {},
                par_type: { renforcement_resilience: 0, structurant: 0, non_renseigne: 0 },
                avancement_moyen_pct: 0,
                budget_total_fcfa: 0,
                en_retard: 0,
                echeances_7j: 0,
                echeances_30j: 0
            };
            let sum = 0;
            for (const p of projects) {
                stats.par_statut[p.status] = (stats.par_statut[p.status] || 0) + 1;
                const prio = p.priority || 'normale';
                stats.par_priorite[prio] = (stats.par_priorite[prio] || 0) + 1;
                const code = p.structure_code || 'INCONNU';
                stats.par_structure[code] = (stats.par_structure[code] || 0) + 1;
                const type = p.project_type || 'non_renseigne';
                stats.par_type[type] = (stats.par_type[type] || 0) + 1;
                sum += p.progress_percentage || 0;
                if (p.budget) stats.budget_total_fcfa += Number(p.budget);
                if (isOverdue(p)) stats.en_retard++;
                const days = daysBetween(p.deadline_date);
                if (days != null && days >= 0 && days <= 7 && p.status !== 'termine' && p.status !== 'annule') stats.echeances_7j++;
                if (days != null && days >= 0 && days <= 30 && p.status !== 'termine' && p.status !== 'annule') stats.echeances_30j++;
            }
            stats.avancement_moyen_pct = projects.length ? Math.round(sum / projects.length) : 0;

            // Observations urgentes globales
            const obs = await ObservationModel.findAll({ priority: 'urgente' }).catch(() => []);
            stats.observations_urgentes = obs.length;

            return stats;
        }

        if (name === 'list_structures') {
            const all = await StructureModel.findAll();
            return all.map(s => ({ id: s.id, code: s.code, name: s.name, description: s.description }));
        }

        if (name === 'list_users') {
            const conds = ['u.is_active = true'];
            const params = [];
            let i = 1;
            if (args.role) { conds.push(`u.role = $${i++}`); params.push(args.role); }
            if (args.structure) {
                conds.push(`UPPER(s.code) = $${i++}`); params.push(String(args.structure).toUpperCase());
            }
            if (args.q) {
                conds.push(`(u.first_name ILIKE $${i} OR u.last_name ILIKE $${i} OR u.username ILIKE $${i})`);
                params.push(`%${args.q}%`); i++;
            }
            if (args.project_managers_only) {
                conds.push(`u.id IN (SELECT DISTINCT project_manager_id FROM projects WHERE deleted_at IS NULL AND project_manager_id IS NOT NULL)`);
            }
            const result = await db.query(`
                SELECT u.id, u.username, u.first_name, u.last_name, u.email, u.role, u.title,
                       s.code as structure_code, s.name as structure_name,
                       (SELECT COUNT(*) FROM projects p WHERE p.project_manager_id = u.id AND p.deleted_at IS NULL) as projets_pilotes,
                       (SELECT COUNT(*) FROM measures m WHERE m.assigned_user_id = u.id) as mesures_assignees
                FROM users u
                LEFT JOIN structures s ON u.structure_id = s.id
                WHERE ${conds.join(' AND ')}
                ORDER BY u.last_name, u.first_name
                LIMIT ${LIST_CAP}
            `, params);
            return result.rows.map(r => ({
                id: r.id,
                nom_complet: [r.first_name, r.last_name].filter(Boolean).join(' ') || r.username,
                username: r.username,
                email: r.email,
                titre: r.title,
                role: r.role,
                structure: r.structure_code,
                projets_pilotes: Number(r.projets_pilotes) || 0,
                mesures_assignees: Number(r.mesures_assignees) || 0
            }));
        }

        if (name === 'list_measures') {
            const visible = await getVisibleProjectIds(user);
            if (visible.size === 0) return [];

            const conds = ['m.project_id = ANY($1::int[])'];
            const params = [Array.from(visible)];
            let i = 2;
            if (Number.isInteger(args.project_id)) {
                conds.push(`m.project_id = $${i++}`); params.push(args.project_id);
            }
            if (args.status) {
                conds.push(`m.status = $${i++}`); params.push(args.status);
            }
            if (args.structure) {
                conds.push(`UPPER(ms.code) = $${i++}`); params.push(String(args.structure).toUpperCase());
            }
            if (args.assigned_username) {
                conds.push(`u.username = $${i++}`); params.push(args.assigned_username);
            }
            if (args.q) {
                conds.push(`m.description ILIKE $${i++}`); params.push(`%${args.q}%`);
            }

            const result = await db.query(`
                SELECT m.id, m.description, m.type, m.status, m.constraints,
                       m.project_id, p.title as project_title,
                       p.status as project_status,
                       ms.code as structure_code,
                       u.username as assigned_username,
                       u.first_name as assigned_first_name, u.last_name as assigned_last_name,
                       s.name as site_name
                FROM measures m
                INNER JOIN projects p ON m.project_id = p.id AND p.deleted_at IS NULL
                LEFT JOIN structures ms ON m.structure_id = ms.id
                LEFT JOIN users u ON m.assigned_user_id = u.id
                LEFT JOIN sites s ON m.site_id = s.id
                WHERE ${conds.join(' AND ')}
                ORDER BY m.id DESC
                LIMIT ${LIST_CAP}
            `, params);

            return result.rows.map(r => ({
                id: r.id,
                description: r.description,
                type: r.type,
                statut: MEASURE_STATUS_LABELS[r.status] || r.status,
                contraintes: r.constraints,
                projet_id: r.project_id,
                projet_titre: r.project_title,
                projet_statut: STATUS_LABELS[r.project_status] || r.project_status,
                structure_assignee: r.structure_code,
                utilisateur_assigne: r.assigned_username
                    ? [r.assigned_first_name, r.assigned_last_name].filter(Boolean).join(' ') || r.assigned_username
                    : null,
                site: r.site_name
            }));
        }

        if (name === 'list_observations') {
            const observations = await ObservationModel.findAll(args || {});
            return observations.map(o => ({
                id: o.id,
                titre: o.title,
                contenu: o.content,
                priorite: o.priority,
                echeance: o.deadline,
                jours_avant_echeance: daysBetween(o.deadline),
                en_retard: o.deadline ? new Date(o.deadline) < new Date() : false,
                portee: o.project_id ? 'projet' : 'globale',
                projet_id: o.project_id,
                projet_titre: o.project_title || null,
                auteur_nom_complet: [o.author_first_name, o.author_last_name].filter(Boolean).join(' ') || o.author_username || null,
                auteur_titre: o.author_title || null,
                cree_le: o.created_at,
                nb_pieces_jointes: (o.attachments || []).length
            }));
        }

        if (name === 'list_pv') {
            const pvs = await PvModel.findAllVisible(user);
            return pvs.map(p => ({
                id: p.id,
                titre: p.title,
                priorite: p.priority,
                territoire: `${p.territorial_level}=${p.territorial_value}`,
                date_visite: p.visit_date,
                avancement: p.avancement,
                observations: p.observations,
                recommandations: p.recommendations,
                notes: p.content,
                auteur_nom_complet: [p.author_first_name, p.author_last_name].filter(Boolean).join(' ') || p.author_username || null,
                auteur_titre: p.author_title || null,
                projets: (p.projects || []).map(x => ({ id: x.id, titre: x.title })),
                sites: (p.sites || []).map(x => ({ id: x.id, nom: x.name })),
                localites: (p.localities || []).map(x => [x.region, x.departement, x.arrondissement, x.commune].filter(Boolean).join(' › ')),
                mesures: (p.measures || []).map(x => ({ id: x.id, description: x.description })),
                cree_le: p.created_at
            }));
        }

        if (name === 'get_pv') {
            const pv = await PvModel.findByIdForUser(args.id, user);
            if (!pv) return { error: 'PV non trouvé ou accès refusé' };
            return {
                id: pv.id,
                titre: pv.title,
                priorite: pv.priority,
                territoire: `${pv.territorial_level}=${pv.territorial_value}`,
                date_visite: pv.visit_date,
                avancement: pv.avancement,
                observations: pv.observations,
                recommandations: pv.recommendations,
                notes: pv.content,
                auteur_nom_complet: [pv.author_first_name, pv.author_last_name].filter(Boolean).join(' ') || pv.author_username || null,
                auteur_titre: pv.author_title || null,
                projets: (pv.projects || []).map(x => ({ id: x.id, titre: x.title })),
                sites: (pv.sites || []).map(x => ({ id: x.id, nom: x.name })),
                localites: (pv.localities || []).map(x => ({ id: x.id, region: x.region, departement: x.departement, arrondissement: x.arrondissement, commune: x.commune })),
                mesures: (pv.measures || []).map(x => ({ id: x.id, description: x.description }))
            };
        }

        if (name === 'list_sites') {
            const visible = await getVisibleProjectIds(user);
            if (visible.size === 0) return [];

            const conds = ['s.project_id = ANY($1::int[])'];
            const params = [Array.from(visible)];
            let i = 2;
            if (Number.isInteger(args.project_id)) {
                conds.push(`s.project_id = $${i++}`); params.push(args.project_id);
            }
            if (args.vulnerability && ['normal','elevee','tres_elevee'].includes(args.vulnerability)) {
                conds.push(`s.vulnerability_level = $${i++}`); params.push(args.vulnerability);
            }
            if (args.region)      { conds.push(`s.region = $${i++}`);      params.push(args.region); }
            if (args.departement) { conds.push(`s.departement = $${i++}`); params.push(args.departement); }
            if (args.commune)     { conds.push(`s.commune = $${i++}`);     params.push(args.commune); }
            if (args.structure) {
                conds.push(`UPPER(st.code) = $${i++}`); params.push(String(args.structure).toUpperCase());
            }
            if (args.is_pcs === true || args.is_pcs === false) {
                conds.push(`s.is_pcs = $${i++}`); params.push(args.is_pcs);
            }

            const result = await db.query(`
                SELECT s.id, s.name, s.description, s.region, s.departement, s.commune,
                       s.latitude, s.longitude, s.is_pcs, s.vulnerability_level,
                       p.id as project_id, p.title as project_title, p.status as project_status,
                       st.code as structure_code
                FROM sites s
                INNER JOIN projects p ON s.project_id = p.id AND p.deleted_at IS NULL
                LEFT JOIN structures st ON p.structure_id = st.id
                WHERE ${conds.join(' AND ')}
                ORDER BY s.name
                LIMIT ${LIST_CAP}
            `, params);

            return result.rows.map(r => ({
                id: r.id,
                nom: r.name,
                description: r.description,
                region: r.region,
                departement: r.departement,
                commune: r.commune,
                latitude: r.latitude != null ? Number(r.latitude) : null,
                longitude: r.longitude != null ? Number(r.longitude) : null,
                pcs: !!r.is_pcs,
                vulnerabilite: r.vulnerability_level,
                projet_id: r.project_id,
                projet_titre: r.project_title,
                projet_statut: STATUS_LABELS[r.project_status] || r.project_status,
                structure: r.structure_code
            }));
        }

        if (name === 'list_geometries') {
            const visible = await getVisibleProjectIds(user);
            if (visible.size === 0) return [];

            const conds = ['g.project_id = ANY($1::int[])'];
            const params = [Array.from(visible)];
            let i = 2;
            if (Number.isInteger(args.project_id)) {
                conds.push(`g.project_id = $${i++}`); params.push(args.project_id);
            }
            if (args.usage && ['drainage','intervention','zone_inondable','autre'].includes(args.usage)) {
                conds.push(`g.usage_type = $${i++}`); params.push(args.usage);
            }
            if (args.kind && ['linestring','polygon'].includes(args.kind)) {
                conds.push(`g.kind = $${i++}`); params.push(args.kind);
            }
            if (args.vulnerability && ['normal','elevee','tres_elevee'].includes(args.vulnerability)) {
                conds.push(`g.vulnerability_level = $${i++}`); params.push(args.vulnerability);
            }
            if (args.structure) {
                conds.push(`UPPER(st.code) = $${i++}`); params.push(String(args.structure).toUpperCase());
            }

            const result = await db.query(`
                SELECT g.id, g.name, g.description, g.kind, g.usage_type, g.vulnerability_level,
                       g.project_id, p.title as project_title, p.status as project_status,
                       st.code as structure_code
                FROM geometries g
                INNER JOIN projects p ON g.project_id = p.id AND p.deleted_at IS NULL
                LEFT JOIN structures st ON g.structure_id = st.id
                WHERE ${conds.join(' AND ')}
                ORDER BY g.name
                LIMIT ${LIST_CAP}
            `, params);

            return result.rows.map(r => ({
                id: r.id,
                nom: r.name,
                description: r.description,
                type_geometrie: r.kind,
                usage: r.usage_type,
                vulnerabilite: r.vulnerability_level,
                projet_id: r.project_id,
                projet_titre: r.project_title,
                projet_statut: STATUS_LABELS[r.project_status] || r.project_status,
                structure: r.structure_code
            }));
        }

        if (name === 'search_deadlines') {
            const today = new Date(); today.setHours(0, 0, 0, 0);
            const from = args.from ? new Date(args.from) : (args.include_overdue === false ? today : new Date('2000-01-01'));
            const to = args.to ? new Date(args.to) : new Date(today.getTime() + 90 * 86400000);
            const includeOverdue = args.include_overdue !== false;

            const items = [];

            // Projets
            const projects = await getProjectsForUser(user, {});
            for (const p of projects) {
                if (!p.deadline_date) continue;
                if (p.status === 'termine' || p.status === 'annule') continue;
                const d = new Date(p.deadline_date);
                if (d < from || d > to) continue;
                if (!includeOverdue && d < today) continue;
                items.push({
                    type: 'projet',
                    id: p.id,
                    titre: p.title,
                    echeance: p.deadline_date,
                    jours_avant: daysBetween(p.deadline_date),
                    en_retard: d < today,
                    structure: p.structure_code,
                    priorite: PRIORITY_LABELS[p.priority || 'normale'],
                    statut: STATUS_LABELS[p.status] || p.status
                });
            }

            // Observations
            const observations = await ObservationModel.findAll({}).catch(() => []);
            for (const o of observations) {
                if (!o.deadline) continue;
                const d = new Date(o.deadline);
                if (d < from || d > to) continue;
                if (!includeOverdue && d < today) continue;
                items.push({
                    type: 'observation',
                    id: o.id,
                    titre: o.title,
                    echeance: o.deadline,
                    jours_avant: daysBetween(o.deadline),
                    en_retard: d < today,
                    priorite: o.priority,
                    portee: o.project_id ? 'projet' : 'globale',
                    projet_id: o.project_id || null,
                    projet_titre: o.project_title || null,
                    auteur: [o.author_first_name, o.author_last_name].filter(Boolean).join(' ') || o.author_username || null
                });
            }

            items.sort((a, b) => new Date(a.echeance) - new Date(b.echeance));
            return { total: items.length, fenetre: { from: from.toISOString().slice(0,10), to: to.toISOString().slice(0,10) }, items };
        }

        if (name === 'search') {
            const term = String(args.q || '').trim();
            if (!term) return { error: 'q requis' };
            const like = `%${term}%`;
            const visible = await getVisibleProjectIds(user);

            const out = [];

            // Projets
            if (visible.size > 0) {
                const r = await db.query(`
                    SELECT p.id, p.title, p.description, s.code as structure_code, p.status
                    FROM projects p
                    LEFT JOIN structures s ON p.structure_id = s.id
                    WHERE p.deleted_at IS NULL
                      AND p.id = ANY($1::int[])
                      AND (p.title ILIKE $2 OR p.description ILIKE $2)
                    LIMIT 30
                `, [Array.from(visible), like]);
                for (const row of r.rows) {
                    out.push({
                        type: 'projet',
                        id: row.id,
                        titre: row.title,
                        extrait: (row.description || '').slice(0, 200),
                        structure: row.structure_code,
                        statut: STATUS_LABELS[row.status] || row.status
                    });
                }
            }

            // Observations
            const obs = await db.query(`
                SELECT o.id, o.title, o.content, o.priority, o.project_id, p.title as project_title
                FROM observations o
                LEFT JOIN projects p ON o.project_id = p.id
                WHERE o.title ILIKE $1 OR o.content ILIKE $1
                LIMIT 30
            `, [like]);
            for (const row of obs.rows) {
                out.push({
                    type: 'observation',
                    id: row.id,
                    titre: row.title,
                    extrait: (row.content || '').slice(0, 200),
                    priorite: row.priority,
                    projet_id: row.project_id,
                    projet_titre: row.project_title
                });
            }

            // PV (filtrés par visibilité utilisateur)
            try {
                const pvs = await PvModel.findAllVisible(user);
                const lc = term.toLowerCase();
                for (const pv of pvs) {
                    const hay = [pv.title, pv.content, pv.observations, pv.recommendations, pv.avancement]
                        .filter(Boolean).join(' ').toLowerCase();
                    if (hay.includes(lc)) {
                        out.push({
                            type: 'pv',
                            id: pv.id,
                            titre: pv.title,
                            extrait: (pv.observations || pv.content || '').slice(0, 200),
                            territoire: `${pv.territorial_level}=${pv.territorial_value}`,
                            date_visite: pv.visit_date
                        });
                    }
                }
            } catch {}

            return { total: out.length, terme: term, resultats: out.slice(0, 60) };
        }

        return { error: `Tool ${name} inconnu` };
    } catch (err) {
        return { error: err.message };
    }
}

// ==================== Controller principal ====================

exports.chat = async (req, res, next) => {
    try {
        const { messages = [] } = req.body || {};
        if (!Array.isArray(messages) || messages.length === 0) {
            return res.status(400).json({ success: false, message: 'Messages requis' });
        }

        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) {
            return res.status(500).json({ success: false, message: 'OPENAI_API_KEY manquante' });
        }

        const client = new OpenAI({ apiKey });
        const model = process.env.OPENAI_MODEL || 'gpt-4.1-mini';

        const who = `${req.user.first_name || req.user.username} (${req.user.role})` +
            (req.user.structure_id ? `, structure_id=${req.user.structure_id}` : '');

        const today = new Date();
        const todayFr = today.toLocaleDateString('fr-FR');
        const todayIso = today.toISOString().slice(0, 10);

        const systemMessage = {
            role: 'system',
            content: `Tu es Olélé Copilot, l'assistant IA du CNGIRI (Comité National de Gestion Intégrée du Risque d'Inondation) au Sénégal.

Date du jour : ${todayFr} (ISO ${todayIso})
Utilisateur connecté : ${who}

Ton rôle : aider l'utilisateur à piloter les projets de gestion des inondations, en t'appuyant uniquement sur les données réelles de la plateforme via les tools.

## Modèle de données (vue d'ensemble)
- **Projets** : porte une structure pilote (DPGI, ONAS, BNSP, CETUD, AGEROUTE, DPC…), un chef de projet, un statut (demarrage / en_cours / termine / retard / annule), une priorité, des dates (start_date, end_date, deadline_date), un budget, des sites, des mesures, des financements, parties prenantes, structures rattachées.
- **Observations** : directives du Ministre/Superviseur, peuvent porter une échéance et viser un projet (portée "projet") ou être globales. ⚠️ Beaucoup d'échéances opérationnelles sont des observations, pas des champs de projet.
- **Mesures** : actions concrètes attachées à un projet (et parfois à un site), assignées à une structure et à un utilisateur, avec un statut (preconisee / executee / non_executee / observations).
- **PV** : comptes-rendus de visite du Commandement Territorial (Préfet/Gouverneur).
- **Sites** : points géolocalisés. **Géométries** : tracés (drainage, zones inondables, intervention).

## Tools — quand utiliser quoi
- Question générale "combien", "moyenne", "répartition" → \`get_stats\` d'abord.
- Liste de projets, filtrage, en retard, recherche → \`list_projects\` (filtres q, status, structure, overdue, deadline_from/to).
- Détail d'UN projet (mesures, financements, commentaires, parties prenantes) → \`get_project\` (utiliser \`list_projects\` pour trouver l'ID si besoin).
- "Quelle est l'échéance / la deadline du …", "Qu'est-ce qui tombe le …" → \`search_deadlines\` (cherche projets ET observations ET mesures, jamais juste \`list_projects\`).
- Question sur les actions opérationnelles, qui fait quoi, mesures en retard → \`list_measures\`.
- Qui pilote, qui contacter, qui est l'agent X → \`list_users\`.
- Directives, instructions du Ministre → \`list_observations\`.
- Visites de terrain, recommandations Préfet/Gouverneur → \`list_pv\` / \`get_pv\`.
- Sites géolocalisés, PCS, vulnérabilité par localité → \`list_sites\`.
- Tracés (drainage, zones inondables) → \`list_geometries\`.
- "Parle-moi de X" sans savoir où chercher → \`search\` (transversal projets/observations/PV).

## Règles
- Ne fabrique JAMAIS de chiffres ni de dates : utilise les tools.
- Si tu ne trouves pas une échéance dans \`list_projects\`, essaye \`search_deadlines\` puis \`list_observations\` AVANT de dire qu'elle n'existe pas.
- Combine plusieurs tools si nécessaire (ex: list_projects → get_project pour le détail).
- Réponds en français, ton direct et factuel, sans préambule.
- Markdown : gras, listes, tableaux quand c'est pertinent.
- Pour les montants en FCFA, formate avec séparateurs de milliers.
- Pour les dates, format JJ/MM/AAAA et ajoute "(dans X jours)" ou "(en retard de X jours)" quand c'est utile.
- Si une question est ambiguë, demande UNE précision ciblée plutôt que de deviner.
- Si les données disponibles ne permettent pas de répondre, dis-le clairement (et ne propose pas de tool externe).`
        };

        const conversationMessages = [systemMessage, ...messages];

        let finalMessage = null;
        for (let iter = 0; iter < 6; iter++) {
            const completion = await client.chat.completions.create({
                model,
                messages: conversationMessages,
                tools,
                tool_choice: 'auto',
                temperature: 0.2
            });

            const msg = completion.choices[0].message;
            conversationMessages.push(msg);

            if (!msg.tool_calls || msg.tool_calls.length === 0) {
                finalMessage = msg;
                break;
            }

            for (const call of msg.tool_calls) {
                let args = {};
                try { args = JSON.parse(call.function.arguments || '{}'); } catch {}
                const result = await executeTool(call.function.name, args, req.user);
                conversationMessages.push({
                    role: 'tool',
                    tool_call_id: call.id,
                    content: JSON.stringify(result).slice(0, 30000)
                });
            }
        }

        if (!finalMessage) {
            return res.status(500).json({ success: false, message: 'Pas de réponse générée' });
        }

        res.json({
            success: true,
            message: finalMessage.content || ''
        });
    } catch (error) {
        console.error('Chat error:', error);
        next(error);
    }
};
