jest.mock('../../../src/models/project.model', () => ({
    findAll: jest.fn(),
    findById: jest.fn(),
    findByTerritory: jest.fn(),
}));
jest.mock('../../../src/models/projectStructure.model', () => ({
    getProjectsByStructure: jest.fn(),
}));

const ProjectModel = require('../../../src/models/project.model');
const ProjectStructure = require('../../../src/models/projectStructure.model');
const ctrl = require('../../../src/controllers/export.controller');
const { mockReq, mockNext } = require('../../helpers/http');

/**
 * ExcelJS écrit sur res via `wb.xlsx.write(res)`. On remplace res par un petit
 * stub qui implémente `on` (stream) + `end` pour que la sérialisation se passe.
 * ExcelJS attend un Writable stream : on utilise la PassThrough de node.
 */
const { PassThrough } = require('stream');

function streamRes() {
    const stream = new PassThrough();
    stream.statusCode = 200;
    stream.headers = {};
    stream.setHeader = (k, v) => { stream.headers[k.toLowerCase()] = v; };
    // consommer pour que le writable ne sature pas
    stream.resume();
    return stream;
}

beforeEach(() => jest.clearAllMocks());

describe('export.exportProjectsXlsx — dispatching par rôle', () => {
    beforeEach(() => {
        ProjectModel.findById.mockImplementation((id) => Promise.resolve({
            id, title: 'P' + id, status: 'en_cours', priority: 'normale',
            measures: [], sites: [], funding: [], stakeholders: [], localities: [],
            assigned_structures: []
        }));
    });

    test('commandement_territorial → findByTerritory', async () => {
        ProjectModel.findByTerritory.mockResolvedValue([{ id: 1 }]);
        const res = streamRes();
        await ctrl.exportProjectsXlsx(mockReq({
            user: { role: 'commandement_territorial', territorial_level: 'region', territorial_value: 'Dakar' }
        }), res, mockNext());
        expect(ProjectModel.findByTerritory).toHaveBeenCalledWith('region', 'Dakar');
        expect(res.headers['content-type']).toMatch(/spreadsheetml/);
        expect(res.headers['content-disposition']).toMatch(/\.xlsx/);
    });

    test('utilisateur avec structure → getProjectsByStructure', async () => {
        ProjectStructure.getProjectsByStructure.mockResolvedValue([{ id: 1 }]);
        const res = streamRes();
        await ctrl.exportProjectsXlsx(mockReq({
            user: { role: 'utilisateur', structure_id: 5 }
        }), res, mockNext());
        expect(ProjectStructure.getProjectsByStructure).toHaveBeenCalledWith(5);
    });

    test('admin → findAll', async () => {
        ProjectModel.findAll.mockResolvedValue([{ id: 1 }]);
        const res = streamRes();
        await ctrl.exportProjectsXlsx(mockReq({ user: { role: 'admin' } }), res, mockNext());
        expect(ProjectModel.findAll).toHaveBeenCalledWith({});
    });

    test('charge les détails de chaque projet via findById', async () => {
        ProjectModel.findAll.mockResolvedValue([{ id: 1 }, { id: 2 }]);
        const res = streamRes();
        await ctrl.exportProjectsXlsx(mockReq({ user: { role: 'admin' } }), res, mockNext());
        expect(ProjectModel.findById).toHaveBeenCalledWith(1);
        expect(ProjectModel.findById).toHaveBeenCalledWith(2);
    });

    test('propage les erreurs au next()', async () => {
        const err = new Error('db');
        ProjectModel.findAll.mockRejectedValue(err);
        const res = streamRes();
        const next = mockNext();
        await ctrl.exportProjectsXlsx(mockReq({ user: { role: 'admin' } }), res, next);
        expect(next).toHaveBeenCalledWith(err);
    });
});
