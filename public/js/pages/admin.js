// Page Administration

const AdminPage = {
    data: {
        users: [],
        structures: [],
        configItems: [],
        apiKeys: []
    },

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
                        <button class="btn-icon" onclick="AdminPage.editUser(${user.id})" title="Modifier">✏️</button>
                        <button class="btn-icon" onclick="AdminPage.deleteUser(${user.id})" title="Supprimer">🗑️</button>
                    </div>
                </td>
            </tr>
        `).join('');

        return `
            <div class="card">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;">
                    <h2>Gestion des utilisateurs</h2>
                    <button class="btn btn-primary" onclick="AdminPage.createUser()">
                        ➕ Nouvel utilisateur
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
                        <button class="btn-icon" onclick="AdminPage.editStructure(${structure.id})" title="Modifier">✏️</button>
                        <button class="btn-icon" onclick="AdminPage.deleteStructure(${structure.id})" title="Supprimer">🗑️</button>
                    </div>
                </td>
            </tr>
        `).join('');

        return `
            <div class="card">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;">
                    <h2>Gestion des structures</h2>
                    <button class="btn btn-primary" onclick="AdminPage.createStructure()">
                        ➕ Nouvelle structure
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

    getRoleLabel(role) {
        const labels = {
            'admin': 'Administrateur',
            'utilisateur': 'Utilisateur',
            'directeur': 'Directeur'
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
                
                if (tabName === 'users') {
                    content.innerHTML = this.renderUsers();
                } else if (tabName === 'structures') {
                    content.innerHTML = this.renderStructures();
                } else if (tabName === 'config') {
                    content.innerHTML = this.renderConfig();
                } else if (tabName === 'api-keys') {
                    this.loadApiKeys().then(() => {
                        content.innerHTML = this.renderApiKeys();
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
                            <button class="btn-icon" onclick="AdminPage.deleteApiKey(${k.id})" title="Supprimer">🗑️</button>
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
                    <button class="btn btn-primary" onclick="AdminPage.createApiKey()">➕ Nouvelle clé</button>
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

        return `
            <div class="card">
                <h2 style="margin-bottom:24px;">Configuration des listes</h2>
                <p style="color:#62718D;margin-bottom:24px;">Gérez les types et statuts disponibles dans les formulaires.</p>
                ${renderTable('Types de mesure', 'measure_type', types)}
                ${renderTable('Statuts de mesure', 'measure_status', statuses)}
            </div>
        `;
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

