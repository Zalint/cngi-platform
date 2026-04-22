// Page Observation du ministre
const ObservationsPage = {
    data: {
        observations: [],
        projects: [],
        filter: { scope: '', priority: '' }
    },

    async render() {
        try {
            await this.loadData();
            // Marquer comme lues dès l'arrivée sur la page
            API.observations.markRead().catch(() => {});
            Navbar.refreshObservationBadge();

            return `
                ${Navbar.render()}
                <div class="main-content with-sidebar">
                    ${Navbar.renderTopBar('Observation du ministre')}
                    <div class="content-area">
                        ${this.renderIntro()}
                        ${this.renderToolbar()}
                        ${this.renderList()}
                    </div>
                </div>
            `;
        } catch (err) {
            console.error('Observations page error:', err);
            return `<div class="alert alert-error">Erreur de chargement</div>`;
        }
    },

    async loadData() {
        const [obs, projects] = await Promise.all([
            API.observations.list(this.data.filter),
            API.projects.getAll().catch(() => ({ data: [] }))
        ]);
        this.data.observations = obs.data || [];
        this.data.projects = projects.data || [];
    },

    isSupervisor() { return Auth.hasRole('superviseur'); },
    isAdmin() { return Auth.hasRole('admin'); },

    getMinisterName() {
        // Déduit le nom du ministre à partir de l'auteur de la dernière observation
        for (const o of this.data.observations) {
            const name = [o.author_first_name, o.author_last_name].filter(Boolean).join(' ').trim();
            if (name) return name;
        }
        return '';
    },

    getMinisterTitle() {
        for (const o of this.data.observations) {
            if (o.author_title) return o.author_title;
        }
        return '';
    },

    renderIntro() {
        const ministerName = this.getMinisterName();
        const ministerTitle = this.getMinisterTitle();
        return `
            <div class="card mb-4" style="background: linear-gradient(135deg, #202B5D 0%, #3794C4 100%); color: white; border: none;">
                <div style="display:flex;align-items:flex-start;gap:16px;">
                    <div style="font-size:38px;">📜</div>
                    <div>
                        <h2 style="margin:0 0 6px;color:white;">Observation${ministerTitle || ministerName ? ' — ' + this.escape([ministerTitle, ministerName].filter(Boolean).join(' ')) : ''}</h2>
                        <p style="margin:0;opacity:0.9;font-size:13px;">
                            ${this.isSupervisor()
                                ? 'Publiez ici vos directives et observations à l\'attention des structures.'
                                : 'Directives et observations émises par le Ministre. Consultation uniquement.'}
                        </p>
                    </div>
                </div>
            </div>
        `;
    },

    renderToolbar() {
        const canWrite = this.isSupervisor();
        return `
            <div class="toolbar">
                <div class="search-filter">
                    <select class="filter-select" id="obs-filter-scope" onchange="ObservationsPage.applyFilter()">
                        <option value="" ${!this.data.filter.scope ? 'selected' : ''}>Toutes</option>
                        <option value="global" ${this.data.filter.scope === 'global' ? 'selected' : ''}>Générales</option>
                        <option value="project" ${this.data.filter.scope === 'project' ? 'selected' : ''}>Liées à un projet</option>
                    </select>
                    <select class="filter-select" id="obs-filter-priority" onchange="ObservationsPage.applyFilter()">
                        <option value="" ${!this.data.filter.priority ? 'selected' : ''}>Toutes priorités</option>
                        <option value="urgente" ${this.data.filter.priority === 'urgente' ? 'selected' : ''}>🔴 Urgente</option>
                        <option value="importante" ${this.data.filter.priority === 'importante' ? 'selected' : ''}>🟠 Importante</option>
                        <option value="info" ${this.data.filter.priority === 'info' ? 'selected' : ''}>🔵 Information</option>
                    </select>
                </div>
                ${canWrite ? `
                    <button class="btn btn-primary" onclick="ObservationsPage.openForm()">
                        <span>➕</span>
                        <span>Nouvelle observation</span>
                    </button>
                ` : ''}
            </div>
        `;
    },

    async applyFilter() {
        this.data.filter.scope = document.getElementById('obs-filter-scope').value;
        this.data.filter.priority = document.getElementById('obs-filter-priority').value;
        const res = await API.observations.list(this.data.filter);
        this.data.observations = res.data || [];
        document.getElementById('observations-list').innerHTML = this.renderList(true);
    },

    renderList(inner = false) {
        if (this.data.observations.length === 0) {
            const empty = `
                <div class="card text-center" style="padding:60px 20px;">
                    <div style="font-size:56px;opacity:0.3;margin-bottom:10px;">📜</div>
                    <h3 style="color:#62718D;">Aucune observation</h3>
                    <p style="color:#8896AB;">${this.isSupervisor() ? 'Publiez votre première directive.' : 'Aucune directive n\'a encore été publiée.'}</p>
                </div>
            `;
            return inner ? empty : `<div id="observations-list">${empty}</div>`;
        }

        const cards = this.data.observations.map(o => this.renderCard(o)).join('');
        return inner ? cards : `<div id="observations-list">${cards}</div>`;
    },

    renderCard(o) {
        const currentUser = Auth.getUser();
        const canEdit = this.isSupervisor() && o.author_id === currentUser?.id;
        const canDelete = canEdit || this.isAdmin();

        const prioStyle = {
            urgente:    { bg: '#fee2e2', border: '#e74c3c', text: '#b91c1c', icon: '🔴', label: 'URGENTE' },
            importante: { bg: '#fef3c7', border: '#e67e22', text: '#b45309', icon: '🟠', label: 'IMPORTANTE' },
            info:       { bg: '#ffe4e6', border: '#e11d48', text: '#9f1239', icon: '🔴', label: 'INFO' }
        }[o.priority || 'info'];

        const authorName = [o.author_first_name, o.author_last_name].filter(Boolean).join(' ') || o.author_username || '—';
        const author = o.author_title ? `${o.author_title} ${authorName}` : authorName;
        const createdAt = new Date(o.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
        const deadline = o.deadline ? new Date(o.deadline).toLocaleDateString('fr-FR') : null;
        const overdue = o.deadline && new Date(o.deadline) < new Date();

        const projectLink = o.project_id
            ? `<a href="#/projects/${o.project_id}" style="display:inline-flex;align-items:center;gap:6px;padding:4px 10px;background:#f0f4f8;color:#202B5D;border-radius:10px;font-size:12px;font-weight:600;text-decoration:none;">
                📁 ${o.project_title || 'Projet'}${o.project_structure_code ? ` (${o.project_structure_code})` : ''}
               </a>`
            : `<span style="padding:4px 10px;background:#f0f4f8;color:#62718D;border-radius:10px;font-size:11px;font-weight:600;">🌐 Observation générale</span>`;

        return `
            <div class="card mb-3" style="border-left:4px solid ${prioStyle.border};">
                <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:12px;">
                    <div style="flex:1;">
                        <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:8px;">
                            <span style="display:inline-flex;align-items:center;gap:4px;padding:3px 10px;background:${prioStyle.bg};color:${prioStyle.text};border-radius:10px;font-size:11px;font-weight:700;">
                                ${prioStyle.icon} ${prioStyle.label}
                            </span>
                            ${projectLink}
                            ${deadline ? `
                                <span style="padding:3px 10px;background:${overdue ? '#fee2e2' : '#f0f4f8'};color:${overdue ? '#b91c1c' : '#62718D'};border-radius:10px;font-size:11px;font-weight:600;">
                                    📅 Échéance : ${deadline}${overdue ? ' ⚠️ dépassée' : ''}
                                </span>
                            ` : ''}
                        </div>
                        <h3 style="margin:0 0 4px;color:#202B5D;font-size:18px;">${this.escape(o.title)}</h3>
                        <div style="font-size:12px;color:#8896AB;">Par <strong>${this.escape(author)}</strong> · ${createdAt}</div>
                    </div>
                    ${canEdit || canDelete ? `
                        <div style="display:flex;gap:6px;">
                            ${canEdit ? `<button class="btn-icon" onclick="ObservationsPage.openForm(${o.id})" title="Modifier">✏️</button>` : ''}
                            ${canDelete ? `<button class="btn-icon" onclick="ObservationsPage.deleteObs(${o.id})" title="Supprimer">🗑️</button>` : ''}
                        </div>
                    ` : ''}
                </div>
                <div style="color:#2c3e50;line-height:1.6;white-space:pre-wrap;">${this.escape(o.content)}</div>
                ${this.renderAttachments(o, canEdit)}
            </div>
        `;
    },

    renderAttachments(o, canEdit) {
        const icon = (mime = '') => {
            if (mime.includes('pdf')) return '📄';
            if (mime.includes('word') || mime.includes('doc')) return '📝';
            if (mime.includes('sheet') || mime.includes('excel')) return '📊';
            if (mime.includes('image')) return '🖼️';
            return '📎';
        };
        const fmtSize = (s) => !s ? '' : (s < 1024*1024 ? Math.round(s / 1024) + ' Ko' : (s / 1024 / 1024).toFixed(1) + ' Mo');
        const list = (o.attachments || []).map(d => `
            <div style="display:flex;align-items:center;gap:8px;padding:6px 10px;background:white;border:1px solid #e2e8f0;border-radius:6px;margin-bottom:4px;">
                <span>${icon(d.mime_type)}</span>
                <div style="flex:1;min-width:0;">
                    <a href="/uploads/${d.filename}" target="_blank" style="color:#202B5D;text-decoration:none;font-size:13px;font-weight:600;">${this.escape(d.label || d.original_filename)}</a>
                    ${d.label ? `<div style="font-size:11px;color:#8896AB;">${this.escape(d.original_filename)}</div>` : ''}
                </div>
                <span style="font-size:11px;color:#8896AB;">${fmtSize(d.size)}</span>
                ${canEdit ? `<button class="btn-icon" style="color:#e74c3c;" onclick="ObservationsPage.deleteAttachment(${d.id})" title="Supprimer">&#10005;</button>` : ''}
            </div>
        `).join('');
        const uploader = canEdit ? `
            <label style="display:inline-flex;align-items:center;gap:6px;padding:6px 12px;background:#202B5D;color:white;border-radius:6px;cursor:pointer;font-size:12px;font-weight:600;margin-top:6px;">
                📎 Ajouter un document
                <input type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,image/*" style="display:none;" onchange="ObservationsPage.uploadAttachment(this, ${o.id})">
            </label>
        ` : '';
        if (!list && !uploader) return '';
        return `
            <div style="margin-top:10px;padding-top:10px;border-top:1px dashed #e2e8f0;">
                <div style="font-size:12px;font-weight:700;color:#62718D;margin-bottom:6px;">📎 Documents joints</div>
                ${list}
                ${uploader}
            </div>
        `;
    },

    async uploadAttachment(input, obsId) {
        const file = input.files[0];
        if (!file) return;
        const defaultName = file.name.replace(/\.[^.]+$/, '');
        const label = (prompt('Titre du document :', defaultName) || '').trim();
        if (!label) { input.value = ''; return; }
        try {
            const res = await API.uploads.upload(file, 'observation', obsId, label);
            if (res.success) {
                Toast.success('Document ajouté.');
                await this.loadData();
                document.getElementById('observations-list').innerHTML = this.renderList(true);
            } else {
                Toast.error(res.message || 'Erreur upload');
            }
        } catch (err) { Toast.error('Erreur: ' + (err.message || 'inconnue')); }
        input.value = '';
    },

    deleteAttachment(docId) {
        Toast.confirm('Supprimer ce document ?', async () => {
            try {
                await API.uploads.delete(docId);
                Toast.success('Document supprimé.');
                await this.loadData();
                document.getElementById('observations-list').innerHTML = this.renderList(true);
            } catch (err) { Toast.error('Erreur: ' + (err.message || 'inconnue')); }
        }, { type: 'danger', confirmText: 'Supprimer' });
    },

    escape(str) {
        return String(str || '').replace(/[&<>"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c]));
    },

    openForm(id = null) {
        const isEdit = id !== null;
        const existing = isEdit ? this.data.observations.find(o => o.id === id) : null;

        const projectOptions = this.data.projects.map(p =>
            `<option value="${p.id}" ${existing && existing.project_id === p.id ? 'selected' : ''}>${this.escape(p.title)} (${p.structure_code || 'N/A'})</option>`
        ).join('');

        const modal = document.createElement('div');
        modal.className = 'confirm-overlay confirm-visible';
        modal.innerHTML = `
            <div class="confirm-dialog" style="text-align:left;max-width:620px;">
                <h3 style="margin-bottom:16px;color:#202B5D;">${isEdit ? 'Modifier' : 'Nouvelle'} observation</h3>
                <div class="form-group">
                    <label>Titre <span style="color:#e74c3c;">*</span></label>
                    <input type="text" id="obs-title" class="form-control" maxlength="200" placeholder="ex: Curage à finaliser avant le 30/06/2026" value="${existing ? this.escape(existing.title) : ''}">
                </div>
                <div class="form-group">
                    <label>Contenu <span style="color:#e74c3c;">*</span></label>
                    <textarea id="obs-content" class="form-control" rows="6" placeholder="Observation / directive détaillée...">${existing ? this.escape(existing.content) : ''}</textarea>
                </div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
                    <div class="form-group">
                        <label>Priorité</label>
                        <select id="obs-priority" class="form-control">
                            <option value="info" ${!existing || existing.priority === 'info' ? 'selected' : ''}>🔵 Information</option>
                            <option value="importante" ${existing && existing.priority === 'importante' ? 'selected' : ''}>🟠 Importante</option>
                            <option value="urgente" ${existing && existing.priority === 'urgente' ? 'selected' : ''}>🔴 Urgente</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Date limite (optionnelle)</label>
                        <input type="date" id="obs-deadline" class="form-control" value="${existing && existing.deadline ? existing.deadline.slice(0,10) : ''}">
                    </div>
                </div>
                <div class="form-group">
                    <label>Projet concerné (optionnel)</label>
                    <select id="obs-project" class="form-control">
                        <option value="">— Observation générale —</option>
                        ${projectOptions}
                    </select>
                </div>
                <div class="confirm-actions" style="margin-top:20px;">
                    <button class="confirm-btn confirm-btn-cancel" onclick="this.closest('.confirm-overlay').remove()">Annuler</button>
                    <button class="confirm-btn confirm-btn-ok" style="background:#202B5D;" onclick="ObservationsPage.save(${isEdit ? id : 'null'})">${isEdit ? 'Enregistrer' : 'Publier'}</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        setTimeout(() => document.getElementById('obs-title').focus(), 50);
    },

    async save(id) {
        const title = document.getElementById('obs-title').value.trim();
        const content = document.getElementById('obs-content').value.trim();
        const priority = document.getElementById('obs-priority').value;
        const deadline = document.getElementById('obs-deadline').value || null;
        const projectIdVal = document.getElementById('obs-project').value;
        const project_id = projectIdVal ? parseInt(projectIdVal) : null;

        if (!title) { Toast.warning('Le titre est requis'); return; }
        if (!content) { Toast.warning('Le contenu est requis'); return; }

        try {
            if (id) {
                await API.observations.update(id, { title, content, priority, deadline, project_id });
                Toast.success('Observation mise à jour.');
            } else {
                await API.observations.create({ title, content, priority, deadline, project_id });
                Toast.success('Observation publiée.');
            }
            document.querySelector('.confirm-overlay')?.remove();
            await this.loadData();
            document.getElementById('observations-list').innerHTML = this.renderList(true);
        } catch (err) {
            Toast.error('Erreur: ' + (err.message || 'inconnue'));
        }
    },

    deleteObs(id) {
        Toast.confirm('Supprimer définitivement cette observation ?', async () => {
            try {
                await API.observations.delete(id);
                Toast.success('Observation supprimée.');
                await this.loadData();
                document.getElementById('observations-list').innerHTML = this.renderList(true);
            } catch (err) { Toast.error('Erreur: ' + (err.message || 'inconnue')); }
        }, { type: 'danger', confirmText: 'Supprimer' });
    },

    afterRender() {
        Navbar.updateActiveMenu();
    }
};
