jest.mock('../../../src/config/db', () => require('../../helpers/db').createDbMock());

const db = require('../../../src/config/db');
const ConfigModel = require('../../../src/models/config.model');

beforeEach(() => jest.clearAllMocks());

describe('ConfigModel', () => {
    test('getByCategory filtre is_active=true', async () => {
        db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });
        await ConfigModel.getByCategory('priorities');
        expect(db.query.mock.calls[0][0]).toMatch(/is_active = true/);
        expect(db.query.mock.calls[0][1]).toEqual(['priorities']);
    });
    test('getAll', async () => {
        db.query.mockResolvedValueOnce({ rows: [] });
        await ConfigModel.getAll();
        expect(db.query.mock.calls[0][0]).toMatch(/ORDER BY category/);
    });
    test('create : ON CONFLICT DO NOTHING, sort_order defaults 0', async () => {
        db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });
        await ConfigModel.create({ category: 'c', value: 'v', label: 'L' });
        expect(db.query.mock.calls[0][0]).toMatch(/ON CONFLICT DO NOTHING/);
        expect(db.query.mock.calls[0][1][3]).toBe(0);
    });
    test('update avec COALESCE', async () => {
        db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });
        await ConfigModel.update(5, { label: 'New' });
        expect(db.query.mock.calls[0][0]).toMatch(/COALESCE/);
        expect(db.query.mock.calls[0][1][0]).toBe(5);
    });
    test('delete retourne true/false selon rowCount', async () => {
        db.query.mockResolvedValueOnce({ rowCount: 1 });
        expect(await ConfigModel.delete(1)).toBe(true);
        db.query.mockResolvedValueOnce({ rowCount: 0 });
        expect(await ConfigModel.delete(1)).toBe(false);
    });
});
