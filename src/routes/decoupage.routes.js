const express = require('express');
const router = express.Router();
const decoupageController = require('../controllers/decoupage.controller');
const { protect, authorize } = require('../middlewares/auth');

// All routes require authentication
router.use(protect);

// Public routes (authenticated users)
router.get('/regions', decoupageController.getRegions);
router.get('/departements', decoupageController.getDepartements);
router.get('/arrondissements', decoupageController.getArrondissements);
router.get('/communes', decoupageController.getCommunes);
router.get('/stats', decoupageController.getStats);
router.get('/', decoupageController.getAll);

// Admin-only routes
router.post('/import', authorize('admin'), decoupageController.bulkImport);
router.post('/', authorize('admin'), decoupageController.create);
router.put('/:id', authorize('admin'), decoupageController.update);
router.delete('/:id', authorize('admin'), decoupageController.delete);

module.exports = router;
