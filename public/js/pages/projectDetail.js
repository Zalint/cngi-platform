// Page détail d'un projet

const ProjectDetailPage = {
    data: {
        project: null,
        users: [], // Utilisateurs de la structure pour assignation
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

            // Charger les utilisateurs de la structure pour assignation
            if (this.data.project.structure_id) {
                const usersResponse = await API.users.getAll();
                this.data.users = usersResponse.data.filter(u => u.structure_id === this.data.project.structure_id && u.role === 'utilisateur');
            }

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
                            Structure: <span style="font-weight: 600;">${p.structure_name || 'N/A'}</span>
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

                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 24px; margin-top: 24px; padding-top: 24px; border-top: 1px solid #e0e0e0;">
                    <div>
                        <div style="font-size: 12px; color: #999; text-transform: uppercase; margin-bottom: 4px;">Date de début</div>
                        <div style="font-weight: 600; color: #333;">${p.start_date ? DateFormatter.format(p.start_date) : 'Non définie'}</div>
                    </div>
                    <div>
                        <div style="font-size: 12px; color: #999; text-transform: uppercase; margin-bottom: 4px;">Échéance</div>
                        <div style="font-weight: 600; color: #333;">${p.deadline_date ? DateFormatter.format(p.deadline_date) : 'Non définie'}</div>
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
                                    <div style="padding:8px 12px;background:white;border-radius:6px;border:1px solid #dce3ed;">
                                        <div style="font-size:10px;color:#8896AB;font-weight:600;text-transform:uppercase;">Région</div>
                                        <div style="font-size:13px;font-weight:600;color:#202B5D;" id="loc-region-${index}">${loc.region || '—'}</div>
                                    </div>
                                    <div style="padding:8px 12px;background:white;border-radius:6px;border:1px solid #dce3ed;">
                                        <div style="font-size:10px;color:#8896AB;font-weight:600;text-transform:uppercase;">Département</div>
                                        <div style="font-size:13px;font-weight:600;color:#202B5D;" id="loc-dept-${index}">${loc.departement || '—'}</div>
                                    </div>
                                    <div style="padding:8px 12px;background:white;border-radius:6px;border:1px solid #dce3ed;">
                                        <div style="font-size:10px;color:#8896AB;font-weight:600;text-transform:uppercase;">Arrondissement</div>
                                        <div style="font-size:13px;font-weight:600;color:#202B5D;" id="loc-arrond-${index}">${loc.arrondissement || '—'}</div>
                                    </div>
                                    <div style="padding:8px 12px;background:white;border-radius:6px;border:1px solid #dce3ed;">
                                        <div style="font-size:10px;color:#8896AB;font-weight:600;text-transform:uppercase;">Commune</div>
                                        <div style="font-size:13px;font-weight:600;color:#202B5D;" id="loc-commune-${index}">${loc.commune || '—'}</div>
                                    </div>
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
                                <div style="display: grid; grid-template-columns: 1fr 1fr auto auto; gap: 10px; margin-bottom: 10px;">
                                    <input type="text" class="form-control" placeholder="Nom du site"
                                           value="${site.name || ''}"
                                           onchange="ProjectDetailPage.updateSiteField(${index}, 'name', this.value)">
                                    <input type="text" class="form-control" placeholder="Description"
                                           value="${site.description || ''}"
                                           onchange="ProjectDetailPage.updateSiteField(${index}, 'description', this.value)">
                                    <input type="text" class="form-control" placeholder="Lat,Lng" style="max-width:140px;"
                                           value="${site.latitude && site.longitude ? site.latitude + ',' + site.longitude : ''}"
                                           onchange="ProjectDetailPage.updateSiteCoordinates(${index}, this.value)">
                                    <button class="btn btn-danger" onclick="ProjectDetailPage.removeSite(${index})" style="font-size:12px;">
                                        Retirer
                                    </button>
                                </div>
                                <div style="position:relative; margin-bottom:8px;">
                                    <input type="text" class="form-control site-search" data-site-index="${index}"
                                           placeholder="Rechercher localisation (commune, arrondissement...)"
                                           oninput="ProjectDetailPage.onLocationSearch(${index}, 'site', this.value)"
                                           onfocus="ProjectDetailPage.onLocationSearch(${index}, 'site', this.value)"
                                           autocomplete="off">
                                    <div class="search-results" id="site-results-${index}" style="display:none;position:absolute;top:100%;left:0;right:0;z-index:100;background:white;border:1px solid #dce3ed;border-radius:0 0 8px 8px;max-height:250px;overflow-y:auto;box-shadow:0 4px 12px rgba(0,0,0,0.1);"></div>
                                </div>
                                <div style="display:grid; grid-template-columns:repeat(4,1fr); gap:8px;">
                                    <div style="padding:6px 10px;background:white;border-radius:6px;border:1px solid #dce3ed;">
                                        <div style="font-size:10px;color:#8896AB;font-weight:600;">REGION</div>
                                        <div style="font-size:12px;font-weight:600;color:#202B5D;" id="site-region-${index}">${site.region || '—'}</div>
                                    </div>
                                    <div style="padding:6px 10px;background:white;border-radius:6px;border:1px solid #dce3ed;">
                                        <div style="font-size:10px;color:#8896AB;font-weight:600;">DEPT</div>
                                        <div style="font-size:12px;font-weight:600;color:#202B5D;" id="site-dept-${index}">${site.departement || '—'}</div>
                                    </div>
                                    <div style="padding:6px 10px;background:white;border-radius:6px;border:1px solid #dce3ed;">
                                        <div style="font-size:10px;color:#8896AB;font-weight:600;">ARROND</div>
                                        <div style="font-size:12px;font-weight:600;color:#202B5D;" id="site-arrond-${index}">${site.arrondissement || '—'}</div>
                                    </div>
                                    <div style="padding:6px 10px;background:white;border-radius:6px;border:1px solid #dce3ed;">
                                        <div style="font-size:10px;color:#8896AB;font-weight:600;">COMMUNE</div>
                                        <div style="font-size:12px;font-weight:600;color:#202B5D;" id="site-commune-${index}">${site.commune || '—'}</div>
                                    </div>
                                </div>
                            ` : `
                                <div><strong>${site.name}</strong> — ${site.description || ''}</div>
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
                            
                            <div style="display: grid; grid-template-columns: 2fr 1fr 1fr 1fr auto; gap: 12px; align-items: start;">
                                ${canEditThisMeasure ? `
                                    <textarea class="form-control" placeholder="Description de la mesure" rows="2"
                                              onchange="ProjectDetailPage.updateMeasureField(${index}, 'description', this.value)">${measure.description || ''}</textarea>
                                    <select class="form-control" onchange="ProjectDetailPage.updateMeasureField(${index}, 'type', this.value)">
                                        <option value="">-- Type --</option>
                                        <option value="Pompage" ${measure.type === 'Pompage' ? 'selected' : ''}>Pompage</option>
                                        <option value="Nettoyage" ${measure.type === 'Nettoyage' ? 'selected' : ''}>Nettoyage</option>
                                        <option value="Équipement" ${measure.type === 'Équipement' ? 'selected' : ''}>Équipement</option>
                                        <option value="Autre" ${measure.type === 'Autre' ? 'selected' : ''}>Autre</option>
                                    </select>
                                    <select class="form-control" onchange="ProjectDetailPage.updateMeasureField(${index}, 'status', this.value)">
                                        <option value="preconisee" ${measure.status === 'preconisee' ? 'selected' : ''}>Préconisée</option>
                                        <option value="executee" ${measure.status === 'executee' ? 'selected' : ''}>Exécutée</option>
                                        <option value="non_executee" ${measure.status === 'non_executee' ? 'selected' : ''}>Non exécutée</option>
                                    </select>
                                    <select class="form-control" onchange="ProjectDetailPage.updateMeasureField(${index}, 'assigned_user_id', this.value)">
                                        <option value="">-- Utilisateur --</option>
                                        ${this.data.users.map(user => `
                                            <option value="${user.id}" ${measure.assigned_user_id == user.id ? 'selected' : ''}>
                                                ${user.first_name} ${user.last_name || ''} (${user.username})
                                            </option>
                                        `).join('')}
                                    </select>
                                    <button class="btn btn-danger" onclick="ProjectDetailPage.removeMeasure(${index})">
                                        🗑️
                                    </button>
                                ` : canOnlyUpdateStatus ? `
                                    <div style="grid-column: span 5;">
                                        <div style="margin-bottom: 8px;"><strong>Description:</strong> ${measure.description}</div>
                                        <div style="margin-bottom: 8px;"><strong>Type:</strong> ${measure.type || 'N/A'}</div>
                                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                                            <div>
                                                <label style="font-size: 12px; color: #666;">Statut de la mesure</label>
                                                <select class="form-control" onchange="ProjectDetailPage.updateMyMeasureStatus(${measure.id}, this.value)">
                                                    <option value="preconisee" ${measure.status === 'preconisee' ? 'selected' : ''}>Préconisée</option>
                                                    <option value="executee" ${measure.status === 'executee' ? 'selected' : ''}>Exécutée</option>
                                                    <option value="non_executee" ${measure.status === 'non_executee' ? 'selected' : ''}>Non exécutée</option>
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
        this.data.editMode.sites.push({ name: '', description: '', region: '', departement: '', arrondissement: '', commune: '', latitude: null, longitude: null });
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

    // ==================== Méthodes de gestion des mesures ====================
    addMeasure() {
        this.data.editMode.measures.push({ description: '', type: '', status: 'preconisee' });
        this.refreshSection('measures');
    },

    removeMeasure(index) {
        this.data.editMode.measures.splice(index, 1);
        this.refreshSection('measures');
    },

    updateMeasureField(index, field, value) {
        this.data.editMode.measures[index][field] = value;
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
                        <div style="display: grid; grid-template-columns: 1fr 2fr 1fr 1fr; gap: 12px; align-items: start;">
                            <input type="text" class="form-control" placeholder="Nom du site" 
                                   value="${site.name || ''}" 
                                   onchange="ProjectDetailPage.updateSiteField(${index}, 'name', this.value)">
                            <input type="text" class="form-control" placeholder="Description" 
                                   value="${site.description || ''}" 
                                   onchange="ProjectDetailPage.updateSiteField(${index}, 'description', this.value)">
                            <input type="text" class="form-control" placeholder="Latitude,Longitude" 
                                   value="${site.latitude && site.longitude ? site.latitude + ',' + site.longitude : ''}" 
                                   onchange="ProjectDetailPage.updateSiteCoordinates(${index}, this.value)">
                            <button class="btn btn-danger" onclick="ProjectDetailPage.removeSite(${index})">
                                🗑️ Retirer
                            </button>
                        </div>
                    </div>
                `).join('');
                break;

            case 'measures':
                container = document.getElementById('measures-container');
                html = this.data.editMode.measures.map((measure, index) => `
                    <div class="measure-item" style="padding: 16px; background: #f8f9fa; border-radius: 8px; margin-bottom: 12px;" data-index="${index}">
                        <div style="display: grid; grid-template-columns: 2fr 1fr 1fr auto; gap: 12px; align-items: start;">
                            <textarea class="form-control" placeholder="Description de la mesure" rows="2"
                                      onchange="ProjectDetailPage.updateMeasureField(${index}, 'description', this.value)">${measure.description || ''}</textarea>
                            <select class="form-control" onchange="ProjectDetailPage.updateMeasureField(${index}, 'type', this.value)">
                                <option value="">-- Type --</option>
                                <option value="Pompage" ${measure.type === 'Pompage' ? 'selected' : ''}>Pompage</option>
                                <option value="Nettoyage" ${measure.type === 'Nettoyage' ? 'selected' : ''}>Nettoyage</option>
                                <option value="Équipement" ${measure.type === 'Équipement' ? 'selected' : ''}>Équipement</option>
                                <option value="Autre" ${measure.type === 'Autre' ? 'selected' : ''}>Autre</option>
                            </select>
                            <select class="form-control" onchange="ProjectDetailPage.updateMeasureField(${index}, 'status', this.value)">
                                <option value="preconisee" ${measure.status === 'preconisee' ? 'selected' : ''}>Préconisée</option>
                                <option value="executee" ${measure.status === 'executee' ? 'selected' : ''}>Exécutée</option>
                                <option value="non_executee" ${measure.status === 'non_executee' ? 'selected' : ''}>Non exécutée</option>
                            </select>
                            <button class="btn btn-danger" onclick="ProjectDetailPage.removeMeasure(${index})">
                                🗑️
                            </button>
                        </div>
                    </div>
                `).join('');
                break;

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

    selectLocation(index, type, resultIndex) {
        const resultsDiv = document.getElementById(`${type}-results-${index}`);
        const row = resultsDiv?._data?.[resultIndex];
        if (!row) return;

        const target = type === 'loc' ? this.data.editMode.localities[index] : this.data.editMode.sites[index];
        target.region = row.region;
        target.departement = row.departement;
        target.arrondissement = row.arrondissement;
        target.commune = row.commune;

        // Update display
        const prefix = type === 'loc' ? 'loc' : 'site';
        const el = (id) => document.getElementById(id);
        if (el(`${prefix}-region-${index}`)) el(`${prefix}-region-${index}`).textContent = row.region;
        if (el(`${prefix}-dept-${index}`)) el(`${prefix}-dept-${index}`).textContent = row.departement;
        if (el(`${prefix}-arrond-${index}`)) el(`${prefix}-arrond-${index}`).textContent = row.arrondissement;
        if (el(`${prefix}-commune-${index}`)) el(`${prefix}-commune-${index}`).textContent = row.commune;

        // Clear search
        resultsDiv.style.display = 'none';
        const searchInput = type === 'loc'
            ? document.querySelector(`.loc-search[data-index="${index}"]`)
            : document.querySelector(`.site-search[data-site-index="${index}"]`);
        if (searchInput) searchInput.value = `${row.commune} — ${row.arrondissement}`;
    },

    async populateLocationDropdowns() {
        // Pre-fill search inputs for existing data
        this.data.editMode.localities.forEach((loc, i) => {
            if (loc.commune) {
                const input = document.querySelector(`.loc-search[data-index="${i}"]`);
                if (input) input.value = `${loc.commune} — ${loc.arrondissement || ''}`;
            }
        });
        this.data.editMode.sites.forEach((site, i) => {
            if (site.commune || site.region) {
                const input = document.querySelector(`.site-search[data-site-index="${i}"]`);
                if (input) input.value = [site.commune, site.arrondissement].filter(Boolean).join(' — ') || site.region || '';
            }
        });

        // Close search results on click outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.loc-search') && !e.target.closest('.site-search') && !e.target.closest('.search-results')) {
                document.querySelectorAll('.search-results').forEach(el => el.style.display = 'none');
            }
        });
    }
};
