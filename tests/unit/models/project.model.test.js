jest.mock('../../../src/config/db', () => require('../../helpers/db').createDbMock());

const db = require('../../../src/config/db');
const ProjectModel = require('../../../src/models/project.model');

beforeEach(() => jest.clearAllMocks());

describe('ProjectModel.findAll', () => {
    test('sans filtre : pas de clause AND supplémentaire', async () => {
        db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });
        await ProjectModel.findAll();
        const [q, params] = db.query.mock.calls[0];
        expect(params).toEqual([]);
        expect(q).toMatch(/deleted_at IS NULL/);
    });
    test('filtre par structure_id', async () => {
        db.query.mockResolvedValueOnce({ rows: [] });
        await ProjectModel.findAll({ structure_id: 5 });
        expect(db.query.mock.calls[0][1]).toEqual([5]);
    });
    test('filtre combiné status + structure + q', async () => {
        db.query.mockResolvedValueOnce({ rows: [] });
        await ProjectModel.findAll({ structure_id: 5, status: 'en_cours', q: 'digue' });
        expect(db.query.mock.calls[0][1]).toEqual([5, 'en_cours', '%digue%']);
    });
    test('q ignoré si string vide', async () => {
        db.query.mockResolvedValueOnce({ rows: [] });
        await ProjectModel.findAll({ q: '  ' });
        expect(db.query.mock.calls[0][1]).toEqual([]);
    });
});

describe('ProjectModel.findByTerritory', () => {
    test('rejette niveau non autorisé (anti-injection SQL)', async () => {
        await expect(ProjectModel.findByTerritory('pays', 'SN'))
            .rejects.toThrow(/Invalid territorial level/);
    });
    test('accepte region/departement/arrondissement', async () => {
        db.query.mockResolvedValue({ rows: [] });
        await ProjectModel.findByTerritory('region', 'Dakar');
        await ProjectModel.findByTerritory('departement', 'Pikine');
        await ProjectModel.findByTerritory('arrondissement', 'X');
        expect(db.query).toHaveBeenCalledTimes(3);
    });
});

describe('ProjectModel.findById', () => {
    test('retourne null si aucun projet', async () => {
        db.query.mockResolvedValueOnce({ rows: [] });
        expect(await ProjectModel.findById(99)).toBe(null);
    });

    test('agrège localités, sites, mesures (+comments), stakeholders, financing, structures', async () => {
        db.query
            .mockResolvedValueOnce({ rows: [{ id: 1, title: 'P' }] }) // project
            .mockResolvedValueOnce({ rows: [{ id: 10 }] })            // localities
            .mockResolvedValueOnce({ rows: [{ id: 20 }] })            // sites
            .mockResolvedValueOnce({ rows: [{ id: 30 }] })            // measures
            .mockResolvedValueOnce({ rows: [{ id: 31 }] })            // comments of measure 30
            .mockResolvedValueOnce({ rows: [{ id: 40 }] })            // stakeholders
            .mockResolvedValueOnce({ rows: [{ id: 50 }] })            // financing
            .mockResolvedValueOnce({ rows: [{ id: 60 }] });           // assigned_structures

        const project = await ProjectModel.findById(1);
        expect(project).toMatchObject({
            id: 1,
            localities: [{ id: 10 }],
            sites: [{ id: 20 }],
            stakeholders: [{ id: 40 }],
            funding: [{ id: 50 }],
            assigned_structures: [{ id: 60 }],
        });
        expect(project.measures[0].comments).toEqual([{ id: 31 }]);
    });
});

describe('ProjectModel.create', () => {
    test('applique les defaults (status demarrage, progress 0, priority normale)', async () => {
        db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });
        await ProjectModel.create({ title: 'T', structure_id: 5, created_by_user_id: 9 });
        const p = db.query.mock.calls[0][1];
        expect(p[0]).toBe('T');
        expect(p[2]).toBe(5);
        expect(p[4]).toBe('demarrage');
        expect(p[5]).toBe(0);
        expect(p[13]).toBe('normale');
    });
    test('convertit les dates FR vers SQL', async () => {
        db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });
        await ProjectModel.create({ title: 'T', structure_id: 5, created_by_user_id: 9, start_date: '15/01/2024' });
        expect(db.query.mock.calls[0][1][6]).toBe('2024-01-15');
    });
});

describe('ProjectModel._validateVulnerabilityLevel', () => {
    test('defaults to normal', () => {
        expect(ProjectModel._validateVulnerabilityLevel(null)).toBe('normal');
        expect(ProjectModel._validateVulnerabilityLevel('')).toBe('normal');
        expect(ProjectModel._validateVulnerabilityLevel(undefined)).toBe('normal');
    });
    test('accepte valeurs valides', () => {
        expect(ProjectModel._validateVulnerabilityLevel('elevee')).toBe('elevee');
        expect(ProjectModel._validateVulnerabilityLevel('tres_elevee')).toBe('tres_elevee');
    });
    test('throw 400 pour valeur invalide', () => {
        let err;
        try { ProjectModel._validateVulnerabilityLevel('extreme'); } catch (e) { err = e; }
        expect(err).toBeDefined();
        expect(err.statusCode).toBe(400);
        expect(err.field).toBe('vulnerability_level');
    });
});

describe('ProjectModel.addSite', () => {
    test('is_pcs autorisé seulement pour DPGI', async () => {
        db.query
            .mockResolvedValueOnce({ rows: [{ code: 'DPGI' }] }) // check structure
            .mockResolvedValueOnce({ rows: [{ id: 100, is_pcs: true }] });
        const r = await ProjectModel.addSite(1, { name: 'S', is_pcs: true });
        expect(db.query.mock.calls[1][1][10]).toBe(true);
        expect(r.id).toBe(100);
    });
    test('is_pcs forcé à false si structure ≠ DPGI', async () => {
        db.query
            .mockResolvedValueOnce({ rows: [{ code: 'AUTRE' }] })
            .mockResolvedValueOnce({ rows: [{ id: 101 }] });
        await ProjectModel.addSite(1, { name: 'S', is_pcs: true });
        expect(db.query.mock.calls[1][1][10]).toBe(false);
    });
});

describe('ProjectModel.delete / restore / hardDelete', () => {
    test('delete fait un soft delete (UPDATE + deleted_at)', async () => {
        db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });
        await ProjectModel.delete(1);
        expect(db.query.mock.calls[0][0]).toMatch(/UPDATE projects SET deleted_at/);
    });
    test('restore remet deleted_at à NULL', async () => {
        db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });
        await ProjectModel.restore(1);
        expect(db.query.mock.calls[0][0]).toMatch(/deleted_at = NULL/);
    });
    test('hardDelete fait un vrai DELETE', async () => {
        db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });
        await ProjectModel.hardDelete(1);
        expect(db.query.mock.calls[0][0]).toMatch(/^DELETE FROM projects/m);
    });
});

describe('ProjectModel.isProjectManager', () => {
    test('true si match', async () => {
        db.query.mockResolvedValueOnce({ rows: [{ project_manager_id: 7 }] });
        expect(await ProjectModel.isProjectManager(1, 7)).toBe(true);
    });
    test('false si mismatch', async () => {
        db.query.mockResolvedValueOnce({ rows: [{ project_manager_id: 3 }] });
        expect(await ProjectModel.isProjectManager(1, 7)).toBe(false);
    });
    test('false si projet inexistant', async () => {
        db.query.mockResolvedValueOnce({ rows: [] });
        expect(await ProjectModel.isProjectManager(1, 7)).toBe(false);
    });
});

describe('ProjectModel.getStatsByTerritory', () => {
    test('rejette niveau invalide', async () => {
        await expect(ProjectModel.getStatsByTerritory('pays', 'X')).rejects.toThrow(/Invalid/);
    });
});

describe('ProjectModel.updateSites (transaction)', () => {
    test('non-DPGI force is_pcs à false', async () => {
        const client = db.__client;
        client.query
            .mockResolvedValueOnce({}) // BEGIN
            .mockResolvedValueOnce({}) // DELETE sites
            .mockResolvedValueOnce({ rows: [{ code: 'AUTRE' }] }) // structure check
            .mockResolvedValueOnce({}) // INSERT site
            .mockResolvedValueOnce({}); // COMMIT
        await ProjectModel.updateSites(1, [{ name: 'S', is_pcs: true }]);
        // le 11e paramètre du 4e call (INSERT) = is_pcs
        expect(client.query.mock.calls[3][1][10]).toBe(false);
    });
});

describe('ProjectModel.addComment / deleteComment', () => {
    test('addComment', async () => {
        db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });
        await ProjectModel.addComment(5, 9, 'hi');
        expect(db.query.mock.calls[0][1]).toEqual([5, 9, 'hi']);
    });
    test('deleteComment n\'autorise que le propriétaire', async () => {
        db.query.mockResolvedValueOnce({ rows: [] });
        const r = await ProjectModel.deleteComment(1, 9);
        expect(db.query.mock.calls[0][0]).toMatch(/user_id = \$2/);
        expect(r).toBeUndefined();
    });
});
