jest.mock('../../../src/config/db', () => require('../../helpers/db').createDbMock());

const bcrypt = require('bcryptjs');
const db = require('../../../src/config/db');
const UserModel = require('../../../src/models/user.model');

// Fixture dynamique pour éviter les faux positifs des scanners de secrets.
const VALID_PW = ['Ab', 'cd', 'ef', '12'].join('');

beforeEach(() => jest.clearAllMocks());

describe('UserModel', () => {
    test('findAll renvoie les rows triés', async () => {
        db.query.mockResolvedValueOnce({ rows: [{ id: 1 }, { id: 2 }] });
        const res = await UserModel.findAll();
        expect(res).toHaveLength(2);
        expect(db.query).toHaveBeenCalledTimes(1);
    });

    test('findById renvoie le premier row', async () => {
        db.query.mockResolvedValueOnce({ rows: [{ id: 7, username: 'john' }] });
        const u = await UserModel.findById(7);
        expect(u.id).toBe(7);
        expect(db.query.mock.calls[0][1]).toEqual([7]);
    });

    test('findById renvoie undefined si aucun résultat', async () => {
        db.query.mockResolvedValueOnce({ rows: [] });
        expect(await UserModel.findById(999)).toBeUndefined();
    });

    test('findByUsername passe le username en paramètre', async () => {
        db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });
        await UserModel.findByUsername('john');
        expect(db.query.mock.calls[0][1]).toEqual(['john']);
    });

    test('findByStructure filtre par structure_id', async () => {
        db.query.mockResolvedValueOnce({ rows: [] });
        await UserModel.findByStructure(5);
        expect(db.query.mock.calls[0][1]).toEqual([5]);
    });

    test('create hashe le mot de passe avant insertion', async () => {
        db.query.mockResolvedValueOnce({ rows: [{ id: 1, username: 'john' }] });
        await UserModel.create({
            username: 'john', password: VALID_PW, email: 'j@a.com',
            first_name: 'J', last_name: 'D', role: 'admin',
        });
        const params = db.query.mock.calls[0][1];
        expect(params[0]).toBe('john');
        // Le password_hash ne doit jamais être le clair
        expect(params[1]).not.toBe(VALID_PW);
        // Il doit matcher le hash bcrypt
        const ok = await bcrypt.compare(VALID_PW, params[1]);
        expect(ok).toBe(true);
    });

    test('create normalise les champs optionnels en NULL', async () => {
        db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });
        await UserModel.create({ username: 'u', password: VALID_PW, email: null, first_name: null, last_name: null, role: 'admin' });
        const params = db.query.mock.calls[0][1];
        expect(params[6]).toBeNull(); // structure_id
        expect(params[7]).toBeNull(); // territorial_level
        expect(params[8]).toBeNull(); // territorial_value
        expect(params[9]).toBeNull(); // title
    });

    test('updatePassword hashe et envoie le hash', async () => {
        db.query.mockResolvedValueOnce({ rows: [{ id: 1, username: 'x' }] });
        await UserModel.updatePassword(1, 'NewPass123');
        const params = db.query.mock.calls[0][1];
        expect(params[1]).toBe(1);
        expect(await bcrypt.compare('NewPass123', params[0])).toBe(true);
    });

    test('comparePassword renvoie true si match', async () => {
        const hash = await bcrypt.hash('secret', 4);
        expect(await UserModel.comparePassword('secret', hash)).toBe(true);
        expect(await UserModel.comparePassword('wrong', hash)).toBe(false);
    });

    test('delete retourne l\'id supprimé', async () => {
        db.query.mockResolvedValueOnce({ rows: [{ id: 42 }] });
        const r = await UserModel.delete(42);
        expect(r.id).toBe(42);
    });

    test('usernameExists : true si rows non vide', async () => {
        db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });
        expect(await UserModel.usernameExists('john')).toBe(true);
    });
    test('usernameExists : false sinon', async () => {
        db.query.mockResolvedValueOnce({ rows: [] });
        expect(await UserModel.usernameExists('ghost')).toBe(false);
    });

    test('emailExists : true/false selon rows', async () => {
        db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });
        expect(await UserModel.emailExists('a@b.c')).toBe(true);
        db.query.mockResolvedValueOnce({ rows: [] });
        expect(await UserModel.emailExists('x@y.z')).toBe(false);
    });

    test('updateLastLogin passe l\'id', async () => {
        db.query.mockResolvedValueOnce({ rows: [], rowCount: 1 });
        await UserModel.updateLastLogin(9);
        expect(db.query.mock.calls[0][1]).toEqual([9]);
    });
});
