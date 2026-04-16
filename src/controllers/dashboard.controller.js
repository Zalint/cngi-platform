const DashboardModel = require('../models/dashboard.model');

exports.getMetrics = async (req, res, next) => {
    try {
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
        const structureId = (req.user.role === 'utilisateur' || req.user.role === 'directeur') ? req.user.structure_id : req.query.structure_id;
        const projects = await DashboardModel.getLateProjects(structureId);
        res.json({ success: true, count: projects.length, data: projects });
    } catch (error) {
        next(error);
    }
};

exports.getChartData = async (req, res, next) => {
    try {
        const structureId = (req.user.role === 'utilisateur' || req.user.role === 'directeur') ? req.user.structure_id : req.query.structure_id;
        
        const [projectsByStructure, measureTypes, budgetStats] = await Promise.all([
            DashboardModel.getProjectsByStructure(structureId),
            DashboardModel.getMeasureTypes(structureId),
            DashboardModel.getBudgetStats(structureId)
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

