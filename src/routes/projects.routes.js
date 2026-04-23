const express = require('express');
const router = express.Router();
const projectsController = require('../controllers/projects.controller');
const exportController = require('../controllers/export.controller');
const { protect, authorize } = require('../middlewares/auth');

router.use(protect);

router.get('/', projectsController.getAllProjects);
router.post('/', authorize('admin', 'utilisateur'), projectsController.createProject);
router.get('/stats', projectsController.getStats);
// Corbeille (soft delete) — admin uniquement
router.get('/deleted', authorize('admin'), projectsController.listDeleted);
router.post('/:id/restore', authorize('admin'), projectsController.restoreProject);
router.delete('/:id/hard', authorize('admin'), projectsController.hardDeleteProject);
router.get('/export/xlsx', authorize('admin', 'utilisateur', 'directeur', 'superviseur', 'commandement_territorial', 'auditeur'), exportController.exportProjectsXlsx);
router.get('/:id', projectsController.getProjectById);
router.put('/:id', authorize('admin', 'utilisateur'), projectsController.updateProject);
router.patch('/:id/progress', authorize('admin', 'utilisateur'), projectsController.updateProgress);
router.delete('/:id', authorize('admin', 'utilisateur'), projectsController.deleteProject);

// Sous-ressources
router.post('/:id/localities', authorize('admin', 'utilisateur'), projectsController.addLocality);
router.post('/:id/sites', authorize('admin', 'utilisateur'), projectsController.addSite);
router.post('/:id/measures', authorize('admin', 'utilisateur'), projectsController.addMeasure);
router.post('/:id/stakeholders', authorize('admin', 'utilisateur'), projectsController.addStakeholder);
router.post('/:id/financing', authorize('admin', 'utilisateur'), projectsController.addFinancing);

// Project-Structure Mappings (Admin only)
router.get('/mappings/all', authorize('admin'), projectsController.getAllMappings);
router.get('/:id/structures', projectsController.getProjectStructures);
router.post('/:id/structures', authorize('admin'), projectsController.assignStructuresToProject);
router.delete('/:id/structures/:structureId', authorize('admin'), projectsController.removeStructureFromProject);

// Assignation d'utilisateurs aux mesures (Chef de projet ou Admin)
router.put('/:projectId/measures/:measureId/assign', authorize('admin', 'utilisateur'), projectsController.assignUserToMeasure);
router.put('/:projectId/measures/:measureId/reassign', authorize('admin', 'utilisateur'), projectsController.reassignMeasure);
router.put('/:projectId/measures/:measureId/status', authorize('admin', 'utilisateur'), projectsController.updateMeasureStatus);

// Project Comments
router.get('/:id/comments', projectsController.getComments);
router.post('/:id/comments', authorize('admin', 'utilisateur', 'directeur', 'superviseur', 'commandement_territorial'), projectsController.addComment);
router.delete('/:id/comments/:commentId', authorize('admin', 'utilisateur', 'directeur', 'superviseur', 'commandement_territorial'), projectsController.deleteComment);

module.exports = router;

