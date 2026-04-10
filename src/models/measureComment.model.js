const db = require('../config/db');

class MeasureCommentModel {
    /**
     * Créer ou mettre à jour le commentaire d'un utilisateur sur une mesure
     * (Un utilisateur = un seul commentaire par mesure)
     */
    static async upsert(measureId, userId, comment) {
        const result = await db.query(`
            INSERT INTO measure_comments (measure_id, user_id, comment)
            VALUES ($1, $2, $3)
            ON CONFLICT (measure_id, user_id) 
            DO UPDATE SET 
                comment = EXCLUDED.comment,
                created_at = CURRENT_TIMESTAMP
            RETURNING *
        `, [measureId, userId, comment]);
        
        return result.rows[0];
    }

    /**
     * Ajouter un commentaire à une mesure (ancienne méthode conservée pour compatibilité)
     */
    static async create(measureId, userId, comment) {
        return this.upsert(measureId, userId, comment);
    }

    /**
     * Récupérer tous les commentaires d'une mesure
     */
    static async getByMeasureId(measureId) {
        const result = await db.query(`
            SELECT 
                mc.*,
                u.username,
                u.first_name,
                u.last_name
            FROM measure_comments mc
            LEFT JOIN users u ON mc.user_id = u.id
            WHERE mc.measure_id = $1
            ORDER BY mc.created_at DESC
        `, [measureId]);
        
        return result.rows;
    }

    /**
     * Supprimer un commentaire
     */
    static async delete(id) {
        const result = await db.query(`
            DELETE FROM measure_comments WHERE id = $1 RETURNING *
        `, [id]);
        
        return result.rows[0];
    }

    /**
     * Vérifier si un utilisateur peut modifier un commentaire
     */
    static async canUserModify(commentId, userId) {
        const result = await db.query(`
            SELECT user_id FROM measure_comments WHERE id = $1
        `, [commentId]);
        
        if (result.rows.length === 0) return false;
        return result.rows[0].user_id === userId;
    }
}

module.exports = MeasureCommentModel;

