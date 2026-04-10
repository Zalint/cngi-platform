const db = require('../config/db');
const path = require('path');
const fs = require('fs');

exports.uploadFile = async (req, res, next) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'Aucun fichier fourni' });
        }
        
        const { entity_type, entity_id } = req.body;
        
        // Enregistrer les informations du fichier en base
        const result = await db.query(`
            INSERT INTO uploads (filename, original_filename, path, mime_type, size, entity_type, entity_id, uploaded_by_user_id)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING *
        `, [
            req.file.filename,
            req.file.originalname,
            req.file.path,
            req.file.mimetype,
            req.file.size,
            entity_type || null,
            entity_id || null,
            req.user.id
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

exports.deleteFile = async (req, res, next) => {
    try {
        const result = await db.query('SELECT * FROM uploads WHERE id = $1', [req.params.id]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Fichier non trouvé' });
        }
        
        const file = result.rows[0];
        
        // Supprimer le fichier physique
        if (fs.existsSync(file.path)) {
            fs.unlinkSync(file.path);
        }
        
        // Supprimer l'enregistrement en base
        await db.query('DELETE FROM uploads WHERE id = $1', [req.params.id]);
        
        res.json({ success: true, message: 'Fichier supprimé avec succès' });
    } catch (error) {
        next(error);
    }
};

