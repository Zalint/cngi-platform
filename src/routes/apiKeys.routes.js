const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/apiKeys.controller');
const { protect } = require('../middlewares/auth');

router.use(protect);

router.get('/', ctrl.list);
router.post('/', ctrl.create);
router.post('/:id/revoke', ctrl.revoke);
router.delete('/:id', ctrl.remove);

module.exports = router;
