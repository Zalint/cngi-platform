const FormModel = require('../models/form.model');

exports.submitForm = async (req, res, next) => {
    try {
        const { form_id, project_id, data } = req.body;
        
        if (!form_id || !data) {
            return res.status(400).json({ success: false, message: 'Form ID et data requis' });
        }
        
        req.body.submitted_by_user_id = req.user.id;
        
        const submission = await FormModel.submitResponse(req.body);
        res.status(201).json({ success: true, message: 'Formulaire soumis avec succès', data: submission });
    } catch (error) {
        next(error);
    }
};

exports.getSubmissionById = async (req, res, next) => {
    try {
        const submission = await FormModel.getSubmissionById(req.params.id);
        
        if (!submission) {
            return res.status(404).json({ success: false, message: 'Soumission non trouvée' });
        }
        
        res.json({ success: true, data: submission });
    } catch (error) {
        next(error);
    }
};

