// Page Gestion des Mappings Projet-Structure

const ProjectStructuresPage = {
    async render() {
        return `
            <div class="container">
                <div class="page-header">
                    <h1>📊 Gestion des Mappings Projet-Structure</h1>
                    <p class="subtitle">Assignez les projets aux différentes structures</p>
                </div>

                <div id="loading" class="loading">Chargement...</div>
                <div id="error" class="error-message" style="display: none;"></div>

                <div id="mappings-container" style="display: none;">
                    <div class="filters">
                        <select id="filter-project" class="form-control">
                            <option value="">-- Tous les projets --</option>
                        </select>
                        <select id="filter-structure" class="form-control">
                            <option value="">-- Toutes les structures --</option>
                        </select>
                    </div>

                    <div class="card">
                        <div class="card-header">
                            <h2>Liste des Projets</h2>
                        </div>
                        <div class="card-body">
                            <div id="projects-list"></div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    },

    async afterRender() {
        await this.loadData();
        this.attachEventListeners();
    },

    async loadData() {
        try {
            document.getElementById('loading').style.display = 'block';
            document.getElementById('error').style.display = 'none';

            // Charger les projets et structures
            const [projectsRes, structuresRes] = await Promise.all([
                API.get('/projects'),
                API.get('/structures')
            ]);

            this.projects = projectsRes.data;
            this.structures = structuresRes.data;

            // Charger les mappings pour chaque projet
            const projectsWithStructures = await Promise.all(
                this.projects.map(async (project) => {
                    const structuresRes = await API.get(`/projects/${project.id}/structures`);
                    return {
                        ...project,
                        assignedStructures: structuresRes.data
                    };
                })
            );

            this.projectsWithStructures = projectsWithStructures;

            document.getElementById('loading').style.display = 'none';
            document.getElementById('mappings-container').style.display = 'block';

            this.renderFilters();
            this.renderProjects();
        } catch (error) {
            console.error('Error loading data:', error);
            document.getElementById('loading').style.display = 'none';
            const errorDiv = document.getElementById('error');
            errorDiv.textContent = 'Erreur lors du chargement des données: ' + (error.message || 'Erreur inconnue');
            errorDiv.style.display = 'block';
        }
    },

    renderFilters() {
        const projectFilter = document.getElementById('filter-project');
        const structureFilter = document.getElementById('filter-structure');

        // Remplir le filtre des projets
        this.projects.forEach(project => {
            const option = document.createElement('option');
            option.value = project.id;
            option.textContent = project.title;
            projectFilter.appendChild(option);
        });

        // Remplir le filtre des structures
        this.structures.forEach(structure => {
            const option = document.createElement('option');
            option.value = structure.id;
            option.textContent = structure.name;
            structureFilter.appendChild(option);
        });
    },

    renderProjects() {
        const container = document.getElementById('projects-list');
        const projectFilter = document.getElementById('filter-project')?.value;
        const structureFilter = document.getElementById('filter-structure')?.value;

        let filteredProjects = this.projectsWithStructures;

        // Appliquer les filtres
        if (projectFilter) {
            filteredProjects = filteredProjects.filter(p => p.id == projectFilter);
        }

        if (structureFilter) {
            filteredProjects = filteredProjects.filter(p => 
                p.assignedStructures.some(s => s.id == structureFilter)
            );
        }

        if (filteredProjects.length === 0) {
            container.innerHTML = '<p class="text-center">Aucun projet trouvé</p>';
            return;
        }

        container.innerHTML = filteredProjects.map(project => `
            <div class="mapping-card" data-project-id="${project.id}">
                <div class="mapping-header">
                    <h3>${project.title}</h3>
                    <span class="badge badge-${this.getStatusClass(project.status)}">${this.getStatusText(project.status)}</span>
                </div>
                <div class="mapping-body">
                    <p class="project-description">${project.description || 'Pas de description'}</p>
                    
                    <div class="structures-section">
                        <label><strong>Structures assignées :</strong></label>
                        <div class="structure-checkboxes">
                            ${this.structures.map(structure => {
                                const isAssigned = project.assignedStructures.some(s => s.id === structure.id);
                                return `
                                    <label class="checkbox-label">
                                        <input 
                                            type="checkbox" 
                                            value="${structure.id}"
                                            ${isAssigned ? 'checked' : ''}
                                            data-project-id="${project.id}"
                                            class="structure-checkbox"
                                        />
                                        <span>${structure.name}</span>
                                    </label>
                                `;
                            }).join('')}
                        </div>
                    </div>

                    <div class="mapping-actions">
                        <button class="btn btn-primary save-mapping-btn" data-project-id="${project.id}">
                            💾 Enregistrer
                        </button>
                    </div>
                </div>
            </div>
        `).join('');
    },

    attachEventListeners() {
        // Filtres
        document.getElementById('filter-project')?.addEventListener('change', () => {
            this.renderProjects();
        });

        document.getElementById('filter-structure')?.addEventListener('change', () => {
            this.renderProjects();
        });

        // Boutons de sauvegarde
        document.addEventListener('click', async (e) => {
            if (e.target.classList.contains('save-mapping-btn')) {
                const projectId = e.target.dataset.projectId;
                await this.saveMapping(projectId);
            }
        });
    },

    async saveMapping(projectId) {
        try {
            const card = document.querySelector(`[data-project-id="${projectId}"]`);
            const checkboxes = card.querySelectorAll('.structure-checkbox:checked');
            const structureIds = Array.from(checkboxes).map(cb => parseInt(cb.value));

            const btn = card.querySelector('.save-mapping-btn');
            btn.disabled = true;
            btn.textContent = '⏳ Enregistrement...';

            await API.post(`/projects/${projectId}/structures`, {
                structure_ids: structureIds
            });

            btn.textContent = '✅ Enregistré !';
            btn.classList.add('btn-success');
            
            setTimeout(() => {
                btn.disabled = false;
                btn.textContent = '💾 Enregistrer';
                btn.classList.remove('btn-success');
            }, 2000);

            // Recharger les données
            await this.loadData();
        } catch (error) {
            console.error('Error saving mapping:', error);
            Toast.error('Erreur lors de la sauvegarde: ' + (error.message || 'Erreur inconnue'));
            const btn = document.querySelector(`[data-project-id="${projectId}"] .save-mapping-btn`);
            btn.disabled = false;
            btn.textContent = '💾 Enregistrer';
        }
    },

    getStatusClass(status) {
        const classes = {
            'en_cours': 'info',
            'termine': 'success',
            'retard': 'danger',
            'annule': 'secondary'
        };
        return classes[status] || 'secondary';
    },

    getStatusText(status) {
        const texts = {
            'en_cours': 'En cours',
            'termine': 'Terminé',
            'retard': 'En retard',
            'annule': 'Annulé'
        };
        return texts[status] || status;
    }
};

