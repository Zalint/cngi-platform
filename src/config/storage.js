/**
 * Abstraction de stockage des fichiers uploadés.
 *
 * Switch via env var STORAGE_DRIVER :
 *   - 'disk' (défaut) : disque local, dossier configurable via UPLOADS_DIR
 *                       (par défaut <repo>/uploads). Convient au dev et à un
 *                       déploiement Render avec disque persistant monté.
 *   - 'r2'            : Cloudflare R2 / S3-compatible. NON IMPLÉMENTÉ —
 *                       voir le stub createR2Storage() pour le contrat exact
 *                       à respecter lors de la migration.
 *
 * Interface exposée par le driver (toutes méthodes obligatoires) :
 *   - driver        : string identifiant ('disk' | 'r2')
 *   - init()        : crée le dossier / vérifie le bucket. Idempotent.
 *   - multerStorage(): retourne un objet multer.StorageEngine pour
 *                     l'upload (multer.diskStorage côté disk,
 *                     multer-s3 côté R2).
 *   - deleteFile(row): supprime le fichier physique correspondant à un
 *                     enregistrement de la table `uploads` (row).
 *   - mountStatic(app): pour le driver disk, monte express.static sur
 *                     /uploads pour servir les fichiers en HTTP. Pour R2
 *                     ce sera no-op (les fichiers sont servis par R2
 *                     directement via URL signée ou public bucket).
 *
 * Le fichier physique stocké n'est jamais référencé directement ailleurs
 * dans le code : on passe toujours par `storage.deleteFile(row)` etc.
 * → quand on switch sur R2, aucune autre ligne à toucher dans le repo.
 */

const path = require('path');
const fs = require('fs');
const multer = require('multer');
const db = require('./db');

const DRIVER = (process.env.STORAGE_DRIVER || 'disk').toLowerCase();

// Limite de taille d'upload, configurable côté admin via la table app_config
// (category='upload_limits', value='max_file_size_mb'). Mise en cache 30s pour
// éviter une requête SQL à chaque upload — la valeur change rarement et un
// admin qui réduit la limite verra le changement appliqué sous 30s.
const DEFAULT_MAX_BYTES = 5 * 1024 * 1024;
const FALLBACK_ENV_BYTES = parseInt(process.env.MAX_FILE_SIZE) || DEFAULT_MAX_BYTES;
let _cachedMaxBytes = null;
let _cachedAt = 0;
const CACHE_TTL_MS = 30_000;

async function getMaxUploadBytes() {
    const now = Date.now();
    if (_cachedMaxBytes !== null && (now - _cachedAt) < CACHE_TTL_MS) {
        return _cachedMaxBytes;
    }
    try {
        const r = await db.query(
            `SELECT label FROM app_config
             WHERE category = 'upload_limits' AND value = 'max_file_size_mb' AND is_active = true
             LIMIT 1`
        );
        const mb = r.rows[0] ? parseInt(r.rows[0].label, 10) : NaN;
        // Borne : 1 Mo minimum (sécurité), 500 Mo maximum (sanity check côté DB)
        const safe = (Number.isFinite(mb) && mb >= 1 && mb <= 500) ? mb : null;
        _cachedMaxBytes = safe ? safe * 1024 * 1024 : FALLBACK_ENV_BYTES;
        _cachedAt = now;
    } catch (err) {
        // DB indisponible : on prend l'env var ou le défaut
        console.error('getMaxUploadBytes failed, fallback to env/default:', err.message);
        _cachedMaxBytes = FALLBACK_ENV_BYTES;
        _cachedAt = now;
    }
    return _cachedMaxBytes;
}

function invalidateMaxUploadBytesCache() {
    _cachedMaxBytes = null;
    _cachedAt = 0;
}

function createDiskStorage() {
    // Chemin absolu résolu une seule fois au boot. UPLOADS_DIR peut être un
    // chemin absolu (ex. /var/data/uploads sur Render Disk) ou relatif au
    // process.cwd() (ex. dossier ./uploads en dev).
    const uploadsDir = process.env.UPLOADS_DIR
        ? path.resolve(process.env.UPLOADS_DIR)
        : path.join(__dirname, '../../uploads');

    return {
        driver: 'disk',
        uploadsDir,

        init() {
            if (!fs.existsSync(uploadsDir)) {
                fs.mkdirSync(uploadsDir, { recursive: true });
                console.log('Created uploads directory at', uploadsDir);
            }
        },

        multerStorage() {
            return multer.diskStorage({
                destination: (req, file, cb) => cb(null, uploadsDir),
                filename: (req, file, cb) => {
                    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
                    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
                }
            });
        },

        async deleteFile(row) {
            const p = row && row.path;
            if (p && fs.existsSync(p)) {
                fs.unlinkSync(p);
            }
        },

        mountStatic(app) {
            const express = require('express');
            app.use('/uploads', express.static(uploadsDir));
        }
    };
}

function createR2Storage() {
    // Stub : NE PAS throw au require pour ne pas crasher le démarrage de l'app.
    // L'erreur est différée à l'appel effectif d'une méthode storage (upload,
    // suppression…) — ce qui permet au reste du serveur (auth, dashboard, etc.)
    // de continuer à servir si jamais STORAGE_DRIVER=r2 est posé par erreur en
    // production avant que l'implémentation ne soit livrée.
    //
    // Plan d'implémentation effective :
    //   1. npm i @aws-sdk/client-s3 multer-s3
    //   2. Lire CF_R2_ACCOUNT_ID, CF_R2_ACCESS_KEY_ID, CF_R2_SECRET_ACCESS_KEY,
    //      CF_R2_BUCKET, CF_R2_ENDPOINT depuis process.env.
    //   3. const s3 = new S3Client({ region:'auto', endpoint, credentials:{...} })
    //   4. multerStorage() → multerS3({ s3, bucket, key: ... })
    //   5. deleteFile(row) → s3.send(new DeleteObjectCommand({ Bucket, Key: row.filename }))
    //   6. mountStatic(app) → no-op (les fichiers sont accédés via URL signée
    //      ou bucket public ; le contrôleur uploads expose un endpoint qui
    //      renvoie un getSignedUrl temporaire).
    //   7. Le contrôleur uploads stocke `filename` (= clé S3) en DB ; `path`
    //      reste utilisé en disk-mode mais peut rester null en R2-mode.
    const notImplemented = (method) => {
        throw new Error(
            `STORAGE_DRIVER='r2' : ${method}() pas encore implémenté. ` +
            `Voir src/config/storage.js → createR2Storage() pour le plan de migration.`
        );
    };
    return {
        driver: 'r2',
        // init() ne throw pas : démarrage tolérant. Loggue pour visibilité.
        init() {
            console.warn(
                "STORAGE_DRIVER='r2' configuré mais le driver R2 n'est pas implémenté. " +
                "Les uploads échoueront jusqu'à l'implémentation effective."
            );
        },
        // mountStatic est un no-op naturel en R2 (les fichiers ne sont pas servis
        // par express, ils sont accédés via URL signée). On le rend safe.
        mountStatic() { /* no-op */ },
        // Les méthodes effectives lèvent SEULEMENT si elles sont appelées.
        multerStorage() { notImplemented('multerStorage'); },
        deleteFile()    { return Promise.reject(new Error(
            "STORAGE_DRIVER='r2' : deleteFile() pas encore implémenté."
        )); },
    };
}

const storage = DRIVER === 'r2' ? createR2Storage() : createDiskStorage();

// Helpers exposés en plus de l'interface du driver
storage.getMaxUploadBytes = getMaxUploadBytes;
storage.invalidateMaxUploadBytesCache = invalidateMaxUploadBytesCache;

module.exports = storage;
