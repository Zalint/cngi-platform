const db = require('../config/db');

/**
 * GET /api/measures/my
 * Renvoie toutes les mesures assignées à l'utilisateur authentifié,
 * toutes structures et tous projets confondus.
 *
 * Filtres optionnels en querystring :
 *   ?status=preconisee|executee|non_executee|observations
 *   ?overdue=1   → uniquement les mesures dont le projet a une échéance passée
 */
exports.listMine = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { status, overdue } = req.query;

        let query = `
            SELECT
                m.id,
                m.project_id,
                m.site_id,
                m.description,
                m.type,
                m.status,
                m.constraints,
                m.created_at,
                p.title as project_title,
                p.status as project_status,
                p.priority as project_priority,
                p.deadline_date as project_deadline,
                s.name as site_name,
                s.commune as site_commune,
                s.region as site_region,
                ms.code as structure_code,
                ms.name as structure_name,
                (SELECT COUNT(*) FROM measure_comments WHERE measure_id = m.id) as comments_count
            FROM measures m
            INNER JOIN projects p ON m.project_id = p.id
            LEFT JOIN sites s ON m.site_id = s.id
            LEFT JOIN structures ms ON m.structure_id = ms.id
            WHERE m.assigned_user_id = $1
        `;
        const params = [userId];
        let i = 2;

        if (status) {
            query += ` AND m.status = $${i++}`;
            params.push(status);
        }
        if (overdue === '1' || overdue === 'true') {
            query += ` AND p.deadline_date IS NOT NULL AND p.deadline_date < CURRENT_DATE AND m.status != 'executee'`;
        }

        // Tri : urgent d'abord (statut non terminé + échéance proche), puis par date de création
        query += `
            ORDER BY
                CASE WHEN m.status = 'executee' THEN 1 ELSE 0 END ASC,
                CASE p.priority WHEN 'urgente' THEN 1 WHEN 'haute' THEN 2 ELSE 3 END ASC,
                p.deadline_date ASC NULLS LAST,
                m.created_at DESC
        `;

        const result = await db.query(query, params);
        res.json({ success: true, count: result.rows.length, data: result.rows });
    } catch (err) {
        next(err);
    }
};

/**
 * GET /api/measures/my/stats
 * Résumé compact pour widget dashboard / badge navbar.
 */
exports.myStats = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const result = await db.query(`
            SELECT
                COUNT(*) FILTER (WHERE m.status = 'preconisee')      as preconisee,
                COUNT(*) FILTER (WHERE m.status = 'executee')        as executee,
                COUNT(*) FILTER (WHERE m.status = 'non_executee')    as non_executee,
                COUNT(*) FILTER (WHERE m.status = 'observations')    as observations,
                COUNT(*) FILTER (WHERE m.status != 'executee')       as pending,
                COUNT(*) FILTER (
                    WHERE m.status != 'executee'
                      AND p.deadline_date IS NOT NULL
                      AND p.deadline_date < CURRENT_DATE
                )                                                    as overdue,
                COUNT(*) FILTER (
                    WHERE m.status != 'executee'
                      AND p.deadline_date IS NOT NULL
                      AND p.deadline_date >= CURRENT_DATE
                      AND p.deadline_date < CURRENT_DATE + INTERVAL '7 days'
                )                                                    as due_soon,
                COUNT(*)                                             as total
            FROM measures m
            INNER JOIN projects p ON m.project_id = p.id
            WHERE m.assigned_user_id = $1
        `, [userId]);

        const row = result.rows[0] || {};
        // PG retourne des strings pour COUNT, convertir en number
        Object.keys(row).forEach(k => row[k] = parseInt(row[k]) || 0);

        res.json({ success: true, data: row });
    } catch (err) {
        next(err);
    }
};
