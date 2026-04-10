// Page Dashboard

const DashboardPage = {
    data: {
        metrics: null,
        projectsByStructure: [],
        recentProjects: []
    },

    async render() {
        try {
            const user = Auth.getUser();
            await this.loadData();

            // Vue spécifique pour le directeur : organisation par projet
            if (user.role === 'directeur') {
                return `
                    ${Navbar.render()}
                    <div class="main-content with-sidebar">
                        ${Navbar.renderTopBar('Tableau de bord - Vue Directeur')}
                        <div class="content-area">
                            ${this.renderDirectorView()}
                        </div>
                    </div>
                `;
            }

            // Vue standard pour admin et utilisateur
            return `
                ${Navbar.render()}
                <div class="main-content with-sidebar">
                    ${Navbar.renderTopBar('Tableau de bord')}
                    <div class="content-area">
                        ${this.renderMetrics()}
                        ${this.renderRecentProjects()}
                        ${this.renderChart()}
                    </div>
                </div>
            `;
        } catch (error) {
            console.error('Error rendering dashboard:', error);
            return `<div class="alert alert-error">Erreur de chargement du dashboard</div>`;
        }
    },

    async loadData() {
        const user = Auth.getUser();
        const structureId = (user.role === 'utilisateur' || user.role === 'directeur') ? user.structure_id : null;

        // Pour le directeur, charger aussi les projets détaillés
        if (user.role === 'directeur') {
            const projectsResponse = await API.projects.getAll();
            this.data.projects = projectsResponse.data;
            
            // Charger les métriques de base
            const metrics = await API.dashboard.getMetrics(structureId);
            this.data.metrics = metrics.data;
        } else {
            const [metrics, projectsByStructure, recentProjects] = await Promise.all([
                API.dashboard.getMetrics(structureId),
                API.dashboard.getProjectsByStructure(),
                API.dashboard.getRecentProjects(5)
            ]);

            this.data.metrics = metrics.data;
            this.data.projectsByStructure = projectsByStructure.data;
            this.data.recentProjects = recentProjects.data;
        }
    },

    renderMetrics() {
        if (!this.data.metrics) return '';

        const m = this.data.metrics;
        
        return `
            <div class="metrics-grid" style="grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));">
                <div class="metric-card">
                    <div class="metric-value">${m.total_projects || 0}</div>
                    <div class="metric-label">Total projets</div>
                </div>
                <div class="metric-card">
                    <div class="metric-value">${m.projets_demarrage || 0}</div>
                    <div class="metric-label">Démarrage</div>
                </div>
                <div class="metric-card">
                    <div class="metric-value">${m.actions_en_cours || 0}</div>
                    <div class="metric-label">En cours</div>
                </div>
                <div class="metric-card">
                    <div class="metric-value">${m.ouvrages_realises || 0}</div>
                    <div class="metric-label">Terminés</div>
                </div>
                <div class="metric-card">
                    <div class="metric-value">${m.ouvrages_retardes || 0}</div>
                    <div class="metric-label">En retard</div>
                </div>
            </div>
        `;
    },

    renderRecentProjects() {
        if (!this.data.recentProjects || this.data.recentProjects.length === 0) {
            return '';
        }

        const rows = this.data.recentProjects.map(project => `
            <tr onclick="window.location.hash='#/projects/${project.id}'">
                <td>${project.title}</td>
                <td><span class="project-structure">${project.structure_code || 'N/A'}</span></td>
                <td><span class="status-badge status-${project.status}">${this.getStatusLabel(project.status)}</span></td>
                <td>
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${project.progress_percentage || 0}%;"></div>
                    </div>
                </td>
                <td>${project.deadline_date ? DateFormatter.format(project.deadline_date) : 'N/A'}</td>
            </tr>
        `).join('');

        return `
            <div class="card mb-4">
                <div class="card-header">
                    <h2>Projets récents</h2>
                    <p>Derniers projets créés</p>
                </div>
                <div class="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>Projet</th>
                                <th>Structure</th>
                                <th>Statut</th>
                                <th>Avancement</th>
                                <th>Échéance</th>
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

    renderChart() {
        if (!this.data.projectsByStructure || this.data.projectsByStructure.length === 0) {
            return '';
        }

        const maxProjects = Math.max(...this.data.projectsByStructure.map(s => s.total_projects));
        
        const bars = this.data.projectsByStructure.map((structure, index) => {
            const height = (structure.total_projects / maxProjects) * 250;
            const colors = ['#4285f4', '#34a853', '#fbbc04', '#ea4335', '#9c27b0'];
            const color = colors[index % colors.length];
            
            return `
                <div style="flex: 1; max-width: 100px; display: flex; flex-direction: column; align-items: center; gap: 12px;">
                    <div style="width: 60px; height: ${height}px; background: ${color}; border-radius: 8px 8px 0 0; position: relative;">
                        <span style="position: absolute; top: -30px; left: 50%; transform: translateX(-50%); font-weight: 700; color: #1e3c72; font-size: 16px;">
                            ${structure.total_projects}
                        </span>
                    </div>
                    <div style="font-size: 13px; color: #666; font-weight: 600;">${structure.code}</div>
                </div>
            `;
        }).join('');

        return `
            <div class="card">
                <div class="card-header">
                    <h2>Projets par structure</h2>
                    <p>Répartition des projets par structure</p>
                </div>
                <div style="display: flex; align-items: flex-end; justify-content: space-around; height: 300px; padding: 40px 20px 20px;">
                    ${bars}
                </div>
            </div>
        `;
    },

    renderDirectorView() {
        const user = Auth.getUser();
        const projects = this.data.projects || [];
        const metrics = this.data.metrics;

        if (projects.length === 0) {
            return `
                <div class="card text-center" style="padding: 60px 20px;">
                    <div style="font-size: 64px; margin-bottom: 20px; opacity: 0.3;">📊</div>
                    <h2>Aucun projet</h2>
                    <p style="color: #666;">Votre structure n'a pas encore de projets assignés.</p>
                </div>
            `;
        }

        // Statistiques globales
        const statsHtml = `
            <div class="card mb-4" style="background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%); color: white;">
                <h2 style="color: white; margin-bottom: 24px;">📊 Vue d'ensemble - ${user.structure_name || 'Votre structure'}</h2>
                <div class="metrics-grid" style="grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));">
                    <div style="background: rgba(255,255,255,0.1); padding: 20px; border-radius: 8px;">
                        <div style="font-size: 32px; font-weight: 700; margin-bottom: 8px;">${projects.length}</div>
                        <div style="font-size: 14px; opacity: 0.9;">Projets totaux</div>
                    </div>
                    <div style="background: rgba(255,255,255,0.1); padding: 20px; border-radius: 8px;">
                        <div style="font-size: 32px; font-weight: 700; margin-bottom: 8px;">
                            ${projects.filter(p => p.status === 'en_cours').length}
                        </div>
                        <div style="font-size: 14px; opacity: 0.9;">En cours</div>
                    </div>
                    <div style="background: rgba(255,255,255,0.1); padding: 20px; border-radius: 8px;">
                        <div style="font-size: 32px; font-weight: 700; margin-bottom: 8px;">
                            ${projects.filter(p => p.status === 'termine').length}
                        </div>
                        <div style="font-size: 14px; opacity: 0.9;">Terminés</div>
                    </div>
                    <div style="background: rgba(255,255,255,0.1); padding: 20px; border-radius: 8px;">
                        <div style="font-size: 32px; font-weight: 700; margin-bottom: 8px;">
                            ${projects.filter(p => p.status === 'retard').length}
                        </div>
                        <div style="font-size: 14px; opacity: 0.9;">En retard</div>
                    </div>
                </div>
            </div>
        `;

        // Liste des projets détaillés
        const projectsHtml = projects.map((project, index) => `
            <div class="card mb-3" style="transition: all 0.3s; cursor: pointer;" 
                 onclick="window.location.hash='#/projects/${project.id}'"
                 onmouseover="this.style.transform='translateY(-4px)'; this.style.boxShadow='0 8px 16px rgba(0,0,0,0.15)';"
                 onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 2px 8px rgba(0,0,0,0.1)';">
                
                <div style="display: flex; align-items: start; gap: 20px;">
                    <!-- Numéro du projet -->
                    <div style="width: 60px; height: 60px; background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%); color: white; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 24px; font-weight: 700; flex-shrink: 0;">
                        ${index + 1}
                    </div>

                    <!-- Informations du projet -->
                    <div style="flex: 1;">
                        <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 12px;">
                            <h3 style="margin: 0; color: #1e3c72; font-size: 20px;">${project.title}</h3>
                            <span class="status-badge status-${project.status}" style="flex-shrink: 0;">
                                ${this.getStatusLabel(project.status)}
                            </span>
                        </div>

                        ${project.description ? `
                            <p style="color: #666; margin-bottom: 16px; font-size: 14px;">
                                ${project.description.length > 150 ? project.description.substring(0, 150) + '...' : project.description}
                            </p>
                        ` : ''}

                        <!-- Détails du projet -->
                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 16px;">
                            <div style="background: #f5f7fa; padding: 12px; border-radius: 8px;">
                                <div style="font-size: 12px; color: #666; margin-bottom: 4px;">📅 Échéance</div>
                                <div style="font-weight: 600; color: #333;">
                                    ${project.deadline_date ? DateFormatter.format(project.deadline_date, 'DD/MM/YYYY') : 'Non définie'}
                                </div>
                            </div>
                            <div style="background: #f5f7fa; padding: 12px; border-radius: 8px;">
                                <div style="font-size: 12px; color: #666; margin-bottom: 4px;">Budget</div>
                                <div style="font-weight: 600; color: #333;">
                                    ${project.budget ? this.formatCurrency(project.budget) : 'Non défini'}
                                </div>
                            </div>
                            <div style="background: #f5f7fa; padding: 12px; border-radius: 8px;">
                                <div style="font-size: 12px; color: #666; margin-bottom: 4px;">📍 Localités</div>
                                <div style="font-weight: 600; color: #333;">
                                    ${project.localities_count || 0} localités
                                </div>
                            </div>
                            <div style="background: #f5f7fa; padding: 12px; border-radius: 8px;">
                                <div style="font-size: 12px; color: #666; margin-bottom: 4px;">🎯 Sites</div>
                                <div style="font-weight: 600; color: #333;">
                                    ${project.sites_count || 0} sites
                                </div>
                            </div>
                        </div>

                        <!-- Barre de progression -->
                        <div>
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                                <span style="font-size: 13px; font-weight: 600; color: #666;">Avancement</span>
                                <span style="font-size: 16px; font-weight: 700; color: #1e3c72;">
                                    ${project.progress_percentage || 0}%
                                </span>
                            </div>
                            <div class="progress-bar" style="height: 8px;">
                                <div class="progress-fill" style="width: ${project.progress_percentage || 0}%; height: 8px;"></div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `).join('');

        return `
            ${statsHtml}
            
            <div class="card">
                <div class="card-header">
                    <h2>🏗️ Projets par détail</h2>
                    <p>Cliquez sur un projet pour voir tous les détails</p>
                </div>
                ${projectsHtml}
            </div>
        `;
    },

    formatCurrency(amount) {
        return new Intl.NumberFormat('fr-FR', {
            style: 'decimal',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(amount) + ' FCFA';
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
    }
};

