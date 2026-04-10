const express = require('express');
const router = express.Router();
const seedController = require('../controllers/seed.controller');
const { protect, authorize } = require('../middlewares/auth');

// Toutes les routes nécessitent admin
router.use(protect);
router.use(authorize('admin'));

router.post('/reset', seedController.resetDatabase);
router.post('/populate', seedController.populateDatabase);
router.post('/reset-and-populate', seedController.resetAndPopulate);

module.exports = router;

