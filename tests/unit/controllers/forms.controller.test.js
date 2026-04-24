jest.mock('../../../src/models/form.model', () => ({
    findAll: jest.fn(),
    findById: jest.fn(),
    findByStructure: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    getSubmissions: jest.fn(),
}));

const FormModel = require('../../../src/models/form.model');
const ctrl = require('../../../src/controllers/forms.controller');
const { mockReq, mockRes, mockNext } = require('../../helpers/http');

beforeEach(() => jest.clearAllMocks());

describe('forms.getAllForms', () => {
    test('utilisateur avec structure → findByStructure', async () => {
        FormModel.findByStructure.mockResolvedValue([]);
        await ctrl.getAllForms(mockReq({ user: { role: 'utilisateur', structure_id: 3 } }), mockRes(), mockNext());
        expect(FormModel.findByStructure).toHaveBeenCalledWith(3);
        expect(FormModel.findAll).not.toHaveBeenCalled();
    });
    test('admin → findAll', async () => {
        FormModel.findAll.mockResolvedValue([]);
        await ctrl.getAllForms(mockReq({ user: { role: 'admin' } }), mockRes(), mockNext());
        expect(FormModel.findAll).toHaveBeenCalled();
    });
});

describe('forms.getFormById', () => {
    test('404 si absent', async () => {
        FormModel.findById.mockResolvedValue(undefined);
        const res = mockRes();
        await ctrl.getFormById(mockReq({ params: { id: '1' } }), res, mockNext());
        expect(res.statusCode).toBe(404);
    });
});

describe('forms.createForm', () => {
    test('400 si titre ou schema manquant', async () => {
        const res = mockRes();
        await ctrl.createForm(mockReq({ user: { id: 1 }, body: { title: 'X' } }), res, mockNext());
        expect(res.statusCode).toBe(400);
    });
    test('201 + created_by forcé', async () => {
        FormModel.create.mockResolvedValue({ id: 10 });
        const res = mockRes();
        await ctrl.createForm(mockReq({
            user: { id: 7 }, body: { title: 'T', schema: { a: 1 } }
        }), res, mockNext());
        expect(res.statusCode).toBe(201);
        expect(FormModel.create.mock.calls[0][0].created_by).toBe(7);
    });
});

describe('forms.updateForm / deleteForm / getSubmissions', () => {
    test('updateForm 404', async () => {
        FormModel.update.mockResolvedValue(undefined);
        const res = mockRes();
        await ctrl.updateForm(mockReq({ params: { id: '1' }, body: {} }), res, mockNext());
        expect(res.statusCode).toBe(404);
    });
    test('deleteForm 404', async () => {
        FormModel.delete.mockResolvedValue(undefined);
        const res = mockRes();
        await ctrl.deleteForm(mockReq({ params: { id: '1' } }), res, mockNext());
        expect(res.statusCode).toBe(404);
    });
    test('getSubmissions count', async () => {
        FormModel.getSubmissions.mockResolvedValue([{}, {}, {}]);
        const res = mockRes();
        await ctrl.getSubmissions(mockReq({ params: { id: '1' } }), res, mockNext());
        expect(res.body.count).toBe(3);
    });
});
