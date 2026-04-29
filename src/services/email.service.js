const { Resend } = require('resend');

/**
 * Service d'envoi d'emails via Resend.
 *
 * Comportements clés :
 * - Si `RESEND_API_KEY` n'est pas définie, c'est un no-op silencieux (utile en
 *   dev / test, et pour ne pas casser la prod si la clé tourne).
 * - Si le destinataire n'a pas d'email, c'est un no-op silencieux (cf. spec :
 *   "si mail n'existe, ne pas envoyer de mail").
 * - Tout est fire-and-forget côté caller : un échec d'envoi ne casse jamais
 *   le flux métier (création de user, assignation de mesure…).
 *
 * Variables d'environnement :
 * - RESEND_API_KEY : clé API Resend (obligatoire pour activer l'envoi)
 * - RESEND_FROM    : expéditeur (défaut "CNGIRI <onboarding@resend.dev>")
 * - APP_URL        : URL publique de la plateforme, utilisée dans les liens
 */

let _client = null;
function getClient() {
    if (_client) return _client;
    const key = process.env.RESEND_API_KEY;
    if (!key) return null;
    _client = new Resend(key);
    return _client;
}

// Le domaine cngiri.com doit être vérifié dans Resend pour que ce FROM marche.
// Tant qu'il ne l'est pas, mettre RESEND_FROM=CNGIRI <onboarding@resend.dev>
// dans .env (sandbox Resend, n'envoie qu'à l'adresse owner).
const FROM = process.env.RESEND_FROM || 'CNGIRI <noreply@cngiri.com>';
const APP_URL = process.env.APP_URL || 'https://www.cngiri.com';

/**
 * Envoi générique. Ne lève jamais : log et retourne false en cas d'échec.
 * @returns {Promise<boolean>} true si envoyé, false sinon (no-op ou erreur).
 */
async function send({ to, subject, html, text }) {
    if (!to) return false;
    const client = getClient();
    if (!client) {
        // Pas de clé : log discret en dev pour faciliter le debug, sinon silence.
        if (process.env.NODE_ENV === 'development') {
            console.log(`[email] skip (no RESEND_API_KEY) → ${to} | ${subject}`);
        }
        return false;
    }
    try {
        await client.emails.send({ from: FROM, to, subject, html, text });
        return true;
    } catch (err) {
        console.error(`[email] échec envoi à ${to} :`, err?.message || err);
        return false;
    }
}

// ==================== Templates ====================

function htmlLayout(title, bodyHtml) {
    return `<!DOCTYPE html>
<html lang="fr"><head><meta charset="UTF-8"><title>${title}</title></head>
<body style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;background:#f4f6f9;margin:0;padding:24px;color:#1e3a5f;">
  <div style="max-width:560px;margin:0 auto;background:white;border-radius:10px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.06);">
    <div style="background:linear-gradient(135deg,#1a2249,#3794C4);color:white;padding:20px 24px;">
      <div style="font-weight:700;font-size:18px;">CNGIRI</div>
      <div style="font-size:12px;opacity:0.85;">Comité National de Gestion Intégrée du Risque d'Inondation</div>
    </div>
    <div style="padding:24px;line-height:1.6;font-size:14px;">${bodyHtml}</div>
    <div style="padding:14px 24px;background:#f8fafc;color:#94a3b8;font-size:11px;border-top:1px solid #eef;">
      Email automatique. Ne pas répondre.
    </div>
  </div>
</body></html>`;
}

function escape(t) {
    return String(t || '').replace(/[&<>"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c]));
}

/**
 * Email de bienvenue à la création d'un compte.
 */
async function sendWelcomeEmail(user) {
    if (!user || !user.email) return false;
    const fullName = [user.first_name, user.last_name].filter(Boolean).join(' ') || user.username;
    const body = `
        <h2 style="margin:0 0 12px;color:#1a2249;">Bienvenue, ${escape(fullName)}</h2>
        <p>Un compte vient d'être créé pour vous sur la plateforme CNGIRI.</p>
        <p style="background:#f0f4f8;padding:12px 16px;border-radius:6px;border-left:3px solid #3794C4;">
            <strong>Identifiant :</strong> ${escape(user.username)}<br>
            <strong>Rôle :</strong> ${escape(user.role)}
        </p>
        <p>Connectez-vous avec le mot de passe qui vous a été communiqué :</p>
        <p style="text-align:center;margin:24px 0;">
            <a href="${APP_URL}" style="background:#3794C4;color:white;text-decoration:none;padding:12px 24px;border-radius:6px;font-weight:600;display:inline-block;">Se connecter</a>
        </p>
        <p style="font-size:12px;color:#64748b;">Pensez à changer votre mot de passe à la première connexion (menu utilisateur → Changer le mot de passe).</p>
    `;
    return send({
        to: user.email,
        subject: 'Votre compte CNGIRI a été créé',
        html: htmlLayout('Bienvenue', body),
        text: `Bienvenue ${fullName}.\n\nUn compte CNGIRI a été créé pour vous.\nIdentifiant : ${user.username}\nRôle : ${user.role}\n\nConnectez-vous : ${APP_URL}`
    });
}

/**
 * Email envoyé quand une mesure est assignée à un utilisateur.
 */
async function sendMeasureAssignedEmail({ user, measure, project }) {
    if (!user || !user.email) return false;
    const fullName = [user.first_name, user.last_name].filter(Boolean).join(' ') || user.username;
    const body = `
        <h2 style="margin:0 0 12px;color:#1a2249;">Nouvelle mesure assignée</h2>
        <p>Bonjour ${escape(fullName)},</p>
        <p>Une mesure vient de vous être assignée dans le cadre du projet :</p>
        <p style="background:#f0f4f8;padding:12px 16px;border-radius:6px;border-left:3px solid #3794C4;">
            <strong>Projet :</strong> ${escape(project?.title || '—')}<br>
            <strong>Mesure :</strong> ${escape(measure?.description || '—')}<br>
            ${measure?.type ? `<strong>Type :</strong> ${escape(measure.type)}<br>` : ''}
            <strong>Statut initial :</strong> ${escape(measure?.status || 'preconisee')}
        </p>
        <p style="text-align:center;margin:24px 0;">
            <a href="${APP_URL}/#mes-mesures" style="background:#3794C4;color:white;text-decoration:none;padding:12px 24px;border-radius:6px;font-weight:600;display:inline-block;">Voir mes mesures</a>
        </p>
    `;
    return send({
        to: user.email,
        subject: `[CNGIRI] Mesure assignée — ${project?.title || ''}`.trim(),
        html: htmlLayout('Mesure assignée', body),
        text: `Bonjour ${fullName},\n\nUne mesure vous a été assignée.\nProjet : ${project?.title || '—'}\nMesure : ${measure?.description || '—'}\n\n${APP_URL}/#mes-mesures`
    });
}

/**
 * Email envoyé quand le statut d'une mesure change.
 */
async function sendMeasureStatusChangedEmail({ user, measure, project, oldStatus, newStatus }) {
    if (!user || !user.email) return false;
    const fullName = [user.first_name, user.last_name].filter(Boolean).join(' ') || user.username;
    const STATUS_FR = {
        preconisee: 'Préconisée',
        executee: 'Exécutée',
        non_executee: 'Non exécutée',
        observations: 'Observations'
    };
    const body = `
        <h2 style="margin:0 0 12px;color:#1a2249;">Statut de mesure mis à jour</h2>
        <p>Bonjour ${escape(fullName)},</p>
        <p>Le statut d'une mesure qui vous est assignée vient d'être modifié :</p>
        <p style="background:#f0f4f8;padding:12px 16px;border-radius:6px;border-left:3px solid #3794C4;">
            <strong>Projet :</strong> ${escape(project?.title || '—')}<br>
            <strong>Mesure :</strong> ${escape(measure?.description || '—')}<br>
            <strong>Ancien statut :</strong> ${escape(STATUS_FR[oldStatus] || oldStatus || '—')}<br>
            <strong>Nouveau statut :</strong> <span style="color:#3794C4;font-weight:700;">${escape(STATUS_FR[newStatus] || newStatus || '—')}</span>
        </p>
        <p style="text-align:center;margin:24px 0;">
            <a href="${APP_URL}/#mes-mesures" style="background:#3794C4;color:white;text-decoration:none;padding:12px 24px;border-radius:6px;font-weight:600;display:inline-block;">Voir mes mesures</a>
        </p>
    `;
    return send({
        to: user.email,
        subject: `[CNGIRI] Mesure : ${STATUS_FR[newStatus] || newStatus}`,
        html: htmlLayout('Statut de mesure', body),
        text: `Bonjour ${fullName},\n\nStatut d'une de vos mesures changé.\nProjet : ${project?.title || '—'}\nMesure : ${measure?.description || '—'}\n${oldStatus || '—'} → ${newStatus || '—'}\n\n${APP_URL}/#mes-mesures`
    });
}

module.exports = {
    send,
    sendWelcomeEmail,
    sendMeasureAssignedEmail,
    sendMeasureStatusChangedEmail
};
