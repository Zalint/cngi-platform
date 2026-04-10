const db = require('../config/db');

class StructureModel {
    /**
     * Récupérer toutes les structures
     */
    static async findAll() {
        const result = await db.query(`
            SELECT s.*,
                   (SELECT COUNT(*) FROM users WHERE structure_id = s.id) as users_count,
                   (SELECT COUNT(*) FROM projects WHERE structure_id = s.id) as projects_count
            FROM structures s
            ORDER BY s.name ASC
        `);
        return result.rows;
    }

    /**
     * Récupérer une structure par ID
     */
    static async findById(id) {
        const result = await db.query(`
            SELECT s.*,
                   (SELECT COUNT(*) FROM users WHERE structure_id = s.id) as users_count,
                   (SELECT COUNT(*) FROM projects WHERE structure_id = s.id) as projects_count
            FROM structures s
            WHERE s.id = $1
        `, [id]);
        return result.rows[0];
    }

    /**
     * Récupérer une structure par code
     */
    static async findByCode(code) {
        const result = await db.query(`
            SELECT * FROM structures WHERE code = $1
        `, [code]);
        return result.rows[0];
    }

    /**
     * Créer une nouvelle structure
     */
    static async create(structureData) {
        const { name, code, description } = structureData;
        
        const result = await db.query(`
            INSERT INTO structures (name, code, description)
            VALUES ($1, $2, $3)
            RETURNING *
        `, [name, code, description || null]);
        
        return result.rows[0];
    }

    /**
     * Mettre à jour une structure
     */
    static async update(id, structureData) {
        const { name, code, description } = structureData;
        
        const result = await db.query(`
            UPDATE structures
            SET name = COALESCE($1, name),
                code = COALESCE($2, code),
                description = COALESCE($3, description)
            WHERE id = $4
            RETURNING *
        `, [name, code, description, id]);
        
        return result.rows[0];
    }

    /**
     * Supprimer une structure
     */
    static async delete(id) {
        const result = await db.query(`
            DELETE FROM structures WHERE id = $1 RETURNING id
        `, [id]);
        
        return result.rows[0];
    }

    /**
     * Vérifier si un code existe
     */
    static async codeExists(code, excludeId = null) {
        let query = 'SELECT id FROM structures WHERE code = $1';
        const params = [code];
        
        if (excludeId) {
            query += ' AND id != $2';
            params.push(excludeId);
        }
        
        const result = await db.query(query, params);
        return result.rows.length > 0;
    }

    /**
     * Récupérer les statistiques par structure
     */
    static async getStats() {
        const result = await db.query(`
            SELECT 
                s.id,
                s.name,
                s.code,
                COUNT(DISTINCT p.id) as total_projects,
                COUNT(DISTINCT CASE WHEN p.status = 'en_cours' THEN p.id END) as projects_en_cours,
                COUNT(DISTINCT CASE WHEN p.status = 'termine' THEN p.id END) as projects_termine,
                COUNT(DISTINCT CASE WHEN p.status = 'retard' THEN p.id END) as projects_retard,
                COUNT(DISTINCT u.id) as total_users
            FROM structures s
            LEFT JOIN projects p ON s.id = p.structure_id
            LEFT JOIN users u ON s.id = u.structure_id
            GROUP BY s.id, s.name, s.code
            ORDER BY s.name ASC
        `);
        return result.rows;
    }
}

module.exports = StructureModel;

