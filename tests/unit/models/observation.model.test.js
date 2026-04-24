jest.mock('../../../src/config/db', () => require('../../helpers/db').createDbMock());

const db = require('../../../src/config/db');
const ObservationModel = require('../../../src/models/observation.model');

beforeEach(() => jest.clearAllMocks());

describe('ObservationModel.findAll', () => {
    test('sans résultat : retourne [] sans charger uploads', async () => {
        db.query.mockResolvedValueOnce({ rows: [] });
        const r = await ObservationModel.findAll();
        expect(r).toEqual([]);
        expect(db.query).toHaveBeenCalledTimes(1);
    });

    test('charge les uploads attachés si rows non vides', async () => {
        db.query
            .mockResolvedValueOnce({ rows: [{ id: 1 }, { id: 2 }] })
            .mockResolvedValueOnce({ rows: [{ entity_id: 1, id: 100, filename: 'f' }] });
        const r = await ObservationModel.findAll();
        expect(r[0].attachments).toHaveLength(1);
        expect(r[1].attachments).toEqual([]);
    });

    test('filtre project_id / priority / scope=global', async () => {
        db.query.mockResolvedValueOnce({ rows: [] });
        await ObservationModel.findAll({ project_id: 5, priority: 'urgente', scope: 'global' });
        const [q, params] = db.query.mock.calls[0];
        expect(q).toMatch(/project_id IS NULL/);
        expect(params).toEqual([5, 'urgente']);
    });

    test('scope=project', async () => {
        db.query.mockResolvedValueOnce({ rows: [] });
        await ObservationModel.findAll({ scope: 'project' });
        expect(db.query.mock.calls[0][0]).toMatch(/project_id IS NOT NULL/);
    });
});

describe('ObservationModel.findById / create / update / delete', () => {
    test('findById → null si introuvable', async () => {
        db.query.mockResolvedValueOnce({ rows: [] });
        expect(await ObservationModel.findById(1)).toBe(null);
    });

    test('create defaults priority=info', async () => {
        db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });
        await ObservationModel.create(7, { title: 'T', content: 'C' });
        const p = db.query.mock.calls[0][1];
        expect(p[4]).toBe('info');
        expect(p[5]).toBe(null); // deadline
        expect(p[1]).toBe(null); // project_id
    });

    test('update avec authorId : clause author_id ajoutée', async () => {
        db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });
        await ObservationModel.update(1, 7, { title: 'T' });
        const [q, params] = db.query.mock.calls[0];
        expect(q).toMatch(/author_id = \$7/);
        expect(params).toHaveLength(7);
        expect(params[6]).toBe(7);
    });

    test('update admin (authorId null) : pas de clause author_id', async () => {
        db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });
        await ObservationModel.update(1, null, { title: 'T' });
        expect(db.query.mock.calls[0][0]).not.toMatch(/author_id = \$/);
    });

    test('delete avec authorId : clause auteur', async () => {
        db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });
        await ObservationModel.delete(1, 7);
        expect(db.query.mock.calls[0][0]).toMatch(/author_id = \$2/);
        expect(db.query.mock.calls[0][1]).toEqual([1, 7]);
    });

    test('delete admin', async () => {
        db.query.mockResolvedValueOnce({ rows: [] });
        await ObservationModel.delete(1);
        expect(db.query.mock.calls[0][1]).toEqual([1]);
    });
});

describe('ObservationModel unread tracking', () => {
    test('getUnreadCount retourne un nombre', async () => {
        db.query.mockResolvedValueOnce({ rows: [{ unread: '3' }] });
        expect(await ObservationModel.getUnreadCount(7)).toBe(3);
    });
    test('getUnreadCount 0 si rien', async () => {
        db.query.mockResolvedValueOnce({ rows: [{ unread: '0' }] });
        expect(await ObservationModel.getUnreadCount(7)).toBe(0);
    });
    test('markAllAsRead : UPSERT', async () => {
        db.query.mockResolvedValueOnce({ rows: [] });
        await ObservationModel.markAllAsRead(7);
        expect(db.query.mock.calls[0][0]).toMatch(/ON CONFLICT/);
        expect(db.query.mock.calls[0][1]).toEqual([7]);
    });
});
