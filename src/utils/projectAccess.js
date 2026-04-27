const db = require('../config/db');
const ProjectStructure = require('../models/projectStructure.model');

/**
 * Vérifie si un utilisateur peut LIRE un projet, en tenant compte de son rôle.
 *
 * - admin / superviseur : accès à tout
 * - directeur : accès à tout en lecture (vue globale du contexte CNGIRI)
 * - lecteur / auditeur global (sans structure) : accès à tout
 * - lecteur / auditeur scopés (avec structure) : projets liés à leur structure
 * - utilisateur : seulement les projets liés à sa structure (via project_structures)
 * - commandement_territorial : seulement les projets situés dans leur territoire (via localities/sites)
 *
 * Pour vérifier le droit de MODIFICATION (create/update/delete/assign), utiliser
 * canUserModifyProject — directeur y est restreint à sa structure.
 *
 * @param {Object} user - req.user (id, role, structure_id, territorial_level, territorial_value)
 * @param {number|string} projectId
 * @returns {Promise<boolean>}
 */
async function canUserAccessProject(user, projectId) {
    if (!user || !projectId) return false;

    if (user.role === 'admin' || user.role === 'superviseur') return true;

    // Directeur : lecture globale. L'écriture est gérée par canUserModifyProject.
    if (user.role === 'directeur') return true;

    // Lecteur / auditeur global (sans structure) : accès à tout.
    // Avec une structure : même règle qu'utilisateur.
    if (user.role === 'lecteur' || user.role === 'auditeur') {
        if (!user.structure_id) return true;
        return ProjectStructure.userHasAccessToProject(user.id, projectId);
    }

    if (user.role === 'utilisateur') {
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

/**
 * Vérifie si un utilisateur peut MODIFIER un projet (create/update/delete/
 * geometries CRUD/assign/reassign). Plus restrictif que canUserAccessProject.
 *
 * - admin : accès écriture à tout
 * - directeur / utilisateur : seulement les projets liés à leur structure
 * - tous les autres rôles : refus (lecteur, auditeur, superviseur,
 *   commandement_territorial — l'écriture passe par d'autres flux côté PV /
 *   observations / commentaires).
 *
 * @param {Object} user
 * @param {number|string} projectId
 * @returns {Promise<boolean>}
 */
async function canUserModifyProject(user, projectId) {
    if (!user || !projectId) return false;
    if (user.role === 'admin') return true;
    if (user.role === 'directeur' || user.role === 'utilisateur') {
        if (!user.structure_id) return false;
        return ProjectStructure.userHasAccessToProject(user.id, projectId);
    }
    return false;
}

/**
 * Vrai si l'utilisateur est directeur ET le projet appartient à sa structure
 * principale. Utilisé pour étendre certains droits "admin de structure"
 * (assignation, réassignation, changement de statut de mesure) au directeur.
 */
function isDirecteurOfProject(user, project) {
    return !!(user && project
        && user.role === 'directeur'
        && user.structure_id != null
        && project.structure_id === user.structure_id);
}

module.exports = { canUserAccessProject, canUserModifyProject, isDirecteurOfProject };
