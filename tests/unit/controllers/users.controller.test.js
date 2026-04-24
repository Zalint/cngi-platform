jest.mock('../../../src/models/user.model', () => ({
    findAll: jest.fn(),
    findById: jest.fn(),
    findByStructure: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    usernameExists: jest.fn(),
    emailExists: jest.fn(),
}));

const UserModel = require('../../../src/models/user.model');
const ctrl = require('../../../src/controllers/users.controller');
const { mockReq, mockRes, mockNext } = require('../../helpers/http');

// Fixture dynamique pour éviter les faux positifs des scanners de secrets.
const VALID_PW = ['Ab', 'cd', 'ef', '12'].join('');

beforeEach(() => jest.clearAllMocks());

describe('getAllUsers', () => {
    test('admin voit tout', async () => {
        UserModel.findAll.mockResolvedValue([{ id: 1, structure_id: 1 }, { id: 2, structure_id: 2 }]);
        const res = mockRes();
        await ctrl.getAllUsers(mockReq({ user: { role: 'admin' } }), res, mockNext());
        expect(res.body.count).toBe(2);
    });
    test('utilisateur filtré par sa structure', async () => {
        UserModel.findAll.mockResolvedValue([{ id: 1, structure_id: 5 }, { id: 2, structure_id: 9 }]);
        const res = mockRes();
        await ctrl.getAllUsers(mockReq({ user: { role: 'utilisateur', structure_id: 5 } }), res, mockNext());
        expect(res.body.count).toBe(1);
        expect(res.body.data[0].id).toBe(1);
    });
});

describe('getUserById', () => {
    test('404 si inconnu', async () => {
        UserModel.findById.mockResolvedValue(null);
        const res = mockRes();
        await ctrl.getUserById(mockReq({ params: { id: '1' } }), res, mockNext());
        expect(res.statusCode).toBe(404);
    });
    test('200 avec data', async () => {
        UserModel.findById.mockResolvedValue({ id: 1 });
        const res = mockRes();
        await ctrl.getUserById(mockReq({ params: { id: '1' } }), res, mockNext());
        expect(res.body.data.id).toBe(1);
    });
});

describe('createUser', () => {
    test('400 si validation échoue', async () => {
        const res = mockRes();
        await ctrl.createUser(mockReq({ body: { username: 'ab' } }), res, mockNext());
        expect(res.statusCode).toBe(400);
    });
    test('409 si username existe', async () => {
        UserModel.usernameExists.mockResolvedValue(true);
        const res = mockRes();
        await ctrl.createUser(mockReq({
            body: { username: 'john', password: VALID_PW, role: 'admin' }
        }), res, mockNext());
        expect(res.statusCode).toBe(409);
    });
    test('409 si email existe', async () => {
        UserModel.usernameExists.mockResolvedValue(false);
        UserModel.emailExists.mockResolvedValue(true);
        const res = mockRes();
        await ctrl.createUser(mockReq({
            body: { username: 'john', password: VALID_PW, role: 'admin', email: 'j@a.com' }
        }), res, mockNext());
        expect(res.statusCode).toBe(409);
    });
    test('201 en succès', async () => {
        UserModel.usernameExists.mockResolvedValue(false);
        UserModel.emailExists.mockResolvedValue(false);
        UserModel.create.mockResolvedValue({ id: 1, username: 'john' });
        const res = mockRes();
        await ctrl.createUser(mockReq({
            body: { username: 'john', password: VALID_PW, role: 'admin' }
        }), res, mockNext());
        expect(res.statusCode).toBe(201);
        expect(res.body.data.username).toBe('john');
    });
});

describe('updateUser', () => {
    test('400 validation', async () => {
        const res = mockRes();
        await ctrl.updateUser(mockReq({ params: { id: '1' }, body: { role: 'hacker' } }), res, mockNext());
        expect(res.statusCode).toBe(400);
    });
    test('404 si introuvable', async () => {
        UserModel.update.mockResolvedValue(null);
        const res = mockRes();
        await ctrl.updateUser(mockReq({ params: { id: '1' }, body: {} }), res, mockNext());
        expect(res.statusCode).toBe(404);
    });
    test('200 succès', async () => {
        UserModel.update.mockResolvedValue({ id: 1 });
        const res = mockRes();
        await ctrl.updateUser(mockReq({ params: { id: '1' }, body: {} }), res, mockNext());
        expect(res.statusCode).toBe(200);
    });
});

describe('deleteUser', () => {
    test('404 si introuvable', async () => {
        UserModel.delete.mockResolvedValue(undefined);
        const res = mockRes();
        await ctrl.deleteUser(mockReq({ params: { id: '1' } }), res, mockNext());
        expect(res.statusCode).toBe(404);
    });
    test('200 si supprimé', async () => {
        UserModel.delete.mockResolvedValue({ id: 1 });
        const res = mockRes();
        await ctrl.deleteUser(mockReq({ params: { id: '1' } }), res, mockNext());
        expect(res.statusCode).toBe(200);
    });
});

describe('getUsersByStructure', () => {
    test('renvoie count + data', async () => {
        UserModel.findByStructure.mockResolvedValue([{ id: 1 }, { id: 2 }]);
        const res = mockRes();
        await ctrl.getUsersByStructure(mockReq({ params: { structureId: '5' } }), res, mockNext());
        expect(res.body.count).toBe(2);
    });
});
