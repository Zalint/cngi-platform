const { notFound, errorHandler } = require('../../../src/middlewares/errorHandler');
const { mockReq, mockRes, mockNext } = require('../../helpers/http');

describe('notFound', () => {
    test('set 404 et délègue au next', () => {
        const req = mockReq({ originalUrl: '/api/missing' });
        const res = mockRes();
        const next = mockNext();
        notFound(req, res, next);
        expect(res.statusCode).toBe(404);
        expect(next).toHaveBeenCalledTimes(1);
        expect(next.mock.calls[0][0]).toBeInstanceOf(Error);
        expect(next.mock.calls[0][0].message).toContain('/api/missing');
    });
});

describe('errorHandler', () => {
    const run = (err) => {
        const req = mockReq();
        const res = mockRes();
        errorHandler(err, req, res, mockNext());
        return res;
    };

    test('code PG 23505 → 409 valeur duplicate', () => {
        const res = run({ code: '23505', message: 'dup' });
        expect(res.statusCode).toBe(409);
        expect(res.body.message).toMatch(/existe déjà/);
    });
    test('code PG 23503 → 400', () => {
        expect(run({ code: '23503' }).statusCode).toBe(400);
    });
    test('code PG 23502 → 400 champ requis', () => {
        const res = run({ code: '23502' });
        expect(res.statusCode).toBe(400);
        expect(res.body.message).toMatch(/requis/);
    });
    test('code PG 22P02 → 400 format invalide', () => {
        expect(run({ code: '22P02' }).statusCode).toBe(400);
    });

    test('JsonWebTokenError → 401', () => {
        const res = run({ name: 'JsonWebTokenError', message: 'x' });
        expect(res.statusCode).toBe(401);
        expect(res.body.message).toBe('Token invalide');
    });
    test('TokenExpiredError → 401', () => {
        const res = run({ name: 'TokenExpiredError', message: 'x' });
        expect(res.statusCode).toBe(401);
        expect(res.body.message).toBe('Token expiré');
    });
    test('ValidationError → 400 avec message', () => {
        const res = run({ name: 'ValidationError', message: 'bad input' });
        expect(res.statusCode).toBe(400);
        expect(res.body.message).toBe('bad input');
    });

    test('honore err.statusCode personnalisé', () => {
        const res = run({ statusCode: 418, message: 'teapot' });
        expect(res.statusCode).toBe(418);
        expect(res.body.message).toBe('teapot');
    });

    test('défaut : 500 si res.statusCode = 200', () => {
        const res = run({ message: 'boom' });
        expect(res.statusCode).toBe(500);
    });

    test('success: false dans le payload', () => {
        const res = run({ message: 'x', statusCode: 400 });
        expect(res.body.success).toBe(false);
    });
});
