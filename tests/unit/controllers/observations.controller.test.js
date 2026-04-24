jest.mock('../../../src/models/observation.model', () => ({
    findAll: jest.fn(),
    findById: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    getUnreadCount: jest.fn(),
    markAllAsRead: jest.fn(),
}));

const ObservationModel = require('../../../src/models/observation.model');
const ctrl = require('../../../src/controllers/observations.controller');
const { mockReq, mockRes, mockNext } = require('../../helpers/http');

beforeEach(() => jest.clearAllMocks());

const superviseur = { role: 'superviseur', id: 7 };
const admin = { role: 'admin', id: 1 };
const user = { role: 'utilisateur', id: 2 };

describe('observations.list / getOne', () => {
    test('list transmet les filtres', async () => {
        ObservationModel.findAll.mockResolvedValue([{ id: 1 }]);
        const res = mockRes();
        await ctrl.list(mockReq({ query: { priority: 'urgente' } }), res, mockNext());
        expect(ObservationModel.findAll).toHaveBeenCalledWith({ project_id: undefined, priority: 'urgente', scope: undefined });
        expect(res.body.count).toBe(1);
    });
    test('getOne 404', async () => {
        ObservationModel.findById.mockResolvedValue(null);
        const res = mockRes();
        await ctrl.getOne(mockReq({ params: { id: '1' } }), res, mockNext());
        expect(res.statusCode).toBe(404);
    });
});

describe('observations.create', () => {
    test('403 si pas superviseur', async () => {
        const res = mockRes();
        await ctrl.create(mockReq({ user, body: { title: 'T', content: 'C' } }), res, mockNext());
        expect(res.statusCode).toBe(403);
    });
    test('403 même pour admin (création réservée au superviseur)', async () => {
        const res = mockRes();
        await ctrl.create(mockReq({ user: admin, body: { title: 'T', content: 'C' } }), res, mockNext());
        expect(res.statusCode).toBe(403);
    });
    test('400 si titre vide', async () => {
        const res = mockRes();
        await ctrl.create(mockReq({ user: superviseur, body: { title: '   ', content: 'C' } }), res, mockNext());
        expect(res.statusCode).toBe(400);
    });
    test('400 si contenu vide', async () => {
        const res = mockRes();
        await ctrl.create(mockReq({ user: superviseur, body: { title: 'T', content: '  ' } }), res, mockNext());
        expect(res.statusCode).toBe(400);
    });
    test('400 priorité invalide', async () => {
        const res = mockRes();
        await ctrl.create(mockReq({ user: superviseur, body: { title: 'T', content: 'C', priority: 'bad' } }), res, mockNext());
        expect(res.statusCode).toBe(400);
    });
    test('201 + trim + defaults', async () => {
        ObservationModel.create.mockResolvedValue({ id: 1 });
        const res = mockRes();
        await ctrl.create(mockReq({
            user: superviseur,
            body: { title: '  T  ', content: '  C  ' }
        }), res, mockNext());
        expect(res.statusCode).toBe(201);
        const payload = ObservationModel.create.mock.calls[0][1];
        expect(payload.title).toBe('T');
        expect(payload.content).toBe('C');
        expect(payload.priority).toBe('info');
    });
});

describe('observations.update', () => {
    test('403 si ni superviseur ni admin', async () => {
        const res = mockRes();
        await ctrl.update(mockReq({ user, params: { id: '1' }, body: {} }), res, mockNext());
        expect(res.statusCode).toBe(403);
    });
    test('400 priorité invalide', async () => {
        const res = mockRes();
        await ctrl.update(mockReq({ user: superviseur, params: { id: '1' }, body: { priority: 'x' } }), res, mockNext());
        expect(res.statusCode).toBe(400);
    });
    test('superviseur : authorId = son id', async () => {
        ObservationModel.update.mockResolvedValue({ id: 1 });
        await ctrl.update(mockReq({ user: superviseur, params: { id: '1' }, body: {} }), mockRes(), mockNext());
        expect(ObservationModel.update.mock.calls[0][1]).toBe(7);
    });
    test('admin modère : authorId = null (pas de restriction)', async () => {
        ObservationModel.update.mockResolvedValue({ id: 1 });
        await ctrl.update(mockReq({ user: admin, params: { id: '1' }, body: {} }), mockRes(), mockNext());
        expect(ObservationModel.update.mock.calls[0][1]).toBe(null);
    });
    test('404 si update retourne null', async () => {
        ObservationModel.update.mockResolvedValue(null);
        const res = mockRes();
        await ctrl.update(mockReq({ user: superviseur, params: { id: '1' }, body: {} }), res, mockNext());
        expect(res.statusCode).toBe(404);
    });
});

describe('observations.remove', () => {
    test('403 non autorisé', async () => {
        const res = mockRes();
        await ctrl.remove(mockReq({ user, params: { id: '1' } }), res, mockNext());
        expect(res.statusCode).toBe(403);
    });
    test('admin : authorId=null', async () => {
        ObservationModel.delete.mockResolvedValue({ id: 1 });
        await ctrl.remove(mockReq({ user: admin, params: { id: '1' } }), mockRes(), mockNext());
        expect(ObservationModel.delete.mock.calls[0][1]).toBe(null);
    });
    test('404 si rien à supprimer', async () => {
        ObservationModel.delete.mockResolvedValue(null);
        const res = mockRes();
        await ctrl.remove(mockReq({ user: superviseur, params: { id: '1' } }), res, mockNext());
        expect(res.statusCode).toBe(404);
    });
});

describe('observations.unreadCount / markRead', () => {
    test('unreadCount', async () => {
        ObservationModel.getUnreadCount.mockResolvedValue(5);
        const res = mockRes();
        await ctrl.unreadCount(mockReq({ user: { id: 7 } }), res, mockNext());
        expect(res.body.count).toBe(5);
    });
    test('markRead', async () => {
        const res = mockRes();
        await ctrl.markRead(mockReq({ user: { id: 7 } }), res, mockNext());
        expect(ObservationModel.markAllAsRead).toHaveBeenCalledWith(7);
        expect(res.body.success).toBe(true);
    });
});
