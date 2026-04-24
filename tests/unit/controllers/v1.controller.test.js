jest.mock('../../../src/models/project.model', () => ({
    findAll: jest.fn(),
    findById: jest.fn(),
    findByTerritory: jest.fn(),
}));
jest.mock('../../../src/models/projectStructure.model', () => ({
    getProjectsByStructure: jest.fn(),
}));
jest.mock('../../../src/models/structure.model', () => ({
    findAll: jest.fn(),
}));
jest.mock('../../../src/models/dashboard.model', () => ({}));
jest.mock('../../../src/models/observation.model', () => ({
    findAll: jest.fn(),
    findById: jest.fn(),
}));
jest.mock('../../../src/models/pv.model', () => ({
    findAllVisible: jest.fn(),
    findByIdForUser: jest.fn(),
}));
jest.mock('../../../src/utils/projectAccess', () => ({
    canUserAccessProject: jest.fn(),
}));

const ProjectModel = require('../../../src/models/project.model');
const ProjectStructure = require('../../../src/models/projectStructure.model');
const StructureModel = require('../../../src/models/structure.model');
const ObservationModel = require('../../../src/models/observation.model');
const PvModel = require('../../../src/models/pv.model');
const { canUserAccessProject } = require('../../../src/utils/projectAccess');
const ctrl = require('../../../src/controllers/v1.controller');
const { mockReq, mockRes, mockNext } = require('../../helpers/http');

beforeEach(() => jest.clearAllMocks());

describe('v1.listProjects', () => {
    test('admin → findAll, format minimal avec status_label et priority_label', async () => {
        ProjectModel.findAll.mockResolvedValue([
            { id: 1, title: 'P', structure_code: 'DPGI', status: 'en_cours', priority: 'haute', progress_percentage: 30 }
        ]);
        const res = mockRes();
        await ctrl.listProjects(mockReq({ user: { role: 'admin' }, query: {} }), res, mockNext());
        expect(res.body.data[0]).toMatchObject({
            id: 1, title: 'P', structure: 'DPGI',
            status_label: 'En cours', priority_label: 'Haute', progress_percentage: 30
        });
        expect(res.body.generated_at).toBeDefined();
    });

    test('commandement_territorial → findByTerritory', async () => {
        ProjectModel.findByTerritory.mockResolvedValue([]);
        await ctrl.listProjects(mockReq({
            user: { role: 'commandement_territorial', territorial_level: 'region', territorial_value: 'Dakar' },
            query: {}
        }), mockRes(), mockNext());
        expect(ProjectModel.findByTerritory).toHaveBeenCalledWith('region', 'Dakar');
    });

    test('utilisateur → getProjectsByStructure', async () => {
        ProjectStructure.getProjectsByStructure.mockResolvedValue([]);
        await ctrl.listProjects(mockReq({
            user: { role: 'utilisateur', structure_id: 5 }, query: {}
        }), mockRes(), mockNext());
        expect(ProjectStructure.getProjectsByStructure).toHaveBeenCalledWith(5);
    });

    test('filtre structure (case-insensitive)', async () => {
        ProjectModel.findAll.mockResolvedValue([
            { id: 1, structure_code: 'DPGI', status: 'en_cours', priority: 'normale' },
            { id: 2, structure_code: 'DGIE', status: 'en_cours', priority: 'normale' },
        ]);
        const res = mockRes();
        await ctrl.listProjects(mockReq({
            user: { role: 'admin' }, query: { structure: 'dpgi' }
        }), res, mockNext());
        expect(res.body.count).toBe(1);
        expect(res.body.data[0].id).toBe(1);
    });

    test('filtre combiné status + priority + project_type', async () => {
        ProjectModel.findAll.mockResolvedValue([
            { id: 1, status: 'en_cours', priority: 'haute', project_type: 'structurant' },
            { id: 2, status: 'en_cours', priority: 'normale', project_type: 'structurant' },
        ]);
        const res = mockRes();
        await ctrl.listProjects(mockReq({
            user: { role: 'admin' },
            query: { status: 'en_cours', priority: 'haute', project_type: 'structurant' }
        }), res, mockNext());
        expect(res.body.count).toBe(1);
    });

    test('detail=full charge les détails via findById', async () => {
        ProjectModel.findAll.mockResolvedValue([{ id: 1 }]);
        ProjectModel.findById.mockResolvedValue({
            id: 1, title: 'P', budget: '500', sites: [{ id: 10, name: 'S' }],
            measures: [], assigned_structures: [{ code: 'DPGI', name: 'X' }]
        });
        const res = mockRes();
        await ctrl.listProjects(mockReq({ user: { role: 'admin' }, query: { detail: 'full' } }), res, mockNext());
        expect(ProjectModel.findById).toHaveBeenCalledWith(1);
        expect(res.body.data[0].budget).toBe(500);
        expect(res.body.data[0].sites).toHaveLength(1);
        expect(res.body.data[0].assigned_structures).toEqual([{ code: 'DPGI', name: 'X' }]);
    });

    test('detail=full filtre les findById retournant null', async () => {
        ProjectModel.findAll.mockResolvedValue([{ id: 1 }, { id: 2 }]);
        ProjectModel.findById.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 2 });
        const res = mockRes();
        await ctrl.listProjects(mockReq({ user: { role: 'admin' }, query: { detail: 'full' } }), res, mockNext());
        expect(res.body.count).toBe(1);
    });
});

describe('v1.getProject', () => {
    test('404', async () => {
        ProjectModel.findById.mockResolvedValue(null);
        const res = mockRes();
        await ctrl.getProject(mockReq({ params: { id: '1' }, user: {} }), res, mockNext());
        expect(res.statusCode).toBe(404);
        expect(res.body.error).toBe('not_found');
    });
    test('403 sans accès', async () => {
        ProjectModel.findById.mockResolvedValue({ id: 1 });
        canUserAccessProject.mockResolvedValue(false);
        const res = mockRes();
        await ctrl.getProject(mockReq({ params: { id: '1' }, user: {} }), res, mockNext());
        expect(res.statusCode).toBe(403);
        expect(res.body.error).toBe('forbidden');
    });
    test('200 full DTO', async () => {
        ProjectModel.findById.mockResolvedValue({ id: 1, title: 'P', status: 'en_cours', budget: '100' });
        canUserAccessProject.mockResolvedValue(true);
        const res = mockRes();
        await ctrl.getProject(mockReq({ params: { id: '1' }, user: {} }), res, mockNext());
        expect(res.body.data.budget).toBe(100);
    });
});

describe('v1.getStats', () => {
    test('agrège par statut, priorité, structure, avg_progress', async () => {
        ProjectModel.findAll.mockResolvedValue([
            { status: 'en_cours', priority: 'haute', structure_code: 'DPGI', progress_percentage: 40 },
            { status: 'en_cours', priority: 'normale', structure_code: 'DPGI', progress_percentage: 60 },
            { status: 'termine', priority: 'urgente', structure_code: null, progress_percentage: 100 },
        ]);
        const res = mockRes();
        await ctrl.getStats(mockReq({ user: { role: 'admin' }, query: {} }), res, mockNext());
        expect(res.body.data.total).toBe(3);
        expect(res.body.data.by_status.en_cours).toBe(2);
        expect(res.body.data.by_priority.haute).toBe(1);
        expect(res.body.data.by_structure.DPGI).toBe(2);
        expect(res.body.data.by_structure.INCONNU).toBe(1);
        expect(res.body.data.avg_progress).toBe(67);
    });
    test('avg_progress = 0 si aucun projet', async () => {
        ProjectModel.findAll.mockResolvedValue([]);
        const res = mockRes();
        await ctrl.getStats(mockReq({ user: { role: 'admin' }, query: {} }), res, mockNext());
        expect(res.body.data.avg_progress).toBe(0);
    });
});

describe('v1.listStructures', () => {
    test('renvoie id/code/name/description', async () => {
        StructureModel.findAll.mockResolvedValue([{ id: 1, code: 'DPGI', name: 'X', description: 'd', other: 'masqué' }]);
        const res = mockRes();
        await ctrl.listStructures(mockReq(), res, mockNext());
        expect(res.body.data[0]).toEqual({ id: 1, code: 'DPGI', name: 'X', description: 'd' });
    });
});

describe('v1.listObservations / getObservation', () => {
    test('listObservations applique les filtres', async () => {
        ObservationModel.findAll.mockResolvedValue([{ id: 1, author_first_name: 'J', author_last_name: 'D' }]);
        const res = mockRes();
        await ctrl.listObservations(mockReq({ query: { project_id: '5', priority: 'urgente' } }), res, mockNext());
        expect(ObservationModel.findAll).toHaveBeenCalledWith({ project_id: '5', priority: 'urgente', scope: undefined });
        expect(res.body.data[0].author).toBe('J D');
    });
    test('getObservation 404', async () => {
        ObservationModel.findById.mockResolvedValue(null);
        const res = mockRes();
        await ctrl.getObservation(mockReq({ params: { id: '1' } }), res, mockNext());
        expect(res.statusCode).toBe(404);
    });
});

describe('v1.listPvs / getPv', () => {
    test('listPvs mappe via DTO', async () => {
        PvModel.findAllVisible.mockResolvedValue([{
            id: 1, title: 'PV', author_first_name: 'A', author_last_name: 'B',
            projects: [{ id: 10, title: 'P' }], sites: [], localities: [], measures: []
        }]);
        const res = mockRes();
        await ctrl.listPvs(mockReq({ user: {} }), res, mockNext());
        expect(res.body.data[0].author).toBe('A B');
        expect(res.body.data[0].projects).toEqual([{ id: 10, title: 'P' }]);
    });
    test('getPv 404', async () => {
        PvModel.findByIdForUser.mockResolvedValue(null);
        const res = mockRes();
        await ctrl.getPv(mockReq({ params: { id: '1' }, user: {} }), res, mockNext());
        expect(res.statusCode).toBe(404);
    });
});

describe('v1.openapi', () => {
    test('retourne une spec OpenAPI 3.0.3 valide', () => {
        const res = mockRes();
        const req = {
            protocol: 'https',
            get: (h) => h === 'host' ? 'api.example.com' : null,
        };
        ctrl.openapi(req, res);
        expect(res.body.openapi).toBe('3.0.3');
        expect(res.body.servers[0].url).toBe('https://api.example.com/api/v1');
        expect(res.body.paths).toHaveProperty('/projects');
        expect(res.body.paths).toHaveProperty('/projects/{id}');
        expect(res.body.paths).toHaveProperty('/pv');
        expect(res.body.components.securitySchemes.ApiKeyAuth.name).toBe('x-api-key');
    });
});
