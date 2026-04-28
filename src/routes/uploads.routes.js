const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const uploadsController = require('../controllers/uploads.controller');
const { protect } = require('../middlewares/auth');
const fileStorage = require('../config/storage');

// Configuration multer déléguée à l'abstraction de stockage (disque local par
// défaut, R2 plus tard via STORAGE_DRIVER=r2). Cf. src/config/storage.js.
const storage = fileStorage.multerStorage();

const fileFilter = (req, file, cb) => {
    // Autoriser certains types de fichiers
    const allowedTypes = /jpeg|jpg|png|gif|pdf|doc|docx|xls|xlsx|txt/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
        return cb(null, true);
    } else {
        cb(new Error('Type de fichier non autorisé'));
    }
};

// Middleware factory : la limite de taille est lue dynamiquement depuis
// app_config (cache TTL 30s), donc l'admin peut la modifier sans redémarrer.
// On instancie multer par requête pour pouvoir injecter la limite courante.
async function dynamicUpload(req, res, next) {
    try {
        const maxBytes = await fileStorage.getMaxUploadBytes();
        const upload = multer({
            storage: storage,
            limits: { fileSize: maxBytes },
            fileFilter: fileFilter
        });
        upload.single('file')(req, res, (err) => {
            if (err && err.code === 'LIMIT_FILE_SIZE') {
                const mb = Math.round(maxBytes / (1024 * 1024));
                return res.status(413).json({
                    success: false,
                    message: `Fichier trop volumineux (max ${mb} Mo).`,
                    maxBytes
                });
            }
            next(err);
        });
    } catch (err) {
        next(err);
    }
}

router.use(protect);

router.post('/', dynamicUpload, uploadsController.uploadFile);
router.get('/', uploadsController.getByEntity);
router.get('/:id', uploadsController.getFileById);
router.delete('/:id', uploadsController.deleteFile);

module.exports = router;

