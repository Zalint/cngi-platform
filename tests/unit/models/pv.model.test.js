jest.mock('../../../src/config/db', () => require('../../helpers/db').createDbMock());

const db = require('../../../src/config/db');
const PvModel = require('../../../src/models/pv.model');

beforeEach(() => jest.clearAllMocks());

// On teste surtout _replaceRefs et les chemins de visibilité indirectement via SQL généré.

describe('PvModel.findAllVisible (visibilité SQL)', () => {
    test('admin : WHERE 1=1 sans clause extra', async () => {
        db.query.mockResolvedValue({ rows: [] });
        await PvModel.findAllVisible({ id: 1, role: 'admin' });
        const [q, params] = db.query.mock.calls[0];
        // Aucune clause AND (...) ajoutée
        expect(q).not.toMatch(/pv\.author_id = \$\d/);
        // Seul param = user.id pour la lecture read_at
        expect(params).toEqual([1]);
    });

    test('utilisateur avec structure : inclut author_id + EXISTS via project_structures', async () => {
        db.query.mockResolvedValue({ rows: [] });
        await PvModel.findAllVisible({ id: 7, role: 'utilisateur', structure_id: 5 });
        const q = db.query.mock.calls[0][0];
        expect(q).toMatch(/pv\.author_id = \$1/);
        expect(q).toMatch(/project_structures/);
    });

    test('commandement_territorial : ajoute territorial_level/value', async () => {
        db.query.mockResolvedValue({ rows: [] });
        await PvModel.findAllVisible({
            id: 7, role: 'commandement_territorial',
            territorial_level: 'region', territorial_value: 'Dakar'
        });
        const [q, params] = db.query.mock.calls[0];
        expect(q).toMatch(/territorial_level/);
        expect(params).toContain('Dakar');
    });

    test('lecteur global (sans structure) : pas de clause', async () => {
        db.query.mockResolvedValue({ rows: [] });
        await PvModel.findAllVisible({ id: 1, role: 'lecteur' });
        expect(db.query.mock.calls[0][0]).not.toMatch(/pv\.author_id = \$\d/);
    });

    test('hydrate projects/measures/sites/localities/attachments si rows non vide', async () => {
        // 1ère query: liste PVs
        db.query.mockResolvedValueOnce({ rows: [{ id: 100 }] });
        // 5 queries parallèles d'hydratation
        db.query
            .mockResolvedValueOnce({ rows: [{ pv_id: 100, id: 1, title: 'P' }] })
            .mockResolvedValueOnce({ rows: [] })
            .mockResolvedValueOnce({ rows: [] })
            .mockResolvedValueOnce({ rows: [] })
            .mockResolvedValueOnce({ rows: [{ pv_id: 100, id: 9, filename: 'f' }] });
        const pvs = await PvModel.findAllVisible({ id: 1, role: 'admin' });
        expect(pvs[0].projects).toEqual([{ id: 1, title: 'P' }]);
        expect(pvs[0].attachments[0].id).toBe(9);
    });
});

describe('PvModel.delete', () => {
    test('n\'autorise que l\'auteur', async () => {
        db.query.mockResolvedValueOnce({ rows: [] });
        await PvModel.delete(1, 7);
        const [q, params] = db.query.mock.calls[0];
        expect(q).toMatch(/author_id = \$2/);
        expect(params).toEqual([1, 7]);
    });
});

describe('PvModel.create (transaction)', () => {
    test('BEGIN + INSERT + _replaceRefs + COMMIT', async () => {
        const client = db.__client;
        client.query
            .mockResolvedValueOnce({}) // BEGIN
            .mockResolvedValueOnce({ rows: [{ id: 100 }] }) // INSERT pv_reports
            // _replaceRefs : pas de wantedProjects/measures/sites/localities (liste vide)
            // → seulement les 4 DELETEs puis COMMIT
            .mockResolvedValue({});
        await PvModel.create(7, 'region', 'Dakar', { title: 'T' });
        const calls = client.query.mock.calls.map(c => c[0]);
        expect(calls[0]).toBe('BEGIN');
        expect(calls[calls.length - 1]).toBe('COMMIT');
        expect(client.release).toHaveBeenCalled();
    });

    test('ROLLBACK si INSERT échoue', async () => {
        const client = db.__client;
        client.query
            .mockResolvedValueOnce({}) // BEGIN
            .mockRejectedValueOnce(new Error('x')); // INSERT
        await expect(PvModel.create(7, 'region', 'Dakar', { title: 'T' })).rejects.toThrow('x');
        expect(client.query.mock.calls.some(c => c[0] === 'ROLLBACK')).toBe(true);
    });
});

describe('PvModel._replaceRefs (scope territorial)', () => {
    test('rejette IDs hors territoire', async () => {
        const client = db.__client;
        // wantedProjects = [1,2], autorisés = [1] → offender
        client.query
            .mockResolvedValueOnce({ rows: [{ id: 1 }] }) // SELECT projects allowed
            .mockResolvedValue({ rows: [] });
        await expect(
            PvModel._replaceRefs(client, 100, { projects: [1, 2] }, { level: 'region', value: 'Dakar' })
        ).rejects.toMatchObject({ statusCode: 403 });
    });
    test('rejette level invalide', async () => {
        const client = db.__client;
        await expect(
            PvModel._replaceRefs(client, 100, { projects: [1] }, { level: 'pays', value: 'X' })
        ).rejects.toThrow(/Invalid/);
    });
    test('admin (sans territory) accepte tous les IDs entiers positifs', async () => {
        const client = db.__client;
        client.query.mockResolvedValue({});
        await PvModel._replaceRefs(client, 100, {
            projects: ['abc', -1, 0, '5'], // filtrés → [5]
            measures: [], sites: [], localities: []
        }, null);
        const insertPvProjects = client.query.mock.calls.filter(c => /INSERT INTO pv_projects/.test(c[0]));
        expect(insertPvProjects).toHaveLength(1);
        expect(insertPvProjects[0][1]).toEqual([100, 5]);
    });
});

describe('PvModel.getPickable', () => {
    test('rejette level invalide', async () => {
        await expect(PvModel.getPickable({
            role: 'commandement_territorial', territorial_level: 'pays', territorial_value: 'X'
        })).rejects.toThrow(/Invalid/);
    });
    test('admin : aucun filtre', async () => {
        db.query
            .mockResolvedValueOnce({ rows: [] }) // projects
            ; // getPickable retourne vite si projectIds = []
        const r = await PvModel.getPickable({ role: 'admin' });
        expect(r).toEqual({ projects: [], sites: [], localities: [], measures: [] });
    });
    test('admin avec projets : charge sites/localities/measures/structures', async () => {
        db.query
            .mockResolvedValueOnce({ rows: [{ id: 1, title: 'P', structure_id: 3 }] }) // projects
            .mockResolvedValueOnce({ rows: [{ id: 10, project_id: 1, name: 'S' }] })    // sites
            .mockResolvedValueOnce({ rows: [] })                                        // localities
            .mockResolvedValueOnce({ rows: [] })                                        // measures
            .mockResolvedValueOnce({ rows: [{ id: 3, code: 'DPGI' }] });                // structures
        const r = await PvModel.getPickable({ role: 'admin' });
        expect(r.projects[0].structure_code).toBe('DPGI');
        expect(r.sites).toHaveLength(1);
    });
});
