const db = require('../config/db');

const ALLOWED_KINDS = ['linestring', 'polygon'];
const ALLOWED_USAGE = ['drainage', 'intervention', 'zone_inondable', 'autre'];
const ALLOWED_VULN = ['normal', 'elevee', 'tres_elevee'];

/**
 * Modèle des géométries projet (polylignes et polygones).
 *
 * Une géométrie est rattachée à un projet et optionnellement à une structure
 * (qui détermine la couleur de rendu sur la carte). Le type d'usage contrôle
 * le style (trait continu pour drainage, pointillé pour intervention,
 * polygone translucide pour zone inondable).
 *
 * Les coordonnées sont stockées en JSONB au format GeoJSON :
 *   - LineString  → [[lng, lat], [lng, lat], ...]
 *   - Polygon     → [[[lng, lat], [lng, lat], ..., [lng, lat]]]  (anneau extérieur)
 */
class GeometryModel {
    static ALLOWED_KINDS = ALLOWED_KINDS;
    static ALLOWED_USAGE = ALLOWED_USAGE;

    static _validateKind(kind) {
        if (!ALLOWED_KINDS.includes(kind)) {
            const err = new Error(`kind invalide : "${kind}" (attendu : ${ALLOWED_KINDS.join(' | ')})`);
            err.statusCode = 400;
            throw err;
        }
        return kind;
    }

    static _validateUsage(usage) {
        if (usage === null || usage === undefined || usage === '') return 'autre';
        if (!ALLOWED_USAGE.includes(usage)) {
            const err = new Error(`usage_type invalide : "${usage}" (attendu : ${ALLOWED_USAGE.join(' | ')})`);
            err.statusCode = 400;
            throw err;
        }
        return usage;
    }

    static _validateVulnerability(value) {
        if (value === null || value === undefined || value === '') return 'normal';
        if (!ALLOWED_VULN.includes(value)) {
            const err = new Error(`vulnerability_level invalide : "${value}" (attendu : ${ALLOWED_VULN.join(' | ')})`);
            err.statusCode = 400;
            throw err;
        }
        return value;
    }

    static _validateCoordinates(kind, coords) {
        if (!Array.isArray(coords) || coords.length === 0) {
            const err = new Error('coordinates doit être un tableau non vide');
            err.statusCode = 400;
            throw err;
        }
        if (kind === 'linestring') {
            if (coords.length < 2) {
                const err = new Error('Une polyligne doit contenir au moins 2 points');
                err.statusCode = 400;
                throw err;
            }
            for (const pt of coords) {
                if (!Array.isArray(pt) || pt.length < 2 || !Number.isFinite(pt[0]) || !Number.isFinite(pt[1])) {
                    const err = new Error('Chaque point doit être [longitude, latitude] numérique');
                    err.statusCode = 400;
                    throw err;
                }
            }
        } else if (kind === 'polygon') {
            // Tableau d'anneaux ; on utilise au moins l'anneau extérieur
            if (!Array.isArray(coords[0]) || coords[0].length < 4) {
                const err = new Error('Un polygone doit contenir un anneau fermé d\'au moins 4 points');
                err.statusCode = 400;
                throw err;
            }
            for (const ring of coords) {
                for (const pt of ring) {
                    if (!Array.isArray(pt) || pt.length < 2 || !Number.isFinite(pt[0]) || !Number.isFinite(pt[1])) {
                        const err = new Error('Chaque point doit être [longitude, latitude] numérique');
                        err.statusCode = 400;
                        throw err;
                    }
                }
            }
        }
        return coords;
    }

    static async findByProjectId(projectId) {
        const result = await db.query(`
            SELECT g.*, s.code as structure_code, s.name as structure_name
            FROM geometries g
            LEFT JOIN structures s ON g.structure_id = s.id
            WHERE g.project_id = $1
            ORDER BY g.created_at DESC
        `, [projectId]);
        return result.rows;
    }

    static async findById(id) {
        const result = await db.query(`
            SELECT g.*, s.code as structure_code, s.name as structure_name
            FROM geometries g
            LEFT JOIN structures s ON g.structure_id = s.id
            WHERE g.id = $1
        `, [id]);
        return result.rows[0] || null;
    }

    static async create(projectId, data, userId) {
        const kind = this._validateKind(data.kind);
        const usage = this._validateUsage(data.usage_type);
        const vuln = this._validateVulnerability(data.vulnerability_level);
        const coordinates = this._validateCoordinates(kind, data.coordinates);

        const result = await db.query(`
            INSERT INTO geometries (project_id, structure_id, name, description, kind, usage_type, coordinates, color, vulnerability_level, created_by_user_id)
            VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, $10)
            RETURNING *
        `, [
            projectId,
            data.structure_id || null,
            data.name || 'Tracé sans nom',
            data.description || null,
            kind,
            usage,
            JSON.stringify(coordinates),
            data.color || null,
            vuln,
            userId || null
        ]);
        return result.rows[0];
    }

    static async update(id, data) {
        // Mise à jour des métadonnées uniquement (nom, description, structure, usage, color, vulnérabilité).
        // Pour changer la géométrie elle-même, supprimer et recréer.
        const usage = data.usage_type !== undefined ? this._validateUsage(data.usage_type) : null;
        const vuln = data.vulnerability_level !== undefined ? this._validateVulnerability(data.vulnerability_level) : null;
        const result = await db.query(`
            UPDATE geometries
            SET name = COALESCE($1, name),
                description = COALESCE($2, description),
                structure_id = COALESCE($3, structure_id),
                usage_type = COALESCE($4, usage_type),
                color = COALESCE($5, color),
                vulnerability_level = COALESCE($6, vulnerability_level),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $7
            RETURNING *
        `, [
            data.name || null,
            data.description || null,
            data.structure_id || null,
            usage,
            data.color || null,
            vuln,
            id
        ]);
        return result.rows[0] || null;
    }

    static async remove(id) {
        const result = await db.query(`DELETE FROM geometries WHERE id = $1 RETURNING id`, [id]);
        return result.rows[0] || null;
    }

    /**
     * Import GeoJSON FeatureCollection : crée toutes les géométries d'un coup.
     * Map les propriétés GeoJSON vers notre schéma :
     *   - feature.properties.name         → name
     *   - feature.properties.description  → description
     *   - feature.properties.structure_code → structure_id (résolu via lookup)
     *   - feature.properties.type         → usage_type
     *   - feature.geometry.type           → kind (LineString → linestring, Polygon → polygon)
     *   - feature.geometry.coordinates    → coordinates
     */
    static async importGeoJSON(projectId, geojson, userId) {
        if (!geojson || geojson.type !== 'FeatureCollection' || !Array.isArray(geojson.features)) {
            const err = new Error('GeoJSON invalide : FeatureCollection attendu');
            err.statusCode = 400;
            throw err;
        }

        // Précharger les structures pour résoudre structure_code → structure_id
        const structuresRes = await db.query(`SELECT id, code FROM structures`);
        const structureByCode = {};
        for (const s of structuresRes.rows) structureByCode[s.code.toUpperCase()] = s.id;

        const client = await db.getClient();
        const imported = [];
        try {
            await client.query('BEGIN');
            for (const feature of geojson.features) {
                if (!feature || feature.type !== 'Feature' || !feature.geometry) continue;
                const geomType = feature.geometry.type;
                let kind;
                if (geomType === 'LineString') kind = 'linestring';
                else if (geomType === 'Polygon') kind = 'polygon';
                else continue; // Point, MultiLineString, etc. : ignorés pour Phase 1

                const props = feature.properties || {};
                const structureCode = (props.structure_code || '').toUpperCase();
                const structureId = structureByCode[structureCode] || null;
                const usage = ALLOWED_USAGE.includes(props.type) ? props.type : 'autre';
                const vuln = ALLOWED_VULN.includes(props.vulnerability_level) ? props.vulnerability_level : 'normal';

                try {
                    this._validateCoordinates(kind, feature.geometry.coordinates);
                } catch (err) {
                    // Ignorer cette feature plutôt que d'abandonner tout l'import
                    continue;
                }

                const row = await client.query(`
                    INSERT INTO geometries (project_id, structure_id, name, description, kind, usage_type, coordinates, vulnerability_level, created_by_user_id)
                    VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9)
                    RETURNING *
                `, [
                    projectId,
                    structureId,
                    props.name || 'Tracé importé',
                    props.description || null,
                    kind,
                    usage,
                    JSON.stringify(feature.geometry.coordinates),
                    vuln,
                    userId || null
                ]);
                imported.push(row.rows[0]);
            }
            await client.query('COMMIT');
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
        return imported;
    }
}

module.exports = GeometryModel;
