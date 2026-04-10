const db = require('../config/db');

class FormModel {
    /**
     * Récupérer tous les formulaires
     */
    static async findAll() {
        const result = await db.query(`
            SELECT f.*,
                   s.name as structure_name, s.code as structure_code,
                   u.username as creator_username,
                   (SELECT COUNT(*) FROM form_submissions WHERE form_id = f.id) as submissions_count
            FROM forms f
            LEFT JOIN structures s ON f.assigned_to_structure_id = s.id
            LEFT JOIN users u ON f.created_by = u.id
            WHERE f.is_active = true
            ORDER BY f.created_at DESC
        `);
        return result.rows;
    }

    /**
     * Récupérer un formulaire par ID
     */
    static async findById(id) {
        const result = await db.query(`
            SELECT f.*,
                   s.name as structure_name, s.code as structure_code,
                   u.username as creator_username
            FROM forms f
            LEFT JOIN structures s ON f.assigned_to_structure_id = s.id
            LEFT JOIN users u ON f.created_by = u.id
            WHERE f.id = $1
        `, [id]);
        return result.rows[0];
    }

    /**
     * Récupérer les formulaires assignés à une structure
     */
    static async findByStructure(structureId) {
        const result = await db.query(`
            SELECT f.*,
                   (SELECT COUNT(*) FROM form_submissions WHERE form_id = f.id) as submissions_count
            FROM forms f
            WHERE (f.assigned_to_structure_id = $1 OR f.assigned_to_structure_id IS NULL)
              AND f.is_active = true
            ORDER BY f.created_at DESC
        `, [structureId]);
        return result.rows;
    }

    /**
     * Créer un nouveau formulaire
     */
    static async create(formData) {
        const { title, description, schema, assigned_to_structure_id, created_by } = formData;
        
        const result = await db.query(`
            INSERT INTO forms (title, description, schema, assigned_to_structure_id, created_by)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING *
        `, [title, description || null, schema, assigned_to_structure_id || null, created_by]);
        
        return result.rows[0];
    }

    /**
     * Mettre à jour un formulaire
     */
    static async update(id, formData) {
        const { title, description, schema, assigned_to_structure_id, is_active } = formData;
        
        const result = await db.query(`
            UPDATE forms
            SET title = COALESCE($1, title),
                description = COALESCE($2, description),
                schema = COALESCE($3, schema),
                assigned_to_structure_id = COALESCE($4, assigned_to_structure_id),
                is_active = COALESCE($5, is_active)
            WHERE id = $6
            RETURNING *
        `, [title, description, schema, assigned_to_structure_id, is_active, id]);
        
        return result.rows[0];
    }

    /**
     * Supprimer un formulaire (soft delete)
     */
    static async delete(id) {
        const result = await db.query(`
            UPDATE forms SET is_active = false WHERE id = $1 RETURNING id
        `, [id]);
        
        return result.rows[0];
    }

    /**
     * Soumettre une réponse à un formulaire
     */
    static async submitResponse(submissionData) {
        const { form_id, project_id, data, submitted_by_user_id } = submissionData;
        
        const result = await db.query(`
            INSERT INTO form_submissions (form_id, project_id, data, submitted_by_user_id)
            VALUES ($1, $2, $3, $4)
            RETURNING *
        `, [form_id, project_id || null, data, submitted_by_user_id]);
        
        return result.rows[0];
    }

    /**
     * Récupérer les réponses d'un formulaire
     */
    static async getSubmissions(formId) {
        const result = await db.query(`
            SELECT fs.*,
                   u.username as submitter_username,
                   p.title as project_title
            FROM form_submissions fs
            LEFT JOIN users u ON fs.submitted_by_user_id = u.id
            LEFT JOIN projects p ON fs.project_id = p.id
            WHERE fs.form_id = $1
            ORDER BY fs.submitted_at DESC
        `, [formId]);
        return result.rows;
    }

    /**
     * Récupérer une soumission par ID
     */
    static async getSubmissionById(id) {
        const result = await db.query(`
            SELECT fs.*,
                   f.title as form_title,
                   u.username as submitter_username,
                   p.title as project_title
            FROM form_submissions fs
            LEFT JOIN forms f ON fs.form_id = f.id
            LEFT JOIN users u ON fs.submitted_by_user_id = u.id
            LEFT JOIN projects p ON fs.project_id = p.id
            WHERE fs.id = $1
        `, [id]);
        return result.rows[0];
    }
}

module.exports = FormModel;

