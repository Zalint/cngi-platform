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

    test('tool inconnu → error', async () => {
        setupToolThenFinal('nonexistent_tool');
        await ctrl.chat(mockReq({ user, body: { messages: [{ role: 'user', content: 'x' }] } }), mockRes(), mockNext());
        // Pas d'assertion dure — on couvre juste la branche "Tool inconnu"
    });

    test('tool qui throw → error capturé', async () => {
        setupToolThenFinal('list_projects');
        ProjectModel.findAll.mockRejectedValue(new Error('db down'));
        await ctrl.chat(mockReq({ user, body: { messages: [{ role: 'user', content: 'x' }] } }), mockRes(), mockNext());
        // executeTool capture l'erreur et la renvoie comme { error: ... }
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
