// Page détail d'un projet

const ProjectDetailPage = {
    data: {
        project: null,
        users: [],
        allUsers: [],
        structures: [],
        comments: [],
        documents: [],
        measureTypes: [],
        measureStatuses: [],
        editMode: {
            localities: [],
            sites: [],
            measures: [],
            funding: []
        }
    },

    async render(id) {
        try {
            const response = await API.projects.getById(id);
            this.data.project = response.data;

            // Charger tous les utilisateurs + toutes les structures (pour réassignation multi-structures)
            const usersResponse = await API.users.getAll();
            this.data.allUsers = (usersResponse.data || []).filter(u => u.role === 'utilisateur');
            this.data.users = this.data.project.structure_id
                ? this.data.allUsers.filter(u => u.structure_id === this.data.project.structure_id)
                : this.data.allUsers;

            const structuresResponse = await API.structures.getAll();
            this.data.structures = structuresResponse.data || [];

            // Load config, comments, documents in parallel
            const [typesRes, statusesRes, commentsRes, docsRes] = await Promise.all([
                API.config.getByCategory('measure_type'),
                API.config.getByCategory('measure_status'),
                API.projects.getComments(id),
                API.uploads.getByEntity('project', id)
            ]);
            this.data.measureTypes = typesRes.data || [];
            this.data.measureStatuses = statusesRes.data || [];
            this.data.comments = commentsRes.data || [];
            this.data.documents = docsRes.data || [];

            // Initialiser les données d'édition
            this.data.editMode.localities = JSON.parse(JSON.stringify(this.data.project.localities || []));
            this.data.editMode.sites = JSON.parse(JSON.stringify(this.data.project.sites || []));
            this.data.editMode.measures = JSON.parse(JSON.stringify(this.data.project.measures || []));
            this.data.editMode.funding = JSON.parse(JSON.stringify(this.data.project.funding || []));

            return `
                ${Navbar.render()}
                <div class="main-content with-sidebar">
                    ${Navbar.renderTopBar('Détail du projet')}
                    <div class="content-area">
                        ${this.renderProjectInfo()}
                        ${this.renderBudgetAndProgress()}
                        ${this.renderLocalitiesAndSitesEditable()}
                        ${this.renderMeasuresEditable()}
                        ${this.renderFinancingEditable()}
                        ${this.renderDocuments()}
                        ${this.renderProjectComments()}
                    </div>
                </div>
            `;
        } catch (error) {
            console.error('Error loading project:', error);
            return `
                ${Navbar.render()}
                <div class="main-content with-sidebar">
                    ${Navbar.renderTopBar('Erreur')}
                    <div class="content-area">
                        <div class="alert alert-error">Projet non trouvé</div>
                        <a href="#/projects" class="btn btn-secondary">← Retour aux projets</a>
                    </div>
                </div>
            `;
        }
    },

    renderProjectInfo() {
        const p = this.data.project;
        const statusLabel = this.getStatusLabel(p.status);

        return `
            <div class="card mb-4">
                <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 24px;">
                    <div>
                        <h2 style="font-size: 24px; color: #1e3c72; margin-bottom: 8px;">${p.title}</h2>
                        <div style="color: #666; margin-bottom: 12px;">
                            Structure principale: <span style="font-weight: 600;">${p.structure_name || 'N/A'}</span>
                            ${(() => {
                                const mainColor = StructureColors.get(p.structure_code);
                                // Union: structures explicitement assignées + structures portées par au moins une mesure
                                const fromMeasures = (p.measures || [])
                                    .filter(m => m.structure_id && m.structure_id !== p.structure_id)
                                    .map(m => ({ id: m.structure_id, code: m.structure_code, name: m.structure_name }));
                                const explicitSecondaries = (p.assigned_structures || []).filter(s => s.id !== p.structure_id);
                                const allSecondaries = [...explicitSecondaries];
                                fromMeasures.forEach(fm => {
                                    if (fm.code && !allSecondaries.some(s => s.id === fm.id)) allSecondaries.push(fm);
                                });
                                return `
                                <div style="margin-top: 6px; display: flex; flex-wrap: wrap; gap: 6px; align-items: center;">
                                    <span style="display:inline-block;padding:4px 12px;background:${mainColor};color:white;border-radius:12px;font-size:11px;font-weight:700;">${p.structure_code || 'N/A'}</span>
                                    ${allSecondaries.map(s => `
                                        <span style="display:inline-block;padding:3px 10px;background:#f0f4f8;color:${StructureColors.get(s.code)};border-radius:12px;font-size:10px;font-weight:700;" title="${s.name || ''}">${s.code}</span>
                                    `).join('')}
                                </div>
                                `;
                            })()}
                        </div>
                        <span class="status-badge status-${p.status}">${statusLabel}</span>
                    </div>
                    ${Auth.hasRole('admin') ? `
                        <a href="#/projects/${p.id}/edit" class="btn btn-secondary">✏️ Modifier le projet</a>
                    ` : ''}
                </div>

                <div style="margin-top: 24px;">
                    <h3 style="font-size: 16px; margin-bottom: 12px; color: #333;">Description</h3>
                    <p style="color: #555; line-height: 1.6;">${p.description || 'Aucune description'}</p>
                </div>

                ${p.constraints ? `
                <div style="margin-top: 20px;">
                    <h3 style="font-size: 16px; margin-bottom: 12px; color: #333;">Contraintes</h3>
                    <p style="color: #555; line-height: 1.6; white-space: pre-wrap;">${p.constraints}</p>
                </div>` : ''}

                ${p.expected_measures ? `
                <div style="margin-top: 20px;">
                    <h3 style="font-size: 16px; margin-bottom: 12px; color: #333;">Mesures attendues</h3>
                    <p style="color: #555; line-height: 1.6; white-space: pre-wrap;">${p.expected_measures}</p>
                </div>` : ''}

                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 24px; margin-top: 24px; padding-top: 24px; border-top: 1px solid #e0e0e0;">
                    <div>
                        <div style="font-size: 12px; color: #999; text-transform: uppercase; margin-bottom: 4px;">Date de début</div>
                        <div style="font-weight: 600; color: #333;">${p.start_date ? DateFormatter.format(p.start_date) : 'Non définie'}</div>
                    </div>
                    <div>
                        <div style="font-size: 12px; color: #999; text-transform: uppercase; margin-bottom: 4px;">Échéance</div>
                        <div style="font-weight: 600; color: #333;">${p.deadline_date ? DateFormatter.format(p.deadline_date) : 'Non définie'}</div>
                    </div>
                    <div>
                        <div style="font-size: 12px; color: #999; text-transform: uppercase; margin-bottom: 4px;">Priorité</div>
                        <div style="font-weight: 700; color: ${p.priority === 'urgente' ? '#e74c3c' : p.priority === 'haute' ? '#e67e22' : '#333'};">
                            ${p.priority === 'urgente' ? '🔴 Urgente' : p.priority === 'haute' ? '🟠 Haute' : 'Normale'}
                        </div>
                    </div>
                    <div>
                        <div style="font-size: 12px; color: #999; text-transform: uppercase; margin-bottom: 4px;">Type de projet</div>
                        <div style="font-weight: 600; color: #333;">${p.project_type === 'renforcement_resilience' ? 'Renforcement de la résilience' : p.project_type === 'structurant' ? 'Structurant' : '—'}</div>
                    </div>
                </div>
            </div>
        `;
    },

    renderBudgetAndProgress() {
        const p = this.data.project;
        const currentUser = Auth.getUser();
        const isProjectManager = p.project_manager_id === currentUser?.id || Auth.hasRole('admin');
        
        return `
            <div class="card mb-4">
                <h2 style="margin-bottom: 24px;">Budget et Avancement</h2>
                
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 24px;">
                    <div>
                        <label style="display: block; font-weight: 600; margin-bottom: 8px; color: #333;">
                            Budget (FCFA)
                        </label>
                        ${isProjectManager ? `
                            <input type="number" id="edit-budget" class="form-control" 
                                   value="${p.budget || ''}" 
                                   placeholder="Ex: 50000000" step="1000">
                        ` : `
                            <div style="padding: 12px; background: #f5f7fa; border-radius: 6px; font-size: 18px; font-weight: 600; color: #1e3c72;">
                                ${p.budget ? p.budget.toLocaleString() + ' FCFA' : 'Non défini'}
                            </div>
                        `}
                    </div>

                    <div>
                        <label style="display: block; font-weight: 600; margin-bottom: 8px; color: #333;">
                            Avancement (%)
                        </label>
                        ${isProjectManager ? `
                            <input type="number" id="edit-progress" class="form-control" 
                                   value="${p.progress_percentage || 0}" 
                                   min="0" max="100" step="5">
                        ` : `
                            <div style="padding: 12px; background: #f5f7fa; border-radius: 6px; font-size: 18px; font-weight: 600; color: #1e3c72;">
                                ${p.progress_percentage || 0}%
                            </div>
                        `}
                    </div>
                </div>

                ${isProjectManager ? `
                    <div style="margin-top: 20px; display: flex; justify-content: flex-end;">
                        <button class="btn btn-primary" onclick="ProjectDetailPage.updateBudgetAndProgress()">
                            💾 Enregistrer
                        </button>
                    </div>
                ` : ''}
            </div>
        `;
    },

    renderLocalitiesAndSitesEditable() {
        const currentUser = Auth.getUser();
        const isProjectManager = this.data.project.project_manager_id === currentUser?.id || Auth.hasRole('admin');
        
        return `
            <div class="card mb-4">
                <h2 style="margin-bottom: 24px;">📍 Localités et Sites</h2>
                
                <!-- Localités -->
                <h3 style="font-size: 16px; margin-bottom: 16px; color: #333;">Localités</h3>
                <div id="localities-container">
                    ${this.data.editMode.localities.map((loc, index) => `
                        <div class="locality-item" style="padding: 16px; background: #f8f9fa; border-radius: 8px; margin-bottom: 12px;" data-index="${index}">
                            ${isProjectManager ? `
                                <div style="display: flex; gap: 10px; align-items: start; margin-bottom: 8px;">
                                    <div style="flex:1; position:relative;">
                                        <input type="text" class="form-control loc-search" data-index="${index}"
                                               placeholder="Rechercher une commune, arrondissement, département..."
                                               oninput="ProjectDetailPage.onLocationSearch(${index}, 'loc', this.value)"
                                               onfocus="ProjectDetailPage.onLocationSearch(${index}, 'loc', this.value)"
                                               autocomplete="off">
                                        <div class="search-results" id="loc-results-${index}" style="display:none;position:absolute;top:100%;left:0;right:0;z-index:100;background:white;border:1px solid #dce3ed;border-radius:0 0 8px 8px;max-height:250px;overflow-y:auto;box-shadow:0 4px 12px rgba(0,0,0,0.1);"></div>
                                    </div>
                                    <button class="btn btn-danger" onclick="ProjectDetailPage.removeLocality(${index})" style="font-size: 12px; white-space:nowrap;">
                                        Retirer
                                    </button>
                                </div>
                                <div style="display:grid; grid-template-columns:repeat(4,1fr); gap:8px;">
                                    <select class="form-control loc-region" data-index="${index}"
                                            onchange="ProjectDetailPage.onLocalityRegionChange(${index}, this.value)">
                                        <option value="">-- Région --</option>
                                    </select>
                                    <select class="form-control loc-dept" data-index="${index}"
                                            onchange="ProjectDetailPage.onLocalityDeptChange(${index}, this.value)">
                                        <option value="">-- Département --</option>
                                    </select>
                                    <select class="form-control loc-arrond" data-index="${index}"
                                            onchange="ProjectDetailPage.onLocalityArrondChange(${index}, this.value)">
                                        <option value="">-- Arrondissement --</option>
                                    </select>
                                    <select class="form-control loc-commune" data-index="${index}"
                                            onchange="ProjectDetailPage.updateLocalityField(${index}, 'commune', this.value)">
                                        <option value="">-- Commune --</option>
                                    </select>
                                </div>
                            ` : `
                                <div style="display:grid; grid-template-columns:repeat(4,1fr); gap:8px;">
                                    <div><strong>Région:</strong> ${loc.region || 'N/A'}</div>
                                    <div><strong>Département:</strong> ${loc.departement || 'N/A'}</div>
                                    <div><strong>Arrondissement:</strong> ${loc.arrondissement || 'N/A'}</div>
                                    <div><strong>Commune:</strong> ${loc.commune || 'N/A'}</div>
                                </div>
                            `}
                        </div>
                    `).join('')}
                </div>

                ${isProjectManager ? `
                    <button class="btn btn-secondary" onclick="ProjectDetailPage.addLocality()" style="margin-top: 12px;">
                        + Ajouter une localité
                    </button>
                ` : ''}

                <!-- Sites -->
                <h3 style="font-size: 16px; margin: 24px 0 16px; color: #333;">Sites</h3>
                <div id="sites-container">
                    ${this.data.editMode.sites.map((site, index) => `
                        <div class="site-item" style="padding: 16px; background: #f8f9fa; border-radius: 8px; margin-bottom: 12px;" data-index="${index}">
                            ${isProjectManager ? `
                                <div style="display: grid; grid-template-columns: 1fr 1fr auto auto auto auto; gap: 10px; margin-bottom: 10px; align-items: center;">
                                    <input type="text" class="form-control" placeholder="Nom du site"
                                           value="${site.name || ''}"
                                           onchange="ProjectDetailPage.updateSiteField(${index}, 'name', this.value)">
                                    <input type="text" class="form-control" placeholder="Description"
                                           value="${site.description || ''}"
                                           onchange="ProjectDetailPage.updateSiteField(${index}, 'description', this.value)">
                                    <input type="text" class="form-control" placeholder="Lat,Lng" style="max-width:140px;"
                                           value="${site.latitude && site.longitude ? site.latitude + ',' + site.longitude : ''}"
                                           onchange="ProjectDetailPage.updateSiteCoordinates(${index}, this.value)">
                                    <button class="btn btn-secondary" onclick="ProjectDetailPage.openMapPicker(${index})" title="Choisir la position sur une carte" style="font-size:12px;">
                                        🗺️ Carte
                                    </button>
                                    <button class="btn btn-secondary" onclick="ProjectDetailPage.autoFillSiteFromCoords(${index})" title="Déduire région/département/arrondissement/commune depuis les coordonnées GPS" style="font-size:12px;">
                                        📍 Auto
                                    </button>
                                    <button class="btn btn-danger" onclick="ProjectDetailPage.removeSite(${index})" style="font-size:12px;">
                                        Retirer
                                    </button>
                                </div>
                                ${this.data.project.structure_code === 'DPGI' ? `
                                    <label style="display:inline-flex;align-items:center;gap:6px;font-size:12px;color:#62718D;margin-bottom:8px;cursor:pointer;">
                                        <input type="checkbox" ${site.is_pcs ? 'checked' : ''}
                                               onchange="ProjectDetailPage.updateSiteField(${index}, 'is_pcs', this.checked)">
                                        🏛️ PCS (Plan Communal de Sauvegarde)
                                    </label>
                                ` : ''}
                                <label style="display:inline-flex;align-items:center;gap:6px;font-size:12px;color:#62718D;margin:0 0 8px 12px;">
                                    ⚠ Vulnérabilité :
                                    <select class="form-control" style="width:auto;font-size:12px;padding:4px 8px;height:auto;"
                                            onchange="ProjectDetailPage.updateSiteField(${index}, 'vulnerability_level', this.value)">
                                        <option value="normal" ${(site.vulnerability_level || 'normal') === 'normal' ? 'selected' : ''}>Normale</option>
                                        <option value="elevee" ${site.vulnerability_level === 'elevee' ? 'selected' : ''}>Élevée</option>
                                        <option value="tres_elevee" ${site.vulnerability_level === 'tres_elevee' ? 'selected' : ''}>Très élevée</option>
                                    </select>
                                </label>
                                <div style="position:relative; margin-bottom:8px;">
                                    <input type="text" class="form-control site-search" data-site-index="${index}"
                                           placeholder="Rechercher localisation (commune, arrondissement...)"
                                           oninput="ProjectDetailPage.onLocationSearch(${index}, 'site', this.value)"
                                           onfocus="ProjectDetailPage.onLocationSearch(${index}, 'site', this.value)"
                                           autocomplete="off">
                                    <div class="search-results" id="site-results-${index}" style="display:none;position:absolute;top:100%;left:0;right:0;z-index:100;background:white;border:1px solid #dce3ed;border-radius:0 0 8px 8px;max-height:250px;overflow-y:auto;box-shadow:0 4px 12px rgba(0,0,0,0.1);"></div>
                                </div>
                                <div style="display:grid; grid-template-columns:repeat(4,1fr); gap:8px;">
                                    <select class="form-control site-region" data-site-index="${index}"
                                            onchange="ProjectDetailPage.onSiteRegionChange(${index}, this.value)">
                                        <option value="">-- Région --</option>
                                    </select>
                                    <select class="form-control site-dept" data-site-index="${index}"
                                            onchange="ProjectDetailPage.onSiteDeptChange(${index}, this.value)">
                                        <option value="">-- Département --</option>
                                    </select>
                                    <select class="form-control site-arrond" data-site-index="${index}"
                                            onchange="ProjectDetailPage.onSiteArrondChange(${index}, this.value)">
                                        <option value="">-- Arrondissement --</option>
                                    </select>
                                    <select class="form-control site-commune" data-site-index="${index}"
                                            onchange="ProjectDetailPage.updateSiteField(${index}, 'commune', this.value)">
                                        <option value="">-- Commune --</option>
                                    </select>
                                </div>
                            ` : `
                                <div>
                                    <strong>${site.name}</strong> — ${site.description || ''}
                                    ${site.is_pcs ? '<span style="display:inline-block;margin-left:6px;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:700;color:#1d4ed8;background:#dbeafe;">📎 PCS</span>' : ''}
                                    ${ProjectDetailPage.renderVulnBadge(site.vulnerability_level)}
                                </div>
                                <div style="font-size:12px;color:#62718D;margin-top:4px;">
                                    ${[site.region, site.departement, site.arrondissement, site.commune].filter(Boolean).join(' > ') || ''}
                                    ${site.latitude && site.longitude ? ' | ' + site.latitude + ', ' + site.longitude : ''}
                                </div>
                            `}
                        </div>
                    `).join('')}
                </div>

                ${isProjectManager ? `
                    <button class="btn btn-secondary" onclick="ProjectDetailPage.addSite()" style="margin-top: 12px;">
                        + Ajouter un site
                    </button>

                    <div style="margin-top: 24px; display: flex; justify-content: flex-end; gap: 12px;">
                        <button class="btn btn-primary" onclick="ProjectDetailPage.saveLocalitiesAndSites()">
                            Enregistrer Localités et Sites
                        </button>
                    </div>
                ` : ''}
            </div>
        `;
    },

    renderMeasuresEditable() {
        const currentUser = Auth.getUser();
        const canEdit = Auth.hasAnyRole('admin', 'utilisateur');
        const isProjectManager = this.data.project.project_manager_id === currentUser?.id || Auth.hasRole('admin');
        
        return `
            <div class="card mb-4">
                <h2 style="margin-bottom: 24px;">🔧 Mesures / Actions</h2>
                
                <div id="measures-container">
                    ${this.data.editMode.measures.map((measure, index) => {
                        const isAssignedToMe = measure.assigned_user_id === currentUser?.id;
                        const canEditThisMeasure = isProjectManager || Auth.hasRole('admin');
                        const canOnlyUpdateStatus = isAssignedToMe && !isProjectManager && !Auth.hasRole('admin');
                        
                        return `
                        <div class="measure-item" style="padding: 16px; background: ${isAssignedToMe ? '#fff3e0' : '#f8f9fa'}; border-radius: 8px; margin-bottom: 12px; ${isAssignedToMe ? 'border: 2px solid #ff9800;' : ''}" data-index="${index}">
                            ${isAssignedToMe ? '<div style="color: #e65100; font-weight: 600; margin-bottom: 8px;">👤 Vous êtes assigné à cette mesure</div>' : ''}
                            
                            <div style="display: grid; grid-template-columns: 2fr 1fr 1fr 1fr 1fr auto; gap: 10px; align-items: start;">
                                ${canEditThisMeasure ? `
                                    <textarea class="form-control" placeholder="Description de la mesure" rows="2"
                                              onchange="ProjectDetailPage.updateMeasureField(${index}, 'description', this.value)">${measure.description || ''}</textarea>
                                    <select class="form-control" onchange="ProjectDetailPage.updateMeasureField(${index}, 'type', this.value)">
                                        <option value="">-- Type --</option>
                                        ${this.data.measureTypes.map(t => `<option value="${t.value}" ${measure.type === t.value ? 'selected' : ''}>${t.label}</option>`).join('')}
                                    </select>
                                    <select class="form-control" onchange="ProjectDetailPage.updateMeasureField(${index}, 'status', this.value)">
                                        ${this.data.measureStatuses.map(s => `<option value="${s.value}" ${measure.status === s.value ? 'selected' : ''}>${s.label}</option>`).join('')}
                                    </select>
                                    <select class="form-control" title="Structure assignée" onchange="ProjectDetailPage.updateMeasureStructure(${index}, this.value)">
                                        <option value="">-- Structure --</option>
                                        ${this.data.structures.map(s => `<option value="${s.id}" ${measure.structure_id == s.id ? 'selected' : ''}>${s.code}</option>`).join('')}
                                    </select>
                                    <select class="form-control" title="Utilisateur assigné" onchange="ProjectDetailPage.updateMeasureField(${index}, 'assigned_user_id', this.value)">
                                        <option value="">-- Utilisateur --</option>
                                        ${this.getUsersForMeasure(measure).map(user => `
                                            <option value="${user.id}" ${measure.assigned_user_id == user.id ? 'selected' : ''}>
                                                ${user.first_name} ${user.last_name || ''} (${user.username})
                                            </option>
                                        `).join('')}
                                    </select>
                                    <button class="btn btn-danger" onclick="ProjectDetailPage.removeMeasure(${index})">
                                        🗑️
                                    </button>
                                ` : canOnlyUpdateStatus ? `
                                    <div style="grid-column: span 6;">
                                        <div style="margin-bottom: 8px;"><strong>Description:</strong> ${measure.description}</div>
                                        <div style="margin-bottom: 8px;"><strong>Type:</strong> ${measure.type || 'N/A'}</div>
                                        <div style="margin-bottom: 8px;"><strong>Structure assignée:</strong> ${measure.structure_code || '—'}</div>
                                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                                            <div>
                                                <label style="font-size: 12px; color: #666;">Statut de la mesure</label>
                                                <select class="form-control" onchange="ProjectDetailPage.updateMyMeasureStatus(${measure.id}, this.value)">
                                                    ${this.data.measureStatuses.map(s => `<option value="${s.value}" ${measure.status === s.value ? 'selected' : ''}>${s.label}</option>`).join('')}
                                                </select>
                                            </div>
                                        </div>
                                        <div style="margin-top: 12px;">
                                            <label style="font-size: 12px; color: #666;">Vos observations / commentaires</label>
                                            <textarea class="form-control" id="comment-${measure.id}" placeholder="Tapez votre commentaire ici..." rows="3">${this.getMyComment(measure) || ''}</textarea>
                                            <button class="btn btn-primary" style="margin-top: 8px;" onclick="ProjectDetailPage.addCommentFromField(${measure.id})">
                                                💾 Enregistrer commentaire
                                            </button>
                                        </div>
                                    </div>
                                ` : `
                                    <div>${measure.description}</div>
                                    <div>${measure.type || 'N/A'}</div>
                                    <div><span class="status-badge status-${measure.status}">${this.getMeasureStatusLabel(measure.status)}</span></div>
                                    <div>${measure.structure_code ? `<span style="display:inline-block;padding:2px 8px;background:${StructureColors.get(measure.structure_code)};color:white;border-radius:10px;font-size:11px;font-weight:600;">${measure.structure_code}</span>` : '<span style="color:#8896AB;">—</span>'}</div>
                                    <div>${measure.assigned_username ? `${measure.assigned_first_name || ''} ${measure.assigned_last_name || ''}`.trim() : 'Non assigné'}</div>
                                    <div></div>
                                `}
                            </div>
                            
                            ${measure.comments && measure.comments.length > 0 && (isProjectManager || Auth.hasRole('admin')) ? `
                                <div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid #ddd;">
                                    <strong style="color: #666;">💬 Observations:</strong>
                                    ${measure.comments.map(c => `
                                        <div style="margin-top: 8px; padding: 8px; background: white; border-radius: 4px;">
                                            <div style="font-size: 12px; color: #999;">${c.first_name} ${c.last_name} - ${new Date(c.created_at).toLocaleDateString('fr-FR')}</div>
                                            <div style="margin-top: 4px;">${c.comment}</div>
                                        </div>
                                    `).join('')}
                                </div>
                            ` : ''}
                        </div>
                    `}).join('')}
                </div>
                
                ${isProjectManager || Auth.hasRole('admin') ? `
                    <button class="btn btn-secondary" onclick="ProjectDetailPage.addMeasure()" style="margin-top: 12px;">
                        ➕ Ajouter une mesure
                    </button>

                    <div style="margin-top: 24px; display: flex; justify-content: flex-end;">
                        <button class="btn btn-primary" onclick="ProjectDetailPage.saveMeasures()">
                            💾 Enregistrer Mesures
                        </button>
                    </div>
                ` : ''}
            </div>
        `;
    },

    renderFinancingEditable() {
        const currentUser = Auth.getUser();
        const isProjectManager = this.data.project.project_manager_id === currentUser?.id || Auth.hasRole('admin');
        
        return `
            <div class="card mb-4">
                <h2 style="margin-bottom: 24px;">Financement</h2>
                
                <div id="funding-container">
                    ${this.data.editMode.funding.map((fund, index) => `
                        <div class="funding-item" style="padding: 16px; background: #f8f9fa; border-radius: 8px; margin-bottom: 12px;" data-index="${index}">
                            <div style="display: grid; grid-template-columns: 2fr 1fr 1fr auto; gap: 12px; align-items: start;">
                                ${isProjectManager ? `
                                    <input type="text" class="form-control" placeholder="Source de financement" 
                                           value="${fund.source || ''}" 
                                           onchange="ProjectDetailPage.updateFundingField(${index}, 'source', this.value)">
                                    <input type="number" class="form-control" placeholder="Montant (FCFA)" step="1000"
                                           value="${fund.amount || ''}" 
                                           onchange="ProjectDetailPage.updateFundingField(${index}, 'amount', this.value)">
                                    <input type="text" class="form-control" placeholder="Type" 
                                           value="${fund.type || ''}" 
                                           onchange="ProjectDetailPage.updateFundingField(${index}, 'type', this.value)">
                                    <button class="btn btn-danger" onclick="ProjectDetailPage.removeFunding(${index})">
                                        🗑️
                                    </button>
                                ` : `
                                    <div><strong>${fund.source}</strong></div>
                                    <div>${fund.amount ? fund.amount.toLocaleString() + ' FCFA' : 'N/A'}</div>
                                    <div>${fund.type || 'N/A'}</div>
                                `}
                            </div>
                        </div>
                    `).join('')}
                </div>
                
                ${isProjectManager ? `
                    <button class="btn btn-secondary" onclick="ProjectDetailPage.addFunding()" style="margin-top: 12px;">
                        ➕ Ajouter un financement
                    </button>

                    <div style="margin-top: 24px; display: flex; justify-content: flex-end;">
                        <button class="btn btn-primary" onclick="ProjectDetailPage.saveFunding()">
                            💾 Enregistrer Financements
                        </button>
                    </div>
                ` : ''}
            </div>
        `;
    },

    // ==================== Méthodes de gestion des localités ====================
    addLocality() {
        this.data.editMode.localities.push({ region: '', departement: '', arrondissement: '', commune: '' });
        this.refreshSection('localities');
    },

    removeLocality(index) {
        this.data.editMode.localities.splice(index, 1);
        this.refreshSection('localities');
    },

    updateLocalityField(index, field, value) {
        this.data.editMode.localities[index][field] = value;
    },

    async onLocalityRegionChange(index, region) {
        this.data.editMode.localities[index].region = region;
        this.data.editMode.localities[index].departement = '';
        this.data.editMode.localities[index].arrondissement = '';
        this.data.editMode.localities[index].commune = '';
        // Reset dependent dropdowns
        const deptSel = document.querySelector(`.loc-dept[data-index="${index}"]`);
        const arrondSel = document.querySelector(`.loc-arrond[data-index="${index}"]`);
        const communeSel = document.querySelector(`.loc-commune[data-index="${index}"]`);
        if (deptSel) deptSel.innerHTML = '<option value="">-- Département --</option>';
        if (arrondSel) arrondSel.innerHTML = '<option value="">-- Arrondissement --</option>';
        if (communeSel) communeSel.innerHTML = '<option value="">-- Commune --</option>';
        if (region && deptSel) {
            const res = await API.decoupage.getDepartements(region);
            res.data.forEach(d => { deptSel.innerHTML += `<option value="${d}">${d}</option>`; });
        }
    },

    async onLocalityDeptChange(index, dept) {
        this.data.editMode.localities[index].departement = dept;
        this.data.editMode.localities[index].arrondissement = '';
        this.data.editMode.localities[index].commune = '';
        const arrondSel = document.querySelector(`.loc-arrond[data-index="${index}"]`);
        const communeSel = document.querySelector(`.loc-commune[data-index="${index}"]`);
        if (arrondSel) arrondSel.innerHTML = '<option value="">-- Arrondissement --</option>';
        if (communeSel) communeSel.innerHTML = '<option value="">-- Commune --</option>';
        if (dept && arrondSel) {
            const res = await API.decoupage.getArrondissements(dept);
            res.data.forEach(a => { arrondSel.innerHTML += `<option value="${a}">${a}</option>`; });
        }
    },

    async onLocalityArrondChange(index, arrond) {
        this.data.editMode.localities[index].arrondissement = arrond;
        this.data.editMode.localities[index].commune = '';
        const communeSel = document.querySelector(`.loc-commune[data-index="${index}"]`);
        if (communeSel) communeSel.innerHTML = '<option value="">-- Commune --</option>';
        if (arrond && communeSel) {
            const res = await API.decoupage.getCommunes(arrond);
            res.data.forEach(c => { communeSel.innerHTML += `<option value="${c}">${c}</option>`; });
        }
    },

    async saveLocalitiesAndSites() {
        try {
            const updateData = {
                localities: this.data.editMode.localities.filter(l => l.region || l.departement || l.commune),
                sites: this.data.editMode.sites.filter(s => s.name)
            };

            await API.projects.update(this.data.project.id, updateData);
            Toast.success('Localités et sites mis à jour avec succès !');
            window.location.reload();
        } catch (error) {
            console.error('Error saving localities and sites:', error);
            Toast.error('Erreur lors de la mise à jour: ' + (error.message || 'Erreur inconnue'));
        }
    },

    // ==================== Méthodes de gestion des sites ====================
    addSite() {
        this.data.editMode.sites.push({ name: '', description: '', region: '', departement: '', arrondissement: '', commune: '', latitude: null, longitude: null, is_pcs: false, vulnerability_level: 'normal' });
        this.refreshSection('sites');
    },

    removeSite(index) {
        this.data.editMode.sites.splice(index, 1);
        this.refreshSection('sites');
    },

    updateSiteField(index, field, value) {
        this.data.editMode.sites[index][field] = value;
    },

    updateSiteCoordinates(index, value) {
        const parts = value.split(',');
        if (parts.length === 2) {
            this.data.editMode.sites[index].latitude = parseFloat(parts[0].trim()) || null;
            this.data.editMode.sites[index].longitude = parseFloat(parts[1].trim()) || null;
        }
    },

    async onSiteRegionChange(index, region) {
        this.data.editMode.sites[index].region = region;
        this.data.editMode.sites[index].departement = '';
        this.data.editMode.sites[index].arrondissement = '';
        this.data.editMode.sites[index].commune = '';
        const deptSel = document.querySelector(`.site-dept[data-site-index="${index}"]`);
        const arrondSel = document.querySelector(`.site-arrond[data-site-index="${index}"]`);
        const communeSel = document.querySelector(`.site-commune[data-site-index="${index}"]`);
        if (deptSel) deptSel.innerHTML = '<option value="">-- Département --</option>';
        if (arrondSel) arrondSel.innerHTML = '<option value="">-- Arrondissement --</option>';
        if (communeSel) communeSel.innerHTML = '<option value="">-- Commune --</option>';
        if (region && deptSel) {
            const res = await API.decoupage.getDepartements(region);
            res.data.forEach(d => { deptSel.innerHTML += `<option value="${d}">${d}</option>`; });
        }
    },

    async onSiteDeptChange(index, dept) {
        this.data.editMode.sites[index].departement = dept;
        this.data.editMode.sites[index].arrondissement = '';
        this.data.editMode.sites[index].commune = '';
        const arrondSel = document.querySelector(`.site-arrond[data-site-index="${index}"]`);
        const communeSel = document.querySelector(`.site-commune[data-site-index="${index}"]`);
        if (arrondSel) arrondSel.innerHTML = '<option value="">-- Arrondissement --</option>';
        if (communeSel) communeSel.innerHTML = '<option value="">-- Commune --</option>';
        if (dept && arrondSel) {
            const res = await API.decoupage.getArrondissements(dept);
            res.data.forEach(a => { arrondSel.innerHTML += `<option value="${a}">${a}</option>`; });
        }
    },

    async onSiteArrondChange(index, arrond) {
        this.data.editMode.sites[index].arrondissement = arrond;
        this.data.editMode.sites[index].commune = '';
        const communeSel = document.querySelector(`.site-commune[data-site-index="${index}"]`);
        if (communeSel) communeSel.innerHTML = '<option value="">-- Commune --</option>';
        if (arrond && communeSel) {
            const res = await API.decoupage.getCommunes(arrond);
            res.data.forEach(c => { communeSel.innerHTML += `<option value="${c}">${c}</option>`; });
        }
    },

    _isInSenegal(lat, lng) {
        // Bounding box approximative du Sénégal
        return lat >= 12.0 && lat <= 17.5 && lng >= -18.0 && lng <= -11.0;
    },

    openMapPicker(index) {
        const site = this.data.editMode.sites[index];
        const hasCoords = site.latitude && site.longitude;
        const initLat = hasCoords ? parseFloat(site.latitude) : 14.4974;  // centre Sénégal
        const initLng = hasCoords ? parseFloat(site.longitude) : -14.4524;
        const initZoom = hasCoords ? 14 : 7;

        const overlay = document.createElement('div');
        overlay.id = 'map-picker-overlay';
        overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:10000;display:flex;align-items:center;justify-content:center;';
        overlay.innerHTML = `
            <div style="background:white;border-radius:12px;width:min(90vw,900px);height:min(85vh,700px);display:flex;flex-direction:column;overflow:hidden;">
                <div style="padding:14px 18px;border-bottom:1px solid #e2e8f0;display:flex;justify-content:space-between;align-items:center;">
                    <div>
                        <h3 style="margin:0;color:#202B5D;font-size:16px;">🗺️ Choisir la position sur la carte</h3>
                        <small style="color:#62718D;">Cliquez sur la carte pour placer le marqueur. Vous pouvez zoomer, bouger et recliquer à volonté.</small>
                    </div>
                    <button class="btn btn-secondary" onclick="ProjectDetailPage.closeMapPicker()" style="font-size:20px;padding:4px 10px;">✕</button>
                </div>
                <div style="padding:10px 18px;border-bottom:1px solid #e2e8f0;position:relative;z-index:10500;">
                    <input type="text" id="map-picker-search" class="form-control" placeholder="🔎 Rechercher un lieu (ex: Pikine, Touba, Dakar)..." autocomplete="off" style="width:100%;">
                    <div id="map-picker-results" style="position:absolute;top:100%;left:18px;right:18px;background:white;border:1px solid #dce3ed;border-radius:0 0 8px 8px;max-height:280px;overflow-y:auto;box-shadow:0 4px 12px rgba(0,0,0,0.1);z-index:10501;display:none;"></div>
                </div>
                <div id="map-picker-el" style="flex:1;"></div>
                <div style="padding:12px 18px;border-top:1px solid #e2e8f0;display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;">
                    <div id="map-picker-coords" style="font-family:monospace;color:#202B5D;font-size:14px;font-weight:600;">
                        ${hasCoords ? `${site.latitude}, ${site.longitude}` : 'Aucune position sélectionnée'}
                    </div>
                    <div style="display:flex;gap:8px;">
                        <button class="btn btn-secondary" onclick="ProjectDetailPage.useMyLocation()" title="Utiliser la position GPS du navigateur">
                            📍 Ma position
                        </button>
                        <button class="btn btn-secondary" onclick="ProjectDetailPage.closeMapPicker()">Annuler</button>
                        <button class="btn btn-primary" id="map-picker-confirm" onclick="ProjectDetailPage.confirmMapPicker(${index})" ${hasCoords ? '' : 'disabled style="opacity:0.5;cursor:not-allowed;"'}>
                            ✓ Valider
                        </button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);

        setTimeout(() => {
            const map = L.map('map-picker-el', { zoomControl: true }).setView([initLat, initLng], initZoom);
            const osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OpenStreetMap', maxZoom: 19 });
            const sat = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { attribution: 'Tiles &copy; Esri', maxZoom: 19 });
            osm.addTo(map);
            L.control.layers({ 'Plan': osm, 'Satellite': sat }, null, { position: 'topright', collapsed: false }).addTo(map);

            let marker = null;
            if (hasCoords) {
                marker = L.marker([initLat, initLng]).addTo(map);
            }

            this._mapPicker = { map, marker, lat: hasCoords ? initLat : null, lng: hasCoords ? initLng : null };

            map.on('click', (e) => {
                const { lat, lng } = e.latlng;
                const inSN = this._isInSenegal(lat, lng);
                if (this._mapPicker.marker) this._mapPicker.marker.setLatLng([lat, lng]);
                else this._mapPicker.marker = L.marker([lat, lng]).addTo(map);
                this._mapPicker.lat = lat;
                this._mapPicker.lng = lng;
                const precision = 7;
                const warn = inSN ? '' : '  ⚠️ hors Sénégal';
                document.getElementById('map-picker-coords').innerHTML =
                    `${lat.toFixed(precision)}, ${lng.toFixed(precision)}` +
                    (warn ? `<span style="color:#e67e22;font-weight:600;">${warn}</span>` : '');
                const btn = document.getElementById('map-picker-confirm');
                btn.disabled = false;
                btn.style.opacity = '1';
                btn.style.cursor = 'pointer';
            });

            // Force la bonne taille après l'ouverture du modal
            setTimeout(() => map.invalidateSize(), 100);

            // Recherche type Google Maps — via proxy backend (Nominatim policy: 1 req/s max + User-Agent)
            const searchInput = document.getElementById('map-picker-search');
            const resultsBox = document.getElementById('map-picker-results');
            let searchTimer = null;
            const doSearch = async (q) => {
                resultsBox.innerHTML = '<div style="padding:10px;color:#8896AB;font-size:12px;">Recherche...</div>';
                resultsBox.style.display = 'block';
                try {
                    const res = await API.decoupage.forwardGeocode(q);
                    const list = res.data || [];
                    if (!list.length) {
                        resultsBox.innerHTML = '<div style="padding:10px;color:#8896AB;font-size:12px;">Aucun résultat.</div>';
                        return;
                    }
                    resultsBox.innerHTML = '';
                    list.forEach((r, i) => {
                        const row = document.createElement('div');
                        row.className = 'map-picker-result';
                        row.style.cssText = 'padding:8px 12px;cursor:pointer;border-bottom:1px solid #f0f4f8;font-size:13px;';
                        row.onmouseover = () => row.style.background = '#f0f4f8';
                        row.onmouseout = () => row.style.background = 'white';
                        const title = document.createElement('div');
                        title.style.cssText = 'font-weight:600;color:#202B5D;';
                        title.textContent = r.name || (r.display_name || '').split(',')[0] || '';
                        const sub = document.createElement('div');
                        sub.style.cssText = 'font-size:11px;color:#62718D;';
                        sub.textContent = r.display_name || '';
                        row.append(title, sub);
                        row.addEventListener('click', () => {
                            const lat = parseFloat(r.lat);
                            const lng = parseFloat(r.lon);
                            if (this._mapPicker.marker) this._mapPicker.marker.setLatLng([lat, lng]);
                            else this._mapPicker.marker = L.marker([lat, lng]).addTo(this._mapPicker.map);
                            this._mapPicker.map.setView([lat, lng], 15);
                            this._mapPicker.lat = lat;
                            this._mapPicker.lng = lng;
                            const inSN = this._isInSenegal(lat, lng);
                            const warn = inSN ? '' : '  ⚠️ hors Sénégal';
                            document.getElementById('map-picker-coords').innerHTML =
                                `${lat.toFixed(7)}, ${lng.toFixed(7)}` +
                                (warn ? `<span style="color:#e67e22;font-weight:600;">${warn}</span>` : '');
                            const btn = document.getElementById('map-picker-confirm');
                            btn.disabled = false;
                            btn.style.opacity = '1';
                            btn.style.cursor = 'pointer';
                            resultsBox.style.display = 'none';
                            searchInput.value = (r.display_name || '').split(',').slice(0, 2).join(', ');
                        });
                        resultsBox.appendChild(row);
                    });
                } catch (err) {
                    resultsBox.innerHTML = '';
                    const errDiv = document.createElement('div');
                    errDiv.style.cssText = 'padding:10px;color:#e74c3c;font-size:12px;';
                    errDiv.textContent = 'Erreur: ' + (err.message || 'inconnue');
                    resultsBox.appendChild(errDiv);
                }
            };
            searchInput.addEventListener('input', (e) => {
                clearTimeout(searchTimer);
                const q = e.target.value.trim();
                if (q.length < 3) {
                    resultsBox.style.display = 'none';
                    return;
                }
                searchTimer = setTimeout(() => doSearch(q), 1100);
            });
            // Masquer les résultats au clic en dehors — handler nommé pour pouvoir le retirer à la fermeture
            const onDocumentClick = (e) => {
                if (!resultsBox.contains(e.target) && e.target !== searchInput) {
                    resultsBox.style.display = 'none';
                }
            };
            document.addEventListener('click', onDocumentClick);
            this._mapPicker._onDocumentClick = onDocumentClick;
        }, 50);
    },

    useMyLocation() {
        if (!navigator.geolocation) {
            Toast.error('La géolocalisation n\'est pas disponible sur ce navigateur.');
            return;
        }
        if (!this._mapPicker || !this._mapPicker.map) return;
        Toast.info('Récupération de votre position...');
        navigator.geolocation.getCurrentPosition((pos) => {
            const lat = pos.coords.latitude;
            const lng = pos.coords.longitude;
            const acc = Math.round(pos.coords.accuracy || 0);
            const map = this._mapPicker.map;

            if (this._mapPicker.marker) this._mapPicker.marker.setLatLng([lat, lng]);
            else this._mapPicker.marker = L.marker([lat, lng]).addTo(map);

            // Cercle de précision
            if (this._mapPicker.accuracyCircle) map.removeLayer(this._mapPicker.accuracyCircle);
            this._mapPicker.accuracyCircle = L.circle([lat, lng], {
                radius: acc || 30,
                color: '#3794C4',
                fillColor: '#3794C4',
                fillOpacity: 0.15,
                weight: 1
            }).addTo(map);

            map.setView([lat, lng], 17);

            this._mapPicker.lat = lat;
            this._mapPicker.lng = lng;
            const inSN = this._isInSenegal(lat, lng);
            const warn = inSN ? '' : '  ⚠️ hors Sénégal';
            document.getElementById('map-picker-coords').innerHTML =
                `${lat.toFixed(7)}, ${lng.toFixed(7)} (±${acc} m)` +
                (warn ? `<span style="color:#e67e22;font-weight:600;">${warn}</span>` : '');
            const btn = document.getElementById('map-picker-confirm');
            btn.disabled = false;
            btn.style.opacity = '1';
            btn.style.cursor = 'pointer';
            if (inSN) Toast.success(`Position trouvée (précision ±${acc} m)`);
            else Toast.warning(`Position hors Sénégal (précision ±${acc} m). Vous pouvez la garder ou ajuster.`);
        }, (err) => {
            const msg = {
                1: 'Permission refusée. Autorisez la géolocalisation dans votre navigateur.',
                2: 'Position indisponible (pas de signal GPS ou réseau).',
                3: 'Délai dépassé, réessayez.'
            }[err.code] || err.message || 'Erreur de géolocalisation';
            Toast.error(msg);
        }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 });
    },

    closeMapPicker() {
        const overlay = document.getElementById('map-picker-overlay');
        if (overlay) overlay.remove();
        if (this._mapPicker) {
            if (this._mapPicker._onDocumentClick) {
                document.removeEventListener('click', this._mapPicker._onDocumentClick);
            }
            if (this._mapPicker.map) this._mapPicker.map.remove();
        }
        this._mapPicker = null;
    },

    confirmMapPicker(index) {
        if (!this._mapPicker || this._mapPicker.lat == null) return;
        const lat = Number(this._mapPicker.lat.toFixed(7));
        const lng = Number(this._mapPicker.lng.toFixed(7));
        this.data.editMode.sites[index].latitude = lat;
        this.data.editMode.sites[index].longitude = lng;
        // Met à jour l'input Lat,Lng visible
        const row = document.querySelector(`.site-item[data-index="${index}"]`);
        if (row) {
            const latInput = row.querySelector('input[placeholder="Lat,Lng"]');
            if (latInput) latInput.value = `${lat},${lng}`;
        }
        this.closeMapPicker();
        Toast.success(`Position enregistrée : ${lat}, ${lng}`);
    },

    async autoFillSiteFromCoords(index) {
        const site = this.data.editMode.sites[index];
        if (!site.latitude || !site.longitude) {
            Toast.warning('Saisissez d\'abord les coordonnées Lat,Lng.');
            return;
        }
        Toast.info('Recherche de la localisation...');
        try {
            const res = await API.decoupage.reverseGeocode(site.latitude, site.longitude);
            if (!res.success) {
                Toast.warning('Géocodage indisponible. Saisie manuelle requise.');
                return;
            }
            const d = res.data || {};

            // Appliquer en cascade. Si pas de match, ne rien mettre (l'utilisateur peut saisir manuellement).
            if (d.region) {
                const regionSel = document.querySelector(`.site-region[data-site-index="${index}"]`);
                if (regionSel) regionSel.value = d.region;
                await this.onSiteRegionChange(index, d.region);
            }
            if (d.departement) {
                const deptSel = document.querySelector(`.site-dept[data-site-index="${index}"]`);
                if (deptSel) deptSel.value = d.departement;
                await this.onSiteDeptChange(index, d.departement);
            }
            if (d.arrondissement) {
                const arrSel = document.querySelector(`.site-arrond[data-site-index="${index}"]`);
                if (arrSel) arrSel.value = d.arrondissement;
                await this.onSiteArrondChange(index, d.arrondissement);
            }
            if (d.commune) {
                const comSel = document.querySelector(`.site-commune[data-site-index="${index}"]`);
                if (comSel) comSel.value = d.commune;
                this.updateSiteField(index, 'commune', d.commune);
            }

            const filled = [d.region, d.departement, d.arrondissement, d.commune].filter(Boolean);
            if (filled.length === 0) {
                const hint = res.candidates && (res.candidates.region || res.candidates.commune)
                    ? `OSM a proposé : ${Object.entries(res.candidates).filter(([,v]) => v).map(([k,v]) => k + '=' + v).join(', ')} (aucun match dans la base décou­page).`
                    : 'Aucun résultat. Saisie manuelle requise.';
                Toast.warning(hint);
            } else {
                Toast.success(`Localisation trouvée : ${filled.join(' › ')}. Vous pouvez modifier ou effacer les champs si besoin.`);
            }
        } catch (err) {
            Toast.error('Erreur géocodage : ' + (err.message || 'inconnue'));
        }
    },

    // ==================== Méthodes de gestion des mesures ====================
    addMeasure() {
        this.data.editMode.measures.push({
            description: '', type: '', status: 'preconisee',
            structure_id: this.data.project.structure_id || null,
            assigned_user_id: null
        });
        this.refreshSection('measures');
    },

    removeMeasure(index) {
        this.data.editMode.measures.splice(index, 1);
        this.refreshSection('measures');
    },

    updateMeasureField(index, field, value) {
        this.data.editMode.measures[index][field] = value === '' ? null : value;
    },

    updateMeasureStructure(index, structureId) {
        const newSid = structureId ? parseInt(structureId) : null;
        const m = this.data.editMode.measures[index];
        // Si on change de structure, réinitialiser l'utilisateur assigné s'il n'appartient pas à la nouvelle structure
        if (m.assigned_user_id) {
            const user = this.data.allUsers.find(u => u.id == m.assigned_user_id);
            if (user && newSid && user.structure_id !== newSid) {
                m.assigned_user_id = null;
            }
        }
        m.structure_id = newSid;
        this.refreshSection('measures');
    },

    getUsersForMeasure(measure) {
        // Filtre les utilisateurs selon la structure assignée à la mesure (ou structure principale du projet par défaut)
        const sid = measure.structure_id || this.data.project.structure_id;
        if (!sid) return this.data.allUsers;
        return this.data.allUsers.filter(u => u.structure_id === sid);
    },

    async saveMeasures() {
        try {
            const updateData = {
                measures: this.data.editMode.measures.filter(m => m.description)
            };

            await API.projects.update(this.data.project.id, updateData);
            Toast.success('Mesures mises à jour avec succès !');
            window.location.reload();
        } catch (error) {
            console.error('Error saving measures:', error);
            Toast.error('Erreur lors de la mise à jour: ' + (error.message || 'Erreur inconnue'));
        }
    },

    // ==================== Méthodes de gestion des financements ====================
    addFunding() {
        this.data.editMode.funding.push({ source: '', amount: null, type: '' });
        this.refreshSection('funding');
    },

    removeFunding(index) {
        this.data.editMode.funding.splice(index, 1);
        this.refreshSection('funding');
    },

    updateFundingField(index, field, value) {
        if (field === 'amount') {
            this.data.editMode.funding[index][field] = parseFloat(value) || null;
        } else {
            this.data.editMode.funding[index][field] = value;
        }
    },

    async saveFunding() {
        try {
            const updateData = {
                funding: this.data.editMode.funding.filter(f => f.source)
            };

            await API.projects.update(this.data.project.id, updateData);
            Toast.success('Financements mis à jour avec succès !');
            window.location.reload();
        } catch (error) {
            console.error('Error saving funding:', error);
            Toast.error('Erreur lors de la mise à jour: ' + (error.message || 'Erreur inconnue'));
        }
    },

    // ==================== Méthode pour rafraîchir une section ====================
    refreshSection(section) {
        let container;
        let html;

        switch(section) {
            case 'localities':
                container = document.getElementById('localities-container');
                html = this.data.editMode.localities.map((loc, index) => `
                    <div class="locality-item" style="padding: 16px; background: #f8f9fa; border-radius: 8px; margin-bottom: 12px;" data-index="${index}">
                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px;">
                            <input type="text" class="form-control" placeholder="Région" 
                                   value="${loc.region || ''}" 
                                   onchange="ProjectDetailPage.updateLocalityField(${index}, 'region', this.value)">
                            <input type="text" class="form-control" placeholder="Département" 
                                   value="${loc.departement || ''}" 
                                   onchange="ProjectDetailPage.updateLocalityField(${index}, 'departement', this.value)">
                            <input type="text" class="form-control" placeholder="Commune" 
                                   value="${loc.commune || ''}" 
                                   onchange="ProjectDetailPage.updateLocalityField(${index}, 'commune', this.value)">
                            <button class="btn btn-danger" onclick="ProjectDetailPage.removeLocality(${index})" style="max-width: 120px;">
                                🗑️ Retirer
                            </button>
                        </div>
                    </div>
                `).join('');
                break;

            case 'sites':
                container = document.getElementById('sites-container');
                html = this.data.editMode.sites.map((site, index) => `
                    <div class="site-item" style="padding: 16px; background: #f8f9fa; border-radius: 8px; margin-bottom: 12px;" data-index="${index}">
                        <div style="display: grid; grid-template-columns: 1fr 1fr auto auto auto auto; gap: 10px; margin-bottom: 10px; align-items: center;">
                            <input type="text" class="form-control" placeholder="Nom du site"
                                   value="${site.name || ''}"
                                   onchange="ProjectDetailPage.updateSiteField(${index}, 'name', this.value)">
                            <input type="text" class="form-control" placeholder="Description"
                                   value="${site.description || ''}"
                                   onchange="ProjectDetailPage.updateSiteField(${index}, 'description', this.value)">
                            <input type="text" class="form-control" placeholder="Lat,Lng" style="max-width:140px;"
                                   value="${site.latitude && site.longitude ? site.latitude + ',' + site.longitude : ''}"
                                   onchange="ProjectDetailPage.updateSiteCoordinates(${index}, this.value)">
                            <button class="btn btn-secondary" onclick="ProjectDetailPage.openMapPicker(${index})" title="Choisir la position sur une carte" style="font-size:12px;">
                                🗺️ Carte
                            </button>
                            <button class="btn btn-secondary" onclick="ProjectDetailPage.autoFillSiteFromCoords(${index})" title="Déduire région/département/arrondissement/commune depuis les coordonnées GPS" style="font-size:12px;">
                                📍 Auto
                            </button>
                            <button class="btn btn-danger" onclick="ProjectDetailPage.removeSite(${index})" style="font-size:12px;">
                                Retirer
                            </button>
                        </div>
                        ${this.data.project.structure_code === 'DPGI' ? `
                            <label style="display:inline-flex;align-items:center;gap:6px;font-size:12px;color:#62718D;margin-bottom:8px;cursor:pointer;">
                                <input type="checkbox" ${site.is_pcs ? 'checked' : ''}
                                       onchange="ProjectDetailPage.updateSiteField(${index}, 'is_pcs', this.checked)">
                                🏛️ PCS (Plan Communal de Sauvegarde)
                            </label>
                        ` : ''}
                        <label style="display:inline-flex;align-items:center;gap:6px;font-size:12px;color:#62718D;margin:0 0 8px 12px;">
                            ⚠ Vulnérabilité :
                            <select class="form-control" style="width:auto;font-size:12px;padding:4px 8px;height:auto;"
                                    onchange="ProjectDetailPage.updateSiteField(${index}, 'vulnerability_level', this.value)">
                                <option value="normal" ${(site.vulnerability_level || 'normal') === 'normal' ? 'selected' : ''}>Normale</option>
                                <option value="elevee" ${site.vulnerability_level === 'elevee' ? 'selected' : ''}>Élevée</option>
                                <option value="tres_elevee" ${site.vulnerability_level === 'tres_elevee' ? 'selected' : ''}>Très élevée</option>
                            </select>
                        </label>
                        <div style="position:relative; margin-bottom:8px;">
                            <input type="text" class="form-control site-search" data-site-index="${index}"
                                   placeholder="Rechercher localisation (commune, arrondissement...)"
                                   oninput="ProjectDetailPage.onLocationSearch(${index}, 'site', this.value)"
                                   onfocus="ProjectDetailPage.onLocationSearch(${index}, 'site', this.value)"
                                   autocomplete="off">
                            <div class="search-results" id="site-results-${index}" style="display:none;position:absolute;top:100%;left:0;right:0;z-index:100;background:white;border:1px solid #dce3ed;border-radius:0 0 8px 8px;max-height:250px;overflow-y:auto;box-shadow:0 4px 12px rgba(0,0,0,0.1);"></div>
                        </div>
                        <div style="display:grid; grid-template-columns:repeat(4,1fr); gap:8px;">
                            <select class="form-control site-region" data-site-index="${index}"
                                    onchange="ProjectDetailPage.onSiteRegionChange(${index}, this.value)">
                                <option value="">-- Région --</option>
                            </select>
                            <select class="form-control site-dept" data-site-index="${index}"
                                    onchange="ProjectDetailPage.onSiteDeptChange(${index}, this.value)">
                                <option value="">-- Département --</option>
                            </select>
                            <select class="form-control site-arrond" data-site-index="${index}"
                                    onchange="ProjectDetailPage.onSiteArrondChange(${index}, this.value)">
                                <option value="">-- Arrondissement --</option>
                            </select>
                            <select class="form-control site-commune" data-site-index="${index}"
                                    onchange="ProjectDetailPage.updateSiteField(${index}, 'commune', this.value)">
                                <option value="">-- Commune --</option>
                            </select>
                        </div>
                    </div>
                `).join('');
                break;

            case 'measures':
                // Re-render la carte complète pour garder template cohérent (structure + user)
                const card = document.querySelector('#measures-container')?.closest('.card');
                if (card) {
                    const tmp = document.createElement('div');
                    tmp.innerHTML = this.renderMeasuresEditable();
                    card.replaceWith(tmp.firstElementChild);
                }
                return;

            case 'funding':
                container = document.getElementById('funding-container');
                html = this.data.editMode.funding.map((fund, index) => `
                    <div class="funding-item" style="padding: 16px; background: #f8f9fa; border-radius: 8px; margin-bottom: 12px;" data-index="${index}">
                        <div style="display: grid; grid-template-columns: 2fr 1fr 1fr auto; gap: 12px; align-items: start;">
                            <input type="text" class="form-control" placeholder="Source de financement" 
                                   value="${fund.source || ''}" 
                                   onchange="ProjectDetailPage.updateFundingField(${index}, 'source', this.value)">
                            <input type="number" class="form-control" placeholder="Montant (FCFA)" step="1000"
                                   value="${fund.amount || ''}" 
                                   onchange="ProjectDetailPage.updateFundingField(${index}, 'amount', this.value)">
                            <input type="text" class="form-control" placeholder="Type" 
                                   value="${fund.type || ''}" 
                                   onchange="ProjectDetailPage.updateFundingField(${index}, 'type', this.value)">
                            <button class="btn btn-danger" onclick="ProjectDetailPage.removeFunding(${index})">
                                🗑️
                            </button>
                        </div>
                    </div>
                `).join('');
                break;
        }

        if (container) {
            container.innerHTML = html;
        }
    },

    async updateBudgetAndProgress() {
        try {
            const budget = document.getElementById('edit-budget')?.value;
            const progress = document.getElementById('edit-progress')?.value;

            if (progress && (isNaN(progress) || progress < 0 || progress > 100)) {
                Toast.warning('L\'avancement doit être entre 0 et 100');
                return;
            }

            const updateData = {
                budget: budget ? parseFloat(budget) : null,
                progress_percentage: progress ? parseInt(progress) : 0
            };

            await API.projects.update(this.data.project.id, updateData);
            Toast.success('Budget et avancement mis à jour avec succès !');
            window.location.reload();
        } catch (error) {
            console.error('Error updating budget and progress:', error);
            Toast.error('Erreur lors de la mise à jour: ' + (error.message || 'Erreur inconnue'));
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

    renderVulnBadge(level) {
        if (!level || level === 'normal') return '';
        if (level === 'elevee') {
            return '<span style="display:inline-block;margin-left:6px;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:700;color:white;background:#e67e22;">⚠ Élevée</span>';
        }
        if (level === 'tres_elevee') {
            return '<span style="display:inline-block;margin-left:6px;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:700;color:white;background:#c0392b;">⚠ Très élevée</span>';
        }
        return '';
    },

    async updateMyMeasureStatus(measureId, newStatus) {
        try {
            await API.projects.updateMeasureStatus(this.data.project.id, measureId, newStatus);
            Toast.success('Statut mis à jour avec succès !');
            window.location.reload();
        } catch (error) {
            console.error('Error updating measure status:', error);
            Toast.error('Erreur lors de la mise à jour: ' + (error.message || 'Erreur inconnue'));
        }
    },

    async addCommentFromField(measureId) {
        const commentField = document.getElementById(`comment-${measureId}`);
        const comment = commentField ? commentField.value.trim() : '';
        
        if (!comment) {
            Toast.warning('Veuillez entrer un commentaire avant de soumettre.');
            return;
        }
        
        try {
            await API.measureComments.create(measureId, comment);
            Toast.success('Commentaire enregistré avec succès !');
            // Recharger la page complète pour afficher le nouveau commentaire
            window.location.reload();
        } catch (error) {
            console.error('Error adding comment:', error);
            Toast.error('Erreur lors de l\'ajout du commentaire: ' + (error.message || 'Erreur inconnue'));
        }
    },

    getMyComment(measure) {
        const currentUser = Auth.getUser();
        if (!measure.comments || !currentUser) return '';
        
        const myComment = measure.comments.find(c => c.user_id === currentUser.id);
        return myComment ? myComment.comment : '';
    },

    getMeasureStatusLabel(status) {
        const labels = {
            'preconisee': 'Préconisée',
            'executee': 'Exécutée',
            'non_executee': 'Non exécutée',
            'observations': 'Observations'
        };
        return labels[status] || status;
    },

    afterRender() {
        Navbar.updateActiveMenu();
        this.populateLocationDropdowns();
    },

    _searchTimeout: null,
    async onLocationSearch(index, type, query) {
        clearTimeout(this._searchTimeout);
        const resultsDiv = document.getElementById(`${type}-results-${index}`);
        if (!resultsDiv) return;
        if (!query || query.length < 2) { resultsDiv.style.display = 'none'; return; }

        this._searchTimeout = setTimeout(async () => {
            try {
                const res = await API.decoupage.search(query);
                if (!res.data || res.data.length === 0) {
                    resultsDiv.innerHTML = '<div style="padding:12px;color:#8896AB;font-size:13px;">Aucun résultat</div>';
                    resultsDiv.style.display = 'block';
                    return;
                }
                resultsDiv.innerHTML = res.data.map((r, i) => `
                    <div style="padding:10px 14px;cursor:pointer;border-bottom:1px solid #f0f0f0;font-size:13px;transition:background 0.1s;"
                         onmouseover="this.style.background='#f0f4f8'" onmouseout="this.style.background='white'"
                         onclick="ProjectDetailPage.selectLocation(${index}, '${type}', ${i})">
                        <strong style="color:#202B5D;">${r.commune}</strong>
                        <span style="color:#8896AB;"> — ${r.arrondissement}</span>
                        <div style="font-size:11px;color:#8896AB;margin-top:2px;">${r.region} > ${r.departement} > ${r.arrondissement}</div>
                    </div>
                `).join('');
                resultsDiv.style.display = 'block';
                // Store results for selection
                resultsDiv._data = res.data;
            } catch (err) { console.error(err); }
        }, 250);
    },

    async selectLocation(index, type, resultIndex) {
        const resultsDiv = document.getElementById(`${type}-results-${index}`);
        const row = resultsDiv?._data?.[resultIndex];
        if (!row) return;

        const target = type === 'loc' ? this.data.editMode.localities[index] : this.data.editMode.sites[index];
        target.region = row.region;
        target.departement = row.departement;
        target.arrondissement = row.arrondissement;
        target.commune = row.commune;

        // Clear search
        resultsDiv.style.display = 'none';
        const searchInput = type === 'loc'
            ? document.querySelector(`.loc-search[data-index="${index}"]`)
            : document.querySelector(`.site-search[data-site-index="${index}"]`);
        if (searchInput) searchInput.value = `${row.commune} — ${row.arrondissement}`;

        // Fill dropdowns with the selected values
        const prefix = type === 'loc' ? 'loc' : 'site';
        const dataAttr = type === 'loc' ? 'data-index' : 'data-site-index';
        await this.fillDropdownChain(prefix, dataAttr, index, row);
    },

    async fillDropdownChain(prefix, dataAttr, index, data) {
        const regSel = document.querySelector(`.${prefix}-region[${dataAttr}="${index}"]`);
        const deptSel = document.querySelector(`.${prefix}-dept[${dataAttr}="${index}"]`);
        const arrSel = document.querySelector(`.${prefix}-arrond[${dataAttr}="${index}"]`);
        const comSel = document.querySelector(`.${prefix}-commune[${dataAttr}="${index}"]`);

        // Fill regions if needed
        if (regSel && regSel.options.length <= 1) {
            const res = await API.decoupage.getRegions();
            res.data.forEach(r => { regSel.innerHTML += `<option value="${r}">${r}</option>`; });
        }
        if (regSel) regSel.value = data.region || '';

        // Fill depts
        if (data.region && deptSel) {
            deptSel.innerHTML = '<option value="">-- Département --</option>';
            const res = await API.decoupage.getDepartements(data.region);
            res.data.forEach(d => { deptSel.innerHTML += `<option value="${d}">${d}</option>`; });
            deptSel.value = data.departement || '';
        }

        // Fill arronds
        if (data.departement && arrSel) {
            arrSel.innerHTML = '<option value="">-- Arrondissement --</option>';
            const res = await API.decoupage.getArrondissements(data.departement);
            res.data.forEach(a => { arrSel.innerHTML += `<option value="${a}">${a}</option>`; });
            arrSel.value = data.arrondissement || '';
        }

        // Fill communes
        if (data.arrondissement && comSel) {
            comSel.innerHTML = '<option value="">-- Commune --</option>';
            const res = await API.decoupage.getCommunes(data.arrondissement);
            res.data.forEach(c => { comSel.innerHTML += `<option value="${c}">${c}</option>`; });
            comSel.value = data.commune || '';
        }
    },

    async populateLocationDropdowns() {
        // Fill locality dropdowns with existing data
        for (let i = 0; i < this.data.editMode.localities.length; i++) {
            const loc = this.data.editMode.localities[i];
            if (loc.region) {
                await this.fillDropdownChain('loc', 'data-index', i, loc);
                const input = document.querySelector(`.loc-search[data-index="${i}"]`);
                if (input && loc.commune) input.value = `${loc.commune} — ${loc.arrondissement || ''}`;
            } else {
                // Just load regions for empty entries
                const regSel = document.querySelector(`.loc-region[data-index="${i}"]`);
                if (regSel) {
                    const res = await API.decoupage.getRegions();
                    res.data.forEach(r => { regSel.innerHTML += `<option value="${r}">${r}</option>`; });
                }
            }
        }

        // Fill site dropdowns with existing data
        for (let i = 0; i < this.data.editMode.sites.length; i++) {
            const site = this.data.editMode.sites[i];
            if (site.region) {
                await this.fillDropdownChain('site', 'data-site-index', i, site);
                const input = document.querySelector(`.site-search[data-site-index="${i}"]`);
                if (input) input.value = [site.commune, site.arrondissement].filter(Boolean).join(' — ') || site.region || '';
            } else {
                const regSel = document.querySelector(`.site-region[data-site-index="${i}"]`);
                if (regSel) {
                    const res = await API.decoupage.getRegions();
                    res.data.forEach(r => { regSel.innerHTML += `<option value="${r}">${r}</option>`; });
                }
            }
        }

        // Close search results on click outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.loc-search') && !e.target.closest('.site-search') && !e.target.closest('.search-results')) {
                document.querySelectorAll('.search-results').forEach(el => el.style.display = 'none');
            }
        });
    },

    // ==================== Project Comments ====================
    renderProjectComments() {
        const comments = this.data.comments || [];
        const formatDate = (d) => {
            const dt = new Date(d);
            return dt.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
        };
        const currentUser = Auth.getUser();

        return `
            <div class="card mb-4">
                <h2 style="margin-bottom: 24px;">Commentaires du projet</h2>

                <div style="margin-bottom: 20px;">
                    <textarea id="project-comment-input" class="form-control" rows="3" placeholder="Ajouter un commentaire..."></textarea>
                    <div style="display:flex;justify-content:flex-end;margin-top:8px;">
                        <button class="btn btn-primary" onclick="ProjectDetailPage.addProjectComment()">Envoyer</button>
                    </div>
                </div>

                <div id="project-comments-list">
                    ${comments.length === 0 ? '<p style="color:#8896AB;font-size:14px;">Aucun commentaire pour ce projet.</p>' : ''}
                    ${comments.map(c => `
                        <div style="padding:14px;background:#f8f9fa;border-radius:8px;margin-bottom:10px;border-left:3px solid #3794C4;">
                            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
                                <div>
                                    <strong style="color:#202B5D;">${c.first_name || ''} ${c.last_name || ''}</strong>
                                    <span style="color:#8896AB;font-size:12px;margin-left:8px;">@${c.username}</span>
                                </div>
                                <div style="display:flex;align-items:center;gap:8px;">
                                    <span style="color:#8896AB;font-size:12px;">${formatDate(c.created_at)}</span>
                                    ${c.user_id === currentUser?.id ? `
                                        <button onclick="ProjectDetailPage.deleteProjectComment(${c.id})" style="background:none;border:none;color:#e74c3c;cursor:pointer;font-size:14px;" title="Supprimer">&#10005;</button>
                                    ` : ''}
                                </div>
                            </div>
                            <p style="margin:0;color:#333;font-size:14px;line-height:1.5;white-space:pre-wrap;">${c.comment}</p>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    },

    async addProjectComment() {
        const input = document.getElementById('project-comment-input');
        const comment = input?.value?.trim();
        if (!comment) { Toast.warning('Veuillez entrer un commentaire.'); return; }

        try {
            await API.projects.addComment(this.data.project.id, comment);
            Toast.success('Commentaire ajouté.');
            window.location.reload();
        } catch (err) {
            Toast.error('Erreur: ' + (err.message || 'Erreur inconnue'));
        }
    },

    deleteProjectComment(commentId) {
        Toast.confirm('Supprimer ce commentaire ?', async () => {
            try {
                await API.projects.deleteComment(this.data.project.id, commentId);
                Toast.success('Commentaire supprimé.');
                window.location.reload();
            } catch (err) {
                Toast.error('Erreur: ' + (err.message || 'Erreur inconnue'));
            }
        }, { type: 'danger', confirmText: 'Supprimer' });
    },

    // ==================== Documents ====================
    renderDocuments() {
        const currentUser = Auth.getUser();
        const isProjectManager = this.data.project.project_manager_id === currentUser?.id || Auth.hasRole('admin');
        const docs = this.data.documents || [];

        const fileIcon = (mime) => {
            if (mime?.includes('pdf')) return '<span style="color:#e74c3c;">PDF</span>';
            if (mime?.includes('image')) return '<span style="color:#27ae60;">IMG</span>';
            if (mime?.includes('word') || mime?.includes('doc')) return '<span style="color:#3794C4;">DOC</span>';
            if (mime?.includes('sheet') || mime?.includes('xls')) return '<span style="color:#27ae60;">XLS</span>';
            return '<span style="color:#8896AB;">FILE</span>';
        };

        return `
            <div class="card mb-4">
                <h2 style="margin-bottom: 24px;">Documents</h2>

                ${isProjectManager ? `
                    <div style="margin-bottom: 20px; padding: 16px; background: #f8f9fa; border-radius: 8px; border: 2px dashed #dce3ed;">
                        <input type="file" id="doc-upload-input" style="display:none;" onchange="ProjectDetailPage.uploadDocument(this)">
                        <div style="text-align:center;">
                            <button class="btn btn-secondary" onclick="document.getElementById('doc-upload-input').click()">
                                Choisir un fichier
                            </button>
                            <p style="margin-top:8px;font-size:12px;color:#8896AB;">PDF, Word, Excel, Images (max 5 Mo)</p>
                        </div>
                    </div>
                ` : ''}

                <div id="documents-list">
                    ${docs.length === 0 ? '<p style="color:#8896AB;font-size:14px;">Aucun document.</p>' : ''}
                    ${docs.map(doc => `
                        <div style="display:flex;align-items:center;gap:12px;padding:12px;background:#f8f9fa;border-radius:8px;margin-bottom:8px;">
                            <div style="width:40px;height:40px;background:white;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;border:1px solid #dce3ed;">
                                ${fileIcon(doc.mime_type)}
                            </div>
                            <div style="flex:1;">
                                <a href="/uploads/${doc.filename}" target="_blank" style="font-weight:600;color:#202B5D;text-decoration:none;font-size:14px;">
                                    ${doc.original_filename}
                                </a>
                                <div style="font-size:11px;color:#8896AB;">
                                    ${doc.first_name || ''} ${doc.last_name || ''} — ${new Date(doc.uploaded_at).toLocaleDateString('fr-FR')}
                                    ${doc.size ? ' — ' + (doc.size / 1024 < 1024 ? Math.round(doc.size / 1024) + ' Ko' : (doc.size / 1024 / 1024).toFixed(1) + ' Mo') : ''}
                                </div>
                            </div>
                            ${isProjectManager ? `
                                <button onclick="ProjectDetailPage.deleteDocument(${doc.id})" style="background:none;border:none;color:#e74c3c;cursor:pointer;font-size:18px;" title="Supprimer">&#10005;</button>
                            ` : ''}
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    },

    async uploadDocument(input) {
        const file = input.files[0];
        if (!file) return;

        try {
            const result = await API.uploads.upload(file, 'project', this.data.project.id);
            if (result.success) {
                Toast.success('Document uploadé avec succès.');
                window.location.reload();
            } else {
                Toast.error(result.message || 'Erreur lors de l\'upload.');
            }
        } catch (err) {
            Toast.error('Erreur: ' + (err.message || 'Erreur inconnue'));
        }
        input.value = '';
    },

    deleteDocument(docId) {
        Toast.confirm('Supprimer ce document ?', async () => {
            try {
                await API.uploads.delete(docId);
                Toast.success('Document supprimé.');
                window.location.reload();
            } catch (err) {
                Toast.error('Erreur: ' + (err.message || 'Erreur inconnue'));
            }
        }, { type: 'danger', confirmText: 'Supprimer' });
    }
};
