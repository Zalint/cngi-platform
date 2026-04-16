const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const uploadsController = require('../controllers/uploads.controller');
const { protect } = require('../middlewares/auth');

// Configuration de multer pour le stockage des fichiers
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/');
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

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

const upload = multer({
    storage: storage,
    limits: {
        fileSize: parseInt(process.env.MAX_FILE_SIZE) || 5242880 // 5MB par défaut
    },
    fileFilter: fileFilter
});

router.use(protect);

router.post('/', upload.single('file'), uploadsController.uploadFile);
router.get('/', uploadsController.getByEntity);
router.get('/:id', uploadsController.getFileById);
router.delete('/:id', uploadsController.deleteFile);

module.exports = router;

