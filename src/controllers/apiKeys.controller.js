const ApiKeyModel = require('../models/apiKey.model');

exports.list = async (req, res, next) => {
    try {
        // Admin voit toutes les clés ; les autres voient seulement les leurs
        const keys = req.user.role === 'admin'
            ? await ApiKeyModel.listAll()
            : await ApiKeyModel.listByUser(req.user.id);
        res.json({ success: true, count: keys.length, data: keys });
    } catch (error) { next(error); }
};

exports.create = async (req, res, next) => {
    try {
        const { label, expires_at } = req.body || {};
        const key = await ApiKeyModel.create(req.user.id, label, expires_at || null);
        res.status(201).json({
            success: true,
            message: 'Clé créée. Copiez-la maintenant, elle ne sera plus jamais affichée.',
            data: key
        });
    } catch (error) { next(error); }
};

exports.revoke = async (req, res, next) => {
    try {
        const userId = req.user.role === 'admin' ? null : req.user.id;
        const result = await ApiKeyModel.revoke(req.params.id, userId);
        if (!result) return res.status(404).json({ success: false, message: 'Clé non trouvée' });
        res.json({ success: true, message: 'Clé révoquée' });
    } catch (error) { next(error); }
};

exports.remove = async (req, res, next) => {
    try {
        const userId = req.user.role === 'admin' ? null : req.user.id;
        const result = await ApiKeyModel.delete(req.params.id, userId);
        if (!result) return res.status(404).json({ success: false, message: 'Clé non trouvée' });
        res.json({ success: true, message: 'Clé supprimée' });
    } catch (error) { next(error); }
};
