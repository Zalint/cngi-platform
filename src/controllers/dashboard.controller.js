const DashboardModel = require('../models/dashboard.model');
const db = require('../config/db');

// Garde-fou : un commandement_territorial sans (level, value) ne doit pas
// exécuter de requête non-scopée. Renvoie true si on doit refuser.
function isIncompleteTerritorial(user) {
    return user.role === 'commandement_territorial'
        && (!user.territorial_level || !user.territorial_value);
}
function denyIncompleteTerritorial(res) {
    return res.status(403).json({
        success: false,
        message: 'Compte commandement_territorial incomplet : territoire non renseigné.'
    });
}

exports.getMetrics = async (req, res, next) => {
    try {
        if (isIncompleteTerritorial(req.user)) return denyIncompleteTerritorial(res);
        let metrics;

        if (req.user.role === 'commandement_territorial' && req.user.territorial_level && req.user.territorial_value) {
            metrics = await DashboardModel.getMetricsByTerritory(req.user.territorial_level, req.user.territorial_value);
        } else {
            // superviseur and admin see all; utilisateur/directeur see their structure
            const structureId = (req.user.role === 'utilisateur') ? req.user.structure_id : req.query.structure_id;
            metrics = await DashboardModel.getMetrics(structureId);
        }

        res.json({ success: true, data: metrics });
    } catch (error) {
        next(error);
    }
};

exports.getProjectsByStructure = async (req, res, next) => {
    try {
        if (isIncompleteTerritorial(req.user)) return denyIncompleteTerritorial(res);
        let data;
        if (req.user.role === 'commandement_territorial' && req.user.territorial_level && req.user.territorial_value) {
            data = await DashboardModel.getProjectsByStructureByTerritory(req.user.territorial_level, req.user.territorial_value);
        } else {
            const structureId = (req.user.role === 'utilisateur') ? req.user.structure_id : req.query.structure_id;
            data = await DashboardModel.getProjectsByStructure(structureId);
        }
        res.json({ success: true, data });
    } catch (error) {
        next(error);
    }
};

exports.getMapData = async (req, res, next) => {
    try {
        if (isIncompleteTerritorial(req.user)) return denyIncompleteTerritorial(res);
        let sites;
        if (req.user.role === 'commandement_territorial' && req.user.territorial_level && req.user.territorial_value) {
            sites = await DashboardModel.getMapDataByTerritory(req.user.territorial_level, req.user.territorial_value);
        } else {
            const structureId = (req.user.role === 'utilisateur') ? req.user.structure_id : req.query.structure_id;
            sites = await DashboardModel.getMapData(structureId);
        }
        res.json({ success: true, count: sites.length, data: sites });
    } catch (error) {
        next(error);
    }
};

exports.getMapGeometries = async (req, res, next) => {
    try {
        if (isIncompleteTerritorial(req.user)) return denyIncompleteTerritorial(res);

        // Filtrage selon le rôle :
        // - admin / superviseur / directeur / auditeur global / lecteur global → toutes
        // - utilisateur / lecteur scopé / auditeur scopé → via project_structures
        // - commandement_territorial → via localités ou sites dans le territoire
        let query = `
            SELECT g.*,
                   s.code as structure_code, s.name as structure_name,
                   p.title as project_title, p.status as project_status,
                   -- Prend la plus récente entre la géométrie elle-même et son projet.
                   -- GREATEST ignore les NULL en PostgreSQL, donc si une des deux est NULL
                   -- l'autre est retournée (et NULL si les deux sont NULL).
                   GREATEST(g.updated_at, p.updated_at) as project_updated_at
            FROM geometries g
            LEFT JOIN structures s ON g.structure_id = s.id
            INNER JOIN projects p ON g.project_id = p.id
            WHERE 1=1
        `;
        const params = [];

        const role = req.user.role;
        const structureId = req.user.structure_id;
        const territorialLevel = req.user.territorial_level;
        const territorialValue = req.user.territorial_value;

        if (role === 'commandement_territorial') {
            const allowedLevels = ['region', 'departement', 'arrondissement'];
            if (!allowedLevels.includes(territorialLevel)) return res.json({ success: true, count: 0, data: [] });
            query += ` AND (
                EXISTS (SELECT 1 FROM localities WHERE project_id = g.project_id AND ${territorialLevel} = $1)
                OR EXISTS (SELECT 1 FROM sites WHERE project_id = g.project_id AND ${territorialLevel} = $1)
            )`;
            params.push(territorialValue);
        } else if (role === 'utilisateur') {
            // Un utilisateur DOIT avoir une structure rattachée. Sinon compte mal
            // configuré → on ne renvoie rien (aligné sur canUserAccessProject qui retourne false).
            if (!structureId) return res.json({ success: true, count: 0, data: [] });
            query += ` AND g.project_id IN (SELECT project_id FROM project_structures WHERE structure_id = $1)`;
            params.push(structureId);
        } else if ((role === 'lecteur' || role === 'auditeur') && structureId) {
            // Lecteur/auditeur scopés : restreints à leur structure (sans structure → lecture globale, géré dans le bloc "pas de filtre" ci-dessous).
            query += ` AND g.project_id IN (SELECT project_id FROM project_structures WHERE structure_id = $1)`;
            params.push(structureId);
        }
        // admin / superviseur / lecteur global / auditeur global : pas de filtre

        query += ' ORDER BY g.id';

        const result = await db.query(query, params);
        res.json({ success: true, count: result.rows.length, data: result.rows });
    } catch (error) {
        next(error);
    }
};

exports.getRecentProjects = async (req, res, next) => {
    try {
        if (isIncompleteTerritorial(req.user)) return denyIncompleteTerritorial(res);
        const limit = req.query.limit || 10;
        let projects;
        if (req.user.role === 'commandement_territorial' && req.user.territorial_level && req.user.territorial_value) {
            projects = await DashboardModel.getRecentProjectsByTerritory(req.user.territorial_level, req.user.territorial_value, limit);
        } else {
            const structureId = (req.user.role === 'utilisateur') ? req.user.structure_id : req.query.structure_id;
            // Directeur : on remonte sa structure en priorité (tier principal puis
            // secondaire) tout en restant en lecture globale.
            const preferred = (req.user.role === 'directeur' && req.user.structure_id) ? req.user.structure_id : null;
            projects = await DashboardModel.getRecentProjects(limit, structureId, preferred);
        }
        res.json({ success: true, data: projects });
    } catch (error) {
        next(error);
    }
};

exports.getLateProjects = async (req, res, next) => {
    try {
        if (isIncompleteTerritorial(req.user)) return denyIncompleteTerritorial(res);
        let projects;
        if (req.user.role === 'commandement_territorial' && req.user.territorial_level && req.user.territorial_value) {
            projects = await DashboardModel.getLateProjectsByTerritory(req.user.territorial_level, req.user.territorial_value);
        } else {
            const structureId = (req.user.role === 'utilisateur') ? req.user.structure_id : req.query.structure_id;
            projects = await DashboardModel.getLateProjects(structureId);
        }
        res.json({ success: true, count: projects.length, data: projects });
    } catch (error) {
        next(error);
    }
};

exports.getChartData = async (req, res, next) => {
    try {
        if (isIncompleteTerritorial(req.user)) return denyIncompleteTerritorial(res);
        const isTerritorial = req.user.role === 'commandement_territorial' && req.user.territorial_level && req.user.territorial_value;
        const structureId = (req.user.role === 'utilisateur') ? req.user.structure_id : req.query.structure_id;

        const [projectsByStructure, measureTypes, budgetStats] = await Promise.all([
            isTerritorial
                ? DashboardModel.getProjectsByStructureByTerritory(req.user.territorial_level, req.user.territorial_value)
                : DashboardModel.getProjectsByStructure(structureId),
            isTerritorial
                ? DashboardModel.getMeasureTypesByTerritory(req.user.territorial_level, req.user.territorial_value)
                : DashboardModel.getMeasureTypes(structureId),
            isTerritorial
                ? DashboardModel.getBudgetStatsByTerritory(req.user.territorial_level, req.user.territorial_value)
                : DashboardModel.getBudgetStats(structureId)
        ]);
        
        res.json({
            success: true,
            data: {
                projectsByStructure,
                measureTypes,
                budgetStats
            }
        });
    } catch (error) {
        next(error);
    }
};

