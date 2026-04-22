const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chat.controller');
const { protect } = require('../middlewares/auth');

router.use(protect);

router.post('/', chatController.chat);

module.exports = router;
