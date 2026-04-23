const express = require('express');
const router = express.Router();
const reportsController = require('../controllers/reports.controller');
const { protect, authorize } = require('../middlewares/auth');

router.use(protect);

// Le rôle `lecteur` est volontairement exclu : il ne peut pas générer de rapport.
router.post('/generate', authorize('admin', 'utilisateur', 'directeur', 'superviseur', 'commandement_territorial', 'auditeur'), reportsController.generateReport);

module.exports = router;
