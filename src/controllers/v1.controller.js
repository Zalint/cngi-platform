const ProjectModel = require('../models/project.model');
const ProjectStructure = require('../models/projectStructure.model');
const StructureModel = require('../models/structure.model');
const DashboardModel = require('../models/dashboard.model');
const ObservationModel = require('../models/observation.model');
const PvModel = require('../models/pv.model');
const { canUserAccessProject } = require('../utils/projectAccess');

const STATUS_LABELS = {
    demarrage: 'Démarrage', en_cours: 'En cours', termine: 'Terminé', retard: 'En retard', annule: 'Annulé'
};
const PRIORITY_LABELS = { normale: 'Normale', haute: 'Haute', urgente: 'Urgente' };
const TYPE_LABELS = { renforcement_resilience: 'Renforcement de la résilience', structurant: 'Structurant' };

function toMinimal(p) {
    return {
        id: p.id,
        title: p.title,
        structure: p.structure_code,
        structure_name: p.structure_name,
        status: p.status,
        status_label: STATUS_LABELS[p.status] || p.status,
        priority: p.priority || 'normale',
        priority_label: PRIORITY_LABELS[p.priority || 'normale'],
        progress_percentage: p.progress_percentage || 0,
        deadline_date: p.deadline_date,
        manager: p.project_manager_first_name
            ? `${p.project_manager_first_name} ${p.project_manager_last_name || ''}`.trim()
            : null
    };
}

function toFull(p) {
    return {
        ...toMinimal(p),
        project_type: p.project_type,
        project_type_label: TYPE_LABELS[p.project_type] || null,
        description: p.description,
        constraints: p.constraints,
        expected_measures: p.expected_measures,
        start_date: p.start_date,
        end_date: p.end_date,
        budget: p.budget ? Number(p.budget) : null,
        created_at: p.created_at,
        updated_at: p.updated_at,
        sites: (p.sites || []).map(s => ({
            id: s.id, name: s.name, description: s.description,
            region: s.region, departement: s.departement, commune: s.commune,
            latitude: s.latitude, longitude: s.longitude
        })),
        measures: (p.measures || []).map(m => ({
            id: m.id, description: m.description, type: m.type, status: m.status,
            structure_code: m.structure_code,
            assigned_user: m.assigned_username
                ? `${m.assigned_first_name || ''} ${m.assigned_last_name || ''}`.trim() || m.assigned_username
                : null
        })),
        assigned_structures: (p.assigned_structures || []).map(s => ({ code: s.code, name: s.name }))
    };
}

async function getProjectsForUser(user, filters = {}) {
    let projects;
    if (user.role === 'commandement_territorial') {
        projects = await ProjectModel.findByTerritory(user.territorial_level, user.territorial_value);
    } else if ((user.role === 'utilisateur' || user.role === 'directeur') && user.structure_id) {
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
    return projects;
}

// ==================== GET /api/v1/projects ====================
exports.listProjects = async (req, res, next) => {
    try {
        const { status, priority, project_type, structure, detail } = req.query;
        const projects = await getProjectsForUser(req.user, { status, priority, project_type, structure });

        let data;
        if (detail === 'full') {
            const detailed = await Promise.all(projects.map(p => ProjectModel.findById(p.id)));
            data = detailed.filter(Boolean).map(toFull);
        } else {
            data = projects.map(toMinimal);
        }

        res.json({
            success: true,
            count: data.length,
            generated_at: new Date().toISOString(),
            filters: { status, priority, project_type, structure, detail: detail || 'minimal' },
            data
        });
    } catch (error) {
        next(error);
    }
};

// ==================== GET /api/v1/projects/:id ====================
exports.getProject = async (req, res, next) => {
    try {
        const project = await ProjectModel.findById(req.params.id);
        if (!project) {
            return res.status(404).json({ success: false, error: 'not_found', message: 'Projet non trouvé' });
        }

        // Vérifier les droits pour tous les non-admin (inclut commandement_territorial)
        const hasAccess = await canUserAccessProject(req.user, req.params.id);
        if (!hasAccess) {
            return res.status(403).json({ success: false, error: 'forbidden', message: 'Accès refusé à ce projet' });
        }

        res.json({ success: true, data: toFull(project) });
    } catch (error) {
        next(error);
    }
};

// ==================== GET /api/v1/projects/stats ====================
exports.getStats = async (req, res, next) => {
    try {
        const projects = await getProjectsForUser(req.user, {});

        const stats = {
            total: projects.length,
            by_status: {
                demarrage: 0, en_cours: 0, termine: 0, retard: 0, annule: 0
            },
            by_priority: {
                normale: 0, haute: 0, urgente: 0
            },
            by_structure: {},
            avg_progress: 0
        };

        let sumProgress = 0;
        for (const p of projects) {
            stats.by_status[p.status] = (stats.by_status[p.status] || 0) + 1;
            const prio = p.priority || 'normale';
            stats.by_priority[prio] = (stats.by_priority[prio] || 0) + 1;
            const code = p.structure_code || 'INCONNU';
            stats.by_structure[code] = (stats.by_structure[code] || 0) + 1;
            sumProgress += p.progress_percentage || 0;
        }
        stats.avg_progress = projects.length > 0 ? Math.round(sumProgress / projects.length) : 0;

        res.json({ success: true, generated_at: new Date().toISOString(), data: stats });
    } catch (error) {
        next(error);
    }
};

// ==================== GET /api/v1/structures ====================
exports.listStructures = async (req, res, next) => {
    try {
        const structures = await StructureModel.findAll();
        res.json({
            success: true,
            count: structures.length,
            data: structures.map(s => ({
                id: s.id,
                code: s.code,
                name: s.name,
                description: s.description
            }))
        });
    } catch (error) {
        next(error);
    }
};

// ==================== GET /api/v1/observations ====================
function toObservationDto(o) {
    return {
        id: o.id,
        title: o.title,
        content: o.content,
        priority: o.priority,
        deadline: o.deadline,
        project_id: o.project_id,
        project_title: o.project_title || null,
        author: [o.author_first_name, o.author_last_name].filter(Boolean).join(' ') || o.author_username || null,
        created_at: o.created_at,
        updated_at: o.updated_at
    };
}

exports.listObservations = async (req, res, next) => {
    try {
        const { project_id, priority, scope } = req.query;
        const observations = await ObservationModel.findAll({ project_id, priority, scope });
        res.json({
            success: true,
            count: observations.length,
            generated_at: new Date().toISOString(),
            filters: { project_id, priority, scope },
            data: observations.map(toObservationDto)
        });
    } catch (error) { next(error); }
};

exports.getObservation = async (req, res, next) => {
    try {
        const o = await ObservationModel.findById(req.params.id);
        if (!o) return res.status(404).json({ success: false, error: 'not_found', message: 'Observation non trouvée' });
        res.json({ success: true, data: toObservationDto(o) });
    } catch (error) { next(error); }
};

// ==================== GET /api/v1/pv ====================
function toPvDto(p) {
    return {
        id: p.id,
        title: p.title,
        priority: p.priority,
        territorial_level: p.territorial_level,
        territorial_value: p.territorial_value,
        visit_date: p.visit_date,
        avancement: p.avancement,
        observations: p.observations,
        recommendations: p.recommendations,
        content: p.content,
        author: [p.author_first_name, p.author_last_name].filter(Boolean).join(' ') || p.author_username || null,
        projects: (p.projects || []).map(x => ({ id: x.id, title: x.title })),
        sites: (p.sites || []).map(x => ({ id: x.id, name: x.name })),
        localities: (p.localities || []).map(x => ({
            id: x.id, region: x.region, departement: x.departement,
            arrondissement: x.arrondissement, commune: x.commune
        })),
        measures: (p.measures || []).map(x => ({ id: x.id, description: x.description })),
        created_at: p.created_at,
        updated_at: p.updated_at
    };
}

exports.listPvs = async (req, res, next) => {
    try {
        const pvs = await PvModel.findAllVisible(req.user);
        res.json({
            success: true,
            count: pvs.length,
            generated_at: new Date().toISOString(),
            data: pvs.map(toPvDto)
        });
    } catch (error) { next(error); }
};

exports.getPv = async (req, res, next) => {
    try {
        const pv = await PvModel.findByIdForUser(req.params.id, req.user);
        if (!pv) return res.status(404).json({ success: false, error: 'not_found', message: 'PV non trouvé ou accès refusé' });
        res.json({ success: true, data: toPvDto(pv) });
    } catch (error) { next(error); }
};

// ==================== GET /api/v1/docs ====================
exports.openapi = (req, res) => {
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const spec = {
        openapi: '3.0.3',
        info: {
            title: 'CNGIRI API v1',
            version: '1.0.0',
            description: 'API externe pour consulter les projets du CNGIRI. Authentification via header `x-api-key`.'
        },
        servers: [{ url: `${baseUrl}/api/v1` }],
        components: {
            securitySchemes: {
                ApiKeyAuth: { type: 'apiKey', in: 'header', name: 'x-api-key' }
            }
        },
        security: [{ ApiKeyAuth: [] }],
        paths: {
            '/projects': {
                get: {
                    summary: 'Liste les projets visibles par la clé',
                    parameters: [
                        { name: 'status', in: 'query', schema: { type: 'string', enum: ['demarrage','en_cours','termine','retard','annule'] } },
                        { name: 'priority', in: 'query', schema: { type: 'string', enum: ['normale','haute','urgente'] } },
                        { name: 'project_type', in: 'query', schema: { type: 'string', enum: ['renforcement_resilience','structurant'] } },
                        { name: 'structure', in: 'query', schema: { type: 'string' }, description: 'Code structure (ex: DPGI)' },
                        { name: 'detail', in: 'query', schema: { type: 'string', enum: ['minimal','full'], default: 'minimal' } }
                    ],
                    responses: { '200': { description: 'OK' } }
                }
            },
            '/projects/{id}': {
                get: {
                    summary: 'Détail complet d\'un projet',
                    parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
                    responses: { '200': { description: 'OK' }, '404': { description: 'Non trouvé' } }
                }
            },
            '/projects/stats': {
                get: {
                    summary: 'Statistiques agrégées (statut, priorité, structure, avancement moyen)',
                    responses: { '200': { description: 'OK' } }
                }
            },
            '/structures': {
                get: {
                    summary: 'Liste les structures',
                    responses: { '200': { description: 'OK' } }
                }
            },
            '/observations': {
                get: {
                    summary: 'Liste les observations du ministre',
                    parameters: [
                        { name: 'project_id', in: 'query', schema: { type: 'integer' } },
                        { name: 'priority', in: 'query', schema: { type: 'string', enum: ['info','importante','urgente'] } },
                        { name: 'scope', in: 'query', schema: { type: 'string', enum: ['global','project'] } }
                    ],
                    responses: { '200': { description: 'OK' } }
                }
            },
            '/observations/{id}': {
                get: {
                    summary: "Détail d'une observation",
                    parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
                    responses: { '200': { description: 'OK' }, '404': { description: 'Non trouvé' } }
                }
            },
            '/pv': {
                get: {
                    summary: 'Liste les PV de visite visibles par la clé (filtrés par territoire/structure)',
                    responses: { '200': { description: 'OK' } }
                }
            },
            '/pv/{id}': {
                get: {
                    summary: "Détail d'un PV avec projets/sites/localités/mesures liés",
                    parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
                    responses: { '200': { description: 'OK' }, '404': { description: 'Non trouvé ou accès refusé' } }
                }
            }
        }
    };
    res.json(spec);
};
