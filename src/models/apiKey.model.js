const crypto = require('crypto');
const db = require('../config/db');

const KEY_PREFIX = 'cngiri_';

function generateKey() {
    const random = crypto.randomBytes(24).toString('base64url'); // 32 chars
    return `${KEY_PREFIX}${random}`;
}

function hashKey(clearKey) {
    return crypto.createHash('sha256').update(clearKey).digest('hex');
}

class ApiKeyModel {
    /**
     * Crée une nouvelle clé pour un utilisateur.
     * Retourne la clé en clair UNE SEULE FOIS, et la stocke hashée.
     */
    static async create(userId, label, expiresAt = null) {
        const clearKey = generateKey();
        const keyHash = hashKey(clearKey);
        const keyPrefix = clearKey.slice(0, 14); // ex: "cngiri_aBc123"

        const result = await db.query(`
            INSERT INTO api_keys (user_id, key_hash, key_prefix, label, expires_at)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING id, key_prefix, label, is_active, expires_at, created_at
        `, [userId, keyHash, keyPrefix, label || null, expiresAt]);

        return {
            ...result.rows[0],
            key: clearKey // Montré une seule fois au user
        };
    }

    /**
     * Vérifie une clé en clair, renvoie l'utilisateur propriétaire si valide.
     */
    static async verify(clearKey) {
        if (!clearKey || !clearKey.startsWith(KEY_PREFIX)) return null;
        const keyHash = hashKey(clearKey);
        const result = await db.query(`
            SELECT ak.id as key_id, ak.is_active, ak.expires_at,
                   u.id, u.username, u.email, u.first_name, u.last_name, u.role,
                   u.structure_id, u.territorial_level, u.territorial_value, u.is_active as user_active
            FROM api_keys ak
            JOIN users u ON ak.user_id = u.id
            WHERE ak.key_hash = $1
        `, [keyHash]);

        if (result.rows.length === 0) return null;
        const row = result.rows[0];
        if (!row.is_active || !row.user_active) return null;
        if (row.expires_at && new Date(row.expires_at) < new Date()) return null;

        // Mettre à jour last_used_at (fire and forget)
        db.query('UPDATE api_keys SET last_used_at = CURRENT_TIMESTAMP WHERE id = $1', [row.key_id])
            .catch(err => console.error('Failed to update last_used_at:', err.message));

        return {
            id: row.id,
            username: row.username,
            email: row.email,
            first_name: row.first_name,
            last_name: row.last_name,
            role: row.role,
            structure_id: row.structure_id,
            territorial_level: row.territorial_level,
            territorial_value: row.territorial_value,
            _apiKeyId: row.key_id
        };
    }

    /**
     * Liste les clés d'un utilisateur (sans jamais renvoyer le hash).
     */
    static async listByUser(userId) {
        const result = await db.query(`
            SELECT id, key_prefix, label, is_active, last_used_at, expires_at, created_at
            FROM api_keys
            WHERE user_id = $1
            ORDER BY created_at DESC
        `, [userId]);
        return result.rows;
    }

    /**
     * Liste toutes les clés (admin uniquement).
     */
    static async listAll() {
        const result = await db.query(`
            SELECT ak.id, ak.key_prefix, ak.label, ak.is_active, ak.last_used_at, ak.expires_at, ak.created_at,
                   u.id as user_id, u.username, u.first_name, u.last_name, u.role
            FROM api_keys ak
            JOIN users u ON ak.user_id = u.id
            ORDER BY ak.created_at DESC
        `);
        return result.rows;
    }

    static async revoke(keyId, userId = null) {
        const params = [keyId];
        let query = 'UPDATE api_keys SET is_active = false WHERE id = $1';
        if (userId !== null) {
            query += ' AND user_id = $2';
            params.push(userId);
        }
        const result = await db.query(`${query} RETURNING id`, params);
        return result.rows[0];
    }

    static async delete(keyId, userId = null) {
        const params = [keyId];
        let query = 'DELETE FROM api_keys WHERE id = $1';
        if (userId !== null) {
            query += ' AND user_id = $2';
            params.push(userId);
        }
        const result = await db.query(`${query} RETURNING id`, params);
        return result.rows[0];
    }
}

module.exports = ApiKeyModel;
