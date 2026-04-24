jest.mock('../../../src/models/pv.model', () => ({
    findAllVisible: jest.fn(),
    findByIdForUser: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    getPickable: jest.fn(),
    getUnreadCount: jest.fn(),
    markAllAsRead: jest.fn(),
    markAsRead: jest.fn(),
}));

const PvModel = require('../../../src/models/pv.model');
const ctrl = require('../../../src/controllers/pv.controller');
const { mockReq, mockRes, mockNext } = require('../../helpers/http');

beforeEach(() => jest.clearAllMocks());

const writer = {
    id: 1, role: 'commandement_territorial',
    territorial_level: 'region', territorial_value: 'Dakar'
};

describe('pv.list / getOne', () => {
    test('list renvoie count', async () => {
        PvModel.findAllVisible.mockResolvedValue([{ id: 1 }]);
        const res = mockRes();
        await ctrl.list(mockReq({ user: { role: 'admin' } }), res, mockNext());
        expect(res.body.count).toBe(1);
    });
    test('getOne 404 si non visible', async () => {
        PvModel.findByIdForUser.mockResolvedValue(null);
        const res = mockRes();
        await ctrl.getOne(mockReq({ params: { id: '1' }, user: {} }), res, mockNext());
        expect(res.statusCode).toBe(404);
    });
});

describe('pv.create', () => {
    test('403 si utilisateur n\'est pas commandement_territorial complet', async () => {
        const res = mockRes();
        await ctrl.create(mockReq({ user: { role: 'admin' }, body: { title: 'X' } }), res, mockNext());
        expect(res.statusCode).toBe(403);
    });
    test('400 si titre vide', async () => {
        const res = mockRes();
        await ctrl.create(mockReq({ user: writer, body: { title: '  ' } }), res, mockNext());
        expect(res.statusCode).toBe(400);
    });
    test('400 si priorité invalide', async () => {
        const res = mockRes();
        await ctrl.create(mockReq({ user: writer, body: { title: 'T', priority: 'low' } }), res, mockNext());
        expect(res.statusCode).toBe(400);
    });
    test('201 succès + trim du titre', async () => {
        PvModel.create.mockResolvedValue({ id: 10 });
        const res = mockRes();
        await ctrl.create(mockReq({ user: writer, body: { title: '  T  ' } }), res, mockNext());
        expect(res.statusCode).toBe(201);
        expect(PvModel.create.mock.calls[0][3].title).toBe('T');
        expect(PvModel.create.mock.calls[0][1]).toBe('region');
        expect(PvModel.create.mock.calls[0][2]).toBe('Dakar');
    });
});

describe('pv.update / remove', () => {
    test('update 403 pour non-writer', async () => {
        const res = mockRes();
        await ctrl.update(mockReq({ user: { role: 'admin' }, body: {} }), res, mockNext());
        expect(res.statusCode).toBe(403);
    });
    test('update 400 priorité invalide', async () => {
        const res = mockRes();
        await ctrl.update(mockReq({ user: writer, params: { id: '1' }, body: { priority: 'low' } }), res, mockNext());
        expect(res.statusCode).toBe(400);
    });
    test('update 404 si non trouvé', async () => {
        PvModel.update.mockResolvedValue(null);
        const res = mockRes();
        await ctrl.update(mockReq({ user: writer, params: { id: '1' }, body: {} }), res, mockNext());
        expect(res.statusCode).toBe(404);
    });
    test('remove 404 si non trouvé', async () => {
        PvModel.delete.mockResolvedValue(null);
        const res = mockRes();
        await ctrl.remove(mockReq({ user: writer, params: { id: '1' } }), res, mockNext());
        expect(res.statusCode).toBe(404);
    });
});

describe('pv.unreadCount / markAllRead / markOneRead / pickable', () => {
    test('unreadCount', async () => {
        PvModel.getUnreadCount.mockResolvedValue(3);
        const res = mockRes();
        await ctrl.unreadCount(mockReq({ user: { id: 1, role: 'admin' } }), res, mockNext());
        expect(res.body.count).toBe(3);
    });
    test('markAllRead', async () => {
        const res = mockRes();
        await ctrl.markAllRead(mockReq({ user: { id: 1, role: 'admin' } }), res, mockNext());
        expect(res.body.success).toBe(true);
    });
    test('markOneRead', async () => {
        const res = mockRes();
        await ctrl.markOneRead(mockReq({ user: { id: 1 }, params: { id: '5' } }), res, mockNext());
        expect(PvModel.markAsRead).toHaveBeenCalledWith('5', 1);
    });
    test('pickable', async () => {
        PvModel.getPickable.mockResolvedValue({ projects: [], sites: [], localities: [], measures: [] });
        const res = mockRes();
        await ctrl.pickable(mockReq({ user: { role: 'admin' } }), res, mockNext());
        expect(res.body.data).toHaveProperty('projects');
    });
});
