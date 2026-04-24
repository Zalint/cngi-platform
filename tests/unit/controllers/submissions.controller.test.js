jest.mock('../../../src/models/form.model', () => ({
    submitResponse: jest.fn(),
    getSubmissionById: jest.fn(),
}));

const FormModel = require('../../../src/models/form.model');
const ctrl = require('../../../src/controllers/submissions.controller');
const { mockReq, mockRes, mockNext } = require('../../helpers/http');

beforeEach(() => jest.clearAllMocks());

describe('submissions.submitForm', () => {
    test('400 si form_id ou data manquants', async () => {
        const res = mockRes();
        await ctrl.submitForm(mockReq({ user: { id: 1 }, body: { form_id: 1 } }), res, mockNext());
        expect(res.statusCode).toBe(400);
    });
    test('201 + submitted_by_user_id forcé', async () => {
        FormModel.submitResponse.mockResolvedValue({ id: 1 });
        const res = mockRes();
        await ctrl.submitForm(mockReq({
            user: { id: 7 }, body: { form_id: 1, data: { a: 1 } }
        }), res, mockNext());
        expect(res.statusCode).toBe(201);
        expect(FormModel.submitResponse.mock.calls[0][0].submitted_by_user_id).toBe(7);
    });
});

describe('submissions.getSubmissionById', () => {
    test('404 si introuvable', async () => {
        FormModel.getSubmissionById.mockResolvedValue(undefined);
        const res = mockRes();
        await ctrl.getSubmissionById(mockReq({ params: { id: '1' } }), res, mockNext());
        expect(res.statusCode).toBe(404);
    });
    test('200', async () => {
        FormModel.getSubmissionById.mockResolvedValue({ id: 1 });
        const res = mockRes();
        await ctrl.getSubmissionById(mockReq({ params: { id: '1' } }), res, mockNext());
        expect(res.body.data.id).toBe(1);
    });
});
