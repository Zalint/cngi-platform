// Page Administration

const AdminPage = {
    data: {
        users: [],
        structures: [],
        configItems: []
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
                    </div>
                    <div style="display: flex; gap: 12px;">
                        <button class="btn btn-danger" onclick="AdminPage.resetDatabase()" style="background: #ea4335;">
                            🗑️ Vider la base
                        </button>
                        <button class="btn btn-success" onclick="AdminPage.populateDatabase()">
                            🌱 Remplir la base
                        </button>
                        <button class="btn btn-primary" onclick="AdminPage.resetAndPopulate()">
                            🔄 Réinitialiser
                        </button>
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
        Toast.info('Fonctionnalité de création de structure en cours de développement');
    },

    editStructure(id) {
        Toast.info('Fonctionnalité de modification de structure en cours de développement');
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

