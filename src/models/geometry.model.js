const db = require('../config/db');

const ALLOWED_KINDS = ['linestring', 'polygon'];
const ALLOWED_USAGE = ['drainage', 'intervention', 'zone_inondable', 'autre'];
const ALLOWED_VULN = ['normal', 'elevee', 'tres_elevee'];

// Cap sur le nombre de features importées en une seule requête, configurable
// par l'admin via app_config (category='import_limits', value='geometry_max_features').
// Cache 30s pour éviter une requête SQL à chaque import.
// Fallback : env var GEOMETRY_MAX_IMPORT, sinon 2000.
const DEFAULT_MAX_FEATURES = 2000;
const FALLBACK_ENV_MAX = parseInt(process.env.GEOMETRY_MAX_IMPORT, 10) || DEFAULT_MAX_FEATURES;
const MAX_FEATURES_HARD_CAP = 50000; // sanity côté serveur — protège la DB.
const CACHE_TTL_MS = 30_000;
let _cachedMaxFeatures = null;
let _cachedAt = 0;

async function getMaxFeatures() {
    const now = Date.now();
    if (_cachedMaxFeatures !== null && (now - _cachedAt) < CACHE_TTL_MS) {
        return _cachedMaxFeatures;
    }
    try {
        const r = await db.query(
            `SELECT label FROM app_config
             WHERE category = 'import_limits' AND value = 'geometry_max_features' AND is_active = true
             LIMIT 1`
        );
        const n = r.rows[0] ? parseInt(r.rows[0].label, 10) : NaN;
        const safe = (Number.isFinite(n) && n >= 1 && n <= MAX_FEATURES_HARD_CAP) ? n : null;
        _cachedMaxFeatures = safe ?? FALLBACK_ENV_MAX;
        _cachedAt = now;
    } catch (err) {
        console.error('getMaxFeatures failed, fallback to env/default:', err.message);
        _cachedMaxFeatures = FALLBACK_ENV_MAX;
        _cachedAt = now;
    }
    return _cachedMaxFeatures;
}

function invalidateMaxFeaturesCache() {
    _cachedMaxFeatures = null;
    _cachedAt = 0;
}

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
        // Mise à jour PATCH-safe : on ne modifie QUE les champs explicitement présents dans `data`.
        // - clé absente (undefined) → champ inchangé en base
        // - clé présente avec null    → valeur écrite comme NULL (permet de "clear")
        // - clé présente avec valeur  → valeur écrite après validation si applicable
        //
        // Cette sémantique évite que `data.x || null` confonde empty-string / null / undefined.
        const sets = [];
        const params = [];
        let i = 1;
        const has = (k) => Object.prototype.hasOwnProperty.call(data, k);

        if (has('name')) {
            sets.push(`name = $${i++}`);
            params.push(data.name);
        }
        if (has('description')) {
            sets.push(`description = $${i++}`);
            params.push(data.description);
        }
        if (has('structure_id')) {
            sets.push(`structure_id = $${i++}`);
            params.push(data.structure_id);
        }
        if (has('usage_type')) {
            sets.push(`usage_type = $${i++}`);
            params.push(this._validateUsage(data.usage_type));
        }
        if (has('color')) {
            sets.push(`color = $${i++}`);
            params.push(data.color);
        }
        if (has('vulnerability_level')) {
            sets.push(`vulnerability_level = $${i++}`);
            params.push(this._validateVulnerability(data.vulnerability_level));
        }

        if (sets.length === 0) {
            // Aucune modification demandée → on renvoie la ligne telle quelle pour rester idempotent.
            return this.findById(id);
        }

        sets.push('updated_at = CURRENT_TIMESTAMP');
        params.push(id);

        const result = await db.query(
            `UPDATE geometries SET ${sets.join(', ')} WHERE id = $${i} RETURNING *`,
            params
        );
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

        const maxFeatures = await getMaxFeatures();
        if (geojson.features.length > maxFeatures) {
            const err = new Error(
                `Trop de features à importer : ${geojson.features.length} reçues, maximum autorisé ${maxFeatures}. `
                + `Splitte ton fichier en plusieurs imports (un admin peut augmenter cette limite dans Configuration).`
            );
            err.statusCode = 413; // Payload Too Large (sémantique 13/413)
            throw err;
        }

        // Précharger les structures pour résoudre structure_code → structure_id
        const structuresRes = await db.query(`SELECT id, code FROM structures`);
        const structureByCode = {};
        for (const s of structuresRes.rows) {
            // Défensif : la colonne structures.code est NOT NULL en schéma, mais on se protège
            // d'une base migrée depuis une version antérieure ou d'un jeu de données exotique.
            const code = s.code != null ? String(s.code).toUpperCase() : null;
            if (code) structureByCode[code] = s.id;
        }

        const client = await db.getClient();
        const imported = [];
        const skipped = []; // [{ index, name, reason }]
        try {
            await client.query('BEGIN');
            for (let i = 0; i < geojson.features.length; i++) {
                const feature = geojson.features[i];
                const props = (feature && feature.properties) || {};
                const featureName = props.name || `Feature #${i + 1}`;

                if (!feature || feature.type !== 'Feature' || !feature.geometry) {
                    skipped.push({ index: i, name: featureName, reason: 'Feature invalide (structure GeoJSON incorrecte)' });
                    continue;
                }

                const geomType = feature.geometry.type;
                let kind;
                if (geomType === 'LineString') kind = 'linestring';
                else if (geomType === 'Polygon') kind = 'polygon';
                else {
                    skipped.push({ index: i, name: featureName, reason: `Type de géométrie non supporté : ${geomType} (seuls LineString et Polygon sont acceptés)` });
                    continue;
                }

                const structureCode = (props.structure_code || '').toUpperCase();
                const structureId = structureByCode[structureCode] || null;
                const usage = ALLOWED_USAGE.includes(props.type) ? props.type : 'autre';
                const vuln = ALLOWED_VULN.includes(props.vulnerability_level) ? props.vulnerability_level : 'normal';

                try {
                    this._validateCoordinates(kind, feature.geometry.coordinates);
                } catch (err) {
                    skipped.push({ index: i, name: featureName, reason: err.message });
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
        return { imported, skipped };
    }
}

module.exports = GeometryModel;
module.exports.getMaxFeatures = getMaxFeatures;
module.exports.invalidateMaxFeaturesCache = invalidateMaxFeaturesCache;
