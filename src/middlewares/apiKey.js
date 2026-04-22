const { rateLimit, ipKeyGenerator } = require('express-rate-limit');
const ApiKeyModel = require('../models/apiKey.model');

/**
 * Authentifie une requête via le header `x-api-key`.
 * Place l'utilisateur propriétaire de la clé dans req.user (compatible avec les middlewares existants).
 */
async function verifyApiKey(req, res, next) {
    try {
        const key = req.header('x-api-key') || req.query.api_key;
        if (!key) {
            return res.status(401).json({
                success: false,
                error: 'missing_api_key',
                message: 'Fournir une clé API dans le header x-api-key'
            });
        }

        const user = await ApiKeyModel.verify(key);
        if (!user) {
            return res.status(401).json({
                success: false,
                error: 'invalid_api_key',
                message: 'Clé API invalide, expirée ou révoquée'
            });
        }

        req.user = user;
        req.apiKeyId = user._apiKeyId;
        next();
    } catch (error) {
        next(error);
    }
}

/**
 * Rate limiter pré-authentification (par IP) — 300 req/min.
 * Protège la base de données contre le spam de clés invalides avant que
 * verifyApiKey ne soit appelé (chaque verify fait un DB query).
 */
const ipPreAuthRateLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 300,
    keyGenerator: (req, res) => ipKeyGenerator(req, res),
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        error: 'rate_limit_exceeded',
        message: 'Trop de requêtes depuis cette IP. Réessayez dans une minute.'
    }
});

/**
 * Rate limiter par clé API (post-auth) : 100 req / minute par clé.
 */
const apiKeyRateLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 100,
    keyGenerator: (req, res) => {
        if (req.apiKeyId) return `apikey:${req.apiKeyId}`;
        // Fallback improbable (verifyApiKey est censé être passé avant)
        return ipKeyGenerator(req, res);
    },
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        error: 'rate_limit_exceeded',
        message: 'Trop de requêtes pour cette clé. Réessayez dans une minute.'
    }
});

module.exports = { verifyApiKey, apiKeyRateLimiter, ipPreAuthRateLimiter };
