const db = require('../config/db');

function buildVisibilityClause(user, paramOffset = 1) {
    // Returns { sql, params } appending to a WHERE already containing `WHERE 1=1`
    // paramOffset: starting $N index
    const params = [];
    let i = paramOffset;

    if (user.role === 'admin' || user.role === 'superviseur') {
        return { sql: '', params };
    }

    const clauses = [];

    // Author
    clauses.push(`pv.author_id = $${i}`);
    params.push(user.id);
    i++;

    // Commandement territorial at matching scope
    if (user.role === 'commandement_territorial' && user.territorial_level && user.territorial_value) {
        clauses.push(`(pv.territorial_level = $${i} AND pv.territorial_value = $${i + 1})`);
        params.push(user.territorial_level, user.territorial_value);
        i += 2;
    }

    // Access via linked resource → project → structure
    if (user.structure_id) {
        const sid = i;
        params.push(user.structure_id);
        i++;
        clauses.push(`
            EXISTS (SELECT 1 FROM pv_projects pp
                    JOIN project_structures ps ON pp.project_id = ps.project_id
                    WHERE pp.pv_id = pv.id AND ps.structure_id = $${sid})
            OR EXISTS (SELECT 1 FROM pv_measures pm
                       JOIN measures m ON pm.measure_id = m.id
                       JOIN project_structures ps ON m.project_id = ps.project_id
                       WHERE pm.pv_id = pv.id AND ps.structure_id = $${sid})
            OR EXISTS (SELECT 1 FROM pv_sites psi
                       JOIN sites si ON psi.site_id = si.id
                       JOIN project_structures ps ON si.project_id = ps.project_id
                       WHERE psi.pv_id = pv.id AND ps.structure_id = $${sid})
            OR EXISTS (SELECT 1 FROM pv_localities pl
                       JOIN localities lo ON pl.locality_id = lo.id
                       JOIN project_structures ps ON lo.project_id = ps.project_id
                       WHERE pl.pv_id = pv.id AND ps.structure_id = $${sid})
        `);
    }

    // Measures directly assigned to user
    clauses.push(`EXISTS (SELECT 1 FROM pv_measures pm
                          JOIN measures m ON pm.measure_id = m.id
                          WHERE pm.pv_id = pv.id AND m.assigned_user_id = $${i})`);
    params.push(user.id);
    i++;

    return { sql: ` AND (${clauses.join(' OR ')})`, params };
}

class PvModel {
    static async findAllVisible(user) {
        const visibility = buildVisibilityClause(user, 1);
        const result = await db.query(`
            SELECT pv.*,
                   u.username as author_username,
                   u.first_name as author_first_name,
                   u.last_name as author_last_name,
                   u.title as author_title,
                   (SELECT read_at FROM pv_reads WHERE pv_id = pv.id AND user_id = $${visibility.params.length + 1}) as read_at
            FROM pv_reports pv
            LEFT JOIN users u ON pv.author_id = u.id
            WHERE 1=1 ${visibility.sql}
            ORDER BY
                CASE pv.priority WHEN 'urgente' THEN 1 WHEN 'importante' THEN 2 ELSE 3 END,
                pv.created_at DESC
        `, [...visibility.params, user.id]);
        const pvs = result.rows;
        if (pvs.length === 0) return pvs;

        const ids = pvs.map(p => p.id);
        const [pjs, pms, psi, pls, atts] = await Promise.all([
            db.query(`SELECT pp.pv_id, p.id, p.title FROM pv_projects pp JOIN projects p ON pp.project_id = p.id WHERE pp.pv_id = ANY($1::int[])`, [ids]),
            db.query(`SELECT pm.pv_id, m.id, m.description FROM pv_measures pm JOIN measures m ON pm.measure_id = m.id WHERE pm.pv_id = ANY($1::int[])`, [ids]),
            db.query(`SELECT ps.pv_id, s.id, s.name FROM pv_sites ps JOIN sites s ON ps.site_id = s.id WHERE ps.pv_id = ANY($1::int[])`, [ids]),
            db.query(`SELECT pl.pv_id, l.id, l.region, l.departement, l.arrondissement, l.commune FROM pv_localities pl JOIN localities l ON pl.locality_id = l.id WHERE pl.pv_id = ANY($1::int[])`, [ids]),
            db.query(`SELECT entity_id as pv_id, id, filename, original_filename, label, mime_type, size FROM uploads WHERE entity_type = 'pv' AND entity_id = ANY($1::int[]) ORDER BY uploaded_at DESC`, [ids])
        ]);
        const group = (rows) => rows.reduce((acc, r) => { (acc[r.pv_id] ||= []).push(r); return acc; }, {});
        const gp = group(pjs.rows), gm = group(pms.rows), gs = group(psi.rows), gl = group(pls.rows), ga = group(atts.rows);
        for (const pv of pvs) {
            pv.projects = (gp[pv.id] || []).map(({ pv_id, ...x }) => x);
            pv.measures = (gm[pv.id] || []).map(({ pv_id, ...x }) => x);
            pv.sites = (gs[pv.id] || []).map(({ pv_id, ...x }) => x);
            pv.localities = (gl[pv.id] || []).map(({ pv_id, ...x }) => x);
            pv.attachments = (ga[pv.id] || []).map(({ pv_id, ...x }) => x);
        }
        return pvs;
    }

    static async findByIdForUser(id, user) {
        const visibility = buildVisibilityClause(user, 2);
        const result = await db.query(`
            SELECT pv.*,
                   u.username as author_username,
                   u.first_name as author_first_name,
                   u.last_name as author_last_name
            FROM pv_reports pv
            LEFT JOIN users u ON pv.author_id = u.id
            WHERE pv.id = $1 ${visibility.sql}
        `, [id, ...visibility.params]);
        const pv = result.rows[0];
        if (!pv) return null;

        const [projects, measures, sites, localities, attachments] = await Promise.all([
            db.query(`SELECT p.id, p.title FROM pv_projects pp JOIN projects p ON pp.project_id = p.id WHERE pp.pv_id = $1`, [id]),
            db.query(`SELECT m.id, m.description FROM pv_measures pm JOIN measures m ON pm.measure_id = m.id WHERE pm.pv_id = $1`, [id]),
            db.query(`SELECT s.id, s.name FROM pv_sites ps JOIN sites s ON ps.site_id = s.id WHERE ps.pv_id = $1`, [id]),
            db.query(`SELECT l.id, l.region, l.departement, l.arrondissement, l.commune FROM pv_localities pl JOIN localities l ON pl.locality_id = l.id WHERE pl.pv_id = $1`, [id]),
            db.query(`SELECT id, filename, original_filename, label, mime_type, size FROM uploads WHERE entity_type = 'pv' AND entity_id = $1 ORDER BY uploaded_at DESC`, [id])
        ]);
        pv.projects = projects.rows;
        pv.measures = measures.rows;
        pv.sites = sites.rows;
        pv.localities = localities.rows;
        pv.attachments = attachments.rows;
        return pv;
    }

    static async create(authorId, territorialLevel, territorialValue, data) {
        const client = await db.getClient();
        try {
            await client.query('BEGIN');
            const ins = await client.query(`
                INSERT INTO pv_reports (author_id, territorial_level, territorial_value, visit_date, title, avancement, observations, recommendations, content, priority)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                RETURNING *
            `, [
                authorId, territorialLevel, territorialValue,
                data.visit_date || null,
                data.title,
                data.avancement || null,
                data.observations || null,
                data.recommendations || null,
                data.content || null,
                data.priority || 'info'
            ]);
            const pv = ins.rows[0];
            await this._replaceRefs(client, pv.id, data);
            await client.query('COMMIT');
            return pv;
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    }

    static async update(id, authorId, data) {
        const client = await db.getClient();
        try {
            await client.query('BEGIN');
            const upd = await client.query(`
                UPDATE pv_reports
                SET title = COALESCE($1, title),
                    visit_date = $2,
                    avancement = $3,
                    observations = $4,
                    recommendations = $5,
                    content = $6,
                    priority = COALESCE($7, priority),
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = $8 AND author_id = $9
                RETURNING *
            `, [
                data.title,
                data.visit_date || null,
                data.avancement || null,
                data.observations || null,
                data.recommendations || null,
                data.content || null,
                data.priority,
                id,
                authorId
            ]);
            if (upd.rowCount === 0) {
                await client.query('ROLLBACK');
                return null;
            }
            if (data.projects || data.measures || data.sites || data.localities) {
                await this._replaceRefs(client, id, data);
            }
            await client.query('COMMIT');
            return upd.rows[0];
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    }

    static async delete(id, authorId) {
        const result = await db.query(`DELETE FROM pv_reports WHERE id = $1 AND author_id = $2 RETURNING id`, [id, authorId]);
        return result.rows[0] || null;
    }

    static async _replaceRefs(client, pvId, data) {
        await client.query('DELETE FROM pv_projects WHERE pv_id = $1', [pvId]);
        await client.query('DELETE FROM pv_measures WHERE pv_id = $1', [pvId]);
        await client.query('DELETE FROM pv_sites WHERE pv_id = $1', [pvId]);
        await client.query('DELETE FROM pv_localities WHERE pv_id = $1', [pvId]);
        for (const pid of (data.projects || [])) {
            await client.query('INSERT INTO pv_projects (pv_id, project_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [pvId, pid]);
        }
        for (const mid of (data.measures || [])) {
            await client.query('INSERT INTO pv_measures (pv_id, measure_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [pvId, mid]);
        }
        for (const sid of (data.sites || [])) {
            await client.query('INSERT INTO pv_sites (pv_id, site_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [pvId, sid]);
        }
        for (const lid of (data.localities || [])) {
            await client.query('INSERT INTO pv_localities (pv_id, locality_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [pvId, lid]);
        }
    }

    // ==================== Unread tracking ====================

    static async getUnreadCount(user) {
        const visibility = buildVisibilityClause(user, 2);
        const result = await db.query(`
            SELECT COUNT(*) as unread
            FROM pv_reports pv
            WHERE NOT EXISTS (SELECT 1 FROM pv_reads r WHERE r.pv_id = pv.id AND r.user_id = $1)
            ${visibility.sql}
        `, [user.id, ...visibility.params]);
        return parseInt(result.rows[0].unread) || 0;
    }

    static async markAsRead(pvId, userId) {
        await db.query(`
            INSERT INTO pv_reads (pv_id, user_id, read_at)
            VALUES ($1, $2, CURRENT_TIMESTAMP)
            ON CONFLICT (pv_id, user_id) DO UPDATE SET read_at = CURRENT_TIMESTAMP
        `, [pvId, userId]);
    }

    static async getPickable(user) {
        // Renvoie projets/sites/localités/mesures que l'utilisateur peut référencer dans un PV.
        // Pour commandement_territorial : filtré par son territoire (via localities/sites).
        // Pour admin/superviseur : tout.
        const params = [];
        let projectFilter = '';
        if (user.role === 'commandement_territorial' && user.territorial_level && user.territorial_value) {
            const allowed = ['region', 'departement', 'arrondissement'];
            if (!allowed.includes(user.territorial_level)) throw new Error('Invalid territorial level');
            projectFilter = `
                WHERE id IN (
                    SELECT DISTINCT project_id FROM localities WHERE ${user.territorial_level} = $1
                    UNION
                    SELECT DISTINCT project_id FROM sites WHERE ${user.territorial_level} = $1
                )
            `;
            params.push(user.territorial_value);
        }

        const projectsRes = await db.query(`
            SELECT id, title, structure_id FROM projects ${projectFilter} ORDER BY title
        `, params);
        const projectIds = projectsRes.rows.map(p => p.id);
        if (projectIds.length === 0) {
            return { projects: [], sites: [], localities: [], measures: [] };
        }

        const [sitesRes, localitiesRes, measuresRes, structuresRes] = await Promise.all([
            db.query(`SELECT id, project_id, name, region, departement, commune FROM sites WHERE project_id = ANY($1::int[]) ORDER BY name`, [projectIds]),
            db.query(`SELECT id, project_id, region, departement, arrondissement, commune FROM localities WHERE project_id = ANY($1::int[]) ORDER BY region, departement, commune`, [projectIds]),
            db.query(`SELECT id, project_id, description, type FROM measures WHERE project_id = ANY($1::int[]) ORDER BY description`, [projectIds]),
            db.query(`SELECT id, code FROM structures`)
        ]);

        const structMap = Object.fromEntries(structuresRes.rows.map(s => [s.id, s.code]));
        const projects = projectsRes.rows.map(p => ({ id: p.id, title: p.title, structure_code: structMap[p.structure_id] || null }));
        return {
            projects,
            sites: sitesRes.rows,
            localities: localitiesRes.rows,
            measures: measuresRes.rows
        };
    }

    static async markAllAsRead(user) {
        // Mark every currently-visible PV as read for this user
        const visibility = buildVisibilityClause(user, 2);
        await db.query(`
            INSERT INTO pv_reads (pv_id, user_id, read_at)
            SELECT pv.id, $1, CURRENT_TIMESTAMP
            FROM pv_reports pv
            WHERE 1=1 ${visibility.sql}
            ON CONFLICT (pv_id, user_id) DO UPDATE SET read_at = CURRENT_TIMESTAMP
        `, [user.id, ...visibility.params]);
    }
}

module.exports = PvModel;
