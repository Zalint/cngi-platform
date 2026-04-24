jest.mock('../../../src/config/db', () => require('../../helpers/db').createDbMock());

const db = require('../../../src/config/db');
const DashboardModel = require('../../../src/models/dashboard.model');

beforeEach(() => jest.clearAllMocks());

describe('DashboardModel territory variants', () => {
    test.each([
        'getRecentProjectsByTerritory',
        'getMapDataByTerritory',
        'getProjectsByStructureByTerritory',
        'getLateProjectsByTerritory',
        'getMeasureTypesByTerritory',
        'getBudgetStatsByTerritory',
    ])('%s rejette level invalide', async (name) => {
        // getRecentProjectsByTerritory a une signature différente (avec limit)
        if (name === 'getRecentProjectsByTerritory') {
            await expect(DashboardModel[name]('pays', 'X', 10)).rejects.toThrow(/Invalid/);
        } else {
            await expect(DashboardModel[name]('pays', 'X')).rejects.toThrow(/Invalid/);
        }
    });

    test('getRecentProjectsByTerritory retourne rows', async () => {
        db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });
        const r = await DashboardModel.getRecentProjectsByTerritory('region', 'Dakar', 5);
        expect(r).toHaveLength(1);
        expect(db.query.mock.calls[0][1]).toEqual(['Dakar', 5]);
    });

    test.each([
        ['getMapDataByTerritory'],
        ['getProjectsByStructureByTerritory'],
        ['getLateProjectsByTerritory'],
        ['getMeasureTypesByTerritory'],
    ])('%s retourne rows', async (name) => {
        db.query.mockResolvedValueOnce({ rows: [] });
        await DashboardModel[name]('region', 'Dakar');
        expect(db.query.mock.calls[0][1]).toEqual(['Dakar']);
    });

    test('getBudgetStatsByTerritory retourne row[0]', async () => {
        db.query.mockResolvedValueOnce({ rows: [{ total_budget: 1000 }] });
        const r = await DashboardModel.getBudgetStatsByTerritory('region', 'Dakar');
        expect(r.total_budget).toBe(1000);
    });
});

describe('DashboardModel.getProjectsByStructure (avec/sans id)', () => {
    test('sans structureId', async () => {
        db.query.mockResolvedValueOnce({ rows: [] });
        await DashboardModel.getProjectsByStructure();
        expect(db.query.mock.calls[0][1]).toEqual([]);
    });
    test('avec structureId', async () => {
        db.query.mockResolvedValueOnce({ rows: [] });
        await DashboardModel.getProjectsByStructure(5);
        expect(db.query.mock.calls[0][1]).toEqual([5]);
    });
});

describe('DashboardModel.getMeasureTypes', () => {
    test('filtre type IS NOT NULL', async () => {
        db.query.mockResolvedValueOnce({ rows: [] });
        await DashboardModel.getMeasureTypes();
        expect(db.query.mock.calls[0][0]).toMatch(/m\.type IS NOT NULL/);
    });
    test('avec structureId', async () => {
        db.query.mockResolvedValueOnce({ rows: [] });
        await DashboardModel.getMeasureTypes(5);
        expect(db.query.mock.calls[0][1]).toEqual([5]);
    });
});
