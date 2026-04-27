jest.mock('../../../src/config/db', () => require('../../helpers/db').createDbMock());

const db = require('../../../src/config/db');
const DashboardModel = require('../../../src/models/dashboard.model');

beforeEach(() => jest.clearAllMocks());

describe('DashboardModel.getMetrics', () => {
    test('sans structureId : pas de param', async () => {
        db.query
            .mockResolvedValueOnce({ rows: [{ total_projects: 3 }] })
            .mockResolvedValueOnce({ rows: [{ total_sites: '7' }] });
        const r = await DashboardModel.getMetrics();
        expect(r.total_sites).toBe(7);
        expect(r.total_stakeholders).toBe(0);
        expect(db.query.mock.calls[0][1]).toEqual([]);
    });

    test('avec structureId : filtre via project_structures', async () => {
        db.query
            .mockResolvedValueOnce({ rows: [{ total_projects: 1 }] })
            .mockResolvedValueOnce({ rows: [{ total_sites: '2' }] });
        await DashboardModel.getMetrics(5);
        expect(db.query.mock.calls[0][0]).toMatch(/project_structures/);
        expect(db.query.mock.calls[0][1]).toEqual([5]);
        expect(db.query.mock.calls[1][1]).toEqual([5]);
    });
});

describe('DashboardModel.getMapData', () => {
    test('n\'inclut que sites avec lat/lng et projets non supprimés', async () => {
        db.query.mockResolvedValueOnce({ rows: [] });
        await DashboardModel.getMapData();
        const q = db.query.mock.calls[0][0];
        expect(q).toMatch(/latitude IS NOT NULL AND s.longitude IS NOT NULL/);
        expect(q).toMatch(/p.deleted_at IS NULL/);
    });
});

describe('DashboardModel.getRecentProjects', () => {
    test('limit par défaut 10, structure optionnelle', async () => {
        db.query.mockResolvedValueOnce({ rows: [] });
        await DashboardModel.getRecentProjects();
        expect(db.query.mock.calls[0][1]).toEqual([10]);
    });
    test('avec structureId : filtre dur via project_structures', async () => {
        db.query.mockResolvedValueOnce({ rows: [] });
        await DashboardModel.getRecentProjects(5, 3);
        expect(db.query.mock.calls[0][1]).toEqual([3, 5]);
        expect(db.query.mock.calls[0][0]).toMatch(/p\.id IN \(SELECT project_id FROM project_structures/);
    });
    test('avec preferredStructureId : tri par tier (principale > secondaire > autres)', async () => {
        db.query.mockResolvedValueOnce({ rows: [] });
        await DashboardModel.getRecentProjects(5, null, 7);
        const [q, params] = db.query.mock.calls[0];
        // Tri SQL avec CASE
        expect(q).toMatch(/CASE/);
        expect(q).toMatch(/p\.structure_id = \$1/);
        expect(q).toMatch(/EXISTS \(\s*SELECT 1 FROM project_structures/);
        expect(params).toEqual([7, 5]);
    });
    test('structureId prioritaire sur preferredStructureId', async () => {
        db.query.mockResolvedValueOnce({ rows: [] });
        await DashboardModel.getRecentProjects(5, 3, 7);
        // Quand structureId est défini, on garde le filtre dur, pas le tri par tier
        expect(db.query.mock.calls[0][0]).not.toMatch(/CASE\s*WHEN p\.structure_id/);
        expect(db.query.mock.calls[0][1]).toEqual([3, 5]);
    });
});

describe('DashboardModel.getLateProjects', () => {
    test('WHERE status != termine + deadline passé', async () => {
        db.query.mockResolvedValueOnce({ rows: [] });
        await DashboardModel.getLateProjects();
        const q = db.query.mock.calls[0][0];
        expect(q).toMatch(/status != 'termine'/);
        expect(q).toMatch(/deadline_date < CURRENT_DATE/);
    });
});

describe('DashboardModel.getProgressByMonth', () => {
    test('année par défaut = année courante', async () => {
        db.query.mockResolvedValueOnce({ rows: [] });
        await DashboardModel.getProgressByMonth();
        expect(db.query.mock.calls[0][1][0]).toBe(new Date().getFullYear());
    });
});

describe('DashboardModel._territorySubquery (anti-injection)', () => {
    test('rejette niveau non autorisé', () => {
        expect(() => DashboardModel._territorySubquery('pays')).toThrow(/Invalid/);
    });
    test('accepte region/departement/arrondissement', () => {
        ['region', 'departement', 'arrondissement'].forEach(l => {
            const sub = DashboardModel._territorySubquery(l);
            expect(sub).toContain(`${l} = $1`);
        });
    });
});

describe('DashboardModel.getMetricsByTerritory', () => {
    test('rejette niveau invalide', async () => {
        await expect(DashboardModel.getMetricsByTerritory('pays', 'X'))
            .rejects.toThrow(/Invalid/);
    });
    test('accepte region', async () => {
        db.query
            .mockResolvedValueOnce({ rows: [{ total_projects: 1 }] })
            .mockResolvedValueOnce({ rows: [{ total_sites: '3' }] });
        const r = await DashboardModel.getMetricsByTerritory('region', 'Dakar');
        expect(r.total_sites).toBe(3);
        expect(r.total_stakeholders).toBe(0);
    });
});

describe('DashboardModel.getBudgetStats', () => {
    test('exclut les projets supprimés', async () => {
        db.query.mockResolvedValueOnce({ rows: [{ total_budget: 100 }] });
        await DashboardModel.getBudgetStats();
        expect(db.query.mock.calls[0][0]).toMatch(/deleted_at IS NULL/);
    });
});
