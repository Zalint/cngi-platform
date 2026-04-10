const express = require('express');
const router = express.Router();
const measureCommentsController = require('../controllers/measureComments.controller');
const { protect } = require('../middlewares/auth');

// Toutes les routes nécessitent une authentification
router.use(protect);

// Routes pour les commentaires
router.post('/measures/:measureId/comments', measureCommentsController.createComment);
router.get('/measures/:measureId/comments', measureCommentsController.getCommentsByMeasure);
router.delete('/comments/:id', measureCommentsController.deleteComment);

module.exports = router;

