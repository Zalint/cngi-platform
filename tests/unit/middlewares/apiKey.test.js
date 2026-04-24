jest.mock('../../../src/models/apiKey.model', () => ({
    verify: jest.fn(),
}));

const ApiKeyModel = require('../../../src/models/apiKey.model');
const { verifyApiKey } = require('../../../src/middlewares/apiKey');
const { mockReq, mockRes, mockNext } = require('../../helpers/http');

beforeEach(() => jest.clearAllMocks());

describe('verifyApiKey', () => {
    test('401 si aucune clé', async () => {
        const res = mockRes();
        await verifyApiKey(mockReq(), res, mockNext());
        expect(res.statusCode).toBe(401);
        expect(res.body.error).toBe('missing_api_key');
    });

    test('401 si clé invalide', async () => {
        ApiKeyModel.verify.mockResolvedValue(null);
        const res = mockRes();
        await verifyApiKey(mockReq({ headers: { 'x-api-key': 'bad' } }), res, mockNext());
        expect(res.statusCode).toBe(401);
        expect(res.body.error).toBe('invalid_api_key');
    });

    test('accepte clé via query ?api_key=', async () => {
        ApiKeyModel.verify.mockResolvedValue({ id: 1, role: 'admin', _apiKeyId: 42 });
        const req = mockReq({ query: { api_key: 'cngiri_abc' } });
        const res = mockRes();
        const next = mockNext();
        await verifyApiKey(req, res, next);
        expect(next).toHaveBeenCalledWith();
        expect(req.user.id).toBe(1);
        expect(req.apiKeyId).toBe(42);
    });

    test('propage les erreurs au next()', async () => {
        const err = new Error('db down');
        ApiKeyModel.verify.mockRejectedValue(err);
        const next = mockNext();
        await verifyApiKey(mockReq({ headers: { 'x-api-key': 'x' } }), mockRes(), next);
        expect(next).toHaveBeenCalledWith(err);
    });
});
