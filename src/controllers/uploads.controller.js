const db = require('../config/db');
const storage = require('../config/storage');

exports.uploadFile = async (req, res, next) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'Aucun fichier fourni' });
        }
        
        const { entity_type, entity_id, label } = req.body;

        // Enregistrer les informations du fichier en base
        const result = await db.query(`
            INSERT INTO uploads (filename, original_filename, path, mime_type, size, entity_type, entity_id, uploaded_by_user_id, label)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING *
        `, [
            req.file.filename,
            req.file.originalname,
            req.file.path,
            req.file.mimetype,
            req.file.size,
            entity_type || null,
            entity_id || null,
            req.user.id,
            (label && label.trim()) ? label.trim() : null
        ]);
        
        res.status(201).json({
            success: true,
            message: 'Fichier uploadé avec succès',
            data: result.rows[0]
        });
    } catch (error) {
        next(error);
    }
};

exports.getFileById = async (req, res, next) => {
    try {
        const result = await db.query('SELECT * FROM uploads WHERE id = $1', [req.params.id]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Fichier non trouvé' });
        }
        
        res.json({ success: true, data: result.rows[0] });
    } catch (error) {
        next(error);
    }
};

exports.getByEntity = async (req, res, next) => {
    try {
        const { entity_type, entity_id } = req.query;
        const result = await db.query(
            `SELECT u.*, usr.first_name, usr.last_name, usr.username
             FROM uploads u
             LEFT JOIN users usr ON u.uploaded_by_user_id = usr.id
             WHERE u.entity_type = $1 AND u.entity_id = $2
             ORDER BY u.uploaded_at DESC`,
            [entity_type, entity_id]
        );
        res.json({ success: true, data: result.rows });
    } catch (error) {
        next(error);
    }
};

exports.deleteFile = async (req, res, next) => {
    try {
        const result = await db.query('SELECT * FROM uploads WHERE id = $1', [req.params.id]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Fichier non trouvé' });
        }
        
        const file = result.rows[0];

        // Supprimer le fichier physique via l'abstraction de stockage
        // (disque local en mode disk, DeleteObjectCommand en mode r2)
        await storage.deleteFile(file);

        // Supprimer l'enregistrement en base
        await db.query('DELETE FROM uploads WHERE id = $1', [req.params.id]);
        
        res.json({ success: true, message: 'Fichier supprimé avec succès' });
    } catch (error) {
        next(error);
    }
};

