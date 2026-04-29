const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const { protect } = require('../middlewares/auth');

router.post('/login', authController.login);
router.post('/logout', protect, authController.logout);
router.post('/logout-all-devices', protect, authController.logoutAllDevices);
router.get('/me', protect, authController.getMe);
router.post('/change-password', protect, authController.changePassword);

module.exports = router;

