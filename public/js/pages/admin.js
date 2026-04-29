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
        const section = (title, body) => `
            <div style="margin-bottom:32px;">
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

        return `
            <div class="card" style="padding:30px;line-height:1.6;">
                <div style="background:linear-gradient(135deg,#202B5D 0%,#3794C4 100%);color:white;padding:24px;border-radius:10px;margin-bottom:32px;">
                    <h1 style="margin:0 0 8px 0;color:white;">📖 Documentation CNGIRI</h1>
                    <p style="margin:0;opacity:0.9;">Guide de référence des rôles, entités et concepts de la plateforme.</p>
                </div>

                ${section('🎯 Mission de la plateforme', `
                    <p>La plateforme <strong>CNGIRI</strong> (Comité National de Gestion Intégrée du Risque d'Inondation) centralise
                    le suivi des projets, mesures et interventions liés à la gestion des inondations au Sénégal. Elle fait travailler
                    ensemble les structures techniques (ONAS, BNSP, DPGI…), le commandement territorial (Gouverneurs, Préfets, Sous-préfets)
                    et la tutelle ministérielle.</p>
                `)}

                ${section('👥 Rôles utilisateur', `
                    <p>La plateforme définit <strong>7 rôles</strong>. Chaque utilisateur a exactement un rôle, ce qui détermine ce qu'il voit et peut faire.</p>
                    ${table(
                        ['Rôle', 'Persona', 'Voit', 'Peut créer / modifier'],
                        [
                            ['<strong>Admin</strong>', 'Administrateur système', 'Tout', 'Utilisateurs, structures, configuration, clés API, tous projets'],
                            ['<strong>Superviseur</strong>', 'Ministre / cabinet', 'Tous les projets', 'Observations (directives adressées aux structures)'],
                            ['<strong>Commandement Territorial</strong>', 'Gouverneur (région) · Préfet (département) · Sous-préfet (arrondissement)', 'Projets de son territoire uniquement', 'PV de visite liés à son territoire'],
                            ['<strong>Directeur</strong>', 'Directeur de structure (ex. DG ONAS)', 'Projets de sa structure', 'Projets de sa structure, assignations de mesures'],
                            ['<strong>Utilisateur</strong>', 'Agent opérationnel d\'une structure', 'Projets de sa structure', 'Projets de sa structure, mise à jour statut des mesures qui lui sont assignées'],
                            ['<strong>Auditeur</strong> 🔍', 'Cour des Comptes · IGE · Bailleur (BM, BAD, AFD) · Conseiller', 'Tout (y compris données financières) — scopable sur une structure', '<em>Rien</em> — lecture seule. Peut exporter Excel et générer rapport IA.'],
                            ['<strong>Lecteur</strong> 👁', 'Communicant · journaliste accrédité · personnel interne · visiteur', 'Tout SAUF les montants financiers — scopable sur une structure', '<em>Rien</em> — lecture seule, pas d\'export, pas de rapport IA.']
                        ]
                    )}
                    <p style="background:#fff8e1;border-left:3px solid #f39c12;padding:10px;font-size:12px;">
                        <strong>Note :</strong> le Superviseur et le Commandement Territorial n'appartiennent à <em>aucune</em> structure technique — ils observent et pilotent.
                        Les rôles <strong>Auditeur</strong> et <strong>Lecteur</strong> sont des profils de lecture seule : aucune écriture possible, quel que soit le contexte.
                    </p>
                    <p style="background:#e0f2fe;border-left:3px solid #3794C4;padding:10px;font-size:12px;">
                        <strong>Scope global vs. scope structure :</strong> pour <code>lecteur</code> et <code>auditeur</code>, le champ <em>Structure</em> au moment de la création de l'utilisateur détermine la portée.
                        <br>• <strong>Sans structure</strong> → lecteur/auditeur <em>global</em> : voit tous les projets, toutes les structures.
                        <br>• <strong>Avec une structure</strong> → lecteur/auditeur <em>scopé</em> : ne voit que les projets et PV rattachés à cette structure. Exemple : un bailleur AFD qui finance uniquement des projets ONAS → rôle <em>auditeur</em> scopé sur ONAS.
                    </p>
                `)}

                ${section('⭐ Le « Chef de projet »', `
                    <p><strong>Ce n'est pas un rôle</strong>, mais une <em>désignation</em> faite sur un projet (champ
                    <code>project_manager_id</code>). N'importe quel utilisateur ou directeur peut être désigné chef de projet au moment
                    de la création du projet.</p>
                    ${table(
                        ['Action', 'Chef de projet', 'Utilisateur lambda', 'Admin'],
                        [
                            ['Assigner un utilisateur à une mesure', '✅', '❌', '✅'],
                            ['Réassigner une mesure (structure + utilisateur)', '✅', '❌', '✅'],
                            ['Modifier le statut d\'une mesure', '✅ (toutes)', '✅ uniquement celles qui lui sont assignées', '✅'],
                            ['Modifier les infos du projet', '✅ (s\'il est de la structure)', '✅ (s\'il est de la structure)', '✅']
                        ]
                    )}
                `)}

                ${section('🏢 Structures', `
                    <p>Les <strong>structures</strong> sont les organismes publics qui portent les projets CNGIRI. Chaque utilisateur
                    (hors admin/superviseur/commandement) appartient à <em>une</em> structure et ne voit que les projets qui lui sont rattachés.</p>
                    ${table(
                        ['Code', 'Nom complet', 'Rôle métier'],
                        [
                            ['<strong>DPGI</strong>', 'Direction de la Prévention et de la Gestion des Inondations', 'Coordination / prévention'],
                            ['<strong>ONAS</strong>', 'Office National de l\'Assainissement du Sénégal', 'Assainissement, eaux usées, drainage'],
                            ['<strong>BNSP</strong>', 'Brigade Nationale des Sapeurs-Pompiers', 'Interventions d\'urgence et secours'],
                            ['<strong>CETUD</strong>', 'Conseil Exécutif des Transports Urbains de Dakar', 'Infrastructures de transport urbain'],
                            ['<strong>AGEROUTE</strong>', 'Agence des Travaux et de Gestion des Routes', 'Entretien et gestion du réseau routier'],
                            ['<strong>DPC</strong>', 'Direction de la Protection Civile', 'Coordination de la protection civile']
                        ]
                    )}
                    <p style="font-size:12px;color:#62718D;">Un projet a une structure <strong>principale</strong>, plus éventuellement des structures <strong>secondaires</strong> qui y contribuent.</p>
                `)}

                ${section('📦 Projet', `
                    <p>Un <strong>projet</strong> est une initiative de gestion des inondations : travaux de drainage, renforcement
                    de capacités, construction d'ouvrages, etc.</p>
                    <ul>
                        <li><strong>Statut</strong> : <em>Démarrage</em> → <em>En cours</em> → <em>Terminé</em> (ou <em>En retard</em>, <em>Annulé</em>).</li>
                        <li><strong>Priorité</strong> : Normale, Haute, Urgente.</li>
                        <li><strong>Type</strong> : <em>Renforcement de la résilience</em> ou <em>Structurant</em>.</li>
                        <li><strong>Avancement</strong> (%) calculé à partir des mesures réalisées.</li>
                        <li>Budget, dates de début / échéance, chef de projet désigné.</li>
                        <li>Contient plusieurs <em>sites</em>, plusieurs <em>localités</em>, plusieurs <em>mesures</em>.</li>
                    </ul>
                `)}

                ${section('🔧 Action / Mesure', `
                    <p>Une <strong>mesure</strong> est une action concrète à mener sur un projet, attribuée à une structure et
                    éventuellement à un utilisateur précis.</p>
                    <ul>
                        <li><strong>Types</strong> : Pompage, Nettoyage, Curage, Équipement, Organisation, Construction, Réhabilitation, Autre.</li>
                        <li><strong>Statuts</strong> : <em>Préconisée</em> → <em>Exécutée</em> (ou <em>Non exécutée</em>, <em>Observations</em>).</li>
                        <li>Chaque mesure est assignée à une <strong>structure</strong> (qui exécute) et optionnellement à un <strong>utilisateur</strong>.</li>
                        <li>Peut être rattachée à un <strong>site</strong> précis.</li>
                        <li>Des commentaires peuvent être ajoutés pour traçabilité.</li>
                    </ul>
                    <p style="background:#e3f2fd;border-left:3px solid #3794C4;padding:10px;font-size:12px;">
                        C'est le grain le plus fin du suivi : c'est au niveau des mesures que les utilisateurs déclarent l'exécution du travail.
                    </p>
                `)}

                ${section('📍 Localité & Site', `
                    <p><strong>Localité</strong> = zone administrative liée au projet (Région → Département → Arrondissement → Commune).
                    Le découpage administratif du Sénégal est pré-chargé en base.</p>
                    <p><strong>Site</strong> = lieu d'intervention concret, géolocalisé (latitude / longitude), rattaché à un projet
                    et optionnellement à une localité. Un site peut être marqué comme <em>PCS</em> (Plan Communal de Sauvegarde).
                    Les sites s'affichent sur la carte du tableau de bord.</p>
                `)}

                ${section('🗣️ Observations (Ministre)', `
                    <p>Fonctionnalité exclusive du rôle <strong>Superviseur</strong> (= Ministre). Les observations sont des
                    <strong>directives</strong> adressées aux structures ou à un projet en particulier :</p>
                    <ul>
                        <li><strong>Priorité</strong> : Info, Importante, Urgente.</li>
                        <li>Peuvent avoir une <strong>échéance</strong> (deadline).</li>
                        <li>Peuvent être <em>globales</em> (visibles par tous) ou liées à un <em>projet précis</em>.</li>
                        <li>Un badge compte les observations non lues par chaque utilisateur.</li>
                        <li>Apparaissent en bannière en haut du tableau de bord.</li>
                    </ul>
                `)}

                ${section('📋 PV du Commandement Territorial', `
                    <p>Le <strong>Commandement Territorial</strong> regroupe les autorités déconcentrées qui supervisent le terrain :</p>
                    ${table(
                        ['Niveau territorial', 'Autorité', 'Champ <code>territorial_level</code>'],
                        [
                            ['Région', 'Gouverneur', '<code>region</code>'],
                            ['Département', 'Préfet', '<code>departement</code>'],
                            ['Arrondissement', 'Sous-préfet', '<code>arrondissement</code>']
                        ]
                    )}
                    <p>Un <strong>PV</strong> (procès-verbal de visite) est un compte-rendu structuré :</p>
                    <ul>
                        <li><strong>Date de visite</strong>, titre, priorité.</li>
                        <li><strong>Avancement constaté</strong> sur le terrain.</li>
                        <li><strong>Observations</strong> et <strong>recommandations</strong>.</li>
                        <li>Référence aux projets / mesures / sites / localités visités.</li>
                        <li>Peut avoir des pièces jointes (photos, documents).</li>
                    </ul>
                `)}

                ${section('📝 Formulaires', `
                    <p>Les <strong>formulaires</strong> permettent aux administrateurs de créer des questionnaires dynamiques assignés
                    à une structure. Les utilisateurs de cette structure les remplissent (<strong>soumissions</strong>) pour collecter
                    des données structurées hors du modèle projet/mesure classique.</p>
                `)}

                ${section('🔑 Clés API', `
                    <p>Onglet <strong>Clés API</strong> : l'admin peut créer des clés d'accès pour des intégrations externes
                    (monitoring, exports automatisés, etc.). Chaque clé est liée à un rôle et expire à une date définie.</p>
                `)}

                ${section('🔐 Qui voit quoi — résumé', `
                    ${table(
                        ['Entité', 'Admin / Superviseur', 'Auditeur', 'Lecteur', 'Commandement Territorial', 'Directeur / Utilisateur'],
                        [
                            ['Projets', 'Tous', 'Tous', 'Tous', 'Ceux de son territoire', 'Ceux de sa structure'],
                            ['Montants / Budgets', '✅', '✅', '🔒 masqué', '✅', '✅'],
                            ['Mesures', 'Toutes', 'Toutes', 'Toutes', 'Via projets visibles', 'Via projets visibles'],
                            ['Observations Ministre', 'Toutes', 'Toutes', 'Toutes', 'Globales ou de ses projets', 'Globales ou de ses projets'],
                            ['PV Commandement', 'Tous', 'Tous', 'Tous', 'Les siens + ceux de son niveau', 'Ceux liés à ses projets'],
                            ['Export Excel + Rapport IA', '✅', '✅', '❌', '✅', '✅'],
                            ['Créer / modifier / supprimer', '✅ (selon scope)', '❌', '❌', '✅ (PV)', '✅ (ses projets)'],
                            ['Section Administration', 'Admin uniquement', '❌', '❌', '❌', '❌']
                        ]
                    )}
                `)}

                <div style="background:#f0f4f8;padding:16px;border-radius:8px;margin-top:32px;font-size:12px;color:#62718D;text-align:center;">
                    Documentation générée à partir de la structure actuelle de la plateforme. Si un rôle, une structure ou un processus évolue, pense à mettre à jour cet onglet dans <code>public/js/pages/admin.js</code>.
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
                <div class="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th style="width:40px;"></th>
                                <th>Libellé</th>
                                <th>Identifiant</th>
                                <th>Ordre</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${mapLayers.map(item => `
                                <tr>
                                    <td>
                                        <input type="checkbox" ${item.is_active ? 'checked' : ''}
                                               onchange="AdminPage.toggleMapLayer(${item.id}, this.checked)"
                                               style="width:16px;height:16px;cursor:pointer;">
                                    </td>
                                    <td>${item.label}</td>
                                    <td><code style="background:#f0f4f8;padding:2px 8px;border-radius:4px;font-size:12px;">${item.value}</code></td>
                                    <td>${item.sort_order}</td>
                                </tr>
                            `).join('')}
                            ${mapLayers.length === 0 ? '<tr><td colspan="4" style="text-align:center;color:#8896AB;">Aucun fond de carte configuré (redémarrer le backend pour seeder)</td></tr>' : ''}
                        </tbody>
                    </table>
                </div>
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

