const db = require('../config/db');

/**
 * Model for project-structure mappings
 */
const ProjectStructure = {
    /**
     * Get all structures assigned to a project
     */
    async getStructuresByProject(projectId) {
        const result = await db.query(`
            SELECT s.*, ps.assigned_at, ps.assigned_by_user_id
            FROM structures s
            INNER JOIN project_structures ps ON s.id = ps.structure_id
            WHERE ps.project_id = $1
            ORDER BY s.name
        `, [projectId]);
        return result.rows;
    },

    /**
     * Get all projects assigned to a structure
     */
    async getProjectsByStructure(structureId) {
        const result = await db.query(`
            SELECT p.*, ps.assigned_at
            FROM projects p
            INNER JOIN project_structures ps ON p.id = ps.project_id
            WHERE ps.structure_id = $1
            ORDER BY p.created_at DESC
        `, [structureId]);
        return result.rows;
    },

    /**
     * Assign a structure to a project
     */
    async assignStructure(projectId, structureId, assignedByUserId) {
        const result = await db.query(`
            INSERT INTO project_structures (project_id, structure_id, assigned_by_user_id)
            VALUES ($1, $2, $3)
            ON CONFLICT (project_id, structure_id) DO NOTHING
            RETURNING *
        `, [projectId, structureId, assignedByUserId]);
        return result.rows[0];
    },

    /**
     * Remove a structure from a project
     */
    async removeStructure(projectId, structureId) {
        const result = await db.query(`
            DELETE FROM project_structures
            WHERE project_id = $1 AND structure_id = $2
            RETURNING *
        `, [projectId, structureId]);
        return result.rows[0];
    },

    /**
     * Assign multiple structures to a project (replaces all existing assignments)
     */
    async assignMultipleStructures(projectId, structureIds, assignedByUserId) {
        const client = await db.getClient();
        try {
            await client.query('BEGIN');

            // Remove all existing assignments
            await client.query(`
                DELETE FROM project_structures WHERE project_id = $1
            `, [projectId]);

            // Insert new assignments
            if (structureIds && structureIds.length > 0) {
                const values = structureIds.map((structureId, index) => 
                    `($1, $${index + 2}, $${structureIds.length + 2})`
                ).join(', ');

                await client.query(`
                    INSERT INTO project_structures (project_id, structure_id, assigned_by_user_id)
                    VALUES ${values}
                `, [projectId, ...structureIds, assignedByUserId]);
            }

            await client.query('COMMIT');
            return { success: true };
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Check if a user has access to a project (based on their structure)
     */
    async userHasAccessToProject(userId, projectId) {
        const result = await db.query(`
            SELECT COUNT(*) as count
            FROM project_structures ps
            INNER JOIN users u ON u.structure_id = ps.structure_id
            WHERE u.id = $1 AND ps.project_id = $2
        `, [userId, projectId]);
        return result.rows[0].count > 0;
    },

    /**
     * Get all project-structure mappings (admin only)
     */
    async getAllMappings() {
        const result = await db.query(`
            SELECT 
                ps.project_id,
                ps.structure_id,
                p.title as project_title,
                s.name as structure_name,
                ps.assigned_at,
                u.username as assigned_by_username
            FROM project_structures ps
            INNER JOIN projects p ON ps.project_id = p.id
            INNER JOIN structures s ON ps.structure_id = s.id
            LEFT JOIN users u ON ps.assigned_by_user_id = u.id
            ORDER BY p.title, s.name
        `);
        return result.rows;
    }
};

module.exports = ProjectStructure;

