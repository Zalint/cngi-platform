jest.mock('../../../src/config/db', () => require('../../helpers/db').createDbMock());

const db = require('../../../src/config/db');
const DecoupageModel = require('../../../src/models/decoupage.model');

beforeEach(() => jest.clearAllMocks());

describe('DecoupageModel.getRegions / getDepartements / etc.', () => {
    test('getRegions retourne un tableau de strings', async () => {
        db.query.mockResolvedValueOnce({ rows: [{ region: 'Dakar' }, { region: 'Thiès' }] });
        expect(await DecoupageModel.getRegions()).toEqual(['Dakar', 'Thiès']);
    });
    test('getDepartements filtre par région', async () => {
        db.query.mockResolvedValueOnce({ rows: [] });
        await DecoupageModel.getDepartements('Dakar');
        expect(db.query.mock.calls[0][1]).toEqual(['Dakar']);
    });
    test('getArrondissements filtre par département', async () => {
        db.query.mockResolvedValueOnce({ rows: [] });
        await DecoupageModel.getArrondissements('Pikine');
        expect(db.query.mock.calls[0][1]).toEqual(['Pikine']);
    });
    test('getCommunes filtre par arrondissement', async () => {
        db.query.mockResolvedValueOnce({ rows: [] });
        await DecoupageModel.getCommunes('X');
        expect(db.query.mock.calls[0][1]).toEqual(['X']);
    });
});

describe('DecoupageModel.getAllByLevel (anti-injection)', () => {
    test('rejette niveau invalide', async () => {
        await expect(DecoupageModel.getAllByLevel('country')).rejects.toThrow(/Invalid/);
    });
    test('accepte region/departement/arrondissement', async () => {
        db.query.mockResolvedValue({ rows: [{ region: 'A' }] });
        expect(await DecoupageModel.getAllByLevel('region')).toEqual(['A']);
    });
});

describe('DecoupageModel.search', () => {
    test('params en ILIKE + limit', async () => {
        db.query.mockResolvedValueOnce({ rows: [] });
        await DecoupageModel.search('dak', 5);
        const params = db.query.mock.calls[0][1];
        expect(params).toEqual(['%dak%', 'dak%', 5]);
    });
});

describe('DecoupageModel.getAll pagination', () => {
    test('calcule offset et totalPages', async () => {
        db.query
            .mockResolvedValueOnce({ rows: [{ count: '25' }] })
            .mockResolvedValueOnce({ rows: [{ id: 1 }] });
        const r = await DecoupageModel.getAll({ page: 2, limit: 10 });
        expect(r.pagination.total).toBe(25);
        expect(r.pagination.totalPages).toBe(3);
        expect(r.pagination.page).toBe(2);
        // offset = (2-1)*10 = 10
        const [, params] = db.query.mock.calls[1];
        expect(params).toEqual([10, 10]);
    });
    test('applique les filtres region/departement', async () => {
        db.query
            .mockResolvedValueOnce({ rows: [{ count: '0' }] })
            .mockResolvedValueOnce({ rows: [] });
        await DecoupageModel.getAll({ region: 'Dakar', departement: 'Pikine' });
        expect(db.query.mock.calls[1][1].slice(0, 2)).toEqual(['Dakar', 'Pikine']);
    });
});

describe('DecoupageModel.create / update / delete', () => {
    test('create ON CONFLICT DO NOTHING', async () => {
        db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });
        await DecoupageModel.create({ region: 'A', departement: 'B', arrondissement: 'C', commune: 'D' });
        expect(db.query.mock.calls[0][0]).toMatch(/ON CONFLICT DO NOTHING/);
    });
    test('update avec COALESCE', async () => {
        db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });
        await DecoupageModel.update(5, { region: 'X' });
        expect(db.query.mock.calls[0][0]).toMatch(/COALESCE/);
        expect(db.query.mock.calls[0][1][4]).toBe(5);
    });
    test('delete', async () => {
        db.query.mockResolvedValueOnce({ rows: [{ id: 9 }] });
        const r = await DecoupageModel.delete(9);
        expect(r.id).toBe(9);
    });
});

describe('DecoupageModel._normalize', () => {
    test('lowercase + retire accents + trim + mono-espace', () => {
        expect(DecoupageModel._normalize('  Thiès  ')).toBe('thies');
        expect(DecoupageModel._normalize('Saint-Louis')).toBe('saint louis');
    });
    test('valeurs falsy → string vide', () => {
        expect(DecoupageModel._normalize(null)).toBe('');
    });
});

describe('DecoupageModel.matchByNames', () => {
    const fixture = {
        rows: [
            { region: 'Dakar', departement: 'Pikine', arrondissement: 'Thiaroye', commune: 'Guinaw' },
            { region: 'Thiès', departement: 'Mbour', arrondissement: 'Sindia', commune: 'Popenguine' },
        ]
    };

    test('retourne null partout si rien ne matche', async () => {
        db.query.mockResolvedValueOnce(fixture);
        const r = await DecoupageModel.matchByNames({ region: 'InconnuXYZ', commune: 'Abracadabra' });
        expect(r).toEqual({ region: null, departement: null, arrondissement: null, commune: null });
    });
    test('match exact (case-insensitive, accents)', async () => {
        db.query.mockResolvedValueOnce(fixture);
        const r = await DecoupageModel.matchByNames({ region: 'thies', commune: 'Popenguine' });
        expect(r.region).toBe('Thiès');
        expect(r.commune).toBe('Popenguine');
    });
    test('match par inclusion si pas d\'exact', async () => {
        db.query.mockResolvedValueOnce(fixture);
        const r = await DecoupageModel.matchByNames({ region: 'Dakar Region' });
        expect(r.region).toBe('Dakar');
    });
});
