jest.mock('../../../src/config/db', () => require('../../helpers/db').createDbMock());

const db = require('../../../src/config/db');
const StructureModel = require('../../../src/models/structure.model');

beforeEach(() => jest.clearAllMocks());

describe('StructureModel', () => {
    test('findAll', async () => {
        db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });
        expect(await StructureModel.findAll()).toHaveLength(1);
    });
    test('findById', async () => {
        db.query.mockResolvedValueOnce({ rows: [{ id: 3 }] });
        const r = await StructureModel.findById(3);
        expect(r.id).toBe(3);
        expect(db.query.mock.calls[0][1]).toEqual([3]);
    });
    test('findByCode', async () => {
        db.query.mockResolvedValueOnce({ rows: [{ code: 'DG' }] });
        await StructureModel.findByCode('DG');
        expect(db.query.mock.calls[0][1]).toEqual(['DG']);
    });
    test('create normalise description optionnelle', async () => {
        db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });
        await StructureModel.create({ name: 'N', code: 'C' });
        expect(db.query.mock.calls[0][1]).toEqual(['N', 'C', null]);
    });
    test('update envoie les paramètres', async () => {
        db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });
        await StructureModel.update(5, { name: 'N2', code: 'C2', description: 'd' });
        expect(db.query.mock.calls[0][1]).toEqual(['N2', 'C2', 'd', 5]);
    });
    test('delete', async () => {
        db.query.mockResolvedValueOnce({ rows: [{ id: 5 }] });
        expect(await StructureModel.delete(5)).toEqual({ id: 5 });
    });

    describe('codeExists', () => {
        test('sans excludeId', async () => {
            db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });
            expect(await StructureModel.codeExists('DG')).toBe(true);
            expect(db.query.mock.calls[0][1]).toEqual(['DG']);
        });
        test('avec excludeId ajoute la clause', async () => {
            db.query.mockResolvedValueOnce({ rows: [] });
            expect(await StructureModel.codeExists('DG', 7)).toBe(false);
            expect(db.query.mock.calls[0][0]).toMatch(/id != \$2/);
            expect(db.query.mock.calls[0][1]).toEqual(['DG', 7]);
        });
    });
});
