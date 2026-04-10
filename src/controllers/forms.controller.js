const FormModel = require('../models/form.model');

exports.getAllForms = async (req, res, next) => {
    try {
        let forms;
        
        // Si utilisateur, récupérer les formulaires assignés à sa structure
        if (req.user.role === 'utilisateur' && req.user.structure_id) {
            forms = await FormModel.findByStructure(req.user.structure_id);
        } else {
            forms = await FormModel.findAll();
        }
        
        res.json({ success: true, count: forms.length, data: forms });
    } catch (error) {
        next(error);
    }
};

exports.getFormById = async (req, res, next) => {
    try {
        const form = await FormModel.findById(req.params.id);
        
        if (!form) {
            return res.status(404).json({ success: false, message: 'Formulaire non trouvé' });
        }
        
        res.json({ success: true, data: form });
    } catch (error) {
        next(error);
    }
};

exports.createForm = async (req, res, next) => {
    try {
        const { title, description, schema, assigned_to_structure_id } = req.body;
        
        if (!title || !schema) {
            return res.status(400).json({ success: false, message: 'Titre et schéma requis' });
        }
        
        req.body.created_by = req.user.id;
        
        const form = await FormModel.create(req.body);
        res.status(201).json({ success: true, message: 'Formulaire créé avec succès', data: form });
    } catch (error) {
        next(error);
    }
};

exports.updateForm = async (req, res, next) => {
    try {
        const form = await FormModel.update(req.params.id, req.body);
        
        if (!form) {
            return res.status(404).json({ success: false, message: 'Formulaire non trouvé' });
        }
        
        res.json({ success: true, message: 'Formulaire mis à jour avec succès', data: form });
    } catch (error) {
        next(error);
    }
};

exports.deleteForm = async (req, res, next) => {
    try {
        const form = await FormModel.delete(req.params.id);
        
        if (!form) {
            return res.status(404).json({ success: false, message: 'Formulaire non trouvé' });
        }
        
        res.json({ success: true, message: 'Formulaire supprimé avec succès' });
    } catch (error) {
        next(error);
    }
};

exports.getSubmissions = async (req, res, next) => {
    try {
        const submissions = await FormModel.getSubmissions(req.params.id);
        res.json({ success: true, count: submissions.length, data: submissions });
    } catch (error) {
        next(error);
    }
};

