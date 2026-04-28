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

const DRIVER = (process.env.STORAGE_DRIVER || 'disk').toLowerCase();

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
    // À implémenter quand on bascule. Plan recommandé :
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
    throw new Error(
        "STORAGE_DRIVER='r2' n'est pas encore implémenté. " +
        "Voir src/config/storage.js → createR2Storage() pour le plan de migration."
    );
}

const storage = DRIVER === 'r2' ? createR2Storage() : createDiskStorage();

module.exports = storage;
