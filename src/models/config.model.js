const db = require('../config/db');

class ConfigModel {
    static async getByCategory(category) {
        const result = await db.query(
            'SELECT * FROM app_config WHERE category = $1 AND is_active = true ORDER BY sort_order, label',
            [category]
        );
        return result.rows;
    }

    static async getAll() {
        const result = await db.query(
            'SELECT * FROM app_config ORDER BY category, sort_order'
        );
        return result.rows;
    }

    static async create(data) {
        const { category, value, label, sort_order, metadata } = data;
        // metadata: parité avec update() — undefined => NULL, mais false/0/""/{}
        // sont des valeurs intentionnelles qu'on stocke telles quelles.
        const result = await db.query(
            `INSERT INTO app_config (category, value, label, sort_order, metadata)
             VALUES ($1, $2, $3, $4, $5::jsonb)
             ON CONFLICT DO NOTHING
             RETURNING *`,
            [category, value, label, sort_order || 0,
             metadata !== undefined ? JSON.stringify(metadata) : null]
        );
        return result.rows[0];
    }

    static async update(id, data) {
        const { category, value, label, sort_order, is_active, metadata } = data;
        // metadata : si `undefined`, on garde l'existant ; si `null`, on l'efface.
        // En SQL, COALESCE garde l'existant uniquement si NULL ; on doit donc
        // distinguer "non fourni" (=> NULL avec marqueur) et "fourni" (=> valeur).
        const result = await db.query(
            `UPDATE app_config
             SET category = COALESCE($2, category),
                 value = COALESCE($3, value),
                 label = COALESCE($4, label),
                 sort_order = COALESCE($5, sort_order),
                 is_active = COALESCE($6, is_active),
                 metadata = CASE WHEN $8::boolean THEN $7::jsonb ELSE metadata END
             WHERE id = $1
             RETURNING *`,
            [
                id, category, value, label, sort_order, is_active,
                metadata !== undefined ? JSON.stringify(metadata) : null,
                metadata !== undefined
            ]
        );
        return result.rows[0];
    }

    static async delete(id) {
        const result = await db.query(
            'DELETE FROM app_config WHERE id = $1',
            [id]
        );
        return result.rowCount > 0;
    }
}

module.exports = ConfigModel;
