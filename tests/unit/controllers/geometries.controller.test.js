jest.mock('../../../src/models/geometry.model', () => ({
    findByProjectId: jest.fn(),
    findById: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    importGeoJSON: jest.fn(),
}));
jest.mock('../../../src/utils/projectAccess', () => ({
    canUserAccessProject: jest.fn(),
    canUserModifyProject: jest.fn(),
}));

const GeometryModel = require('../../../src/models/geometry.model');
const { canUserAccessProject, canUserModifyProject } = require('../../../src/utils/projectAccess');
const ctrl = require('../../../src/controllers/geometries.controller');
const { mockReq, mockRes, mockNext } = require('../../helpers/http');

beforeEach(() => jest.clearAllMocks());

describe('geometries.list', () => {
    test('400 si projectId invalide', async () => {
        const res = mockRes();
        await ctrl.list(mockReq({ params: { projectId: 'abc' } }), res, mockNext());
        expect(res.statusCode).toBe(400);
    });
    test('403 si pas d\'accès', async () => {
        canUserAccessProject.mockResolvedValue(false);
        const res = mockRes();
        await ctrl.list(mockReq({ params: { projectId: '1' }, user: {} }), res, mockNext());
        expect(res.statusCode).toBe(403);
    });
    test('200 liste', async () => {
        canUserAccessProject.mockResolvedValue(true);
        GeometryModel.findByProjectId.mockResolvedValue([{ id: 1 }]);
        const res = mockRes();
        await ctrl.list(mockReq({ params: { projectId: '5' }, user: {} }), res, mockNext());
        expect(res.body.count).toBe(1);
    });
});

describe('geometries.create', () => {
    test('403 sans accès', async () => {
        canUserModifyProject.mockResolvedValue(false);
        const res = mockRes();
        await ctrl.create(mockReq({ params: { projectId: '1' }, user: {} }), res, mockNext());
        expect(res.statusCode).toBe(403);
    });
    test('201 succès', async () => {
        canUserModifyProject.mockResolvedValue(true);
        GeometryModel.create.mockResolvedValue({ id: 99 });
        const res = mockRes();
        await ctrl.create(mockReq({
            params: { projectId: '1' }, user: { id: 7 }, body: { kind: 'linestring' }
        }), res, mockNext());
        expect(res.statusCode).toBe(201);
        expect(GeometryModel.create).toHaveBeenCalledWith(1, { kind: 'linestring' }, 7);
    });
});

describe('geometries.update', () => {
    test('404 si la géométrie n\'appartient pas au projet', async () => {
        canUserModifyProject.mockResolvedValue(true);
        GeometryModel.findById.mockResolvedValue({ id: 5, project_id: 999 });
        const res = mockRes();
        await ctrl.update(mockReq({ params: { projectId: '1', geomId: '5' }, user: {}, body: {} }), res, mockNext());
        expect(res.statusCode).toBe(404);
    });
    test('200 succès', async () => {
        canUserModifyProject.mockResolvedValue(true);
        GeometryModel.findById.mockResolvedValue({ id: 5, project_id: 1 });
        GeometryModel.update.mockResolvedValue({ id: 5 });
        const res = mockRes();
        await ctrl.update(mockReq({ params: { projectId: '1', geomId: '5' }, user: {}, body: { name: 'X' } }), res, mockNext());
        expect(res.statusCode).toBe(200);
    });
});

describe('geometries.remove', () => {
    test('404 si appartient à un autre projet', async () => {
        canUserModifyProject.mockResolvedValue(true);
        GeometryModel.findById.mockResolvedValue({ id: 5, project_id: 999 });
        const res = mockRes();
        await ctrl.remove(mockReq({ params: { projectId: '1', geomId: '5' }, user: {} }), res, mockNext());
        expect(res.statusCode).toBe(404);
        expect(GeometryModel.remove).not.toHaveBeenCalled();
    });
    test('200 succès', async () => {
        canUserModifyProject.mockResolvedValue(true);
        GeometryModel.findById.mockResolvedValue({ id: 5, project_id: 1 });
        const res = mockRes();
        await ctrl.remove(mockReq({ params: { projectId: '1', geomId: '5' }, user: {} }), res, mockNext());
        expect(res.statusCode).toBe(200);
        expect(GeometryModel.remove).toHaveBeenCalledWith(5);
    });
});

describe('geometries.importGeoJSON', () => {
    test('400 si projectId invalide', async () => {
        const res = mockRes();
        await ctrl.importGeoJSON(mockReq({ params: { projectId: 'xxx' } }), res, mockNext());
        expect(res.statusCode).toBe(400);
    });
    test('201 avec compteurs', async () => {
        canUserModifyProject.mockResolvedValue(true);
        GeometryModel.importGeoJSON.mockResolvedValue({
            imported: [{ id: 1 }, { id: 2 }],
            skipped: [{ index: 0, reason: 'x' }]
        });
        const res = mockRes();
        await ctrl.importGeoJSON(mockReq({ params: { projectId: '1' }, user: { id: 7 }, body: {} }), res, mockNext());
        expect(res.statusCode).toBe(201);
        expect(res.body.count).toBe(2);
        expect(res.body.skipped_count).toBe(1);
    });
});
