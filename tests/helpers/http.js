/**
 * Petits utilitaires pour simuler req/res/next dans les tests de middlewares et
 * contrôleurs, sans dépendance Supertest.
 */
function mockReq(overrides = {}) {
    return {
        headers: {},
        body: {},
        query: {},
        params: {},
        user: null,
        header(name) {
            const h = this.headers || {};
            const key = Object.keys(h).find(k => k.toLowerCase() === name.toLowerCase());
            return key ? h[key] : undefined;
        },
        ...overrides,
    };
}

function mockRes() {
    const res = {
        statusCode: 200,
        body: undefined,
    };
    res.status = jest.fn((code) => { res.statusCode = code; return res; });
    res.json = jest.fn((payload) => { res.body = payload; return res; });
    res.send = jest.fn((payload) => { res.body = payload; return res; });
    return res;
}

function mockNext() {
    return jest.fn();
}

module.exports = { mockReq, mockRes, mockNext };
