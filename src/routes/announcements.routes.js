const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/announcements.controller');
const { protect, authorize } = require('../middlewares/auth');

router.use(protect);

router.get('/active', ctrl.getActive);

// Admin uniquement
router.get('/', authorize('admin'), ctrl.getAll);
router.post('/', authorize('admin'), ctrl.create);
router.post('/:id/revoke', authorize('admin'), ctrl.revoke);
router.delete('/:id', authorize('admin'), ctrl.remove);

module.exports = router;
