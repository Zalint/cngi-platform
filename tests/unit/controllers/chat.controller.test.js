const mockCompletionsCreate = jest.fn();

jest.mock('openai', () => jest.fn().mockImplementation(() => ({
    chat: { completions: { create: mockCompletionsCreate } }
})));
jest.mock('../../../src/models/project.model', () => ({
    findAll: jest.fn(),
    findById: jest.fn(),
    findByTerritory: jest.fn(),
}));
jest.mock('../../../src/models/projectStructure.model', () => ({
    getProjectsByStructure: jest.fn(),
}));
jest.mock('../../../src/models/structure.model', () => ({ findAll: jest.fn() }));
jest.mock('../../../src/models/observation.model', () => ({ findAll: jest.fn() }));
jest.mock('../../../src/models/pv.model', () => ({
    findAllVisible: jest.fn(),
    findByIdForUser: jest.fn(),
}));
jest.mock('../../../src/utils/projectAccess', () => ({ canUserAccessProject: jest.fn() }));
jest.mock('../../../src/config/db', () => require('../../helpers/db').createDbMock());

const db = require('../../../src/config/db');
const ProjectModel = require('../../../src/models/project.model');
const ProjectStructure = require('../../../src/models/projectStructure.model');
const StructureModel = require('../../../src/models/structure.model');
const ObservationModel = require('../../../src/models/observation.model');
const PvModel = require('../../../src/models/pv.model');
const { canUserAccessProject } = require('../../../src/utils/projectAccess');
const ctrl = require('../../../src/controllers/chat.controller');
const { mockReq, mockRes, mockNext } = require('../../helpers/http');

const user = { id: 1, username: 'john', role: 'admin' };

beforeEach(() => {
    jest.clearAllMocks();
    process.env.OPENAI_API_KEY = 'test';
});

describe('chat.chat — validation', () => {
    test('400 si messages absents', async () => {
        const res = mockRes();
        await ctrl.chat(mockReq({ user, body: {} }), res, mockNext());
        expect(res.statusCode).toBe(400);
    });
    test('400 si messages vide', async () => {
        const res = mockRes();
        await ctrl.chat(mockReq({ user, body: { messages: [] } }), res, mockNext());
        expect(res.statusCode).toBe(400);
    });
    test('500 si pas d\'OPENAI_API_KEY', async () => {
        delete process.env.OPENAI_API_KEY;
        const res = mockRes();
        await ctrl.chat(mockReq({ user, body: { messages: [{ role: 'user', content: 'hi' }] } }), res, mockNext());
        expect(res.statusCode).toBe(500);
    });
});

describe('chat.chat — happy path sans tool', () => {
    test('retourne le content du LLM', async () => {
        mockCompletionsCreate.mockResolvedValueOnce({
            choices: [{ message: { role: 'assistant', content: 'Bonjour', tool_calls: null } }]
        });
        const res = mockRes();
        await ctrl.chat(mockReq({ user, body: { messages: [{ role: 'user', content: 'hi' }] } }), res, mockNext());
        expect(res.statusCode).toBe(200);
        expect(res.body.message).toBe('Bonjour');
    });

    test('500 si 5 itérations sans réponse finale', async () => {
        // Retourne toujours un tool_call → boucle max 5 itérations puis finalMessage=null
        mockCompletionsCreate.mockResolvedValue({
            choices: [{ message: {
                role: 'assistant',
                tool_calls: [{ id: 'a', function: { name: 'list_projects', arguments: '{}' } }]
            } }]
        });
        ProjectModel.findAll.mockResolvedValue([]);
        const res = mockRes();
        await ctrl.chat(mockReq({ user, body: { messages: [{ role: 'user', content: 'hi' }] } }), res, mockNext());
        expect(res.statusCode).toBe(500);
        expect(mockCompletionsCreate).toHaveBeenCalledTimes(5);
    });
});

describe('chat.chat — tool execution (couvre executeTool)', () => {
    function setupToolThenFinal(toolName, toolArgs = '{}') {
        mockCompletionsCreate
            .mockResolvedValueOnce({
                choices: [{ message: {
                    role: 'assistant',
                    tool_calls: [{ id: 'c1', function: { name: toolName, arguments: toolArgs } }]
                } }]
            })
            .mockResolvedValueOnce({
                choices: [{ message: { role: 'assistant', content: 'Done', tool_calls: null } }]
            });
    }

    test('list_projects', async () => {
        setupToolThenFinal('list_projects', '{"status":"en_cours"}');
        ProjectModel.findAll.mockResolvedValue([
            { id: 1, title: 'P', structure_code: 'DPGI', status: 'en_cours', priority: 'normale', progress_percentage: 30 }
        ]);
        const res = mockRes();
        await ctrl.chat(mockReq({ user, body: { messages: [{ role: 'user', content: 'x' }] } }), res, mockNext());
        expect(res.body.message).toBe('Done');
        expect(ProjectModel.findAll).toHaveBeenCalled();
    });

    test('list_projects : JSON arguments invalides → args = {}', async () => {
        setupToolThenFinal('list_projects', 'NOT JSON');
        ProjectModel.findAll.mockResolvedValue([]);
        const res = mockRes();
        await ctrl.chat(mockReq({ user, body: { messages: [{ role: 'user', content: 'x' }] } }), res, mockNext());
        expect(res.body.success).toBe(true);
    });

    test('get_project 404 → error', async () => {
        setupToolThenFinal('get_project', '{"id":1}');
        ProjectModel.findById.mockResolvedValue(null);
        await ctrl.chat(mockReq({ user, body: { messages: [{ role: 'user', content: 'x' }] } }), mockRes(), mockNext());
        expect(ProjectModel.findById).toHaveBeenCalled();
    });

    test('get_project accès refusé', async () => {
        setupToolThenFinal('get_project', '{"id":1}');
        ProjectModel.findById.mockResolvedValue({ id: 1, title: 'P' });
        canUserAccessProject.mockResolvedValue(false);
        await ctrl.chat(mockReq({
            user: { id: 1, role: 'utilisateur' },
            body: { messages: [{ role: 'user', content: 'x' }] }
        }), mockRes(), mockNext());
        expect(canUserAccessProject).toHaveBeenCalled();
    });

    test('get_project happy path retourne détails', async () => {
        setupToolThenFinal('get_project', '{"id":1}');
        ProjectModel.findById.mockResolvedValue({
            id: 1, title: 'P', status: 'en_cours', priority: 'haute',
            project_type: 'structurant', progress_percentage: 50, budget: '100',
            project_manager_first_name: 'A', project_manager_last_name: 'B',
            sites: [{ name: 'S', region: 'R' }],
            measures: [{ description: 'm', assigned_username: 'u', assigned_first_name: 'J' }],
            assigned_structures: [{ code: 'DPGI' }]
        });
        canUserAccessProject.mockResolvedValue(true);
        await ctrl.chat(mockReq({ user, body: { messages: [{ role: 'user', content: 'x' }] } }), mockRes(), mockNext());
        expect(ProjectModel.findById).toHaveBeenCalled();
    });

    test('get_stats', async () => {
        setupToolThenFinal('get_stats');
        ProjectModel.findAll.mockResolvedValue([
            { status: 'en_cours', priority: 'haute', structure_code: 'DPGI', progress_percentage: 30 }
        ]);
        await ctrl.chat(mockReq({ user, body: { messages: [{ role: 'user', content: 'x' }] } }), mockRes(), mockNext());
        expect(ProjectModel.findAll).toHaveBeenCalled();
    });

    test('list_structures', async () => {
        setupToolThenFinal('list_structures');
        StructureModel.findAll.mockResolvedValue([{ id: 1, code: 'DPGI', name: 'X', description: 'd' }]);
        await ctrl.chat(mockReq({ user, body: { messages: [{ role: 'user', content: 'x' }] } }), mockRes(), mockNext());
        expect(StructureModel.findAll).toHaveBeenCalled();
    });

    test('list_observations', async () => {
        setupToolThenFinal('list_observations');
        ObservationModel.findAll.mockResolvedValue([{ id: 1, title: 'T', content: 'c' }]);
        await ctrl.chat(mockReq({ user, body: { messages: [{ role: 'user', content: 'x' }] } }), mockRes(), mockNext());
        expect(ObservationModel.findAll).toHaveBeenCalled();
    });

    test('list_pv', async () => {
        setupToolThenFinal('list_pv');
        PvModel.findAllVisible.mockResolvedValue([{
            id: 1, title: 'PV', territorial_level: 'region', territorial_value: 'Dakar',
            projects: [{ id: 2, title: 'P' }], sites: [], localities: [], measures: []
        }]);
        await ctrl.chat(mockReq({ user, body: { messages: [{ role: 'user', content: 'x' }] } }), mockRes(), mockNext());
        expect(PvModel.findAllVisible).toHaveBeenCalled();
    });

    test('get_pv 404', async () => {
        setupToolThenFinal('get_pv', '{"id":1}');
        PvModel.findByIdForUser.mockResolvedValue(null);
        await ctrl.chat(mockReq({ user, body: { messages: [{ role: 'user', content: 'x' }] } }), mockRes(), mockNext());
        expect(PvModel.findByIdForUser).toHaveBeenCalled();
    });

    test('get_pv happy path', async () => {
        setupToolThenFinal('get_pv', '{"id":1}');
        PvModel.findByIdForUser.mockResolvedValue({
            id: 1, title: 'PV', territorial_level: 'region', territorial_value: 'Dakar',
            projects: [], sites: [], localities: [], measures: []
        });
        await ctrl.chat(mockReq({ user, body: { messages: [{ role: 'user', content: 'x' }] } }), mockRes(), mockNext());
        expect(PvModel.findByIdForUser).toHaveBeenCalled();
    });

    test('tool inconnu → res tool contient { error: "Tool ... inconnu" }', async () => {
        setupToolThenFinal('nonexistent_tool');
        const res = mockRes();
        const next = mockNext();
        await ctrl.chat(mockReq({ user, body: { messages: [{ role: 'user', content: 'x' }] } }), res, next);
        // La 2e itération OpenAI reçoit un message "tool" avec le payload d'erreur
        const secondCall = mockCompletionsCreate.mock.calls[1][0];
        const toolMsg = secondCall.messages.find(m => m.role === 'tool');
        expect(toolMsg).toBeDefined();
        expect(JSON.parse(toolMsg.content)).toEqual({ error: expect.stringMatching(/nonexistent_tool inconnu/) });
        // La réponse finale reste un succès (executeTool capture l'erreur au niveau tool)
        expect(res.body.success).toBe(true);
        expect(next).not.toHaveBeenCalled();
    });

    test('tool qui throw → { error: <message> } transmis au LLM', async () => {
        setupToolThenFinal('list_projects');
        ProjectModel.findAll.mockRejectedValue(new Error('db down'));
        const res = mockRes();
        const next = mockNext();
        await ctrl.chat(mockReq({ user, body: { messages: [{ role: 'user', content: 'x' }] } }), res, next);
        const secondCall = mockCompletionsCreate.mock.calls[1][0];
        const toolMsg = secondCall.messages.find(m => m.role === 'tool');
        expect(toolMsg).toBeDefined();
        expect(JSON.parse(toolMsg.content)).toEqual({ error: 'db down' });
        expect(res.body.success).toBe(true);
        expect(next).not.toHaveBeenCalled();
    });
});

describe('chat.chat — tool list_sites', () => {
    function setupToolThenFinal(toolName, toolArgs = '{}') {
        mockCompletionsCreate
            .mockResolvedValueOnce({
                choices: [{ message: {
                    role: 'assistant',
                    tool_calls: [{ id: 'c1', function: { name: toolName, arguments: toolArgs } }]
                } }]
            })
            .mockResolvedValueOnce({
                choices: [{ message: { role: 'assistant', content: 'Done', tool_calls: null } }]
            });
    }

    test('sans projet visible → retourne [] sans requête DB', async () => {
        setupToolThenFinal('list_sites');
        ProjectModel.findAll.mockResolvedValue([]); // admin mais 0 projets
        await ctrl.chat(mockReq({ user, body: { messages: [{ role: 'user', content: 'x' }] } }), mockRes(), mockNext());
        expect(db.query).not.toHaveBeenCalled();
        const toolMsg = mockCompletionsCreate.mock.calls[1][0].messages.find(m => m.role === 'tool');
        expect(JSON.parse(toolMsg.content)).toEqual([]);
    });

    test('restreint aux project_ids visibles pour l\'utilisateur (role utilisateur)', async () => {
        setupToolThenFinal('list_sites');
        ProjectStructure.getProjectsByStructure.mockResolvedValue([{ id: 10 }, { id: 11 }]);
        db.query.mockResolvedValue({ rows: [] });
        await ctrl.chat(mockReq({
            user: { id: 1, role: 'utilisateur', structure_id: 5 },
            body: { messages: [{ role: 'user', content: 'x' }] }
        }), mockRes(), mockNext());
        expect(db.query).toHaveBeenCalledTimes(1);
        // 1er paramètre : le ANY($1::int[]) reçoit le tableau des project_ids visibles
        expect(db.query.mock.calls[0][1][0]).toEqual([10, 11]);
    });

    test('applique filtres vulnerability + commune + structure + is_pcs', async () => {
        setupToolThenFinal('list_sites', JSON.stringify({
            vulnerability: 'tres_elevee', commune: 'Pikine', structure: 'dpgi', is_pcs: true
        }));
        ProjectModel.findAll.mockResolvedValue([{ id: 1 }]);
        db.query.mockResolvedValue({ rows: [] });
        await ctrl.chat(mockReq({ user, body: { messages: [{ role: 'user', content: 'x' }] } }), mockRes(), mockNext());
        const [q, params] = db.query.mock.calls[0];
        expect(q).toMatch(/s\.vulnerability_level = /);
        expect(q).toMatch(/s\.commune = /);
        expect(q).toMatch(/UPPER\(st\.code\) = /);
        expect(q).toMatch(/s\.is_pcs = /);
        // structure uppercasée
        expect(params).toContain('DPGI');
        expect(params).toContain('tres_elevee');
        expect(params).toContain('Pikine');
        expect(params).toContain(true);
    });

    test('ignore les valeurs non whitelisted (anti-injection logique)', async () => {
        setupToolThenFinal('list_sites', JSON.stringify({ vulnerability: 'invalid-value' }));
        ProjectModel.findAll.mockResolvedValue([{ id: 1 }]);
        db.query.mockResolvedValue({ rows: [] });
        await ctrl.chat(mockReq({ user, body: { messages: [{ role: 'user', content: 'x' }] } }), mockRes(), mockNext());
        // La valeur invalide ne doit pas générer de clause WHERE sur vulnerability_level
        expect(db.query.mock.calls[0][0]).not.toMatch(/s\.vulnerability_level = /);
        expect(db.query.mock.calls[0][1]).not.toContain('invalid-value');
    });

    test('DTO : flags PCS + vulnérabilité + coords Number', async () => {
        setupToolThenFinal('list_sites');
        ProjectModel.findAll.mockResolvedValue([{ id: 1 }]);
        db.query.mockResolvedValue({ rows: [{
            id: 7, name: 'S', description: 'd', region: 'R', departement: 'D', commune: 'C',
            latitude: '14.5', longitude: '-17.3', is_pcs: true, vulnerability_level: 'elevee',
            project_id: 1, project_title: 'P', project_status: 'en_cours', structure_code: 'DPGI'
        }] });
        await ctrl.chat(mockReq({ user, body: { messages: [{ role: 'user', content: 'x' }] } }), mockRes(), mockNext());
        const toolMsg = mockCompletionsCreate.mock.calls[1][0].messages.find(m => m.role === 'tool');
        const payload = JSON.parse(toolMsg.content);
        expect(payload[0]).toMatchObject({
            id: 7, nom: 'S', pcs: true, vulnerabilite: 'elevee',
            projet_statut: 'En cours', structure: 'DPGI',
            latitude: 14.5, longitude: -17.3
        });
    });
});

describe('chat.chat — tool list_geometries', () => {
    function setupToolThenFinal(toolName, toolArgs = '{}') {
        mockCompletionsCreate
            .mockResolvedValueOnce({
                choices: [{ message: {
                    role: 'assistant',
                    tool_calls: [{ id: 'c1', function: { name: toolName, arguments: toolArgs } }]
                } }]
            })
            .mockResolvedValueOnce({
                choices: [{ message: { role: 'assistant', content: 'Done', tool_calls: null } }]
            });
    }

    test('sans projet visible → [] sans DB', async () => {
        setupToolThenFinal('list_geometries');
        ProjectModel.findAll.mockResolvedValue([]);
        await ctrl.chat(mockReq({ user, body: { messages: [{ role: 'user', content: 'x' }] } }), mockRes(), mockNext());
        expect(db.query).not.toHaveBeenCalled();
    });

    test('filtre usage + kind + vulnerability + structure', async () => {
        setupToolThenFinal('list_geometries', JSON.stringify({
            usage: 'drainage', kind: 'linestring', vulnerability: 'elevee', structure: 'onas'
        }));
        ProjectModel.findAll.mockResolvedValue([{ id: 1 }]);
        db.query.mockResolvedValue({ rows: [] });
        await ctrl.chat(mockReq({ user, body: { messages: [{ role: 'user', content: 'x' }] } }), mockRes(), mockNext());
        const [q, params] = db.query.mock.calls[0];
        expect(q).toMatch(/g\.usage_type = /);
        expect(q).toMatch(/g\.kind = /);
        expect(q).toMatch(/g\.vulnerability_level = /);
        expect(q).toMatch(/UPPER\(st\.code\) = /);
        expect(params).toContain('drainage');
        expect(params).toContain('linestring');
        expect(params).toContain('elevee');
        expect(params).toContain('ONAS');
    });

    test('rejette usage invalide', async () => {
        setupToolThenFinal('list_geometries', JSON.stringify({ usage: 'poubelle' }));
        ProjectModel.findAll.mockResolvedValue([{ id: 1 }]);
        db.query.mockResolvedValue({ rows: [] });
        await ctrl.chat(mockReq({ user, body: { messages: [{ role: 'user', content: 'x' }] } }), mockRes(), mockNext());
        expect(db.query.mock.calls[0][0]).not.toMatch(/g\.usage_type = /);
        expect(db.query.mock.calls[0][1]).not.toContain('poubelle');
    });

    test('DTO compact', async () => {
        setupToolThenFinal('list_geometries');
        ProjectModel.findAll.mockResolvedValue([{ id: 1 }]);
        db.query.mockResolvedValue({ rows: [{
            id: 9, name: 'Tracé', description: 'd', kind: 'polygon', usage_type: 'zone_inondable',
            vulnerability_level: 'tres_elevee', project_id: 1, project_title: 'P',
            project_status: 'retard', structure_code: 'DPGI'
        }] });
        await ctrl.chat(mockReq({ user, body: { messages: [{ role: 'user', content: 'x' }] } }), mockRes(), mockNext());
        const toolMsg = mockCompletionsCreate.mock.calls[1][0].messages.find(m => m.role === 'tool');
        const payload = JSON.parse(toolMsg.content);
        expect(payload[0]).toMatchObject({
            id: 9, nom: 'Tracé', type_geometrie: 'polygon', usage: 'zone_inondable',
            vulnerabilite: 'tres_elevee', projet_statut: 'En retard', structure: 'DPGI'
        });
    });

    test('cap LIMIT 100 hardcodé dans la requête', async () => {
        setupToolThenFinal('list_geometries');
        ProjectModel.findAll.mockResolvedValue([{ id: 1 }]);
        db.query.mockResolvedValue({ rows: [] });
        await ctrl.chat(mockReq({ user, body: { messages: [{ role: 'user', content: 'x' }] } }), mockRes(), mockNext());
        expect(db.query.mock.calls[0][0]).toMatch(/LIMIT 100/);
    });
});

describe('chat.chat — erreur OpenAI', () => {
    test('propage au next()', async () => {
        const err = new Error('OpenAI rate limit');
        mockCompletionsCreate.mockRejectedValue(err);
        const next = mockNext();
        await ctrl.chat(mockReq({ user, body: { messages: [{ role: 'user', content: 'x' }] } }), mockRes(), next);
        expect(next).toHaveBeenCalledWith(err);
    });
});

describe('getProjectsForUser (indirect via list_projects avec différents rôles)', () => {
    test('commandement_territorial → findByTerritory', async () => {
        mockCompletionsCreate
            .mockResolvedValueOnce({ choices: [{ message: { tool_calls: [{ id: 'c', function: { name: 'list_projects', arguments: '{}' } }] } }] })
            .mockResolvedValueOnce({ choices: [{ message: { content: 'Done', tool_calls: null } }] });
        ProjectModel.findByTerritory.mockResolvedValue([]);
        await ctrl.chat(mockReq({
            user: { id: 1, role: 'commandement_territorial', territorial_level: 'region', territorial_value: 'Dakar' },
            body: { messages: [{ role: 'user', content: 'x' }] }
        }), mockRes(), mockNext());
        expect(ProjectModel.findByTerritory).toHaveBeenCalled();
    });

    test('utilisateur avec structure → getProjectsByStructure', async () => {
        mockCompletionsCreate
            .mockResolvedValueOnce({ choices: [{ message: { tool_calls: [{ id: 'c', function: { name: 'list_projects', arguments: '{"structure":"dpgi"}' } }] } }] })
            .mockResolvedValueOnce({ choices: [{ message: { content: 'Done', tool_calls: null } }] });
        ProjectStructure.getProjectsByStructure.mockResolvedValue([
            { structure_code: 'DPGI', status: 'en_cours' },
            { structure_code: 'ONAS', status: 'en_cours' },
        ]);
        await ctrl.chat(mockReq({
            user: { id: 1, role: 'utilisateur', structure_id: 5 },
            body: { messages: [{ role: 'user', content: 'x' }] }
        }), mockRes(), mockNext());
        expect(ProjectStructure.getProjectsByStructure).toHaveBeenCalledWith(5);
    });
});
