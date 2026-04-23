// Page "Mes mesures" — liste des mesures assignées à l'utilisateur authentifié,
// tous projets confondus, avec filtre par statut et compteurs.

const MyMeasuresPage = {
    data: {
        measures: [],
        stats: null,
        currentStatus: ''
    },

    _escapeHtml(text) {
        if (text === null || text === undefined) return '';
        const s = String(text);
        const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '`': '&#96;' };
        return s.replace(/[&<>"'`]/g, c => map[c]);
    },

    STATUS_LABELS: {
        preconisee:   'Préconisée',
        executee:     'Exécutée',
        non_executee: 'Non exécutée',
        observations: 'Observations'
    },

    STATUS_COLORS: {
        preconisee:   { bg: '#fef3c7', fg: '#92400e' },
        executee:     { bg: '#d1fae5', fg: '#065f46' },
        non_executee: { bg: '#fee2e2', fg: '#991b1b' },
        observations: { bg: '#dbeafe', fg: '#1e40af' }
    },

    async render() {
        try {
            await this.loadData();

            return `
                ${Navbar.render()}
                <div class="main-content with-sidebar">
                    ${Navbar.renderTopBar('Mes mesures')}
                    <div class="content-area">
                        ${this.renderStats()}
                        ${this.renderFilters()}
                        ${this.renderMeasures()}
                    </div>
                </div>
            `;
        } catch (error) {
            console.error('Error rendering MyMeasures:', error);
            return `<div class="alert alert-error">Erreur de chargement : ${this._escapeHtml(error.message)}</div>`;
        }
    },

    async loadData() {
        const filters = this.data.currentStatus ? { status: this.data.currentStatus } : {};
        const [measures, stats] = await Promise.all([
            API.measures.listMine(filters),
            API.measures.myStats()
        ]);
        this.data.measures = measures.data || [];
        this.data.stats = stats.data || {};
    },

    renderStats() {
        const s = this.data.stats || {};
        const card = (label, value, color, onClick) => `
            <div class="metric-card" ${onClick ? `onclick="${onClick}" style="cursor:pointer;"` : ''} title="Cliquer pour filtrer">
                <div class="metric-value" style="color:${color};">${value || 0}</div>
                <div class="metric-label">${label}</div>
            </div>
        `;
        return `
            <div class="metrics-grid" style="grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));">
                ${card('Total',          s.total,          '#202B5D', `MyMeasuresPage.setFilter('')`)}
                ${card('À faire',        s.pending,        '#f39c12', `MyMeasuresPage.setFilter('preconisee')`)}
                ${card('En retard',      s.overdue,        '#c0392b', `MyMeasuresPage.setFilter('')`)}
                ${card('Échéance < 7j',  s.due_soon,       '#e67e22', `MyMeasuresPage.setFilter('')`)}
                ${card('Exécutées',      s.executee,       '#27ae60', `MyMeasuresPage.setFilter('executee')`)}
            </div>
        `;
    },

    renderFilters() {
        const cur = this.data.currentStatus;
        const mk = (val, label) => `
            <button onclick="MyMeasuresPage.setFilter('${val}')"
                    style="padding:8px 14px;border:1px solid ${cur === val ? '#202B5D' : '#dce3ed'};background:${cur === val ? '#202B5D' : 'white'};color:${cur === val ? 'white' : '#202B5D'};border-radius:6px;cursor:pointer;font-size:12px;font-weight:600;">
                ${label}
            </button>
        `;
        return `
            <div class="toolbar" style="margin:16px 0;">
                <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;">
                    <span style="color:#62718D;font-size:12px;margin-right:8px;">Filtrer par statut :</span>
                    ${mk('',              'Tous')}
                    ${mk('preconisee',    '⏳ Préconisées')}
                    ${mk('executee',      '✓ Exécutées')}
                    ${mk('non_executee',  '✗ Non exécutées')}
                    ${mk('observations',  '💬 Observations')}
                </div>
            </div>
        `;
    },

    renderMeasures() {
        const esc = (t) => this._escapeHtml(t);
        const measures = this.data.measures;

        if (measures.length === 0) {
            return `
                <div class="card text-center" style="padding:60px 20px;">
                    <div style="font-size:48px;margin-bottom:12px;opacity:0.4;">✅</div>
                    <h3 style="margin:0 0 8px;">Aucune mesure ne correspond</h3>
                    <p style="color:#62718D;font-size:13px;margin:0;">Aucune mesure ${this.data.currentStatus ? this.STATUS_LABELS[this.data.currentStatus] + 's' : 'assignée'} pour le moment.</p>
                </div>
            `;
        }

        const cards = measures.map(m => {
            const statusColor = this.STATUS_COLORS[m.status] || { bg: '#e8ecf1', fg: '#202B5D' };
            const deadline = m.project_deadline ? new Date(m.project_deadline) : null;
            const now = new Date();
            const isOverdue = deadline && deadline < now && m.status !== 'executee';
            const isDueSoon = deadline && !isOverdue && (deadline - now) / (1000*60*60*24) < 7 && m.status !== 'executee';

            const deadlineTag = deadline ? `
                <span style="display:inline-flex;align-items:center;gap:4px;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:700;
                             background:${isOverdue ? '#c0392b' : isDueSoon ? '#e67e22' : '#e8ecf1'};
                             color:${isOverdue || isDueSoon ? 'white' : '#202B5D'};">
                    📅 ${DateFormatter.format(m.project_deadline)}${isOverdue ? ' (en retard)' : isDueSoon ? ' (bientôt)' : ''}
                </span>
            ` : '';

            const priorityBadge = m.project_priority === 'urgente'
                ? '<span style="display:inline-block;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:700;color:white;background:#e74c3c;">🔴 URGENT</span>'
                : m.project_priority === 'haute'
                ? '<span style="display:inline-block;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:700;color:white;background:#e67e22;">🟠 HAUTE</span>'
                : '';

            const commentsBadge = m.comments_count > 0
                ? `<span style="padding:2px 8px;background:#dbeafe;color:#1e40af;border-radius:10px;font-size:11px;font-weight:600;">💬 ${m.comments_count}</span>`
                : '';

            const canMarkDone = m.status !== 'executee' && Auth.canWrite();
            const actionButtons = canMarkDone ? `
                <button onclick="MyMeasuresPage.markAsDone(${m.id}, ${m.project_id})"
                        style="padding:6px 12px;background:#27ae60;color:white;border:none;border-radius:6px;cursor:pointer;font-size:12px;font-weight:600;">
                    ✓ Marquer exécutée
                </button>
            ` : '';

            return `
                <div class="card mb-3" style="padding:18px;border-left:4px solid ${statusColor.fg};">
                    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap;margin-bottom:10px;">
                        <div style="flex:1;min-width:250px;">
                            <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-bottom:6px;">
                                <span style="padding:2px 10px;background:${statusColor.bg};color:${statusColor.fg};border-radius:10px;font-size:11px;font-weight:700;">${esc(this.STATUS_LABELS[m.status] || m.status)}</span>
                                ${m.type ? `<span style="padding:2px 10px;background:#f0f4f8;color:#202B5D;border-radius:10px;font-size:11px;font-weight:600;">${esc(m.type)}</span>` : ''}
                                ${priorityBadge}
                                ${deadlineTag}
                                ${commentsBadge}
                            </div>
                            <div style="color:#202B5D;font-size:14px;font-weight:600;line-height:1.5;margin-bottom:8px;">${esc(m.description)}</div>
                            <div style="color:#62718D;font-size:12px;display:flex;gap:10px;flex-wrap:wrap;">
                                <span>📦 ${esc(m.project_title)}</span>
                                ${m.structure_code ? `<span>🏢 ${esc(m.structure_code)}</span>` : ''}
                                ${m.site_name ? `<span>📍 ${esc(m.site_name)}${m.site_commune ? ` — ${esc(m.site_commune)}` : ''}</span>` : ''}
                            </div>
                            ${m.constraints ? `<div style="color:#c0392b;font-size:12px;margin-top:8px;font-style:italic;">⚠ ${esc(m.constraints)}</div>` : ''}
                        </div>
                        <div style="display:flex;flex-direction:column;gap:6px;min-width:130px;">
                            ${actionButtons}
                            <a href="#/projects/${m.project_id}"
                               style="padding:6px 12px;background:#f0f4f8;color:#202B5D;text-decoration:none;border-radius:6px;font-size:12px;font-weight:600;text-align:center;border:1px solid #dce3ed;">
                                Voir le projet →
                            </a>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        return `<div>${cards}</div>`;
    },

    async setFilter(status) {
        this.data.currentStatus = status;
        await this.loadData();
        const content = document.querySelector('.content-area');
        if (content) {
            content.innerHTML = this.renderStats() + this.renderFilters() + this.renderMeasures();
        }
    },

    async markAsDone(measureId, projectId) {
        Toast.confirm('Marquer cette mesure comme exécutée ?', async () => {
            try {
                await API.projects.updateMeasureStatus(projectId, measureId, 'executee');
                Toast.success('Mesure marquée comme exécutée.');
                await this.loadData();
                const content = document.querySelector('.content-area');
                if (content) {
                    content.innerHTML = this.renderStats() + this.renderFilters() + this.renderMeasures();
                }
            } catch (err) {
                Toast.error('Erreur : ' + (err.message || 'inconnue'));
            }
        });
    },

    afterRender() {
        Navbar.updateActiveMenu();
    }
};
