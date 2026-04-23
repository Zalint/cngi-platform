const NotificationModel = require('../models/notification.model');

exports.list = async (req, res, next) => {
    try {
        const onlyUnread = req.query.unread === '1' || req.query.unread === 'true';
        const limit = req.query.limit ? parseInt(req.query.limit) : 30;
        const items = await NotificationModel.listForUser(req.user.id, { limit, onlyUnread });
        res.json({ success: true, count: items.length, data: items });
    } catch (err) { next(err); }
};

exports.unreadCount = async (req, res, next) => {
    try {
        const count = await NotificationModel.unreadCount(req.user.id);
        res.json({ success: true, count });
    } catch (err) { next(err); }
};

exports.markRead = async (req, res, next) => {
    try {
        const id = parseInt(req.params.id);
        if (!Number.isFinite(id)) return res.status(400).json({ success: false, message: 'id invalide' });
        const row = await NotificationModel.markRead(req.user.id, id);
        res.json({ success: true, data: row });
    } catch (err) { next(err); }
};

exports.markAllRead = async (req, res, next) => {
    try {
        const n = await NotificationModel.markAllRead(req.user.id);
        res.json({ success: true, marked: n });
    } catch (err) { next(err); }
};

exports.remove = async (req, res, next) => {
    try {
        const id = parseInt(req.params.id);
        if (!Number.isFinite(id)) return res.status(400).json({ success: false, message: 'id invalide' });
        await NotificationModel.remove(req.user.id, id);
        res.json({ success: true });
    } catch (err) { next(err); }
};
