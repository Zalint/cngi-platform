const db = require('../config/db');
const ProjectStructure = require('../models/projectStructure.model');

/**
 * Vérifie si un utilisateur peut accéder à un projet, en tenant compte de son rôle.
 *
 * - admin / superviseur : accès à tout
 * - utilisateur / directeur : seulement les projets liés à leur structure (via project_structures)
 * - commandement_territorial : seulement les projets situés dans leur territoire (via localities/sites)
 *
 * @param {Object} user - req.user (id, role, structure_id, territorial_level, territorial_value)
 * @param {number|string} projectId
 * @returns {Promise<boolean>}
 */
async function canUserAccessProject(user, projectId) {
    if (!user || !projectId) return false;

    if (user.role === 'admin' || user.role === 'superviseur') return true;

    // Lecteur / auditeur global (sans structure) : accès à tout.
    // Avec une structure : même règle que utilisateur/directeur.
    if (user.role === 'lecteur' || user.role === 'auditeur') {
        if (!user.structure_id) return true;
        return ProjectStructure.userHasAccessToProject(user.id, projectId);
    }

    if (user.role === 'utilisateur' || user.role === 'directeur') {
        if (!user.structure_id) return false;
        return ProjectStructure.userHasAccessToProject(user.id, projectId);
    }

    if (user.role === 'commandement_territorial') {
        const level = user.territorial_level;
        const value = user.territorial_value;
        if (!level || !value) return false;
        const allowedLevels = ['region', 'departement', 'arrondissement'];
        if (!allowedLevels.includes(level)) return false;

        // Un projet est accessible s'il a une localité OU un site dans le territoire
        const result = await db.query(`
            SELECT 1
            WHERE EXISTS (SELECT 1 FROM localities WHERE project_id = $1 AND ${level} = $2)
               OR EXISTS (SELECT 1 FROM sites WHERE project_id = $1 AND ${level} = $2)
            LIMIT 1
        `, [projectId, value]);
        return result.rowCount > 0;
    }

    return false;
}

module.exports = { canUserAccessProject };
