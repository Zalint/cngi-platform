jest.mock('../../../src/config/db', () => require('../../helpers/db').createDbMock());

const db = require('../../../src/config/db');
const MeasureCommentModel = require('../../../src/models/measureComment.model');

beforeEach(() => jest.clearAllMocks());

describe('MeasureCommentModel', () => {
    test('create INSERT basique (pas de ON CONFLICT)', async () => {
        db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });
        await MeasureCommentModel.create(5, 7, 'hi');
        const [q, params] = db.query.mock.calls[0];
        expect(q).not.toMatch(/ON CONFLICT/);
        expect(params).toEqual([5, 7, 'hi']);
    });

    test('getByMeasureId ordonne DESC', async () => {
        db.query.mockResolvedValueOnce({ rows: [] });
        await MeasureCommentModel.getByMeasureId(5);
        const q = db.query.mock.calls[0][0];
        expect(q).toMatch(/ORDER BY mc\.created_at DESC/);
    });

    test('delete', async () => {
        db.query.mockResolvedValueOnce({ rows: [{ id: 9 }] });
        const r = await MeasureCommentModel.delete(9);
        expect(r.id).toBe(9);
    });

    describe('canUserModify', () => {
        test('false si commentaire introuvable', async () => {
            db.query.mockResolvedValueOnce({ rows: [] });
            expect(await MeasureCommentModel.canUserModify(1, 7)).toBe(false);
        });
        test('true si match', async () => {
            db.query.mockResolvedValueOnce({ rows: [{ user_id: 7 }] });
            expect(await MeasureCommentModel.canUserModify(1, 7)).toBe(true);
        });
        test('false si autre user', async () => {
            db.query.mockResolvedValueOnce({ rows: [{ user_id: 3 }] });
            expect(await MeasureCommentModel.canUserModify(1, 7)).toBe(false);
        });
    });
});
