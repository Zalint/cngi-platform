// Page Administration

const AdminPage = {
    data: {
        users: [],
        structures: [],
        configItems: [],
        apiKeys: [],
        sessions: null,
        announcements: []
    },
    sessionsRefreshTimer: null,

    async render() {
        if (!Auth.hasRole('admin')) {
            return `
                <div class="alert alert-error">Accès refusé. Cette page est réservée aux administrateurs.</div>
            `;
        }

        try {
            await this.loadData();

            return `
                ${Navbar.render()}
                <div class="main-content with-sidebar">
                    ${Navbar.renderTopBar('Administration')}
                    <div class="content-area">
                        ${this.renderTabs()}
                        <div id="admin-content">
                            ${this.renderUsers()}
                        </div>
                    </div>
                </div>
            `;
        } catch (error) {
            console.error('Error loading admin data:', error);
            return `<div class="alert alert-error">Erreur de chargement</div>`;
        }
    },

    async loadData() {
        const [users, structures, configItems] = await Promise.all([
            API.users.getAll(),
            API.structures.getAll(),
            API.config.getAll()
        ]);

        this.data.users = users.data;
        this.data.structures = structures.data;
        this.data.configItems = configItems.data || [];
    },

    renderTabs() {
        return `
            <div style="border-bottom: 2px solid #e0e0e0; margin-bottom: 30px;">
                <div style="display: flex; gap: 0; justify-content: space-between; align-items: center;">
                    <div style="display: flex; gap: 0;">
                        <button class="admin-tab active" data-tab="users" style="padding: 16px 24px; border: none; background: none; cursor: pointer; border-bottom: 3px solid #1e3c72; font-weight: 600; color: #1e3c72;">
                            Utilisateurs
                        </button>
                        <button class="admin-tab" data-tab="structures" style="padding: 16px 24px; border: none; background: none; cursor: pointer; border-bottom: 3px solid transparent; font-weight: 600; color: #666;">
                            Structures
                        </button>
                        <button class="admin-tab" data-tab="config" style="padding: 16px 24px; border: none; background: none; cursor: pointer; border-bottom: 3px solid transparent; font-weight: 600; color: #666;">
                            Configuration
                        </button>
                        <button class="admin-tab" data-tab="api-keys" style="padding: 16px 24px; border: none; background: none; cursor: pointer; border-bottom: 3px solid transparent; font-weight: 600; color: #666;">
                            Clés API
                        </button>
                        <button class="admin-tab" data-tab="sessions" style="padding: 16px 24px; border: none; background: none; cursor: pointer; border-bottom: 3px solid transparent; font-weight: 600; color: #666;">
                            Sessions actives
                        </button>
                        <button class="admin-tab" data-tab="announcements" style="padding: 16px 24px; border: none; background: none; cursor: pointer; border-bottom: 3px solid transparent; font-weight: 600; color: #666;">
                            Annonces
                        </button>
                        <button class="admin-tab" data-tab="trash" style="display:inline-flex;align-items:center;gap:6px;padding: 16px 24px; border: none; background: none; cursor: pointer; border-bottom: 3px solid transparent; font-weight: 600; color: #666;">
                            ${Icon.render('trash', 15, 'currentColor')} Corbeille
                        </button>
                        <button class="admin-tab" data-tab="docs" style="display:inline-flex;align-items:center;gap:6px;padding: 16px 24px; border: none; background: none; cursor: pointer; border-bottom: 3px solid transparent; font-weight: 600; color: #666;">
                            ${Icon.render('clipboard-list', 15, 'currentColor')} Documentation
                        </button>
                    </div>
                    <div style="display: none;">
                        <!-- Boutons seed/reset masqués -->
                    </div>
                </div>
            </div>
        `;
    },

    renderUsers() {
        const rows = this.data.users.map(user => `
            <tr>
                <td><strong>${user.username}</strong></td>
                <td>${user.email || 'N/A'}</td>
                <td>${user.first_name || ''} ${user.last_name || ''}</td>
                <td><span class="status-badge status-${user.role}">${this.getRoleLabel(user.role)}</span></td>
                <td>${user.structure_code || 'N/A'}</td>
                <td>${user.is_active ? '✅ Actif' : '❌ Inactif'}</td>
                <td>
                    <div style="display: flex; gap: 8px;">
                        <button class="btn-icon" onclick="AdminPage.editUser(${user.id})" title="Modifier">${Icon.render('pencil', 16, 'currentColor')}</button>
                        <button class="btn-icon" onclick="AdminPage.deleteUser(${user.id})" title="Supprimer">${Icon.render('trash', 16, 'var(--color-danger)')}</button>
                    </div>
                </td>
            </tr>
        `).join('');

        return `
            <div class="card">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;">
                    <h2>Gestion des utilisateurs</h2>
                    <button class="btn btn-primary" onclick="AdminPage.createUser()">
                        ${Icon.render('plus', 14, 'white')} Nouvel utilisateur
                    </button>
                </div>
                <div class="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>Username</th>
                                <th>Email</th>
                                <th>Nom complet</th>
                                <th>Rôle</th>
                                <th>Structure</th>
                                <th>Statut</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${rows}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    },

    renderStructures() {
        const rows = this.data.structures.map(structure => `
            <tr>
                <td><strong>${structure.code}</strong></td>
                <td>${structure.name}</td>
                <td>${structure.description || 'N/A'}</td>
                <td>${structure.users_count || 0}</td>
                <td>${structure.projects_count || 0}</td>
                <td>
                    <div style="display: flex; gap: 8px;">
                        <button class="btn-icon" onclick="AdminPage.editStructure(${structure.id})" title="Modifier">${Icon.render('pencil', 16, 'currentColor')}</button>
                        <button class="btn-icon" onclick="AdminPage.deleteStructure(${structure.id})" title="Supprimer">${Icon.render('trash', 16, 'var(--color-danger)')}</button>
                    </div>
                </td>
            </tr>
        `).join('');

        return `
            <div class="card">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;">
                    <h2>Gestion des structures</h2>
                    <button class="btn btn-primary" onclick="AdminPage.createStructure()">
                        ${Icon.render('plus', 14, 'white')} Nouvelle structure
                    </button>
                </div>
                <div class="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>Code</th>
                                <th>Nom</th>
                                <th>Description</th>
                                <th>Utilisateurs</th>
                                <th>Projets</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${rows}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    },

    async loadTrash() {
        try {
            const res = await API.projects.listDeleted();
            this.data.deletedProjects = res.data || [];
        } catch (e) { this.data.deletedProjects = []; }
    },

    async loadAnnouncements() {
        try {
            const res = await API.announcements.getAll();
            this.data.announcements = res.data || [];
        } catch (err) {
            console.error('loadAnnouncements', err);
            this.data.announcements = [];
        }
    },

    isAnnouncementActive(a) {
        const now = Date.now();
        const startsOk = !a.starts_at || new Date(a.starts_at).getTime() <= now;
        const notExpired = !a.expires_at || new Date(a.expires_at).getTime() > now;
        return startsOk && notExpired;
    },

    renderAnnouncements() {
        const items = this.data.announcements || [];
        const esc = (t) => String(t || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
        const levelLabel = { info: 'Info', warning: 'Avertissement', critical: 'Critique' };
        const levelColor = { info: '#3b82f6', warning: '#f59e0b', critical: '#dc2626' };

        const rows = items.map(a => {
            const active = this.isAnnouncementActive(a);
            const expiresLabel = a.expires_at
                ? new Date(a.expires_at).toLocaleString('fr-FR', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' })
                : 'Indéfinie';
            return `
                <tr>
                    <td style="padding:10px 12px;">
                        <span style="display:inline-block;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:600;background:${levelColor[a.level]}22;color:${levelColor[a.level]};">${levelLabel[a.level] || a.level}</span>
                    </td>
                    <td style="padding:10px 12px;">${esc(a.message)}</td>
                    <td style="padding:10px 12px;color:#62718D;font-size:12px;">${expiresLabel}</td>
                    <td style="padding:10px 12px;">
                        ${active
                            ? '<span style="color:#16a34a;font-weight:600;font-size:12px;">● Active</span>'
                            : '<span style="color:#94a3b8;font-size:12px;">Expirée</span>'}
                    </td>
                    <td style="padding:10px 12px;color:#62718D;font-size:12px;">${esc(a.author || '—')}</td>
                    <td style="padding:10px 12px;text-align:right;">
                        ${active ? `<button class="btn btn-secondary" style="font-size:11px;padding:4px 10px;margin-right:4px;" onclick="AdminPage.revokeAnnouncement(${a.id})">Révoquer</button>` : ''}
                        <button class="btn-icon" onclick="AdminPage.deleteAnnouncement(${a.id})" title="Supprimer définitivement">${Icon.render('trash', 14, 'var(--color-danger)')}</button>
                    </td>
                </tr>
            `;
        }).join('');

        return `
            <div>
                <div class="card" style="padding:16px;margin-bottom:20px;">
                    <h3 style="margin:0 0 12px;font-size:15px;">Nouvelle annonce</h3>
                    <div style="display:grid;grid-template-columns:1fr;gap:10px;">
                        <textarea id="ann-message" class="form-control" rows="2" maxlength="1000" placeholder="Ex : L'application sera indisponible 5 minutes à 14h00 pour maintenance."></textarea>
                        <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:end;">
                            <div style="flex:0 0 auto;">
                                <label style="display:block;font-size:11px;color:#62718D;margin-bottom:4px;">Niveau</label>
                                <select id="ann-level" class="form-control" style="min-width:140px;">
                                    <option value="info">Info</option>
                                    <option value="warning" selected>Avertissement</option>
                                    <option value="critical">Critique</option>
                                </select>
                            </div>
                            <div style="flex:0 0 auto;">
                                <label style="display:block;font-size:11px;color:#62718D;margin-bottom:4px;">Disparaît dans</label>
                                <select id="ann-duration" class="form-control" style="min-width:160px;">
                                    <option value="15">15 minutes</option>
                                    <option value="30">30 minutes</option>
                                    <option value="60" selected>1 heure</option>
                                    <option value="240">4 heures</option>
                                    <option value="1440">1 jour</option>
                                    <option value="">Indéfinie (à révoquer manuellement)</option>
                                </select>
                            </div>
                            <div style="flex:0 0 auto;display:flex;align-items:center;gap:6px;padding-bottom:8px;">
                                <input type="checkbox" id="ann-dismissable" checked>
                                <label for="ann-dismissable" style="font-size:12px;cursor:pointer;">Masquable par les users</label>
                            </div>
                            <button class="btn btn-primary" style="margin-left:auto;" onclick="AdminPage.createAnnouncement()">
                                Publier
                            </button>
                        </div>
                    </div>
                </div>

                <div class="card" style="padding:0;overflow:hidden;">
                    <div style="padding:14px 16px;border-bottom:1px solid var(--color-border);">
                        <h3 style="margin:0;font-size:15px;">Historique (${items.length})</h3>
                    </div>
                    <table style="width:100%;border-collapse:collapse;font-size:13px;">
                        <thead>
                            <tr style="background:#f8fafc;text-align:left;color:#475569;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;">
                                <th style="padding:10px 12px;">Niveau</th>
                                <th style="padding:10px 12px;">Message</th>
                                <th style="padding:10px 12px;">Expire</th>
                                <th style="padding:10px 12px;">État</th>
                                <th style="padding:10px 12px;">Auteur</th>
                                <th style="padding:10px 12px;text-align:right;">Actions</th>
                            </tr>
                        </thead>
                        <tbody>${rows || '<tr><td colspan="6" style="padding:30px;text-align:center;color:#8896AB;">Aucune annonce</td></tr>'}</tbody>
                    </table>
                </div>
                <p style="margin-top:12px;font-size:11px;color:#94a3b8;">
                    Les utilisateurs voient le bandeau dans la minute qui suit la publication ou la révocation (polling 60s).
                </p>
            </div>
        `;
    },

    async createAnnouncement() {
        const message = document.getElementById('ann-message')?.value.trim();
        const level = document.getElementById('ann-level')?.value || 'info';
        const durationStr = document.getElementById('ann-duration')?.value;
        const dismissable = document.getElementById('ann-dismissable')?.checked !== false;

        if (!message) {
            Toast.error('Le message ne peut pas être vide');
            return;
        }

        // On envoie la DURÉE en minutes, pas une date. Le serveur fait
        // expires_at = NOW() + INTERVAL → pas de problème de fuseau horaire.
        const expires_in_minutes = durationStr ? parseInt(durationStr, 10) : null;

        // Capture l'onglet actif AVANT l'await — si l'utilisateur change d'onglet
        // pendant la requête, on ne doit pas écraser le contenu du nouvel onglet.
        const initialTab = this.currentTab;
        try {
            await API.announcements.create({ message, level, dismissable, expires_in_minutes });
            Toast.success('Annonce publiée');
            await this.loadAnnouncements();
            if (this.currentTab === initialTab) {
                const content = document.getElementById('admin-content');
                if (content) content.innerHTML = this.renderAnnouncements();
            }
            // Le bandeau lui-même est indépendant de l'onglet actif → toujours refresh.
            if (typeof AnnouncementBanner !== 'undefined') AnnouncementBanner.refresh();
        } catch (err) {
            Toast.error('Erreur : ' + (err.message || 'échec'));
        }
    },

    revokeAnnouncement(id) {
        const initialTab = this.currentTab;
        Toast.confirm('Révoquer immédiatement cette annonce ?', async () => {
            try {
                await API.announcements.revoke(id);
                Toast.success('Annonce révoquée');
                await this.loadAnnouncements();
                if (this.currentTab === initialTab) {
                    const content = document.getElementById('admin-content');
                    if (content) content.innerHTML = this.renderAnnouncements();
                }
                if (typeof AnnouncementBanner !== 'undefined') AnnouncementBanner.refresh();
            } catch (err) {
                Toast.error('Erreur : ' + (err.message || 'échec'));
            }
        }, { type: 'danger', confirmText: 'Révoquer' });
    },

    deleteAnnouncement(id) {
        const initialTab = this.currentTab;
        Toast.confirm('Supprimer définitivement cette annonce de l\'historique ?', async () => {
            try {
                await API.announcements.delete(id);
                Toast.success('Annonce supprimée');
                await this.loadAnnouncements();
                if (this.currentTab === initialTab) {
                    const content = document.getElementById('admin-content');
                    if (content) content.innerHTML = this.renderAnnouncements();
                }
                // Le bandeau peut être encore affiché si l'annonce était active : refresh.
                if (typeof AnnouncementBanner !== 'undefined') AnnouncementBanner.refresh();
            } catch (err) {
                Toast.error('Erreur : ' + (err.message || 'échec'));
            }
        }, { type: 'danger', confirmText: 'Supprimer' });
    },

    async loadSessions() {
        try {
            const res = await API.users.getActiveSessions(5);
            this.data.sessions = res;
        } catch (err) {
            console.error('loadSessions error', err);
            this.data.sessions = { stats: {}, data: [], error: err.message };
        }
    },

    formatRelative(isoDate) {
        if (!isoDate) return 'jamais';
        const diff = Date.now() - new Date(isoDate).getTime();
        const sec = Math.round(diff / 1000);
        if (sec < 0) return 'maintenant';
        if (sec < 60) return `il y a ${sec}s`;
        const min = Math.round(sec / 60);
        if (min < 60) return `il y a ${min} min`;
        const h = Math.round(min / 60);
        if (h < 24) return `il y a ${h} h`;
        const d = Math.round(h / 24);
        if (d < 30) return `il y a ${d} j`;
        return new Date(isoDate).toLocaleDateString('fr-FR');
    },

    formatDate(isoDate) {
        if (!isoDate) return '—';
        const dt = new Date(isoDate);
        return dt.toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    },

    renderSessions() {
        const s = this.data.sessions;
        if (!s) {
            return `<div class="card" style="padding:40px;text-align:center;color:#8896AB;">Chargement...</div>`;
        }
        if (s.error) {
            return `<div class="alert alert-error">Erreur : ${s.error}</div>`;
        }
        const stats = s.stats || {};
        const users = s.data || [];

        const statCard = (label, value, color) => `
            <div style="flex:1;background:white;border:1px solid var(--color-border);border-radius:8px;padding:16px;text-align:center;">
                <div style="font-size:28px;font-weight:700;color:${color};">${value}</div>
                <div style="font-size:11px;color:#62718D;text-transform:uppercase;letter-spacing:0.5px;margin-top:4px;">${label}</div>
            </div>
        `;

        const esc = (t) => { const v = String(t||''); return v.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); };

        const currentUserId = (Auth.getUser() || {}).id;
        const rows = users.map(u => {
            const dot = u.is_online
                ? '<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#22c55e;box-shadow:0 0 0 3px rgba(34,197,94,0.2);"></span>'
                : '<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#cbd5e0;"></span>';
            const statusLabel = u.is_online ? 'En ligne' : (u.last_activity_at ? this.formatRelative(u.last_activity_at) : 'Jamais actif');
            const isSelf = u.id === currentUserId;
            const action = isSelf
                ? '<span style="font-size:11px;color:#94a3b8;">vous</span>'
                : `<button class="btn btn-secondary" style="font-size:11px;padding:4px 10px;" onclick="AdminPage.forceLogout(${u.id}, ${JSON.stringify(u.nom_complet).replace(/"/g, '&quot;')})">Forcer la déconnexion</button>`;
            return `
                <tr>
                    <td style="padding:10px 12px;">${dot} ${esc(u.nom_complet)}</td>
                    <td style="padding:10px 12px;color:#62718D;font-size:13px;">${esc(u.username)}</td>
                    <td style="padding:10px 12px;">${esc(u.role)}</td>
                    <td style="padding:10px 12px;">${esc(u.structure_code || '—')}</td>
                    <td style="padding:10px 12px;color:#62718D;">${this.formatDate(u.last_login)}</td>
                    <td style="padding:10px 12px;color:${u.is_online ? '#16a34a' : '#62718D'};font-weight:${u.is_online ? '600' : 'normal'};">${statusLabel}</td>
                    <td style="padding:10px 12px;text-align:right;">${action}</td>
                </tr>
            `;
        }).join('');

        return `
            <div>
                <div style="display:flex;gap:12px;margin-bottom:20px;">
                    ${statCard('En ligne', stats.online || 0, '#16a34a')}
                    ${statCard('Actifs 24h', stats.active_24h || 0, '#0ea5e9')}
                    ${statCard('Actifs 7j', stats.active_7d || 0, '#6366f1')}
                    ${statCard('Total actifs', stats.total || 0, '#1e3c72')}
                    ${statCard('Jamais connectés', stats.never_logged || 0, '#94a3b8')}
                </div>
                <div class="card" style="padding:0;overflow:hidden;">
                    <div style="padding:14px 16px;border-bottom:1px solid var(--color-border);display:flex;justify-content:space-between;align-items:center;">
                        <h3 style="margin:0;font-size:15px;">Utilisateurs (seuil "en ligne" = ${s.online_threshold_minutes || 5} min)</h3>
                        <button class="btn btn-secondary" style="font-size:12px;padding:6px 12px;" onclick="AdminPage.refreshSessions()">Rafraîchir</button>
                    </div>
                    <table style="width:100%;border-collapse:collapse;font-size:13px;">
                        <thead>
                            <tr style="background:#f8fafc;text-align:left;color:#475569;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;">
                                <th style="padding:10px 12px;">Utilisateur</th>
                                <th style="padding:10px 12px;">Username</th>
                                <th style="padding:10px 12px;">Rôle</th>
                                <th style="padding:10px 12px;">Structure</th>
                                <th style="padding:10px 12px;">Dernière connexion</th>
                                <th style="padding:10px 12px;">Activité</th>
                                <th style="padding:10px 12px;text-align:right;">Action</th>
                            </tr>
                        </thead>
                        <tbody>${rows || '<tr><td colspan="7" style="padding:30px;text-align:center;color:#8896AB;">Aucun utilisateur</td></tr>'}</tbody>
                    </table>
                </div>
                <p style="margin-top:12px;font-size:11px;color:#94a3b8;">Auto-rafraîchi toutes les 30 secondes.</p>
            </div>
        `;
    },

    forceLogout(userId, userName) {
        Toast.confirm(
            `Forcer la déconnexion de ${userName} ? Toutes ses sessions actives seront révoquées immédiatement.`,
            async () => {
                try {
                    await API.users.forceLogout(userId);
                    Toast.success('Sessions révoquées');
                    await this.refreshSessions();
                } catch (err) {
                    Toast.error('Erreur : ' + (err.message || 'échec'));
                }
            },
            { type: 'danger', confirmText: 'Forcer la déconnexion' }
        );
    },

    async refreshSessions() {
        await this.loadSessions();
        const content = document.getElementById('admin-content');
        if (content && document.querySelector('.admin-tab.active')?.getAttribute('data-tab') === 'sessions') {
            content.innerHTML = this.renderSessions();
        }
    },

    startSessionsAutoRefresh() {
        this.stopSessionsAutoRefresh();
        this.sessionsRefreshTimer = setInterval(() => {
            if (document.querySelector('.admin-tab.active')?.getAttribute('data-tab') === 'sessions') {
                this.refreshSessions();
            } else {
                this.stopSessionsAutoRefresh();
            }
        }, 30000);
    },

    stopSessionsAutoRefresh() {
        if (this.sessionsRefreshTimer) {
            clearInterval(this.sessionsRefreshTimer);
            this.sessionsRefreshTimer = null;
        }
    },

    renderTrash() {
        const items = this.data.deletedProjects || [];
        const esc = (t) => { const s = String(t||''); return s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); };

        if (items.length === 0) {
            return `
                <div class="card" style="padding:60px 20px;text-align:center;">
                    <div style="margin-bottom:12px;opacity:0.4;display:flex;justify-content:center;color:var(--color-text-disabled);">${Icon.render('trash', 48, 'currentColor')}</div>
                    <h3 style="margin:0 0 8px;">Corbeille vide</h3>
                    <p style="color:#62718D;font-size:13px;margin:0;">Aucun projet supprimé à restaurer.</p>
                </div>
            `;
        }

        const rows = items.map(p => `
            <tr>
                <td><strong>${esc(p.title)}</strong></td>
                <td>${esc(p.structure_code || '—')}</td>
                <td>${p.deleted_at ? new Date(p.deleted_at).toLocaleString('fr-FR') : ''}</td>
                <td>
                    <div style="display:flex;gap:8px;">
                        <button class="btn btn-primary" style="display:inline-flex;align-items:center;gap:4px;font-size:12px;padding:6px 12px;" onclick="AdminPage.restoreProject(${p.id})">${Icon.render('restore', 12, 'white')} Restaurer</button>
                        <button class="btn btn-danger" style="display:inline-flex;align-items:center;gap:4px;font-size:12px;padding:6px 12px;" onclick="AdminPage.hardDeleteProject(${p.id}, ${JSON.stringify(p.title).replace(/"/g, '&quot;')})">${Icon.render('trash', 12, 'white')} Purger</button>
                    </div>
                </td>
            </tr>
        `).join('');

        return `
            <div class="card">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:18px;">
                    <h2 style="margin:0;display:inline-flex;align-items:center;gap:8px;">${Icon.render('trash', 20, 'currentColor')} Corbeille des projets</h2>
                    <div style="color:#62718D;font-size:12px;">${items.length} projet(s) supprimé(s)</div>
                </div>
                <p style="color:#62718D;font-size:13px;margin-bottom:16px;">
                    Les projets supprimés sont conservés ici. Tu peux les <strong>restaurer</strong> à tout moment
                    (ils réapparaîtront dans la liste des projets avec toutes leurs données) ou les <strong>purger</strong>
                    définitivement.
                </p>
                <div class="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>Projet</th>
                                <th>Structure</th>
                                <th>Supprimé le</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>${rows}</tbody>
                    </table>
                </div>
            </div>
        `;
    },

    async restoreProject(id) {
        try {
            await API.projects.restore(id);
            Toast.success('Projet restauré');
            await this.loadTrash();
            const content = document.getElementById('admin-content');
            if (content) content.innerHTML = this.renderTrash();
        } catch (err) {
            Toast.error('Erreur : ' + (err.message || ''));
        }
    },

    async hardDeleteProject(id, title) {
        Toast.confirm(
            `⚠ Supprimer DÉFINITIVEMENT le projet "${title}" ?\n\nCette action est irréversible.`,
            async () => {
                try {
                    await API.projects.hardDelete(id);
                    Toast.success('Projet purgé définitivement');
                    await this.loadTrash();
                    const content = document.getElementById('admin-content');
                    if (content) content.innerHTML = this.renderTrash();
                } catch (err) {
                    Toast.error('Erreur : ' + (err.message || ''));
                }
            },
            { type: 'danger', confirmText: 'Purger définitivement' }
        );
    },

    renderDocumentation() {
        // Helpers de mise en forme
        const section = (id, title, body) => `
            <div id="doc-${id}" style="margin-bottom:32px;scroll-margin-top:80px;">
                <h2 style="color:#202B5D;border-bottom:2px solid #3794C4;padding-bottom:6px;margin-bottom:16px;">${title}</h2>
                ${body}
            </div>`;

        const table = (headers, rows) => `
            <div class="table-container" style="margin-bottom:12px;">
                <table style="width:100%;font-size:13px;">
                    <thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead>
                    <tbody>${rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody>
                </table>
            </div>`;

        const note = (color, body) => `
            <p style="background:${color}22;border-left:3px solid ${color};padding:10px 12px;font-size:12px;border-radius:0 6px 6px 0;margin:8px 0;">${body}</p>`;

        const step = (n, title, body) => `
            <div style="display:flex;gap:12px;margin-bottom:12px;">
                <div style="flex-shrink:0;width:28px;height:28px;border-radius:50%;background:#3794C4;color:white;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:13px;">${n}</div>
                <div style="flex:1;"><strong style="color:#202B5D;">${title}</strong><div style="font-size:13px;color:#475569;">${body}</div></div>
            </div>`;

        // Échappement HTML — appliqué à toute valeur venant de la DB (structures,
        // configItems) avant interpolation, pour neutraliser un éventuel injection
        // d'un admin malveillant ou d'un compte compromis.
        const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({
            '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
        }[c]));

        // Données dynamiques
        const structures = (this.data.structures || []).slice().sort((a, b) => (a.code || '').localeCompare(b.code || ''));
        const cfg = this.data.configItems || [];
        const findCfg = (cat, val) => cfg.find(c => c.category === cat && c.value === val);
        const maxFileSizeMb = parseInt(findCfg('upload_limits', 'max_file_size_mb')?.label || '5', 10);
        const geometryMax = parseInt(findCfg('import_limits', 'geometry_max_features')?.label || '2000', 10);
        const mapLayers = cfg.filter(c => c.category === 'map_layers' && c.is_active)
                              .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));

        // Sommaire (table des matières cliquable)
        const TOC = [
            ['mission',     '🎯 Mission'],
            ['roles',       '👥 Rôles : qui peut faire quoi'],
            ['structures',  '🏢 Structures'],
            ['workflow',    '🔄 Cycle de vie d\'un projet'],
            ['create-proj', '📦 Créer un projet (pas-à-pas)'],
            ['measures',    '🔧 Mesures : créer, assigner, suivre'],
            ['cartography', '🗺️ Sites, localités, géométries'],
            ['geojson',     '📥 Import GeoJSON / KML / Shapefile'],
            ['map-layers',  '🌍 Fonds de carte'],
            ['sovereignty', '🏛️ Souveraineté & roadmap cartographie'],
            ['observations','🗣️ Directives du Ministre'],
            ['pv',          '📋 PV du Commandement Territorial'],
            ['forms',       '📝 Formulaires dynamiques'],
            ['notifs',      '🔔 Notifications et emails'],
            ['sessions',    '🔐 Sessions, mot de passe, sécurité'],
            ['announce',    '📣 Annonces broadcast'],
            ['api-keys',    '🔑 Clés API'],
            ['limits',      '📏 Limites techniques'],
            ['glossary',    '📖 Glossaire']
        ];
        const tocHtml = `
            <div style="background:#f0f4f8;padding:14px 18px;border-radius:8px;margin-bottom:24px;border-left:3px solid #3794C4;">
                <div style="font-weight:700;color:#202B5D;font-size:13px;margin-bottom:8px;">Sommaire</div>
                <div style="display:flex;flex-wrap:wrap;gap:6px 18px;font-size:13px;">
                    ${TOC.map(([id, label]) => `<a href="#doc-${id}" style="color:#3794C4;text-decoration:none;">${label}</a>`).join('')}
                </div>
            </div>`;

        return `
            <div class="card" style="padding:30px;line-height:1.6;">
                <div style="background:linear-gradient(135deg,#202B5D 0%,#3794C4 100%);color:white;padding:24px;border-radius:10px;margin-bottom:32px;">
                    <h1 style="margin:0 0 8px 0;color:white;">📖 Documentation CNGIRI</h1>
                    <p style="margin:0;opacity:0.9;">Guide de référence des rôles, entités et concepts de la plateforme.</p>
                </div>

                ${tocHtml}

                ${section('mission', '🎯 Mission de la plateforme', `
                    <p><strong>CNGIRI</strong> (Comité National de Gestion Intégrée du Risque d'Inondation) centralise le suivi opérationnel de la lutte contre les inondations au Sénégal. La plateforme fait collaborer trois cercles d'acteurs :</p>
                    <ul>
                        <li><strong>Les structures techniques</strong> qui exécutent (DPGI, ONAS, BNSP, CETUD, AGEROUTE, DPC…).</li>
                        <li><strong>Le commandement territorial</strong> qui supervise sur le terrain (Gouverneurs, Préfets, Sous-préfets).</li>
                        <li><strong>La tutelle ministérielle</strong> qui pilote stratégiquement et émet des directives.</li>
                    </ul>
                    <p>Chaque acteur voit et fait ce qui correspond à son périmètre. La plateforme produit un état d'avancement consolidé en temps réel : projets, mesures, sites, géométries, retards, échéances, financements.</p>
                `)}

                ${section('roles', '👥 Rôles : qui peut faire quoi', `
                    <p>Chaque utilisateur a <strong>un seul rôle</strong>. Le rôle détermine ce qu'il voit et ce qu'il peut faire. Au-delà du rôle, deux désignations changent les permissions sur un projet précis : <em>Chef de projet</em> et <em>Directeur d'une structure rattachée</em>.</p>

                    <h3 style="color:#202B5D;font-size:15px;margin-top:20px;">Les 7 rôles</h3>
                    ${table(
                        ['Rôle', 'Qui (persona)', 'Périmètre de visibilité', 'Peut écrire'],
                        [
                            ['<strong>Admin</strong>', 'Administrateur système / DSI', 'Tout', 'Tout : utilisateurs, structures, configuration, clés API, tous projets, annonces, sessions'],
                            ['<strong>Superviseur</strong>', 'Ministre, cabinet', 'Tous les projets', 'Observations (directives au format texte adressées aux structures, avec échéance optionnelle)'],
                            ['<strong>Commandement Territorial</strong>', 'Gouverneur (région), Préfet (département), Sous-préfet (arrondissement)', 'Projets/sites/mesures de son territoire', 'PV de visite (compte-rendu structuré du terrain)'],
                            ['<strong>Directeur</strong>', 'Directeur de structure (ex. DG ONAS)', '<strong>Tous</strong> les projets (lecture globale, comme admin)', 'Création / modification des projets de sa structure. Sur les projets dont sa structure est <em>pilote</em>, droits étendus type chef de projet : assigner / réassigner les mesures, changer leur statut.'],
                            ['<strong>Utilisateur</strong>', 'Agent opérationnel d\'une structure', 'Projets de sa structure', 'Crée des projets pour sa structure ; met à jour le statut des mesures qui lui sont assignées'],
                            ['<strong>Auditeur</strong> 🔍', 'Cour des Comptes, IGE, bailleur (BM, BAD, AFD), conseiller', 'Tout, <em>budgets compris</em>. Optionnellement scopé sur une structure.', '<em>Rien</em>. Lecture seule. Peut exporter Excel et générer un rapport IA.'],
                            ['<strong>Lecteur</strong> 👁', 'Communicant, journaliste, personnel interne, visiteur', 'Tout <em>sauf les montants financiers</em>. Optionnellement scopé sur une structure.', '<em>Rien</em>. Lecture seule, pas d\'export, pas de rapport IA.']
                        ]
                    )}
                    ${note('#f59e0b', '<strong>À retenir :</strong> Superviseur et Commandement Territorial n\'appartiennent à <em>aucune</em> structure technique — ce sont des rôles de pilotage et de supervision. Auditeur et Lecteur sont strictement en lecture seule.')}
                    ${note('#3794C4', '<strong>Scope global vs scope structure</strong> (pour Auditeur / Lecteur) :<br>• <em>Sans structure</em> → vue globale, tous projets / toutes structures.<br>• <em>Avec une structure</em> → vue limitée à cette structure (utile pour un bailleur AFD scopé sur les projets ONAS).')}

                    <h3 style="color:#202B5D;font-size:15px;margin-top:20px;">Le « Chef de projet » : une désignation, pas un rôle</h3>
                    <p>Au moment de créer un projet, on désigne un <strong>chef de projet</strong> parmi les utilisateurs ou directeurs. Cette désignation lui donne des permissions supplémentaires <em>uniquement sur ce projet</em>.</p>
                    ${table(
                        ['Action sur le projet', 'Chef de projet', 'Utilisateur de la structure', 'Directeur de la structure', 'Admin'],
                        [
                            ['Modifier le projet (titre, dates, budget…)', '✅', '✅', '✅', '✅'],
                            ['Ajouter / supprimer des mesures', '✅', '✅', '✅', '✅'],
                            ['Assigner une mesure à un utilisateur', '✅', '❌', '✅', '✅'],
                            ['Réassigner une mesure (structure + user)', '✅', '❌', '✅', '✅'],
                            ['Changer le statut d\'une mesure', '✅ (toutes les mesures du projet)', '✅ (uniquement celles qui lui sont assignées)', '✅', '✅'],
                            ['Supprimer le projet (soft delete)', '❌', '❌', '✅', '✅']
                        ]
                    )}

                    <h3 style="color:#202B5D;font-size:15px;margin-top:20px;">Synthèse : qui voit quoi</h3>
                    ${table(
                        ['Donnée', 'Admin · Superviseur', 'Directeur', 'Auditeur', 'Lecteur', 'Commandement', 'Utilisateur'],
                        [
                            ['Projets', 'Tous', 'Tous (lecture globale)', 'Tous (ou scope structure)', 'Tous (ou scope structure)', 'Son territoire', 'Sa structure'],
                            ['Budgets / financements', '✅', '✅', '✅', '🔒 masqué', '✅', '✅'],
                            ['Mesures', 'Toutes', 'Toutes', 'Toutes', 'Toutes', 'Via ses projets', 'Via ses projets'],
                            ['Sites & géométries', 'Tous', 'Tous', 'Tous', 'Tous', 'Son territoire', 'Sa structure'],
                            ['Directives ministère', 'Toutes', 'Toutes', 'Toutes', 'Toutes', 'Globales ou ses projets', 'Globales ou ses projets'],
                            ['PV du Commandement', 'Tous', 'Tous', 'Tous', 'Tous', 'Les siens + son niveau', 'Liés à ses projets'],
                            ['Export Excel & rapport IA', '✅', '✅', '✅', '❌', '✅', '✅'],
                            ['Créer / modifier projet', '✅', '✅ (sa structure)', '❌', '❌', '❌', '✅ (sa structure)'],
                            ['Assigner / changer statut mesure', '✅', '✅ (sa structure pilote)', '❌', '❌', '❌', '⚠ uniquement les siennes'],
                            ['Publier PV de visite', '❌', '❌', '❌', '❌', '✅ (son territoire)', '❌'],
                            ['Onglet Administration', '✅ Admin uniquement', '❌', '❌', '❌', '❌', '❌']
                        ]
                    )}
                `)}

                ${section('structures', '🏢 Structures', `
                    <p>Les <strong>structures</strong> sont les organismes publics qui portent les projets CNGIRI. Chaque utilisateur (sauf Admin, Superviseur et Commandement) appartient à <em>une seule</em> structure et ne voit que les projets qui lui sont rattachés.</p>
                    <p>Un projet a une <strong>structure pilote</strong> (responsable principal) plus, optionnellement, des <strong>structures rattachées</strong> qui contribuent. Une mesure peut être assignée à n\'importe laquelle de ces structures.</p>
                    <p><strong>Structures actuellement déclarées dans la plateforme :</strong></p>
                    ${structures.length > 0 ? table(
                        ['Code', 'Nom complet', 'Description'],
                        structures.map(s => [
                            `<strong>${esc(s.code) || '—'}</strong>`,
                            esc(s.name) || '—',
                            esc(s.description) || '<em style="color:#94a3b8;">—</em>'
                        ])
                    ) : '<p style="color:#62718D;font-style:italic;">Aucune structure pour l\'instant. Ajouter via Administration → Structures.</p>'}
                    ${note('#3794C4', '<strong>Liste dynamique :</strong> ce tableau reflète les structures actuelles en base. Pour ajouter, modifier ou supprimer une structure, aller dans <em>Administration → Structures</em>.')}
                `)}

                ${section('workflow', '🔄 Cycle de vie d\'un projet', `
                    <p>Un projet suit un cycle simple, de la création à la clôture. À chaque étape, un acteur précis intervient.</p>
                    <div style="background:#f8fafc;padding:16px;border-radius:8px;font-size:13px;line-height:1.8;">
                        <strong>1. Création</strong> par un directeur, un utilisateur ou un admin → choix de la structure pilote, des structures rattachées, du chef de projet, des dates et du budget.<br>
                        <strong>2. Démarrage</strong> : ajout des localités (où ?), des sites (points GPS), des géométries (tracés sur la carte), des mesures (quoi faire ?).<br>
                        <strong>3. Pilotage</strong> : le chef de projet assigne chaque mesure à un utilisateur. Les utilisateurs assignés exécutent puis déclarent le statut de leur mesure.<br>
                        <strong>4. Suivi terrain</strong> : le Commandement Territorial visite et publie des PV. Le Ministre émet des directives (observations) en cas d'alerte.<br>
                        <strong>5. Clôture</strong> : quand toutes les mesures sont <em>Exécutées</em>, le projet passe au statut <em>Terminé</em>.
                    </div>
                    <p style="font-size:12px;color:#62718D;margin-top:12px;">L'avancement (%) du projet est calculé automatiquement à partir des mesures terminées.</p>
                `)}

                ${section('create-proj', '📦 Créer un projet (pas-à-pas)', `
                    <p><strong>Qui peut le faire</strong> : Admin, Directeur, Utilisateur (le projet sera rattaché à sa structure).</p>
                    ${step(1, 'Aller dans Projets → Nouveau projet', 'Le formulaire s\'ouvre en plusieurs onglets (Général, Localités, Sites, Mesures…). Tu peux remplir au minimum l\'onglet Général et compléter le reste plus tard.')}
                    ${step(2, 'Onglet Général', 'Champs obligatoires : <strong>titre</strong>, <strong>structure pilote</strong>. Champs recommandés : description, contraintes, mesures attendues (texte libre), priorité, type, dates début/fin/échéance, budget.')}
                    ${step(3, 'Désigner un chef de projet', 'Choisir un utilisateur dans la liste (filtrée par la structure pilote). Il aura des droits étendus sur ce projet (cf. tableau ci-dessus).')}
                    ${step(4, 'Structures rattachées', 'En plus de la structure pilote, tu peux ajouter des structures secondaires qui contribuent (ex. projet ONAS avec BNSP en appui).')}
                    ${step(5, 'Onglet Localités', 'Ajouter les zones administratives concernées (Région → Département → Arrondissement → Commune). Permet de retrouver le projet par territoire et de le rendre visible aux Gouverneurs/Préfets concernés.')}
                    ${step(6, 'Onglet Sites', 'Ajouter les points GPS d\'intervention. Voir la section "Cartographie" plus bas.')}
                    ${step(7, 'Onglet Mesures', 'Ajouter les actions à mener. Voir la section "Mesures" plus bas.')}
                    ${step(8, 'Sauvegarder', 'Le projet est enregistré avec le statut <em>Démarrage</em> et 0% d\'avancement.')}
                    ${note('#3794C4', '<strong>Astuce :</strong> tu peux créer le projet en mode "minimum" (juste le titre et la structure) puis l\'enrichir progressivement. Toutes les sections sont éditables après création.')}
                    ${note('#f59e0b', '<strong>Pièces jointes :</strong> à tout moment tu peux attacher des documents (PDF, photos, etc.) au projet. Taille max : <strong>${maxFileSizeMb} Mo par fichier</strong> (configurable dans <em>Configuration → Limites d\'upload</em>).')}
                `)}

                ${section('measures', '🔧 Mesures : créer, assigner, suivre', `
                    <p>La <strong>mesure</strong> est l'unité de travail élémentaire. C'est à ce niveau que les utilisateurs déclarent ce qui a été fait. L'avancement du projet en découle directement.</p>

                    <h3 style="color:#202B5D;font-size:15px;margin-top:16px;">Anatomie d'une mesure</h3>
                    <ul>
                        <li><strong>Description</strong> : texte libre (« curer 800m de canaux à Pikine »).</li>
                        <li><strong>Type</strong> (configurable par l\'admin) : Pompage, Nettoyage, Curage, Construction, Réhabilitation, Équipement, Organisation, Autre…</li>
                        <li><strong>Statut</strong> : Préconisée → Exécutée (ou Non exécutée / Observations).</li>
                        <li><strong>Structure assignée</strong> : qui exécute (peut être différente de la structure pilote du projet).</li>
                        <li><strong>Utilisateur assigné</strong> : la personne responsable, optionnel.</li>
                        <li><strong>Site associé</strong> : lien vers un point GPS précis, optionnel.</li>
                        <li><strong>Contraintes</strong> et <strong>commentaires</strong> : pour la traçabilité.</li>
                    </ul>

                    <h3 style="color:#202B5D;font-size:15px;margin-top:16px;">Étapes</h3>
                    ${step(1, 'Ouvrir le projet', 'Aller dans Projets → cliquer sur le projet → onglet Mesures.')}
                    ${step(2, 'Ajouter une mesure', 'Description + type + structure assignée. La structure peut être la pilote ou une rattachée.')}
                    ${step(3, 'Assigner à un utilisateur', '<strong>Réservé au chef de projet, directeur de la structure ou admin.</strong> L\'utilisateur reçoit une notification in-app + un email (si configuré).')}
                    ${step(4, 'Suivi par l\'utilisateur assigné', 'Il voit la mesure dans <em>Mes mesures</em>. Il met à jour le statut quand il a exécuté ou rencontré un problème.')}
                    ${step(5, 'Clôture automatique', 'Quand toutes les mesures sont <em>Exécutées</em>, le projet est marqué <em>Terminé</em>.')}

                    <h3 style="color:#202B5D;font-size:15px;margin-top:16px;">Cycle des statuts</h3>
                    <div style="background:#f8fafc;padding:12px;border-radius:6px;font-family:monospace;font-size:13px;">
                        Préconisée  ──► Exécutée<br>
                        &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;└►  Non exécutée   (avec motif)<br>
                        &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;└►  Observations    (en attente)
                    </div>

                    <h3 style="color:#202B5D;font-size:15px;margin-top:16px;">Notifications déclenchées</h3>
                    ${table(
                        ['Événement', 'Notification in-app', 'Email (si user a une adresse)'],
                        [
                            ['Mesure assignée à un user', '✅ Cloche du destinataire', '✅ Au destinataire'],
                            ['Mesure réassignée', '✅ Au nouveau destinataire', '✅ Au nouveau destinataire'],
                            ['Statut de mesure changé', '✅ Aux watchers (chef projet, directeur, admin, assigné)', '✅ Aux watchers']
                        ]
                    )}
                `)}

                ${section('cartography', '🗺️ Sites, localités, géométries', `
                    <p>La plateforme distingue trois objets géographiques liés à un projet, complémentaires :</p>

                    <h3 style="color:#202B5D;font-size:15px;margin-top:16px;">📍 Localité (zone administrative)</h3>
                    <p>Découpage administratif du Sénégal : Région → Département → Arrondissement → Commune. Le découpage complet est pré-chargé dans la base. Une localité ne porte pas de coordonnées GPS — elle sert à <strong>rattacher le projet à un territoire</strong> pour le retrouver et le rendre visible aux autorités concernées.</p>

                    <h3 style="color:#202B5D;font-size:15px;margin-top:16px;">📍 Site (point GPS)</h3>
                    <p>Lieu d\'intervention concret avec coordonnées (latitude, longitude). S\'affiche comme un <strong>marqueur</strong> sur la carte du tableau de bord.</p>
                    <ul>
                        <li>Niveau de <strong>vulnérabilité</strong> : normal / élevée / très élevée (couleur du marqueur).</li>
                        <li>Marqueur <strong>PCS</strong> (Plan Communal de Sauvegarde) : réservé aux projets DPGI.</li>
                        <li>Liens optionnels vers une localité parente et vers une mesure.</li>
                    </ul>

                    <h3 style="color:#202B5D;font-size:15px;margin-top:16px;">📐 Géométrie (tracé sur la carte)</h3>
                    <p>Forme géographique étendue : ligne ou polygone. Trois usages :</p>
                    ${table(
                        ['Usage', 'Type', 'Représente quoi'],
                        [
                            ['<code>drainage</code>', 'LineString', 'Conduite, canal, caniveau (trait continu)'],
                            ['<code>intervention</code>', 'LineString ou Polygon', 'Zone d\'intervention en cours (pointillé)'],
                            ['<code>zone_inondable</code>', 'Polygon', 'Zone à risque (polygone translucide)']
                        ]
                    )}
                    <p>La <strong>couleur</strong> du tracé est déterminée automatiquement par la structure assignée à la géométrie (ONAS bleu, BNSP rouge, etc.). Le niveau de vulnérabilité ajuste l\'opacité.</p>
                    <p style="font-size:12px;color:#62718D;">Les Points GeoJSON ne sont <strong>pas</strong> supportés en géométrie : un point est un <em>site</em>, pas une géométrie.</p>
                `)}

                ${section('geojson', '📥 Import GeoJSON / KML / Shapefile', `
                    <p>Pour ajouter beaucoup de tracés d\'un coup, on importe un fichier SIG. La plateforme accepte les trois formats les plus courants. La conversion en GeoJSON se fait <strong>côté navigateur</strong> avant envoi : aucun fichier binaire ne transite par le serveur.</p>

                    <h3 style="color:#202B5D;font-size:15px;margin-top:16px;">Formats acceptés</h3>
                    ${table(
                        ['Format', 'Extension', 'Notes'],
                        [
                            ['<strong>GeoJSON</strong>', '<code>.geojson</code>, <code>.json</code>', 'Format natif. Coordonnées en WGS84 (longitude, latitude).'],
                            ['<strong>KML</strong>', '<code>.kml</code>', 'Format Google Earth. Conversion automatique.'],
                            ['<strong>Shapefile</strong>', '<code>.zip</code>', 'Format ESRI/QGIS. <strong>Zipper ensemble</strong> les fichiers <code>.shp</code>, <code>.shx</code>, <code>.dbf</code> et <code>.prj</code>. La projection est lue depuis le <code>.prj</code> et reprojetée automatiquement vers WGS84.']
                        ]
                    )}
                    ${note('#3794C4', '<strong>Shapefile : pourquoi un zip ?</strong> Un Shapefile n\'est pas un fichier mais une <em>famille</em> de 4 à 6 fichiers qui doivent rester ensemble. Le <code>.prj</code> est essentiel — sans lui les coordonnées ne peuvent pas être reprojetées et les tracés s\'afficheront au mauvais endroit.')}

                    <h3 style="color:#202B5D;font-size:15px;margin-top:16px;">Format interne (après conversion)</h3>
                    <p>Quel que soit le format d\'entrée, on aboutit à un <code>FeatureCollection</code>. Chaque feature porte une <code>geometry</code> (LineString ou Polygon) et des <code>properties</code> mappées sur le modèle CNGIRI :</p>
                    ${table(
                        ['Propriété GeoJSON', 'Champ CNGIRI', 'Obligatoire ?'],
                        [
                            ['<code>geometry.type</code>', '<code>kind</code> (linestring / polygon)', '✅'],
                            ['<code>geometry.coordinates</code>', '<code>coordinates</code>', '✅'],
                            ['<code>properties.name</code>', '<code>name</code>', 'Recommandé'],
                            ['<code>properties.description</code>', '<code>description</code>', 'Non'],
                            ['<code>properties.type</code>', '<code>usage_type</code> (drainage / intervention / zone_inondable / autre)', 'Recommandé'],
                            ['<code>properties.structure_code</code>', '<code>structure_id</code> (résolu via lookup)', 'Recommandé (couleur)'],
                            ['<code>properties.vulnerability</code>', '<code>vulnerability_level</code>', 'Non']
                        ]
                    )}

                    <h3 style="color:#202B5D;font-size:15px;margin-top:16px;">Limites</h3>
                    ${table(
                        ['Limite', 'Valeur actuelle', 'Modifiable ?'],
                        [
                            ['Taille du fichier', '${maxFileSizeMb} Mo', 'Configuration → Limites d\'upload'],
                            ['Nombre de features par import', '<strong>${geometryMax}</strong>', 'Configuration → Limites d\'import (1 à 50 000)'],
                            ['Types de géométrie acceptés', 'LineString, Polygon', 'Non (les Points sont à créer comme sites)']
                        ]
                    )}
                    ${note('#f59e0b', '<strong>Trop de features ?</strong> Splitter le fichier en plusieurs imports, ou demander à un admin d\'augmenter la limite via <em>Administration → Configuration → Limites d\'import</em>. Le changement est pris en compte immédiatement.')}

                    <h3 style="color:#202B5D;font-size:15px;margin-top:16px;">Exemple minimal</h3>
                    <pre style="background:#1e293b;color:#e2e8f0;padding:12px;border-radius:6px;font-size:11px;overflow-x:auto;">{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "properties": {
        "name": "Canal principal Pikine",
        "type": "drainage",
        "structure_code": "ONAS"
      },
      "geometry": {
        "type": "LineString",
        "coordinates": [[-17.39, 14.75], [-17.38, 14.74]]
      }
    }
  ]
}</pre>
                    <p style="font-size:12px;color:#62718D;">Les coordonnées sont en <strong>WGS84</strong> (longitude, latitude) — c\'est l\'ordre standard GeoJSON, attention il est inversé par rapport à la convention courante.</p>
                `)}

                ${section('map-layers', '🌍 Fonds de carte', `
                    <p>Le tableau de bord et les pages projet affichent une carte Leaflet. Chaque fond de carte (URL, type, attribution, clé API) est <strong>configurable depuis l'administration</strong> sans redéploiement, via <em>Configuration → Fonds de carte</em>.</p>

                    <h3 style="color:#202B5D;font-size:15px;margin-top:16px;">Fonds actuellement actifs</h3>
                    ${mapLayers.length > 0 ? table(
                        ['Nom affiché', 'Identifiant', 'Type'],
                        mapLayers.map(l => [
                            esc(l.label || l.value),
                            `<code>${esc(l.value)}</code>`,
                            `<code>${esc(l.metadata?.kind || 'xyz')}</code>`
                        ])
                    ) : '<p style="color:#62718D;font-size:12px;font-style:italic;">Aucun fond actif.</p>'}

                    <h3 style="color:#202B5D;font-size:15px;margin-top:16px;">Deux types de fond supportés</h3>
                    ${table(
                        ['Type', 'Quoi', 'Cas d\'usage'],
                        [
                            ['<strong><code>xyz</code></strong>', 'Tuiles bitmap classiques avec template <code>{z}/{x}/{y}</code>', 'OSM, CARTO, ArcGIS, MapTiler, votre propre serveur de tuiles'],
                            ['<strong><code>wms</code></strong>', 'Web Map Service (norme OGC)', 'Couches métier exposées par GeoServer/MapServer (réseau ONAS, zones inondables…)']
                        ]
                    )}

                    <h3 style="color:#202B5D;font-size:15px;margin-top:16px;">Ajouter un fond de carte</h3>
                    <ol style="font-size:13px;line-height:1.7;">
                        <li>Aller dans <em>Configuration → Fonds de carte</em>.</li>
                        <li>Cliquer <strong>+ Ajouter un fond de carte</strong>, donner un identifiant court (ex: <code>tiles_cngiri</code>) et un libellé.</li>
                        <li>Choisir le type (<code>xyz</code> ou <code>wms</code>).</li>
                        <li>Coller l'URL du serveur de tuiles. Pour XYZ, elle doit contenir <code>{z}/{x}/{y}</code>.</li>
                        <li>Saisir l'attribution (obligatoire pour respecter les licences ODbL/CC).</li>
                        <li>Clé API optionnelle : si l'URL contient <code>{apikey}</code>, la valeur saisie est injectée à l'exécution.</li>
                        <li>Enregistrer puis activer la case à gauche.</li>
                    </ol>
                `)}

                ${section('sovereignty', '🏛️ Souveraineté des données et des cartes', `
                    <p>Aujourd'hui, l'application <strong>ne dépend plus d'aucun service tiers</strong> sauf pour l'affichage des tuiles cartographiques. Les bibliothèques JavaScript et les polices sont auto-hébergées sur cngiri.com.</p>

                    <h3 style="color:#202B5D;font-size:15px;margin-top:16px;">État des dépendances</h3>
                    ${table(
                        ['Composant', 'Localisation', 'Souveraineté'],
                        [
                            ['Code applicatif', 'Render (cngiri.com)', '🟢 Maîtrisé'],
                            ['Base de données', 'Render PostgreSQL', '🟢 Maîtrisé (export possible à tout moment)'],
                            ['Bibliothèques JS (Leaflet, togeojson, shpjs)', '<code>/vendor/</code> sur cngiri.com', '🟢 Auto-hébergé'],
                            ['Polices (Cabin, Roboto Slab)', '<code>/fonts/</code> sur cngiri.com', '🟢 Auto-hébergé'],
                            ['<strong>Tuiles cartographiques</strong>', '<strong>OSM, CARTO, ArcGIS</strong> (externe)', '🟠 <strong>Dernière dépendance externe</strong>']
                        ]
                    )}

                    <h3 style="color:#202B5D;font-size:15px;margin-top:16px;">Données OSM — gratuites et libres (ODbL)</h3>
                    <p>Les <strong>données</strong> OpenStreetMap sont sous licence libre <strong>ODbL</strong> : utilisation commerciale autorisée, à condition de citer la source. Aucun coût, à vie. C'est <em>l'affichage</em> (les tuiles) qui peut devenir payant ou rate-limité chez certains fournisseurs.</p>

                    <h3 style="color:#202B5D;font-size:15px;margin-top:16px;">Roadmap souveraineté</h3>
                    <ul style="font-size:13px;line-height:1.7;">
                        <li><strong>Phase 1 ✅ (faite)</strong> : URL et options de chaque fond stockées en base et éditables depuis l'admin. Support des couches WMS prêt.</li>
                        <li><strong>Phase 2</strong> : déployer un <em>TileServer GL</em> sur l'infra CNGIRI avec les tuiles OSM Sénégal (générées avec <code>tilemaker</code>). Ajouter le fond <code>tiles_cngiri</code> depuis l'admin et désactiver les fonds externes. Coût : ~25 €/mois de VPS.</li>
                        <li><strong>Phase 3</strong> : exposer les <strong>couches métier</strong> propriétaires (réseau ONAS, zones inondables historiques, bâti vulnérable, cours d'eau) via <em>GeoServer</em> en WMS. L'admin les ajoute comme couches WMS dans Configuration.</li>
                        <li><strong>Phase 4</strong> : photo aérienne nationale (IGN Sénégal) si disponible.</li>
                    </ul>

                    <h3 style="color:#202B5D;font-size:15px;margin-top:16px;">État actuel des fournisseurs externes</h3>
                    ${table(
                        ['Fournisseur', 'Type', 'Limite', 'Risque'],
                        [
                            ['<code>tile.openstreetmap.org</code>', 'OSM standard', 'Usage léger uniquement', '🟠 Strict, prévoir alternative'],
                            ['<code>tile.openstreetmap.fr</code>', 'OSM France / HOT', 'Usage léger uniquement', '🟠 Strict, infra bénévole'],
                            ['<code>basemaps.cartocdn.com</code>', 'CARTO Voyager', '~75 000 vues/mois sans clé', '🟢 Confortable'],
                            ['<code>server.arcgisonline.com</code>', 'Esri Satellite', 'Reasonable use', '🟢 OK'],
                        ]
                    )}
                    ${note('#f59e0b', '<strong>Important</strong> : tant que le serveur maison n\'est pas en place, ne pas exposer la plateforme à un trafic massif (intégration dans un site grand public, crawler…). Les fournisseurs OSM peuvent <em>blacklister par IP</em> si l\'usage devient excessif.')}
                `)}

                ${section('observations', '🗣️ Directives du Ministre (Observations)', `
                    <p>Le rôle <strong>Superviseur</strong> publie des <em>directives</em> écrites adressées aux structures opérationnelles ou liées à un projet précis. Elles apparaissent en haut du tableau de bord des destinataires.</p>
                    <ul>
                        <li><strong>Priorité</strong> : Info, Importante, Urgente.</li>
                        <li><strong>Échéance</strong> (deadline) optionnelle — le bot et le tableau de bord la mettent en avant.</li>
                        <li><strong>Portée</strong> : <em>globale</em> (visible par tous) ou <em>sur un projet</em>.</li>
                        <li>Pièces jointes possibles (PDF, photos).</li>
                        <li>Un badge sur l\'icône cloche indique les non-lues par utilisateur.</li>
                    </ul>
                    ${note('#3794C4', '<strong>Différence avec une annonce broadcast</strong> : une observation est une <em>directive métier</em> archivée dans l\'historique du projet. Une annonce broadcast (cf. plus bas) est un message éphémère de service (« app down 5 min »).')}
                `)}

                ${section('pv', '📋 PV du Commandement Territorial', `
                    <p>Le <strong>Commandement Territorial</strong> représente l\'État sur le terrain. Trois niveaux :</p>
                    ${table(
                        ['Niveau', 'Autorité', 'Champ <code>territorial_level</code>'],
                        [
                            ['Région', 'Gouverneur', '<code>region</code>'],
                            ['Département', 'Préfet', '<code>departement</code>'],
                            ['Arrondissement', 'Sous-préfet', '<code>arrondissement</code>']
                        ]
                    )}
                    <p>Un <strong>PV de visite</strong> (procès-verbal) est un compte-rendu structuré du terrain :</p>
                    <ul>
                        <li>Date de visite, titre, priorité.</li>
                        <li>Avancement constaté (texte libre + pourcentage).</li>
                        <li>Observations terrain et recommandations.</li>
                        <li>Liens vers les projets / mesures / sites / localités visités.</li>
                        <li>Pièces jointes (photos, croquis…).</li>
                    </ul>
                    <p style="font-size:12px;color:#62718D;">Le Préfet voit les PV de son département et ceux des sous-préfets de son département. Le Gouverneur voit en plus tous les PV de sa région.</p>
                `)}

                ${section('forms', '📝 Formulaires dynamiques', `
                    <p>En complément des projets et mesures (modèle structuré), la plateforme permet de créer des <strong>formulaires dynamiques</strong> pour collecter de l\'information ad hoc auprès d\'une structure.</p>
                    <ul>
                        <li>L\'admin conçoit le formulaire (titre, champs, types) et l\'assigne à une structure.</li>
                        <li>Les utilisateurs de cette structure remplissent le formulaire (= une <em>soumission</em>).</li>
                        <li>L\'historique des soumissions est consultable et exportable.</li>
                    </ul>
                    <p style="font-size:12px;color:#62718D;">Cas d\'usage : enquête ponctuelle (« recensement des points noirs avant la saison des pluies »), questionnaire de capacité (« moyens humains par structure »), checklist d\'audit, etc.</p>
                `)}

                ${section('notifs', '🔔 Notifications et emails', `
                    <p>La plateforme combine deux canaux de notification.</p>

                    <h3 style="color:#202B5D;font-size:15px;margin-top:16px;">Canal 1 : Notifications in-app (cloche)</h3>
                    <p>Toujours actif. Stockées en base, comptées par utilisateur, marquées comme lues quand l\'utilisateur les consulte. Visible via l\'icône cloche en haut à droite.</p>

                    <h3 style="color:#202B5D;font-size:15px;margin-top:16px;">Canal 2 : Emails transactionnels (Resend)</h3>
                    <p>Envoyés via le service <strong>Resend</strong>. Le mail expéditeur est <code>noreply@cngiri.com</code>. Trois événements déclencheurs :</p>
                    ${table(
                        ['Événement', 'Destinataire', 'Contenu'],
                        [
                            ['Création de compte', 'Le nouvel utilisateur', 'Bienvenue + identifiant + lien de connexion'],
                            ['Mesure assignée', 'L\'utilisateur assigné', 'Projet + description + bouton "Voir mes mesures"'],
                            ['Statut de mesure changé', 'Watchers (chef projet, directeur, admin, assigné)', 'Ancien et nouveau statut + lien projet']
                        ]
                    )}
                    ${note('#3794C4', '<strong>Email facultatif :</strong> si un utilisateur n\'a pas d\'adresse email enregistrée, il continue à recevoir les notifications in-app, mais aucun email n\'est envoyé. Pas d\'erreur, pas de blocage.')}
                    ${note('#f59e0b', '<strong>Côté technique :</strong> si la clé API Resend n\'est pas configurée sur le serveur, aucun email n\'est envoyé (no-op silencieux). Le code métier n\'est jamais bloqué par un échec d\'envoi.')}
                `)}

                ${section('sessions', '🔐 Sessions, mot de passe, sécurité', `
                    <p>L\'authentification utilise des <strong>JWT</strong> signés côté serveur, valides 7 jours. Plusieurs mécanismes permettent de gérer les sessions actives.</p>

                    <h3 style="color:#202B5D;font-size:15px;margin-top:16px;">Pour l\'utilisateur</h3>
                    <ul>
                        <li><strong>Changer mon mot de passe</strong> (menu utilisateur en haut à droite) — invalide automatiquement toutes mes autres sessions.</li>
                        <li><strong>Déconnecter mes autres appareils</strong> (même menu) — utile si on s\'est connecté sur un poste partagé. La session courante reste active grâce à un token frais renvoyé par le serveur.</li>
                    </ul>

                    <h3 style="color:#202B5D;font-size:15px;margin-top:16px;">Pour l\'admin</h3>
                    <ul>
                        <li><strong>Onglet Sessions actives</strong> (Administration) : voit qui est en ligne (activité dans les 5 dernières minutes), qui a été actif dans les dernières 24h, 7j, qui ne s\'est jamais connecté.</li>
                        <li><strong>Forcer la déconnexion</strong> d\'un utilisateur : un clic, ses sessions sont révoquées immédiatement, il bascule en "hors ligne" instantanément.</li>
                        <li>L\'admin ne peut pas se kicker lui-même (garde-fou). Pour ça, utiliser "Déconnecter mes autres appareils".</li>
                    </ul>

                    <h3 style="color:#202B5D;font-size:15px;margin-top:16px;">Activité utilisateur</h3>
                    <p>L\'application enregistre <code>last_activity_at</code> à chaque requête authentifiée, avec un throttle d\'<strong>1 écriture par minute par utilisateur</strong> côté serveur — donc aucun impact sur la base même si un user fait beaucoup de clics.</p>

                    <h3 style="color:#202B5D;font-size:15px;margin-top:16px;">Sécurité côté navigateur</h3>
                    <ul>
                        <li><strong>Content-Security-Policy</strong> strict : la page ne peut se connecter qu\'à cngiri.com et aux fournisseurs de tuiles cartographiques. Aucune adresse IP locale n\'est joignable.</li>
                        <li><strong>Permissions-Policy</strong> : caméra, micro, geo désactivés sauf si explicitement utilisés.</li>
                        <li><strong>Service Worker</strong> : cache les assets statiques pour fonctionnement hors-ligne partiel.</li>
                    </ul>
                `)}

                ${section('announce', '📣 Annonces broadcast', `
                    <p>L\'admin peut afficher un <strong>bandeau visible par tous les utilisateurs connectés</strong>. Pratique pour annoncer une maintenance ou un événement.</p>
                    <ul>
                        <li>3 niveaux : <span style="background:#dbeafe;color:#1e3a8a;padding:1px 8px;border-radius:8px;font-size:11px;">Info</span> · <span style="background:#fef3c7;color:#78350f;padding:1px 8px;border-radius:8px;font-size:11px;">Avertissement</span> · <span style="background:#fee2e2;color:#7f1d1d;padding:1px 8px;border-radius:8px;font-size:11px;">Critique</span></li>
                        <li>Durée paramétrable : 15 min, 30 min, 1h, 4h, 1 jour, ou indéfinie (à révoquer manuellement).</li>
                        <li>Masquable individuellement par chaque user via un bouton ×.</li>
                        <li>Animation à la première apparition pour attirer l\'œil.</li>
                        <li>Polling 60s côté front : le bandeau apparaît / disparaît dans la minute après la publication ou la révocation.</li>
                    </ul>
                    <p>Onglet <em>Administration → Annonces</em> : formulaire de publication + historique avec actions Révoquer / Supprimer.</p>
                `)}

                ${section('api-keys', '🔑 Clés API', `
                    <p>L\'admin peut créer des <strong>clés d\'API</strong> pour permettre à des outils externes de lire les données CNGIRI (monitoring, dashboard tiers, exports automatisés…).</p>
                    <ul>
                        <li>Chaque clé est liée à un <strong>utilisateur propriétaire</strong> et hérite de son rôle.</li>
                        <li>Une <strong>date d\'expiration</strong> peut être définie ; passé cette date, la clé est rejetée.</li>
                        <li>La clé n\'est affichée <strong>qu\'une seule fois</strong> à la création — la copier immédiatement.</li>
                        <li>Documentation OpenAPI : <a href="/api/v1/docs" target="_blank" style="color:#3794C4;">/api/v1/docs</a></li>
                    </ul>
                    ${note('#dc2626', '<strong>Sécurité :</strong> une clé API a les mêmes droits que son utilisateur propriétaire. Pour des intégrations à droits limités, créer un utilisateur dédié avec rôle <em>auditeur</em> ou <em>lecteur</em> (lecture seule).')}
                `)}

                ${section('limits', '📏 Limites techniques', `
                    <p>Récapitulatif des limites en vigueur sur la plateforme.</p>
                    ${table(
                        ['Limite', 'Valeur', 'Configurable ?'],
                        [
                            ['Taille max d\'un fichier joint', '<strong>${maxFileSizeMb} Mo</strong>', 'Oui — Configuration → Limites d\'upload'],
                            ['Features par import GeoJSON', '<strong>${geometryMax}</strong>', 'Oui — Configuration → Limites d\'import'],
                            ['Plafond serveur GeoJSON (sanity)', '50 000 features', 'Non (modifiable en code seulement)'],
                            ['Body HTTP', '10 Mo', 'Non'],
                            ['Durée de validité d\'un JWT', '7 jours', 'Variable d\'environnement <code>JWT_EXPIRES_IN</code>'],
                            ['Seuil "en ligne" dans Sessions actives', '5 minutes', 'Paramètre query <code>?online_minutes=</code> (1-60)'],
                            ['Throttle d\'écriture activité user', '1/minute/user', 'Non'],
                            ['Polling bandeau d\'annonces', '60 secondes', 'Non'],
                            ['Polling sessions actives (admin)', '30 secondes', 'Non'],
                            ['Cap résultats des outils du chatbot', '100 lignes', 'Non']
                        ]
                    )}
                `)}

                ${section('glossary', '📖 Glossaire', `
                    ${table(
                        ['Terme', 'Définition'],
                        [
                            ['<strong>Mesure</strong>', 'Action concrète à mener sur un projet, assignable à un utilisateur. Unité de suivi élémentaire.'],
                            ['<strong>Site</strong>', 'Point géolocalisé (lat/lng) rattaché à un projet.'],
                            ['<strong>Localité</strong>', 'Zone administrative (Région/Département/Arrondissement/Commune).'],
                            ['<strong>Géométrie</strong>', 'Tracé sur la carte : LineString (ligne) ou Polygon (zone).'],
                            ['<strong>PCS</strong>', 'Plan Communal de Sauvegarde. Marqueur spécial sur les sites DPGI.'],
                            ['<strong>FeatureCollection</strong>', 'Format racine d\'un fichier GeoJSON, contient un tableau <code>features[]</code>.'],
                            ['<strong>JWT</strong>', 'Token signé qui prouve l\'identité de l\'utilisateur à chaque requête.'],
                            ['<strong>token_version</strong>', 'Compteur sur l\'utilisateur : incrémenté à chaque révocation, invalide tous les anciens JWT.'],
                            ['<strong>Chef de projet</strong>', 'Désignation par projet (pas un rôle). Donne des droits étendus sur ce projet précis.'],
                            ['<strong>Watchers</strong>', 'Ensemble des utilisateurs notifiés d\'un événement sur une mesure (chef projet, directeur, admin, assigné).'],
                            ['<strong>Soft delete</strong>', 'Suppression "logique" (champ <code>deleted_at</code>) : la donnée reste en base et peut être restaurée depuis la corbeille.']
                        ]
                    )}
                `)}

                <div style="background:#f0f4f8;padding:16px;border-radius:8px;margin-top:32px;font-size:12px;color:#62718D;text-align:center;">
                    Documentation générée à partir de la structure actuelle de la plateforme et des paramètres en base.
                    Mettre à jour cet onglet dans <code>public/js/pages/admin.js</code> à chaque feature ajoutée.
                </div>
            </div>
        `;
    },

    getRoleLabel(role) {
        const labels = {
            'admin': 'Administrateur',
            'utilisateur': 'Utilisateur',
            'directeur': 'Directeur',
            'superviseur': 'Superviseur (Ministre)',
            'commandement_territorial': 'Commandement Territorial',
            'lecteur': 'Lecteur',
            'auditeur': 'Auditeur'
        };
        return labels[role] || role;
    },

    afterRender() {
        Navbar.updateActiveMenu();

        // Tab switching
        const tabs = document.querySelectorAll('.admin-tab');
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                tabs.forEach(t => {
                    t.classList.remove('active');
                    t.style.borderBottom = '3px solid transparent';
                    t.style.color = '#666';
                });
                tab.classList.add('active');
                tab.style.borderBottom = '3px solid #1e3c72';
                tab.style.color = '#1e3c72';

                const tabName = tab.getAttribute('data-tab');
                const content = document.getElementById('admin-content');
                
                // Toujours arrêter l'auto-refresh sessions quand on change d'onglet
                if (tabName !== 'sessions') this.stopSessionsAutoRefresh();

                // Marquer l'onglet actif pour ignorer les callbacks async obsolètes
                // (cas : l'utilisateur clique announcements puis sessions avant la
                // fin du fetch ; sans ce check, le callback announcements écraserait
                // le contenu du tab sessions).
                this.currentTab = tabName;

                if (tabName === 'users') {
                    content.innerHTML = this.renderUsers();
                } else if (tabName === 'announcements') {
                    content.innerHTML = '<div class="card" style="padding:40px;text-align:center;color:#8896AB;">Chargement...</div>';
                    this.loadAnnouncements().then(() => {
                        if (this.currentTab !== 'announcements') return;
                        content.innerHTML = this.renderAnnouncements();
                    });
                } else if (tabName === 'sessions') {
                    content.innerHTML = '<div class="card" style="padding:40px;text-align:center;color:#8896AB;">Chargement...</div>';
                    this.loadSessions().then(() => {
                        if (this.currentTab !== 'sessions') return;
                        content.innerHTML = this.renderSessions();
                        this.startSessionsAutoRefresh();
                    });
                } else if (tabName === 'structures') {
                    content.innerHTML = this.renderStructures();
                } else if (tabName === 'config') {
                    content.innerHTML = this.renderConfig();
                } else if (tabName === 'api-keys') {
                    this.loadApiKeys().then(() => {
                        if (this.currentTab !== 'api-keys') return;
                        content.innerHTML = this.renderApiKeys();
                    });
                } else if (tabName === 'docs') {
                    content.innerHTML = this.renderDocumentation();
                } else if (tabName === 'trash') {
                    content.innerHTML = '<div class="card" style="padding:40px;text-align:center;color:#8896AB;">Chargement...</div>';
                    this.loadTrash().then(() => {
                        if (this.currentTab !== 'trash') return;
                        content.innerHTML = this.renderTrash();
                    });
                }
            });
        });
    },

    createUser() {
        Toast.info('Fonctionnalité de création d\'utilisateur en cours de développement');
    },

    editUser(id) {
        Toast.info('Fonctionnalité de modification d\'utilisateur en cours de développement');
    },

    async deleteUser(id) {
        Toast.confirm('Êtes-vous sûr de vouloir supprimer cet utilisateur ?', async () => {
            try {
                await API.users.delete(id);
                Toast.success('Utilisateur supprimé');
                window.location.reload();
            } catch (error) {
                Toast.error('Erreur: ' + error.message);
            }
        }, { type: 'danger', confirmText: 'Supprimer' });
    },

    createStructure() {
        const modal = document.createElement('div');
        modal.className = 'confirm-overlay confirm-visible';
        modal.innerHTML = `
            <div class="confirm-dialog" style="text-align:left;max-width:500px;">
                <h3 style="margin-bottom:20px;color:#202B5D;">Nouvelle structure</h3>
                <div class="form-group">
                    <label>Code <span style="color:#e74c3c;">*</span></label>
                    <input type="text" id="struct-code" class="form-control" placeholder="ex: DPGI" maxlength="50">
                </div>
                <div class="form-group">
                    <label>Nom <span style="color:#e74c3c;">*</span></label>
                    <input type="text" id="struct-name" class="form-control" placeholder="ex: Direction de la Prévention et de la Gestion des Inondations">
                </div>
                <div class="form-group">
                    <label>Description</label>
                    <textarea id="struct-description" class="form-control" rows="3" placeholder="Rôle et mission de la structure"></textarea>
                </div>
                <div class="confirm-actions" style="margin-top:20px;">
                    <button class="confirm-btn confirm-btn-cancel" onclick="this.closest('.confirm-overlay').remove()">Annuler</button>
                    <button class="confirm-btn confirm-btn-ok" style="background:#3794C4;" onclick="AdminPage.saveNewStructure()">Enregistrer</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        setTimeout(() => document.getElementById('struct-code').focus(), 50);
    },

    async saveNewStructure() {
        const code = document.getElementById('struct-code').value.trim().toUpperCase();
        const name = document.getElementById('struct-name').value.trim();
        const description = document.getElementById('struct-description').value.trim();

        if (!code || !name) { Toast.warning('Code et nom requis.'); return; }

        try {
            await API.structures.create({ code, name, description });
            document.querySelector('.confirm-overlay').remove();
            Toast.success('Structure créée.');
            const res = await API.structures.getAll();
            this.data.structures = res.data || [];
            document.getElementById('admin-content').innerHTML = this.renderStructures();
        } catch (err) {
            Toast.error('Erreur: ' + (err.message || 'Erreur inconnue'));
        }
    },

    editStructure(id) {
        const s = this.data.structures.find(x => x.id === id);
        if (!s) return;
        const esc = (v) => (v || '').replace(/"/g, '&quot;');
        const modal = document.createElement('div');
        modal.className = 'confirm-overlay confirm-visible';
        modal.innerHTML = `
            <div class="confirm-dialog" style="text-align:left;max-width:500px;">
                <h3 style="margin-bottom:20px;color:#202B5D;">Modifier structure</h3>
                <div class="form-group">
                    <label>Code <span style="color:#e74c3c;">*</span></label>
                    <input type="text" id="struct-edit-code" class="form-control" value="${esc(s.code)}" maxlength="50">
                </div>
                <div class="form-group">
                    <label>Nom <span style="color:#e74c3c;">*</span></label>
                    <input type="text" id="struct-edit-name" class="form-control" value="${esc(s.name)}">
                </div>
                <div class="form-group">
                    <label>Description</label>
                    <textarea id="struct-edit-description" class="form-control" rows="3">${s.description || ''}</textarea>
                </div>
                <div class="confirm-actions" style="margin-top:20px;">
                    <button class="confirm-btn confirm-btn-cancel" onclick="this.closest('.confirm-overlay').remove()">Annuler</button>
                    <button class="confirm-btn confirm-btn-ok" style="background:#3794C4;" onclick="AdminPage.saveEditStructure(${id})">Enregistrer</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    },

    async saveEditStructure(id) {
        const code = document.getElementById('struct-edit-code').value.trim().toUpperCase();
        const name = document.getElementById('struct-edit-name').value.trim();
        const description = document.getElementById('struct-edit-description').value.trim();

        if (!code || !name) { Toast.warning('Code et nom requis.'); return; }

        try {
            await API.structures.update(id, { code, name, description });
            document.querySelector('.confirm-overlay').remove();
            Toast.success('Structure modifiée.');
            const res = await API.structures.getAll();
            this.data.structures = res.data || [];
            document.getElementById('admin-content').innerHTML = this.renderStructures();
        } catch (err) {
            Toast.error('Erreur: ' + (err.message || 'Erreur inconnue'));
        }
    },

    // ==================== Clés API ====================

    async loadApiKeys() {
        const res = await API.apiKeys.list();
        this.data.apiKeys = res.data || [];
    },

    renderApiKeys() {
        const isAdmin = Auth.hasRole('admin');
        const rows = this.data.apiKeys.map(k => {
            const expired = k.expires_at && new Date(k.expires_at) < new Date();
            const statusBadge = !k.is_active
                ? '<span style="padding:2px 8px;background:#8896AB;color:white;border-radius:10px;font-size:11px;font-weight:600;">Révoquée</span>'
                : expired
                ? '<span style="padding:2px 8px;background:#e67e22;color:white;border-radius:10px;font-size:11px;font-weight:600;">Expirée</span>'
                : '<span style="padding:2px 8px;background:#27ae60;color:white;border-radius:10px;font-size:11px;font-weight:600;">Active</span>';
            const lastUsed = k.last_used_at ? new Date(k.last_used_at).toLocaleString('fr-FR') : 'Jamais';
            const owner = isAdmin && k.username
                ? `<br><small style="color:#8896AB;">${k.first_name || ''} ${k.last_name || ''} (${k.username})</small>`
                : '';

            return `
                <tr>
                    <td>${k.label || '<em style="color:#8896AB;">Sans libellé</em>'}${owner}</td>
                    <td><code style="background:#f0f4f8;padding:2px 6px;border-radius:4px;font-size:12px;">${k.key_prefix}…</code></td>
                    <td>${statusBadge}</td>
                    <td style="font-size:12px;color:#62718D;">${lastUsed}</td>
                    <td style="font-size:12px;color:#62718D;">${new Date(k.created_at).toLocaleDateString('fr-FR')}</td>
                    <td>
                        <div style="display:flex;gap:6px;">
                            ${k.is_active ? `<button class="btn-icon" onclick="AdminPage.revokeApiKey(${k.id})" title="Révoquer">🚫</button>` : ''}
                            <button class="btn-icon" onclick="AdminPage.deleteApiKey(${k.id})" title="Supprimer">${Icon.render('trash', 16, 'var(--color-danger)')}</button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');

        return `
            <div class="card">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
                    <div>
                        <h2 style="margin:0;">Clés API</h2>
                        <p style="color:#62718D;font-size:13px;margin:4px 0 0;">Authentifient l'accès à l'API externe <code>/api/v1</code>. Chaque clé hérite des droits de son propriétaire.</p>
                    </div>
                    <button class="btn btn-primary" style="display:inline-flex;align-items:center;gap:6px;" onclick="AdminPage.createApiKey()">${Icon.render('plus', 14, 'white')} Nouvelle clé</button>
                </div>
                <div style="background:#f0f8ff;padding:12px;border-radius:6px;border-left:3px solid #3794C4;margin-bottom:16px;font-size:13px;">
                    <strong>Documentation :</strong> <a href="/api/v1/docs" target="_blank" style="color:#3794C4;">OpenAPI JSON</a>
                    &nbsp;|&nbsp;
                    Usage : <code>curl -H "x-api-key: VOTRE_CLE" ${window.location.origin}/api/v1/projects</code>
                </div>
                <div class="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>Libellé</th>
                                <th>Préfixe</th>
                                <th>Statut</th>
                                <th>Dernière utilisation</th>
                                <th>Créée le</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${rows || '<tr><td colspan="6" style="text-align:center;color:#8896AB;padding:30px;">Aucune clé. Créez-en une pour accéder à l\'API.</td></tr>'}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    },

    createApiKey() {
        const modal = document.createElement('div');
        modal.className = 'confirm-overlay confirm-visible';
        modal.innerHTML = `
            <div class="confirm-dialog" style="text-align:left;max-width:500px;">
                <h3 style="margin-bottom:12px;color:#202B5D;">Nouvelle clé API</h3>
                <p style="color:#62718D;font-size:13px;margin-bottom:20px;">La clé héritera de vos droits et sera montrée <strong>une seule fois</strong>.</p>
                <div class="form-group">
                    <label>Libellé (pour vous retrouver)</label>
                    <input type="text" id="ak-label" class="form-control" placeholder="ex: Chatbot, Intégration PowerBI, Script de monitoring" maxlength="100">
                </div>
                <div class="form-group">
                    <label>Expiration (optionnel)</label>
                    <input type="date" id="ak-expires" class="form-control">
                </div>
                <div class="confirm-actions" style="margin-top:20px;">
                    <button class="confirm-btn confirm-btn-cancel" onclick="this.closest('.confirm-overlay').remove()">Annuler</button>
                    <button class="confirm-btn confirm-btn-ok" style="background:#202B5D;" onclick="AdminPage.saveNewApiKey()">Générer la clé</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        setTimeout(() => document.getElementById('ak-label').focus(), 50);
    },

    async saveNewApiKey() {
        const label = document.getElementById('ak-label').value.trim();
        const expiresAt = document.getElementById('ak-expires').value;
        try {
            const res = await API.apiKeys.create({ label, expires_at: expiresAt || null });
            document.querySelector('.confirm-overlay')?.remove();
            this.showApiKeyOnce(res.data.key, label);
            await this.loadApiKeys();
            document.getElementById('admin-content').innerHTML = this.renderApiKeys();
        } catch (err) {
            Toast.error('Erreur: ' + (err.message || 'inconnue'));
        }
    },

    showApiKeyOnce(key, label) {
        const modal = document.createElement('div');
        modal.className = 'confirm-overlay confirm-visible';
        modal.innerHTML = `
            <div class="confirm-dialog" style="text-align:left;max-width:600px;">
                <h3 style="margin-bottom:12px;color:#27ae60;">✅ Clé générée</h3>
                <div style="background:#fff3cd;padding:12px;border-radius:6px;border-left:3px solid #f39c12;margin-bottom:16px;font-size:13px;">
                    ⚠️ <strong>Copiez cette clé maintenant.</strong> Pour des raisons de sécurité, elle ne sera <u>plus jamais</u> affichée.
                </div>
                ${label ? `<div style="margin-bottom:10px;color:#62718D;">Libellé : <strong>${label}</strong></div>` : ''}
                <div style="background:#202B5D;color:#fff;padding:14px;border-radius:8px;font-family:monospace;font-size:13px;word-break:break-all;user-select:all;" id="ak-generated-key">${key}</div>
                <button class="btn btn-secondary" style="margin-top:12px;" onclick="navigator.clipboard.writeText(document.getElementById('ak-generated-key').textContent).then(() => Toast.success('Copiée !'))">
                    📋 Copier
                </button>
                <div class="confirm-actions" style="margin-top:20px;">
                    <button class="confirm-btn confirm-btn-ok" style="background:#27ae60;" onclick="this.closest('.confirm-overlay').remove()">J'ai copié la clé</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    },

    revokeApiKey(id) {
        Toast.confirm('Révoquer cette clé ? Elle ne pourra plus être utilisée, mais reste dans l\'historique.', async () => {
            try {
                await API.apiKeys.revoke(id);
                Toast.success('Clé révoquée.');
                await this.loadApiKeys();
                document.getElementById('admin-content').innerHTML = this.renderApiKeys();
            } catch (err) { Toast.error('Erreur: ' + (err.message || 'inconnue')); }
        }, { type: 'warning', confirmText: 'Révoquer' });
    },

    deleteApiKey(id) {
        Toast.confirm('Supprimer définitivement cette clé ?', async () => {
            try {
                await API.apiKeys.delete(id);
                Toast.success('Clé supprimée.');
                await this.loadApiKeys();
                document.getElementById('admin-content').innerHTML = this.renderApiKeys();
            } catch (err) { Toast.error('Erreur: ' + (err.message || 'inconnue')); }
        }, { type: 'danger', confirmText: 'Supprimer' });
    },

    async deleteStructure(id) {
        Toast.confirm('Êtes-vous sûr de vouloir supprimer cette structure ?', async () => {
            try {
                await API.structures.delete(id);
                Toast.success('Structure supprimée');
                window.location.reload();
            } catch (error) {
                Toast.error('Erreur: ' + error.message);
            }
        }, { type: 'danger', confirmText: 'Supprimer' });
    },

    // === Configuration (Types & Statuts) ===

    renderConfig() {
        const types = this.data.configItems.filter(c => c.category === 'measure_type');
        const statuses = this.data.configItems.filter(c => c.category === 'measure_status');
        const mapLayers = this.data.configItems
            .filter(c => c.category === 'map_layers')
            .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
        const maxFileSizeRow = this.data.configItems
            .find(c => c.category === 'upload_limits' && c.value === 'max_file_size_mb');
        const maxFileSizeMb = maxFileSizeRow ? parseInt(maxFileSizeRow.label, 10) : 5;

        const geometryMaxRow = this.data.configItems
            .find(c => c.category === 'import_limits' && c.value === 'geometry_max_features');
        const geometryMax = geometryMaxRow ? parseInt(geometryMaxRow.label, 10) : 2000;

        const renderTable = (title, category, items) => `
            <div style="margin-bottom: 32px;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
                    <h3 style="margin:0;color:#202B5D;">${title}</h3>
                    <button class="btn btn-primary" onclick="AdminPage.addConfigItem('${category}')" style="font-size:13px;">
                        + Ajouter
                    </button>
                </div>
                <div class="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>Valeur</th>
                                <th>Libellé</th>
                                <th>Ordre</th>
                                <th>Actif</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${items.map(item => `
                                <tr>
                                    <td><code style="background:#f0f4f8;padding:2px 8px;border-radius:4px;">${item.value}</code></td>
                                    <td>${item.label}</td>
                                    <td>${item.sort_order}</td>
                                    <td>${item.is_active ? '<span style="color:#27ae60;">Oui</span>' : '<span style="color:#e74c3c;">Non</span>'}</td>
                                    <td>
                                        <div style="display:flex;gap:8px;">
                                            <button class="btn-icon" onclick="AdminPage.editConfigItem(${item.id}, '${item.category}')" title="Modifier">&#9998;</button>
                                            <button class="btn-icon" onclick="AdminPage.deleteConfigItem(${item.id})" title="Supprimer" style="color:#e74c3c;">&#10005;</button>
                                        </div>
                                    </td>
                                </tr>
                            `).join('')}
                            ${items.length === 0 ? '<tr><td colspan="5" style="text-align:center;color:#8896AB;">Aucun élément</td></tr>' : ''}
                        </tbody>
                    </table>
                </div>
            </div>
        `;

        // Tableau dédié aux fonds de carte : toggle case à cocher direct, pas d'ajout /
        // suppression (les 5 entrées sont fixes, définies côté code pour rester en
        // cohérence avec les URL de tuiles).
        const renderMapLayers = () => `
            <div style="margin-bottom: 32px;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                    <h3 style="margin:0;color:#202B5D;">Fonds de carte</h3>
                </div>
                <p style="color:#62718D;font-size:13px;margin:0 0 16px;">
                    Cochez les fonds de carte que les utilisateurs pourront sélectionner dans le sélecteur en haut à droite du dashboard.
                </p>
                <div style="display:flex;flex-direction:column;gap:12px;">
                    ${mapLayers.map(item => {
                        const meta = item.metadata || {};
                        const kind = meta.kind || 'xyz';
                        const url = meta.url || '';
                        const apiKey = meta.api_key || '';
                        const attribution = meta.attribution || '';
                        return `
                        <div class="card" style="padding:14px;border:1px solid var(--color-border);background:${item.is_active ? '#fff' : '#f8fafc'};">
                            <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:10px;">
                                <input type="checkbox" ${item.is_active ? 'checked' : ''}
                                       onchange="AdminPage.toggleMapLayer(${item.id}, this.checked)"
                                       style="width:16px;height:16px;cursor:pointer;" title="Activer/désactiver">
                                <strong style="flex:1;color:#202B5D;">${item.label}</strong>
                                <code style="background:#f0f4f8;padding:2px 8px;border-radius:4px;font-size:11px;">${item.value}</code>
                                <span style="background:${kind === 'wms' ? '#dcfce7' : '#dbeafe'};color:${kind === 'wms' ? '#166534' : '#1e40af'};padding:2px 8px;border-radius:8px;font-size:11px;font-weight:600;text-transform:uppercase;">${kind}</span>
                                <button class="btn-icon" onclick="AdminPage.deleteMapLayer(${item.id}, '${item.value.replace(/'/g, "\\'")}')" title="Supprimer">${Icon.render('trash', 14, 'var(--color-danger)')}</button>
                            </div>
                            <div style="display:grid;grid-template-columns:120px 1fr;gap:8px 12px;align-items:center;font-size:13px;">
                                <label style="color:#62718D;">Type</label>
                                <select id="ml-kind-${item.id}" style="padding:6px 8px;border:1px solid #dce3ed;border-radius:4px;font-size:13px;">
                                    <option value="xyz" ${kind === 'xyz' ? 'selected' : ''}>XYZ (tuiles classiques)</option>
                                    <option value="wms" ${kind === 'wms' ? 'selected' : ''}>WMS (Web Map Service)</option>
                                </select>
                                <label style="color:#62718D;">URL</label>
                                <input type="text" id="ml-url-${item.id}" value="${(url+'').replace(/"/g, '&quot;')}"
                                       placeholder="${kind === 'wms' ? 'https://geo.example.com/wms' : 'https://{s}.serveur.com/{z}/{x}/{y}.png'}"
                                       style="padding:6px 8px;border:1px solid #dce3ed;border-radius:4px;font-size:12px;font-family:monospace;">
                                <label style="color:#62718D;">Attribution</label>
                                <input type="text" id="ml-attr-${item.id}" value="${(attribution+'').replace(/"/g, '&quot;')}"
                                       placeholder="© Source des données"
                                       style="padding:6px 8px;border:1px solid #dce3ed;border-radius:4px;font-size:12px;">
                                <label style="color:#62718D;">Clé API</label>
                                <input type="text" id="ml-key-${item.id}" value="${(apiKey+'').replace(/"/g, '&quot;')}"
                                       placeholder="Optionnel — utilisée si {apikey} dans l'URL"
                                       style="padding:6px 8px;border:1px solid #dce3ed;border-radius:4px;font-size:12px;font-family:monospace;">
                            </div>
                            <div style="margin-top:10px;text-align:right;">
                                <button class="btn btn-primary" style="font-size:12px;padding:6px 14px;" onclick="AdminPage.saveMapLayer(${item.id})">Enregistrer</button>
                            </div>
                        </div>`;
                    }).join('')}
                    ${mapLayers.length === 0 ? '<div style="text-align:center;color:#8896AB;padding:20px;">Aucun fond de carte configuré.</div>' : ''}
                    <div>
                        <button class="btn btn-secondary" style="font-size:13px;" onclick="AdminPage.addMapLayer()">
                            + Ajouter un fond de carte
                        </button>
                    </div>
                </div>
                <p style="margin-top:10px;font-size:11px;color:#94a3b8;">
                    Astuce : pour utiliser un serveur de tuiles maison (ex. <code>tiles.cngiri.com</code>), choisir <strong>XYZ</strong> et saisir l'URL avec <code>{z}/{x}/{y}</code>. Pour une couche métier (réseau ONAS, zones inondables…), choisir <strong>WMS</strong>.
                </p>
            </div>
        `;

        // Section "Limites d'upload" — un seul réglage pour l'instant (taille
        // max), mais conçue pour pouvoir en ajouter (types autorisés, etc.).
        const renderUploadLimits = () => maxFileSizeRow ? `
            <div style="margin-bottom: 32px;">
                <h3 style="margin:0 0 8px;color:#202B5D;">Limites d'upload</h3>
                <p style="color:#62718D;font-size:13px;margin:0 0 16px;">
                    Taille maximale d'un document uploadé. Le changement est pris en compte immédiatement (pas de redémarrage).
                </p>
                <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
                    <label for="cfg-max-file-size" style="color:#202B5D;font-weight:600;">Taille max (Mo)</label>
                    <input type="number" id="cfg-max-file-size" min="1" max="500" step="1"
                           value="${maxFileSizeMb}"
                           style="width:90px;padding:8px 10px;border:1px solid #dce3ed;border-radius:6px;font-size:14px;outline:none;" />
                    <button class="btn btn-primary"
                            onclick="AdminPage.saveMaxFileSize(${maxFileSizeRow.id})"
                            style="font-size:13px;">
                        Enregistrer
                    </button>
                    <span style="color:#8896AB;font-size:12px;">Plage : 1 – 500 Mo</span>
                </div>
            </div>
        ` : '';

        const renderImportLimits = () => geometryMaxRow ? `
            <div style="margin-bottom: 32px;">
                <h3 style="margin:0 0 8px;color:#202B5D;">Limites d'import</h3>
                <p style="color:#62718D;font-size:13px;margin:0 0 16px;">
                    Nombre maximum de features (entités géographiques) qu'un utilisateur peut importer en une seule fois via un fichier GeoJSON. Au-delà, il devra splitter son fichier. Le changement est pris en compte immédiatement.
                </p>
                <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
                    <label for="cfg-geometry-max" style="color:#202B5D;font-weight:600;">Max features par import</label>
                    <input type="number" id="cfg-geometry-max" min="1" max="50000" step="100"
                           value="${geometryMax}"
                           style="width:110px;padding:8px 10px;border:1px solid #dce3ed;border-radius:6px;font-size:14px;outline:none;" />
                    <button class="btn btn-primary"
                            onclick="AdminPage.saveGeometryMaxFeatures(${geometryMaxRow.id})"
                            style="font-size:13px;">
                        Enregistrer
                    </button>
                    <span style="color:#8896AB;font-size:12px;">Plage : 1 – 50 000</span>
                </div>
            </div>
        ` : '';

        return `
            <div class="card">
                <h2 style="margin-bottom:24px;">Configuration des listes</h2>
                <p style="color:#62718D;margin-bottom:24px;">Gérez les types et statuts disponibles dans les formulaires.</p>
                ${renderTable('Types de mesure', 'measure_type', types)}
                ${renderTable('Statuts de mesure', 'measure_status', statuses)}
                ${renderMapLayers()}
                ${renderUploadLimits()}
                ${renderImportLimits()}
            </div>
        `;
    },

    async saveMaxFileSize(id) {
        const input = document.getElementById('cfg-max-file-size');
        const mb = parseInt(input.value, 10);
        if (!Number.isFinite(mb) || mb < 1 || mb > 500) {
            Toast.warning('Valeur invalide (1 – 500).');
            return;
        }
        try {
            await API.config.update(id, { label: String(mb) });
            const item = this.data.configItems.find(c => c.id === id);
            if (item) item.label = String(mb);
            Toast.success(`Taille max upload : ${mb} Mo.`);
        } catch (err) {
            Toast.error('Erreur : ' + (err.message || 'Impossible de mettre à jour'));
        }
    },

    async saveGeometryMaxFeatures(id) {
        const input = document.getElementById('cfg-geometry-max');
        const n = parseInt(input.value, 10);
        if (!Number.isFinite(n) || n < 1 || n > 50000) {
            Toast.warning('Valeur invalide (1 – 50 000).');
            return;
        }
        try {
            await API.config.update(id, { label: String(n) });
            const item = this.data.configItems.find(c => c.id === id);
            if (item) item.label = String(n);
            Toast.success(`Max features par import : ${n}.`);
        } catch (err) {
            Toast.error('Erreur : ' + (err.message || 'Impossible de mettre à jour'));
        }
    },

    async toggleMapLayer(id, isActive) {
        try {
            await API.config.update(id, { is_active: isActive });
            const item = this.data.configItems.find(c => c.id === id);
            if (item) item.is_active = isActive;
            Toast.success(isActive ? 'Fond de carte activé.' : 'Fond de carte désactivé.');
        } catch (err) {
            Toast.error('Erreur: ' + (err.message || 'Impossible de mettre à jour'));
            // Recharger la liste pour refléter l'état réel
            try {
                const res = await API.config.getAll();
                this.data.configItems = res.data || [];
                document.getElementById('admin-content').innerHTML = this.renderConfig();
            } catch {}
        }
    },

    async saveMapLayer(id) {
        const kind = document.getElementById(`ml-kind-${id}`)?.value || 'xyz';
        const url = (document.getElementById(`ml-url-${id}`)?.value || '').trim();
        const attribution = (document.getElementById(`ml-attr-${id}`)?.value || '').trim();
        const apiKey = (document.getElementById(`ml-key-${id}`)?.value || '').trim();

        if (!url) { Toast.warning('URL requise.'); return; }
        if (kind === 'xyz' && !/\{z\}|\{x\}|\{y\}/.test(url)) {
            Toast.warning('URL XYZ doit contenir {z}/{x}/{y}.');
            return;
        }

        const item = this.data.configItems.find(c => c.id === id);
        const newMeta = { ...(item?.metadata || {}), kind, url, attribution };
        if (apiKey) newMeta.api_key = apiKey; else delete newMeta.api_key;

        try {
            await API.config.update(id, { metadata: newMeta });
            if (item) item.metadata = newMeta;
            Toast.success('Fond de carte enregistré (rechargez la page pour voir l\'effet sur la carte).');
        } catch (err) {
            Toast.error('Erreur : ' + (err.message || 'sauvegarde échouée'));
        }
    },

    addMapLayer() {
        Toast.prompt('Identifiant du nouveau fond (sans espaces, ex: tiles_cngiri) :', '').then(value => {
            if (!value) return;
            const code = String(value).trim().toLowerCase().replace(/[^a-z0-9_-]/g, '_');
            if (!code) { Toast.warning('Identifiant invalide.'); return; }
            return Toast.prompt('Libellé affiché :', code).then(async (label) => {
                if (!label) return;
                try {
                    await API.config.create({
                        category: 'map_layers',
                        value: code,
                        label: String(label).trim(),
                        sort_order: 99,
                        metadata: { kind: 'xyz', url: '', attribution: '' }
                    });
                    const res = await API.config.getAll();
                    this.data.configItems = res.data || [];
                    document.getElementById('admin-content').innerHTML = this.renderConfig();
                    Toast.success('Fond ajouté. Configure son URL puis active-le.');
                } catch (err) {
                    Toast.error('Erreur : ' + (err.message || 'création échouée'));
                }
            });
        });
    },

    deleteMapLayer(id, value) {
        Toast.confirm(`Supprimer le fond de carte "${value}" ? Cette action est irréversible.`, async () => {
            try {
                await API.config.delete(id);
                this.data.configItems = this.data.configItems.filter(c => c.id !== id);
                document.getElementById('admin-content').innerHTML = this.renderConfig();
                Toast.success('Fond supprimé.');
            } catch (err) {
                Toast.error('Erreur : ' + (err.message || 'suppression échouée'));
            }
        }, { type: 'danger', confirmText: 'Supprimer' });
    },

    addConfigItem(category) {
        const title = category === 'measure_type' ? 'Nouveau type de mesure' : 'Nouveau statut de mesure';
        const modal = document.createElement('div');
        modal.className = 'confirm-overlay confirm-visible';
        modal.innerHTML = `
            <div class="confirm-dialog" style="text-align:left;max-width:450px;">
                <h3 style="margin-bottom:20px;color:#202B5D;">${title}</h3>
                <div class="form-group">
                    <label>Valeur (identifiant)</label>
                    <input type="text" id="cfg-value" class="form-control" placeholder="ex: pompage">
                </div>
                <div class="form-group">
                    <label>Libellé (affiché)</label>
                    <input type="text" id="cfg-label" class="form-control" placeholder="ex: Pompage">
                </div>
                <div class="form-group">
                    <label>Ordre d'affichage</label>
                    <input type="number" id="cfg-order" class="form-control" value="0">
                </div>
                <div class="confirm-actions" style="margin-top:20px;">
                    <button class="confirm-btn confirm-btn-cancel" onclick="this.closest('.confirm-overlay').remove()">Annuler</button>
                    <button class="confirm-btn confirm-btn-ok" style="background:#3794C4;" onclick="AdminPage.saveNewConfigItem('${category}')">Enregistrer</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    },

    async saveNewConfigItem(category) {
        const value = document.getElementById('cfg-value').value.trim();
        const label = document.getElementById('cfg-label').value.trim();
        const sort_order = parseInt(document.getElementById('cfg-order').value) || 0;

        if (!value || !label) { Toast.warning('Valeur et libellé requis.'); return; }

        try {
            await API.config.create({ category, value, label, sort_order });
            document.querySelector('.confirm-overlay').remove();
            Toast.success('Élément ajouté.');
            // Refresh config data and re-render
            const res = await API.config.getAll();
            this.data.configItems = res.data || [];
            document.getElementById('admin-content').innerHTML = this.renderConfig();
        } catch (err) {
            Toast.error('Erreur: ' + (err.message || 'Erreur inconnue'));
        }
    },

    editConfigItem(id, category) {
        const item = this.data.configItems.find(c => c.id === id);
        if (!item) return;

        const modal = document.createElement('div');
        modal.className = 'confirm-overlay confirm-visible';
        modal.innerHTML = `
            <div class="confirm-dialog" style="text-align:left;max-width:450px;">
                <h3 style="margin-bottom:20px;color:#202B5D;">Modifier</h3>
                <div class="form-group">
                    <label>Valeur</label>
                    <input type="text" id="cfg-edit-value" class="form-control" value="${item.value}">
                </div>
                <div class="form-group">
                    <label>Libellé</label>
                    <input type="text" id="cfg-edit-label" class="form-control" value="${item.label}">
                </div>
                <div class="form-group">
                    <label>Ordre</label>
                    <input type="number" id="cfg-edit-order" class="form-control" value="${item.sort_order}">
                </div>
                <div class="form-group">
                    <label><input type="checkbox" id="cfg-edit-active" ${item.is_active ? 'checked' : ''}> Actif</label>
                </div>
                <div class="confirm-actions" style="margin-top:20px;">
                    <button class="confirm-btn confirm-btn-cancel" onclick="this.closest('.confirm-overlay').remove()">Annuler</button>
                    <button class="confirm-btn confirm-btn-ok" style="background:#3794C4;" onclick="AdminPage.saveEditConfigItem(${id})">Enregistrer</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    },

    async saveEditConfigItem(id) {
        const value = document.getElementById('cfg-edit-value').value.trim();
        const label = document.getElementById('cfg-edit-label').value.trim();
        const sort_order = parseInt(document.getElementById('cfg-edit-order').value) || 0;
        const is_active = document.getElementById('cfg-edit-active').checked;

        if (!value || !label) { Toast.warning('Valeur et libellé requis.'); return; }

        try {
            await API.config.update(id, { value, label, sort_order, is_active });
            document.querySelector('.confirm-overlay').remove();
            Toast.success('Élément modifié.');
            const res = await API.config.getAll();
            this.data.configItems = res.data || [];
            document.getElementById('admin-content').innerHTML = this.renderConfig();
        } catch (err) {
            Toast.error('Erreur: ' + (err.message || 'Erreur inconnue'));
        }
    },

    deleteConfigItem(id) {
        Toast.confirm('Supprimer cet élément de configuration ?', async () => {
            try {
                await API.config.delete(id);
                Toast.success('Élément supprimé.');
                const res = await API.config.getAll();
                this.data.configItems = res.data || [];
                document.getElementById('admin-content').innerHTML = this.renderConfig();
            } catch (err) {
                Toast.error('Erreur: ' + (err.message || 'Erreur inconnue'));
            }
        }, { type: 'danger', confirmText: 'Supprimer' });
    },

    // === Gestion des Seeds ===
    
    async resetDatabase() {
        Toast.confirm('ATTENTION\n\nCette action va SUPPRIMER TOUTES les données de la base de données !\n\nÊtes-vous absolument sûr de vouloir continuer ?', () => {
            Toast.confirm('Dernière confirmation : Toutes les données seront perdues. Continuer ?', async () => {
                try {
                    const loadingDiv = document.createElement('div');
                    loadingDiv.className = 'loading-overlay';
                    loadingDiv.innerHTML = '<div class="loading"></div><div style="color: #1e3c72; margin-top: 20px; font-weight: 600;">Suppression en cours...</div>';
                    document.body.appendChild(loadingDiv);

                    const response = await API.seed.reset();

                    loadingDiv.remove();

                    if (response.success) {
                        Toast.success('Base de données vidée avec succès !');
                        window.location.reload();
                    }
                } catch (error) {
                    document.querySelector('.loading-overlay')?.remove();
                    Toast.error('Erreur: ' + error.message);
                }
            }, { type: 'danger', confirmText: 'Confirmer la suppression' });
        }, { type: 'danger', confirmText: 'Vider la base' });
    },

    async populateDatabase() {
        Toast.confirm('Voulez-vous remplir la base de données avec les données initiales ?\n\n- 6 structures\n- 6 utilisateurs\n- 6 projets\n- Sites, mesures, etc.', async () => {
            try {
                const loadingDiv = document.createElement('div');
                loadingDiv.className = 'loading-overlay';
                loadingDiv.innerHTML = '<div class="loading"></div><div style="color: #1e3c72; margin-top: 20px; font-weight: 600;">Remplissage en cours...</div>';
                document.body.appendChild(loadingDiv);

                const response = await API.seed.populate();

                loadingDiv.remove();

                if (response.success) {
                    const summary = response.data;
                    Toast.success(`Base de données remplie avec succès !\n\n` +
                          `Résumé :\n` +
                          `- Structures: ${summary.structures}\n` +
                          `- Utilisateurs: ${summary.users}\n` +
                          `- Projets: ${summary.projects}\n` +
                          `- Sites: ${summary.sites}\n` +
                          `- Mesures: ${summary.measures}\n` +
                          `- Parties prenantes: ${summary.stakeholders}\n` +
                          `- Financements: ${summary.financing}\n` +
                          `- Formulaires: ${summary.forms}`);
                    window.location.reload();
                }
            } catch (error) {
                document.querySelector('.loading-overlay')?.remove();
                Toast.error('Erreur: ' + error.message);
            }
        }, { confirmText: 'Remplir' });
    },

    async resetAndPopulate() {
        Toast.confirm('Cette action va :\n\n1. SUPPRIMER toutes les données actuelles\n2. REMPLIR la base avec les données initiales\n\nContinuer ?', async () => {
            try {
                const loadingDiv = document.createElement('div');
                loadingDiv.className = 'loading-overlay';
                loadingDiv.innerHTML = '<div class="loading"></div><div style="color: #1e3c72; margin-top: 20px; font-weight: 600;">Réinitialisation en cours...</div>';
                document.body.appendChild(loadingDiv);

                const response = await API.seed.resetAndPopulate();

                loadingDiv.remove();

                if (response.success) {
                    const summary = response.data;
                    Toast.success(`Base de données réinitialisée avec succès !\n\n` +
                          `Données insérées :\n` +
                          `- Structures: ${summary.structures}\n` +
                          `- Utilisateurs: ${summary.users}\n` +
                          `- Projets: ${summary.projects}\n` +
                          `- Sites: ${summary.sites}\n` +
                          `- Mesures: ${summary.measures}\n` +
                          `- Parties prenantes: ${summary.stakeholders}\n` +
                          `- Financements: ${summary.financing}\n` +
                          `- Formulaires: ${summary.forms}\n\n` +
                          `Comptes par défaut :\n` +
                          `Admin: admin / mha@2024\n` +
                          `Directeur: directeur / mha@2024\n` +
                          `Utilisateurs: user_dpgi, user_onas, etc. / mha@2024`);
                    window.location.reload();
                }
            } catch (error) {
                document.querySelector('.loading-overlay')?.remove();
                Toast.error('Erreur: ' + error.message);
            }
        }, { type: 'danger', confirmText: 'Réinitialiser' });
    }
};

