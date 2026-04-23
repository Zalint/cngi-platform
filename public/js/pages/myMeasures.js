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

            const commentsBadge = `
                <button onclick="MyMeasuresPage.toggleComments(${m.id})"
                        id="comments-toggle-${m.id}"
                        style="padding:2px 8px;background:${m.comments_count > 0 ? '#dbeafe' : '#f0f4f8'};color:${m.comments_count > 0 ? '#1e40af' : '#62718D'};border-radius:10px;font-size:11px;font-weight:600;border:none;cursor:pointer;">
                    💬 ${m.comments_count || 0} ${m.comments_count > 0 ? 'commentaire(s)' : 'commenter'}
                </button>
            `;

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
                    <div id="comments-section-${m.id}" style="display:none;margin-top:14px;padding-top:14px;border-top:1px solid #e8ecf1;">
                        <div id="comments-list-${m.id}" style="margin-bottom:10px;">
                            <div style="color:#8896AB;font-size:12px;font-style:italic;">Chargement...</div>
                        </div>
                        <form onsubmit="event.preventDefault(); MyMeasuresPage.addComment(${m.id});" style="display:flex;gap:6px;">
                            <input type="text" id="comment-input-${m.id}" placeholder="Ajouter un commentaire..." maxlength="1000"
                                   style="flex:1;padding:8px 12px;border:1px solid #dce3ed;border-radius:6px;font-size:13px;">
                            <button type="submit" style="padding:8px 14px;background:#202B5D;color:white;border:none;border-radius:6px;cursor:pointer;font-size:12px;font-weight:600;">
                                Envoyer
                            </button>
                        </form>
                    </div>
                </div>
            `;
        }).join('');

        return `<div>${cards}</div>`;
    },

    async setFilter(status) {
        // Mémoriser quelles sections de commentaires étaient ouvertes pour les
        // rouvrir après re-rendu. On conserve aussi la position de scroll pour
        // limiter la friction quand l'utilisateur change de filtre.
        const openCommentsIds = Array.from(document.querySelectorAll('[id^="comments-section-"]'))
            .filter(el => el.style.display === 'block')
            .map(el => parseInt(el.id.replace('comments-section-', '')))
            .filter(n => Number.isFinite(n));
        const scrollY = window.scrollY;

        this.data.currentStatus = status;
        await this.loadData();
        const content = document.querySelector('.content-area');
        if (!content) return;
        content.innerHTML = this.renderStats() + this.renderFilters() + this.renderMeasures();

        // Rouvrir les sections commentaires précédemment ouvertes, si la mesure est toujours dans la liste
        for (const id of openCommentsIds) {
            const section = document.getElementById(`comments-section-${id}`);
            if (section) {
                section.style.display = 'block';
                this.loadComments(id); // recharge la liste (async, non bloquant)
            }
        }
        // Restaurer le scroll
        window.scrollTo({ top: scrollY, behavior: 'instant' in window ? 'instant' : 'auto' });
    },

    async toggleComments(measureId) {
        const section = document.getElementById(`comments-section-${measureId}`);
        if (!section) return;
        const isOpen = section.style.display === 'block';
        if (isOpen) {
            section.style.display = 'none';
            return;
        }
        section.style.display = 'block';
        // Charger la liste des commentaires
        await this.loadComments(measureId);
    },

    async loadComments(measureId) {
        const list = document.getElementById(`comments-list-${measureId}`);
        if (!list) return;
        try {
            const res = await API.measureComments.getByMeasure(measureId);
            const comments = res.data || [];
            if (comments.length === 0) {
                list.innerHTML = '<div style="color:#8896AB;font-size:12px;font-style:italic;">Aucun commentaire. Sois le premier à en ajouter un.</div>';
                return;
            }
            const esc = (t) => this._escapeHtml(t);
            const currentUser = Auth.getUser();
            const isAdmin = currentUser?.role === 'admin';
            list.innerHTML = comments.map(c => {
                const canDelete = c.user_id === currentUser?.id || isAdmin;
                const author = [c.first_name, c.last_name].filter(Boolean).join(' ') || c.username || 'Utilisateur';
                const when = c.created_at ? new Date(c.created_at).toLocaleString('fr-FR') : '';
                return `
                    <div style="padding:8px 10px;background:#f8f9fa;border-radius:6px;margin-bottom:6px;">
                        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
                            <span style="font-size:11px;color:#62718D;font-weight:600;">${esc(author)} · ${esc(when)}</span>
                            ${canDelete ? `<button onclick="MyMeasuresPage.deleteComment(${c.id}, ${measureId})" style="background:none;border:none;color:#c0392b;cursor:pointer;font-size:11px;">🗑</button>` : ''}
                        </div>
                        <div style="font-size:13px;color:#202B5D;white-space:pre-wrap;">${esc(c.comment)}</div>
                    </div>
                `;
            }).join('');
        } catch (err) {
            list.innerHTML = `<div style="color:#c0392b;font-size:12px;">Erreur de chargement : ${this._escapeHtml(err.message || '')}</div>`;
        }
    },

    async addComment(measureId) {
        const input = document.getElementById(`comment-input-${measureId}`);
        if (!input) return;
        const text = input.value.trim();
        if (!text) return;
        try {
            await API.measureComments.create(measureId, text);
            input.value = '';
            await this.loadComments(measureId);
            // Rafraîchir les stats + badge
            await this.loadData();
            const toggle = document.getElementById(`comments-toggle-${measureId}`);
            if (toggle) {
                const measure = this.data.measures.find(x => x.id === measureId);
                if (measure) toggle.innerHTML = `💬 ${measure.comments_count || 0} commentaire(s)`;
            }
        } catch (err) {
            Toast.error('Erreur : ' + (err.message || 'inconnue'));
        }
    },

    async deleteComment(commentId, measureId) {
        Toast.confirm('Supprimer ce commentaire ?', async () => {
            try {
                await API.measureComments.delete(commentId);
                await this.loadComments(measureId);
                Toast.success('Commentaire supprimé');
            } catch (err) {
                Toast.error('Erreur : ' + (err.message || 'inconnue'));
            }
        }, { type: 'danger', confirmText: 'Supprimer' });
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
