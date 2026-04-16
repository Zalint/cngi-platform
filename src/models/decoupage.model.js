const db = require('../config/db');

class DecoupageModel {
    /**
     * Recuperer la liste des regions distinctes
     */
    static async getRegions() {
        const result = await db.query(`
            SELECT DISTINCT region FROM decoupage ORDER BY region
        `);
        return result.rows.map(r => r.region);
    }

    /**
     * Recuperer les departements d'une region
     */
    static async getDepartements(region) {
        const result = await db.query(`
            SELECT DISTINCT departement FROM decoupage WHERE region = $1 ORDER BY departement
        `, [region]);
        return result.rows.map(r => r.departement);
    }

    /**
     * Recuperer les arrondissements d'un departement
     */
    static async getArrondissements(departement) {
        const result = await db.query(`
            SELECT DISTINCT arrondissement FROM decoupage WHERE departement = $1 ORDER BY arrondissement
        `, [departement]);
        return result.rows.map(r => r.arrondissement);
    }

    /**
     * Recuperer les communes d'un arrondissement
     */
    static async getCommunes(arrondissement) {
        const result = await db.query(`
            SELECT DISTINCT commune FROM decoupage WHERE arrondissement = $1 ORDER BY commune
        `, [arrondissement]);
        return result.rows.map(r => r.commune);
    }

    /**
     * Rechercher dans le decoupage (commune, arrondissement, departement ou region)
     * Retourne les lignes completes avec tous les niveaux parents
     */
    static async search(query, limit = 15) {
        const result = await db.query(`
            SELECT region, departement, arrondissement, commune FROM (
                SELECT DISTINCT region, departement, arrondissement, commune,
                    CASE
                        WHEN commune ILIKE $2 THEN 1
                        WHEN arrondissement ILIKE $2 THEN 2
                        WHEN departement ILIKE $2 THEN 3
                        WHEN region ILIKE $2 THEN 4
                        ELSE 5
                    END AS rank
                FROM decoupage
                WHERE commune ILIKE $1
                   OR arrondissement ILIKE $1
                   OR departement ILIKE $1
                   OR region ILIKE $1
            ) sub
            ORDER BY rank, region, departement, arrondissement, commune
            LIMIT $3
        `, ['%' + query + '%', query + '%', limit]);
        return result.rows;
    }

    /**
     * Recuperer toutes les entrees avec filtres optionnels et pagination
     */
    static async getAll(filters = {}) {
        const { region, departement, page = 1, limit = 50 } = filters;
        const offset = (page - 1) * limit;
        const conditions = [];
        const params = [];
        let paramIndex = 1;

        if (region) {
            conditions.push(`region = $${paramIndex++}`);
            params.push(region);
        }
        if (departement) {
            conditions.push(`departement = $${paramIndex++}`);
            params.push(departement);
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

        // Count total
        const countResult = await db.query(
            `SELECT COUNT(*) FROM decoupage ${whereClause}`,
            params
        );
        const total = parseInt(countResult.rows[0].count);

        // Get paginated data
        const dataResult = await db.query(
            `SELECT * FROM decoupage ${whereClause} ORDER BY region, departement, arrondissement, commune LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
            [...params, limit, offset]
        );

        return {
            data: dataResult.rows,
            pagination: {
                total,
                page: parseInt(page),
                limit: parseInt(limit),
                totalPages: Math.ceil(total / limit)
            }
        };
    }

    /**
     * Creer une nouvelle entree (avec ON CONFLICT DO NOTHING)
     */
    static async create(data) {
        const { region, departement, arrondissement, commune } = data;

        const result = await db.query(`
            INSERT INTO decoupage (region, departement, arrondissement, commune)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT DO NOTHING
            RETURNING *
        `, [region, departement, arrondissement, commune]);

        return result.rows[0];
    }

    /**
     * Mettre a jour une entree
     */
    static async update(id, data) {
        const { region, departement, arrondissement, commune } = data;

        const result = await db.query(`
            UPDATE decoupage
            SET region = COALESCE($1, region),
                departement = COALESCE($2, departement),
                arrondissement = COALESCE($3, arrondissement),
                commune = COALESCE($4, commune)
            WHERE id = $5
            RETURNING *
        `, [region, departement, arrondissement, commune, id]);

        return result.rows[0];
    }

    /**
     * Supprimer une entree
     */
    static async delete(id) {
        const result = await db.query(`
            DELETE FROM decoupage WHERE id = $1 RETURNING id
        `, [id]);

        return result.rows[0];
    }

    /**
     * Statistiques du decoupage administratif
     */
    static async getStats() {
        const result = await db.query(`
            SELECT
                COUNT(DISTINCT region) as total_regions,
                COUNT(DISTINCT departement) as total_departements,
                COUNT(DISTINCT arrondissement) as total_arrondissements,
                COUNT(DISTINCT commune) as total_communes,
                COUNT(*) as total_entries
            FROM decoupage
        `);
        return result.rows[0];
    }
}

module.exports = DecoupageModel;
