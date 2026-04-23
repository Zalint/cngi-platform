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
                <div style="display:flex;gap:8px;flex-wrap:wrap;">
                    ${Auth.canExport() ? `
                        <button class="btn btn-secondary" onclick="ProjectsPage.exportXlsx()" title="Exporter tous les projets au format Excel">
                            <span>📊</span>
                            <span>Exporter Excel</span>
                        </button>
                        <button class="btn btn-secondary" onclick="ProjectsPage.openReportModal()" title="Générer un rapport analytique via IA">
                            <span>🤖</span>
                            <span>Générer rapport</span>
                        </button>
                    ` : ''}
                    ${canCreate ? `
                        <a href="#/projects/new" class="btn btn-primary">
                            <span>➕</span>
                            <span>Nouveau projet</span>
                        </a>
                    ` : ''}
                </div>
            </div>
        `;
    },

    openReportModal() {
        const structureOptions = (this.data.structures || []).map(s =>
            `<option value="${s.id}">${s.code} — ${s.name}</option>`).join('');

        const modal = document.createElement('div');
        modal.className = 'confirm-overlay confirm-visible';
        modal.innerHTML = `
            <div class="confirm-dialog" style="text-align:left;max-width:520px;">
                <h3 style="margin-bottom:8px;color:#202B5D;">🤖 Générer un rapport IA</h3>
                <p style="color:#62718D;font-size:13px;margin-bottom:20px;">
                    Le rapport analyse les projets sélectionnés via GPT-4.1-mini et couvre : résumé exécutif,
                    état global, analyse par structure, projets prioritaires, retards, mesures, recommandations.
                </p>

                <div class="form-group">
                    <label>Filtre — Statut</label>
                    <select id="report-status" class="form-control">
                        <option value="">Tous les statuts</option>
                        <option value="demarrage">Démarrage</option>
                        <option value="en_cours">En cours</option>
                        <option value="termine">Terminé</option>
                        <option value="retard">En retard</option>
                        <option value="annule">Annulé</option>
                    </select>
                </div>

                <div class="form-group">
                    <label>Filtre — Structure</label>
                    <select id="report-structure" class="form-control">
                        <option value="">Toutes les structures</option>
                        ${structureOptions}
                    </select>
                </div>

                <div class="form-group">
                    <label>Filtre — Priorité</label>
                    <select id="report-priority" class="form-control">
                        <option value="">Toutes les priorités</option>
                        <option value="normale">Normale</option>
                        <option value="haute">Haute</option>
                        <option value="urgente">Urgente</option>
                    </select>
                </div>

                <div class="form-group">
                    <label>Format</label>
                    <div style="display:flex;gap:10px;">
                        <label style="display:flex;align-items:center;gap:6px;cursor:pointer;padding:10px;border:1px solid #dce3ed;border-radius:6px;flex:1;">
                            <input type="radio" name="report-format" value="pdf" checked> 📄 PDF
                        </label>
                        <label style="display:flex;align-items:center;gap:6px;cursor:pointer;padding:10px;border:1px solid #dce3ed;border-radius:6px;flex:1;">
                            <input type="radio" name="report-format" value="docx"> 📝 Word
                        </label>
                    </div>
                </div>

                <div style="background:#fff8e1;padding:10px;border-radius:6px;border-left:3px solid #f39c12;margin:12px 0;font-size:12px;color:#8a6d3b;">
                    ⏱️ La génération prend 15-30 secondes selon le volume de projets.
                </div>

                <div class="confirm-actions" style="margin-top:20px;">
                    <button class="confirm-btn confirm-btn-cancel" onclick="this.closest('.confirm-overlay').remove()">Annuler</button>
                    <button class="confirm-btn confirm-btn-ok" style="background:#202B5D;" id="report-generate-btn" onclick="ProjectsPage.generateReport()">Générer</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    },

    async generateReport() {
        const btn = document.getElementById('report-generate-btn');
        try {
            const status = document.getElementById('report-status').value;
            const structure_id = document.getElementById('report-structure').value;
            const priority = document.getElementById('report-priority').value;
            const format = document.querySelector('input[name="report-format"]:checked').value;

            btn.disabled = true;
            btn.textContent = 'Génération en cours...';
            document.querySelector('.confirm-overlay')?.remove();
            WaterSpinner.show('Olélé copilot analyse les projets, merci de patienter...');

            const resp = await fetch('/api/reports/generate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${Auth.getToken()}`
                },
                body: JSON.stringify({ format, status, structure_id, priority })
            });

            if (!resp.ok) {
                const txt = await resp.text();
                let msg = txt;
                try { msg = JSON.parse(txt).message || txt; } catch {}
                throw new Error(msg || `HTTP ${resp.status}`);
            }

            const blob = await resp.blob();
            const ext = format === 'pdf' ? 'pdf' : 'docx';
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `CNGIRI_Rapport_${new Date().toISOString().slice(0,10)}.${ext}`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);

            Toast.success('Rapport généré et téléchargé.');
        } catch (err) {
            console.error(err);
            Toast.error('Erreur: ' + (err.message || 'inconnue'));
            if (btn) { btn.disabled = false; btn.textContent = 'Générer'; }
        } finally {
            WaterSpinner.hide();
        }
    },

    async exportXlsx() {
        WaterSpinner.show('Génération du fichier Excel...');
        try {
            const token = Auth.getToken();
            const resp = await fetch('/api/projects/export/xlsx', {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (!resp.ok) {
                const txt = await resp.text();
                throw new Error(txt || `HTTP ${resp.status}`);
            }
            const blob = await resp.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `CNGIRI_Projets_${new Date().toISOString().slice(0,10)}.xlsx`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
            Toast.success('Export Excel téléchargé.');
        } catch (err) {
            console.error(err);
            Toast.error('Erreur lors de l\'export: ' + (err.message || 'inconnue'));
        } finally {
            WaterSpinner.hide();
        }
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
        const priorityBadge = project.priority === 'urgente'
            ? '<span style="display:inline-block;padding:2px 8px;border-radius:10px;font-size:10px;font-weight:700;color:white;background:#e74c3c;margin-left:6px;">🔴 URGENT</span>'
            : project.priority === 'haute'
            ? '<span style="display:inline-block;padding:2px 8px;border-radius:10px;font-size:10px;font-weight:700;color:white;background:#e67e22;margin-left:6px;">🟠 HAUTE</span>'
            : '';
        const cardStyle = project.priority === 'urgente' ? 'border-left:4px solid #e74c3c;' : project.priority === 'haute' ? 'border-left:4px solid #e67e22;' : '';

        return `
            <div class="project-card" style="${cardStyle}" onclick="window.location.hash='#/projects/${project.id}'">
                <div>
                    <div class="project-title">${project.title}${priorityBadge}</div>
                    <span class="project-structure">${project.structure_code || 'N/A'}</span>
                </div>
                
                <div class="project-description">
                    ${project.description || 'Aucune description'}
                </div>
                
                <div class="project-meta">
                    <div>📅 Échéance: ${project.deadline_date ? DateFormatter.format(project.deadline_date) : 'N/A'}</div>
                    <div>📍 Sites: ${project.sites_count || 0}</div>
                    <div>🗺 Tracés: ${project.geometries_count || 0}</div>
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

        // Auto-filter from dashboard KPI click
        const savedStatus = sessionStorage.getItem('projectStatusFilter');
        if (savedStatus && statusFilter) {
            statusFilter.value = savedStatus;
            sessionStorage.removeItem('projectStatusFilter');
        }
        // Priority filter (stored in sessionStorage, applied in applyFilters via _priorityFilter)
        const savedPriority = sessionStorage.getItem('projectPriorityFilter');
        if (savedPriority) {
            this._priorityFilter = savedPriority;
            sessionStorage.removeItem('projectPriorityFilter');
        }
        if (savedStatus || savedPriority) this.applyFilters();
    },

    applyFilters() {
        const search = document.getElementById('search-projects').value.toLowerCase();
        const status = document.getElementById('filter-status').value;
        const structure = document.getElementById('filter-structure').value;
        const priority = this._priorityFilter || '';

        const filteredProjects = this.data.projects.filter(project => {
            const matchSearch = !search || project.title.toLowerCase().includes(search) ||
                               (project.description && project.description.toLowerCase().includes(search));
            const matchStatus = !status || project.status === status;
            const matchStructure = !structure || project.structure_id == structure;
            const matchPriority = !priority || project.priority === priority;

            return matchSearch && matchStatus && matchStructure && matchPriority;
        });

        // Re-render la grille avec les projets filtrés
        const grid = document.querySelector('.projects-grid');
        if (grid) {
            grid.innerHTML = filteredProjects.map(p => this.renderProjectCard(p)).join('');
        }
    },

    async deleteProject(id) {
        event.stopPropagation();

        Toast.confirm('Etes-vous sur de vouloir supprimer ce projet ?', async () => {
            try {
                await API.projects.delete(id);
                Toast.success('Projet supprime avec succes');
                window.location.reload();
            } catch (error) {
                Toast.error('Erreur lors de la suppression: ' + error.message);
            }
        }, { type: 'danger' });
    },

    editProject(id) {
        if (event) event.stopPropagation();
        window.location.hash = `#/projects/${id}/edit`;
    }
};

