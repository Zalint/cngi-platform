jest.mock('../../../src/models/config.model', () => ({
    getByCategory: jest.fn(),
    getAll: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
}));

const ConfigModel = require('../../../src/models/config.model');
const ctrl = require('../../../src/controllers/config.controller');
const { mockReq, mockRes, mockNext } = require('../../helpers/http');

beforeEach(() => jest.clearAllMocks());

describe('config.controller', () => {
    test('getByCategory', async () => {
        ConfigModel.getByCategory.mockResolvedValue([{ id: 1 }]);
        const res = mockRes();
        await ctrl.getByCategory(mockReq({ params: { category: 'x' } }), res, mockNext());
        expect(res.body.data).toHaveLength(1);
    });
    test('getAll', async () => {
        ConfigModel.getAll.mockResolvedValue([]);
        const res = mockRes();
        await ctrl.getAll(mockReq(), res, mockNext());
        expect(res.body.success).toBe(true);
    });

    describe('create', () => {
        test('400 si champ manquant', async () => {
            const res = mockRes();
            await ctrl.create(mockReq({ body: { category: 'c' } }), res, mockNext());
            expect(res.statusCode).toBe(400);
        });
        test('201 succès', async () => {
            ConfigModel.create.mockResolvedValue({ id: 1 });
            const res = mockRes();
            await ctrl.create(mockReq({ body: { category: 'c', value: 'v', label: 'L' } }), res, mockNext());
            expect(res.statusCode).toBe(201);
        });
    });

    describe('update / delete', () => {
        test('update 404', async () => {
            ConfigModel.update.mockResolvedValue(undefined);
            const res = mockRes();
            await ctrl.update(mockReq({ params: { id: '1' }, body: {} }), res, mockNext());
            expect(res.statusCode).toBe(404);
        });
        test('delete 404', async () => {
            ConfigModel.delete.mockResolvedValue(false);
            const res = mockRes();
            await ctrl.delete(mockReq({ params: { id: '1' } }), res, mockNext());
            expect(res.statusCode).toBe(404);
        });
        test('delete 200', async () => {
            ConfigModel.delete.mockResolvedValue(true);
            const res = mockRes();
            await ctrl.delete(mockReq({ params: { id: '1' } }), res, mockNext());
            expect(res.statusCode).toBe(200);
        });
    });
});
