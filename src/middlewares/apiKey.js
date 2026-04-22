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
 * Rate limiter par clé API : 100 req / minute par défaut.
 */
const apiKeyRateLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 100,
    keyGenerator: (req, res) => {
        if (req.apiKeyId) return `apikey:${req.apiKeyId}`;
        const header = req.header('x-api-key');
        if (header) return `header:${header}`;
        return ipKeyGenerator(req, res);
    },
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        error: 'rate_limit_exceeded',
        message: 'Trop de requêtes. Réessayez dans une minute.'
    }
});

module.exports = { verifyApiKey, apiKeyRateLimiter };
