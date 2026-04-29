const db = require('../config/db');
const bcrypt = require('bcryptjs');

class UserModel {
    /**
     * Récupérer tous les utilisateurs
     */
    static async findAll() {
        const result = await db.query(`
            SELECT u.id, u.username, u.email, u.first_name, u.last_name, u.role,
                   u.structure_id, u.is_active, u.last_login, u.created_at,
                   u.territorial_level, u.territorial_value, u.title,
                   s.name as structure_name, s.code as structure_code
            FROM users u
            LEFT JOIN structures s ON u.structure_id = s.id
            ORDER BY u.created_at DESC
        `);
        return result.rows;
    }

    /**
     * Récupérer un utilisateur par ID
     */
    static async findById(id) {
        const result = await db.query(`
            SELECT u.id, u.username, u.email, u.first_name, u.last_name, u.role,
                   u.structure_id, u.is_active, u.last_login, u.created_at,
                   u.territorial_level, u.territorial_value, u.title,
                   s.name as structure_name, s.code as structure_code
            FROM users u
            LEFT JOIN structures s ON u.structure_id = s.id
            WHERE u.id = $1
        `, [id]);
        return result.rows[0];
    }

    /**
     * Récupérer un utilisateur par username
     */
    static async findByUsername(username) {
        const result = await db.query(`
            SELECT u.*, s.name as structure_name, s.code as structure_code
            FROM users u
            LEFT JOIN structures s ON u.structure_id = s.id
            WHERE u.username = $1
        `, [username]);
        return result.rows[0];
    }

    /**
     * Récupérer les utilisateurs par structure
     */
    static async findByStructure(structureId) {
        const result = await db.query(`
            SELECT u.id, u.username, u.email, u.first_name, u.last_name, u.role, 
                   u.structure_id, u.is_active, u.last_login, u.created_at
            FROM users u
            WHERE u.structure_id = $1
            ORDER BY u.created_at DESC
        `, [structureId]);
        return result.rows;
    }

    /**
     * Créer un nouvel utilisateur
     */
    static async create(userData) {
        const { username, password, email, first_name, last_name, role, structure_id, territorial_level, territorial_value, title } = userData;

        // Hasher le mot de passe
        const password_hash = await bcrypt.hash(password, 10);

        const result = await db.query(`
            INSERT INTO users (username, password_hash, email, first_name, last_name, role, structure_id, territorial_level, territorial_value, title)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            RETURNING id, username, email, first_name, last_name, role, structure_id, territorial_level, territorial_value, title, is_active, created_at
        `, [username, password_hash, email, first_name, last_name, role, structure_id || null, territorial_level || null, territorial_value || null, title || null]);

        return result.rows[0];
    }

    /**
     * Mettre à jour un utilisateur
     */
    static async update(id, userData) {
        const { email, first_name, last_name, role, structure_id, is_active, territorial_level, territorial_value, title } = userData;

        const result = await db.query(`
            UPDATE users
            SET email = COALESCE($1, email),
                first_name = COALESCE($2, first_name),
                last_name = COALESCE($3, last_name),
                role = COALESCE($4, role),
                structure_id = COALESCE($5, structure_id),
                is_active = COALESCE($6, is_active),
                territorial_level = COALESCE($7, territorial_level),
                territorial_value = COALESCE($8, territorial_value),
                title = COALESCE($9, title)
            WHERE id = $10
            RETURNING id, username, email, first_name, last_name, role, structure_id, territorial_level, territorial_value, title, is_active, updated_at
        `, [email, first_name, last_name, role, structure_id, is_active, territorial_level, territorial_value, title === undefined ? null : title, id]);

        return result.rows[0];
    }

    /**
     * Met à jour le mot de passe ET incrémente token_version dans une seule
     * requête (atomique). Évite l'état partiel "password changé mais sessions
     * non révoquées" si une seconde requête échouait.
     * @returns {{ id, username, token_version }} ou undefined si user introuvable.
     */
    static async updatePasswordAndBumpVersion(id, newPassword) {
        const password_hash = await bcrypt.hash(newPassword, 10);
        const result = await db.query(`
            UPDATE users
            SET password_hash = $1,
                token_version = token_version + 1
            WHERE id = $2
            RETURNING id, username, token_version
        `, [password_hash, id]);
        return result.rows[0];
    }

    /**
     * Supprimer un utilisateur
     */
    static async delete(id) {
        const result = await db.query(`
            DELETE FROM users WHERE id = $1 RETURNING id
        `, [id]);
        
        return result.rows[0];
    }

    /**
     * Vérifier le mot de passe
     */
    static async comparePassword(plainPassword, hashedPassword) {
        return await bcrypt.compare(plainPassword, hashedPassword);
    }

    /**
     * Mettre à jour la dernière connexion
     */
    static async updateLastLogin(id) {
        await db.query(`
            UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1
        `, [id]);
    }

    /**
     * Vérifier si un username existe
     */
    static async usernameExists(username) {
        const result = await db.query(`
            SELECT id FROM users WHERE username = $1
        `, [username]);
        return result.rows.length > 0;
    }

    /**
     * Vérifier si un email existe
     */
    static async emailExists(email) {
        const result = await db.query(`
            SELECT id FROM users WHERE email = $1
        `, [email]);
        return result.rows.length > 0;
    }

    /**
     * Incrémente le token_version de l'utilisateur. Effet : tous les JWT
     * existants pour ce user deviennent invalides à la prochaine requête.
     * Utilisé pour la déconnexion volontaire des autres appareils par
     * l'utilisateur lui-même (auth.logoutAllDevices) — sans toucher à
     * last_activity_at car la session courante reste active.
     * @returns {number|null} la nouvelle valeur de token_version, ou null si user introuvable.
     */
    static async bumpTokenVersion(id) {
        const result = await db.query(`
            UPDATE users SET token_version = token_version + 1
            WHERE id = $1
            RETURNING token_version
        `, [id]);
        return result.rows[0]?.token_version ?? null;
    }

    /**
     * Révocation complète par un admin (force-logout) : bump token_version
     * ET reset last_activity_at = NULL pour que le user bascule "hors ligne"
     * dans la liste des sessions actives immédiatement, sans attendre les
     * 5 minutes du seuil "en ligne".
     * @returns {number|null} nouvelle token_version ou null si user introuvable.
     */
    static async revokeAllSessions(id) {
        const result = await db.query(`
            UPDATE users
            SET token_version = token_version + 1,
                last_activity_at = NULL
            WHERE id = $1
            RETURNING token_version
        `, [id]);
        return result.rows[0]?.token_version ?? null;
    }
}

module.exports = UserModel;

