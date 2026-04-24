jest.mock('../../../src/models/apiKey.model', () => ({
    listAll: jest.fn(),
    listByUser: jest.fn(),
    create: jest.fn(),
    revoke: jest.fn(),
    delete: jest.fn(),
}));

const ApiKeyModel = require('../../../src/models/apiKey.model');
const ctrl = require('../../../src/controllers/apiKeys.controller');
const { mockReq, mockRes, mockNext } = require('../../helpers/http');

beforeEach(() => jest.clearAllMocks());

describe('apiKeys.list', () => {
    test('admin → listAll', async () => {
        ApiKeyModel.listAll.mockResolvedValue([{ id: 1 }]);
        const res = mockRes();
        await ctrl.list(mockReq({ user: { role: 'admin', id: 1 } }), res, mockNext());
        expect(ApiKeyModel.listAll).toHaveBeenCalled();
        expect(res.body.count).toBe(1);
    });
    test('user → listByUser', async () => {
        ApiKeyModel.listByUser.mockResolvedValue([]);
        await ctrl.list(mockReq({ user: { role: 'utilisateur', id: 7 } }), mockRes(), mockNext());
        expect(ApiKeyModel.listByUser).toHaveBeenCalledWith(7);
    });
});

describe('apiKeys.create', () => {
    test('201 + passage de label/expires_at', async () => {
        ApiKeyModel.create.mockResolvedValue({ key: 'cngiri_xyz' });
        const res = mockRes();
        await ctrl.create(mockReq({
            user: { id: 7 }, body: { label: 'L', expires_at: '2099-01-01' }
        }), res, mockNext());
        expect(ApiKeyModel.create).toHaveBeenCalledWith(7, 'L', '2099-01-01');
        expect(res.statusCode).toBe(201);
    });
    test('expires_at optionnel → null', async () => {
        ApiKeyModel.create.mockResolvedValue({});
        await ctrl.create(mockReq({ user: { id: 7 }, body: {} }), mockRes(), mockNext());
        expect(ApiKeyModel.create.mock.calls[0][2]).toBe(null);
    });
});

describe('apiKeys.revoke', () => {
    test('admin : userId=null (peut révoquer toute clé)', async () => {
        ApiKeyModel.revoke.mockResolvedValue({ id: 1 });
        await ctrl.revoke(mockReq({ user: { role: 'admin', id: 1 }, params: { id: '99' } }), mockRes(), mockNext());
        expect(ApiKeyModel.revoke).toHaveBeenCalledWith('99', null);
    });
    test('utilisateur : userId scopé', async () => {
        ApiKeyModel.revoke.mockResolvedValue({ id: 1 });
        await ctrl.revoke(mockReq({ user: { role: 'utilisateur', id: 7 }, params: { id: '99' } }), mockRes(), mockNext());
        expect(ApiKeyModel.revoke).toHaveBeenCalledWith('99', 7);
    });
    test('404 si rien à révoquer', async () => {
        ApiKeyModel.revoke.mockResolvedValue(undefined);
        const res = mockRes();
        await ctrl.revoke(mockReq({ user: { role: 'utilisateur', id: 7 }, params: { id: '99' } }), res, mockNext());
        expect(res.statusCode).toBe(404);
    });
});

describe('apiKeys.remove', () => {
    test('admin : userId=null', async () => {
        ApiKeyModel.delete.mockResolvedValue({ id: 1 });
        await ctrl.remove(mockReq({ user: { role: 'admin', id: 1 }, params: { id: '99' } }), mockRes(), mockNext());
        expect(ApiKeyModel.delete).toHaveBeenCalledWith('99', null);
    });
    test('404 si rien', async () => {
        ApiKeyModel.delete.mockResolvedValue(undefined);
        const res = mockRes();
        await ctrl.remove(mockReq({ user: { role: 'utilisateur', id: 7 }, params: { id: '99' } }), res, mockNext());
        expect(res.statusCode).toBe(404);
    });
});
