jest.mock('../../../src/config/db', () => require('../../helpers/db').createDbMock());

const db = require('../../../src/config/db');
const GeometryModel = require('../../../src/models/geometry.model');

beforeEach(() => {
    jest.clearAllMocks();
    // Le module geometry.model met en cache la limite max de features (TTL 30s).
    // On purge le cache entre tests pour avoir un état déterministe.
    if (typeof GeometryModel.invalidateMaxFeaturesCache === 'function') {
        GeometryModel.invalidateMaxFeaturesCache();
    }
});

describe('GeometryModel validators', () => {
    test('_validateKind accepte linestring/polygon', () => {
        expect(GeometryModel._validateKind('linestring')).toBe('linestring');
        expect(GeometryModel._validateKind('polygon')).toBe('polygon');
    });
    test('_validateKind rejette autre (400)', () => {
        let err; try { GeometryModel._validateKind('point'); } catch (e) { err = e; }
        expect(err.statusCode).toBe(400);
    });
    test('_validateUsage defaults to autre', () => {
        expect(GeometryModel._validateUsage(null)).toBe('autre');
        expect(GeometryModel._validateUsage('')).toBe('autre');
    });
    test('_validateUsage rejette invalide', () => {
        let err; try { GeometryModel._validateUsage('whatever'); } catch (e) { err = e; }
        expect(err.statusCode).toBe(400);
    });
    test('_validateVulnerability defaults à normal', () => {
        expect(GeometryModel._validateVulnerability(null)).toBe('normal');
    });

    describe('_validateCoordinates', () => {
        test('rejette tableau vide', () => {
            let err; try { GeometryModel._validateCoordinates('linestring', []); } catch (e) { err = e; }
            expect(err.statusCode).toBe(400);
        });
        test('linestring < 2 points rejeté', () => {
            let err; try { GeometryModel._validateCoordinates('linestring', [[0, 0]]); } catch (e) { err = e; }
            expect(err).toBeDefined();
        });
        test('linestring OK', () => {
            expect(() => GeometryModel._validateCoordinates('linestring', [[0, 0], [1, 1]])).not.toThrow();
        });
        test('linestring point non numérique rejeté', () => {
            expect(() => GeometryModel._validateCoordinates('linestring', [[0, 0], ['a', 'b']])).toThrow();
        });
        test('polygon anneau < 4 points rejeté', () => {
            expect(() => GeometryModel._validateCoordinates('polygon', [[[0, 0], [1, 0], [0, 1]]])).toThrow();
        });
        test('polygon OK', () => {
            expect(() => GeometryModel._validateCoordinates(
                'polygon', [[[0, 0], [1, 0], [1, 1], [0, 0]]]
            )).not.toThrow();
        });
    });
});

describe('GeometryModel.create', () => {
    test('insère avec validation et JSON.stringify des coordonnées', async () => {
        db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });
        await GeometryModel.create(10, {
            kind: 'linestring',
            usage_type: 'drainage',
            coordinates: [[0, 0], [1, 1]],
            name: 'A',
        }, 7);
        const params = db.query.mock.calls[0][1];
        expect(params[0]).toBe(10);      // project_id
        expect(params[4]).toBe('linestring');
        expect(params[5]).toBe('drainage');
        expect(params[6]).toBe(JSON.stringify([[0, 0], [1, 1]]));
        expect(params[9]).toBe(7);
    });
    test('nom par défaut "Tracé sans nom"', async () => {
        db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });
        await GeometryModel.create(1, { kind: 'linestring', coordinates: [[0, 0], [1, 1]] }, 1);
        expect(db.query.mock.calls[0][1][2]).toBe('Tracé sans nom');
    });
});

describe('GeometryModel.update (PATCH-safe)', () => {
    test('idempotent si aucun champ fourni', async () => {
        db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] }); // findById fallback
        await GeometryModel.update(1, {});
        // Pas d'UPDATE — seulement findById
        expect(db.query.mock.calls[0][0]).toMatch(/SELECT/);
    });
    test('UPDATE seulement les champs présents', async () => {
        db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });
        await GeometryModel.update(1, { name: 'X' });
        const [q, params] = db.query.mock.calls[0];
        expect(q).toMatch(/UPDATE geometries SET name = \$1/);
        expect(params).toEqual(['X', 1]);
    });
    test('description:null écrit NULL (différent de absent)', async () => {
        db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });
        await GeometryModel.update(1, { description: null });
        expect(db.query.mock.calls[0][0]).toMatch(/description = \$1/);
        expect(db.query.mock.calls[0][1]).toEqual([null, 1]);
    });
    test('usage_type invalide rejeté avant SQL', async () => {
        await expect(GeometryModel.update(1, { usage_type: 'bad' })).rejects.toThrow(/usage_type/);
        expect(db.query).not.toHaveBeenCalled();
    });
});

describe('GeometryModel.importGeoJSON', () => {
    test('rejette non FeatureCollection (400)', async () => {
        await expect(GeometryModel.importGeoJSON(1, { type: 'X' }, 1)).rejects.toMatchObject({ statusCode: 400 });
    });
    test('rejette quand on dépasse la limite configurée (413)', async () => {
        // La limite est lue depuis app_config (cache 30s). On force un retour à
        // "pas de config" → le code retombe sur le défaut (2000). Pour
        // déclencher le 413, on envoie 2001 features.
        db.query.mockResolvedValueOnce({ rows: [] }); // SELECT app_config → 0 lignes
        // Important : invalider le cache pour que la requête soit faite
        if (typeof GeometryModel.invalidateMaxFeaturesCache === 'function') {
            GeometryModel.invalidateMaxFeaturesCache();
        }
        const features = Array.from({ length: 2001 }, () => ({
            type: 'Feature',
            geometry: { type: 'LineString', coordinates: [[0, 0], [1, 1]] },
            properties: {}
        }));
        await expect(GeometryModel.importGeoJSON(1, { type: 'FeatureCollection', features }, 1))
            .rejects.toMatchObject({ statusCode: 413 });
    });
    test('skip features invalides, importe le reste', async () => {
        const client = db.__client;
        db.query.mockResolvedValueOnce({ rows: [] }); // SELECT app_config (limite features)
        db.query.mockResolvedValueOnce({ rows: [{ id: 1, code: 'DPGI' }] }); // structures
        client.query
            .mockResolvedValueOnce({}) // BEGIN
            .mockResolvedValueOnce({ rows: [{ id: 100, name: 'Feat1' }] }) // INSERT first valid
            .mockResolvedValueOnce({}); // COMMIT
        const geojson = {
            type: 'FeatureCollection',
            features: [
                { type: 'Feature', geometry: { type: 'LineString', coordinates: [[0, 0], [1, 1]] }, properties: { name: 'Feat1' } },
                { type: 'Feature', geometry: { type: 'Point', coordinates: [0, 0] }, properties: { name: 'BadType' } },
                null, // feature invalide
            ]
        };
        const { imported, skipped } = await GeometryModel.importGeoJSON(10, geojson, 5);
        expect(imported).toHaveLength(1);
        expect(skipped).toHaveLength(2);
        expect(skipped[0].reason).toMatch(/non supporté/);
        expect(skipped[1].reason).toMatch(/invalide/);
    });
    test('ROLLBACK si INSERT échoue', async () => {
        const client = db.__client;
        db.query.mockResolvedValueOnce({ rows: [] }); // SELECT app_config (limite features)
        db.query.mockResolvedValueOnce({ rows: [] }); // structures
        client.query
            .mockResolvedValueOnce({}) // BEGIN
            .mockRejectedValueOnce(new Error('db down')); // INSERT
        await expect(GeometryModel.importGeoJSON(1, {
            type: 'FeatureCollection',
            features: [{ type: 'Feature', geometry: { type: 'LineString', coordinates: [[0, 0], [1, 1]] }, properties: {} }]
        }, 1)).rejects.toThrow('db down');
        expect(client.query.mock.calls.some(c => c[0] === 'ROLLBACK')).toBe(true);
    });
});
