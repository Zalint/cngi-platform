const StructureModel = require('../models/structure.model');
const { validateStructureData } = require('../utils/validators');

exports.getAllStructures = async (req, res, next) => {
    try {
        const structures = await StructureModel.findAll();
        res.json({ success: true, count: structures.length, data: structures });
    } catch (error) {
        next(error);
    }
};

exports.getStructureById = async (req, res, next) => {
    try {
        const structure = await StructureModel.findById(req.params.id);
        if (!structure) {
            return res.status(404).json({ success: false, message: 'Structure non trouvée' });
        }
        res.json({ success: true, data: structure });
    } catch (error) {
        next(error);
    }
};

exports.createStructure = async (req, res, next) => {
    try {
        const validation = validateStructureData(req.body);
        if (!validation.valid) {
            return res.status(400).json({ success: false, message: 'Données invalides', errors: validation.errors });
        }
        
        if (await StructureModel.codeExists(req.body.code)) {
            return res.status(409).json({ success: false, message: 'Ce code existe déjà' });
        }
        
        const structure = await StructureModel.create(req.body);
        res.status(201).json({ success: true, message: 'Structure créée avec succès', data: structure });
    } catch (error) {
        next(error);
    }
};

exports.updateStructure = async (req, res, next) => {
    try {
        const validation = validateStructureData(req.body);
        if (!validation.valid) {
            return res.status(400).json({ success: false, message: 'Données invalides', errors: validation.errors });
        }
        
        if (req.body.code && await StructureModel.codeExists(req.body.code, req.params.id)) {
            return res.status(409).json({ success: false, message: 'Ce code existe déjà' });
        }
        
        const structure = await StructureModel.update(req.params.id, req.body);
        if (!structure) {
            return res.status(404).json({ success: false, message: 'Structure non trouvée' });
        }
        res.json({ success: true, message: 'Structure mise à jour avec succès', data: structure });
    } catch (error) {
        next(error);
    }
};

exports.deleteStructure = async (req, res, next) => {
    try {
        const structure = await StructureModel.delete(req.params.id);
        if (!structure) {
            return res.status(404).json({ success: false, message: 'Structure non trouvée' });
        }
        res.json({ success: true, message: 'Structure supprimée avec succès' });
    } catch (error) {
        next(error);
    }
};

exports.getStats = async (req, res, next) => {
    try {
        const stats = await StructureModel.getStats();
        res.json({ success: true, data: stats });
    } catch (error) {
        next(error);
    }
};

