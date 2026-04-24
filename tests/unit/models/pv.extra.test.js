jest.mock('../../../src/config/db', () => require('../../helpers/db').createDbMock());

const db = require('../../../src/config/db');
const PvModel = require('../../../src/models/pv.model');

beforeEach(() => jest.clearAllMocks());

describe('PvModel.findByIdForUser', () => {
    test('null si PV non visible', async () => {
        db.query.mockResolvedValueOnce({ rows: [] });
        const r = await PvModel.findByIdForUser(1, { id: 7, role: 'admin' });
        expect(r).toBe(null);
    });
    test('hydrate les relations', async () => {
        db.query
            .mockResolvedValueOnce({ rows: [{ id: 1 }] }) // PV
            .mockResolvedValueOnce({ rows: [{ id: 10 }] }) // projects
            .mockResolvedValueOnce({ rows: [] })            // measures
            .mockResolvedValueOnce({ rows: [] })            // sites
            .mockResolvedValueOnce({ rows: [] })            // localities
            .mockResolvedValueOnce({ rows: [{ id: 99 }] }); // attachments
        const pv = await PvModel.findByIdForUser(1, { id: 7, role: 'admin' });
        expect(pv.projects[0].id).toBe(10);
        expect(pv.attachments[0].id).toBe(99);
    });
});

describe('PvModel.update', () => {
    test('null si aucune ligne affectée (pas l\'auteur)', async () => {
        const client = db.__client;
        client.query
            .mockResolvedValueOnce({}) // BEGIN
            .mockResolvedValueOnce({ rowCount: 0, rows: [] }); // UPDATE
        const r = await PvModel.update(1, 7, { title: 'T' });
        expect(r).toBe(null);
        expect(client.query.mock.calls.some(c => c[0] === 'ROLLBACK')).toBe(true);
    });
    test('update + _replaceRefs si refs fournies', async () => {
        const client = db.__client;
        client.query
            .mockResolvedValueOnce({}) // BEGIN
            .mockResolvedValueOnce({
                rowCount: 1,
                rows: [{ id: 1, territorial_level: 'region', territorial_value: 'Dakar' }]
            })
            // _replaceRefs: SELECT projects allowed
            .mockResolvedValueOnce({ rows: [{ id: 10 }] })
            .mockResolvedValue({ rows: [] }); // DELETEs + INSERTs + COMMIT
        const r = await PvModel.update(1, 7, { title: 'T', projects: [10] });
        expect(r.id).toBe(1);
        expect(client.query.mock.calls.some(c => c[0] === 'COMMIT')).toBe(true);
    });
});

describe('PvModel.getUnreadCount / markAsRead / markAllAsRead', () => {
    test('getUnreadCount retourne un nombre', async () => {
        db.query.mockResolvedValueOnce({ rows: [{ unread: '4' }] });
        expect(await PvModel.getUnreadCount({ id: 7, role: 'admin' })).toBe(4);
    });
    test('markAsRead : UPSERT', async () => {
        db.query.mockResolvedValueOnce({});
        await PvModel.markAsRead(10, 7);
        const [q, params] = db.query.mock.calls[0];
        expect(q).toMatch(/ON CONFLICT/);
        expect(params).toEqual([10, 7]);
    });
    test('markAllAsRead pour admin : INSERT SELECT sans clause visibilité', async () => {
        db.query.mockResolvedValueOnce({});
        await PvModel.markAllAsRead({ id: 7, role: 'admin' });
        expect(db.query.mock.calls[0][0]).toMatch(/INSERT INTO pv_reads/);
    });
});
