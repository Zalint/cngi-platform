// Page liste des projets

const ProjectsPage = {
    data: {
        projects: [],
        structures: [],
        stats: null
    },

    async render() {
        try {
            await this.loadData();

            return `
                ${Navbar.render()}
                <div class="main-content with-sidebar">
                    ${Navbar.renderTopBar('Gestion des projets')}
                    <div class="content-area">
                        ${this.renderStats()}
                        ${this.renderToolbar()}
                        ${this.renderProjectsGrid()}
                    </div>
                </div>
            `;
        } catch (error) {
            console.error('Error rendering projects:', error);
            return `<div class="alert alert-error">Erreur de chargement des projets</div>`;
        }
    },

    async loadData() {
        const user = Auth.getUser();
        const [projects, structures, stats] = await Promise.all([
            API.projects.getAll(),
            API.structures.getAll(),
            API.projects.getStats()
        ]);

        this.data.projects = projects.data;
        this.data.structures = structures.data;
        this.data.stats = stats.data;
    },

    renderStats() {
        if (!this.data.stats) return '';

        return `
            <div class="metrics-grid" style="grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));">
                <div class="metric-card">
                    <div class="metric-value">${this.data.stats.total || 0}</div>
                    <div class="metric-label">Total projets</div>
                </div>
                <div class="metric-card">
                    <div class="metric-value">${this.data.stats.demarrage || 0}</div>
                    <div class="metric-label">Démarrage</div>
                </div>
                <div class="metric-card">
                    <div class="metric-value">${this.data.stats.en_cours || 0}</div>
                    <div class="metric-label">En cours</div>
                </div>
                <div class="metric-card">
                    <div class="metric-value">${this.data.stats.termine || 0}</div>
                    <div class="metric-label">Terminés</div>
                </div>
                <div class="metric-card">
                    <div class="metric-value">${this.data.stats.retard || 0}</div>
                    <div class="metric-label">En retard</div>
                </div>
            </div>
        `;
    },

    renderToolbar() {
        const canCreate = Auth.hasAnyRole('admin', 'utilisateur');
        const structureOptions = this.data.structures.map(s => 
            `<option value="${s.id}">${s.name}</option>`
        ).join('');

        return `
            <div class="toolbar">
                <div class="search-filter">
                    <input type="text" class="search-box" id="search-projects" placeholder="🔍 Rechercher un projet...">
                    <select class="filter-select" id="filter-status">
                        <option value="">Tous les statuts</option>
                        <option value="demarrage">Démarrage</option>
                        <option value="en_cours">En cours</option>
                        <option value="termine">Terminé</option>
                        <option value="retard">En retard</option>
                    </select>
                    <select class="filter-select" id="filter-structure">
                        <option value="">Toutes structures</option>
                        ${structureOptions}
                    </select>
                </div>
                ${canCreate ? `
                    <a href="#/projects/new" class="btn btn-primary">
                        <span>➕</span>
                        <span>Nouveau projet</span>
                    </a>
                ` : ''}
            </div>
        `;
    },

    renderProjectsGrid() {
        if (!this.data.projects || this.data.projects.length === 0) {
            return `
                <div class="card text-center" style="padding: 80px 20px;">
                    <div style="font-size: 64px; margin-bottom: 20px; opacity: 0.5;">📋</div>
                    <h3>Aucun projet</h3>
                    <p style="color: #666;">Créez votre premier projet pour commencer</p>
                </div>
            `;
        }

        const cards = this.data.projects.map(project => this.renderProjectCard(project)).join('');

        return `
            <div class="projects-grid">
                ${cards}
            </div>
        `;
    },

    renderProjectCard(project) {
        const statusLabel = this.getStatusLabel(project.status);
        
        return `
            <div class="project-card" onclick="window.location.hash='#/projects/${project.id}'">
                <div>
                    <div class="project-title">${project.title}</div>
                    <span class="project-structure">${project.structure_code || 'N/A'}</span>
                </div>
                
                <div class="project-description">
                    ${project.description || 'Aucune description'}
                </div>
                
                <div class="project-meta">
                    <div>📅 Échéance: ${project.deadline_date ? DateFormatter.format(project.deadline_date) : 'N/A'}</div>
                    <div>📍 Sites: ${project.sites_count || 0}</div>
                </div>
                
                <div style="margin-bottom: 16px;">
                    <div class="progress-header">
                        <span class="progress-label">Avancement</span>
                        <span class="progress-value">${project.progress_percentage || 0}%</span>
                    </div>
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${project.progress_percentage || 0}%;"></div>
                    </div>
                </div>
                
                <div class="project-footer">
                    <span class="status-badge status-${project.status}">${statusLabel}</span>
                    <div style="display: flex; gap: 8px;" onclick="event.stopPropagation();">
                        <button class="btn-icon" onclick="window.location.hash='#/projects/${project.id}'" title="Voir">👁️</button>
                        ${Auth.hasAnyRole('admin', 'utilisateur') ? `
                            <button class="btn-icon" onclick="ProjectsPage.editProject(${project.id})" title="Modifier">✏️</button>
                            <button class="btn-icon" onclick="ProjectsPage.deleteProject(${project.id})" title="Supprimer">🗑️</button>
                        ` : ''}
                    </div>
                </div>
            </div>
        `;
    },

    getStatusLabel(status) {
        const labels = {
            'demarrage': 'Démarrage',
            'en_cours': 'En cours',
            'termine': 'Terminé',
            'retard': 'En retard',
            'annule': 'Annulé'
        };
        return labels[status] || status;
    },

    afterRender() {
        Navbar.updateActiveMenu();
        
        // Ajouter les event listeners pour les filtres
        const searchInput = document.getElementById('search-projects');
        const statusFilter = document.getElementById('filter-status');
        const structureFilter = document.getElementById('filter-structure');

        if (searchInput) {
            searchInput.addEventListener('input', () => this.applyFilters());
        }
        if (statusFilter) {
            statusFilter.addEventListener('change', () => this.applyFilters());
        }
        if (structureFilter) {
            structureFilter.addEventListener('change', () => this.applyFilters());
        }
    },

    applyFilters() {
        const search = document.getElementById('search-projects').value.toLowerCase();
        const status = document.getElementById('filter-status').value;
        const structure = document.getElementById('filter-structure').value;

        const filteredProjects = this.data.projects.filter(project => {
            const matchSearch = !search || project.title.toLowerCase().includes(search) || 
                               (project.description && project.description.toLowerCase().includes(search));
            const matchStatus = !status || project.status === status;
            const matchStructure = !structure || project.structure_id == structure;

            return matchSearch && matchStatus && matchStructure;
        });

        // Re-render la grille avec les projets filtrés
        const grid = document.querySelector('.projects-grid');
        if (grid) {
            grid.innerHTML = filteredProjects.map(p => this.renderProjectCard(p)).join('');
        }
    },

    async deleteProject(id) {
        event.stopPropagation();
        
        if (!confirm('Êtes-vous sûr de vouloir supprimer ce projet ?')) {
            return;
        }

        try {
            await API.projects.delete(id);
            alert('Projet supprimé avec succès');
            window.location.reload();
        } catch (error) {
            alert('Erreur lors de la suppression: ' + error.message);
        }
    },

    editProject(id) {
        if (event) event.stopPropagation();
        window.location.hash = `#/projects/${id}/edit`;
    }
};

