jest.mock('../../../src/config/db', () => require('../../helpers/db').createDbMock());
jest.mock('../../../src/models/project.model', () => ({
    findAll: jest.fn(),
    findById: jest.fn(),
    findByTerritory: jest.fn(),
    findDeleted: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateLocalities: jest.fn(),
    updateSites: jest.fn(),
    updateMeasures: jest.fn(),
    updateStakeholders: jest.fn(),
    updateFunding: jest.fn(),
    addLocality: jest.fn(),
    addSite: jest.fn(),
    addMeasure: jest.fn(),
    addStakeholder: jest.fn(),
    addFinancing: jest.fn(),
    isProjectManager: jest.fn(),
    assignUserToMeasure: jest.fn(),
    reassignMeasure: jest.fn(),
    updateMeasureStatus: jest.fn(),
    getComments: jest.fn(),
    addComment: jest.fn(),
    deleteComment: jest.fn(),
}));
jest.mock('../../../src/models/projectStructure.model', () => ({
    getStructuresByProject: jest.fn(),
    assignMultipleStructures: jest.fn(),
    removeStructure: jest.fn(),
    getAllMappings: jest.fn(),
    userHasAccessToProject: jest.fn(),
}));
jest.mock('../../../src/models/notification.model', () => ({ create: jest.fn().mockResolvedValue(null) }));
jest.mock('../../../src/utils/projectAccess', () => ({
    canUserAccessProject: jest.fn(),
    canUserModifyProject: jest.fn(),
    isDirecteurOfProject: jest.fn(() => false),
}));

const ProjectModel = require('../../../src/models/project.model');
const ProjectStructure = require('../../../src/models/projectStructure.model');
const NotificationModel = require('../../../src/models/notification.model');
const db = require('../../../src/config/db');
const ctrl = require('../../../src/controllers/projects.controller');
const { mockReq, mockRes, mockNext } = require('../../helpers/http');

beforeEach(() => jest.clearAllMocks());

describe('updateProject (batch)', () => {
    beforeEach(() => {
        ProjectModel.findById.mockResolvedValue({ id: 1, title: 'P' });
        ProjectModel.update.mockResolvedValue({ id: 1 });
    });
    test('404 si projet inexistant', async () => {
        ProjectModel.findById.mockResolvedValue(null);
        const res = mockRes();
        await ctrl.updateProject(mockReq({ params: { id: '1' }, user: { role: 'admin' }, body: {} }), res, mockNext());
        expect(res.statusCode).toBe(404);
    });
    test('403 si canUserModifyProject false', async () => {
        const { canUserModifyProject } = require('../../../src/utils/projectAccess');
        canUserModifyProject.mockResolvedValue(false);
        const res = mockRes();
        await ctrl.updateProject(mockReq({
            params: { id: '1' }, user: { role: 'utilisateur', id: 2, structure_id: 5 }, body: {}
        }), res, mockNext());
        expect(res.statusCode).toBe(403);
    });
    test('400 validation échoue', async () => {
        const { canUserModifyProject } = require('../../../src/utils/projectAccess');
        canUserModifyProject.mockResolvedValue(true);
        const res = mockRes();
        await ctrl.updateProject(mockReq({
            params: { id: '1' }, user: { role: 'admin' }, body: { status: 'bad' }
        }), res, mockNext());
        expect(res.statusCode).toBe(400);
    });
    test('appelle tous les updateX si batch fourni', async () => {
        const { canUserModifyProject } = require('../../../src/utils/projectAccess');
        canUserModifyProject.mockResolvedValue(true);
        await ctrl.updateProject(mockReq({
            params: { id: '1' }, user: { role: 'admin' },
            body: {
                title: 'P2',
                localities: [{}], sites: [{}], measures: [{}], stakeholders: [{}], funding: [{}]
            }
        }), mockRes(), mockNext());
        expect(ProjectModel.updateLocalities).toHaveBeenCalled();
        expect(ProjectModel.updateSites).toHaveBeenCalled();
        expect(ProjectModel.updateMeasures).toHaveBeenCalled();
        expect(ProjectModel.updateStakeholders).toHaveBeenCalled();
        expect(ProjectModel.updateFunding).toHaveBeenCalled();
    });
});

describe('addLocality / addSite / addMeasure / addStakeholder / addFinancing', () => {
    test.each([
        ['addLocality', 'addLocality'],
        ['addSite', 'addSite'],
        ['addMeasure', 'addMeasure'],
        ['addStakeholder', 'addStakeholder'],
        ['addFinancing', 'addFinancing'],
    ])('%s renvoie 201', async (ctrlName, modelName) => {
        ProjectModel[modelName].mockResolvedValue({ id: 99 });
        const res = mockRes();
        await ctrl[ctrlName](mockReq({ params: { id: '1' }, body: {} }), res, mockNext());
        expect(res.statusCode).toBe(201);
    });
});

describe('listDeleted', () => {
    test('retourne count + data', async () => {
        ProjectModel.findDeleted.mockResolvedValue([{ id: 1 }]);
        const res = mockRes();
        await ctrl.listDeleted(mockReq(), res, mockNext());
        expect(res.body.count).toBe(1);
    });
});

describe('Project-Structure Mapping', () => {
    test('getProjectStructures', async () => {
        ProjectStructure.getStructuresByProject.mockResolvedValue([{ id: 1 }]);
        const res = mockRes();
        await ctrl.getProjectStructures(mockReq({ params: { id: '1' } }), res, mockNext());
        expect(res.body.count).toBe(1);
    });
    test('assignStructuresToProject 400 si pas un tableau', async () => {
        const res = mockRes();
        await ctrl.assignStructuresToProject(mockReq({
            params: { id: '1' }, user: { id: 1 }, body: { structure_ids: 'nope' }
        }), res, mockNext());
        expect(res.statusCode).toBe(400);
    });
    test('assignStructuresToProject : appelle assignMultipleStructures', async () => {
        ProjectStructure.getStructuresByProject.mockResolvedValue([]);
        const res = mockRes();
        await ctrl.assignStructuresToProject(mockReq({
            params: { id: '1' }, user: { id: 7 }, body: { structure_ids: [1, 2] }
        }), res, mockNext());
        expect(ProjectStructure.assignMultipleStructures).toHaveBeenCalledWith('1', [1, 2], 7);
        expect(res.body.success).toBe(true);
    });
    test('removeStructureFromProject 404', async () => {
        ProjectStructure.removeStructure.mockResolvedValue(undefined);
        const res = mockRes();
        await ctrl.removeStructureFromProject(mockReq({ params: { id: '1', structureId: '2' } }), res, mockNext());
        expect(res.statusCode).toBe(404);
    });
    test('removeStructureFromProject 200', async () => {
        ProjectStructure.removeStructure.mockResolvedValue({ project_id: 1 });
        const res = mockRes();
        await ctrl.removeStructureFromProject(mockReq({ params: { id: '1', structureId: '2' } }), res, mockNext());
        expect(res.statusCode).toBe(200);
    });
    test('getAllMappings', async () => {
        ProjectStructure.getAllMappings.mockResolvedValue([]);
        const res = mockRes();
        await ctrl.getAllMappings(mockReq(), res, mockNext());
        expect(res.body.success).toBe(true);
    });
});

describe('assignUserToMeasure', () => {
    test('400 si userId manquant', async () => {
        const res = mockRes();
        await ctrl.assignUserToMeasure(mockReq({
            params: { projectId: '1', measureId: '5' }, user: { id: 1 }, body: {}
        }), res, mockNext());
        expect(res.statusCode).toBe(400);
    });
    test('404 si projet inexistant', async () => {
        ProjectModel.findById.mockResolvedValue(null);
        const res = mockRes();
        await ctrl.assignUserToMeasure(mockReq({
            params: { projectId: '1', measureId: '5' }, user: { id: 1 }, body: { userId: 2 }
        }), res, mockNext());
        expect(res.statusCode).toBe(404);
    });
    test('403 si ni chef ni admin', async () => {
        ProjectModel.findById.mockResolvedValue({ id: 1, title: 'P' });
        ProjectModel.isProjectManager.mockResolvedValue(false);
        const res = mockRes();
        await ctrl.assignUserToMeasure(mockReq({
            params: { projectId: '1', measureId: '5' },
            user: { id: 1, role: 'utilisateur' }, body: { userId: 2 }
        }), res, mockNext());
        expect(res.statusCode).toBe(403);
    });
    test('chef de projet assigne + notifie', async () => {
        ProjectModel.findById.mockResolvedValue({ id: 1, title: 'P' });
        ProjectModel.isProjectManager.mockResolvedValue(true);
        ProjectModel.assignUserToMeasure.mockResolvedValue({ description: 'm' });
        await ctrl.assignUserToMeasure(mockReq({
            params: { projectId: '1', measureId: '5' },
            user: { id: 1, role: 'utilisateur' }, body: { userId: 2 }
        }), mockRes(), mockNext());
        await new Promise(setImmediate);
        expect(NotificationModel.create).toHaveBeenCalled();
        expect(NotificationModel.create.mock.calls[0][0].userId).toBe(2);
    });
    test('pas de notif si l\'utilisateur s\'assigne lui-même', async () => {
        ProjectModel.findById.mockResolvedValue({ id: 1, title: 'P' });
        ProjectModel.isProjectManager.mockResolvedValue(true);
        ProjectModel.assignUserToMeasure.mockResolvedValue({});
        await ctrl.assignUserToMeasure(mockReq({
            params: { projectId: '1', measureId: '5' },
            user: { id: 2, role: 'utilisateur' }, body: { userId: 2 }
        }), mockRes(), mockNext());
        await new Promise(setImmediate);
        expect(NotificationModel.create).not.toHaveBeenCalled();
    });
});

describe('reassignMeasure', () => {
    test('403 sans droit', async () => {
        ProjectModel.isProjectManager.mockResolvedValue(false);
        const res = mockRes();
        await ctrl.reassignMeasure(mockReq({
            params: { projectId: '1', measureId: '5' },
            user: { id: 1, role: 'utilisateur' }, body: {}
        }), res, mockNext());
        expect(res.statusCode).toBe(403);
    });
    test('404 si mesure absente du projet', async () => {
        ProjectModel.isProjectManager.mockResolvedValue(true);
        ProjectModel.reassignMeasure.mockResolvedValue(null);
        const res = mockRes();
        await ctrl.reassignMeasure(mockReq({
            params: { projectId: '1', measureId: '5' },
            user: { id: 1, role: 'utilisateur' }, body: { structure_id: 3 }
        }), res, mockNext());
        expect(res.statusCode).toBe(404);
    });
    test('admin peut sans être chef', async () => {
        ProjectModel.isProjectManager.mockResolvedValue(false);
        ProjectModel.reassignMeasure.mockResolvedValue({ id: 5, description: 'm' });
        const res = mockRes();
        await ctrl.reassignMeasure(mockReq({
            params: { projectId: '1', measureId: '5' },
            user: { id: 1, role: 'admin' }, body: { assigned_user_id: 99 }
        }), res, mockNext());
        expect(res.statusCode).toBe(200);
        await new Promise(setImmediate);
        expect(NotificationModel.create).toHaveBeenCalled();
    });
});

describe('updateMeasureStatus', () => {
    test('400 sans status', async () => {
        const res = mockRes();
        await ctrl.updateMeasureStatus(mockReq({
            params: { projectId: '1', measureId: '5' }, user: { id: 1 }, body: {}
        }), res, mockNext());
        expect(res.statusCode).toBe(400);
    });
    test('404 si projet absent', async () => {
        ProjectModel.findById.mockResolvedValue(null);
        const res = mockRes();
        await ctrl.updateMeasureStatus(mockReq({
            params: { projectId: '1', measureId: '5' }, user: { id: 1 }, body: { status: 'executee' }
        }), res, mockNext());
        expect(res.statusCode).toBe(404);
    });
    test('404 si mesure pas dans le projet', async () => {
        ProjectModel.findById.mockResolvedValue({ measures: [], title: 'P' });
        const res = mockRes();
        await ctrl.updateMeasureStatus(mockReq({
            params: { projectId: '1', measureId: '5' }, user: { id: 1 }, body: { status: 'executee' }
        }), res, mockNext());
        expect(res.statusCode).toBe(404);
    });
    test('403 si ni assigné ni manager ni admin', async () => {
        ProjectModel.findById.mockResolvedValue({ measures: [{ id: 5, assigned_user_id: 99 }], title: 'P' });
        ProjectModel.isProjectManager.mockResolvedValue(false);
        const res = mockRes();
        await ctrl.updateMeasureStatus(mockReq({
            params: { projectId: '1', measureId: '5' },
            user: { id: 1, role: 'utilisateur' }, body: { status: 'executee' }
        }), res, mockNext());
        expect(res.statusCode).toBe(403);
    });
    test('assigné : update + notif watchers', async () => {
        ProjectModel.findById.mockResolvedValue({
            id: 1, title: 'P', measures: [{ id: 5, assigned_user_id: 1, description: 'd' }]
        });
        ProjectModel.isProjectManager.mockResolvedValue(false);
        ProjectModel.updateMeasureStatus.mockResolvedValue({ id: 5 });
        // collectMeasureWatchers fait un db.query et renvoie deux user ids
        db.query.mockResolvedValue({ rows: [{ id: 99 }, { id: 42 }] });
        const res = mockRes();
        await ctrl.updateMeasureStatus(mockReq({
            params: { projectId: '1', measureId: '5' },
            user: { id: 1, role: 'utilisateur' }, body: { status: 'executee' }
        }), res, mockNext());
        expect(res.statusCode).toBe(200);
        // Les notifs sont fire-and-forget (chaîne .then) : attendre la microtask queue.
        await new Promise(setImmediate);
        await new Promise(setImmediate);
        expect(NotificationModel.create).toHaveBeenCalledTimes(2);
        expect(NotificationModel.create).toHaveBeenCalledWith(expect.objectContaining({
            userId: 99,
            type: 'measure_status_changed',
            title: expect.stringContaining('Exécutée'),
        }));
        expect(NotificationModel.create).toHaveBeenCalledWith(expect.objectContaining({
            userId: 42,
            type: 'measure_status_changed',
        }));
    });
});

describe('Project comments', () => {
    test('getComments', async () => {
        ProjectModel.getComments.mockResolvedValue([{ id: 1 }]);
        const res = mockRes();
        await ctrl.getComments(mockReq({ params: { id: '1' } }), res, mockNext());
        expect(res.body.data).toHaveLength(1);
    });
    test('addComment 400 si vide', async () => {
        const res = mockRes();
        await ctrl.addComment(mockReq({
            params: { id: '1' }, user: { id: 1 }, body: { comment: '  ' }
        }), res, mockNext());
        expect(res.statusCode).toBe(400);
    });
    test('addComment 201 + trim', async () => {
        ProjectModel.addComment.mockResolvedValue({ id: 1 });
        const res = mockRes();
        await ctrl.addComment(mockReq({
            params: { id: '5' }, user: { id: 7 }, body: { comment: '  hi  ' }
        }), res, mockNext());
        expect(ProjectModel.addComment).toHaveBeenCalledWith('5', 7, 'hi');
        expect(res.statusCode).toBe(201);
    });
    test('deleteComment 404', async () => {
        ProjectModel.deleteComment.mockResolvedValue(undefined);
        const res = mockRes();
        await ctrl.deleteComment(mockReq({
            params: { commentId: '9' }, user: { id: 7 }
        }), res, mockNext());
        expect(res.statusCode).toBe(404);
    });
    test('deleteComment 200', async () => {
        ProjectModel.deleteComment.mockResolvedValue({ id: 9 });
        const res = mockRes();
        await ctrl.deleteComment(mockReq({
            params: { commentId: '9' }, user: { id: 7 }
        }), res, mockNext());
        expect(res.statusCode).toBe(200);
    });
});
