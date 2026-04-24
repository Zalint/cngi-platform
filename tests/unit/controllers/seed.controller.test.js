jest.mock('../../../src/config/db', () => require('../../helpers/db').createDbMock());

const db = require('../../../src/config/db');
const ctrl = require('../../../src/controllers/seed.controller');
const { mockReq, mockRes, mockNext } = require('../../helpers/http');

beforeEach(() => jest.clearAllMocks());

describe('seed.resetDatabase', () => {
    test('BEGIN + DELETE (11 tables) + setval + COMMIT', async () => {
        db.query.mockResolvedValue({ rows: [], rowCount: 0 });
        const res = mockRes();
        await ctrl.resetDatabase(mockReq(), res, mockNext());
        const calls = db.query.mock.calls.map(c => c[0]);
        expect(calls[0]).toBe('BEGIN');
        expect(calls.filter(q => /^DELETE FROM/m.test(q))).toHaveLength(11);
        expect(calls.some(q => /setval\(pg_get_serial_sequence/.test(q))).toBe(true);
        expect(calls).toContain('COMMIT');
        expect(res.body.success).toBe(true);
    });

    test('ROLLBACK + next() en cas d\'erreur', async () => {
        db.query
            .mockResolvedValueOnce({}) // BEGIN
            .mockRejectedValueOnce(new Error('boom'));
        // Les appels suivants (ROLLBACK) doivent résoudre
        db.query.mockResolvedValue({});
        const next = mockNext();
        await ctrl.resetDatabase(mockReq(), mockRes(), next);
        expect(db.query.mock.calls.some(c => c[0] === 'ROLLBACK')).toBe(true);
        expect(next).toHaveBeenCalled();
    });
});

// Mock complet pour faire aboutir populateDatabase jusqu'au COMMIT.
// Les 6 projets insérés sont recherchés par title via projectsResult.rows.find(),
// et admin user est SELECTé ensuite.
function setupPopulateMocks() {
    db.query.mockImplementation((q) => {
        if (/INSERT INTO structures/.test(q) && /RETURNING/.test(q)) {
            return Promise.resolve({ rows: [
                { id: 1, code: 'DPGI' }, { id: 2, code: 'ONAS' },
                { id: 3, code: 'BNSP' }, { id: 4, code: 'CETUD' },
                { id: 5, code: 'AGEROUTE' }, { id: 6, code: 'DPC' }
            ] });
        }
        if (/INSERT INTO projects/.test(q) && /RETURNING/.test(q)) {
            return Promise.resolve({ rows: [
                { id: 101, title: 'Tournées d\'observation' },
                { id: 102, title: 'Création de bassins de rétention' },
                { id: 103, title: 'Confection de digues' },
                { id: 104, title: 'Reconstruction de voirie' },
                { id: 105, title: 'Curage de canaux' },
                { id: 106, title: 'Pose de stations de pompage' },
            ] });
        }
        if (/SELECT id FROM users WHERE username = 'admin'/.test(q)) {
            return Promise.resolve({ rows: [{ id: 1 }] });
        }
        return Promise.resolve({ rows: [], rowCount: 0 });
    });
}

describe('seed.populateDatabase', () => {
    test('happy path : BEGIN + INSERTs + COMMIT', async () => {
        setupPopulateMocks();
        await ctrl.populateDatabase(mockReq({ user: { id: 1 } }), mockRes(), mockNext());
        const calls = db.query.mock.calls.map(c => c[0]);
        expect(calls[0]).toBe('BEGIN');
        expect(calls).toContain('COMMIT');
        expect(calls).not.toContain('ROLLBACK');
    });

    test('ROLLBACK si erreur', async () => {
        db.query
            .mockResolvedValueOnce({}) // BEGIN
            .mockRejectedValueOnce(new Error('boom'));
        db.query.mockResolvedValue({});
        const next = mockNext();
        await ctrl.populateDatabase(mockReq({ user: { id: 1 } }), mockRes(), next);
        expect(db.query.mock.calls.some(c => c[0] === 'ROLLBACK')).toBe(true);
        expect(next).toHaveBeenCalled();
    });
});

describe('seed.resetAndPopulate', () => {
    test('chaîne reset puis populate : 2 BEGIN + 2 COMMIT', async () => {
        setupPopulateMocks();
        const res = mockRes();
        await ctrl.resetAndPopulate(mockReq({ user: { id: 1 } }), res, mockNext());
        const calls = db.query.mock.calls.map(c => c[0]);
        expect(calls.filter(q => q === 'BEGIN').length).toBeGreaterThanOrEqual(2);
        expect(calls.filter(q => q === 'COMMIT').length).toBeGreaterThanOrEqual(2);
    });
});
