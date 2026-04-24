jest.mock('../../../src/models/structure.model', () => ({
    findAll: jest.fn(),
    findById: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    codeExists: jest.fn(),
    getStats: jest.fn(),
}));

const StructureModel = require('../../../src/models/structure.model');
const ctrl = require('../../../src/controllers/structures.controller');
const { mockReq, mockRes, mockNext } = require('../../helpers/http');

beforeEach(() => jest.clearAllMocks());

describe('structures.controller', () => {
    test('getAllStructures renvoie count', async () => {
        StructureModel.findAll.mockResolvedValue([{ id: 1 }]);
        const res = mockRes();
        await ctrl.getAllStructures(mockReq(), res, mockNext());
        expect(res.body.count).toBe(1);
    });

    test('getStructureById 404', async () => {
        StructureModel.findById.mockResolvedValue(undefined);
        const res = mockRes();
        await ctrl.getStructureById(mockReq({ params: { id: '1' } }), res, mockNext());
        expect(res.statusCode).toBe(404);
    });

    describe('createStructure', () => {
        test('400 données invalides', async () => {
            const res = mockRes();
            await ctrl.createStructure(mockReq({ body: { name: '', code: '' } }), res, mockNext());
            expect(res.statusCode).toBe(400);
        });
        test('409 si code existe', async () => {
            StructureModel.codeExists.mockResolvedValue(true);
            const res = mockRes();
            await ctrl.createStructure(mockReq({ body: { name: 'X', code: 'DG' } }), res, mockNext());
            expect(res.statusCode).toBe(409);
        });
        test('201 succès', async () => {
            StructureModel.codeExists.mockResolvedValue(false);
            StructureModel.create.mockResolvedValue({ id: 1, name: 'X', code: 'DG' });
            const res = mockRes();
            await ctrl.createStructure(mockReq({ body: { name: 'X', code: 'DG' } }), res, mockNext());
            expect(res.statusCode).toBe(201);
        });
    });

    describe('updateStructure', () => {
        test('409 si code existe pour un autre id', async () => {
            StructureModel.codeExists.mockResolvedValue(true);
            const res = mockRes();
            await ctrl.updateStructure(
                mockReq({ params: { id: '2' }, body: { name: 'X', code: 'DG' } }),
                res, mockNext()
            );
            expect(res.statusCode).toBe(409);
            expect(StructureModel.codeExists).toHaveBeenCalledWith('DG', '2');
        });
        test('404 si introuvable', async () => {
            StructureModel.codeExists.mockResolvedValue(false);
            StructureModel.update.mockResolvedValue(undefined);
            const res = mockRes();
            await ctrl.updateStructure(
                mockReq({ params: { id: '2' }, body: { name: 'X', code: 'DG' } }),
                res, mockNext()
            );
            expect(res.statusCode).toBe(404);
        });
    });

    test('deleteStructure 404 / 200', async () => {
        StructureModel.delete.mockResolvedValueOnce(undefined);
        const res1 = mockRes();
        await ctrl.deleteStructure(mockReq({ params: { id: '1' } }), res1, mockNext());
        expect(res1.statusCode).toBe(404);

        StructureModel.delete.mockResolvedValueOnce({ id: 1 });
        const res2 = mockRes();
        await ctrl.deleteStructure(mockReq({ params: { id: '1' } }), res2, mockNext());
        expect(res2.statusCode).toBe(200);
    });

    test('getStats renvoie data', async () => {
        StructureModel.getStats.mockResolvedValue([{ id: 1 }]);
        const res = mockRes();
        await ctrl.getStats(mockReq(), res, mockNext());
        expect(res.body.data).toHaveLength(1);
    });
});
