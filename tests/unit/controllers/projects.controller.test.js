jest.mock('../../../src/config/db', () => require('../../helpers/db').createDbMock());
jest.mock('../../../src/models/project.model', () => ({
    findAll: jest.fn(),
    findById: jest.fn(),
    findByTerritory: jest.fn(),
    findDeleted: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateProgress: jest.fn(),
    delete: jest.fn(),
    restore: jest.fn(),
    hardDelete: jest.fn(),
    getStats: jest.fn(),
    getStatsByTerritory: jest.fn(),
}));
jest.mock('../../../src/models/projectStructure.model', () => ({
    getProjectsByStructure: jest.fn(),
    assignStructure: jest.fn(),
    userHasAccessToProject: jest.fn(),
    getStructuresByProject: jest.fn(),
}));
jest.mock('../../../src/utils/projectAccess', () => ({
    canUserAccessProject: jest.fn(),
}));

const ProjectModel = require('../../../src/models/project.model');
const ProjectStructure = require('../../../src/models/projectStructure.model');
const { canUserAccessProject } = require('../../../src/utils/projectAccess');
const ctrl = require('../../../src/controllers/projects.controller');
const { mockReq, mockRes, mockNext } = require('../../helpers/http');

beforeEach(() => jest.clearAllMocks());

describe('getAllProjects — dispatching par rôle', () => {
    test('admin → ProjectModel.findAll', async () => {
        ProjectModel.findAll.mockResolvedValue([{ id: 1, budget: 100 }]);
        const res = mockRes();
        await ctrl.getAllProjects(mockReq({ user: { role: 'admin' } }), res, mockNext());
        expect(ProjectModel.findAll).toHaveBeenCalled();
        expect(res.body.data[0].budget).toBe(100);
    });

    test('superviseur → findAll', async () => {
        ProjectModel.findAll.mockResolvedValue([]);
        await ctrl.getAllProjects(mockReq({ user: { role: 'superviseur' } }), mockRes(), mockNext());
        expect(ProjectModel.findAll).toHaveBeenCalled();
    });

    test('lecteur global (sans structure) → findAll', async () => {
        ProjectModel.findAll.mockResolvedValue([]);
        await ctrl.getAllProjects(mockReq({ user: { role: 'lecteur' } }), mockRes(), mockNext());
        expect(ProjectModel.findAll).toHaveBeenCalled();
    });

    test('lecteur scopé → getProjectsByStructure + redact budget/funding', async () => {
        ProjectStructure.getProjectsByStructure.mockResolvedValue([
            { id: 1, budget: 500, funding: [{ amount: 100 }] }
        ]);
        const res = mockRes();
        await ctrl.getAllProjects(mockReq({ user: { role: 'lecteur', structure_id: 3 } }), res, mockNext());
        expect(ProjectStructure.getProjectsByStructure).toHaveBeenCalledWith(3);
        expect(res.body.data[0].budget).toBeNull();
        expect(res.body.data[0].funding).toEqual([]);
    });

    test('utilisateur → getProjectsByStructure, sans redaction', async () => {
        ProjectStructure.getProjectsByStructure.mockResolvedValue([{ id: 1, budget: 500 }]);
        const res = mockRes();
        await ctrl.getAllProjects(mockReq({ user: { role: 'utilisateur', structure_id: 3 } }), res, mockNext());
        expect(res.body.data[0].budget).toBe(500);
    });

    test('commandement_territorial → findByTerritory', async () => {
        ProjectModel.findByTerritory.mockResolvedValue([]);
        await ctrl.getAllProjects(mockReq({
            user: { role: 'commandement_territorial', territorial_level: 'region', territorial_value: 'Dakar' }
        }), mockRes(), mockNext());
        expect(ProjectModel.findByTerritory).toHaveBeenCalledWith('region', 'Dakar');
    });

    test('transmet filters admin (structure_id/status/q)', async () => {
        ProjectModel.findAll.mockResolvedValue([]);
        await ctrl.getAllProjects(mockReq({
            user: { role: 'admin' },
            query: { structure_id: '5', status: 'en_cours', q: 'digue' }
        }), mockRes(), mockNext());
        expect(ProjectModel.findAll).toHaveBeenCalledWith({ structure_id: '5', status: 'en_cours', q: 'digue' });
    });
});

describe('getProjectById', () => {
    test('404 si projet inexistant', async () => {
        ProjectModel.findById.mockResolvedValue(null);
        const res = mockRes();
        await ctrl.getProjectById(mockReq({ params: { id: '1' }, user: { role: 'admin' } }), res, mockNext());
        expect(res.statusCode).toBe(404);
    });
    test('403 si pas d\'accès', async () => {
        ProjectModel.findById.mockResolvedValue({ id: 1 });
        canUserAccessProject.mockResolvedValue(false);
        const res = mockRes();
        await ctrl.getProjectById(mockReq({ params: { id: '1' }, user: { role: 'utilisateur' } }), res, mockNext());
        expect(res.statusCode).toBe(403);
    });
    test('200 + redaction budget pour lecteur', async () => {
        ProjectModel.findById.mockResolvedValue({ id: 1, budget: 9999, funding: [{ amount: 1 }] });
        canUserAccessProject.mockResolvedValue(true);
        const res = mockRes();
        await ctrl.getProjectById(mockReq({ params: { id: '1' }, user: { role: 'lecteur' } }), res, mockNext());
        expect(res.body.data.budget).toBeNull();
        expect(res.body.data.funding).toEqual([]);
    });
});

describe('createProject', () => {
    test('400 si validation échoue', async () => {
        const res = mockRes();
        await ctrl.createProject(mockReq({
            user: { id: 1, role: 'admin' }, body: { title: '', structure_id: 1 }
        }), res, mockNext());
        expect(res.statusCode).toBe(400);
    });
    test('utilisateur : sa structure_id est forcée', async () => {
        ProjectModel.create.mockResolvedValue({ id: 10, structure_id: 5 });
        const res = mockRes();
        await ctrl.createProject(mockReq({
            user: { id: 1, role: 'utilisateur', structure_id: 5 },
            body: { title: 'P', structure_id: 999 }
        }), res, mockNext());
        expect(ProjectModel.create).toHaveBeenCalled();
        const payload = ProjectModel.create.mock.calls[0][0];
        expect(payload.structure_id).toBe(5); // forcé
        expect(payload.created_by_user_id).toBe(1);
    });
    test('auto-assign structure principale après création', async () => {
        ProjectModel.create.mockResolvedValue({ id: 10, structure_id: 5 });
        await ctrl.createProject(mockReq({
            user: { id: 1, role: 'admin' },
            body: { title: 'P', structure_id: 5 }
        }), mockRes(), mockNext());
        expect(ProjectStructure.assignStructure).toHaveBeenCalledWith(10, 5, 1);
    });
});

describe('updateProgress', () => {
    test('400 si pourcentage invalide', async () => {
        const res = mockRes();
        await ctrl.updateProgress(mockReq({ params: { id: '1' }, body: { progress_percentage: 150 } }), res, mockNext());
        expect(res.statusCode).toBe(400);
    });
    test('400 si manquant', async () => {
        const res = mockRes();
        await ctrl.updateProgress(mockReq({ params: { id: '1' }, body: {} }), res, mockNext());
        expect(res.statusCode).toBe(400);
    });
    test('404 si projet introuvable', async () => {
        ProjectModel.updateProgress.mockResolvedValue(undefined);
        const res = mockRes();
        await ctrl.updateProgress(mockReq({ params: { id: '1' }, body: { progress_percentage: 50 } }), res, mockNext());
        expect(res.statusCode).toBe(404);
    });
    test('200 succès', async () => {
        ProjectModel.updateProgress.mockResolvedValue({ id: 1 });
        const res = mockRes();
        await ctrl.updateProgress(mockReq({ params: { id: '1' }, body: { progress_percentage: 50 } }), res, mockNext());
        expect(res.statusCode).toBe(200);
    });
});

describe('deleteProject', () => {
    test('404 si inexistant', async () => {
        ProjectModel.findById.mockResolvedValue(null);
        const res = mockRes();
        await ctrl.deleteProject(mockReq({ params: { id: '1' }, user: { role: 'admin' } }), res, mockNext());
        expect(res.statusCode).toBe(404);
    });
    test('403 si utilisateur d\'une autre structure', async () => {
        ProjectModel.findById.mockResolvedValue({ id: 1, structure_id: 9 });
        const res = mockRes();
        await ctrl.deleteProject(
            mockReq({ params: { id: '1' }, user: { role: 'utilisateur', structure_id: 5 } }),
            res, mockNext()
        );
        expect(res.statusCode).toBe(403);
    });
    test('admin : soft delete ok', async () => {
        ProjectModel.findById.mockResolvedValue({ id: 1, structure_id: 9 });
        ProjectModel.delete.mockResolvedValue({ id: 1 });
        const res = mockRes();
        await ctrl.deleteProject(mockReq({ params: { id: '1' }, user: { role: 'admin' } }), res, mockNext());
        expect(ProjectModel.delete).toHaveBeenCalledWith('1');
        expect(res.statusCode).toBe(200);
    });
});

describe('restoreProject / hardDeleteProject', () => {
    test('restore 404 si pas dans la corbeille', async () => {
        ProjectModel.restore.mockResolvedValue(undefined);
        const res = mockRes();
        await ctrl.restoreProject(mockReq({ params: { id: '1' } }), res, mockNext());
        expect(res.statusCode).toBe(404);
    });
    test('hardDelete 404 si inexistant', async () => {
        ProjectModel.hardDelete.mockResolvedValue(undefined);
        const res = mockRes();
        await ctrl.hardDeleteProject(mockReq({ params: { id: '1' } }), res, mockNext());
        expect(res.statusCode).toBe(404);
    });
});

describe('getStats', () => {
    test('commandement_territorial → getStatsByTerritory', async () => {
        ProjectModel.getStatsByTerritory.mockResolvedValue({});
        await ctrl.getStats(mockReq({
            user: { role: 'commandement_territorial', territorial_level: 'region', territorial_value: 'Dakar' }
        }), mockRes(), mockNext());
        expect(ProjectModel.getStatsByTerritory).toHaveBeenCalledWith('region', 'Dakar');
    });
    test('utilisateur → getStats avec sa structure', async () => {
        ProjectModel.getStats.mockResolvedValue({});
        await ctrl.getStats(mockReq({ user: { role: 'utilisateur', structure_id: 3 } }), mockRes(), mockNext());
        expect(ProjectModel.getStats).toHaveBeenCalledWith(3);
    });
    test('admin → getStats avec query.structure_id', async () => {
        ProjectModel.getStats.mockResolvedValue({});
        await ctrl.getStats(mockReq({ user: { role: 'admin' }, query: { structure_id: '7' } }), mockRes(), mockNext());
        expect(ProjectModel.getStats).toHaveBeenCalledWith('7');
    });
});
