const db = require('../config/db');

class DashboardModel {
    /**
     * Récupérer les métriques principales du dashboard
     */
    static async getMetrics(structureId = null) {
        let whereClause = '';
        const params = [];
        
        if (structureId) {
            whereClause = 'WHERE p.id IN (SELECT project_id FROM project_structures WHERE structure_id = $1)';
            params.push(structureId);
        }
        
        const result = await db.query(`
            SELECT
                COUNT(*) as total_projects,
                COUNT(CASE WHEN p.status = 'demarrage' THEN 1 END) as projets_demarrage,
                COUNT(CASE WHEN p.status = 'en_cours' THEN 1 END) as actions_en_cours,
                COUNT(CASE WHEN p.status = 'termine' THEN 1 END) as ouvrages_realises,
                COUNT(CASE WHEN p.status = 'retard' THEN 1 END) as ouvrages_retardes,
                COUNT(CASE WHEN p.priority = 'urgente' THEN 1 END) as projets_urgents,
                COUNT(CASE WHEN p.priority = 'haute' THEN 1 END) as projets_priorite_haute,
                AVG(p.progress_percentage) as avg_progress
            FROM projects p
            ${whereClause}
        `, params);
        
        const projectStats = result.rows[0];
        
        // Compter les sites
        let sitesQuery = 'SELECT COUNT(*) as total_sites FROM sites';
        if (structureId) {
            sitesQuery += ' WHERE project_id IN (SELECT project_id FROM project_structures WHERE structure_id = $1)';
        }
        const sitesResult = await db.query(sitesQuery, params);
        
        // Compter les parties prenantes (stakeholders ont été supprimées, donc mettre à 0)
        const totalStakeholders = 0;
        
        return {
            ...projectStats,
            total_sites: parseInt(sitesResult.rows[0].total_sites),
            total_stakeholders: totalStakeholders
        };
    }

    /**
     * Récupérer la répartition des projets par structure
     */
    static async getProjectsByStructure(structureId = null) {
        let whereClause = '';
        const params = [];
        
        if (structureId) {
            whereClause = 'WHERE s.id = $1';
            params.push(structureId);
        }
        
        const result = await db.query(`
            SELECT 
                s.id,
                s.name,
                s.code,
                COUNT(ps.project_id) as total_projects,
                COUNT(CASE WHEN p.status = 'en_cours' THEN 1 END) as en_cours,
                COUNT(CASE WHEN p.status = 'termine' THEN 1 END) as termine,
                COUNT(CASE WHEN p.status = 'retard' THEN 1 END) as retard
            FROM structures s
            LEFT JOIN project_structures ps ON s.id = ps.structure_id
            LEFT JOIN projects p ON ps.project_id = p.id
            ${whereClause}
            GROUP BY s.id, s.name, s.code
            ORDER BY total_projects DESC
        `, params);
        return result.rows;
    }

    /**
     * Récupérer les données pour la carte (sites avec coordonnées)
     */
    static async getMapData(structureId = null) {
        let query = `
            SELECT
                s.id,
                s.name,
                s.description,
                s.latitude,
                s.longitude,
                s.is_pcs,
                s.vulnerability_level,
                p.id as project_id,
                p.title as project_title,
                p.status as project_status,
                p.priority as project_priority,
                p.project_type,
                st.name as structure_name,
                st.code as structure_code
            FROM sites s
            INNER JOIN projects p ON s.project_id = p.id
            INNER JOIN structures st ON p.structure_id = st.id
            WHERE s.latitude IS NOT NULL AND s.longitude IS NOT NULL
        `;
        
        const params = [];
        if (structureId) {
            query += ' AND p.id IN (SELECT project_id FROM project_structures WHERE structure_id = $1)';
            params.push(structureId);
        }
        
        query += ' ORDER BY s.id';
        
        const result = await db.query(query, params);
        return result.rows;
    }

    /**
     * Récupérer les projets récents
     */
    static async getRecentProjects(limit = 10, structureId = null) {
        let query = `
            SELECT
                p.id,
                p.title,
                p.status,
                p.progress_percentage,
                p.start_date,
                p.deadline_date,
                p.created_at,
                s.name as structure_name,
                s.code as structure_code,
                (SELECT string_agg(s2.code, ',' ORDER BY s2.code)
                 FROM project_structures ps2
                 JOIN structures s2 ON ps2.structure_id = s2.id
                 WHERE ps2.project_id = p.id AND s2.id != p.structure_id
                ) as secondary_structures
            FROM projects p
            LEFT JOIN structures s ON p.structure_id = s.id
        `;
        
        const params = [];
        if (structureId) {
            query += ' WHERE p.id IN (SELECT project_id FROM project_structures WHERE structure_id = $1)';
            params.push(structureId);
        }
        
        query += ' ORDER BY p.created_at DESC LIMIT $' + (structureId ? 2 : 1);
        params.push(limit);
        
        const result = await db.query(query, params);
        return result.rows;
    }

    /**
     * Récupérer les projets en retard
     */
    static async getLateProjects(structureId = null) {
        let query = `
            SELECT 
                p.id,
                p.title,
                p.progress_percentage,
                p.deadline_date,
                s.name as structure_name,
                s.code as structure_code,
                CURRENT_DATE - p.deadline_date as days_late
            FROM projects p
            LEFT JOIN structures s ON p.structure_id = s.id
            WHERE p.status != 'termine' 
              AND p.deadline_date < CURRENT_DATE
        `;
        
        const params = [];
        if (structureId) {
            query += ' AND p.id IN (SELECT project_id FROM project_structures WHERE structure_id = $1)';
            params.push(structureId);
        }
        
        query += ' ORDER BY p.deadline_date ASC';
        
        const result = await db.query(query, params);
        return result.rows;
    }

    /**
     * Récupérer les statistiques de progression par mois
     */
    static async getProgressByMonth(year = new Date().getFullYear(), structureId = null) {
        let query = `
            SELECT 
                EXTRACT(MONTH FROM created_at) as month,
                COUNT(*) as count,
                AVG(progress_percentage) as avg_progress
            FROM projects
            WHERE EXTRACT(YEAR FROM created_at) = $1
        `;
        
        const params = [year];
        if (structureId) {
            query += ' AND structure_id = $2';
            params.push(structureId);
        }
        
        query += ' GROUP BY EXTRACT(MONTH FROM created_at) ORDER BY month';
        
        const result = await db.query(query, params);
        return result.rows;
    }

    /**
     * Récupérer la répartition des types de mesures
     */
    static async getMeasureTypes(structureId = null) {
        let query = `
            SELECT 
                m.type,
                COUNT(*) as count
            FROM measures m
            INNER JOIN projects p ON m.project_id = p.id
            WHERE m.type IS NOT NULL
        `;
        
        const params = [];
        if (structureId) {
            query += ' AND p.id IN (SELECT project_id FROM project_structures WHERE structure_id = $1)';
            params.push(structureId);
        }
        
        query += ' GROUP BY m.type ORDER BY count DESC';
        
        const result = await db.query(query, params);
        return result.rows;
    }

    /**
     * Récupérer le budget total et par statut
     */
    static async getBudgetStats(structureId = null) {
        let query = `
            SELECT 
                SUM(budget) as total_budget,
                SUM(CASE WHEN status = 'en_cours' THEN budget ELSE 0 END) as budget_en_cours,
                SUM(CASE WHEN status = 'termine' THEN budget ELSE 0 END) as budget_termine
            FROM projects
            WHERE budget IS NOT NULL
        `;
        
        const params = [];
        if (structureId) {
            query += ' AND id IN (SELECT project_id FROM project_structures WHERE structure_id = $1)';
            params.push(structureId);
        }
        
        const result = await db.query(query, params);
        return result.rows[0];
    }
    /**
     * Helper: territorial project filter subquery
     */
    static _territorySubquery(level) {
        const allowed = ['region', 'departement', 'arrondissement'];
        if (!allowed.includes(level)) throw new Error('Invalid territorial level');
        return `(SELECT DISTINCT project_id FROM localities WHERE ${level} = $1
                 UNION
                 SELECT DISTINCT project_id FROM sites WHERE ${level} = $1)`;
    }

    static async getRecentProjectsByTerritory(level, value, limit = 10) {
        const sub = this._territorySubquery(level);
        const result = await db.query(`
            SELECT p.id, p.title, p.status, p.progress_percentage, p.start_date, p.deadline_date, p.created_at,
                   s.name as structure_name, s.code as structure_code,
                   (SELECT string_agg(s2.code, ',' ORDER BY s2.code)
                    FROM project_structures ps2
                    JOIN structures s2 ON ps2.structure_id = s2.id
                    WHERE ps2.project_id = p.id AND s2.id != p.structure_id
                   ) as secondary_structures
            FROM projects p
            LEFT JOIN structures s ON p.structure_id = s.id
            WHERE p.id IN ${sub}
            ORDER BY p.created_at DESC LIMIT $2
        `, [value, limit]);
        return result.rows;
    }

    static async getMapDataByTerritory(level, value) {
        const sub = this._territorySubquery(level);
        const result = await db.query(`
            SELECT si.id, si.name, si.description, si.latitude, si.longitude, si.is_pcs, si.vulnerability_level,
                   p.id as project_id, p.title as project_title, p.status as project_status, p.priority as project_priority,
                   st.name as structure_name, st.code as structure_code
            FROM sites si
            INNER JOIN projects p ON si.project_id = p.id
            INNER JOIN structures st ON p.structure_id = st.id
            WHERE si.latitude IS NOT NULL AND si.longitude IS NOT NULL
              AND p.id IN ${sub}
            ORDER BY si.id
        `, [value]);
        return result.rows;
    }

    static async getProjectsByStructureByTerritory(level, value) {
        const sub = this._territorySubquery(level);
        const result = await db.query(`
            SELECT s.id, s.name, s.code,
                   COUNT(p.id) as total_projects,
                   COUNT(CASE WHEN p.status = 'en_cours' THEN 1 END) as en_cours,
                   COUNT(CASE WHEN p.status = 'termine' THEN 1 END) as termine,
                   COUNT(CASE WHEN p.status = 'retard' THEN 1 END) as retard
            FROM projects p
            JOIN structures s ON p.structure_id = s.id
            WHERE p.id IN ${sub}
            GROUP BY s.id, s.name, s.code
            ORDER BY total_projects DESC
        `, [value]);
        return result.rows;
    }

    static async getLateProjectsByTerritory(level, value) {
        const sub = this._territorySubquery(level);
        const result = await db.query(`
            SELECT p.id, p.title, p.progress_percentage, p.deadline_date,
                   s.name as structure_name, s.code as structure_code,
                   CURRENT_DATE - p.deadline_date as days_late
            FROM projects p
            LEFT JOIN structures s ON p.structure_id = s.id
            WHERE p.status != 'termine'
              AND p.deadline_date < CURRENT_DATE
              AND p.id IN ${sub}
            ORDER BY p.deadline_date ASC
        `, [value]);
        return result.rows;
    }

    static async getMeasureTypesByTerritory(level, value) {
        const sub = this._territorySubquery(level);
        const result = await db.query(`
            SELECT m.type, COUNT(*) as count
            FROM measures m
            INNER JOIN projects p ON m.project_id = p.id
            WHERE m.type IS NOT NULL
              AND p.id IN ${sub}
            GROUP BY m.type ORDER BY count DESC
        `, [value]);
        return result.rows;
    }

    static async getBudgetStatsByTerritory(level, value) {
        const sub = this._territorySubquery(level);
        const result = await db.query(`
            SELECT
                SUM(p.budget) as total_budget,
                SUM(CASE WHEN p.status = 'en_cours' THEN p.budget ELSE 0 END) as budget_en_cours,
                SUM(CASE WHEN p.status = 'termine' THEN p.budget ELSE 0 END) as budget_termine
            FROM projects p
            WHERE p.budget IS NOT NULL
              AND p.id IN ${sub}
        `, [value]);
        return result.rows[0];
    }

    /**
     * Récupérer les métriques filtrées par territoire
     */
    static async getMetricsByTerritory(level, value) {
        const allowedColumns = ['region', 'departement', 'arrondissement'];
        if (!allowedColumns.includes(level)) {
            throw new Error(`Invalid territorial level: ${level}. Must be one of: ${allowedColumns.join(', ')}`);
        }

        const territoryFilter = `WHERE p.id IN (
            SELECT DISTINCT project_id FROM localities WHERE ${level} = $1
            UNION
            SELECT DISTINCT project_id FROM sites WHERE ${level} = $1
        )`;

        const result = await db.query(`
            SELECT
                COUNT(*) as total_projects,
                COUNT(CASE WHEN p.status = 'demarrage' THEN 1 END) as projets_demarrage,
                COUNT(CASE WHEN p.status = 'en_cours' THEN 1 END) as actions_en_cours,
                COUNT(CASE WHEN p.status = 'termine' THEN 1 END) as ouvrages_realises,
                COUNT(CASE WHEN p.status = 'retard' THEN 1 END) as ouvrages_retardes,
                COUNT(CASE WHEN p.priority = 'urgente' THEN 1 END) as projets_urgents,
                COUNT(CASE WHEN p.priority = 'haute' THEN 1 END) as projets_priorite_haute,
                AVG(p.progress_percentage) as avg_progress
            FROM projects p
            ${territoryFilter}
        `, [value]);

        const projectStats = result.rows[0];

        const sitesResult = await db.query(`
            SELECT COUNT(*) as total_sites FROM sites
            WHERE project_id IN (
                SELECT DISTINCT project_id FROM localities WHERE ${level} = $1
                UNION
                SELECT DISTINCT project_id FROM sites WHERE ${level} = $1
            )
        `, [value]);

        return {
            ...projectStats,
            total_sites: parseInt(sitesResult.rows[0].total_sites),
            total_stakeholders: 0
        };
    }
}

module.exports = DashboardModel;

