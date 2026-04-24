jest.mock('../../../src/config/db', () => require('../../helpers/db').createDbMock());

const db = require('../../../src/config/db');
const ctrl = require('../../../src/controllers/measures.controller');
const { mockReq, mockRes, mockNext } = require('../../helpers/http');

beforeEach(() => jest.clearAllMocks());

describe('measures.listMine', () => {
    test('requête SQL avec userId + ORDER BY priorité/échéance', async () => {
        db.query.mockResolvedValueOnce({ rows: [] });
        await ctrl.listMine(mockReq({ user: { id: 7 }, query: {} }), mockRes(), mockNext());
        const [q, params] = db.query.mock.calls[0];
        expect(params).toEqual([7]);
        expect(q).toMatch(/m\.assigned_user_id = \$1/);
        expect(q).toMatch(/deleted_at IS NULL/);
        expect(q).toMatch(/WHEN 'urgente' THEN 1/);
    });

    test('filtre status', async () => {
        db.query.mockResolvedValueOnce({ rows: [] });
        await ctrl.listMine(mockReq({ user: { id: 7 }, query: { status: 'executee' } }), mockRes(), mockNext());
        const [q, params] = db.query.mock.calls[0];
        expect(q).toMatch(/m\.status = \$2/);
        expect(params).toEqual([7, 'executee']);
    });

    test('filtre overdue=1 ajoute la clause deadline', async () => {
        db.query.mockResolvedValueOnce({ rows: [] });
        await ctrl.listMine(mockReq({ user: { id: 7 }, query: { overdue: '1' } }), mockRes(), mockNext());
        expect(db.query.mock.calls[0][0]).toMatch(/deadline_date < CURRENT_DATE/);
    });

    test('overdue=true accepte aussi', async () => {
        db.query.mockResolvedValueOnce({ rows: [] });
        await ctrl.listMine(mockReq({ user: { id: 7 }, query: { overdue: 'true' } }), mockRes(), mockNext());
        expect(db.query.mock.calls[0][0]).toMatch(/deadline_date < CURRENT_DATE/);
    });

    test('retourne count + data', async () => {
        db.query.mockResolvedValueOnce({ rows: [{ id: 1 }, { id: 2 }] });
        const res = mockRes();
        await ctrl.listMine(mockReq({ user: { id: 7 }, query: {} }), res, mockNext());
        expect(res.body.count).toBe(2);
    });

    test('erreur propagée au next()', async () => {
        const err = new Error('db');
        db.query.mockRejectedValue(err);
        const next = mockNext();
        await ctrl.listMine(mockReq({ user: { id: 7 }, query: {} }), mockRes(), next);
        expect(next).toHaveBeenCalledWith(err);
    });
});

describe('measures.myStats', () => {
    test('PG strings converties en nombres', async () => {
        db.query.mockResolvedValueOnce({
            rows: [{
                preconisee: '3', executee: '1', non_executee: '0', observations: '0',
                pending: '3', overdue: '1', due_soon: '2', total: '4'
            }]
        });
        const res = mockRes();
        await ctrl.myStats(mockReq({ user: { id: 7 } }), res, mockNext());
        expect(res.body.data.preconisee).toBe(3);
        expect(res.body.data.total).toBe(4);
        expect(res.body.data.overdue).toBe(1);
    });

    test('rows vide → objet vide', async () => {
        db.query.mockResolvedValueOnce({ rows: [] });
        const res = mockRes();
        await ctrl.myStats(mockReq({ user: { id: 7 } }), res, mockNext());
        expect(res.body.data).toEqual({});
    });
});
