jest.mock('../../../src/config/db', () => require('../../helpers/db').createDbMock());

const db = require('../../../src/config/db');
const ProjectModel = require('../../../src/models/project.model');

beforeEach(() => jest.clearAllMocks());

describe('ProjectModel batch updates (transactions)', () => {
    test('updateLocalities BEGIN + DELETE + INSERTs + COMMIT', async () => {
        const client = db.__client;
        client.query.mockResolvedValue({});
        await ProjectModel.updateLocalities(1, [{ region: 'A' }, { region: 'B' }]);
        const calls = client.query.mock.calls.map(c => c[0]);
        expect(calls[0]).toBe('BEGIN');
        expect(calls.filter(q => /INSERT INTO localities/.test(q))).toHaveLength(2);
        expect(calls).toContain('COMMIT');
    });
    test('updateLocalities ROLLBACK si INSERT échoue', async () => {
        const client = db.__client;
        client.query
            .mockResolvedValueOnce({}) // BEGIN
            .mockResolvedValueOnce({}) // DELETE
            .mockRejectedValueOnce(new Error('boom'));
        await expect(ProjectModel.updateLocalities(1, [{}])).rejects.toThrow('boom');
        expect(client.query.mock.calls.some(c => c[0] === 'ROLLBACK')).toBe(true);
    });
    test('updateMeasures auto-lie les structures aux project_structures', async () => {
        const client = db.__client;
        client.query.mockResolvedValue({});
        await ProjectModel.updateMeasures(1, [
            { description: 'm1', structure_id: 5 },
            { description: 'm2', structure_id: 5 }, // déduppé par Set
            { description: 'm3', structure_id: 9 },
        ]);
        const insertLinks = client.query.mock.calls.filter(c => /INSERT INTO project_structures/.test(c[0]));
        // 2 structures uniques
        expect(insertLinks).toHaveLength(2);
    });
    test('updateStakeholders', async () => {
        const client = db.__client;
        client.query.mockResolvedValue({});
        await ProjectModel.updateStakeholders(1, [{ name: 'A' }]);
        const calls = client.query.mock.calls.map(c => c[0]);
        expect(calls.filter(q => /INSERT INTO stakeholders/.test(q))).toHaveLength(1);
    });
    test('updateFunding force currency=FCFA', async () => {
        const client = db.__client;
        client.query.mockResolvedValue({});
        await ProjectModel.updateFunding(1, [{ amount: 100, source: 'S' }]);
        const insertCall = client.query.mock.calls.find(c => /INSERT INTO financing/.test(c[0]));
        expect(insertCall[1][2]).toBe('FCFA');
    });
});

describe('ProjectModel.update', () => {
    test('convertit start_date FR → SQL', async () => {
        db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });
        await ProjectModel.update(1, { title: 'T', start_date: '15/01/2024' });
        expect(db.query.mock.calls[0][1][6]).toBe('2024-01-15');
    });
});

describe('ProjectModel.updateProgress / assignUserToMeasure / updateMeasureStatus / reassignMeasure', () => {
    test('updateProgress', async () => {
        db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });
        await ProjectModel.updateProgress(1, 75);
        expect(db.query.mock.calls[0][1]).toEqual([75, 1]);
    });
    test('assignUserToMeasure', async () => {
        db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });
        await ProjectModel.assignUserToMeasure(5, 7);
        expect(db.query.mock.calls[0][1]).toEqual([7, 5]);
    });
    test('updateMeasureStatus', async () => {
        db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });
        await ProjectModel.updateMeasureStatus(5, 'executee', 'ok');
        expect(db.query.mock.calls[0][1]).toEqual(['executee', 'ok', 5]);
    });
    test('reassignMeasure : null si mesure absente du projet', async () => {
        db.query.mockResolvedValueOnce({ rows: [] });
        const r = await ProjectModel.reassignMeasure(5, 1, { structure_id: 3 });
        expect(r).toBe(null);
    });
    test('reassignMeasure : auto-lie la nouvelle structure au projet', async () => {
        db.query
            .mockResolvedValueOnce({ rows: [{ id: 5, project_id: 1, structure_id: 9 }] })
            .mockResolvedValueOnce({ rows: [] });
        const r = await ProjectModel.reassignMeasure(5, 1, { structure_id: 9 });
        expect(r.id).toBe(5);
        expect(db.query.mock.calls[1][0]).toMatch(/INSERT INTO project_structures/);
    });
});

describe('ProjectModel.addStakeholder / addFinancing / addLocality / addMeasure', () => {
    test('addStakeholder', async () => {
        db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });
        await ProjectModel.addStakeholder(1, { name: 'X' });
        expect(db.query.mock.calls[0][1][1]).toBe('X');
    });
    test('addFinancing defaults currency=FCFA', async () => {
        db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });
        await ProjectModel.addFinancing(1, { amount: 100 });
        expect(db.query.mock.calls[0][1][2]).toBe('FCFA');
    });
    test('addLocality', async () => {
        db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });
        await ProjectModel.addLocality(1, { region: 'Dakar' });
        expect(db.query.mock.calls[0][1][1]).toBe('Dakar');
    });
    test('addMeasure + auto-assign structure', async () => {
        db.query
            .mockResolvedValueOnce({ rows: [{ id: 10 }] }) // INSERT measure
            .mockResolvedValueOnce({ rows: [] });           // INSERT project_structures
        await ProjectModel.addMeasure(1, { description: 'm', structure_id: 5 });
        expect(db.query.mock.calls[1][0]).toMatch(/INSERT INTO project_structures/);
    });
    test('addMeasure sans structure : pas de lien', async () => {
        db.query.mockResolvedValueOnce({ rows: [{ id: 10 }] });
        await ProjectModel.addMeasure(1, { description: 'm' });
        expect(db.query).toHaveBeenCalledTimes(1);
    });
});

describe('ProjectModel.getComments / getStats', () => {
    test('getComments', async () => {
        db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });
        expect(await ProjectModel.getComments(1)).toHaveLength(1);
    });
    test('getStats sans structureId', async () => {
        db.query.mockResolvedValueOnce({ rows: [{ total: '5' }] });
        const r = await ProjectModel.getStats();
        expect(r.total).toBe('5');
        expect(db.query.mock.calls[0][1]).toEqual([]);
    });
    test('getStats avec structureId : filtre via project_structures', async () => {
        db.query.mockResolvedValueOnce({ rows: [{}] });
        await ProjectModel.getStats(5);
        expect(db.query.mock.calls[0][0]).toMatch(/project_structures/);
    });
});

describe('ProjectModel.findDeleted', () => {
    test('retourne projets supprimés', async () => {
        db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });
        expect(await ProjectModel.findDeleted()).toHaveLength(1);
        expect(db.query.mock.calls[0][0]).toMatch(/deleted_at IS NOT NULL/);
    });
});
