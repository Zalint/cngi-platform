jest.mock('../../../src/config/db', () => require('../../helpers/db').createDbMock());

const db = require('../../../src/config/db');
const NotificationModel = require('../../../src/models/notification.model');

beforeEach(() => jest.clearAllMocks());

describe('NotificationModel.create', () => {
    test('null si args manquants', async () => {
        expect(await NotificationModel.create({ userId: 1, type: 't' })).toBe(null);
        expect(await NotificationModel.create({ userId: null, type: 't', title: 'x' })).toBe(null);
        expect(db.query).not.toHaveBeenCalled();
    });
    test('insère avec defaults null pour body/linkUrl', async () => {
        db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });
        await NotificationModel.create({ userId: 1, type: 'INFO', title: 'Hi' });
        expect(db.query.mock.calls[0][1]).toEqual([1, 'INFO', 'Hi', null, null]);
    });
});

describe('NotificationModel.listForUser', () => {
    test('limit par défaut 30', async () => {
        db.query.mockResolvedValueOnce({ rows: [] });
        await NotificationModel.listForUser(1);
        expect(db.query.mock.calls[0][1]).toEqual([1, 30]);
    });
    test('limit clampé à [1, 100]', async () => {
        db.query.mockResolvedValueOnce({ rows: [] });
        await NotificationModel.listForUser(1, { limit: 999 });
        expect(db.query.mock.calls[0][1][1]).toBe(100);
        db.query.mockResolvedValueOnce({ rows: [] });
        await NotificationModel.listForUser(1, { limit: -5 });
        expect(db.query.mock.calls[1][1][1]).toBe(1);
    });
    test('onlyUnread ajoute la clause', async () => {
        db.query.mockResolvedValueOnce({ rows: [] });
        await NotificationModel.listForUser(1, { onlyUnread: true });
        expect(db.query.mock.calls[0][0]).toMatch(/is_read = false/);
    });
});

describe('NotificationModel.unreadCount', () => {
    test('retourne le count ou 0', async () => {
        db.query.mockResolvedValueOnce({ rows: [{ count: 5 }] });
        expect(await NotificationModel.unreadCount(1)).toBe(5);
        db.query.mockResolvedValueOnce({ rows: [] });
        expect(await NotificationModel.unreadCount(1)).toBe(0);
    });
});

describe('markRead/markAllRead/remove', () => {
    test('markRead retourne l\'id ou null', async () => {
        db.query.mockResolvedValueOnce({ rows: [{ id: 9 }] });
        expect(await NotificationModel.markRead(1, 9)).toEqual({ id: 9 });
        db.query.mockResolvedValueOnce({ rows: [] });
        expect(await NotificationModel.markRead(1, 9)).toBe(null);
    });
    test('markAllRead retourne rowCount', async () => {
        db.query.mockResolvedValueOnce({ rows: [{ id: 1 }, { id: 2 }], rowCount: 2 });
        expect(await NotificationModel.markAllRead(1)).toBe(2);
    });
    test('remove retourne l\'id ou null', async () => {
        db.query.mockResolvedValueOnce({ rows: [{ id: 9 }] });
        expect(await NotificationModel.remove(1, 9)).toEqual({ id: 9 });
        db.query.mockResolvedValueOnce({ rows: [] });
        expect(await NotificationModel.remove(1, 9)).toBe(null);
    });
});
