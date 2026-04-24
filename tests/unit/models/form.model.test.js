jest.mock('../../../src/config/db', () => require('../../helpers/db').createDbMock());

const db = require('../../../src/config/db');
const FormModel = require('../../../src/models/form.model');

beforeEach(() => jest.clearAllMocks());

describe('FormModel', () => {
    test('findAll : seulement is_active=true', async () => {
        db.query.mockResolvedValueOnce({ rows: [] });
        await FormModel.findAll();
        expect(db.query.mock.calls[0][0]).toMatch(/is_active = true/);
    });
    test('findByStructure : retourne aussi les globaux (structure IS NULL)', async () => {
        db.query.mockResolvedValueOnce({ rows: [] });
        await FormModel.findByStructure(5);
        const q = db.query.mock.calls[0][0];
        expect(q).toMatch(/assigned_to_structure_id = \$1/);
        expect(q).toMatch(/IS NULL/);
        expect(db.query.mock.calls[0][1]).toEqual([5]);
    });
    test('create normalise les optionnels en null', async () => {
        db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });
        await FormModel.create({ title: 'T', schema: { x: 1 }, created_by: 7 });
        const p = db.query.mock.calls[0][1];
        expect(p).toEqual(['T', null, { x: 1 }, null, 7]);
    });
    test('delete fait un soft delete (is_active=false)', async () => {
        db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });
        await FormModel.delete(9);
        expect(db.query.mock.calls[0][0]).toMatch(/is_active = false/);
    });
    test('submitResponse : project_id optionnel', async () => {
        db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });
        await FormModel.submitResponse({ form_id: 1, data: {}, submitted_by_user_id: 7 });
        expect(db.query.mock.calls[0][1]).toEqual([1, null, {}, 7]);
    });
    test('getSubmissions filtre par form_id', async () => {
        db.query.mockResolvedValueOnce({ rows: [] });
        await FormModel.getSubmissions(5);
        expect(db.query.mock.calls[0][1]).toEqual([5]);
    });
});
