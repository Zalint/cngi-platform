jest.mock('../../../src/models/project.model', () => ({
    findAll: jest.fn(),
    findById: jest.fn(),
    findByTerritory: jest.fn(),
}));
jest.mock('../../../src/models/projectStructure.model', () => ({
    getProjectsByStructure: jest.fn(),
}));
jest.mock('../../../src/models/observation.model', () => ({ findAll: jest.fn() }));
jest.mock('../../../src/models/pv.model', () => ({ findAllVisible: jest.fn() }));
// Neutralise OpenAI — inutile puisque les tests court-circuitent avant callLLM
const mockCompletionsCreate = jest.fn();
jest.mock('openai', () => jest.fn().mockImplementation(() => ({
    chat: { completions: { create: mockCompletionsCreate } }
})));

// marked (ESM) mocké avec un AST représentatif pour couvrir tous les
// branches des helpers renderMarkdownToPdf et markdownToDocxElements :
// heading, paragraph, list, table, hr, blockquote, space, heading depth > 2/3.
jest.mock('marked', () => ({
    marked: {
        lexer: jest.fn(() => [
            { type: 'heading', depth: 1, text: '**Rapport**' },
            { type: 'heading', depth: 2, text: 'Section' },
            { type: 'heading', depth: 3, text: 'Sub' },
            { type: 'heading', depth: 5, text: 'h5' }, // fallback HEADING_4
            { type: 'paragraph', text: 'Texte [lien](http://x) *italique*' },
            { type: 'list', ordered: false, items: [{ text: 'Item 1' }, { text: 'Item 2' }] },
            { type: 'list', ordered: true, start: 1, items: [{ text: 'Ordered' }] },
            { type: 'table', header: [{ text: 'Col1' }, { text: 'Col2' }], rows: [[{ text: 'A' }, { text: 'B avec du texte très long pour tester' }]] },
            { type: 'hr' },
            { type: 'blockquote', text: 'Citation' },
            { type: 'space' },
        ])
    }
}));

// Mock PDFKit avec un fake émulant suffisamment l'API fluent pour que
// renderMarkdownToPdf et generatePdfBuffer fonctionnent.
jest.mock('pdfkit', () => {
    const { EventEmitter } = require('events');
    return jest.fn().mockImplementation(() => {
        const doc = new EventEmitter();
        doc.x = 50;
        doc.y = 60;
        doc.page = {
            width: 595, height: 842,
            margins: { top: 60, bottom: 60, left: 50, right: 50 }
        };
        const fluent = (fn) => fn ? (...args) => { fn(...args); return doc; } : () => doc;
        doc.fontSize = fluent(() => {});
        doc.fillColor = fluent(() => {});
        doc.font = fluent(() => {});
        doc.text = fluent((_t, _x, _y) => { doc.y += 10; });
        doc.moveDown = fluent((n) => { doc.y += (n || 1) * 12; });
        doc.moveTo = fluent(() => {});
        doc.lineTo = fluent(() => {});
        doc.stroke = fluent(() => {});
        doc.strokeColor = fluent(() => {});
        doc.lineWidth = fluent(() => {});
        doc.rect = fluent(() => {});
        doc.fill = fluent(() => {});
        doc.addPage = fluent(() => { doc.y = 60; });
        doc.switchToPage = fluent(() => {});
        doc.bufferedPageRange = () => ({ start: 0, count: 1 });
        doc.widthOfString = () => 100;
        doc.heightOfString = () => 12;
        doc.end = () => {
            doc.emit('data', Buffer.from('PDF-1.4 fake'));
            doc.emit('end');
        };
        return doc;
    });
});

// Mock docx : retourne des objets simples + Packer.toBuffer renvoie un Buffer.
jest.mock('docx', () => {
    const stub = jest.fn().mockImplementation(function (...args) { this.args = args; });
    return {
        Document: jest.fn().mockImplementation(function (opts) { this.opts = opts; }),
        Packer: { toBuffer: jest.fn().mockResolvedValue(Buffer.from('docx fake')) },
        Paragraph: stub,
        HeadingLevel: { HEADING_1: 1, HEADING_2: 2, HEADING_3: 3, HEADING_4: 4 },
        TextRun: stub,
        AlignmentType: { JUSTIFIED: 'justified' },
        Table: stub,
        TableRow: stub,
        TableCell: stub,
        WidthType: { PERCENTAGE: 'pct' },
        BorderStyle: { SINGLE: 'single' },
        ShadingType: { CLEAR: 'clear' },
    };
});

const ProjectModel = require('../../../src/models/project.model');
const ProjectStructure = require('../../../src/models/projectStructure.model');
const ctrl = require('../../../src/controllers/reports.controller');
const { mockReq, mockRes, mockNext } = require('../../helpers/http');

beforeEach(() => jest.clearAllMocks());

describe('reports.generateReport — validation', () => {
    test('400 si format invalide', async () => {
        const res = mockRes();
        await ctrl.generateReport(mockReq({ user: { role: 'admin' }, body: { format: 'xml' } }), res, mockNext());
        expect(res.statusCode).toBe(400);
        expect(res.body.message).toMatch(/pdf\|docx/);
    });

    test('accepte "pdf" et "docx" (ne renvoie pas 400 pour format)', async () => {
        ProjectModel.findAll.mockResolvedValue([]); // → 400 "aucun projet" (pas "format")
        const res = mockRes();
        await ctrl.generateReport(mockReq({ user: { role: 'admin' }, body: { format: 'docx' } }), res, mockNext());
        expect(res.body.message).toMatch(/Aucun projet/);
    });
});

describe('reports.generateReport — dispatching par rôle', () => {
    test('commandement_territorial → findByTerritory', async () => {
        ProjectModel.findByTerritory.mockResolvedValue([]);
        const res = mockRes();
        await ctrl.generateReport(mockReq({
            user: { role: 'commandement_territorial', territorial_level: 'region', territorial_value: 'Dakar' },
            body: { format: 'pdf' }
        }), res, mockNext());
        expect(ProjectModel.findByTerritory).toHaveBeenCalledWith('region', 'Dakar');
        expect(ProjectModel.findAll).not.toHaveBeenCalled();
    });
    test('utilisateur → getProjectsByStructure', async () => {
        ProjectStructure.getProjectsByStructure.mockResolvedValue([]);
        await ctrl.generateReport(mockReq({
            user: { role: 'utilisateur', structure_id: 3 },
            body: { format: 'pdf' }
        }), mockRes(), mockNext());
        expect(ProjectStructure.getProjectsByStructure).toHaveBeenCalledWith(3);
    });
    test('admin → findAll({})', async () => {
        ProjectModel.findAll.mockResolvedValue([]);
        await ctrl.generateReport(mockReq({
            user: { role: 'admin' }, body: { format: 'pdf' }
        }), mockRes(), mockNext());
        expect(ProjectModel.findAll).toHaveBeenCalledWith({});
    });
});

describe('reports.generateReport — filtres', () => {
    test('400 si aucun projet après filtres', async () => {
        ProjectModel.findAll.mockResolvedValue([
            { id: 1, status: 'en_cours', priority: 'normale', structure_id: 1 }
        ]);
        const res = mockRes();
        await ctrl.generateReport(mockReq({
            user: { role: 'admin' },
            body: { format: 'pdf', status: 'termine' } // ne matche rien
        }), res, mockNext());
        expect(res.statusCode).toBe(400);
        expect(res.body.message).toMatch(/Aucun projet/);
    });
    test('filtre structure_id converti en int', async () => {
        ProjectModel.findAll.mockResolvedValue([
            { id: 1, structure_id: 3, status: 'en_cours', priority: 'normale' }
        ]);
        const res = mockRes();
        await ctrl.generateReport(mockReq({
            user: { role: 'admin' },
            body: { format: 'pdf', structure_id: '9' } // ne matche pas id=1 dont structure_id=3
        }), res, mockNext());
        expect(res.statusCode).toBe(400);
    });
});

describe('reports.generateReport — happy path PDF/DOCX (couvre helpers)', () => {
    const ObservationModel = require('../../../src/models/observation.model');
    const PvModel = require('../../../src/models/pv.model');

    beforeEach(() => {
        process.env.OPENAI_API_KEY = 'test-key';
        mockCompletionsCreate.mockResolvedValue({
            choices: [{ message: { content: '# Rapport\n\nIntro' } }]
        });
        ObservationModel.findAll.mockResolvedValue([
            { id: 1, title: 'Obs', content: 'x', priority: 'urgente',
              author_first_name: 'J', author_last_name: 'D' }
        ]);
        PvModel.findAllVisible.mockResolvedValue([
            { id: 1, title: 'PV', visit_date: '2024-01-01', priority: 'importante',
              author_first_name: 'A', territorial_level: 'region', territorial_value: 'Dakar',
              avancement: 'x', observations: 'y', recommendations: 'z' }
        ]);
        ProjectModel.findAll.mockResolvedValue([{ id: 1, status: 'en_cours', priority: 'normale' }]);
        ProjectModel.findById.mockResolvedValue({
            id: 1, title: 'P', structure_code: 'DPGI', status: 'en_cours', priority: 'haute',
            project_type: 'structurant', progress_percentage: 30, budget: '500',
            project_manager_first_name: 'M', project_manager_last_name: 'P',
            description: 'Desc', constraints: 'C', expected_measures: 'E',
            sites: [{ name: 'S', commune: 'C', region: 'R', vulnerability_level: 'elevee' }],
            measures: [{ description: 'm', type: 't', status: 'preconisee', structure_code: 'DPGI',
                         assigned_username: 'u', assigned_first_name: 'J', assigned_last_name: 'D' }]
        });
    });

    function mkRes() {
        return {
            statusCode: 200,
            headers: {},
            setHeader(k, v) { this.headers[k.toLowerCase()] = v; },
            status: jest.fn(function (c) { this.statusCode = c; return this; }),
            json: jest.fn(function (p) { this.body = p; return this; }),
            end: jest.fn(),
        };
    }

    test('format pdf : headers + appelle tous les helpers PDF', async () => {
        const res = mkRes();
        await ctrl.generateReport(mockReq({
            user: { id: 1, role: 'admin', first_name: 'A', username: 'admin' },
            body: { format: 'pdf' }
        }), res, mockNext());
        expect(res.headers['content-type']).toBe('application/pdf');
        expect(res.headers['content-disposition']).toMatch(/\.pdf/);
        expect(res.end).toHaveBeenCalled();
    });

    test('format docx : headers + appelle les helpers DOCX', async () => {
        const res = mkRes();
        await ctrl.generateReport(mockReq({
            user: { id: 1, role: 'admin', first_name: 'A', username: 'admin' },
            body: { format: 'docx' }
        }), res, mockNext());
        expect(res.headers['content-type']).toMatch(/wordprocessingml/);
    });

    test('format par défaut = pdf', async () => {
        const res = mkRes();
        await ctrl.generateReport(mockReq({
            user: { id: 1, role: 'admin', first_name: 'A', username: 'admin' },
            body: {}
        }), res, mockNext());
        expect(res.headers['content-type']).toBe('application/pdf');
    });

    test('OpenAI sans API key → erreur propagée', async () => {
        const prev = process.env.OPENAI_API_KEY;
        delete process.env.OPENAI_API_KEY;
        const next = mockNext();
        await ctrl.generateReport(mockReq({
            user: { id: 1, role: 'admin' }, body: { format: 'pdf' }
        }), mkRes(), next);
        expect(next).toHaveBeenCalled();
        expect(next.mock.calls[0][0].message).toMatch(/OPENAI_API_KEY/);
        if (prev) process.env.OPENAI_API_KEY = prev;
    });

    test('erreur OpenAI 401 → message explicite', async () => {
        process.env.OPENAI_API_KEY = 'x';
        const err = Object.assign(new Error('unauthorized'), { status: 401 });
        mockCompletionsCreate.mockRejectedValue(err);
        const next = mockNext();
        await ctrl.generateReport(mockReq({
            user: { id: 1, role: 'admin' }, body: { format: 'pdf' }
        }), mkRes(), next);
        expect(next).toHaveBeenCalled();
        expect(next.mock.calls[0][0].message).toMatch(/401|invalide/i);
    });

    test('erreur OpenAI 429 → message explicite', async () => {
        process.env.OPENAI_API_KEY = 'x';
        const err = Object.assign(new Error('rate limit'), { status: 429 });
        mockCompletionsCreate.mockRejectedValue(err);
        const next = mockNext();
        await ctrl.generateReport(mockReq({
            user: { id: 1, role: 'admin' }, body: { format: 'pdf' }
        }), mkRes(), next);
        expect(next.mock.calls[0][0].message).toMatch(/Quota|429/);
    });

    test('observations/PV load errors sont silenced', async () => {
        process.env.OPENAI_API_KEY = 'x';
        ObservationModel.findAll.mockRejectedValue(new Error('obs fail'));
        PvModel.findAllVisible.mockRejectedValue(new Error('pv fail'));
        const res = mkRes();
        await ctrl.generateReport(mockReq({
            user: { id: 1, role: 'admin' }, body: { format: 'pdf' }
        }), res, mockNext());
        // L'erreur sur obs/pv ne doit PAS bloquer le rapport
        expect(res.headers['content-type']).toBe('application/pdf');
    });
});

describe('reports.generateReport — erreurs', () => {
    test('503 si timeout base de données', async () => {
        const err = new Error('timeout exceeded when trying to connect');
        ProjectModel.findAll.mockRejectedValue(err);
        const res = mockRes();
        await ctrl.generateReport(mockReq({ user: { role: 'admin' }, body: { format: 'pdf' } }), res, mockNext());
        expect(res.statusCode).toBe(503);
        expect(res.body.message).toMatch(/pool|surchargée/i);
    });

    test('autres erreurs propagées au next()', async () => {
        const err = new Error('random');
        ProjectModel.findAll.mockRejectedValue(err);
        const next = mockNext();
        await ctrl.generateReport(mockReq({ user: { role: 'admin' }, body: { format: 'pdf' } }), mockRes(), next);
        expect(next).toHaveBeenCalledWith(err);
    });
});
