const express = require('express');
const router = express.Router();
const submissionsController = require('../controllers/submissions.controller');
const { protect, authorize } = require('../middlewares/auth');

router.use(protect);

router.post('/', authorize('admin', 'utilisateur'), submissionsController.submitForm);
router.get('/:id', submissionsController.getSubmissionById);

module.exports = router;

