const PvModel = require('../models/pv.model');

const VALID_PRIORITIES = ['info', 'importante', 'urgente'];

function canWrite(user) {
    return user && user.role === 'commandement_territorial' && user.territorial_level && user.territorial_value;
}

exports.list = async (req, res, next) => {
    try {
        const pvs = await PvModel.findAllVisible(req.user);
        res.json({ success: true, count: pvs.length, data: pvs });
    } catch (error) { next(error); }
};

exports.getOne = async (req, res, next) => {
    try {
        const pv = await PvModel.findByIdForUser(req.params.id, req.user);
        if (!pv) return res.status(404).json({ success: false, message: 'PV non trouvé ou accès refusé' });
        res.json({ success: true, data: pv });
    } catch (error) { next(error); }
};

exports.create = async (req, res, next) => {
    try {
        if (!canWrite(req.user)) {
            return res.status(403).json({ success: false, message: 'Seul le commandement territorial peut créer un PV' });
        }
        const { title, priority, visit_date, avancement, observations, recommendations, content, projects, measures, sites, localities } = req.body || {};
        if (!title || !title.trim()) return res.status(400).json({ success: false, message: 'Titre requis' });
        if (priority && !VALID_PRIORITIES.includes(priority)) {
            return res.status(400).json({ success: false, message: 'Priorité invalide' });
        }
        const pv = await PvModel.create(
            req.user.id,
            req.user.territorial_level,
            req.user.territorial_value,
            { title: title.trim(), priority, visit_date, avancement, observations, recommendations, content, projects, measures, sites, localities }
        );
        res.status(201).json({ success: true, data: pv });
    } catch (error) { next(error); }
};

exports.update = async (req, res, next) => {
    try {
        if (!canWrite(req.user)) {
            return res.status(403).json({ success: false, message: 'Accès refusé' });
        }
        const { priority } = req.body || {};
        if (priority && !VALID_PRIORITIES.includes(priority)) {
            return res.status(400).json({ success: false, message: 'Priorité invalide' });
        }
        const updated = await PvModel.update(req.params.id, req.user.id, req.body || {});
        if (!updated) return res.status(404).json({ success: false, message: 'PV non trouvé ou non autorisé' });
        res.json({ success: true, data: updated });
    } catch (error) { next(error); }
};

exports.remove = async (req, res, next) => {
    try {
        if (!canWrite(req.user)) {
            return res.status(403).json({ success: false, message: 'Accès refusé' });
        }
        const deleted = await PvModel.delete(req.params.id, req.user.id);
        if (!deleted) return res.status(404).json({ success: false, message: 'PV non trouvé ou non autorisé' });
        res.json({ success: true, message: 'PV supprimé' });
    } catch (error) { next(error); }
};

exports.pickable = async (req, res, next) => {
    try {
        const data = await PvModel.getPickable(req.user);
        res.json({ success: true, data });
    } catch (error) { next(error); }
};

exports.unreadCount = async (req, res, next) => {
    try {
        const count = await PvModel.getUnreadCount(req.user);
        res.json({ success: true, count });
    } catch (error) { next(error); }
};

exports.markAllRead = async (req, res, next) => {
    try {
        await PvModel.markAllAsRead(req.user);
        res.json({ success: true });
    } catch (error) { next(error); }
};

exports.markOneRead = async (req, res, next) => {
    try {
        await PvModel.markAsRead(req.params.id, req.user.id);
        res.json({ success: true });
    } catch (error) { next(error); }
};
