jest.mock('../../../src/config/db', () => require('../../helpers/db').createDbMock());
jest.mock('../../../src/models/projectStructure.model', () => ({
    userHasAccessToProject: jest.fn(),
}));

const db = require('../../../src/config/db');
const ProjectStructure = require('../../../src/models/projectStructure.model');
const { canUserAccessProject } = require('../../../src/utils/projectAccess');

beforeEach(() => {
    jest.clearAllMocks();
});

describe('canUserAccessProject', () => {
    test('refuse si user ou projectId manquant', async () => {
        expect(await canUserAccessProject(null, 1)).toBe(false);
        expect(await canUserAccessProject({ id: 1 }, null)).toBe(false);
    });

    test('admin a accès à tout', async () => {
        expect(await canUserAccessProject({ role: 'admin' }, 10)).toBe(true);
        expect(ProjectStructure.userHasAccessToProject).not.toHaveBeenCalled();
    });

    test('superviseur a accès à tout', async () => {
        expect(await canUserAccessProject({ role: 'superviseur' }, 10)).toBe(true);
    });

    test('lecteur global (sans structure) a accès', async () => {
        expect(await canUserAccessProject({ role: 'lecteur', id: 2 }, 10)).toBe(true);
    });

    test('auditeur global (sans structure) a accès', async () => {
        expect(await canUserAccessProject({ role: 'auditeur', id: 2 }, 10)).toBe(true);
    });

    test('lecteur scopé : délègue à ProjectStructure', async () => {
        ProjectStructure.userHasAccessToProject.mockResolvedValue(true);
        const ok = await canUserAccessProject({ role: 'lecteur', id: 2, structure_id: 5 }, 10);
        expect(ok).toBe(true);
        expect(ProjectStructure.userHasAccessToProject).toHaveBeenCalledWith(2, 10);
    });

    test('utilisateur sans structure : refus', async () => {
        expect(await canUserAccessProject({ role: 'utilisateur', id: 2 }, 10)).toBe(false);
    });

    test('utilisateur avec structure : délègue', async () => {
        ProjectStructure.userHasAccessToProject.mockResolvedValue(false);
        const ok = await canUserAccessProject({ role: 'utilisateur', id: 2, structure_id: 5 }, 10);
        expect(ok).toBe(false);
    });

    test('directeur : lecture globale (true sans appel à userHasAccessToProject)', async () => {
        expect(await canUserAccessProject({ role: 'directeur', id: 2, structure_id: 5 }, 10)).toBe(true);
        expect(ProjectStructure.userHasAccessToProject).not.toHaveBeenCalled();
    });

    test('directeur sans structure : lecture globale aussi', async () => {
        expect(await canUserAccessProject({ role: 'directeur', id: 2 }, 10)).toBe(true);
    });

    describe('commandement_territorial', () => {
        test('refus sans level/value', async () => {
            expect(await canUserAccessProject({ role: 'commandement_territorial' }, 10)).toBe(false);
        });
        test('refus si level invalide', async () => {
            expect(await canUserAccessProject({
                role: 'commandement_territorial', territorial_level: 'pays', territorial_value: 'Senegal'
            }, 10)).toBe(false);
        });
        test('accès si projet a une localité/site dans le territoire', async () => {
            db.query.mockResolvedValueOnce({ rows: [{ '?column?': 1 }], rowCount: 1 });
            const ok = await canUserAccessProject({
                role: 'commandement_territorial', territorial_level: 'region', territorial_value: 'Dakar'
            }, 10);
            expect(ok).toBe(true);
            expect(db.query).toHaveBeenCalled();
            expect(db.query.mock.calls[0][1]).toEqual([10, 'Dakar']);
        });
        test('refus si aucune correspondance', async () => {
            db.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });
            expect(await canUserAccessProject({
                role: 'commandement_territorial', territorial_level: 'departement', territorial_value: 'Pikine'
            }, 10)).toBe(false);
        });
    });

    test('rôle inconnu → refus', async () => {
        expect(await canUserAccessProject({ role: 'invite' }, 10)).toBe(false);
    });
});

describe('canUserModifyProject', () => {
    const { canUserModifyProject } = require('../../../src/utils/projectAccess');

    test('refus si user ou projectId manquant', async () => {
        expect(await canUserModifyProject(null, 1)).toBe(false);
        expect(await canUserModifyProject({ role: 'admin' }, null)).toBe(false);
    });

    test('admin : true', async () => {
        expect(await canUserModifyProject({ role: 'admin' }, 10)).toBe(true);
    });

    test('directeur sans structure : refus', async () => {
        expect(await canUserModifyProject({ role: 'directeur', id: 2 }, 10)).toBe(false);
    });

    test('directeur avec structure : délègue à userHasAccessToProject', async () => {
        ProjectStructure.userHasAccessToProject.mockResolvedValue(true);
        expect(await canUserModifyProject({ role: 'directeur', id: 2, structure_id: 5 }, 10)).toBe(true);
        expect(ProjectStructure.userHasAccessToProject).toHaveBeenCalledWith(2, 10);
    });

    test('utilisateur avec structure : délègue', async () => {
        ProjectStructure.userHasAccessToProject.mockResolvedValue(false);
        expect(await canUserModifyProject({ role: 'utilisateur', id: 2, structure_id: 5 }, 10)).toBe(false);
    });

    test('superviseur, lecteur, auditeur, commandement_territorial : refus écriture', async () => {
        expect(await canUserModifyProject({ role: 'superviseur' }, 10)).toBe(false);
        expect(await canUserModifyProject({ role: 'lecteur', structure_id: 5 }, 10)).toBe(false);
        expect(await canUserModifyProject({ role: 'auditeur', structure_id: 5 }, 10)).toBe(false);
        expect(await canUserModifyProject({ role: 'commandement_territorial', territorial_level: 'region', territorial_value: 'Dakar' }, 10)).toBe(false);
    });
});

describe('isDirecteurOfProject', () => {
    const { isDirecteurOfProject } = require('../../../src/utils/projectAccess');

    test('false sans user / sans projet', () => {
        expect(isDirecteurOfProject(null, { id: 1, structure_id: 5 })).toBe(false);
        expect(isDirecteurOfProject({ role: 'directeur', structure_id: 5 }, null)).toBe(false);
    });
    test('false si rôle ≠ directeur', () => {
        expect(isDirecteurOfProject({ role: 'admin', structure_id: 5 }, { structure_id: 5 })).toBe(false);
    });
    test('false si directeur sans structure', () => {
        expect(isDirecteurOfProject({ role: 'directeur' }, { structure_id: 5 })).toBe(false);
    });
    test('false si structures différentes', () => {
        expect(isDirecteurOfProject({ role: 'directeur', structure_id: 5 }, { structure_id: 9 })).toBe(false);
    });
    test('true si directeur de la structure principale du projet', () => {
        expect(isDirecteurOfProject({ role: 'directeur', structure_id: 5 }, { structure_id: 5 })).toBe(true);
    });
});
