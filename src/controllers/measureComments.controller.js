const MeasureCommentModel = require('../models/measureComment.model');
const ProjectModel = require('../models/project.model');
const NotificationModel = require('../models/notification.model');
const db = require('../config/db');

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

        // Notifier l'utilisateur assigné à la mesure (s'il n'est pas l'auteur du commentaire)
        try {
            const r = await db.query(`
                SELECT m.assigned_user_id, m.description, m.project_id, p.title as project_title
                FROM measures m INNER JOIN projects p ON m.project_id = p.id
                WHERE m.id = $1
            `, [measureId]);
            const row = r.rows[0];
            if (row && row.assigned_user_id && row.assigned_user_id !== req.user.id) {
                NotificationModel.create({
                    userId: row.assigned_user_id,
                    type: 'measure_comment',
                    title: `Nouveau commentaire : ${row.project_title}`,
                    body: (comment || '').slice(0, 160),
                    linkUrl: `#/projects/${row.project_id}`
                }).catch(err => console.error('Notification create failed:', err));
            }
        } catch (e) {
            console.warn('Impossible de charger la mesure pour notification:', e.message);
        }

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

