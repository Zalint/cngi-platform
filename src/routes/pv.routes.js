const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/pv.controller');
const { protect } = require('../middlewares/auth');

router.use(protect);

router.get('/', ctrl.list);
router.get('/pickable', ctrl.pickable);
router.get('/unread-count', ctrl.unreadCount);
router.post('/mark-read', ctrl.markAllRead);
router.post('/:id/mark-read', ctrl.markOneRead);
router.get('/:id', ctrl.getOne);
router.post('/', ctrl.create);
router.put('/:id', ctrl.update);
router.delete('/:id', ctrl.remove);

module.exports = router;
