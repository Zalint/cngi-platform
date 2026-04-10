const express = require('express');
const router = express.Router();
const structuresController = require('../controllers/structures.controller');
const { protect, authorize } = require('../middlewares/auth');

router.use(protect);

router.get('/', structuresController.getAllStructures);
router.get('/stats', structuresController.getStats);
router.post('/', authorize('admin'), structuresController.createStructure);
router.get('/:id', structuresController.getStructureById);
router.put('/:id', authorize('admin'), structuresController.updateStructure);
router.delete('/:id', authorize('admin'), structuresController.deleteStructure);

module.exports = router;

