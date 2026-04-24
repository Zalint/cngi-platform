jest.mock('../../../src/models/decoupage.model', () => ({
    getRegions: jest.fn(),
    getDepartements: jest.fn(),
    getArrondissements: jest.fn(),
    getCommunes: jest.fn(),
    getAllByLevel: jest.fn(),
    search: jest.fn(),
    getAll: jest.fn(),
    getStats: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    matchByNames: jest.fn(),
}));

const DecoupageModel = require('../../../src/models/decoupage.model');
const ctrl = require('../../../src/controllers/decoupage.controller');
const { mockReq, mockRes, mockNext } = require('../../helpers/http');

beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
});

afterEach(() => {
    delete global.fetch;
});

describe('decoupage.getDepartements / getArrondissements / getCommunes', () => {
    test('getDepartements 400 sans region', async () => {
        const res = mockRes();
        await ctrl.getDepartements(mockReq({ query: {} }), res, mockNext());
        expect(res.statusCode).toBe(400);
    });
    test('getDepartements OK', async () => {
        DecoupageModel.getDepartements.mockResolvedValue(['Pikine']);
        const res = mockRes();
        await ctrl.getDepartements(mockReq({ query: { region: 'Dakar' } }), res, mockNext());
        expect(res.body.count).toBe(1);
    });
    test('getArrondissements 400 sans departement', async () => {
        const res = mockRes();
        await ctrl.getArrondissements(mockReq({ query: {} }), res, mockNext());
        expect(res.statusCode).toBe(400);
    });
    test('getCommunes 400 sans arrondissement', async () => {
        const res = mockRes();
        await ctrl.getCommunes(mockReq({ query: {} }), res, mockNext());
        expect(res.statusCode).toBe(400);
    });
});

describe('decoupage.search', () => {
    test('retourne [] si q < 2', async () => {
        const res = mockRes();
        await ctrl.search(mockReq({ query: { q: 'a' } }), res, mockNext());
        expect(res.body.data).toEqual([]);
        expect(DecoupageModel.search).not.toHaveBeenCalled();
    });
    test('appelle search si q ≥ 2', async () => {
        DecoupageModel.search.mockResolvedValue([{ region: 'A' }]);
        const res = mockRes();
        await ctrl.search(mockReq({ query: { q: 'dak' } }), res, mockNext());
        expect(res.body.data).toHaveLength(1);
    });
});

describe('decoupage.create', () => {
    test('400 si champ manquant', async () => {
        const res = mockRes();
        await ctrl.create(mockReq({ body: { region: 'A' } }), res, mockNext());
        expect(res.statusCode).toBe(400);
    });
    test('409 si ON CONFLICT a retourné undefined', async () => {
        DecoupageModel.create.mockResolvedValue(undefined);
        const res = mockRes();
        await ctrl.create(mockReq({
            body: { region: 'A', departement: 'B', arrondissement: 'C', commune: 'D' }
        }), res, mockNext());
        expect(res.statusCode).toBe(409);
    });
    test('201 si créé', async () => {
        DecoupageModel.create.mockResolvedValue({ id: 1 });
        const res = mockRes();
        await ctrl.create(mockReq({
            body: { region: 'A', departement: 'B', arrondissement: 'C', commune: 'D' }
        }), res, mockNext());
        expect(res.statusCode).toBe(201);
    });
});

describe('decoupage.bulkImport', () => {
    test('400 si pas un tableau', async () => {
        const res = mockRes();
        await ctrl.bulkImport(mockReq({ body: null }), res, mockNext());
        expect(res.statusCode).toBe(400);
    });
    test('compte created/skipped et collecte les erreurs', async () => {
        DecoupageModel.create
            .mockResolvedValueOnce({ id: 1 })
            .mockResolvedValueOnce(undefined); // ON CONFLICT
        const res = mockRes();
        await ctrl.bulkImport(mockReq({
            body: [
                { region: 'A', departement: 'B', arrondissement: 'C', commune: 'D' },
                { region: 'A', departement: 'B', arrondissement: 'C', commune: 'D' },
                { region: 'A' }, // champ manquant
            ]
        }), res, mockNext());
        expect(res.body.data.created).toBe(1);
        expect(res.body.data.skipped).toBe(2);
        expect(res.body.data.errors).toHaveLength(1);
    });
});

describe('decoupage.reverseGeocode', () => {
    test('400 si lat/lon invalides', async () => {
        const res = mockRes();
        await ctrl.reverseGeocode(mockReq({ query: {} }), res, mockNext());
        expect(res.statusCode).toBe(400);
    });
    test('fallback si Nominatim échoue', async () => {
        global.fetch.mockRejectedValue(new Error('network down'));
        const res = mockRes();
        await ctrl.reverseGeocode(mockReq({ query: { lat: '14.7', lon: '-17.4' } }), res, mockNext());
        expect(res.body.source).toBe('none');
        expect(res.body.error).toMatch(/network/);
    });
    test('happy path appelle matchByNames', async () => {
        global.fetch.mockResolvedValue({
            ok: true,
            json: async () => ({ address: { state: 'Dakar', city: 'Dakar' }, display_name: 'x' })
        });
        DecoupageModel.matchByNames.mockResolvedValue({ region: 'Dakar', departement: null, arrondissement: null, commune: null });
        const res = mockRes();
        await ctrl.reverseGeocode(mockReq({ query: { lat: '14.7', lon: '-17.4' } }), res, mockNext());
        expect(res.body.source).toBe('nominatim');
        expect(res.body.data.region).toBe('Dakar');
    });
});

describe('decoupage happy paths simples', () => {
    test('getRegions', async () => {
        DecoupageModel.getRegions.mockResolvedValue(['Dakar', 'Thiès']);
        const res = mockRes();
        await ctrl.getRegions(mockReq(), res, mockNext());
        expect(res.body.count).toBe(2);
    });
    test('getAllByLevel', async () => {
        DecoupageModel.getAllByLevel.mockResolvedValue(['A']);
        const res = mockRes();
        await ctrl.getAllByLevel(mockReq({ params: { level: 'region' } }), res, mockNext());
        expect(res.body.data).toEqual(['A']);
    });
    test('getArrondissements OK', async () => {
        DecoupageModel.getArrondissements.mockResolvedValue(['X']);
        const res = mockRes();
        await ctrl.getArrondissements(mockReq({ query: { departement: 'D' } }), res, mockNext());
        expect(res.body.count).toBe(1);
    });
    test('getCommunes OK', async () => {
        DecoupageModel.getCommunes.mockResolvedValue(['C']);
        const res = mockRes();
        await ctrl.getCommunes(mockReq({ query: { arrondissement: 'A' } }), res, mockNext());
        expect(res.body.count).toBe(1);
    });
    test('getAll', async () => {
        DecoupageModel.getAll.mockResolvedValue({
            data: [{ id: 1 }], pagination: { total: 1, page: 1, limit: 50, totalPages: 1 }
        });
        const res = mockRes();
        await ctrl.getAll(mockReq({ query: { region: 'Dakar' } }), res, mockNext());
        expect(res.body.count).toBe(1);
        expect(res.body.pagination.total).toBe(1);
    });
    test('getStats', async () => {
        DecoupageModel.getStats.mockResolvedValue({ total_regions: 14 });
        const res = mockRes();
        await ctrl.getStats(mockReq(), res, mockNext());
        expect(res.body.data.total_regions).toBe(14);
    });
    test('update 404', async () => {
        DecoupageModel.update.mockResolvedValue(undefined);
        const res = mockRes();
        await ctrl.update(mockReq({ params: { id: '1' }, body: {} }), res, mockNext());
        expect(res.statusCode).toBe(404);
    });
    test('update 200', async () => {
        DecoupageModel.update.mockResolvedValue({ id: 1 });
        const res = mockRes();
        await ctrl.update(mockReq({ params: { id: '1' }, body: { region: 'X' } }), res, mockNext());
        expect(res.statusCode).toBe(200);
    });
    test('delete 404', async () => {
        DecoupageModel.delete.mockResolvedValue(undefined);
        const res = mockRes();
        await ctrl.delete(mockReq({ params: { id: '1' } }), res, mockNext());
        expect(res.statusCode).toBe(404);
    });
    test('delete 200', async () => {
        DecoupageModel.delete.mockResolvedValue({ id: 1 });
        const res = mockRes();
        await ctrl.delete(mockReq({ params: { id: '1' } }), res, mockNext());
        expect(res.statusCode).toBe(200);
    });
    test('reverseGeocode : Nominatim HTTP non-ok → fallback', async () => {
        global.fetch.mockResolvedValue({ ok: false, status: 500 });
        const res = mockRes();
        await ctrl.reverseGeocode(mockReq({ query: { lat: '14', lon: '-17' } }), res, mockNext());
        expect(res.body.source).toBe('none');
    });
    test('forwardGeocode OK retourne la liste', async () => {
        global.fetch.mockResolvedValue({ ok: true, json: async () => [{ display_name: 'X' }] });
        const res = mockRes();
        await ctrl.forwardGeocode(mockReq({ query: { q: 'dakar' } }), res, mockNext());
        expect(res.body.data).toHaveLength(1);
    });
    test('forwardGeocode HTTP non-ok', async () => {
        global.fetch.mockResolvedValue({ ok: false, status: 500 });
        const res = mockRes();
        await ctrl.forwardGeocode(mockReq({ query: { q: 'dakar' } }), res, mockNext());
        expect(res.body.data).toEqual([]);
        expect(res.body.error).toMatch(/Nominatim/);
    });
});

describe('decoupage.forwardGeocode', () => {
    test('retourne [] si q < 3', async () => {
        const res = mockRes();
        await ctrl.forwardGeocode(mockReq({ query: { q: 'ab' } }), res, mockNext());
        expect(res.body.data).toEqual([]);
    });
    test('erreur réseau → data:[] + error', async () => {
        global.fetch.mockRejectedValue(new Error('down'));
        const res = mockRes();
        await ctrl.forwardGeocode(mockReq({ query: { q: 'dakar' } }), res, mockNext());
        expect(res.body.data).toEqual([]);
        expect(res.body.error).toMatch(/down/);
    });
});
