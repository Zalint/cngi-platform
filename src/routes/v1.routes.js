const express = require('express');
const router = express.Router();
const v1 = require('../controllers/v1.controller');
const { verifyApiKey, apiKeyRateLimiter, ipPreAuthRateLimiter } = require('../middlewares/apiKey');

// Doc publique (pas de clé) — limitée par IP pour éviter abus
router.get('/docs', ipPreAuthRateLimiter, v1.openapi);

// Toutes les autres routes :
// 1) rate limit par IP AVANT verifyApiKey (protège le DB contre spam de clés invalides)
// 2) vérification de la clé
// 3) rate limit par clé (après résolution de apiKeyId)
router.use(ipPreAuthRateLimiter, verifyApiKey, apiKeyRateLimiter);

router.get('/projects', v1.listProjects);
router.get('/projects/stats', v1.getStats);
router.get('/projects/:id', v1.getProject);
router.get('/structures', v1.listStructures);

module.exports = router;
