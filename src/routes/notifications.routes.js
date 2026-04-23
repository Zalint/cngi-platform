const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/notifications.controller');
const { protect } = require('../middlewares/auth');

router.use(protect);

router.get('/',                ctrl.list);
router.get('/unread-count',    ctrl.unreadCount);
router.post('/mark-all-read',  ctrl.markAllRead);
router.post('/:id/read',       ctrl.markRead);
router.delete('/:id',          ctrl.remove);

module.exports = router;
