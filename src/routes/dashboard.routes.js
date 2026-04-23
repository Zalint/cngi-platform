const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboard.controller');
const { protect } = require('../middlewares/auth');

router.use(protect);

router.get('/metrics', dashboardController.getMetrics);
router.get('/projects-by-structure', dashboardController.getProjectsByStructure);
router.get('/map-data', dashboardController.getMapData);
router.get('/map-geometries', dashboardController.getMapGeometries);
router.get('/recent-projects', dashboardController.getRecentProjects);
router.get('/late-projects', dashboardController.getLateProjects);
router.get('/chart-data', dashboardController.getChartData);

module.exports = router;

