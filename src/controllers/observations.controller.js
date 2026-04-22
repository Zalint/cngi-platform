const ObservationModel = require('../models/observation.model');

const VALID_PRIORITIES = ['info', 'importante', 'urgente'];

// Seul le superviseur peut écrire ; admin peut modérer (supprimer).
function canWrite(user) {
    return user && user.role === 'superviseur';
}
function canModerate(user) {
    return user && user.role === 'admin';
}

exports.list = async (req, res, next) => {
    try {
        const { project_id, priority, scope } = req.query;
        const observations = await ObservationModel.findAll({ project_id, priority, scope });
        res.json({ success: true, count: observations.length, data: observations });
    } catch (error) { next(error); }
};

exports.getOne = async (req, res, next) => {
    try {
        const obs = await ObservationModel.findById(req.params.id);
        if (!obs) return res.status(404).json({ success: false, message: 'Observation non trouvée' });
        res.json({ success: true, data: obs });
    } catch (error) { next(error); }
};

exports.create = async (req, res, next) => {
    try {
        if (!canWrite(req.user)) {
            return res.status(403).json({ success: false, message: 'Seul le superviseur peut créer une observation' });
        }
        const { title, content, priority, deadline, project_id } = req.body || {};
        if (!title || !title.trim()) return res.status(400).json({ success: false, message: 'Titre requis' });
        if (!content || !content.trim()) return res.status(400).json({ success: false, message: 'Contenu requis' });
        if (priority && !VALID_PRIORITIES.includes(priority)) {
            return res.status(400).json({ success: false, message: 'Priorité invalide' });
        }
        const obs = await ObservationModel.create(req.user.id, {
            title: title.trim(),
            content: content.trim(),
            priority: priority || 'info',
            deadline: deadline || null,
            project_id: project_id || null
        });
        res.status(201).json({ success: true, data: obs });
    } catch (error) { next(error); }
};

exports.update = async (req, res, next) => {
    try {
        // Superviseur peut modifier ses observations ; admin peut toutes les modifier
        if (!canWrite(req.user) && !canModerate(req.user)) {
            return res.status(403).json({ success: false, message: 'Accès refusé' });
        }
        const { title, content, priority, deadline, project_id } = req.body || {};
        if (priority && !VALID_PRIORITIES.includes(priority)) {
            return res.status(400).json({ success: false, message: 'Priorité invalide' });
        }
        const authorId = canModerate(req.user) ? null : req.user.id;
        const updated = await ObservationModel.update(req.params.id, authorId, {
            title, content, priority, deadline, project_id
        });
        if (!updated) {
            return res.status(404).json({ success: false, message: 'Observation non trouvée ou non autorisée' });
        }
        res.json({ success: true, data: updated });
    } catch (error) { next(error); }
};

exports.remove = async (req, res, next) => {
    try {
        if (!canWrite(req.user) && !canModerate(req.user)) {
            return res.status(403).json({ success: false, message: 'Accès refusé' });
        }
        const authorId = canModerate(req.user) ? null : req.user.id;
        const deleted = await ObservationModel.delete(req.params.id, authorId);
        if (!deleted) {
            return res.status(404).json({ success: false, message: 'Observation non trouvée ou non autorisée' });
        }
        res.json({ success: true, message: 'Observation supprimée' });
    } catch (error) { next(error); }
};

exports.unreadCount = async (req, res, next) => {
    try {
        const count = await ObservationModel.getUnreadCount(req.user.id);
        res.json({ success: true, count });
    } catch (error) { next(error); }
};

exports.markRead = async (req, res, next) => {
    try {
        await ObservationModel.markAllAsRead(req.user.id);
        res.json({ success: true });
    } catch (error) { next(error); }
};
