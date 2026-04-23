const db = require('../config/db');

/**
 * Modèle de notifications in-app.
 * Les triggers sont appelés explicitement depuis les contrôleurs qui produisent
 * un événement (assignation de mesure, commentaire, changement de statut).
 * Rate-limiting "best effort" : pas de déduplication stricte pour l'instant.
 */
class NotificationModel {
    static async create({ userId, type, title, body = null, linkUrl = null }) {
        if (!userId || !type || !title) return null;
        const result = await db.query(`
            INSERT INTO notifications (user_id, type, title, body, link_url)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING *
        `, [userId, type, title, body, linkUrl]);
        return result.rows[0];
    }

    static async listForUser(userId, { limit = 30, onlyUnread = false } = {}) {
        const whereUnread = onlyUnread ? 'AND is_read = false' : '';
        const result = await db.query(`
            SELECT * FROM notifications
            WHERE user_id = $1 ${whereUnread}
            ORDER BY created_at DESC
            LIMIT $2
        `, [userId, Math.min(100, Math.max(1, parseInt(limit) || 30))]);
        return result.rows;
    }

    static async unreadCount(userId) {
        const result = await db.query(`
            SELECT COUNT(*)::int as count FROM notifications
            WHERE user_id = $1 AND is_read = false
        `, [userId]);
        return result.rows[0]?.count || 0;
    }

    static async markRead(userId, notificationId) {
        const result = await db.query(`
            UPDATE notifications
            SET is_read = true, read_at = CURRENT_TIMESTAMP
            WHERE id = $1 AND user_id = $2 AND is_read = false
            RETURNING id
        `, [notificationId, userId]);
        return result.rows[0] || null;
    }

    static async markAllRead(userId) {
        const result = await db.query(`
            UPDATE notifications
            SET is_read = true, read_at = CURRENT_TIMESTAMP
            WHERE user_id = $1 AND is_read = false
            RETURNING id
        `, [userId]);
        return result.rowCount;
    }

    static async remove(userId, notificationId) {
        const result = await db.query(`
            DELETE FROM notifications
            WHERE id = $1 AND user_id = $2
            RETURNING id
        `, [notificationId, userId]);
        return result.rows[0] || null;
    }
}

module.exports = NotificationModel;
