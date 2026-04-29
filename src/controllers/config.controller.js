const ConfigModel = require('../models/config.model');
const storage = require('../config/storage');
const GeometryModel = require('../models/geometry.model');

exports.getByCategory = async (req, res, next) => {
    try {
        const data = await ConfigModel.getByCategory(req.params.category);
        res.json({ success: true, data });
    } catch (error) {
        next(error);
    }
};

exports.getAll = async (req, res, next) => {
    try {
        const data = await ConfigModel.getAll();
        res.json({ success: true, data });
    } catch (error) {
        next(error);
    }
};

exports.create = async (req, res, next) => {
    try {
        const { category, value, label } = req.body;
        if (!category || !value || !label) {
            return res.status(400).json({ success: false, message: 'category, value and label are required' });
        }
        const data = await ConfigModel.create(req.body);
        res.status(201).json({ success: true, data });
    } catch (error) {
        next(error);
    }
};

exports.update = async (req, res, next) => {
    try {
        const data = await ConfigModel.update(req.params.id, req.body);
        if (!data) {
            return res.status(404).json({ success: false, message: 'Config entry not found' });
        }
        // Si on touche à des limites cachées côté serveur, invalider le cache
        // pour que le changement soit appliqué immédiatement (sinon TTL 30s).
        if (data.category === 'upload_limits') {
            try { storage.invalidateMaxUploadBytesCache(); } catch {}
        }
        if (data.category === 'import_limits') {
            try { GeometryModel.invalidateMaxFeaturesCache(); } catch {}
        }
        res.json({ success: true, data });
    } catch (error) {
        next(error);
    }
};

exports.delete = async (req, res, next) => {
    try {
        const deleted = await ConfigModel.delete(req.params.id);
        if (!deleted) {
            return res.status(404).json({ success: false, message: 'Config entry not found' });
        }
        res.json({ success: true, data: null });
    } catch (error) {
        next(error);
    }
};
