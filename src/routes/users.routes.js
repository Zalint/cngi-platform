const express = require('express');
const router = express.Router();
const usersController = require('../controllers/users.controller');
const { protect, authorize } = require('../middlewares/auth');

router.use(protect); // Toutes les routes nécessitent authentification

router.get('/active-sessions', authorize('admin'), usersController.getActiveSessions);
router.post('/:id/force-logout', authorize('admin'), usersController.forceLogout);

router.get('/', usersController.getAllUsers);
router.post('/', authorize('admin'), usersController.createUser);
router.get('/structure/:structureId', usersController.getUsersByStructure);
router.get('/:id', usersController.getUserById);
router.put('/:id', authorize('admin'), usersController.updateUser);
router.delete('/:id', authorize('admin'), usersController.deleteUser);

module.exports = router;

