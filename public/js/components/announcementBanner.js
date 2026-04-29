// Bandeau d'annonce broadcast (admin → tous les utilisateurs).
// Affiché en haut de page, dismissable côté front via localStorage,
// rafraîchi toutes les 60 secondes.

const AnnouncementBanner = {
    POLL_INTERVAL_MS: 60 * 1000,
    DISMISSED_KEY: 'cngi_dismissed_announcements',
    SEEN_KEY: 'cngi_seen_announcements',
    pollTimer: null,
    cache: [],

    getSeen() {
        try { return JSON.parse(localStorage.getItem(this.SEEN_KEY) || '[]'); } catch { return []; }
    },

    markSeen(id) {
        const ids = this.getSeen();
        if (!ids.includes(id)) ids.push(id);
        localStorage.setItem(this.SEEN_KEY, JSON.stringify(ids.slice(-100)));
    },

    init() {
        if (!Auth || !Auth.isAuthenticated()) return;
        if (document.getElementById('announcement-banner-root')) return;

        const root = document.createElement('div');
        root.id = 'announcement-banner-root';
        // position:fixed pour passer par-dessus la sidebar (z-index:1000 dans main.css).
        // top:0 et largeur pleine ; les sous-bandeaux empilés se rendent en colonne.
        root.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:1100;';
        document.body.insertBefore(root, document.body.firstChild);

        this.refresh();
        this.startPolling();
    },

    startPolling() {
        this.stopPolling();
        this.pollTimer = setInterval(() => this.refresh(), this.POLL_INTERVAL_MS);
    },

    stopPolling() {
        if (this.pollTimer) clearInterval(this.pollTimer);
        this.pollTimer = null;
    },

    getDismissed() {
        try {
            return JSON.parse(localStorage.getItem(this.DISMISSED_KEY) || '[]');
        } catch { return []; }
    },

    dismiss(id) {
        const ids = this.getDismissed();
        if (!ids.includes(id)) ids.push(id);
        // Garder seulement les 50 plus récents pour borner la taille
        localStorage.setItem(this.DISMISSED_KEY, JSON.stringify(ids.slice(-50)));
        this.render();
    },

    async refresh() {
        if (!Auth.isAuthenticated()) return;
        try {
            const res = await API.announcements.getActive();
            this.cache = res.data || [];
            this.render();
        } catch {
            // silencieux : ne pas spammer la console si réseau down
        }
    },

    applyOffset(rootEl) {
        // Décale la sidebar et le contenu principal pour ne pas masquer le logo
        // et la topbar quand le bandeau est visible. Mesure la hauteur réelle
        // du bandeau (peut contenir plusieurs annonces empilées).
        const h = rootEl.offsetHeight;
        const sidebar = document.querySelector('.sidebar');
        const main = document.querySelector('.main-content');
        if (sidebar) {
            sidebar.style.top = h + 'px';
            sidebar.style.height = `calc(100vh - ${h}px)`;
        }
        if (main) {
            main.style.paddingTop = h + 'px';
        }
    },

    clearOffset() {
        const sidebar = document.querySelector('.sidebar');
        const main = document.querySelector('.main-content');
        if (sidebar) {
            sidebar.style.top = '';
            sidebar.style.height = '';
        }
        if (main) {
            main.style.paddingTop = '';
        }
    },

    render() {
        const root = document.getElementById('announcement-banner-root');
        if (!root) return;
        const dismissed = new Set(this.getDismissed());
        const visible = this.cache.filter(a => !(a.dismissable && dismissed.has(a.id)));

        if (visible.length === 0) {
            root.innerHTML = '';
            this.clearOffset();
            return;
        }

        const colors = {
            info:     { bg: '#dbeafe', border: '#3b82f6', text: '#0c1e4a', icon: 'ℹ' },
            warning:  { bg: '#fef3c7', border: '#f59e0b', text: '#451a03', icon: '⚠' },
            critical: { bg: '#fee2e2', border: '#dc2626', text: '#450a0a', icon: '⛔' }
        };

        const seen = new Set(this.getSeen());
        const newIds = [];

        const html = visible.map(a => {
            const c = colors[a.level] || colors.info;
            const esc = (t) => String(t || '').replace(/[&<>"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[ch]));
            const isNew = !seen.has(a.id);
            if (isNew) newIds.push(a.id);
            const dismissBtn = a.dismissable
                ? `<button onclick="AnnouncementBanner.dismiss(${a.id})" title="Masquer" aria-label="Masquer" style="background:transparent;border:none;cursor:pointer;color:${c.text};font-size:18px;line-height:1;padding:0 4px;opacity:0.6;flex-shrink:0;" onmouseover="this.style.opacity=1" onmouseout="this.style.opacity=0.6">×</button>`
                : '';
            const animClass = isNew ? ' announcement-new' : '';
            return `
                <div class="announcement-row${animClass}" style="background:${c.bg};border-bottom:2px solid ${c.border};color:${c.text};padding:12px 18px;display:flex;align-items:center;gap:12px;font-size:15px;line-height:1.5;">
                    <span class="announcement-icon" style="font-size:18px;flex-shrink:0;">${c.icon}</span>
                    <div style="flex:1;font-weight:700;">${esc(a.message)}</div>
                    ${dismissBtn}
                </div>
            `;
        }).join('');
        root.innerHTML = html;
        // Mesurer après render et décaler la mise en page
        requestAnimationFrame(() => this.applyOffset(root));

        // Marquer comme "vu" après l'animation (3.5s) pour ne pas réanimer
        // au polling suivant ni à la navigation entre pages.
        if (newIds.length > 0) {
            setTimeout(() => newIds.forEach(id => this.markSeen(id)), 3500);
        }
    }
};

// CSS de l'animation (injecté une fois)
(function injectAnnouncementStyles() {
    if (document.getElementById('announcement-banner-styles')) return;
    const style = document.createElement('style');
    style.id = 'announcement-banner-styles';
    style.textContent = `
        @keyframes announcementShake {
            0%, 100% { transform: translateY(0); }
            10%, 30%, 50% { transform: translateY(-3px); }
            20%, 40%, 60% { transform: translateY(2px); }
            70% { transform: translateY(-2px); }
            80% { transform: translateY(1px); }
            90% { transform: translateY(0); }
        }
        @keyframes announcementPulse {
            0%, 100% { box-shadow: inset 0 0 0 0 rgba(0,0,0,0); }
            50% { box-shadow: inset 0 0 0 4px rgba(255,255,255,0.6); }
        }
        @keyframes announcementIconBounce {
            0%, 100% { transform: scale(1); }
            25% { transform: scale(1.4) rotate(-8deg); }
            50% { transform: scale(1.4) rotate(8deg); }
            75% { transform: scale(1.4) rotate(-4deg); }
        }
        .announcement-row.announcement-new {
            animation: announcementShake 0.7s ease-in-out 0s 3, announcementPulse 0.9s ease-in-out 0s 3;
        }
        .announcement-row.announcement-new .announcement-icon {
            display: inline-block;
            animation: announcementIconBounce 0.6s ease-in-out 0s 5;
        }
    `;
    document.head.appendChild(style);
})();

document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => AnnouncementBanner.init(), 600);
});
window.addEventListener('auth:login', () => AnnouncementBanner.init());

// Re-applique l'offset après changement de page SPA (la sidebar est rebuild)
window.addEventListener('hashchange', () => {
    setTimeout(() => {
        const root = document.getElementById('announcement-banner-root');
        if (root && root.innerHTML.trim()) AnnouncementBanner.applyOffset(root);
    }, 100);
});
