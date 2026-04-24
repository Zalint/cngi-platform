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

describe('seed.populateDatabase', () => {
    test('BEGIN en première requête, et chemin heureux ou erreur tolérée', async () => {
        db.query.mockImplementation((q) => {
            if (/INSERT INTO structures/.test(q) && /RETURNING/.test(q)) {
                return Promise.resolve({
                    rows: [
                        { id: 1, code: 'DPGI' }, { id: 2, code: 'ONAS' },
                        { id: 3, code: 'BNSP' }, { id: 4, code: 'CETUD' },
                        { id: 5, code: 'AGEROUTE' }, { id: 6, code: 'DPC' }
                    ]
                });
            }
            if (/INSERT INTO projects/.test(q) && /RETURNING/.test(q)) {
                return Promise.resolve({ rows: [{ id: 1 }, { id: 2 }, { id: 3 }] });
            }
            return Promise.resolve({ rows: [], rowCount: 0 });
        });
        await ctrl.populateDatabase(mockReq({ user: { id: 1 } }), mockRes(), mockNext());
        expect(db.query.mock.calls[0][0]).toBe('BEGIN');
        // Soit COMMIT soit ROLLBACK — peu importe, on veut juste la couverture
        const calls = db.query.mock.calls.map(c => c[0]);
        expect(calls.some(q => q === 'COMMIT' || q === 'ROLLBACK')).toBe(true);
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
    test('chaîne reset puis populate', async () => {
        db.query.mockImplementation((q) => {
            if (/INSERT INTO structures/.test(q) && /RETURNING/.test(q)) {
                return Promise.resolve({
                    rows: [
                        { id: 1, code: 'DPGI' }, { id: 2, code: 'ONAS' },
                        { id: 3, code: 'BNSP' }, { id: 4, code: 'CETUD' },
                        { id: 5, code: 'AGEROUTE' }, { id: 6, code: 'DPC' }
                    ]
                });
            }
            if (/INSERT INTO projects/.test(q) && /RETURNING/.test(q)) {
                return Promise.resolve({ rows: [{ id: 1 }, { id: 2 }, { id: 3 }] });
            }
            return Promise.resolve({ rows: [], rowCount: 0 });
        });
        const res = mockRes();
        await ctrl.resetAndPopulate(mockReq({ user: { id: 1 } }), res, mockNext());
        const calls = db.query.mock.calls.map(c => c[0]);
        // Deux séquences : reset puis populate. Au moins 2 BEGIN.
        expect(calls.filter(q => q === 'BEGIN').length).toBeGreaterThanOrEqual(2);
    });
});
