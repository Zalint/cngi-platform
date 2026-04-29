const db = require('../config/db');

/**
 * Annonces broadcast affichées en bandeau pour tous les utilisateurs.
 * Distinct des notifications individuelles : pas de stockage par-user, le
 * dismiss est géré côté front via localStorage.
 */
class AnnouncementModel {
    static LEVELS = ['info', 'warning', 'critical'];

    /**
     * Annonces actuellement actives : starts_at <= NOW() ET (expires_at IS NULL OR expires_at > NOW()).
     */
    static async findActive() {
        const result = await db.query(`
            SELECT a.id, a.message, a.level, a.dismissable, a.starts_at, a.expires_at,
                   a.created_at, a.created_by,
                   u.first_name, u.last_name, u.username
            FROM announcements a
            LEFT JOIN users u ON a.created_by = u.id
            WHERE a.starts_at <= NOW()
              AND (a.expires_at IS NULL OR a.expires_at > NOW())
            ORDER BY
                CASE a.level WHEN 'critical' THEN 1 WHEN 'warning' THEN 2 ELSE 3 END,
                a.created_at DESC
        `);
        return result.rows;
    }

    /**
     * Liste complète (admin) — y compris expirées.
     */
    static async findAll() {
        const result = await db.query(`
            SELECT a.id, a.message, a.level, a.dismissable, a.starts_at, a.expires_at,
                   a.created_at, a.created_by,
                   u.first_name, u.last_name, u.username
            FROM announcements a
            LEFT JOIN users u ON a.created_by = u.id
            ORDER BY a.created_at DESC
            LIMIT 200
        `);
        return result.rows;
    }

    /**
     * @param duration_minutes nombre de minutes avant expiration. NULL = pas
     *        d'expiration (à révoquer manuellement). Calculé côté DB pour
     *        éliminer tout décalage d'horloge client/serveur.
     */
    static async create({ message, level = 'info', dismissable = true, duration_minutes = null, created_by }) {
        if (!this.LEVELS.includes(level)) {
            const err = new Error(`level invalide : doit être info | warning | critical`);
            err.statusCode = 400;
            throw err;
        }
        // expires_at = NOW() + INTERVAL '<n> minutes' — calcul côté DB.
        const result = await db.query(`
            INSERT INTO announcements (message, level, dismissable, starts_at, expires_at, created_by)
            VALUES ($1, $2, $3, NOW(),
                    CASE WHEN $4::int IS NULL THEN NULL ELSE NOW() + ($4::int || ' minutes')::interval END,
                    $5)
            RETURNING *
        `, [message, level, !!dismissable, duration_minutes, created_by]);
        return result.rows[0];
    }

    /**
     * Révoque une annonce immédiatement (force expires_at = NOW()).
     * On ne supprime pas vraiment pour garder l'historique.
     */
    static async revoke(id) {
        const result = await db.query(`
            UPDATE announcements SET expires_at = NOW()
            WHERE id = $1 AND (expires_at IS NULL OR expires_at > NOW())
            RETURNING id
        `, [id]);
        return result.rows[0] || null;
    }

    static async delete(id) {
        const result = await db.query(`DELETE FROM announcements WHERE id = $1 RETURNING id`, [id]);
        return result.rows[0] || null;
    }
}

module.exports = AnnouncementModel;
