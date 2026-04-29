const AnnouncementModel = require('../models/announcement.model');

/**
 * Sérialise une annonce. `includeAdmin` ajoute les champs identitaires
 * (created_by, author) — réservé aux endpoints admin pour ne pas exposer
 * d'IDs internes au flux public.
 */
function format(a, { includeAdmin = false } = {}) {
    const base = {
        id: a.id,
        message: a.message,
        level: a.level,
        dismissable: a.dismissable,
        starts_at: a.starts_at,
        expires_at: a.expires_at,
        created_at: a.created_at
    };
    if (includeAdmin) {
        base.created_by = a.created_by;
        base.author = [a.first_name, a.last_name].filter(Boolean).join(' ') || a.username || null;
    }
    return base;
}

// "12abc" → 12 avec parseInt — on veut un rejet strict.
function parseStrictId(raw) {
    if (typeof raw !== 'string' || !/^\d+$/.test(raw)) return null;
    const n = Number(raw);
    return Number.isSafeInteger(n) && n > 0 ? n : null;
}

/**
 * @route GET /api/announcements/active
 * @desc  Annonces actives pour tous les utilisateurs authentifiés.
 * @access Private
 */
exports.getActive = async (req, res, next) => {
    try {
        const rows = await AnnouncementModel.findActive();
        res.json({ success: true, count: rows.length, data: rows.map(r => format(r)) });
    } catch (err) { next(err); }
};

/**
 * @route GET /api/announcements
 * @desc  Historique complet (admin).
 * @access Admin
 */
exports.getAll = async (req, res, next) => {
    try {
        const rows = await AnnouncementModel.findAll();
        res.json({ success: true, count: rows.length, data: rows.map(r => format(r, { includeAdmin: true })) });
    } catch (err) { next(err); }
};

/**
 * @route POST /api/announcements
 * @desc  Crée une annonce. expires_at optionnel (sinon : indéfini, à révoquer manuellement).
 * @access Admin
 */
exports.create = async (req, res, next) => {
    try {
        const { message, level, dismissable, expires_in_minutes } = req.body || {};
        if (!message || !String(message).trim()) {
            return res.status(400).json({ success: false, message: 'Le message est requis' });
        }
        if (String(message).length > 1000) {
            return res.status(400).json({ success: false, message: 'Message trop long (max 1000 caractères)' });
        }

        // Le client envoie une DURÉE en minutes plutôt qu'une date — c'est le
        // serveur qui calcule expires_at à partir de NOW(), pour éviter tout
        // décalage d'horloge entre navigateur et DB.
        let durationMin = null;
        if (expires_in_minutes !== null && expires_in_minutes !== undefined && expires_in_minutes !== '') {
            durationMin = parseInt(expires_in_minutes, 10);
            if (!Number.isFinite(durationMin) || durationMin <= 0 || durationMin > 60 * 24 * 30) {
                return res.status(400).json({ success: false, message: 'Durée invalide (1 minute à 30 jours)' });
            }
        }

        const ann = await AnnouncementModel.create({
            message: String(message).trim(),
            level,
            dismissable: dismissable !== false,
            duration_minutes: durationMin,
            created_by: req.user.id
        });
        res.status(201).json({ success: true, data: format(ann, { includeAdmin: true }) });
    } catch (err) {
        if (err.statusCode === 400) return res.status(400).json({ success: false, message: err.message });
        next(err);
    }
};

/**
 * @route POST /api/announcements/:id/revoke
 * @desc  Révoque immédiatement (expires_at = NOW). Garde l'historique.
 * @access Admin
 */
exports.revoke = async (req, res, next) => {
    try {
        const id = parseStrictId(req.params.id);
        if (id === null) return res.status(400).json({ success: false, message: 'ID invalide' });
        const ok = await AnnouncementModel.revoke(id);
        if (!ok) return res.status(404).json({ success: false, message: 'Annonce introuvable ou déjà expirée' });
        res.json({ success: true, message: 'Annonce révoquée' });
    } catch (err) { next(err); }
};

/**
 * @route DELETE /api/announcements/:id
 * @desc  Supprime définitivement (admin).
 * @access Admin
 */
exports.remove = async (req, res, next) => {
    try {
        const id = parseStrictId(req.params.id);
        if (id === null) return res.status(400).json({ success: false, message: 'ID invalide' });
        const ok = await AnnouncementModel.delete(id);
        if (!ok) return res.status(404).json({ success: false, message: 'Annonce introuvable' });
        res.json({ success: true, message: 'Annonce supprimée' });
    } catch (err) { next(err); }
};
