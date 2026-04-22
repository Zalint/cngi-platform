const DashboardModel = require('../models/dashboard.model');

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
            const structureId = (req.user.role === 'utilisateur' || req.user.role === 'directeur') ? req.user.structure_id : req.query.structure_id;
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
            const structureId = (req.user.role === 'utilisateur' || req.user.role === 'directeur') ? req.user.structure_id : req.query.structure_id;
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
            const structureId = (req.user.role === 'utilisateur' || req.user.role === 'directeur') ? req.user.structure_id : req.query.structure_id;
            sites = await DashboardModel.getMapData(structureId);
        }
        res.json({ success: true, count: sites.length, data: sites });
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
            const structureId = (req.user.role === 'utilisateur' || req.user.role === 'directeur') ? req.user.structure_id : req.query.structure_id;
            projects = await DashboardModel.getRecentProjects(limit, structureId);
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
            const structureId = (req.user.role === 'utilisateur' || req.user.role === 'directeur') ? req.user.structure_id : req.query.structure_id;
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
        const structureId = (req.user.role === 'utilisateur' || req.user.role === 'directeur') ? req.user.structure_id : req.query.structure_id;

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

