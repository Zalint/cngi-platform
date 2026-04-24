jest.mock('../../../src/config/db', () => require('../../helpers/db').createDbMock());

const db = require('../../../src/config/db');
const ProjectStructure = require('../../../src/models/projectStructure.model');

beforeEach(() => jest.clearAllMocks());

describe('ProjectStructure basic methods', () => {
    test('getStructuresByProject', async () => {
        db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });
        expect(await ProjectStructure.getStructuresByProject(5)).toHaveLength(1);
        expect(db.query.mock.calls[0][1]).toEqual([5]);
    });

    test('getProjectsByStructure exclut les projets supprimés', async () => {
        db.query.mockResolvedValueOnce({ rows: [] });
        await ProjectStructure.getProjectsByStructure(3);
        expect(db.query.mock.calls[0][0]).toMatch(/deleted_at IS NULL/);
        expect(db.query.mock.calls[0][1]).toEqual([3]);
    });

    test('assignStructure : ON CONFLICT DO NOTHING', async () => {
        db.query.mockResolvedValueOnce({ rows: [{ project_id: 1, structure_id: 2 }] });
        await ProjectStructure.assignStructure(1, 2, 9);
        expect(db.query.mock.calls[0][0]).toMatch(/ON CONFLICT/);
        expect(db.query.mock.calls[0][1]).toEqual([1, 2, 9]);
    });

    test('removeStructure', async () => {
        db.query.mockResolvedValueOnce({ rows: [{ project_id: 1 }] });
        await ProjectStructure.removeStructure(1, 2);
        expect(db.query.mock.calls[0][1]).toEqual([1, 2]);
    });

    test('userHasAccessToProject : true si count > 0', async () => {
        db.query.mockResolvedValueOnce({ rows: [{ count: 1 }] });
        expect(await ProjectStructure.userHasAccessToProject(3, 7)).toBe(true);
        db.query.mockResolvedValueOnce({ rows: [{ count: 0 }] });
        expect(await ProjectStructure.userHasAccessToProject(3, 7)).toBe(false);
    });
});

describe('assignMultipleStructures (transaction)', () => {
    test('commit après DELETE + INSERT', async () => {
        const client = db.__client;
        client.query.mockResolvedValue({ rows: [] });
        await ProjectStructure.assignMultipleStructures(1, [10, 20], 7);
        const calls = client.query.mock.calls.map(c => c[0]);
        expect(calls[0]).toBe('BEGIN');
        expect(calls[1]).toMatch(/DELETE FROM project_structures/);
        expect(calls[2]).toMatch(/INSERT INTO project_structures/);
        expect(calls[3]).toBe('COMMIT');
        expect(client.release).toHaveBeenCalled();
    });

    test('pas d\'INSERT si liste vide', async () => {
        const client = db.__client;
        client.query.mockResolvedValue({ rows: [] });
        await ProjectStructure.assignMultipleStructures(1, [], 7);
        const calls = client.query.mock.calls.map(c => c[0]);
        expect(calls.some(q => /INSERT INTO project_structures/.test(q))).toBe(false);
        expect(calls).toContain('COMMIT');
    });

    test('ROLLBACK en cas d\'erreur', async () => {
        const client = db.__client;
        client.query
            .mockResolvedValueOnce({}) // BEGIN
            .mockRejectedValueOnce(new Error('boom')); // DELETE
        await expect(ProjectStructure.assignMultipleStructures(1, [10], 7)).rejects.toThrow('boom');
        const calls = client.query.mock.calls.map(c => c[0]);
        expect(calls).toContain('ROLLBACK');
        expect(client.release).toHaveBeenCalled();
    });
});
