// Page de création/édition de projet simplifiée

const ProjectFormPage = {
    data: {
        project: null,
        structures: [],
        users: [],
        isEdit: false
    },

    async render(id = null) {
        try {
            this.data.isEdit = !!id;
            
            // Charger les structures
            const structuresResponse = await API.structures.getAll();
            this.data.structures = structuresResponse.data;

            // Charger tous les utilisateurs
            const usersResponse = await API.users.getAll();
            this.data.users = usersResponse.data;

            // Si mode édition, charger le projet
            if (id) {
                const projectResponse = await API.projects.getById(id);
                this.data.project = projectResponse.data;
            } else {
                this.data.project = null;
            }

            return `
                ${Navbar.render()}
                <div class="main-content with-sidebar">
                    ${Navbar.renderTopBar(this.data.isEdit ? 'Modifier le projet' : 'Nouveau projet')}
                    <div class="content-area">
                        ${this.renderForm()}
                    </div>
                </div>
            `;
        } catch (error) {
            console.error('Error loading project form:', error);
            return `<div class="alert alert-error">Erreur de chargement</div>`;
        }
    },

    renderForm() {
        const p = this.data.project;
        const user = Auth.getUser();
        
        // Si utilisateur, forcer sa structure
        const isUtilisateur = user.role === 'utilisateur';
        const defaultStructure = isUtilisateur ? user.structure_id : (p ? p.structure_id : '');

        const structureOptions = this.data.structures.map(s => 
            `<option value="${s.id}" ${defaultStructure == s.id ? 'selected' : ''}>${s.name} (${s.code})</option>`
        ).join('');

        return `
            <form id="project-form" onsubmit="event.preventDefault(); ProjectFormPage.saveProject();">
                <div class="card mb-4">
                    <h2 style="margin-bottom: 24px;">📋 Informations du projet</h2>
                    
                    <div class="form-group">
                        <label>Titre du projet *</label>
                        <input type="text" id="project-title" class="form-control" 
                               value="${p ? p.title : ''}" 
                               placeholder="Ex: Aménagement des bassins de rétention" required>
                    </div>

                    <div class="form-group">
                        <label>Description</label>
                        <textarea id="project-description" class="form-control" rows="4"
                                  placeholder="Description détaillée du projet...">${p ? p.description || '' : ''}</textarea>
                    </div>

                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px;">
                        <div class="form-group">
                            <label>Structure responsable principale *</label>
                            <select id="project-structure" class="form-control" ${isUtilisateur ? 'disabled' : ''} required onchange="ProjectFormPage.loadUsersForStructure()">
                                <option value="">Sélectionnez une structure</option>
                                ${structureOptions}
                            </select>
                            <small style="color: #666;">Les autres structures peuvent être assignées après création</small>
                        </div>

                        <div class="form-group">
                            <label>Chef de projet *</label>
                            <select id="project-manager" class="form-control" required>
                                <option value="">Sélectionnez d'abord une structure</option>
                            </select>
                            <small style="color: #666;">Utilisateur responsable du suivi du projet</small>
                        </div>
                    </div>

                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px;">
                        <div class="form-group">
                            <label>Statut</label>
                            <select id="project-status" class="form-control">
                                <option value="demarrage" ${p && p.status === 'demarrage' ? 'selected' : ''}>Démarrage</option>
                                <option value="en_cours" ${p && p.status === 'en_cours' ? 'selected' : ''}>En cours</option>
                                <option value="termine" ${p && p.status === 'termine' ? 'selected' : ''}>Terminé</option>
                                <option value="retard" ${p && p.status === 'retard' ? 'selected' : ''}>En retard</option>
                                <option value="annule" ${p && p.status === 'annule' ? 'selected' : ''}>Annulé</option>
                            </select>
                        </div>

                        <div class="form-group">
                            <!-- Vide pour alignement -->
                        </div>
                    </div>

                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px;">
                        <div class="form-group">
                            <label>Date de début</label>
                            <input type="date" id="project-start-date" class="form-control" 
                                   value="${p && p.start_date ? p.start_date : ''}">
                        </div>

                        <div class="form-group">
                            <label>Date d'échéance</label>
                            <input type="date" id="project-deadline" class="form-control" 
                                   value="${p && p.deadline_date ? p.deadline_date : ''}">
                        </div>
                    </div>

                    <div style="background: #e3f2fd; padding: 16px; border-radius: 8px; border-left: 4px solid #1976d2; margin-top: 20px;">
                        <p style="margin: 0; color: #1565c0;">
                            💡 <strong>Note:</strong> Les utilisateurs assignés pourront ensuite ajouter le budget, l'avancement, les localités, sites, mesures et autres détails dans la page de détail du projet.
                        </p>
                    </div>
                </div>

                <!-- Actions -->
                <div style="display: flex; gap: 12px; justify-content: flex-end;">
                    <a href="#/projects" class="btn btn-secondary">Annuler</a>
                    <button type="submit" class="btn btn-primary">
                        💾 ${this.data.isEdit ? 'Mettre à jour' : 'Créer le projet'}
                    </button>
                </div>
            </form>
        `;
    },

    loadUsersForStructure() {
        const structureId = parseInt(document.getElementById('project-structure').value);
        const projectManagerSelect = document.getElementById('project-manager');
        
        if (!structureId) {
            projectManagerSelect.innerHTML = '<option value="">Sélectionnez d\'abord une structure</option>';
            return;
        }

        // Filtrer les utilisateurs de la structure sélectionnée
        const structureUsers = this.data.users.filter(u => u.structure_id === structureId && u.role === 'utilisateur');
        
        if (structureUsers.length === 0) {
            projectManagerSelect.innerHTML = '<option value="">Aucun utilisateur disponible dans cette structure</option>';
            return;
        }

        const options = structureUsers.map(u => 
            `<option value="${u.id}">${u.first_name} ${u.last_name || ''} (${u.username})</option>`
        ).join('');
        
        projectManagerSelect.innerHTML = '<option value="">-- Sélectionnez un chef de projet --</option>' + options;
    },

    async saveProject() {
        try {
            const title = document.getElementById('project-title').value;
            const description = document.getElementById('project-description').value;
            const structure_id = document.getElementById('project-structure').value;
            const project_manager_id = document.getElementById('project-manager').value;
            const status = document.getElementById('project-status').value;
            const start_date = document.getElementById('project-start-date').value;
            const deadline_date = document.getElementById('project-deadline').value;

            if (!title || !structure_id || !project_manager_id) {
                Toast.warning('Veuillez remplir tous les champs obligatoires');
                return;
            }

            const projectData = {
                title,
                description,
                structure_id: parseInt(structure_id),
                project_manager_id: parseInt(project_manager_id),
                status,
                start_date: start_date || null,
                deadline_date: deadline_date || null
            };

            const submitBtn = document.querySelector('#project-form button[type="submit"]');
            submitBtn.disabled = true;
            submitBtn.textContent = '⏳ Enregistrement...';

            if (this.data.isEdit) {
                await API.projects.update(this.data.project.id, projectData);
                Toast.success('Projet mis a jour avec succes !');
                window.location.hash = `#/projects/${this.data.project.id}`;
            } else {
                const response = await API.projects.create(projectData);
                Toast.success('Projet cree avec succes !');
                window.location.hash = `#/projects/${response.data.id}`;
            }
        } catch (error) {
            console.error('Error saving project:', error);
            Toast.error('Erreur lors de la sauvegarde: ' + (error.message || 'Erreur inconnue'));
            
            const submitBtn = document.querySelector('#project-form button[type="submit"]');
            submitBtn.disabled = false;
            submitBtn.textContent = this.data.isEdit ? '💾 Mettre à jour' : '💾 Créer le projet';
        }
    },

    afterRender() {
        Navbar.updateActiveMenu();
        
        // Si une structure est déjà sélectionnée, charger ses utilisateurs
        const structureId = document.getElementById('project-structure').value;
        if (structureId) {
            this.loadUsersForStructure();
            
            // Si on est en mode édition et qu'il y a un chef de projet, le sélectionner
            if (this.data.isEdit && this.data.project && this.data.project.project_manager_id) {
                setTimeout(() => {
                    document.getElementById('project-manager').value = this.data.project.project_manager_id;
                }, 100);
            }
        }
    }
};
