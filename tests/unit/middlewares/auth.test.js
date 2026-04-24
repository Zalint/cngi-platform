jest.mock('../../../src/config/db', () => require('../../helpers/db').createDbMock());
const jwt = require('jsonwebtoken');
const db = require('../../../src/config/db');
const { protect, authorize, checkStructureAccess } = require('../../../src/middlewares/auth');
const { mockReq, mockRes, mockNext } = require('../../helpers/http');

beforeEach(() => jest.clearAllMocks());

describe('protect', () => {
    test('401 si pas de header Authorization', async () => {
        const req = mockReq();
        const res = mockRes();
        const next = mockNext();
        await protect(req, res, next);
        expect(res.statusCode).toBe(401);
        expect(res.body.message).toMatch(/Pas de token/);
        expect(next).not.toHaveBeenCalled();
    });

    test('401 si token invalide', async () => {
        const req = mockReq({ headers: { authorization: 'Bearer not.a.jwt' } });
        const res = mockRes();
        await protect(req, res, mockNext());
        expect(res.statusCode).toBe(401);
        expect(res.body.message).toMatch(/invalide|expiré/);
    });

    test('401 si utilisateur non trouvé', async () => {
        const token = jwt.sign({ id: 42 }, process.env.JWT_SECRET);
        db.query.mockResolvedValueOnce({ rows: [] });
        const req = mockReq({ headers: { authorization: `Bearer ${token}` } });
        const res = mockRes();
        await protect(req, res, mockNext());
        expect(res.statusCode).toBe(401);
        expect(res.body.message).toMatch(/non trouvé/);
    });

    test('401 si compte désactivé', async () => {
        const token = jwt.sign({ id: 1 }, process.env.JWT_SECRET);
        db.query.mockResolvedValueOnce({ rows: [{ id: 1, is_active: false }] });
        const req = mockReq({ headers: { authorization: `Bearer ${token}` } });
        const res = mockRes();
        await protect(req, res, mockNext());
        expect(res.statusCode).toBe(401);
        expect(res.body.message).toMatch(/désactivé/);
    });

    test('happy path : attache req.user et next()', async () => {
        const token = jwt.sign({ id: 1 }, process.env.JWT_SECRET);
        const fakeUser = { id: 1, username: 'john', role: 'admin', is_active: true };
        db.query.mockResolvedValueOnce({ rows: [fakeUser] });
        const req = mockReq({ headers: { authorization: `Bearer ${token}` } });
        const res = mockRes();
        const next = mockNext();
        await protect(req, res, next);
        expect(req.user).toEqual(fakeUser);
        expect(next).toHaveBeenCalledWith();
    });
});

describe('authorize', () => {
    test('401 si pas de user', () => {
        const res = mockRes();
        authorize('admin')(mockReq(), res, mockNext());
        expect(res.statusCode).toBe(401);
    });
    test('403 si rôle absent', () => {
        const res = mockRes();
        authorize('admin')(mockReq({ user: { role: 'utilisateur' } }), res, mockNext());
        expect(res.statusCode).toBe(403);
    });
    test('passe si rôle autorisé', () => {
        const next = mockNext();
        authorize('admin', 'directeur')(mockReq({ user: { role: 'directeur' } }), mockRes(), next);
        expect(next).toHaveBeenCalled();
    });
});

describe('checkStructureAccess', () => {
    test('401 sans user', async () => {
        const res = mockRes();
        await checkStructureAccess(mockReq(), res, mockNext());
        expect(res.statusCode).toBe(401);
    });
    test('admin passe toujours', async () => {
        const next = mockNext();
        await checkStructureAccess(mockReq({ user: { role: 'admin' } }), mockRes(), next);
        expect(next).toHaveBeenCalled();
    });
    test('passe si structure_id égale', async () => {
        const next = mockNext();
        await checkStructureAccess(
            mockReq({ user: { role: 'utilisateur', structure_id: 5 }, params: { structureId: '5' } }),
            mockRes(),
            next
        );
        expect(next).toHaveBeenCalled();
    });
    test('403 si structure_id différente', async () => {
        const res = mockRes();
        await checkStructureAccess(
            mockReq({ user: { role: 'utilisateur', structure_id: 5 }, params: { structureId: '9' } }),
            res,
            mockNext()
        );
        expect(res.statusCode).toBe(403);
    });
});
