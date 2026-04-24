jest.mock('../../../src/config/db', () => require('../../helpers/db').createDbMock());

const db = require('../../../src/config/db');
const FormModel = require('../../../src/models/form.model');

beforeEach(() => jest.clearAllMocks());

describe('FormModel extra', () => {
    test('findById', async () => {
        db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });
        const r = await FormModel.findById(1);
        expect(r.id).toBe(1);
    });
    test('update avec COALESCE', async () => {
        db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });
        await FormModel.update(5, { title: 'T' });
        expect(db.query.mock.calls[0][0]).toMatch(/COALESCE/);
        expect(db.query.mock.calls[0][1][5]).toBe(5);
    });
    test('getSubmissionById', async () => {
        db.query.mockResolvedValueOnce({ rows: [{ id: 1, form_title: 'F' }] });
        const r = await FormModel.getSubmissionById(1);
        expect(r.form_title).toBe('F');
    });
});
