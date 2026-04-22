const db = require('../config/db');

class ObservationModel {
    static async findAll(filters = {}) {
        let query = `
            SELECT o.*,
                   u.username as author_username, u.first_name as author_first_name, u.last_name as author_last_name,
                   p.title as project_title, p.structure_id,
                   s.code as project_structure_code
            FROM observations o
            LEFT JOIN users u ON o.author_id = u.id
            LEFT JOIN projects p ON o.project_id = p.id
            LEFT JOIN structures s ON p.structure_id = s.id
            WHERE 1=1
        `;
        const params = [];
        let i = 1;
        if (filters.project_id) {
            query += ` AND o.project_id = $${i++}`;
            params.push(filters.project_id);
        }
        if (filters.priority) {
            query += ` AND o.priority = $${i++}`;
            params.push(filters.priority);
        }
        if (filters.scope === 'global') {
            query += ` AND o.project_id IS NULL`;
        } else if (filters.scope === 'project') {
            query += ` AND o.project_id IS NOT NULL`;
        }
        query += ` ORDER BY
            CASE o.priority WHEN 'urgente' THEN 1 WHEN 'importante' THEN 2 ELSE 3 END,
            o.created_at DESC`;

        const result = await db.query(query, params);
        return result.rows;
    }

    static async findById(id) {
        const result = await db.query(`
            SELECT o.*,
                   u.username as author_username, u.first_name as author_first_name, u.last_name as author_last_name,
                   p.title as project_title
            FROM observations o
            LEFT JOIN users u ON o.author_id = u.id
            LEFT JOIN projects p ON o.project_id = p.id
            WHERE o.id = $1
        `, [id]);
        return result.rows[0] || null;
    }

    static async create(authorId, data) {
        const { title, content, priority, deadline, project_id } = data;
        const result = await db.query(`
            INSERT INTO observations (author_id, project_id, title, content, priority, deadline)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *
        `, [authorId, project_id || null, title, content, priority || 'info', deadline || null]);
        return result.rows[0];
    }

    static async update(id, authorId, data) {
        const { title, content, priority, deadline, project_id } = data;
        // Si authorId est null → admin (pas de restriction)
        const whereAuthor = authorId ? 'AND author_id = $7' : '';
        const params = [title, content, priority, deadline || null, project_id || null, id];
        if (authorId) params.push(authorId);

        const result = await db.query(`
            UPDATE observations
            SET title = COALESCE($1, title),
                content = COALESCE($2, content),
                priority = COALESCE($3, priority),
                deadline = $4,
                project_id = $5,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $6 ${whereAuthor}
            RETURNING *
        `, params);
        return result.rows[0] || null;
    }

    static async delete(id, authorId = null) {
        const whereAuthor = authorId ? 'AND author_id = $2' : '';
        const params = [id];
        if (authorId) params.push(authorId);
        const result = await db.query(
            `DELETE FROM observations WHERE id = $1 ${whereAuthor} RETURNING id`,
            params
        );
        return result.rows[0] || null;
    }

    // ==================== Unread tracking ====================

    static async getUnreadCount(userId) {
        const result = await db.query(`
            SELECT COUNT(*) as unread
            FROM observations o
            LEFT JOIN observation_views v ON v.user_id = $1
            WHERE o.created_at > COALESCE(v.last_viewed_at, '1970-01-01'::timestamp)
        `, [userId]);
        return parseInt(result.rows[0].unread) || 0;
    }

    static async markAllAsRead(userId) {
        await db.query(`
            INSERT INTO observation_views (user_id, last_viewed_at)
            VALUES ($1, CURRENT_TIMESTAMP)
            ON CONFLICT (user_id) DO UPDATE SET last_viewed_at = CURRENT_TIMESTAMP
        `, [userId]);
    }
}

module.exports = ObservationModel;
