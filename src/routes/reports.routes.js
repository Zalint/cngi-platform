const express = require('express');
const router = express.Router();
const reportsController = require('../controllers/reports.controller');
const { protect } = require('../middlewares/auth');

router.use(protect);

router.post('/generate', reportsController.generateReport);

module.exports = router;
