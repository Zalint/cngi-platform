const DashboardModel = require('../models/dashboard.model');

exports.getMetrics = async (req, res, next) => {
    try {
        const structureId = (req.user.role === 'utilisateur' || req.user.role === 'directeur') ? req.user.structure_id : req.query.structure_id;
        const metrics = await DashboardModel.getMetrics(structureId);
        res.json({ success: true, data: metrics });
    } catch (error) {
        next(error);
    }
};

exports.getProjectsByStructure = async (req, res, next) => {
    try {
        const structureId = (req.user.role === 'utilisateur' || req.user.role === 'directeur') ? req.user.structure_id : req.query.structure_id;
        const data = await DashboardModel.getProjectsByStructure(structureId);
        res.json({ success: true, data });
    } catch (error) {
        next(error);
    }
};

exports.getMapData = async (req, res, next) => {
    try {
        const structureId = (req.user.role === 'utilisateur' || req.user.role === 'directeur') ? req.user.structure_id : req.query.structure_id;
        const sites = await DashboardModel.getMapData(structureId);
        res.json({ success: true, count: sites.length, data: sites });
    } catch (error) {
        next(error);
    }
};

exports.getRecentProjects = async (req, res, next) => {
    try {
        const limit = req.query.limit || 10;
        const structureId = (req.user.role === 'utilisateur' || req.user.role === 'directeur') ? req.user.structure_id : req.query.structure_id;
        const projects = await DashboardModel.getRecentProjects(limit, structureId);
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

