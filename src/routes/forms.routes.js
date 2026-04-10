const express = require('express');
const router = express.Router();
const formsController = require('../controllers/forms.controller');
const { protect, authorize } = require('../middlewares/auth');

router.use(protect);

router.get('/', formsController.getAllForms);
router.post('/', authorize('admin'), formsController.createForm);
router.get('/:id', formsController.getFormById);
router.get('/:id/submissions', formsController.getSubmissions);
router.put('/:id', authorize('admin'), formsController.updateForm);
router.delete('/:id', authorize('admin'), formsController.deleteForm);

module.exports = router;

