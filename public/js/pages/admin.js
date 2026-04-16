// Page Administration

const AdminPage = {
    data: {
        users: [],
        structures: []
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
        const [users, structures] = await Promise.all([
            API.users.getAll(),
            API.structures.getAll()
        ]);

        this.data.users = users.data;
        this.data.structures = structures.data;
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

