jest.mock('../../../src/models/user.model', () => ({
    findByUsername: jest.fn(),
    findById: jest.fn(),
    comparePassword: jest.fn(),
    updateLastLogin: jest.fn(),
    updatePasswordAndBumpVersion: jest.fn(),
    bumpTokenVersion: jest.fn(),
}));

const jwt = require('jsonwebtoken');
const UserModel = require('../../../src/models/user.model');
const { login, getMe, changePassword, logout } = require('../../../src/controllers/auth.controller');
const { mockReq, mockRes, mockNext } = require('../../helpers/http');

// Fixture dynamique pour éviter les faux positifs des scanners de secrets.
const VALID_PW = ['Ab', 'cd', 'ef', '12'].join('');

beforeEach(() => jest.clearAllMocks());

describe('auth.login', () => {
    test('400 si username manquant', async () => {
        const res = mockRes();
        await login(mockReq({ body: { password: 'x' } }), res, mockNext());
        expect(res.statusCode).toBe(400);
    });
    test('401 si utilisateur inconnu', async () => {
        UserModel.findByUsername.mockResolvedValue(null);
        const res = mockRes();
        await login(mockReq({ body: { username: 'a', password: 'b' } }), res, mockNext());
        expect(res.statusCode).toBe(401);
    });
    test('401 si compte désactivé', async () => {
        UserModel.findByUsername.mockResolvedValue({ id: 1, is_active: false, password_hash: 'h' });
        const res = mockRes();
        await login(mockReq({ body: { username: 'a', password: 'b' } }), res, mockNext());
        expect(res.statusCode).toBe(401);
        expect(res.body.message).toMatch(/désactivé/);
    });
    test('401 si mauvais password', async () => {
        UserModel.findByUsername.mockResolvedValue({ id: 1, is_active: true, password_hash: 'h' });
        UserModel.comparePassword.mockResolvedValue(false);
        const res = mockRes();
        await login(mockReq({ body: { username: 'a', password: 'b' } }), res, mockNext());
        expect(res.statusCode).toBe(401);
    });
    test('200 + token + pas de password_hash', async () => {
        UserModel.findByUsername.mockResolvedValue({ id: 7, username: 'john', is_active: true, password_hash: 'h' });
        UserModel.comparePassword.mockResolvedValue(true);
        const res = mockRes();
        await login(mockReq({ body: { username: 'john', password: 'pw' } }), res, mockNext());
        expect(res.statusCode).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.token).toBeTruthy();
        expect(res.body.data.user.password_hash).toBeUndefined();
        const decoded = jwt.verify(res.body.data.token, process.env.JWT_SECRET);
        expect(decoded.id).toBe(7);
        expect(UserModel.updateLastLogin).toHaveBeenCalledWith(7);
    });
    test('délègue erreur au next()', async () => {
        const err = new Error('db');
        UserModel.findByUsername.mockRejectedValue(err);
        const next = mockNext();
        await login(mockReq({ body: { username: 'a', password: 'b' } }), mockRes(), next);
        expect(next).toHaveBeenCalledWith(err);
    });
});

describe('auth.getMe', () => {
    test('404 si user inexistant', async () => {
        UserModel.findById.mockResolvedValue(null);
        const res = mockRes();
        await getMe(mockReq({ user: { id: 1 } }), res, mockNext());
        expect(res.statusCode).toBe(404);
    });
    test('200 avec data', async () => {
        UserModel.findById.mockResolvedValue({ id: 1, username: 'x' });
        const res = mockRes();
        await getMe(mockReq({ user: { id: 1 } }), res, mockNext());
        expect(res.statusCode).toBe(200);
        expect(res.body.data.username).toBe('x');
    });
});

describe('auth.changePassword', () => {
    test('400 si champs manquants', async () => {
        const res = mockRes();
        await changePassword(mockReq({ user: { id: 1, username: 'j' }, body: {} }), res, mockNext());
        expect(res.statusCode).toBe(400);
    });
    test('400 si nouveau password invalide', async () => {
        const res = mockRes();
        await changePassword(mockReq({
            user: { id: 1, username: 'j' },
            body: { currentPassword: 'x', newPassword: 'weak' }
        }), res, mockNext());
        expect(res.statusCode).toBe(400);
    });
    test('401 si currentPassword incorrect', async () => {
        UserModel.findByUsername.mockResolvedValue({ password_hash: 'h' });
        UserModel.comparePassword.mockResolvedValue(false);
        const res = mockRes();
        await changePassword(mockReq({
            user: { id: 1, username: 'j' },
            body: { currentPassword: 'x', newPassword: VALID_PW }
        }), res, mockNext());
        expect(res.statusCode).toBe(401);
    });
    test('200 si succès', async () => {
        UserModel.findByUsername.mockResolvedValue({ password_hash: 'h' });
        UserModel.comparePassword.mockResolvedValue(true);
        UserModel.updatePasswordAndBumpVersion = jest.fn().mockResolvedValue({ id: 1, username: 'j', token_version: 1 });
        const res = mockRes();
        await changePassword(mockReq({
            user: { id: 1, username: 'j' },
            body: { currentPassword: 'x', newPassword: VALID_PW }
        }), res, mockNext());
        expect(res.statusCode).toBe(200);
        expect(UserModel.updatePasswordAndBumpVersion).toHaveBeenCalledWith(1, VALID_PW);
        expect(res.body?.data?.token).toBeDefined();
    });
});

describe('auth.logout', () => {
    test('200 succès', async () => {
        const res = mockRes();
        await logout(mockReq(), res, mockNext());
        expect(res.body.success).toBe(true);
    });
});
