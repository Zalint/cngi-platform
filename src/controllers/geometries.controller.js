const GeometryModel = require('../models/geometry.model');
const { canUserAccessProject } = require('../utils/projectAccess');

exports.list = async (req, res, next) => {
    try {
        const projectId = parseInt(req.params.projectId);
        if (!Number.isFinite(projectId)) {
            return res.status(400).json({ success: false, message: 'projectId invalide' });
        }
        const access = await canUserAccessProject(req.user, projectId);
        if (!access) return res.status(403).json({ success: false, message: 'Accès refusé au projet' });

        const items = await GeometryModel.findByProjectId(projectId);
        res.json({ success: true, count: items.length, data: items });
    } catch (error) {
        next(error);
    }
};

exports.create = async (req, res, next) => {
    try {
        const projectId = parseInt(req.params.projectId);
        const access = await canUserAccessProject(req.user, projectId);
        if (!access) return res.status(403).json({ success: false, message: 'Accès refusé au projet' });

        const created = await GeometryModel.create(projectId, req.body, req.user.id);
        res.status(201).json({ success: true, data: created });
    } catch (error) {
        next(error);
    }
};

exports.update = async (req, res, next) => {
    try {
        const projectId = parseInt(req.params.projectId);
        const geomId = parseInt(req.params.geomId);
        const access = await canUserAccessProject(req.user, projectId);
        if (!access) return res.status(403).json({ success: false, message: 'Accès refusé au projet' });

        // Vérifier que la géométrie appartient bien au projet
        const existing = await GeometryModel.findById(geomId);
        if (!existing || existing.project_id !== projectId) {
            return res.status(404).json({ success: false, message: 'Tracé non trouvé pour ce projet' });
        }

        const updated = await GeometryModel.update(geomId, req.body);
        res.json({ success: true, data: updated });
    } catch (error) {
        next(error);
    }
};

exports.remove = async (req, res, next) => {
    try {
        const projectId = parseInt(req.params.projectId);
        const geomId = parseInt(req.params.geomId);
        const access = await canUserAccessProject(req.user, projectId);
        if (!access) return res.status(403).json({ success: false, message: 'Accès refusé au projet' });

        const existing = await GeometryModel.findById(geomId);
        if (!existing || existing.project_id !== projectId) {
            return res.status(404).json({ success: false, message: 'Tracé non trouvé pour ce projet' });
        }

        await GeometryModel.remove(geomId);
        res.json({ success: true, message: 'Tracé supprimé' });
    } catch (error) {
        next(error);
    }
};

exports.importGeoJSON = async (req, res, next) => {
    try {
        const projectId = parseInt(req.params.projectId);
        if (!Number.isFinite(projectId)) {
            return res.status(400).json({ success: false, message: 'projectId invalide' });
        }
        const access = await canUserAccessProject(req.user, projectId);
        if (!access) return res.status(403).json({ success: false, message: 'Accès refusé au projet' });

        const { imported, skipped } = await GeometryModel.importGeoJSON(projectId, req.body, req.user.id);
        const parts = [`${imported.length} tracé(s) importé(s)`];
        if (skipped.length > 0) parts.push(`${skipped.length} ignoré(s)`);

        res.status(201).json({
            success: true,
            count: imported.length,
            skipped_count: skipped.length,
            data: imported,
            skipped, // [{ index, name, reason }]
            message: parts.join(', ')
        });
    } catch (error) {
        next(error);
    }
};
