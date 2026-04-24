jest.mock('../../../src/config/db', () => require('../../helpers/db').createDbMock());

const crypto = require('crypto');
const db = require('../../../src/config/db');
const ApiKeyModel = require('../../../src/models/apiKey.model');

beforeEach(() => jest.clearAllMocks());

describe('ApiKeyModel.create', () => {
    test('insère hash + prefix, retourne la clé en clair', async () => {
        db.query.mockResolvedValueOnce({ rows: [{ id: 1, key_prefix: 'x', label: 'L', is_active: true, expires_at: null, created_at: new Date() }] });
        const r = await ApiKeyModel.create(7, 'L');
        expect(r.key).toMatch(/^cngiri_/);
        const params = db.query.mock.calls[0][1];
        // user_id, key_hash, key_prefix, label, expires_at
        expect(params[0]).toBe(7);
        expect(params[1]).toHaveLength(64); // sha256 hex
        expect(params[2]).toBe(r.key.slice(0, 14));
        expect(params[3]).toBe('L');
        expect(params[4]).toBe(null);
    });

    test('label et expiresAt optionnels deviennent null', async () => {
        db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });
        await ApiKeyModel.create(1);
        expect(db.query.mock.calls[0][1][3]).toBe(null);
    });
});

describe('ApiKeyModel.verify', () => {
    test('null si pas de clé', async () => {
        expect(await ApiKeyModel.verify(null)).toBe(null);
    });
    test('null si préfixe manquant', async () => {
        expect(await ApiKeyModel.verify('badformat')).toBe(null);
    });
    test('null si clé introuvable', async () => {
        db.query.mockResolvedValueOnce({ rows: [] });
        expect(await ApiKeyModel.verify('cngiri_abc')).toBe(null);
    });
    test('null si clé révoquée', async () => {
        db.query.mockResolvedValueOnce({
            rows: [{ key_id: 1, is_active: false, user_active: true, expires_at: null, id: 2 }]
        });
        expect(await ApiKeyModel.verify('cngiri_abc')).toBe(null);
    });
    test('null si user désactivé', async () => {
        db.query.mockResolvedValueOnce({
            rows: [{ key_id: 1, is_active: true, user_active: false, expires_at: null, id: 2 }]
        });
        expect(await ApiKeyModel.verify('cngiri_abc')).toBe(null);
    });
    test('null si expirée', async () => {
        db.query.mockResolvedValueOnce({
            rows: [{ key_id: 1, is_active: true, user_active: true, expires_at: new Date('2000-01-01'), id: 2 }]
        });
        expect(await ApiKeyModel.verify('cngiri_abc')).toBe(null);
    });
    test('retourne user + _apiKeyId si valide', async () => {
        db.query.mockResolvedValueOnce({
            rows: [{
                key_id: 99, is_active: true, user_active: true, expires_at: null,
                id: 2, username: 'bob', email: 'b@b', first_name: 'B', last_name: 'O',
                role: 'admin', structure_id: 5, territorial_level: null, territorial_value: null,
            }]
        });
        db.query.mockResolvedValueOnce({ rows: [], rowCount: 1 });
        const r = await ApiKeyModel.verify('cngiri_abc');
        expect(r).toMatchObject({ id: 2, username: 'bob', role: 'admin', _apiKeyId: 99 });
    });

    test('utilise un hash sha256 déterministe', async () => {
        db.query.mockResolvedValueOnce({ rows: [] });
        await ApiKeyModel.verify('cngiri_fixed');
        const expected = crypto.createHash('sha256').update('cngiri_fixed').digest('hex');
        expect(db.query.mock.calls[0][1][0]).toBe(expected);
    });
});

describe('ApiKeyModel.revoke/delete', () => {
    test('revoke avec userId ajoute la clause', async () => {
        db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });
        await ApiKeyModel.revoke(1, 7);
        expect(db.query.mock.calls[0][0]).toMatch(/user_id = \$2/);
        expect(db.query.mock.calls[0][1]).toEqual([1, 7]);
    });
    test('revoke sans userId : pas de clause', async () => {
        db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });
        await ApiKeyModel.revoke(1);
        expect(db.query.mock.calls[0][1]).toEqual([1]);
    });
    test('delete avec userId', async () => {
        db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });
        await ApiKeyModel.delete(1, 7);
        expect(db.query.mock.calls[0][1]).toEqual([1, 7]);
    });
});
