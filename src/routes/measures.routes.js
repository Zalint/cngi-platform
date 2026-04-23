const express = require('express');
const router = express.Router();
const measuresController = require('../controllers/measures.controller');
const { protect } = require('../middlewares/auth');

router.use(protect);

// "Mes mesures" : toutes les mesures assignées à l'utilisateur authentifié.
router.get('/my', measuresController.listMine);
router.get('/my/stats', measuresController.myStats);

module.exports = router;
