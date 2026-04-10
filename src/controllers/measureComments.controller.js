const MeasureCommentModel = require('../models/measureComment.model');
const ProjectModel = require('../models/project.model');

/**
 * Ajouter un commentaire à une mesure
 */
exports.createComment = async (req, res, next) => {
    try {
        const { measureId } = req.params;
        const { comment } = req.body;

        if (!comment || comment.trim() === '') {
            return res.status(400).json({ success: false, message: 'Commentaire requis' });
        }

        const newComment = await MeasureCommentModel.create(measureId, req.user.id, comment);
        res.status(201).json({ success: true, message: 'Commentaire ajouté avec succès', data: newComment });
    } catch (error) {
        next(error);
    }
};

/**
 * Récupérer tous les commentaires d'une mesure
 */
exports.getCommentsByMeasure = async (req, res, next) => {
    try {
        const { measureId } = req.params;
        const comments = await MeasureCommentModel.getByMeasureId(measureId);
        res.json({ success: true, data: comments });
    } catch (error) {
        next(error);
    }
};

/**
 * Supprimer un commentaire
 */
exports.deleteComment = async (req, res, next) => {
    try {
        const { id } = req.params;

        // Vérifier si l'utilisateur peut supprimer (admin ou auteur)
        const canModify = await MeasureCommentModel.canUserModify(id, req.user.id);
        if (!canModify && req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Accès refusé' });
        }

        await MeasureCommentModel.delete(id);
        res.json({ success: true, message: 'Commentaire supprimé avec succès' });
    } catch (error) {
        next(error);
    }
};

module.exports = exports;

