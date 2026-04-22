const db = require('../config/db');
const { toSQLDate } = require('../utils/dateHelpers');

class ProjectModel {
    /**
     * Récupérer tous les projets
     */
    static async findAll(filters = {}) {
        let query = `
            SELECT p.*,
                   s.name as structure_name, s.code as structure_code,
                   u.username as creator_username, u.first_name as creator_first_name, u.last_name as creator_last_name,
                   (SELECT COUNT(*) FROM sites WHERE project_id = p.id) as sites_count,
                   (SELECT COUNT(*) FROM measures WHERE project_id = p.id) as measures_count,
                   (SELECT COUNT(*) FROM stakeholders WHERE project_id = p.id) as stakeholders_count
            FROM projects p
            LEFT JOIN structures s ON p.structure_id = s.id
            LEFT JOIN users u ON p.created_by_user_id = u.id
            WHERE 1=1
        `;
        
        const params = [];
        let paramCount = 1;
        
        if (filters.structure_id) {
            query += ` AND p.structure_id = $${paramCount}`;
            params.push(filters.structure_id);
            paramCount++;
        }
        
        if (filters.status) {
            query += ` AND p.status = $${paramCount}`;
            params.push(filters.status);
            paramCount++;
        }
        
        if (filters.created_by_user_id) {
            query += ` AND p.created_by_user_id = $${paramCount}`;
            params.push(filters.created_by_user_id);
            paramCount++;
        }
        
        query += ' ORDER BY p.created_at DESC';
        
        const result = await db.query(query, params);
        return result.rows;
    }

    /**
     * Récupérer les projets par territoire (region, departement, arrondissement)
     */
    static async findByTerritory(level, value) {
        const allowedColumns = ['region', 'departement', 'arrondissement'];
        if (!allowedColumns.includes(level)) {
            throw new Error(`Invalid territorial level: ${level}. Must be one of: ${allowedColumns.join(', ')}`);
        }

        const column = level;
        const result = await db.query(`
            SELECT DISTINCT p.*, s.name as structure_name, s.code as structure_code
            FROM projects p
            LEFT JOIN structures s ON p.structure_id = s.id
            WHERE p.id IN (
                SELECT DISTINCT project_id FROM localities WHERE ${column} = $1
                UNION
                SELECT DISTINCT project_id FROM sites WHERE ${column} = $1
            )
            ORDER BY p.created_at DESC
        `, [value]);
        return result.rows;
    }

    /**
     * Récupérer un projet par ID avec toutes ses informations
     */
    static async findById(id) {
        const result = await db.query(`
            SELECT p.*,
                   s.name as structure_name, s.code as structure_code,
                   u.username as creator_username, u.first_name as creator_first_name, u.last_name as creator_last_name,
                   pm.username as project_manager_username,
                   pm.first_name as project_manager_first_name,
                   pm.last_name as project_manager_last_name
            FROM projects p
            LEFT JOIN structures s ON p.structure_id = s.id
            LEFT JOIN users u ON p.created_by_user_id = u.id
            LEFT JOIN users pm ON p.project_manager_id = pm.id
            WHERE p.id = $1
        `, [id]);
        
        if (result.rows.length === 0) return null;
        
        const project = result.rows[0];
        
        // Récupérer les localités
        const localities = await db.query(`
            SELECT * FROM localities WHERE project_id = $1
        `, [id]);
        project.localities = localities.rows;
        
        // Récupérer les sites
        const sites = await db.query(`
            SELECT * FROM sites WHERE project_id = $1
        `, [id]);
        project.sites = sites.rows;
        
        // Récupérer les mesures avec utilisateur assigné, structure et commentaires
        const measures = await db.query(`
            SELECT
                m.*,
                u.username as assigned_username,
                u.first_name as assigned_first_name,
                u.last_name as assigned_last_name,
                ms.name as structure_name,
                ms.code as structure_code
            FROM measures m
            LEFT JOIN users u ON m.assigned_user_id = u.id
            LEFT JOIN structures ms ON m.structure_id = ms.id
            WHERE m.project_id = $1
        `, [id]);
        
        // Pour chaque mesure, récupérer ses commentaires
        for (const measure of measures.rows) {
            const comments = await db.query(`
                SELECT 
                    mc.*,
                    u.username,
                    u.first_name,
                    u.last_name
                FROM measure_comments mc
                LEFT JOIN users u ON mc.user_id = u.id
                WHERE mc.measure_id = $1
                ORDER BY mc.created_at DESC
            `, [measure.id]);
            measure.comments = comments.rows;
        }
        
        project.measures = measures.rows;
        
        // Récupérer les parties prenantes
        const stakeholders = await db.query(`
            SELECT * FROM stakeholders WHERE project_id = $1
        `, [id]);
        project.stakeholders = stakeholders.rows;
        
        // Récupérer le financement
        const financing = await db.query(`
            SELECT * FROM financing WHERE project_id = $1
        `, [id]);
        project.funding = financing.rows;

        // Récupérer les structures rattachées
        const assignedStructures = await db.query(`
            SELECT s.id, s.name, s.code
            FROM project_structures ps
            JOIN structures s ON ps.structure_id = s.id
            WHERE ps.project_id = $1
            ORDER BY s.name
        `, [id]);
        project.assigned_structures = assignedStructures.rows;

        return project;
    }

    /**
     * Créer un nouveau projet
     */
    static async create(projectData) {
        const {
            title, description, structure_id, project_manager_id, status, progress_percentage,
            start_date, end_date, deadline_date, budget, created_by_user_id,
            constraints, expected_measures, priority, project_type
        } = projectData;

        const result = await db.query(`
            INSERT INTO projects (
                title, description, structure_id, project_manager_id, status, progress_percentage,
                start_date, end_date, deadline_date, budget, created_by_user_id,
                constraints, expected_measures, priority, project_type
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
            RETURNING *
        `, [
            title,
            description || null,
            structure_id,
            project_manager_id || null,
            status || 'demarrage',
            progress_percentage || 0,
            start_date ? toSQLDate(start_date) : null,
            end_date ? toSQLDate(end_date) : null,
            deadline_date ? toSQLDate(deadline_date) : null,
            budget || null,
            created_by_user_id,
            constraints || null,
            expected_measures || null,
            priority || 'normale',
            project_type || null
        ]);

        return result.rows[0];
    }

    /**
     * Mettre à jour un projet
     */
    static async update(id, projectData) {
        const {
            title, description, structure_id, project_manager_id, status, progress_percentage,
            start_date, end_date, deadline_date, budget,
            constraints, expected_measures, priority, project_type
        } = projectData;

        const result = await db.query(`
            UPDATE projects
            SET title = COALESCE($1, title),
                description = COALESCE($2, description),
                structure_id = COALESCE($3, structure_id),
                project_manager_id = COALESCE($4, project_manager_id),
                status = COALESCE($5, status),
                progress_percentage = COALESCE($6, progress_percentage),
                start_date = COALESCE($7, start_date),
                end_date = COALESCE($8, end_date),
                deadline_date = COALESCE($9, deadline_date),
                budget = COALESCE($10, budget),
                constraints = COALESCE($11, constraints),
                expected_measures = COALESCE($12, expected_measures),
                priority = COALESCE($13, priority),
                project_type = COALESCE($14, project_type),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $15
            RETURNING *
        `, [
            title,
            description,
            structure_id,
            project_manager_id,
            status,
            progress_percentage,
            start_date ? toSQLDate(start_date) : null,
            end_date ? toSQLDate(end_date) : null,
            deadline_date ? toSQLDate(deadline_date) : null,
            budget,
            constraints,
            expected_measures,
            priority,
            project_type,
            id
        ]);

        return result.rows[0];
    }

    /**
     * Mettre à jour seulement le pourcentage d'avancement
     */
    static async updateProgress(id, progress_percentage) {
        const result = await db.query(`
            UPDATE projects
            SET progress_percentage = $1
            WHERE id = $2
            RETURNING *
        `, [progress_percentage, id]);
        
        return result.rows[0];
    }

    /**
     * Supprimer un projet
     */
    static async delete(id) {
        const result = await db.query(`
            DELETE FROM projects WHERE id = $1 RETURNING id
        `, [id]);
        
        return result.rows[0];
    }

    /**
     * Ajouter une localité à un projet
     */
    static async addLocality(projectId, localityData) {
        const { region, departement, arrondissement, commune } = localityData;

        const result = await db.query(`
            INSERT INTO localities (project_id, region, departement, arrondissement, commune)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING *
        `, [projectId, region || null, departement || null, arrondissement || null, commune || null]);

        return result.rows[0];
    }

    /**
     * Ajouter un site à un projet
     */
    static async addSite(projectId, siteData) {
        const { locality_id, name, description, region, departement, arrondissement, commune, latitude, longitude, is_pcs } = siteData;

        // is_pcs réservé aux projets portés par DPGI
        let finalIsPcs = !!is_pcs;
        if (finalIsPcs) {
            const check = await db.query(`
                SELECT s.code FROM projects p LEFT JOIN structures s ON p.structure_id = s.id WHERE p.id = $1
            `, [projectId]);
            if (check.rows[0]?.code !== 'DPGI') finalIsPcs = false;
        }

        const result = await db.query(`
            INSERT INTO sites (project_id, locality_id, name, description, region, departement, arrondissement, commune, latitude, longitude, is_pcs)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            RETURNING *
        `, [projectId, locality_id || null, name, description || null, region || null, departement || null, arrondissement || null, commune || null, latitude || null, longitude || null, finalIsPcs]);
        
        return result.rows[0];
    }

    /**
     * Ajouter une mesure à un projet
     */
    static async addMeasure(projectId, measureData) {
        const { site_id, description, type, status, constraints, structure_id, assigned_user_id } = measureData;

        const result = await db.query(`
            INSERT INTO measures (project_id, site_id, description, type, status, constraints, structure_id, assigned_user_id)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING *
        `, [projectId, site_id || null, description, type || null, status || 'preconisee', constraints || null, structure_id || null, assigned_user_id || null]);

        // Auto-lier la structure au projet si fournie
        if (structure_id) {
            await db.query(`
                INSERT INTO project_structures (project_id, structure_id)
                VALUES ($1, $2)
                ON CONFLICT (project_id, structure_id) DO NOTHING
            `, [projectId, structure_id]);
        }

        return result.rows[0];
    }

    /**
     * Ajouter une partie prenante à un projet
     */
    static async addStakeholder(projectId, stakeholderData) {
        const { name, type, contact_name, contact_email, contact_phone } = stakeholderData;
        
        const result = await db.query(`
            INSERT INTO stakeholders (project_id, name, type, contact_name, contact_email, contact_phone)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *
        `, [projectId, name, type || null, contact_name || null, contact_email || null, contact_phone || null]);
        
        return result.rows[0];
    }

    /**
     * Ajouter un financement à un projet
     */
    static async addFinancing(projectId, financingData) {
        const { amount, currency, source, availability } = financingData;
        
        const result = await db.query(`
            INSERT INTO financing (project_id, amount, currency, source, availability)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING *
        `, [projectId, amount, currency || 'FCFA', source || null, availability || null]);
        
        return result.rows[0];
    }

    /**
     * Mettre à jour en batch les localités d'un projet
     */
    static async updateLocalities(projectId, localities) {
        const client = await db.getClient();
        try {
            await client.query('BEGIN');
            
            // Supprimer les anciennes localités
            await client.query('DELETE FROM localities WHERE project_id = $1', [projectId]);
            
            // Insérer les nouvelles localités
            for (const loc of localities) {
                await client.query(`
                    INSERT INTO localities (project_id, region, departement, arrondissement, commune)
                    VALUES ($1, $2, $3, $4, $5)
                `, [projectId, loc.region || null, loc.departement || null, loc.arrondissement || null, loc.commune || null]);
            }
            
            await client.query('COMMIT');
            return true;
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * Mettre à jour en batch les sites d'un projet
     */
    static async updateSites(projectId, sites) {
        const client = await db.getClient();
        try {
            await client.query('BEGIN');
            
            // Supprimer les anciens sites
            await client.query('DELETE FROM sites WHERE project_id = $1', [projectId]);
            
            // is_pcs réservé aux projets portés par DPGI
            const structCheck = await client.query(`
                SELECT s.code FROM projects p LEFT JOIN structures s ON p.structure_id = s.id WHERE p.id = $1
            `, [projectId]);
            const isDpgi = structCheck.rows[0]?.code === 'DPGI';

            // Insérer les nouveaux sites
            for (const site of sites) {
                const sitePcs = isDpgi && !!site.is_pcs;
                await client.query(`
                    INSERT INTO sites (project_id, locality_id, name, description, region, departement, arrondissement, commune, latitude, longitude, is_pcs)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                `, [projectId, site.locality_id || null, site.name, site.description || null, site.region || null, site.departement || null, site.arrondissement || null, site.commune || null, site.latitude || null, site.longitude || null, sitePcs]);
            }
            
            await client.query('COMMIT');
            return true;
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * Mettre à jour en batch les mesures d'un projet
     */
    static async updateMeasures(projectId, measures) {
        const client = await db.getClient();
        try {
            await client.query('BEGIN');
            
            // Supprimer les anciennes mesures
            await client.query('DELETE FROM measures WHERE project_id = $1', [projectId]);
            
            // Insérer les nouvelles mesures
            for (const measure of measures) {
                await client.query(`
                    INSERT INTO measures (project_id, site_id, assigned_user_id, structure_id, description, type, status, constraints)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                `, [projectId, measure.site_id || null, measure.assigned_user_id || null, measure.structure_id || null, measure.description, measure.type || null, measure.status || 'preconisee', measure.constraints || null]);
            }

            // Auto-lier les structures portées par les mesures au projet (project_structures)
            const measureStructureIds = [...new Set(measures.map(m => m.structure_id).filter(Boolean))];
            for (const sid of measureStructureIds) {
                await client.query(`
                    INSERT INTO project_structures (project_id, structure_id)
                    VALUES ($1, $2)
                    ON CONFLICT (project_id, structure_id) DO NOTHING
                `, [projectId, sid]);
            }

            await client.query('COMMIT');
            return true;
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }
    
    /**
     * Assigner un utilisateur à une mesure
     */
    static async assignUserToMeasure(measureId, userId) {
        const result = await db.query(`
            UPDATE measures
            SET assigned_user_id = $1
            WHERE id = $2
            RETURNING *
        `, [userId, measureId]);

        return result.rows[0];
    }

    /**
     * Réassigner la structure et/ou l'utilisateur d'une mesure.
     * Auto-lie la nouvelle structure au projet via project_structures.
     * @param {number|string} measureId - ID de la mesure
     * @param {number|string} projectId - ID du projet auquel la mesure doit appartenir (anti-cross-project)
     * @param {{structure_id?: number|null, assigned_user_id?: number|null}} updates
     * @returns {Object|null} la mesure mise à jour, ou null si la mesure n'appartient pas au projet
     */
    static async reassignMeasure(measureId, projectId, { structure_id, assigned_user_id }) {
        const result = await db.query(`
            UPDATE measures
            SET structure_id = $1,
                assigned_user_id = $2
            WHERE id = $3 AND project_id = $4
            RETURNING *
        `, [structure_id ?? null, assigned_user_id ?? null, measureId, projectId]);

        const measure = result.rows[0];
        if (!measure) return null;

        if (measure.structure_id) {
            await db.query(`
                INSERT INTO project_structures (project_id, structure_id)
                VALUES ($1, $2)
                ON CONFLICT (project_id, structure_id) DO NOTHING
            `, [measure.project_id, measure.structure_id]);
        }
        return measure;
    }
    
    /**
     * Mettre à jour le statut d'une mesure (par utilisateur assigné)
     */
    static async updateMeasureStatus(measureId, status, constraints) {
        const result = await db.query(`
            UPDATE measures
            SET status = $1,
                constraints = COALESCE($2, constraints)
            WHERE id = $3
            RETURNING *
        `, [status, constraints, measureId]);
        
        return result.rows[0];
    }
    
    /**
     * Vérifier si un utilisateur est le chef de projet
     */
    static async isProjectManager(projectId, userId) {
        const result = await db.query(`
            SELECT project_manager_id FROM projects WHERE id = $1
        `, [projectId]);
        
        if (result.rows.length === 0) return false;
        return result.rows[0].project_manager_id === userId;
    }

    /**
     * Mettre à jour en batch les parties prenantes d'un projet
     */
    static async updateStakeholders(projectId, stakeholders) {
        const client = await db.getClient();
        try {
            await client.query('BEGIN');
            
            // Supprimer les anciennes parties prenantes
            await client.query('DELETE FROM stakeholders WHERE project_id = $1', [projectId]);
            
            // Insérer les nouvelles parties prenantes
            for (const stakeholder of stakeholders) {
                await client.query(`
                    INSERT INTO stakeholders (project_id, name, type, contact_name, contact_email, contact_phone)
                    VALUES ($1, $2, $3, $4, $5, $6)
                `, [projectId, stakeholder.name, stakeholder.type || null, stakeholder.contact || null, null, null]);
            }
            
            await client.query('COMMIT');
            return true;
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * Mettre à jour en batch les financements d'un projet
     */
    static async updateFunding(projectId, funding) {
        const client = await db.getClient();
        try {
            await client.query('BEGIN');
            
            // Supprimer les anciens financements
            await client.query('DELETE FROM financing WHERE project_id = $1', [projectId]);
            
            // Insérer les nouveaux financements
            for (const fund of funding) {
                await client.query(`
                    INSERT INTO financing (project_id, amount, currency, source, availability)
                    VALUES ($1, $2, $3, $4, $5)
                `, [projectId, fund.amount || null, 'FCFA', fund.source, fund.type || null]);
            }
            
            await client.query('COMMIT');
            return true;
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * Récupérer les statistiques des projets
     */
    static async getStats(structureId = null) {
        let query = `
            SELECT
                COUNT(*) as total,
                COUNT(CASE WHEN p.status = 'demarrage' THEN 1 END) as demarrage,
                COUNT(CASE WHEN p.status = 'en_cours' THEN 1 END) as en_cours,
                COUNT(CASE WHEN p.status = 'termine' THEN 1 END) as termine,
                COUNT(CASE WHEN p.status = 'retard' THEN 1 END) as retard,
                AVG(p.progress_percentage) as avg_progress
            FROM projects p
        `;

        const params = [];
        if (structureId) {
            query += ' WHERE p.id IN (SELECT project_id FROM project_structures WHERE structure_id = $1)';
            params.push(structureId);
        }

        const result = await db.query(query, params);
        return result.rows[0];
    }

    static async getStatsByTerritory(level, value) {
        const allowedColumns = ['region', 'departement', 'arrondissement'];
        if (!allowedColumns.includes(level)) {
            throw new Error(`Invalid territorial level: ${level}`);
        }
        const result = await db.query(`
            SELECT
                COUNT(*) as total,
                COUNT(CASE WHEN p.status = 'demarrage' THEN 1 END) as demarrage,
                COUNT(CASE WHEN p.status = 'en_cours' THEN 1 END) as en_cours,
                COUNT(CASE WHEN p.status = 'termine' THEN 1 END) as termine,
                COUNT(CASE WHEN p.status = 'retard' THEN 1 END) as retard,
                AVG(p.progress_percentage) as avg_progress
            FROM projects p
            WHERE p.id IN (
                SELECT DISTINCT project_id FROM localities WHERE ${level} = $1
                UNION
                SELECT DISTINCT project_id FROM sites WHERE ${level} = $1
            )
        `, [value]);
        return result.rows[0];
    }

    /**
     * Récupérer les commentaires d'un projet
     */
    static async getComments(projectId) {
        const result = await db.query(`
            SELECT pc.*, u.username, u.first_name, u.last_name
            FROM project_comments pc
            JOIN users u ON pc.user_id = u.id
            WHERE pc.project_id = $1
            ORDER BY pc.created_at DESC
        `, [projectId]);
        return result.rows;
    }

    /**
     * Ajouter un commentaire à un projet
     */
    static async addComment(projectId, userId, comment) {
        const result = await db.query(`
            INSERT INTO project_comments (project_id, user_id, comment)
            VALUES ($1, $2, $3)
            RETURNING *
        `, [projectId, userId, comment]);
        return result.rows[0];
    }

    /**
     * Supprimer un commentaire de projet
     */
    static async deleteComment(commentId, userId) {
        const result = await db.query(
            'DELETE FROM project_comments WHERE id = $1 AND user_id = $2 RETURNING *',
            [commentId, userId]
        );
        return result.rows[0];
    }

}

module.exports = ProjectModel;

