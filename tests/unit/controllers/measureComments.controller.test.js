jest.mock('../../../src/config/db', () => require('../../helpers/db').createDbMock());
jest.mock('../../../src/models/measureComment.model', () => ({
    create: jest.fn(),
    getByMeasureId: jest.fn(),
    delete: jest.fn(),
    canUserModify: jest.fn(),
}));
jest.mock('../../../src/models/project.model', () => ({}));
jest.mock('../../../src/models/notification.model', () => ({ create: jest.fn().mockResolvedValue(null) }));

const db = require('../../../src/config/db');
const MeasureCommentModel = require('../../../src/models/measureComment.model');
const NotificationModel = require('../../../src/models/notification.model');
const ctrl = require('../../../src/controllers/measureComments.controller');
const { mockReq, mockRes, mockNext } = require('../../helpers/http');

beforeEach(() => jest.clearAllMocks());

describe('measureComments.createComment', () => {
    test('400 si comment vide', async () => {
        const res = mockRes();
        await ctrl.createComment(mockReq({
            params: { measureId: '1' }, user: { id: 1 }, body: { comment: '  ' }
        }), res, mockNext());
        expect(res.statusCode).toBe(400);
    });

    test('201 + notifie l\'assigné si ≠ auteur', async () => {
        MeasureCommentModel.create.mockResolvedValue({ id: 99 });
        db.query.mockResolvedValue({
            rows: [{ assigned_user_id: 42, description: 'd', project_id: 5, project_title: 'P' }]
        });
        const res = mockRes();
        await ctrl.createComment(mockReq({
            params: { measureId: '1' }, user: { id: 1 }, body: { comment: 'hi' }
        }), res, mockNext());
        expect(res.statusCode).toBe(201);
        // notification créée de façon async — attendre que la promesse se résolve
        await new Promise(setImmediate);
        expect(NotificationModel.create).toHaveBeenCalled();
        expect(NotificationModel.create.mock.calls[0][0].userId).toBe(42);
    });

    test('ne notifie PAS si l\'assigné est l\'auteur', async () => {
        MeasureCommentModel.create.mockResolvedValue({ id: 99 });
        db.query.mockResolvedValue({
            rows: [{ assigned_user_id: 1, description: 'd', project_id: 5, project_title: 'P' }]
        });
        await ctrl.createComment(mockReq({
            params: { measureId: '1' }, user: { id: 1 }, body: { comment: 'hi' }
        }), mockRes(), mockNext());
        await new Promise(setImmediate);
        expect(NotificationModel.create).not.toHaveBeenCalled();
    });

    test('erreur de charge notification silenced (best effort)', async () => {
        MeasureCommentModel.create.mockResolvedValue({ id: 99 });
        db.query.mockRejectedValue(new Error('db err on notif'));
        const res = mockRes();
        await ctrl.createComment(mockReq({
            params: { measureId: '1' }, user: { id: 1 }, body: { comment: 'hi' }
        }), res, mockNext());
        expect(res.statusCode).toBe(201); // comment créé malgré l'erreur de notif
    });
});

describe('measureComments.getCommentsByMeasure', () => {
    test('200 avec data', async () => {
        MeasureCommentModel.getByMeasureId.mockResolvedValue([{ id: 1 }]);
        const res = mockRes();
        await ctrl.getCommentsByMeasure(mockReq({ params: { measureId: '5' } }), res, mockNext());
        expect(res.body.data).toHaveLength(1);
    });
});

describe('measureComments.deleteComment', () => {
    test('403 si ni auteur ni admin', async () => {
        MeasureCommentModel.canUserModify.mockResolvedValue(false);
        const res = mockRes();
        await ctrl.deleteComment(mockReq({
            params: { id: '1' }, user: { id: 2, role: 'utilisateur' }
        }), res, mockNext());
        expect(res.statusCode).toBe(403);
    });
    test('admin passe même si canModify=false', async () => {
        MeasureCommentModel.canUserModify.mockResolvedValue(false);
        const res = mockRes();
        await ctrl.deleteComment(mockReq({
            params: { id: '1' }, user: { id: 2, role: 'admin' }
        }), res, mockNext());
        expect(res.statusCode).toBe(200);
        expect(MeasureCommentModel.delete).toHaveBeenCalledWith('1');
    });
    test('auteur supprime', async () => {
        MeasureCommentModel.canUserModify.mockResolvedValue(true);
        const res = mockRes();
        await ctrl.deleteComment(mockReq({
            params: { id: '1' }, user: { id: 2, role: 'utilisateur' }
        }), res, mockNext());
        expect(res.statusCode).toBe(200);
    });
});
