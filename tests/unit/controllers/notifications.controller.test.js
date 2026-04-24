jest.mock('../../../src/models/notification.model', () => ({
    listForUser: jest.fn(),
    unreadCount: jest.fn(),
    markRead: jest.fn(),
    markAllRead: jest.fn(),
    remove: jest.fn(),
}));

const NotificationModel = require('../../../src/models/notification.model');
const ctrl = require('../../../src/controllers/notifications.controller');
const { mockReq, mockRes, mockNext } = require('../../helpers/http');

beforeEach(() => jest.clearAllMocks());

describe('notifications.controller', () => {
    test('list lit ?unread=1 et limit', async () => {
        NotificationModel.listForUser.mockResolvedValue([{ id: 1 }]);
        const res = mockRes();
        await ctrl.list(mockReq({ user: { id: 7 }, query: { unread: '1', limit: '10' } }), res, mockNext());
        expect(NotificationModel.listForUser).toHaveBeenCalledWith(7, { limit: 10, onlyUnread: true });
        expect(res.body.count).toBe(1);
    });

    test('unreadCount', async () => {
        NotificationModel.unreadCount.mockResolvedValue(3);
        const res = mockRes();
        await ctrl.unreadCount(mockReq({ user: { id: 7 } }), res, mockNext());
        expect(res.body.count).toBe(3);
    });

    describe('markRead', () => {
        test('400 si id invalide', async () => {
            const res = mockRes();
            await ctrl.markRead(mockReq({ user: { id: 1 }, params: { id: 'xxx' } }), res, mockNext());
            expect(res.statusCode).toBe(400);
        });
        test('OK sinon', async () => {
            NotificationModel.markRead.mockResolvedValue({ id: 9 });
            const res = mockRes();
            await ctrl.markRead(mockReq({ user: { id: 1 }, params: { id: '9' } }), res, mockNext());
            expect(NotificationModel.markRead).toHaveBeenCalledWith(1, 9);
            expect(res.body.data).toEqual({ id: 9 });
        });
    });

    test('markAllRead renvoie marked', async () => {
        NotificationModel.markAllRead.mockResolvedValue(4);
        const res = mockRes();
        await ctrl.markAllRead(mockReq({ user: { id: 1 } }), res, mockNext());
        expect(res.body.marked).toBe(4);
    });

    describe('remove', () => {
        test('400 id invalide', async () => {
            const res = mockRes();
            await ctrl.remove(mockReq({ user: { id: 1 }, params: { id: 'no' } }), res, mockNext());
            expect(res.statusCode).toBe(400);
        });
        test('200', async () => {
            NotificationModel.remove.mockResolvedValue({ id: 5 });
            const res = mockRes();
            await ctrl.remove(mockReq({ user: { id: 1 }, params: { id: '5' } }), res, mockNext());
            expect(res.body.success).toBe(true);
        });
    });
});
