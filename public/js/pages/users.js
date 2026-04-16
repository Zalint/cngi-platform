const UsersPage = {
    data: {
        users: [],
        structures: [],
        editingUser: null
    },

    async render() {
        try {
            const [usersResponse, structuresResponse] = await Promise.all([
                API.users.getAll(),
                API.structures.getAll()
            ]);
            
            this.data.users = usersResponse.data;
            this.data.structures = structuresResponse.data;

            return `
                ${Navbar.render()}
                <div class="main-content with-sidebar">
                    ${Navbar.renderTopBar('Gestion des utilisateurs')}
                    <div class="content-area">
                        <div class="card">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;">
                                <h2 style="margin: 0;">Liste des utilisateurs</h2>
                                ${Auth.hasRole('admin') ? `
                                    <button class="btn btn-primary" onclick="UsersPage.showCreateModal()">
                                        ➕ Nouvel utilisateur
                                    </button>
                                ` : ''}
                            </div>

                            <div class="table-responsive">
                                <table class="table">
                                    <thead>
                                        <tr>
                                            <th>Username</th>
                                            <th>Email</th>
                                            <th>Nom complet</th>
                                            <th>Rôle</th>
                                            <th>Structure</th>
                                            <th>Statut</th>
                                            ${Auth.hasRole('admin') ? '<th>Actions</th>' : ''}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${this.data.users.map(user => `
                                            <tr>
                                                <td>${user.username}</td>
                                                <td>${user.email}</td>
                                                <td>${user.first_name} ${user.last_name || ''}</td>
                                                <td>${this.getRoleLabel(user.role)}</td>
                                                <td>${user.structure_name || 'N/A'}</td>
                                                <td>
                                                    ${user.is_active ? 
                                                        '<span style="color: #4caf50;">✓ Actif</span>' : 
                                                        '<span style="color: #999;">○ Inactif</span>'}
                                                </td>
                                                ${Auth.hasRole('admin') ? `
                                                    <td>
                                                        <button class="btn-icon" onclick="UsersPage.editUser(${user.id})" title="Modifier">
                                                            ✏️
                                                        </button>
                                                        <button class="btn-icon" onclick="UsersPage.deleteUser(${user.id})" title="Supprimer">
                                                            🗑️
                                                        </button>
                                                    </td>
                                                ` : ''}
                                            </tr>
                                        `).join('')}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Modal Create/Edit User -->
                <div id="userModal" class="modal" style="display: none;">
                    <div class="modal-content" style="max-width: 600px;">
                        <div class="modal-header">
                            <h3 id="modalTitle">Nouvel utilisateur</h3>
                            <button class="modal-close" onclick="UsersPage.closeModal()">&times;</button>
                        </div>
                        <form id="userForm" onsubmit="UsersPage.saveUser(event)">
                            <div class="modal-body">
                                <div class="form-group">
                                    <label>Username *</label>
                                    <input type="text" id="username" class="form-control" required>
                                </div>

                                <div class="form-group">
                                    <label>Email *</label>
                                    <input type="email" id="email" class="form-control" required>
                                </div>

                                <div class="form-group">
                                    <label>Mot de passe <span id="passwordRequired">*</span></label>
                                    <input type="password" id="password" class="form-control">
                                    <small id="passwordHint" style="color: #666;"></small>
                                </div>

                                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
                                    <div class="form-group">
                                        <label>Prénom *</label>
                                        <input type="text" id="first_name" class="form-control" required>
                                    </div>

                                    <div class="form-group">
                                        <label>Nom</label>
                                        <input type="text" id="last_name" class="form-control">
                                    </div>
                                </div>

                                <div class="form-group">
                                    <label>Rôle *</label>
                                    <select id="role" class="form-control" required onchange="UsersPage.onRoleChange(this.value)">
                                        <option value="">-- Sélectionner un rôle --</option>
                                        <option value="admin">Administrateur</option>
                                        <option value="utilisateur">Utilisateur</option>
                                        <option value="directeur">Directeur</option>
                                        <option value="superviseur">Superviseur</option>
                                        <option value="commandement_territorial">Commandement territorial</option>
                                    </select>
                                </div>

                                <div class="form-group" id="structure-group">
                                    <label>Structure</label>
                                    <select id="structure_id" class="form-control">
                                        <option value="">-- Aucune structure --</option>
                                        ${this.data.structures.map(s => `
                                            <option value="${s.id}">${s.name} (${s.code})</option>
                                        `).join('')}
                                    </select>
                                </div>

                                <div id="territorial-section" style="display:none;">
                                    <div class="form-group">
                                        <label>Niveau territorial *</label>
                                        <select id="territorial_level" class="form-control" onchange="UsersPage.onTerritorialLevelChange(this.value)">
                                            <option value="">-- Choisir le niveau --</option>
                                            <option value="region">Région</option>
                                            <option value="departement">Département</option>
                                            <option value="arrondissement">Arrondissement</option>
                                        </select>
                                    </div>
                                    <div class="form-group">
                                        <label>Territoire *</label>
                                        <select id="territorial_value" class="form-control">
                                            <option value="">-- Choisir --</option>
                                        </select>
                                    </div>
                                </div>

                                <div class="form-group">
                                    <label style="display: flex; align-items: center; cursor: pointer;">
                                        <input type="checkbox" id="is_active" style="margin-right: 8px;" checked>
                                        Utilisateur actif
                                    </label>
                                </div>
                            </div>
                            <div class="modal-footer">
                                <button type="button" class="btn btn-secondary" onclick="UsersPage.closeModal()">
                                    Annuler
                                </button>
                                <button type="submit" class="btn btn-primary">
                                    💾 Enregistrer
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            `;
        } catch (error) {
            console.error('Error loading users:', error);
            return `
                ${Navbar.render()}
                <div class="main-content with-sidebar">
                    ${Navbar.renderTopBar('Erreur')}
                    <div class="content-area">
                        <div class="alert alert-error">Erreur lors du chargement des utilisateurs</div>
                    </div>
                </div>
            `;
        }
    },

    getRoleLabel(role) {
        const labels = {
            'admin': 'Administrateur',
            'utilisateur': 'Utilisateur',
            'directeur': 'Directeur',
            'superviseur': 'Superviseur',
            'commandement_territorial': 'Commandement territorial'
        };
        return labels[role] || role;
    },

    onRoleChange(role) {
        const structureGroup = document.getElementById('structure-group');
        const territorialSection = document.getElementById('territorial-section');
        if (role === 'commandement_territorial') {
            if (structureGroup) structureGroup.style.display = 'none';
            if (territorialSection) territorialSection.style.display = 'block';
            document.getElementById('structure_id').value = '';
        } else {
            if (structureGroup) structureGroup.style.display = 'block';
            if (territorialSection) territorialSection.style.display = 'none';
        }
    },

    async onTerritorialLevelChange(level) {
        const valueSel = document.getElementById('territorial_value');
        if (!valueSel) return;
        valueSel.innerHTML = '<option value="">-- Choisir --</option>';
        if (!level) return;

        try {
            let items = [];
            if (level === 'region') {
                const res = await API.decoupage.getRegions();
                items = res.data || [];
            } else if (level === 'departement') {
                const regions = await API.decoupage.getRegions();
                for (const region of (regions.data || [])) {
                    const res = await API.decoupage.getDepartements(region);
                    items = items.concat(res.data || []);
                }
            } else if (level === 'arrondissement') {
                const regions = await API.decoupage.getRegions();
                for (const region of (regions.data || [])) {
                    const depts = await API.decoupage.getDepartements(region);
                    for (const dept of (depts.data || [])) {
                        const res = await API.decoupage.getArrondissements(dept);
                        items = items.concat(res.data || []);
                    }
                }
            }
            items.sort();
            items.forEach(item => {
                valueSel.innerHTML += `<option value="${item}">${item}</option>`;
            });
        } catch (err) {
            console.error('Error loading territorial values:', err);
        }
    },

    showCreateModal() {
        this.data.editingUser = null;
        document.getElementById('modalTitle').textContent = 'Nouvel utilisateur';
        document.getElementById('passwordRequired').style.display = 'inline';
        document.getElementById('password').required = true;
        document.getElementById('passwordHint').textContent = '';
        document.getElementById('userForm').reset();
        document.getElementById('is_active').checked = true;
        document.getElementById('userModal').style.display = 'flex';
    },

    async editUser(userId) {
        try {
            const response = await API.users.getById(userId);
            const user = response.data;
            this.data.editingUser = user;

            document.getElementById('modalTitle').textContent = 'Modifier l\'utilisateur';
            document.getElementById('passwordRequired').style.display = 'none';
            document.getElementById('password').required = false;
            document.getElementById('passwordHint').textContent = 'Laisser vide pour ne pas changer';

            document.getElementById('username').value = user.username;
            document.getElementById('email').value = user.email;
            document.getElementById('password').value = '';
            document.getElementById('first_name').value = user.first_name;
            document.getElementById('last_name').value = user.last_name || '';
            document.getElementById('role').value = user.role;
            document.getElementById('structure_id').value = user.structure_id || '';
            document.getElementById('is_active').checked = user.is_active;

            // Handle territorial fields for commandement_territorial
            this.onRoleChange(user.role);
            if (user.role === 'commandement_territorial') {
                document.getElementById('territorial_level').value = user.territorial_level || '';
                if (user.territorial_level) {
                    await this.onTerritorialLevelChange(user.territorial_level);
                    document.getElementById('territorial_value').value = user.territorial_value || '';
                }
            }

            document.getElementById('userModal').style.display = 'flex';
        } catch (error) {
            console.error('Error loading user:', error);
            Toast.error('Erreur lors du chargement de l\'utilisateur');
        }
    },

    closeModal() {
        document.getElementById('userModal').style.display = 'none';
        this.data.editingUser = null;
    },

    async saveUser(event) {
        event.preventDefault();

        const role = document.getElementById('role').value;
        const userData = {
            username: document.getElementById('username').value.trim(),
            email: document.getElementById('email').value.trim(),
            first_name: document.getElementById('first_name').value.trim(),
            last_name: document.getElementById('last_name').value.trim() || null,
            role: role,
            structure_id: role === 'commandement_territorial' ? null : (document.getElementById('structure_id').value || null),
            is_active: document.getElementById('is_active').checked,
            territorial_level: role === 'commandement_territorial' ? (document.getElementById('territorial_level').value || null) : null,
            territorial_value: role === 'commandement_territorial' ? (document.getElementById('territorial_value').value || null) : null
        };

        const password = document.getElementById('password').value;
        if (password) {
            userData.password = password;
        }

        try {
            if (this.data.editingUser) {
                // Update
                await API.users.update(this.data.editingUser.id, userData);
                Toast.success('Utilisateur modifié avec succès !');
            } else {
                // Create
                if (!password) {
                    Toast.warning('Le mot de passe est obligatoire pour créer un utilisateur.');
                    return;
                }
                await API.users.create(userData);
                Toast.success('Utilisateur créé avec succès !');
            }

            this.closeModal();
            window.location.reload();
        } catch (error) {
            console.error('Error saving user:', error);
            Toast.error('Erreur lors de l\'enregistrement: ' + (error.message || 'Erreur inconnue'));
        }
    },

    async deleteUser(userId) {
        Toast.confirm('Êtes-vous sûr de vouloir supprimer cet utilisateur ?', async () => {
            try {
                await API.users.delete(userId);
                Toast.success('Utilisateur supprimé avec succès !');
                window.location.reload();
            } catch (error) {
                console.error('Error deleting user:', error);
                Toast.error('Erreur lors de la suppression: ' + (error.message || 'Erreur inconnue'));
            }
        }, { type: 'danger', confirmText: 'Supprimer' });
    },

    afterRender() {
        Navbar.updateActiveMenu();
    }
};

