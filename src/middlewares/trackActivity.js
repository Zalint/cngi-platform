const db = require('../config/db');

/**
 * Tracking d'activité utilisateur pour l'écran admin "Sessions actives".
 *
 * Met à jour users.last_activity_at sur chaque requête authentifiée, mais
 * **throttled en mémoire** à 1 écriture/minute/utilisateur. Le but est
 * d'avoir un signal "en ligne / hors ligne" sans marteler la DB :
 * 100 users actifs = ~1.7 UPDATE/sec sur l'index PK, négligeable.
 *
 * Doit être monté APRÈS le middleware `protect` (qui pose req.user).
 *
 * Notes :
 * - fire-and-forget : on ne `await` pas la requête, l'erreur éventuelle est
 *   loggée mais ne perturbe pas la réponse HTTP.
 * - process-local : si l'app tourne en plusieurs workers/instances, chaque
 *   process a sa propre Map. Au pire on écrit N fois/min/user au lieu de 1,
 *   toujours acceptable.
 * - en test (NODE_ENV=test), désactivé par défaut pour éviter les écritures
 *   parasites pendant les tests unitaires.
 */

const WRITE_INTERVAL_MS = 60 * 1000; // 1 minute
const lastWritten = new Map(); // userId -> timestamp ms du dernier UPDATE

// Cap mémoire : si la Map explose (rotation de tokens, etc.), on la purge.
const MAX_MAP_SIZE = 10000;

function trackActivity(req, res, next) {
    if (process.env.NODE_ENV === 'test' && process.env.TRACK_ACTIVITY !== '1') {
        return next();
    }

    const userId = req.user?.id;
    if (!userId) return next();

    const now = Date.now();
    const prev = lastWritten.get(userId) || 0;

    if (now - prev > WRITE_INTERVAL_MS) {
        lastWritten.set(userId, now);

        if (lastWritten.size > MAX_MAP_SIZE) {
            // Purge naïve : on garde les MAX_MAP_SIZE/2 entrées les plus récentes.
            const entries = [...lastWritten.entries()].sort((a, b) => b[1] - a[1]);
            lastWritten.clear();
            for (const [k, v] of entries.slice(0, MAX_MAP_SIZE / 2)) lastWritten.set(k, v);
        }

        // fire-and-forget
        db.query('UPDATE users SET last_activity_at = NOW() WHERE id = $1', [userId])
            .catch(err => console.error('trackActivity update failed:', err.message));
    }

    next();
}

// Exposé pour tests.
trackActivity._reset = () => lastWritten.clear();

/**
 * Retire un user de la map du throttle. Utilisé après un force-logout admin
 * pour que la prochaine activité du user (post-reconnexion) écrive
 * immédiatement last_activity_at au lieu d'être throttled.
 */
trackActivity.clearUser = (userId) => {
    if (userId) lastWritten.delete(userId);
};

module.exports = trackActivity;
