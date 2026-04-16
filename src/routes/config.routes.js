const express = require('express');
const router = express.Router();
const configController = require('../controllers/config.controller');
const { protect, authorize } = require('../middlewares/auth');

router.use(protect);

router.get('/', configController.getAll);
router.get('/:category', configController.getByCategory);
router.post('/', authorize('admin'), configController.create);
router.put('/:id', authorize('admin'), configController.update);
router.delete('/:id', authorize('admin'), configController.delete);

module.exports = router;
