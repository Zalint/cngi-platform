// Composant Navbar avec sidebar

const Navbar = {
    render() {
        const user = Auth.getUser();
        if (!user) return '';

        const isAdmin = Auth.hasRole('admin');
        const isUtilisateur = Auth.hasRole('utilisateur');
        
        return `
            <div class="sidebar show">
                <div class="sidebar-header">
                    <div class="logo-container">
                        <img src="https://mha.gouv.sn/wp-content/uploads/2020/10/logo_mha_transparent3-1.png" alt="MHA" onerror="this.style.display='none'">
                    </div>
                    <div class="app-title">CNGIRI</div>
                    <div class="app-subtitle">Comité National de Gestion Intégrée du Risque d'Inondation</div>
                    <p style="font-size: 10px; opacity: 0.4; margin-top: 8px;">DPGI — Maître d'ouvrage</p>
                </div>

                <div class="sidebar-menu">
                    <div class="sidebar-section-label">Suivi</div>
                    <a href="#/dashboard" class="menu-item" data-page="dashboard">
                        <span class="menu-item-icon">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
                        </span>
                        <span>Tableau de bord</span>
                    </a>
                    <a href="#/projects" class="menu-item" data-page="projects">
                        <span class="menu-item-icon">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>
                        </span>
                        <span>Projets</span>
                    </a>
                    <a href="#/my-measures" class="menu-item" data-page="my-measures">
                        <span class="menu-item-icon">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>
                        </span>
                        <span>Mes mesures</span>
                        <span id="nav-my-measures-badge" class="nav-badge" style="display:none;"></span>
                    </a>
                    <a href="#/observations" class="menu-item" data-page="observations">
                        <span class="menu-item-icon">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="15" y2="17"/></svg>
                        </span>
                        <span>Observations</span>
                        <span id="nav-observations-badge" class="nav-badge" style="display:none;"></span>
                    </a>
                    <a href="#/pv" class="menu-item" data-page="pv">
                        <span class="menu-item-icon">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 11H7v9a2 2 0 002 2h8a2 2 0 002-2v-9h-2"/><path d="M16 3h-8a2 2 0 00-2 2v2h12V5a2 2 0 00-2-2z"/><path d="M10 12h4M10 16h4"/></svg>
                        </span>
                        <span>PV de visite</span>
                        <span id="nav-pv-badge" class="nav-badge nav-badge-yellow" style="display:none;"></span>
                    </a>

                    ${isAdmin ? `
                    <div class="sidebar-section-label">Administration</div>
                    <a href="#/users" class="menu-item" data-page="users">
                        <span class="menu-item-icon">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4-4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>
                        </span>
                        <span>Utilisateurs</span>
                    </a>
                    <a href="#/admin" class="menu-item" data-page="admin">
                        <span class="menu-item-icon">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>
                        </span>
                        <span>Administration</span>
                    </a>
                    <a href="#/decoupage" class="menu-item" data-page="decoupage">
                        <span class="menu-item-icon">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
                        </span>
                        <span>Découpage</span>
                    </a>
                    <a href="#/project-structures" class="menu-item" data-page="project-structures">
                        <span class="menu-item-icon">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4-4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>
                        </span>
                        <span>Rattacher structure</span>
                    </a>
                    ` : ''}
                </div>

                <div class="sidebar-footer">
                    <button class="logout-btn" onclick="Navbar.logout()">
                        Déconnexion
                    </button>
                </div>
            </div>
        `;
    },

    renderTopBar(title = 'Dashboard') {
        const user = Auth.getUser();
        if (!user) return '';

        const roleLabels = {
            'admin': 'Administrateur',
            'utilisateur': 'Utilisateur',
            'directeur': 'Directeur',
            'superviseur': 'Superviseur',
            'commandement_territorial': 'Cmdt territorial',
            'lecteur': 'Lecteur',
            'auditeur': 'Auditeur'
        };

        const scopeTag = user.structure_code ? ` · ${user.structure_code}` : '';
        const readOnlyBadge = user.role === 'lecteur'
            ? `<span style="display:inline-flex;align-items:center;gap:4px;margin-left:10px;padding:3px 10px;background:#8896AB;color:white;border-radius:10px;font-size:11px;font-weight:700;letter-spacing:0.3px;">${Icon.render('eye', 12, 'white')}Lecture${scopeTag}</span>`
            : user.role === 'auditeur'
            ? `<span style="display:inline-flex;align-items:center;gap:4px;margin-left:10px;padding:3px 10px;background:#3794C4;color:white;border-radius:10px;font-size:11px;font-weight:700;letter-spacing:0.3px;">${Icon.render('search', 12, 'white')}Audit${scopeTag}</span>`
            : '';

        return `
            <div class="top-bar">
                <div style="display:flex;align-items:center;gap:14px;">
                    <button id="burger-toggle" onclick="Navbar.toggleSidebar()" aria-label="Menu"
                            style="display:none;background:none;border:none;padding:6px;cursor:pointer;color:#202B5D;">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                            <line x1="3" y1="6" x2="21" y2="6"/>
                            <line x1="3" y1="12" x2="21" y2="12"/>
                            <line x1="3" y1="18" x2="21" y2="18"/>
                        </svg>
                    </button>
                    <h1 style="margin:0;">${title}${readOnlyBadge}</h1>
                </div>
                <div style="display:flex;align-items:center;gap:16px;">
                    <button onclick="Navbar.toggleTheme()" title="Basculer thème clair / sombre"
                            id="theme-toggle-btn"
                            style="display:inline-flex;align-items:center;justify-content:center;padding:8px;background:var(--color-surface-muted);color:var(--color-text);border:1px solid var(--color-border);border-radius:8px;cursor:pointer;">
                        ${this.currentThemeIcon()}
                    </button>
                    <button onclick="Navbar.hardRefresh()" title="Vider le cache et recharger la page"
                            style="display:inline-flex;align-items:center;gap:6px;padding:8px 14px;background:var(--color-surface-muted);color:var(--color-text);border:1px solid var(--color-border);border-radius:8px;cursor:pointer;font-size:13px;font-weight:600;">
                        ${Icon.render('refresh', 14, 'currentColor')} Actualiser
                    </button>

                    <div style="position:relative;" id="notif-bell-wrap">
                        <button id="notif-bell-btn" onclick="Navbar.toggleNotifications(event)" aria-label="Notifications"
                                title="Notifications"
                                style="position:relative;display:inline-flex;align-items:center;justify-content:center;padding:8px;background:#f0f4f8;border:1px solid #dce3ed;border-radius:8px;cursor:pointer;">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>
                            <span id="notif-bell-badge" style="display:none;position:absolute;top:-3px;right:-3px;background:#c0392b;color:white;border-radius:10px;padding:1px 6px;font-size:10px;font-weight:700;min-width:18px;text-align:center;border:2px solid white;">0</span>
                        </button>
                        <div id="notif-dropdown" style="display:none;position:absolute;top:calc(100% + 8px);right:0;width:360px;max-height:500px;overflow:hidden;background:white;border:1px solid #dce3ed;border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,0.15);z-index:1000;">
                            <div style="padding:10px 14px;border-bottom:1px solid #eef;display:flex;justify-content:space-between;align-items:center;">
                                <strong style="color:#202B5D;font-size:13px;">Notifications</strong>
                                <button onclick="event.stopPropagation(); Navbar.markAllNotificationsRead();" style="background:none;border:none;color:#3794C4;font-size:11px;font-weight:600;cursor:pointer;">Tout marquer lu</button>
                            </div>
                            <div id="notif-list" style="max-height:420px;overflow-y:auto;">
                                <div style="padding:30px;text-align:center;color:#8896AB;font-size:12px;">Chargement...</div>
                            </div>
                        </div>
                    </div>
                    <div class="user-profile" id="user-profile-trigger" style="cursor:pointer;position:relative;" onclick="Navbar.toggleUserMenu(event)">
                        <div class="user-info">
                            <div class="user-name">${Auth.getFullName()}</div>
                            <div class="user-role">${roleLabels[user.role] || user.role}${user.structure_name ? ' - ' + user.structure_code : ''}</div>
                        </div>
                        <div class="user-avatar">${Auth.getInitials()}</div>
                        <div id="user-menu-dropdown" style="display:none;position:absolute;top:calc(100% + 8px);right:0;min-width:220px;background:white;border:1px solid #dce3ed;border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,0.12);z-index:1000;overflow:hidden;">
                            <button onclick="event.stopPropagation(); Navbar.openChangePasswordModal();"
                                    style="display:flex;align-items:center;gap:10px;width:100%;padding:12px 16px;border:none;background:transparent;cursor:pointer;text-align:left;font-size:13px;color:#202B5D;font-weight:600;"
                                    onmouseover="this.style.background='#f0f4f8'" onmouseout="this.style.background='transparent'">
                                ${Icon.render('key', 16, 'currentColor')} Changer le mot de passe
                            </button>
                            <button onclick="event.stopPropagation(); Navbar.logoutAllDevices();"
                                    style="display:flex;align-items:center;gap:10px;width:100%;padding:12px 16px;border:none;background:transparent;cursor:pointer;text-align:left;font-size:13px;color:#202B5D;font-weight:600;"
                                    onmouseover="this.style.background='#f0f4f8'" onmouseout="this.style.background='transparent'">
                                ${Icon.render('log-out', 16, 'currentColor')} Déconnecter mes autres appareils
                            </button>
                            <div style="height:1px;background:#eef;"></div>
                            <button onclick="event.stopPropagation(); Navbar.logout();"
                                    style="display:flex;align-items:center;gap:10px;width:100%;padding:12px 16px;border:none;background:transparent;cursor:pointer;text-align:left;font-size:13px;color:#c0392b;font-weight:600;"
                                    onmouseover="this.style.background='#fef2f2'" onmouseout="this.style.background='transparent'">
                                ${Icon.render('log-out', 16, 'currentColor')} Déconnexion
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    },

    /**
     * Thème clair / sombre : persisté dans localStorage.
     * On applique le thème à <html data-theme="dark|light"> pour que
     * les overrides CSS dans tokens.css prennent effet partout.
     */
    THEME_KEY: 'cngi_theme',

    currentTheme() {
        try { return localStorage.getItem(this.THEME_KEY) || 'light'; }
        catch { return 'light'; }
    },

    currentThemeIcon() {
        return this.currentTheme() === 'dark'
            ? Icon.render('sun', 16, 'currentColor')
            : Icon.render('moon', 16, 'currentColor');
    },

    applyTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        const btn = document.getElementById('theme-toggle-btn');
        if (btn) btn.innerHTML = this.currentThemeIcon();
    },

    toggleTheme() {
        const next = this.currentTheme() === 'dark' ? 'light' : 'dark';
        try { localStorage.setItem(this.THEME_KEY, next); } catch {}
        this.applyTheme(next);
    },

    toggleUserMenu(e) {
        e.stopPropagation();
        const dd = document.getElementById('user-menu-dropdown');
        if (!dd) return;
        const visible = dd.style.display === 'block';
        dd.style.display = visible ? 'none' : 'block';
        if (!visible) {
            // Fermer au clic ailleurs
            setTimeout(() => {
                const closeHandler = (ev) => {
                    if (!dd.contains(ev.target)) {
                        dd.style.display = 'none';
                        document.removeEventListener('click', closeHandler);
                    }
                };
                document.addEventListener('click', closeHandler);
            }, 0);
        }
    },

    openChangePasswordModal() {
        document.getElementById('user-menu-dropdown')?.style && (document.getElementById('user-menu-dropdown').style.display = 'none');
        if (typeof ChangePasswordModal !== 'undefined') {
            ChangePasswordModal.open();
        }
    },

    logoutAllDevices() {
        const dd = document.getElementById('user-menu-dropdown');
        if (dd) dd.style.display = 'none';
        Toast.confirm(
            'Déconnecter toutes vos autres sessions actives ? Cet appareil restera connecté.',
            async () => {
                try {
                    const res = await API.auth.logoutAllDevices();
                    if (res?.data?.token) Auth.setToken(res.data.token);
                    Toast.success('Vos autres sessions ont été déconnectées.');
                } catch (err) {
                    Toast.error('Erreur : ' + (err.message || 'échec'));
                }
            },
            { type: 'danger', confirmText: 'Déconnecter' }
        );
    },

    toggleSidebar() {
        const sb = document.querySelector('.sidebar');
        const backdrop = document.getElementById('sidebar-backdrop');
        if (!sb) return;
        const isOpen = sb.classList.toggle('sidebar-mobile-open');
        if (isOpen) {
            if (!backdrop) {
                const bd = document.createElement('div');
                bd.id = 'sidebar-backdrop';
                bd.onclick = () => Navbar.closeSidebar();
                document.body.appendChild(bd);
            }
        } else if (backdrop) {
            backdrop.remove();
        }
    },

    closeSidebar() {
        const sb = document.querySelector('.sidebar');
        if (sb) sb.classList.remove('sidebar-mobile-open');
        const backdrop = document.getElementById('sidebar-backdrop');
        if (backdrop) backdrop.remove();
    },

    async hardRefresh() {
        try {
            // Désinscrire le service worker PWA s'il existe
            if ('serviceWorker' in navigator) {
                const regs = await navigator.serviceWorker.getRegistrations();
                await Promise.all(regs.map(r => r.unregister()));
            }
            // Vider les caches du navigateur (Cache API)
            if ('caches' in window) {
                const keys = await caches.keys();
                await Promise.all(keys.map(k => caches.delete(k)));
            }
        } catch (e) { /* ignore */ }
        // Bust URL cache + force reload from server
        const url = new URL(window.location.href);
        url.searchParams.set('_t', Date.now());
        window.location.replace(url.toString());
    },

    updateActiveMenu() {
        const currentHash = window.location.hash;
        const menuItems = document.querySelectorAll('.menu-item');

        // Ferme la sidebar mobile dès qu'on navigue
        Navbar.closeSidebar();

        menuItems.forEach(item => {
            item.classList.remove('active');
            const page = item.getAttribute('data-page');
            if (currentHash.includes(page)) {
                item.classList.add('active');
            }
        });
    },

    logout() {
        Toast.confirm('Etes-vous sur de vouloir vous deconnecter ?', () => {
            Auth.logout();
            window.location.hash = '#/login';
        }, { type: 'info', confirmText: 'Deconnexion' });
    },

    async refreshObservationBadge() {
        const badge = document.getElementById('nav-observations-badge');
        if (!badge) return;
        try {
            const res = await API.observations.getUnreadCount();
            const n = res.count || 0;
            if (n > 0) {
                badge.textContent = n > 9 ? '9+' : String(n);
                badge.style.display = 'inline-flex';
            } else {
                badge.style.display = 'none';
            }
        } catch (e) { /* silencieux */ }
    },

    async refreshPvBadge() {
        const badge = document.getElementById('nav-pv-badge');
        if (!badge) return;
        try {
            const res = await API.pv.getUnreadCount();
            const n = res.count || 0;
            if (n > 0) {
                badge.textContent = n > 9 ? '9+' : String(n);
                badge.style.display = 'inline-flex';
            } else {
                badge.style.display = 'none';
            }
        } catch (e) { /* silencieux */ }
    },

    async toggleNotifications(e) {
        e.stopPropagation();
        const dd = document.getElementById('notif-dropdown');
        if (!dd) return;
        const visible = dd.style.display === 'block';
        dd.style.display = visible ? 'none' : 'block';
        if (!visible) {
            await this.loadNotifications();
            // Close on outside click
            setTimeout(() => {
                const closeHandler = (ev) => {
                    if (!dd.contains(ev.target) && !document.getElementById('notif-bell-btn')?.contains(ev.target)) {
                        dd.style.display = 'none';
                        document.removeEventListener('click', closeHandler);
                    }
                };
                document.addEventListener('click', closeHandler);
            }, 0);
        }
    },

    async loadNotifications() {
        const list = document.getElementById('notif-list');
        if (!list) return;
        try {
            const res = await API.notifications.list({ limit: 20 });
            const items = res.data || [];
            if (items.length === 0) {
                list.innerHTML = '<div style="padding:30px;text-align:center;color:#8896AB;font-size:12px;">Aucune notification</div>';
                return;
            }
            const esc = (t) => { const s = String(t||''); return s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); };
            const iconForType = (t) => ({
                measure_assigned:       '📋',
                measure_comment:        '💬',
                measure_status_changed: '🔄'
            }[t] || '🔔');
            // On utilise des data-attributes + un handler délégué plutôt que d'injecter
            // directement n.link_url dans un onclick inline (évite tout risque d'XSS
            // via une URL malformée, et protège contre les caractères non quotés).
            list.innerHTML = items.map(n => `
                <div class="notif-item" data-id="${n.id}" data-link="${esc(n.link_url || '')}"
                     style="padding:12px 14px;border-bottom:1px solid #f0f4f8;cursor:pointer;background:${n.is_read ? 'white' : '#f0f9ff'};transition:background 0.1s;"
                     onmouseover="this.style.background='#e8f4fc'" onmouseout="this.style.background='${n.is_read ? 'white' : '#f0f9ff'}'">
                    <div style="display:flex;gap:10px;align-items:flex-start;">
                        <div style="font-size:18px;flex-shrink:0;">${iconForType(n.type)}</div>
                        <div style="flex:1;min-width:0;">
                            <div style="font-weight:${n.is_read ? '500' : '700'};color:#202B5D;font-size:13px;margin-bottom:2px;line-height:1.3;">${esc(n.title)}</div>
                            ${n.body ? `<div style="color:#62718D;font-size:12px;margin-bottom:4px;line-height:1.4;">${esc(n.body)}</div>` : ''}
                            <div style="color:#8896AB;font-size:11px;">${new Date(n.created_at).toLocaleString('fr-FR')}</div>
                        </div>
                        ${!n.is_read ? '<div style="width:8px;height:8px;background:#3794C4;border-radius:50%;flex-shrink:0;margin-top:4px;"></div>' : ''}
                    </div>
                </div>
            `).join('');

            // Handler délégué unique — évite les onclick inline qui interpolent des données utilisateur.
            list.querySelectorAll('.notif-item').forEach(el => {
                el.addEventListener('click', () => {
                    const id = parseInt(el.dataset.id);
                    const link = el.dataset.link || '';
                    Navbar.openNotification(id, link);
                });
            });
        } catch (err) {
            list.innerHTML = `<div style="padding:20px;color:#c0392b;font-size:12px;">Erreur : ${err.message || ''}</div>`;
        }
    },

    async openNotification(id, linkUrl) {
        try { await API.notifications.markRead(id); } catch {}
        if (linkUrl) window.location.hash = linkUrl;
        // Le dropdown peut avoir été retiré du DOM entre-temps (navigation / render) :
        // on ferme avec un guard pour éviter "Cannot read properties of null".
        const dd = document.getElementById('notif-dropdown');
        if (dd) dd.style.display = 'none';
        this.refreshNotificationBell();
    },

    async markAllNotificationsRead() {
        try {
            await API.notifications.markAllRead();
            await this.loadNotifications();
            this.refreshNotificationBell();
        } catch (err) {
            Toast.error('Erreur : ' + (err.message || ''));
        }
    },

    async refreshNotificationBell() {
        const badge = document.getElementById('notif-bell-badge');
        if (!badge) return;
        try {
            const res = await API.notifications.unreadCount();
            const n = res.count || 0;
            if (n > 0) {
                badge.textContent = n > 99 ? '99+' : String(n);
                badge.style.display = 'inline-block';
            } else {
                badge.style.display = 'none';
            }
        } catch (e) { /* silencieux */ }
    },

    /**
     * Badge "mes mesures" : affiche le nombre de mesures en attente (non exécutées)
     * avec un accent rouge si certaines sont en retard.
     */
    async refreshMyMeasuresBadge() {
        const badge = document.getElementById('nav-my-measures-badge');
        if (!badge) return;
        try {
            const res = await API.measures.myStats();
            const { pending = 0, overdue = 0 } = res.data || {};
            if (pending > 0) {
                badge.textContent = pending > 99 ? '99+' : String(pending);
                badge.style.display = 'inline-flex';
                badge.classList.toggle('nav-badge-yellow', overdue === 0);
                badge.style.background = overdue > 0 ? '#c0392b' : '';
            } else {
                badge.style.display = 'none';
            }
        } catch (e) { /* silencieux */ }
    }
};

