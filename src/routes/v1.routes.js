const express = require('express');
const router = express.Router();
const v1 = require('../controllers/v1.controller');
const { verifyApiKey, apiKeyRateLimiter } = require('../middlewares/apiKey');

// Doc publique (pas de clé)
router.get('/docs', v1.openapi);

// Toutes les autres routes nécessitent une clé valide + rate limit
router.use(verifyApiKey, apiKeyRateLimiter);

router.get('/projects', v1.listProjects);
router.get('/projects/stats', v1.getStats);
router.get('/projects/:id', v1.getProject);
router.get('/structures', v1.listStructures);

module.exports = router;
