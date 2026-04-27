jest.mock('../../../src/config/db', () => require('../../helpers/db').createDbMock());
jest.mock('../../../src/models/dashboard.model', () => ({
    getMetrics: jest.fn(),
    getMetricsByTerritory: jest.fn(),
    getProjectsByStructure: jest.fn(),
    getProjectsByStructureByTerritory: jest.fn(),
    getMapData: jest.fn(),
    getMapDataByTerritory: jest.fn(),
    getRecentProjects: jest.fn(),
    getRecentProjectsByTerritory: jest.fn(),
    getLateProjects: jest.fn(),
    getLateProjectsByTerritory: jest.fn(),
    getMeasureTypes: jest.fn(),
    getMeasureTypesByTerritory: jest.fn(),
    getBudgetStats: jest.fn(),
    getBudgetStatsByTerritory: jest.fn(),
}));

const db = require('../../../src/config/db');
const DashboardModel = require('../../../src/models/dashboard.model');
const ctrl = require('../../../src/controllers/dashboard.controller');
const { mockReq, mockRes, mockNext } = require('../../helpers/http');

beforeEach(() => jest.clearAllMocks());

describe('dashboard garde-fou commandement_territorial incomplet', () => {
    const incomplete = { role: 'commandement_territorial' }; // pas de level/value
    test.each(['getMetrics', 'getProjectsByStructure', 'getMapData', 'getRecentProjects', 'getLateProjects', 'getChartData', 'getMapGeometries'])
        ('%s → 403', async (name) => {
            const res = mockRes();
            await ctrl[name](mockReq({ user: incomplete }), res, mockNext());
            expect(res.statusCode).toBe(403);
            expect(res.body.message).toMatch(/territoire/i);
        });
});

describe('dashboard.getMetrics', () => {
    test('admin → getMetrics(undefined)', async () => {
        DashboardModel.getMetrics.mockResolvedValue({});
        await ctrl.getMetrics(mockReq({ user: { role: 'admin' }, query: {} }), mockRes(), mockNext());
        expect(DashboardModel.getMetrics).toHaveBeenCalledWith(undefined);
    });
    test('utilisateur → getMetrics(structure)', async () => {
        DashboardModel.getMetrics.mockResolvedValue({});
        await ctrl.getMetrics(mockReq({ user: { role: 'utilisateur', structure_id: 5 } }), mockRes(), mockNext());
        expect(DashboardModel.getMetrics).toHaveBeenCalledWith(5);
    });
    test('commandement_territorial complet → getMetricsByTerritory', async () => {
        DashboardModel.getMetricsByTerritory.mockResolvedValue({});
        await ctrl.getMetrics(mockReq({
            user: { role: 'commandement_territorial', territorial_level: 'region', territorial_value: 'Dakar' }
        }), mockRes(), mockNext());
        expect(DashboardModel.getMetricsByTerritory).toHaveBeenCalledWith('region', 'Dakar');
    });
});

describe('dashboard.getChartData', () => {
    test('parallélise les 3 requêtes', async () => {
        DashboardModel.getProjectsByStructure.mockResolvedValue([]);
        DashboardModel.getMeasureTypes.mockResolvedValue([]);
        DashboardModel.getBudgetStats.mockResolvedValue({});
        const res = mockRes();
        await ctrl.getChartData(mockReq({ user: { role: 'admin' }, query: {} }), res, mockNext());
        expect(DashboardModel.getProjectsByStructure).toHaveBeenCalled();
        expect(DashboardModel.getMeasureTypes).toHaveBeenCalled();
        expect(DashboardModel.getBudgetStats).toHaveBeenCalled();
        expect(res.body.data).toHaveProperty('projectsByStructure');
    });
});

describe('dashboard — happy paths des autres endpoints', () => {
    test('getProjectsByStructure admin', async () => {
        DashboardModel.getProjectsByStructure.mockResolvedValue([]);
        await ctrl.getProjectsByStructure(mockReq({ user: { role: 'admin' }, query: {} }), mockRes(), mockNext());
        expect(DashboardModel.getProjectsByStructure).toHaveBeenCalled();
    });
    test('getProjectsByStructure commandement → territory', async () => {
        DashboardModel.getProjectsByStructureByTerritory.mockResolvedValue([]);
        await ctrl.getProjectsByStructure(mockReq({
            user: { role: 'commandement_territorial', territorial_level: 'region', territorial_value: 'Dakar' }
        }), mockRes(), mockNext());
        expect(DashboardModel.getProjectsByStructureByTerritory).toHaveBeenCalled();
    });

    test('getMapData admin', async () => {
        DashboardModel.getMapData.mockResolvedValue([]);
        const res = mockRes();
        await ctrl.getMapData(mockReq({ user: { role: 'admin' }, query: {} }), res, mockNext());
        expect(res.body.count).toBe(0);
    });
    test('getMapData commandement', async () => {
        DashboardModel.getMapDataByTerritory.mockResolvedValue([]);
        await ctrl.getMapData(mockReq({
            user: { role: 'commandement_territorial', territorial_level: 'region', territorial_value: 'Dakar' }
        }), mockRes(), mockNext());
        expect(DashboardModel.getMapDataByTerritory).toHaveBeenCalled();
    });
    test('getMapData utilisateur', async () => {
        DashboardModel.getMapData.mockResolvedValue([]);
        await ctrl.getMapData(mockReq({ user: { role: 'utilisateur', structure_id: 3 } }), mockRes(), mockNext());
        expect(DashboardModel.getMapData).toHaveBeenCalledWith(3);
    });

    test('getRecentProjects admin + limit', async () => {
        DashboardModel.getRecentProjects.mockResolvedValue([]);
        await ctrl.getRecentProjects(mockReq({ user: { role: 'admin' }, query: { limit: 5 } }), mockRes(), mockNext());
        expect(DashboardModel.getRecentProjects).toHaveBeenCalledWith(5, undefined);
    });
    test('getRecentProjects commandement', async () => {
        DashboardModel.getRecentProjectsByTerritory.mockResolvedValue([]);
        await ctrl.getRecentProjects(mockReq({
            user: { role: 'commandement_territorial', territorial_level: 'region', territorial_value: 'Dakar' },
            query: {}
        }), mockRes(), mockNext());
        expect(DashboardModel.getRecentProjectsByTerritory).toHaveBeenCalled();
    });

    test('getLateProjects admin', async () => {
        DashboardModel.getLateProjects.mockResolvedValue([]);
        await ctrl.getLateProjects(mockReq({ user: { role: 'admin' }, query: {} }), mockRes(), mockNext());
        expect(DashboardModel.getLateProjects).toHaveBeenCalled();
    });
    test('getLateProjects commandement', async () => {
        DashboardModel.getLateProjectsByTerritory.mockResolvedValue([]);
        await ctrl.getLateProjects(mockReq({
            user: { role: 'commandement_territorial', territorial_level: 'region', territorial_value: 'Dakar' }
        }), mockRes(), mockNext());
        expect(DashboardModel.getLateProjectsByTerritory).toHaveBeenCalled();
    });

    test('getChartData commandement utilise les variantes territoriales', async () => {
        DashboardModel.getProjectsByStructureByTerritory.mockResolvedValue([]);
        DashboardModel.getMeasureTypesByTerritory.mockResolvedValue([]);
        DashboardModel.getBudgetStatsByTerritory.mockResolvedValue({});
        await ctrl.getChartData(mockReq({
            user: { role: 'commandement_territorial', territorial_level: 'region', territorial_value: 'Dakar' }
        }), mockRes(), mockNext());
        expect(DashboardModel.getProjectsByStructureByTerritory).toHaveBeenCalled();
        expect(DashboardModel.getMeasureTypesByTerritory).toHaveBeenCalled();
        expect(DashboardModel.getBudgetStatsByTerritory).toHaveBeenCalled();
    });
});

describe('dashboard.getMapGeometries — filtrage par rôle', () => {
    test('utilisateur sans structure → renvoie liste vide', async () => {
        const res = mockRes();
        await ctrl.getMapGeometries(mockReq({ user: { role: 'utilisateur' } }), res, mockNext());
        expect(res.body.count).toBe(0);
        expect(db.query).not.toHaveBeenCalled();
    });
    test('utilisateur avec structure → filtre par project_structures', async () => {
        db.query.mockResolvedValue({ rows: [{ id: 1 }] });
        await ctrl.getMapGeometries(mockReq({ user: { role: 'utilisateur', structure_id: 5 } }), mockRes(), mockNext());
        const [q, params] = db.query.mock.calls[0];
        expect(q).toMatch(/project_structures/);
        expect(params).toEqual([5]);
    });
    test('admin → pas de filtre', async () => {
        db.query.mockResolvedValue({ rows: [] });
        await ctrl.getMapGeometries(mockReq({ user: { role: 'admin' } }), mockRes(), mockNext());
        expect(db.query.mock.calls[0][1]).toEqual([]);
    });
    test('commandement_territorial : level non autorisé → liste vide', async () => {
        const res = mockRes();
        await ctrl.getMapGeometries(mockReq({
            user: { role: 'commandement_territorial', territorial_level: 'pays', territorial_value: 'X' }
        }), res, mockNext());
        expect(res.body.count).toBe(0);
    });
    test('commandement_territorial valide → filtre localities/sites', async () => {
        db.query.mockResolvedValue({ rows: [] });
        await ctrl.getMapGeometries(mockReq({
            user: { role: 'commandement_territorial', territorial_level: 'region', territorial_value: 'Dakar' }
        }), mockRes(), mockNext());
        const [q, params] = db.query.mock.calls[0];
        expect(q).toMatch(/EXISTS.*FROM localities/);
        expect(params).toEqual(['Dakar']);
    });
    test('lecteur scopé → project_structures', async () => {
        db.query.mockResolvedValue({ rows: [] });
        await ctrl.getMapGeometries(mockReq({
            user: { role: 'lecteur', structure_id: 3 }
        }), mockRes(), mockNext());
        expect(db.query.mock.calls[0][1]).toEqual([3]);
    });
    test('directeur : lecture globale, pas de filtre structure', async () => {
        db.query.mockResolvedValue({ rows: [] });
        await ctrl.getMapGeometries(mockReq({
            user: { role: 'directeur', structure_id: 7 }
        }), mockRes(), mockNext());
        // Plus de filtre structure pour directeur — il voit tout
        expect(db.query.mock.calls[0][1]).toEqual([]);
    });
});
