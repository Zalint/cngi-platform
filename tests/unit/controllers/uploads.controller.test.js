jest.mock('../../../src/config/db', () => require('../../helpers/db').createDbMock());
// Mock de l'abstraction de stockage : on ne touche plus fs directement.
jest.mock('../../../src/config/storage', () => ({
    deleteFile: jest.fn().mockResolvedValue(undefined),
    multerStorage: jest.fn(),
    init: jest.fn(),
    mountStatic: jest.fn(),
    getMaxUploadBytes: jest.fn().mockResolvedValue(5 * 1024 * 1024),
    invalidateMaxUploadBytesCache: jest.fn(),
    driver: 'disk',
}));

const storage = require('../../../src/config/storage');
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
    test('supprime via storage.deleteFile + row DB', async () => {
        const row = { id: 1, path: '/tmp/f.pdf' };
        db.query
            .mockResolvedValueOnce({ rows: [row] })
            .mockResolvedValueOnce({ rows: [] });
        const res = mockRes();
        await ctrl.deleteFile(mockReq({ params: { id: '1' } }), res, mockNext());
        // Le contrôleur passe la row entière à l'abstraction de stockage —
        // c'est le driver (disk / r2) qui décide quoi faire avec.
        expect(storage.deleteFile).toHaveBeenCalledWith(row);
        // 2 db.query : SELECT puis DELETE
        expect(db.query.mock.calls[1][0]).toMatch(/DELETE FROM uploads/);
        expect(res.body.success).toBe(true);
    });

    test('storage.deleteFile qui rejette propage au next()', async () => {
        const row = { id: 1, path: '/nope' };
        db.query.mockResolvedValueOnce({ rows: [row] });
        storage.deleteFile.mockRejectedValueOnce(new Error('disk fail'));
        const next = mockNext();
        await ctrl.deleteFile(mockReq({ params: { id: '1' } }), mockRes(), next);
        expect(next).toHaveBeenCalled();
        expect(next.mock.calls[0][0].message).toBe('disk fail');
    });
});
