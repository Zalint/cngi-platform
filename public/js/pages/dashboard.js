// Page Dashboard

const DashboardPage = {
    data: {
        metrics: null,
        projectsByStructure: [],
        recentProjects: [],
        recentProjectsLimit: 5,
        recentProjectsHasMore: false,
        allProjects: [],
        mapSites: [],
        topObservations: [],
        topPvs: []
    },
    map: null,

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
                            ${this.renderObservationsBanner()}
                            ${this.renderPvBanner()}
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
                        ${this.renderAlertBanner()}
                        ${this.renderObservationsBanner()}
                        ${this.renderPvBanner()}
                        ${this.renderMetrics()}
                        <div id="dashboard-view-toggle" style="display:flex;justify-content:flex-end;margin-bottom:12px;">
                            <div style="display:flex;background:#f0f4f8;border-radius:8px;overflow:hidden;">
                                <button onclick="DashboardPage.switchView('map')" id="view-btn-map" style="padding:8px 16px;border:none;cursor:pointer;font-size:12px;font-weight:600;background:#202B5D;color:white;">Carte & Structures</button>
                                <button onclick="DashboardPage.switchView('gantt')" id="view-btn-gantt" style="padding:8px 16px;border:none;cursor:pointer;font-size:12px;font-weight:600;background:transparent;color:#62718D;">Planning Gantt</button>
                            </div>
                        </div>
                        <div id="view-map" class="view-map-grid" style="display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-bottom:24px;">
                            <div>${this.renderMap()}</div>
                            <div>${this.renderChart()}</div>
                        </div>
                        <div id="view-gantt" style="display:none;margin-bottom:24px;">
                            ${this.renderGantt()}
                        </div>
                        ${this.renderRecentProjects()}
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
        // superviseur and commandement_territorial use structureId = null (backend handles territorial filtering)

        // Charger les dernières observations (non bloquant)
        try {
            const obsRes = await API.observations.list();
            this.data.topObservations = (obsRes.data || []).slice(0, 3);
        } catch { this.data.topObservations = []; }

        // Charger les derniers PV visibles (non bloquant)
        try {
            const pvRes = await API.pv.list();
            this.data.topPvs = (pvRes.data || []).slice(0, 3);
        } catch { this.data.topPvs = []; }

        // Pour le directeur, charger aussi les projets détaillés
        if (user.role === 'directeur') {
            const projectsResponse = await API.projects.getAll();
            this.data.projects = projectsResponse.data;
            
            // Charger les métriques de base
            const metrics = await API.dashboard.getMetrics(structureId);
            this.data.metrics = metrics.data;
        } else {
            const [metrics, projectsByStructure, recentProjects, mapData, allProjects] = await Promise.all([
                API.dashboard.getMetrics(structureId),
                API.dashboard.getProjectsByStructure(),
                API.dashboard.getRecentProjects(this.data.recentProjectsLimit + 1),
                API.dashboard.getMapData(structureId),
                API.projects.getAll()
            ]);

            this.data.metrics = metrics.data;
            this.data.projectsByStructure = projectsByStructure.data;
            const recentData = recentProjects.data || [];
            this.data.recentProjectsHasMore = recentData.length > this.data.recentProjectsLimit;
            this.data.recentProjects = recentData.slice(0, this.data.recentProjectsLimit);
            this.data.mapSites = mapData.data || [];
            this.data.allProjects = allProjects.data || [];
        }
    },

    renderObservationsBanner() {
        const obs = this.data.topObservations || [];
        if (obs.length === 0) return '';

        const escape = (s) => String(s || '').replace(/[&<>"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c]));

        // Titre + nom du superviseur à partir de l'auteur de la première observation
        let ministerName = '';
        let ministerTitle = '';
        for (const o of obs) {
            const name = [o.author_first_name, o.author_last_name].filter(Boolean).join(' ').trim();
            if (name) {
                ministerName = name;
                ministerTitle = o.author_title || '';
                break;
            }
        }
        const headerLabel = [ministerTitle, ministerName].filter(Boolean).join(' ');
        const truncate = (s, n = 180) => {
            const clean = String(s || '').replace(/\s+/g, ' ').trim();
            return clean.length > n ? clean.slice(0, n) + '…' : clean;
        };

        const prioStyle = {
            urgente:    { bg: 'linear-gradient(90deg,#fee2e2 0%,#fff 60%)', border: '#e74c3c', icon: '🔴', label: 'URGENTE' },
            importante: { bg: 'linear-gradient(90deg,#fef3c7 0%,#fff 60%)', border: '#e67e22', icon: '🟠', label: 'IMPORTANTE' },
            info:       { bg: 'linear-gradient(90deg,#ffe4e6 0%,#fff 60%)', border: '#e11d48', icon: '🔴', label: 'INFO' }
        };

        const cards = obs.map((o, idx) => {
            const st = prioStyle[o.priority || 'info'];
            const deadline = o.deadline ? new Date(o.deadline).toLocaleDateString('fr-FR') : null;
            const overdue = o.deadline && new Date(o.deadline) < new Date();
            const authorName = [o.author_first_name, o.author_last_name].filter(Boolean).join(' ') || o.author_username || '—';
            const author = o.author_title ? `${o.author_title} ${authorName}` : authorName;

            return `
                <div class="obs-slide" data-idx="${idx}" style="display:${idx === 0 ? 'block' : 'none'};background:${st.bg};border-left:4px solid ${st.border};padding:12px 16px;border-radius:8px;margin-bottom:8px;cursor:pointer;transition:transform 0.15s;"
                     onmouseover="this.style.transform='translateX(2px)';" onmouseout="this.style.transform='translateX(0)';"
                     onclick="window.location.hash='#/observations'">
                    <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:4px;">
                        <span style="font-size:11px;font-weight:700;color:${st.border};">${st.icon} ${st.label}</span>
                        <strong style="color:#202B5D;font-size:14px;">${escape(o.title)}</strong>
                        ${deadline ? `<span style="font-size:11px;color:${overdue ? '#b91c1c' : '#62718D'};font-weight:600;">📅 ${deadline}${overdue ? ' ⚠️' : ''}</span>` : ''}
                    </div>
                    <div style="font-size:12.5px;color:#2c3e50;line-height:1.45;">${escape(truncate(o.content))}</div>
                    <div style="font-size:11px;color:#8896AB;margin-top:4px;">— ${escape(author)}${o.project_title ? ` · 📁 ${escape(o.project_title)}` : ''}</div>
                </div>
            `;
        }).join('');

        const dots = obs.length > 1 ? obs.map((_, i) =>
            `<span class="obs-dot" data-idx="${i}" style="width:6px;height:6px;border-radius:50%;background:${i === 0 ? '#202B5D' : '#d1d5db'};display:inline-block;transition:background 0.3s;"></span>`
        ).join('') : '';

        return `
            <div class="card mb-4" style="padding:16px;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
                    <div style="display:flex;align-items:center;gap:8px;">
                        <span style="font-size:18px;">📜</span>
                        <h3 style="margin:0;color:#202B5D;font-size:15px;">Observation${headerLabel ? ' — ' + escape(headerLabel) : ''}</h3>
                    </div>
                    <div style="display:flex;align-items:center;gap:10px;">
                        ${dots ? `<div style="display:flex;gap:4px;">${dots}</div>` : ''}
                        <a href="#/observations" style="font-size:12px;color:#3794C4;text-decoration:none;font-weight:600;">Tout voir →</a>
                    </div>
                </div>
                <div id="obs-carousel">${cards}</div>
            </div>
        `;
    },

    renderPvBanner() {
        const pvs = this.data.topPvs || [];
        if (pvs.length === 0) return '';

        const escape = (s) => String(s || '').replace(/[&<>"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c]));
        const truncate = (s, n = 180) => {
            const clean = String(s || '').replace(/\s+/g, ' ').trim();
            return clean.length > n ? clean.slice(0, n) + '…' : clean;
        };

        const prioStyle = {
            urgente:    { bg: 'linear-gradient(90deg,#fee2e2 0%,#fff 60%)', border: '#e74c3c', icon: '🔴', label: 'URGENTE' },
            importante: { bg: 'linear-gradient(90deg,#fef3c7 0%,#fff 60%)', border: '#e67e22', icon: '🟠', label: 'IMPORTANTE' },
            info:       { bg: 'linear-gradient(90deg,#fef9c3 0%,#fff 60%)', border: '#eab308', icon: '🟡', label: 'INFO' }
        };

        const localityLabel = (l) => {
            const parts = [l.region, l.departement, l.arrondissement, l.commune].filter(Boolean);
            return parts.join(' › ');
        };

        // Libellé d'en-tête dynamique depuis l'auteur du 1er PV (titre + nom)
        let pvHeaderLabel = '';
        for (const p of pvs) {
            const name = [p.author_first_name, p.author_last_name].filter(Boolean).join(' ').trim();
            pvHeaderLabel = [p.author_title, name].filter(Boolean).join(' ');
            if (pvHeaderLabel) break;
        }

        const cards = pvs.map((p, idx) => {
            const st = prioStyle[p.priority || 'info'];
            const visitDate = p.visit_date ? new Date(p.visit_date).toLocaleDateString('fr-FR') : null;
            const authorName = [p.author_first_name, p.author_last_name].filter(Boolean).join(' ') || p.author_username || '—';
            const author = p.author_title ? `${p.author_title} ${authorName}` : authorName;
            const summary = p.avancement || p.observations || p.recommendations || p.content || '';

            const chips = [];
            if (p.projects?.length) chips.push(`<span style="font-size:11px;padding:2px 8px;background:#dbeafe;color:#1e40af;border-radius:10px;font-weight:600;">📁 ${escape(p.projects.map(x => x.title).join(', '))}</span>`);
            if (p.sites?.length) chips.push(`<span style="font-size:11px;padding:2px 8px;background:#fef3c7;color:#92400e;border-radius:10px;font-weight:600;">📍 ${escape(p.sites.map(x => x.name).join(', '))}</span>`);
            if (p.localities?.length) chips.push(`<span style="font-size:11px;padding:2px 8px;background:#e9d5ff;color:#6b21a8;border-radius:10px;font-weight:600;">🏘️ ${escape(p.localities.map(localityLabel).filter(Boolean).join(' · '))}</span>`);

            return `
                <div class="pv-slide" data-idx="${idx}" style="display:${idx === 0 ? 'block' : 'none'};background:${st.bg};border-left:4px solid ${st.border};padding:12px 16px;border-radius:8px;margin-bottom:8px;cursor:pointer;transition:transform 0.15s;"
                     onmouseover="this.style.transform='translateX(2px)';" onmouseout="this.style.transform='translateX(0)';"
                     onclick="window.location.hash='#/pv'">
                    <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:4px;">
                        <span style="font-size:11px;font-weight:700;color:${st.border};">${st.icon} ${st.label}</span>
                        <strong style="color:#202B5D;font-size:14px;">${escape(p.title)}</strong>
                        <span style="font-size:11px;color:#854d0e;font-weight:600;">🗺️ ${escape(p.territorial_value)}</span>
                        ${visitDate ? `<span style="font-size:11px;color:#62718D;font-weight:600;">📅 ${visitDate}</span>` : ''}
                    </div>
                    ${chips.length ? `<div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:6px;">${chips.join('')}</div>` : ''}
                    <div style="font-size:12.5px;color:#2c3e50;line-height:1.45;">${escape(truncate(summary))}</div>
                    <div style="font-size:11px;color:#8896AB;margin-top:4px;">— ${escape(author)}</div>
                </div>
            `;
        }).join('');

        const pvDots = pvs.length > 1 ? pvs.map((_, i) =>
            `<span class="pv-dot" data-idx="${i}" style="width:6px;height:6px;border-radius:50%;background:${i === 0 ? '#eab308' : '#d1d5db'};display:inline-block;transition:background 0.3s;"></span>`
        ).join('') : '';

        return `
            <div class="card mb-4" style="padding:16px;border-left:4px solid #eab308;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
                    <div style="display:flex;align-items:center;gap:8px;">
                        <span style="font-size:18px;">📋</span>
                        <h3 style="margin:0;color:#854d0e;font-size:15px;">PV${pvHeaderLabel ? ' — ' + escape(pvHeaderLabel) : ''}</h3>
                    </div>
                    <div style="display:flex;align-items:center;gap:10px;">
                        ${pvDots ? `<div style="display:flex;gap:4px;">${pvDots}</div>` : ''}
                        <a href="#/pv" style="font-size:12px;color:#ca8a04;text-decoration:none;font-weight:600;">Tout voir →</a>
                    </div>
                </div>
                <div id="pv-carousel">${cards}</div>
            </div>
        `;
    },

    renderAlertBanner() {
        if (!this.data.metrics) return '';
        const m = this.data.metrics;
        const retard = parseInt(m.ouvrages_retardes, 10) || 0;
        if (retard === 0) return '';

        return `
            <div class="alert-banner">
                <div class="alert-banner-icon">&#9888;</div>
                <div class="alert-banner-content">
                    <strong>${retard} projet${retard > 1 ? 's' : ''} en retard</strong> —
                    Action requise. Consultez les projets concernés pour mettre à jour l'avancement.
                </div>
            </div>
        `;
    },

    renderMetrics() {
        if (!this.data.metrics) return '';

        const m = this.data.metrics;
        const total = m.total_projects || 0;
        const enCours = m.actions_en_cours || 0;
        const termines = m.ouvrages_realises || 0;
        const pctTermines = total > 0 ? Math.round((termines / total) * 100) : 0;

        return `
            <div class="metrics-grid" style="grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));">
                <div class="metric-card" onclick="DashboardPage.goToProjects('')" style="cursor:pointer;" title="Voir tous les projets">
                    <div class="metric-value">${total}</div>
                    <div class="metric-label">Total projets</div>
                </div>
                <div class="metric-card" onclick="DashboardPage.goToProjects('demarrage')" style="cursor:pointer;" title="Voir les projets en démarrage">
                    <div class="metric-value">${m.projets_demarrage || 0}</div>
                    <div class="metric-label">Démarrage</div>
                </div>
                <div class="metric-card" onclick="DashboardPage.goToProjects('en_cours')" style="cursor:pointer;" title="Voir les projets en cours">
                    <div class="metric-value">${enCours}</div>
                    <div class="metric-label">En cours</div>
                </div>
                <div class="metric-card" onclick="DashboardPage.goToProjects('termine')" style="cursor:pointer;" title="Voir les projets terminés">
                    <div class="metric-value">${termines}</div>
                    <div class="metric-label">Terminés</div>
                    <div style="font-size: 11px; color: #27ae60; margin-top: 4px; font-weight: 600;">${pctTermines}% du total</div>
                </div>
                <div class="metric-card" onclick="DashboardPage.goToProjects('retard')" style="cursor:pointer;" title="Voir les projets en retard">
                    <div class="metric-value">${m.ouvrages_retardes || 0}</div>
                    <div class="metric-label">En retard</div>
                </div>
                <div class="metric-card" onclick="DashboardPage.goToProjects('', 'urgente')" style="cursor:pointer;border-left:4px solid #e74c3c;" title="Voir les projets urgents">
                    <div class="metric-value" style="color:#e74c3c;">${m.projets_urgents || 0}</div>
                    <div class="metric-label">🔴 Urgents</div>
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
                <td>
                    <span class="project-structure">${project.structure_code || 'N/A'}</span>
                    ${project.secondary_structures ? `<div style="margin-top:4px;">${project.secondary_structures.split(',').map(s => `<span style="display:inline-block;padding:2px 6px;background:#f0f4f8;color:#8896AB;border-radius:8px;font-size:10px;font-weight:600;margin-right:3px;">${s}</span>`).join('')}</div>` : ''}
                </td>
                <td><span class="status-badge status-${project.status}">${this.getStatusLabel(project.status)}</span></td>
                <td>
                    <div style="display:flex;align-items:center;gap:10px;">
                        <div class="progress-bar" style="flex:1;">
                            <div class="progress-fill" style="width: ${project.progress_percentage || 0}%;"></div>
                        </div>
                        <span style="font-weight:700;font-size:13px;color:#202B5D;min-width:36px;text-align:right;">${project.progress_percentage || 0}%</span>
                    </div>
                </td>
                <td>${project.deadline_date ? DateFormatter.format(project.deadline_date) : 'N/A'}</td>
            </tr>
        `).join('');

        const showMoreBtn = this.data.recentProjectsHasMore
            ? `<div style="display:flex;justify-content:center;padding:12px;border-top:1px solid #e5e9f0;">
                    <button onclick="DashboardPage.loadMoreRecentProjects()" id="recent-projects-more-btn" style="padding:8px 20px;background:#202B5D;color:white;border:none;border-radius:6px;cursor:pointer;font-size:13px;font-weight:600;">Voir plus</button>
               </div>`
            : '';

        return `
            <div class="card mb-4" id="recent-projects-card">
                <div class="card-header" style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;">
                    <div>
                        <h2>Projets récents</h2>
                        <p>Derniers projets créés (${this.data.recentProjects.length} affichés)</p>
                    </div>
                    <div style="display:flex;gap:8px;">
                        <button class="btn btn-secondary" onclick="DashboardPage.exportXlsx()" title="Exporter tous les projets au format Excel">
                            <span>&#128202;</span>
                            <span>Exporter Excel</span>
                        </button>
                        <button class="btn btn-secondary" onclick="DashboardPage.openReportModal()" title="Générer un rapport analytique via IA">
                            <span>&#129302;</span>
                            <span>Générer rapport</span>
                        </button>
                    </div>
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
                ${showMoreBtn}
            </div>
        `;
    },

    async loadMoreRecentProjects() {
        const btn = document.getElementById('recent-projects-more-btn');
        if (btn) { btn.disabled = true; btn.textContent = 'Chargement...'; }
        this.data.recentProjectsLimit += 10;
        const res = await API.dashboard.getRecentProjects(this.data.recentProjectsLimit + 1);
        const recentData = res.data || [];
        this.data.recentProjectsHasMore = recentData.length > this.data.recentProjectsLimit;
        this.data.recentProjects = recentData.slice(0, this.data.recentProjectsLimit);
        const card = document.getElementById('recent-projects-card');
        if (card) {
            const tmp = document.createElement('div');
            tmp.innerHTML = this.renderRecentProjects();
            card.replaceWith(tmp.firstElementChild);
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

    async openReportModal() {
        let structures = [];
        try {
            const resp = await API.structures.getAll();
            structures = resp.data || [];
        } catch (e) { console.error(e); }

        const structureOptions = structures.map(s =>
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
                    <button class="confirm-btn confirm-btn-ok" style="background:#202B5D;" id="report-generate-btn" onclick="DashboardPage.generateReport()">Générer</button>
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

    renderMap() {
        return `
            <div class="card" id="map-card">
                <div class="card-header" style="display:flex;justify-content:space-between;align-items:flex-start;">
                    <div>
                        <h2>Carte des interventions</h2>
                        <p>Sites d'intervention au Sénégal</p>
                    </div>
                    <button onclick="DashboardPage.toggleMapFullscreen()" id="map-fullscreen-btn"
                        title="Agrandir la carte"
                        style="padding:8px 12px;background:#202B5D;color:white;border:none;border-radius:6px;cursor:pointer;font-size:12px;font-weight:600;display:flex;align-items:center;gap:6px;">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M8 3H5a2 2 0 00-2 2v3m18 0V5a2 2 0 00-2-2h-3m0 18h3a2 2 0 002-2v-3M3 16v3a2 2 0 002 2h3"/></svg>
                        Plein écran
                    </button>
                </div>
                <div id="senegal-map" class="map-container"></div>
            </div>
        `;
    },

    toggleMapFullscreen() {
        const card = document.getElementById('map-card');
        const btn = document.getElementById('map-fullscreen-btn');
        if (!card) return;
        const isFs = card.classList.toggle('map-fullscreen');
        if (isFs) {
            card.style.cssText = 'position:fixed;inset:0;z-index:9999;margin:0;border-radius:0;max-width:none;';
            const mapEl = document.getElementById('senegal-map');
            if (mapEl) mapEl.style.height = 'calc(100vh - 90px)';
            if (btn) btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M8 3v3a2 2 0 01-2 2H3m18 0h-3a2 2 0 01-2-2V3m0 18v-3a2 2 0 012-2h3M3 16h3a2 2 0 012 2v3"/></svg> Quitter plein écran';
        } else {
            card.style.cssText = '';
            const mapEl = document.getElementById('senegal-map');
            if (mapEl) mapEl.style.height = '';
            if (btn) btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M8 3H5a2 2 0 00-2 2v3m18 0V5a2 2 0 00-2-2h-3m0 18h3a2 2 0 002-2v-3M3 16v3a2 2 0 002 2h3"/></svg> Plein écran';
        }
        setTimeout(() => { if (this.map) this.map.invalidateSize(); }, 100);
    },

    initMap() {
        const mapEl = document.getElementById('senegal-map');
        if (!mapEl || typeof L === 'undefined') return;

        // Destroy previous map if exists
        if (this.map) { this.map.remove(); this.map = null; }

        // Limites du Sénégal
        const senegalBounds = L.latLngBounds(
            [12.3, -17.6],  // Sud-Ouest
            [16.7, -11.3]   // Nord-Est
        );

        this.map = L.map('senegal-map', {
            zoomControl: true,
            scrollWheelZoom: true,
            maxBounds: senegalBounds.pad(0.1),
            minZoom: 7
        }).fitBounds(senegalBounds);

        const osmLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; OpenStreetMap',
            maxZoom: 19
        });
        const satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
            attribution: 'Tiles &copy; Esri — Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community',
            maxZoom: 19
        });
        const satelliteLabelsLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', {
            attribution: '&copy; Esri',
            maxZoom: 19,
            pane: 'overlayPane'
        });
        const satelliteGroup = L.layerGroup([satelliteLayer, satelliteLabelsLayer]);

        osmLayer.addTo(this.map);
        L.control.layers(
            { 'Plan': osmLayer, 'Satellite': satelliteGroup },
            null,
            { position: 'topright', collapsed: false }
        ).addTo(this.map);

        // Masque : tout ce qui n'est pas le Sénégal est grisé
        this.addSenegalMask();

        const sites = this.data.mapSites || [];
        if (sites.length === 0) {
            // Default marker for Dakar if no sites
            L.marker([14.6928, -17.4467]).addTo(this.map)
                .bindPopup('<strong>Dakar</strong><br>Aucun site enregistré');
            return;
        }

        const bounds = [];
        // Regroupe les marqueurs par code de structure pour pouvoir les filtrer
        this.markersByStructure = {};
        sites.forEach(site => {
            const lat = parseFloat(site.latitude);
            const lng = parseFloat(site.longitude);
            if (isNaN(lat) || isNaN(lng)) return;

            bounds.push([lat, lng]);
            // Couleur par structure (unifiée avec le graphique)
            const color = StructureColors.get(site.structure_code);
            const isUrgent = site.project_priority === 'urgente';
            const isHaute = site.project_priority === 'haute';

            // Marqueur plus grand + anneau rouge pulsant pour les projets urgents
            const size = isUrgent ? 20 : isHaute ? 17 : 14;
            const ring = isUrgent
                ? `<div style="position:absolute;inset:-6px;border:2px solid #e74c3c;border-radius:50%;animation:pulse-urgent 1.4s infinite;"></div>`
                : isHaute
                ? `<div style="position:absolute;inset:-4px;border:2px solid #e67e22;border-radius:50%;"></div>`
                : '';

            const isPcs = !!site.is_pcs;
            // PCS utilise la même taille que le rond pour rester cohérent visuellement
            const pcsSize = size + 2; // légèrement plus grand pour compenser la place du SVG
            const svgPx = Math.round(pcsSize * 0.7);
            const pcsHtml = `
                <div style="position:relative;width:${pcsSize}px;height:${pcsSize}px;display:flex;align-items:center;justify-content:center;">
                    ${ring}
                    <div style="width:${pcsSize}px;height:${pcsSize}px;background:white;border:1.5px solid ${color};border-radius:50%;box-shadow:0 1px 4px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;">
                        <svg width="${svgPx}" height="${svgPx}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M3 10l9-6 9 6M4 10v9M8 10v9M12 10v9M16 10v9M20 10v9M2 21h20"/>
                        </svg>
                    </div>
                </div>`;

            const circleHtml = `<div style="position:relative;width:${size}px;height:${size}px;">
                        ${ring}
                        <div style="width:${size}px;height:${size}px;background:${color};border:2.5px solid white;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,0.3);"></div>
                       </div>`;

            const icon = L.divIcon({
                className: 'custom-marker',
                html: isPcs ? pcsHtml : circleHtml,
                iconSize: isPcs ? [pcsSize, pcsSize] : [size, size],
                iconAnchor: isPcs ? [pcsSize/2, pcsSize/2] : [size/2, size/2]
            });

            const priorityBadge = isUrgent
                ? '<span style="display:inline-block;padding:2px 8px;border-radius:10px;font-size:10px;font-weight:700;color:white;background:#e74c3c;margin-left:4px;">🔴 URGENT</span>'
                : isHaute
                ? '<span style="display:inline-block;padding:2px 8px;border-radius:10px;font-size:10px;font-weight:700;color:white;background:#e67e22;margin-left:4px;">🟠 HAUTE</span>'
                : '';
            const pcsBadge = isPcs
                ? `<span style="display:inline-block;padding:2px 8px;border-radius:10px;font-size:10px;font-weight:700;color:white;background:${color};margin-left:4px;">📎 PCS</span>`
                : '';

            const marker = L.marker([lat, lng], { icon });
            const code = site.structure_code || '—';
            if (!this.markersByStructure[code]) this.markersByStructure[code] = [];
            this.markersByStructure[code].push(marker);
            marker.addTo(this.map)
                .bindPopup(`
                    <div style="min-width:200px;">
                        <strong style="color:#202B5D;font-size:13px;">${site.name}</strong>${priorityBadge}${pcsBadge}<br>
                        <span style="font-size:12px;color:#62718D;">${site.description || ''}</span>
                        <hr style="margin:6px 0;border:none;border-top:1px solid #eee;">
                        <span style="font-size:11px;color:#62718D;">Projet:</span><br>
                        <strong style="font-size:12px;">${site.project_title}</strong><br>
                        <span style="display:inline-block;margin-top:4px;padding:2px 8px;border-radius:10px;font-size:10px;font-weight:600;color:white;background:${color};">
                            ${site.structure_code}
                        </span>
                        <div style="margin-top:10px;">
                            <a href="#/projects/${site.project_id}" style="display:inline-block;padding:6px 12px;background:#202B5D;color:white;text-decoration:none;border-radius:6px;font-size:12px;font-weight:600;">
                                Voir détails →
                            </a>
                        </div>
                    </div>
                `);
        });

        if (bounds.length > 1) {
            this.map.fitBounds(bounds, { padding: [30, 30], maxZoom: 14 });
        } else if (bounds.length === 1) {
            this.map.setView(bounds[0], 13);
        }

        this.addStructureFilterControl();
    },

    async addSenegalMask() {
        if (!this.map) return;
        try {
            const resp = await fetch('/data/senegal.geojson');
            if (!resp.ok) return;
            const gj = await resp.json();

            // Récupère la ou les géométries externes (polygone ou multipolygone)
            const rings = [];
            for (const feat of gj.features || []) {
                const g = feat.geometry || {};
                if (g.type === 'Polygon') {
                    // Leaflet [lat,lng] vs GeoJSON [lng,lat]
                    rings.push(g.coordinates[0].map(c => [c[1], c[0]]));
                } else if (g.type === 'MultiPolygon') {
                    g.coordinates.forEach(poly => rings.push(poly[0].map(c => [c[1], c[0]])));
                }
            }
            if (rings.length === 0) return;

            // Élargit chaque anneau d'environ ~5 km depuis son centroïde pour que
            // les labels des villes frontalières (Saint-Louis, Bakel, Ziguinchor…)
            // restent visibles sans être coupés par le masque.
            const inflateRing = (ring, factor) => {
                const n = ring.length;
                let cLat = 0, cLng = 0;
                ring.forEach(p => { cLat += p[0]; cLng += p[1]; });
                cLat /= n; cLng /= n;
                return ring.map(([lat, lng]) => [
                    cLat + (lat - cLat) * factor,
                    cLng + (lng - cLng) * factor
                ]);
            };
            const paddedRings = rings.map(r => inflateRing(r, 1.012));

            // Polygone "beignet" : anneau extérieur = monde entier ;
            // anneaux intérieurs (holes) = Sénégal légèrement élargi pour ne pas couper
            // les labels des villes frontalières (Saint-Louis, Bakel, Ziguinchor…)
            const worldRing = [[-89, -179], [-89, 179], [89, 179], [89, -179]];
            const mask = L.polygon([worldRing, ...paddedRings], {
                stroke: false,
                fillColor: '#f0f4f8',
                fillOpacity: 1,
                interactive: false,
                smoothFactor: 1.5
            });
            mask.addTo(this.map);

            // Fin contour du Sénégal (utilise les frontières réelles, pas le padding)
            L.polygon(rings, {
                color: '#202B5D',
                weight: 2,
                fill: false,
                interactive: false
            }).addTo(this.map);
        } catch (e) {
            console.warn('Masque Sénégal non chargé:', e.message);
        }
    },

    addStructureFilterControl() {
        if (!this.map || !this.markersByStructure) return;
        // Retire un éventuel contrôle précédent
        if (this._structureFilterCtrl) this._structureFilterCtrl.remove();

        const codes = Object.keys(this.markersByStructure).sort();
        if (codes.length < 2) return; // inutile s'il n'y a qu'une structure

        const StructureFilter = L.Control.extend({
            options: { position: 'topleft' },
            onAdd: () => {
                const div = L.DomUtil.create('div', 'leaflet-bar structure-filter');
                div.style.background = 'white';
                div.style.padding = '8px 10px';
                div.style.borderRadius = '8px';
                div.style.boxShadow = '0 1px 5px rgba(0,0,0,0.3)';
                div.style.fontSize = '12px';
                div.style.lineHeight = '1.6';
                div.style.maxWidth = '180px';
                // Construction via DOM API pour éviter toute injection via structure_code
                const header = document.createElement('div');
                header.style.cssText = 'font-weight:700;color:#202B5D;margin-bottom:6px;border-bottom:1px solid #eef;padding-bottom:4px;';
                header.textContent = 'Structures';
                div.appendChild(header);

                codes.forEach(code => {
                    const color = (typeof StructureColors !== 'undefined') ? StructureColors.get(code) : '#3794C4';
                    const count = this.markersByStructure[code].length;
                    const label = document.createElement('label');
                    label.style.cssText = 'display:flex;align-items:center;gap:6px;cursor:pointer;';
                    const cb = document.createElement('input');
                    cb.type = 'checkbox';
                    cb.className = 'structure-filter-cb';
                    cb.setAttribute('data-code', code);
                    cb.checked = true;
                    const swatch = document.createElement('span');
                    swatch.style.cssText = `display:inline-block;width:10px;height:10px;border-radius:50%;background:${color};flex-shrink:0;`;
                    const codeSpan = document.createElement('span');
                    codeSpan.style.cssText = 'flex:1;color:#202B5D;font-weight:600;';
                    codeSpan.textContent = code;
                    const countSpan = document.createElement('span');
                    countSpan.style.color = '#8896AB';
                    countSpan.textContent = count;
                    label.append(cb, swatch, codeSpan, countSpan);
                    div.appendChild(label);
                });

                const footer = document.createElement('div');
                footer.style.cssText = 'display:flex;gap:6px;margin-top:6px;border-top:1px solid #eef;padding-top:6px;';
                footer.innerHTML = `
                    <a href="#" class="structure-filter-all" style="font-size:11px;color:#3794C4;text-decoration:none;font-weight:600;">Tout</a>
                    <span style="color:#ccc;">·</span>
                    <a href="#" class="structure-filter-none" style="font-size:11px;color:#8896AB;text-decoration:none;font-weight:600;">Aucun</a>
                `;
                div.appendChild(footer);
                L.DomEvent.disableClickPropagation(div);
                L.DomEvent.disableScrollPropagation(div);
                return div;
            }
        });

        this._structureFilterCtrl = new StructureFilter().addTo(this.map);

        const container = document.querySelector('.structure-filter');
        if (container) {
            container.addEventListener('change', (e) => {
                if (!e.target.matches('.structure-filter-cb')) return;
                const code = e.target.dataset.code;
                const visible = e.target.checked;
                (this.markersByStructure[code] || []).forEach(m => {
                    if (visible) m.addTo(this.map);
                    else this.map.removeLayer(m);
                });
            });
            container.querySelector('.structure-filter-all')?.addEventListener('click', (e) => {
                e.preventDefault();
                container.querySelectorAll('.structure-filter-cb').forEach(cb => {
                    if (!cb.checked) { cb.checked = true; cb.dispatchEvent(new Event('change', { bubbles: true })); }
                });
            });
            container.querySelector('.structure-filter-none')?.addEventListener('click', (e) => {
                e.preventDefault();
                container.querySelectorAll('.structure-filter-cb').forEach(cb => {
                    if (cb.checked) { cb.checked = false; cb.dispatchEvent(new Event('change', { bubbles: true })); }
                });
            });
        }
    },

    renderGantt() {
        const projects = this.data.allProjects || [];
        if (projects.length === 0) return '';

        // Filter projects with dates
        const withDates = projects.filter(p => p.start_date && p.deadline_date);
        if (withDates.length === 0) return '';

        // Calculate date range
        const allStarts = withDates.map(p => new Date(p.start_date).getTime());
        const allEnds = withDates.map(p => new Date(p.deadline_date).getTime());
        const minDate = new Date(Math.min(...allStarts));
        const maxDate = new Date(Math.max(...allEnds));

        // Extend range by 1 month on each side
        const rangeStart = new Date(minDate.getFullYear(), minDate.getMonth(), 1);
        const rangeEnd = new Date(maxDate.getFullYear(), maxDate.getMonth() + 2, 0);
        const totalDays = (rangeEnd - rangeStart) / (1000 * 60 * 60 * 24);

        // Generate month headers
        const months = [];
        const cursor = new Date(rangeStart);
        while (cursor <= rangeEnd) {
            const monthStart = new Date(cursor);
            const monthEnd = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
            const startOffset = Math.max(0, (monthStart - rangeStart) / (1000 * 60 * 60 * 24));
            const width = ((Math.min(monthEnd, rangeEnd) - Math.max(monthStart, rangeStart)) / (1000 * 60 * 60 * 24)) / totalDays * 100;
            const label = monthStart.toLocaleDateString('fr-FR', { month: 'short', year: cursor.getFullYear() !== new Date().getFullYear() ? '2-digit' : undefined });
            months.push({ label, left: (startOffset / totalDays) * 100, width });
            cursor.setMonth(cursor.getMonth() + 1);
        }

        // Today marker
        const today = new Date();
        const todayPos = ((today - rangeStart) / (1000 * 60 * 60 * 24)) / totalDays * 100;

        const statusColors = {
            'en_cours': '#3794C4',
            'termine': '#27ae60',
            'retard': '#e74c3c',
            'demarrage': '#f39c12',
            'annule': '#8896AB'
        };

        const rows = withDates.map(p => {
            const start = new Date(p.start_date);
            const end = new Date(p.deadline_date);
            const left = ((start - rangeStart) / (1000 * 60 * 60 * 24)) / totalDays * 100;
            const width = ((end - start) / (1000 * 60 * 60 * 24)) / totalDays * 100;
            const color = statusColors[p.status] || '#3794C4';
            const progress = p.progress_percentage || 0;

            return `
                <div style="display:flex;align-items:center;height:36px;border-bottom:1px solid #f0f4f8;">
                    <div style="width:200px;flex-shrink:0;padding:0 12px;font-size:12px;font-weight:600;color:#202B5D;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${p.title}">
                        ${p.title}
                    </div>
                    <div style="flex:1;position:relative;height:100%;">
                        <div style="position:absolute;left:${left}%;width:${Math.max(width, 0.5)}%;top:8px;height:20px;border-radius:4px;background:#e8ecf1;overflow:hidden;" title="${p.title} — ${progress}%">
                            <div style="width:${progress}%;height:100%;background:${color};border-radius:4px;transition:width 0.3s;"></div>
                        </div>
                        <span style="position:absolute;left:${left + width + 0.5}%;top:10px;font-size:10px;font-weight:700;color:${color};">${progress}%</span>
                    </div>
                </div>
            `;
        }).join('');

        return `
            <div class="card" id="gantt-container">
                <div class="card-header">
                    <h2>Planning des projets</h2>
                    <p>Diagramme de Gantt — vue calendaire</p>
                </div>
                <div style="overflow-x:auto;">
                    <div style="min-width:800px;">
                        <!-- Month headers -->
                        <div style="display:flex;align-items:center;height:30px;border-bottom:2px solid #dce3ed;">
                            <div style="width:200px;flex-shrink:0;padding:0 12px;font-size:11px;font-weight:700;color:#8896AB;">PROJET</div>
                            <div style="flex:1;position:relative;height:100%;">
                                ${months.map(m => `
                                    <div style="position:absolute;left:${m.left}%;width:${m.width}%;height:100%;border-left:1px solid #e8ecf1;padding:0 6px;font-size:10px;font-weight:600;color:#8896AB;display:flex;align-items:center;">
                                        ${m.label}
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                        <!-- Project rows -->
                        ${rows}
                        <!-- Today marker -->
                        ${todayPos >= 0 && todayPos <= 100 ? `
                            <div style="position:relative;height:0;">
                                <div style="position:absolute;left:calc(200px + ${todayPos}% * (100% - 200px) / 100);top:-${(withDates.length) * 36 + 30}px;width:2px;height:${(withDates.length) * 36 + 30}px;background:#e74c3c;opacity:0.5;z-index:1;pointer-events:none;"></div>
                            </div>
                        ` : ''}
                    </div>
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
            const color = StructureColors.get(structure.code);
            
            return `
                <div style="flex: 1; max-width: 100px; display: flex; flex-direction: column; align-items: center; gap: 12px;">
                    <div style="width: 60px; height: ${height}px; background: ${color}; border-radius: 8px 8px 0 0; position: relative;">
                        <span style="position: absolute; top: -30px; left: 50%; transform: translateX(-50%); font-weight: 700; color: #202B5D; font-size: 16px;">
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
            <div class="card mb-4" style="background: linear-gradient(135deg, #202B5D 0%, #3794C4 100%); color: white;">
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
                    <div style="width: 60px; height: 60px; background: linear-gradient(135deg, #202B5D 0%, #3794C4 100%); color: white; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 24px; font-weight: 700; flex-shrink: 0;">
                        ${index + 1}
                    </div>

                    <!-- Informations du projet -->
                    <div style="flex: 1;">
                        <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 12px;">
                            <h3 style="margin: 0; color: #202B5D; font-size: 20px;">${project.title}</h3>
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
                                <span style="font-size: 16px; font-weight: 700; color: #202B5D;">
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

    switchView(view) {
        const mapDiv = document.getElementById('view-map');
        const ganttDiv = document.getElementById('view-gantt');
        const btnMap = document.getElementById('view-btn-map');
        const btnGantt = document.getElementById('view-btn-gantt');
        if (!mapDiv || !ganttDiv) return;

        if (view === 'gantt') {
            mapDiv.style.display = 'none';
            ganttDiv.style.display = 'block';
            btnMap.style.background = 'transparent'; btnMap.style.color = '#62718D';
            btnGantt.style.background = '#202B5D'; btnGantt.style.color = 'white';
        } else {
            mapDiv.style.display = 'grid';
            ganttDiv.style.display = 'none';
            btnMap.style.background = '#202B5D'; btnMap.style.color = 'white';
            btnGantt.style.background = 'transparent'; btnGantt.style.color = '#62718D';
            // Re-init map (Leaflet needs resize after show)
            setTimeout(() => { if (this.map) this.map.invalidateSize(); }, 100);
        }
    },

    goToProjects(status, priority) {
        sessionStorage.setItem('projectStatusFilter', status || '');
        sessionStorage.setItem('projectPriorityFilter', priority || '');
        if (window.location.hash === '#/projects') {
            // Already on projects page, force re-render
            App.router();
        } else {
            window.location.hash = '#/projects';
        }
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
        // Init map after DOM is ready
        setTimeout(() => this.initMap(), 100);
        this.startCarousels();
    },

    _carouselTimers: [],

    startCarousels() {
        // Clear previous timers (navigation between pages)
        this._carouselTimers.forEach(t => clearInterval(t));
        this._carouselTimers = [];

        const rotate = (slideSel, dotSel, activeColor) => {
            const slides = document.querySelectorAll(slideSel);
            const dots = document.querySelectorAll(dotSel);
            if (slides.length < 2) return;
            slides.forEach(s => { s.style.transition = 'opacity 0.4s ease, transform 0.4s ease'; });
            let idx = 0;
            const t = setInterval(() => {
                const cur = slides[idx];
                cur.style.opacity = '0';
                cur.style.transform = 'translateX(-12px)';
                if (dots[idx]) dots[idx].style.background = '#d1d5db';
                setTimeout(() => {
                    cur.style.display = 'none';
                    idx = (idx + 1) % slides.length;
                    const next = slides[idx];
                    next.style.display = 'block';
                    next.style.opacity = '0';
                    next.style.transform = 'translateX(12px)';
                    // force reflow so the transition plays
                    void next.offsetWidth;
                    next.style.opacity = '1';
                    next.style.transform = 'translateX(0)';
                    if (dots[idx]) dots[idx].style.background = activeColor;
                }, 400);
            }, 10000);
            this._carouselTimers.push(t);
        };
        rotate('.obs-slide', '.obs-dot', '#202B5D');
        rotate('.pv-slide', '.pv-dot', '#eab308');
    }
};

