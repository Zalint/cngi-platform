jest.mock('../../../src/config/db', () => require('../../helpers/db').createDbMock());
jest.mock('fs', () => ({ existsSync: jest.fn(), unlinkSync: jest.fn() }));

const fs = require('fs');
const db = require('../../../src/config/db');
const ctrl = require('../../../src/controllers/uploads.controller');
const { mockReq, mockRes, mockNext } = require('../../helpers/http');

beforeEach(() => jest.clearAllMocks());

describe('uploads.uploadFile', () => {
    test('400 si pas de fichier', async () => {
        const res = mockRes();
        await ctrl.uploadFile(mockReq({ user: { id: 1 }, body: {} }), res, mockNext());
        expect(res.statusCode).toBe(400);
    });
    test('201 + insert avec tous les champs', async () => {
        db.query.mockResolvedValueOnce({ rows: [{ id: 1, filename: 'f' }] });
        const res = mockRes();
        const req = mockReq({
            user: { id: 7 },
            body: { entity_type: 'pv', entity_id: '5', label: '  doc  ' },
            file: {
                filename: 'abc.pdf', originalname: 'original.pdf',
                path: '/tmp/abc.pdf', mimetype: 'application/pdf', size: 1234
            }
        });
        await ctrl.uploadFile(req, res, mockNext());
        expect(res.statusCode).toBe(201);
        const params = db.query.mock.calls[0][1];
        expect(params[0]).toBe('abc.pdf');
        expect(params[5]).toBe('pv');
        expect(params[6]).toBe('5');
        expect(params[7]).toBe(7);
        expect(params[8]).toBe('doc'); // trimé
    });
    test('label vide → null', async () => {
        db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });
        const req = mockReq({
            user: { id: 7 }, body: { label: '   ' },
            file: { filename: 'x', originalname: 'x', path: '/t', mimetype: 'a', size: 1 }
        });
        await ctrl.uploadFile(req, mockRes(), mockNext());
        expect(db.query.mock.calls[0][1][8]).toBe(null);
    });
});

describe('uploads.getFileById', () => {
    test('404 si rien', async () => {
        db.query.mockResolvedValueOnce({ rows: [] });
        const res = mockRes();
        await ctrl.getFileById(mockReq({ params: { id: '1' } }), res, mockNext());
        expect(res.statusCode).toBe(404);
    });
    test('200 avec data', async () => {
        db.query.mockResolvedValueOnce({ rows: [{ id: 1, filename: 'f' }] });
        const res = mockRes();
        await ctrl.getFileById(mockReq({ params: { id: '1' } }), res, mockNext());
        expect(res.body.data.filename).toBe('f');
    });
});

describe('uploads.getByEntity', () => {
    test('passe entity_type/entity_id', async () => {
        db.query.mockResolvedValueOnce({ rows: [] });
        await ctrl.getByEntity(mockReq({ query: { entity_type: 'pv', entity_id: '5' } }), mockRes(), mockNext());
        expect(db.query.mock.calls[0][1]).toEqual(['pv', '5']);
    });
});

describe('uploads.deleteFile', () => {
    test('404 si introuvable', async () => {
        db.query.mockResolvedValueOnce({ rows: [] });
        const res = mockRes();
        await ctrl.deleteFile(mockReq({ params: { id: '1' } }), res, mockNext());
        expect(res.statusCode).toBe(404);
    });
    test('supprime fichier physique + row', async () => {
        db.query
            .mockResolvedValueOnce({ rows: [{ id: 1, path: '/tmp/f.pdf' }] })
            .mockResolvedValueOnce({ rows: [] });
        fs.existsSync.mockReturnValue(true);
        const res = mockRes();
        await ctrl.deleteFile(mockReq({ params: { id: '1' } }), res, mockNext());
        expect(fs.unlinkSync).toHaveBeenCalledWith('/tmp/f.pdf');
        expect(res.body.success).toBe(true);
    });
    test('ne unlink pas si le fichier n\'existe plus', async () => {
        db.query
            .mockResolvedValueOnce({ rows: [{ id: 1, path: '/nope' }] })
            .mockResolvedValueOnce({ rows: [] });
        fs.existsSync.mockReturnValue(false);
        await ctrl.deleteFile(mockReq({ params: { id: '1' } }), mockRes(), mockNext());
        expect(fs.unlinkSync).not.toHaveBeenCalled();
    });
});
