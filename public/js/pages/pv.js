// Page PV (Procès-Verbal) du Commandement Territorial
const PvPage = {
    data: {
        pvs: [],
        projects: [],
        sites: [],
        localities: [],
        measures: []
    },

    async render() {
        try {
            await this.loadData();
            API.pv.markAllRead().catch(() => {});
            if (typeof Navbar !== 'undefined' && Navbar.refreshPvBadge) Navbar.refreshPvBadge();

            const topHeader = this.getAuthorHeader();
            return `
                ${Navbar.render()}
                <div class="main-content with-sidebar">
                    ${Navbar.renderTopBar("PV" + (topHeader ? " — " + topHeader : ""))}
                    <div class="content-area">
                        ${this.renderIntro()}
                        ${this.renderToolbar()}
                        ${this.renderList()}
                    </div>
                </div>
            `;
        } catch (err) {
            console.error('PV page error:', err);
            return `<div class="alert alert-error">Erreur de chargement</div>`;
        }
    },

    async loadData() {
        const [pvs, pickable] = await Promise.all([
            API.pv.list(),
            API.pv.getPickable().catch(() => ({ data: { projects: [], sites: [], localities: [], measures: [] } }))
        ]);
        this.data.pvs = pvs.data || [];
        const d = pickable.data || {};
        this.data.projects = d.projects || [];
        this.data.sites = d.sites || [];
        this.data.localities = d.localities || [];
        this.data.measures = d.measures || [];
    },

    isTerritorial() { return Auth.hasRole('commandement_territorial'); },

    getAuthorHeader() {
        for (const p of this.data.pvs) {
            const name = [p.author_first_name, p.author_last_name].filter(Boolean).join(' ').trim();
            const label = [p.author_title, name].filter(Boolean).join(' ');
            if (label) return label;
        }
        return '';
    },

    renderIntro() {
        const header = this.getAuthorHeader();
        return `
            <div class="card mb-4" style="background: linear-gradient(135deg, #ca8a04 0%, #eab308 100%); color: white; border: none;">
                <div style="display:flex;align-items:flex-start;gap:16px;">
                    <div style="font-size:38px;">📋</div>
                    <div>
                        <h2 style="margin:0 0 6px;color:white;">PV${header ? ' — ' + this.escape(header) : ''}</h2>
                        <p style="margin:0;opacity:0.9;font-size:13px;">
                            ${this.isTerritorial()
                                ? "Comptes rendus de visite : avancement, observations, recommandations."
                                : "Comptes rendus de visite émis par le Commandement Territorial (Préfet / Gouverneur). Consultation uniquement."}
                        </p>
                    </div>
                </div>
            </div>
        `;
    },

    renderToolbar() {
        return `
            <div class="toolbar">
                <div></div>
                ${this.isTerritorial() ? `
                    <button class="btn btn-primary" style="background:#eab308;border-color:#eab308;color:#1f2937;" onclick="PvPage.openForm()">
                        <span>➕</span>
                        <span>Nouveau PV</span>
                    </button>
                ` : ''}
            </div>
        `;
    },

    renderList(inner = false) {
        if (this.data.pvs.length === 0) {
            const empty = `
                <div class="card text-center" style="padding:60px 20px;">
                    <div style="font-size:56px;opacity:0.3;margin-bottom:10px;">📋</div>
                    <h3 style="color:#62718D;">Aucun PV</h3>
                    <p style="color:#8896AB;">${this.isTerritorial() ? 'Rédigez votre premier compte-rendu.' : 'Aucun compte-rendu n\'a encore été publié.'}</p>
                </div>
            `;
            return inner ? empty : `<div id="pv-list">${empty}</div>`;
        }
        const cards = this.data.pvs.map(p => this.renderCard(p)).join('');
        return inner ? cards : `<div id="pv-list">${cards}</div>`;
    },

    renderCard(p) {
        const currentUser = Auth.getUser();
        const canEdit = this.isTerritorial() && p.author_id === currentUser?.id;

        const prioStyle = {
            urgente:    { bg: '#fee2e2', border: '#e74c3c', text: '#b91c1c', icon: '🔴', label: 'URGENTE' },
            importante: { bg: '#fef3c7', border: '#e67e22', text: '#b45309', icon: '🟠', label: 'IMPORTANTE' },
            info:       { bg: '#fef9c3', border: '#eab308', text: '#854d0e', icon: '🟡', label: 'INFO' }
        }[p.priority || 'info'];

        const authorName = [p.author_first_name, p.author_last_name].filter(Boolean).join(' ') || p.author_username || '—';
        const author = p.author_title ? `${p.author_title} ${authorName}` : authorName;
        const createdAt = new Date(p.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
        const visitDate = p.visit_date ? new Date(p.visit_date).toLocaleDateString('fr-FR') : null;

        const territoryLabel = `${this.escape(p.territorial_level)} : ${this.escape(p.territorial_value)}`;

        const sections = [];
        if (p.avancement) sections.push(this.renderSection('📊 Avancement', p.avancement));
        if (p.observations) sections.push(this.renderSection('📝 Observations', p.observations));
        if (p.recommendations) sections.push(this.renderSection('💡 Recommandations', p.recommendations));
        if (p.content) sections.push(this.renderSection('✍️ Notes', p.content));

        const refs = [];
        if (p.projects?.length) refs.push(`<span style="font-weight:600;color:#854d0e;">Projets :</span> ${p.projects.map(x => this.escape(x.title)).join(', ')}`);
        if (p.sites?.length) refs.push(`<span style="font-weight:600;color:#854d0e;">Sites :</span> ${p.sites.map(x => this.escape(x.name)).join(', ')}`);
        if (p.localities?.length) refs.push(`<span style="font-weight:600;color:#854d0e;">Localités :</span> ${p.localities.map(x => this.escape([x.region, x.departement, x.commune].filter(Boolean).join(' › '))).join(', ')}`);
        if (p.measures?.length) refs.push(`<span style="font-weight:600;color:#854d0e;">Mesures :</span> ${p.measures.map(x => this.escape((x.description || '').slice(0, 60))).join(', ')}`);
        if (refs.length) sections.push(`<div style="margin-top:8px;padding:10px;background:#fefce8;border-radius:6px;font-size:12.5px;color:#2c3e50;line-height:1.7;">${refs.join('<br>')}</div>`);

        sections.push(this.renderAttachments(p, canEdit));

        return `
            <div class="card mb-3" style="border-left:4px solid ${prioStyle.border};">
                <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:12px;">
                    <div style="flex:1;">
                        <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:8px;">
                            <span style="display:inline-flex;align-items:center;gap:4px;padding:3px 10px;background:${prioStyle.bg};color:${prioStyle.text};border-radius:10px;font-size:11px;font-weight:700;">
                                ${prioStyle.icon} ${prioStyle.label}
                            </span>
                            <span style="padding:3px 10px;background:#fef9c3;color:#854d0e;border-radius:10px;font-size:11px;font-weight:600;">🗺️ ${territoryLabel}</span>
                            ${visitDate ? `<span style="padding:3px 10px;background:#f0f4f8;color:#62718D;border-radius:10px;font-size:11px;font-weight:600;">📅 Visite : ${visitDate}</span>` : ''}
                        </div>
                        <h3 style="margin:0 0 4px;color:#202B5D;font-size:18px;">${this.escape(p.title)}</h3>
                        <div style="font-size:12px;color:#8896AB;">Par <strong>${this.escape(author)}</strong> · ${createdAt}</div>
                    </div>
                    ${canEdit ? `
                        <div style="display:flex;gap:6px;">
                            <button class="btn-icon" onclick="PvPage.openForm(${p.id})" title="Modifier">✏️</button>
                            <button class="btn-icon" onclick="PvPage.deletePv(${p.id})" title="Supprimer">🗑️</button>
                        </div>
                    ` : ''}
                </div>
                ${sections.join('')}
            </div>
        `;
    },

    renderAttachments(p, canEdit) {
        const icon = (mime = '') => {
            if (mime.includes('pdf')) return '📄';
            if (mime.includes('word') || mime.includes('doc')) return '📝';
            if (mime.includes('sheet') || mime.includes('excel')) return '📊';
            if (mime.includes('image')) return '🖼️';
            return '📎';
        };
        const fmtSize = (s) => !s ? '' : (s < 1024*1024 ? Math.round(s / 1024) + ' Ko' : (s / 1024 / 1024).toFixed(1) + ' Mo');
        const list = (p.attachments || []).map(d => `
            <div style="display:flex;align-items:center;gap:8px;padding:6px 10px;background:white;border:1px solid #fde68a;border-radius:6px;margin-bottom:4px;">
                <span>${icon(d.mime_type)}</span>
                <div style="flex:1;min-width:0;">
                    <a href="/uploads/${d.filename}" target="_blank" style="color:#202B5D;text-decoration:none;font-size:13px;font-weight:600;">${this.escape(d.label || d.original_filename)}</a>
                    ${d.label ? `<div style="font-size:11px;color:#8896AB;">${this.escape(d.original_filename)}</div>` : ''}
                </div>
                <span style="font-size:11px;color:#8896AB;">${fmtSize(d.size)}</span>
                ${canEdit ? `<button class="btn-icon" style="color:#e74c3c;" onclick="PvPage.deleteAttachment(${d.id}, ${p.id})" title="Supprimer">&#10005;</button>` : ''}
            </div>
        `).join('');
        const uploader = canEdit ? `
            <label style="display:inline-flex;align-items:center;gap:6px;padding:6px 12px;background:#eab308;color:white;border-radius:6px;cursor:pointer;font-size:12px;font-weight:600;margin-top:6px;">
                📎 Ajouter un document
                <input type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,image/*" style="display:none;" onchange="PvPage.uploadAttachment(this, ${p.id})">
            </label>
        ` : '';
        if (!list && !uploader) return '';
        return `
            <div style="margin-top:10px;padding-top:10px;border-top:1px dashed #fde68a;">
                <div style="font-size:12px;font-weight:700;color:#854d0e;margin-bottom:6px;">📎 Documents joints</div>
                ${list}
                ${uploader}
            </div>
        `;
    },

    async uploadAttachment(input, pvId) {
        const file = input.files[0];
        if (!file) return;
        const defaultName = file.name.replace(/\.[^.]+$/, '');
        const label = await Toast.prompt('Titre du document :', defaultName);
        if (!label) { input.value = ''; return; }
        try {
            const res = await API.uploads.upload(file, 'pv', pvId, label);
            if (res.success) {
                Toast.success('Document ajouté.');
                await this.loadData();
                document.getElementById('pv-list').innerHTML = this.renderList(true);
            } else {
                Toast.error(res.message || 'Erreur upload');
            }
        } catch (err) { Toast.error('Erreur: ' + (err.message || 'inconnue')); }
        input.value = '';
    },

    deleteAttachment(docId, pvId) {
        Toast.confirm('Supprimer ce document ?', async () => {
            try {
                await API.uploads.delete(docId);
                Toast.success('Document supprimé.');
                await this.loadData();
                document.getElementById('pv-list').innerHTML = this.renderList(true);
            } catch (err) { Toast.error('Erreur: ' + (err.message || 'inconnue')); }
        }, { type: 'danger', confirmText: 'Supprimer' });
    },

    renderSection(title, body) {
        return `
            <div style="margin-bottom:10px;">
                <div style="font-size:12px;font-weight:700;color:#eab308;margin-bottom:4px;">${title}</div>
                <div style="color:#2c3e50;line-height:1.6;white-space:pre-wrap;">${this.escape(body)}</div>
            </div>
        `;
    },

    escape(str) {
        return String(str || '').replace(/[&<>"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c]));
    },

    openForm(id = null) {
        const isEdit = id !== null;
        const existing = isEdit ? this.data.pvs.find(p => p.id === id) : null;

        const projectOptionsHtml = this.data.projects.map(p =>
            `<option value="${p.id}">${this.escape(p.title)} (${p.structure_code || 'N/A'})</option>`
        ).join('');

        const selectedProjectIds = existing && existing.projects ? existing.projects.map(p => p.id) : [];
        const selectedSiteIds = existing && existing.sites ? existing.sites.map(s => s.id) : [];
        const selectedLocalityIds = existing && existing.localities ? existing.localities.map(l => l.id) : [];
        const selectedMeasureIds = existing && existing.measures ? existing.measures.map(m => m.id) : [];

        const localityLabel = (l) => {
            const parts = [l.region, l.departement, l.arrondissement, l.commune].filter(Boolean);
            return parts.length ? parts.join(' › ') : `Localité #${l.id}`;
        };

        const modal = document.createElement('div');
        modal.className = 'confirm-overlay confirm-visible';
        modal.innerHTML = `
            <div class="confirm-dialog" style="text-align:left;max-width:720px;max-height:90vh;overflow-y:auto;">
                <h3 style="margin-bottom:16px;color:#eab308;">${isEdit ? 'Modifier' : 'Nouveau'} PV de visite</h3>
                <div class="form-group">
                    <label>Titre <span style="color:#e74c3c;">*</span></label>
                    <input type="text" id="pv-title" class="form-control" maxlength="200" placeholder="ex: Visite des sites de curage - Dakar" value="${existing ? this.escape(existing.title) : ''}">
                </div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
                    <div class="form-group">
                        <label>Priorité</label>
                        <select id="pv-priority" class="form-control">
                            <option value="info" ${!existing || existing.priority === 'info' ? 'selected' : ''}>🟢 Information</option>
                            <option value="importante" ${existing && existing.priority === 'importante' ? 'selected' : ''}>🟠 Importante</option>
                            <option value="urgente" ${existing && existing.priority === 'urgente' ? 'selected' : ''}>🔴 Urgente</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Date de visite</label>
                        <input type="date" id="pv-visit-date" class="form-control" value="${existing && existing.visit_date ? existing.visit_date.slice(0,10) : ''}">
                    </div>
                </div>
                <div class="form-group">
                    <label>Avancement</label>
                    <textarea id="pv-avancement" class="form-control" rows="3" placeholder="État d'avancement des projets/ouvrages observés...">${existing ? this.escape(existing.avancement || '') : ''}</textarea>
                </div>
                <div class="form-group">
                    <label>Observations</label>
                    <textarea id="pv-observations" class="form-control" rows="3" placeholder="Constats lors de la visite...">${existing ? this.escape(existing.observations || '') : ''}</textarea>
                </div>
                <div class="form-group">
                    <label>Recommandations</label>
                    <textarea id="pv-recommendations" class="form-control" rows="3" placeholder="Mesures à prendre, directives...">${existing ? this.escape(existing.recommendations || '') : ''}</textarea>
                </div>
                <div class="form-group">
                    <label>Notes complémentaires</label>
                    <textarea id="pv-content" class="form-control" rows="2" placeholder="Texte libre...">${existing ? this.escape(existing.content || '') : ''}</textarea>
                </div>
                <div class="form-group">
                    <label>Projets concernés (optionnel, multi-sélection)</label>
                    <select id="pv-projects" class="form-control" multiple style="height:100px;">
                        ${this.data.projects.map(p => `<option value="${p.id}" ${selectedProjectIds.includes(p.id) ? 'selected' : ''}>${this.escape(p.title)} (${p.structure_code || 'N/A'})</option>`).join('')}
                    </select>
                    <small style="color:#8896AB;">Maintenez Ctrl/Cmd pour sélectionner plusieurs.</small>
                </div>
                <div class="form-group">
                    <label>Sites concernés (optionnel)</label>
                    <select id="pv-sites" class="form-control" multiple style="height:100px;">
                        ${this.data.sites.map(s => `<option value="${s.id}" ${selectedSiteIds.includes(s.id) ? 'selected' : ''}>${this.escape(s.name)}${s.commune ? ' — ' + this.escape(s.commune) : ''}</option>`).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label>Localités concernées (optionnel)</label>
                    <select id="pv-localities" class="form-control" multiple style="height:100px;">
                        ${this.data.localities.map(l => `<option value="${l.id}" ${selectedLocalityIds.includes(l.id) ? 'selected' : ''}>${this.escape(localityLabel(l))}</option>`).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label>Mesures / actions concernées (optionnel)</label>
                    <select id="pv-measures" class="form-control" multiple style="height:100px;">
                        ${this.data.measures.map(m => `<option value="${m.id}" ${selectedMeasureIds.includes(m.id) ? 'selected' : ''}>${this.escape((m.description || '').slice(0, 80))}${m.type ? ' [' + this.escape(m.type) + ']' : ''}</option>`).join('')}
                    </select>
                </div>
                <div class="confirm-actions" style="margin-top:20px;">
                    <button class="confirm-btn confirm-btn-cancel" onclick="this.closest('.confirm-overlay').remove()">Annuler</button>
                    <button class="confirm-btn confirm-btn-ok" style="background:#eab308;" onclick="PvPage.save(${isEdit ? id : 'null'})">${isEdit ? 'Enregistrer' : 'Publier'}</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        setTimeout(() => document.getElementById('pv-title').focus(), 50);
    },

    async save(id) {
        const title = document.getElementById('pv-title').value.trim();
        const priority = document.getElementById('pv-priority').value;
        const visit_date = document.getElementById('pv-visit-date').value || null;
        const avancement = document.getElementById('pv-avancement').value.trim() || null;
        const observations = document.getElementById('pv-observations').value.trim() || null;
        const recommendations = document.getElementById('pv-recommendations').value.trim() || null;
        const content = document.getElementById('pv-content').value.trim() || null;

        const getIds = (id) => Array.from(document.getElementById(id).selectedOptions).map(o => parseInt(o.value)).filter(Boolean);
        const projects = getIds('pv-projects');
        const sites = getIds('pv-sites');
        const localities = getIds('pv-localities');
        const measures = getIds('pv-measures');

        if (!title) { Toast.warning('Le titre est requis'); return; }

        const payload = { title, priority, visit_date, avancement, observations, recommendations, content, projects, sites, localities, measures };

        try {
            if (id) {
                await API.pv.update(id, payload);
                Toast.success('PV mis à jour.');
            } else {
                await API.pv.create(payload);
                Toast.success('PV publié.');
            }
            document.querySelector('.confirm-overlay')?.remove();
            await this.loadData();
            document.getElementById('pv-list').innerHTML = this.renderList(true);
        } catch (err) {
            Toast.error('Erreur: ' + (err.message || 'inconnue'));
        }
    },

    deletePv(id) {
        Toast.confirm('Supprimer définitivement ce PV ?', async () => {
            try {
                await API.pv.delete(id);
                Toast.success('PV supprimé.');
                await this.loadData();
                document.getElementById('pv-list').innerHTML = this.renderList(true);
            } catch (err) { Toast.error('Erreur: ' + (err.message || 'inconnue')); }
        }, { type: 'danger', confirmText: 'Supprimer' });
    },

    afterRender() {
        if (typeof Navbar !== 'undefined' && Navbar.updateActiveMenu) Navbar.updateActiveMenu();
    }
};
