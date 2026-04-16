// Page Découpage Administratif

const DecoupagePage = {
    data: {
        entries: [],
        stats: null,
        regions: [],
        departements: [],
        pagination: { page: 1, limit: 50, total: 0 },
        filters: {
            region: '',
            departement: ''
        },
        editingId: null
    },

    async render() {
        if (!Auth.hasRole('admin')) {
            return `
                <div class="alert alert-error">Acces refuse. Cette page est reservee aux administrateurs.</div>
            `;
        }

        try {
            await this.loadInitialData();

            return `
                ${Navbar.render()}
                <div class="main-content with-sidebar">
                    ${Navbar.renderTopBar('Decoupage administratif')}
                    <div class="content-area">
                        ${this.renderStats()}
                        ${this.renderFilters()}
                        ${this.renderTable()}
                        ${this.renderPagination()}
                    </div>
                </div>
                ${this.renderModal()}
            `;
        } catch (error) {
            console.error('Error loading decoupage data:', error);
            return `
                ${Navbar.render()}
                <div class="main-content with-sidebar">
                    ${Navbar.renderTopBar('Decoupage administratif')}
                    <div class="content-area">
                        <div class="alert alert-error">Erreur de chargement: ${error.message}</div>
                    </div>
                </div>
            `;
        }
    },

    async loadInitialData() {
        const [statsRes, regionsRes, entriesRes] = await Promise.all([
            API.decoupage.getStats(),
            API.decoupage.getRegions(),
            API.decoupage.getAll({
                region: this.data.filters.region,
                departement: this.data.filters.departement,
                page: this.data.pagination.page,
                limit: this.data.pagination.limit
            })
        ]);

        this.data.stats = statsRes.data;
        this.data.regions = regionsRes.data || [];
        this.data.entries = entriesRes.data || [];
        if (entriesRes.pagination) {
            this.data.pagination = { ...this.data.pagination, ...entriesRes.pagination };
        }
    },

    async loadEntries() {
        try {
            const res = await API.decoupage.getAll({
                region: this.data.filters.region,
                departement: this.data.filters.departement,
                page: this.data.pagination.page,
                limit: this.data.pagination.limit
            });
            this.data.entries = res.data || [];
            if (res.pagination) {
                this.data.pagination = { ...this.data.pagination, ...res.pagination };
            }
        } catch (error) {
            Toast.error('Erreur lors du chargement des donnees');
            console.error(error);
        }
    },

    async refreshStats() {
        try {
            const statsRes = await API.decoupage.getStats();
            this.data.stats = statsRes.data;
            const statsEl = document.getElementById('decoupage-stats');
            if (statsEl) {
                statsEl.innerHTML = this.renderStatsContent();
            }
        } catch (e) {
            console.error('Error refreshing stats:', e);
        }
    },

    renderStats() {
        return `
            <div id="decoupage-stats" class="card" style="margin-bottom: 24px;">
                ${this.renderStatsContent()}
            </div>
        `;
    },

    renderStatsContent() {
        const stats = this.data.stats || {};
        return `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                <h2 style="margin: 0;">Decoupage administratif</h2>
                <button class="btn btn-primary" onclick="DecoupagePage.openCreateModal()">
                    + Ajouter une entree
                </button>
            </div>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 16px;">
                <div style="background: #f0f4ff; border-radius: 10px; padding: 16px; text-align: center;">
                    <div style="font-size: 28px; font-weight: 700; color: #1e3c72;">${stats.regions || 0}</div>
                    <div style="font-size: 13px; color: #666; margin-top: 4px;">Regions</div>
                </div>
                <div style="background: #f0fff4; border-radius: 10px; padding: 16px; text-align: center;">
                    <div style="font-size: 28px; font-weight: 700; color: #27ae60;">${stats.departements || 0}</div>
                    <div style="font-size: 13px; color: #666; margin-top: 4px;">Departements</div>
                </div>
                <div style="background: #fff8f0; border-radius: 10px; padding: 16px; text-align: center;">
                    <div style="font-size: 28px; font-weight: 700; color: #e67e22;">${stats.arrondissements || 0}</div>
                    <div style="font-size: 13px; color: #666; margin-top: 4px;">Arrondissements</div>
                </div>
                <div style="background: #fdf0ff; border-radius: 10px; padding: 16px; text-align: center;">
                    <div style="font-size: 28px; font-weight: 700; color: #8e44ad;">${stats.communes || 0}</div>
                    <div style="font-size: 13px; color: #666; margin-top: 4px;">Communes</div>
                </div>
            </div>
        `;
    },

    renderFilters() {
        const regionOptions = this.data.regions.map(r =>
            `<option value="${r}" ${this.data.filters.region === r ? 'selected' : ''}>${r}</option>`
        ).join('');

        const deptOptions = this.data.departements.map(d =>
            `<option value="${d}" ${this.data.filters.departement === d ? 'selected' : ''}>${d}</option>`
        ).join('');

        return `
            <div class="card" style="margin-bottom: 24px;">
                <div style="display: flex; gap: 16px; align-items: flex-end; flex-wrap: wrap;">
                    <div style="flex: 1; min-width: 200px;">
                        <label style="display: block; font-weight: 600; margin-bottom: 6px; font-size: 13px; color: #555;">Region</label>
                        <select id="filter-region" class="form-control" onchange="DecoupagePage.onRegionFilterChange(this.value)">
                            <option value="">Toutes les regions</option>
                            ${regionOptions}
                        </select>
                    </div>
                    <div style="flex: 1; min-width: 200px;">
                        <label style="display: block; font-weight: 600; margin-bottom: 6px; font-size: 13px; color: #555;">Departement</label>
                        <select id="filter-departement" class="form-control" onchange="DecoupagePage.onDepartementFilterChange(this.value)" ${!this.data.filters.region ? 'disabled' : ''}>
                            <option value="">Tous les departements</option>
                            ${deptOptions}
                        </select>
                    </div>
                    <button class="btn btn-secondary" onclick="DecoupagePage.resetFilters()" style="height: 40px;">
                        Reinitialiser
                    </button>
                </div>
            </div>
        `;
    },

    renderTable() {
        if (!this.data.entries.length) {
            return `
                <div class="card">
                    <div style="text-align: center; padding: 40px; color: #999;">
                        Aucune entree trouvee.
                    </div>
                </div>
            `;
        }

        const rows = this.data.entries.map(entry => `
            <tr>
                <td>${entry.region || ''}</td>
                <td>${entry.departement || ''}</td>
                <td>${entry.arrondissement || ''}</td>
                <td>${entry.commune || ''}</td>
                <td>
                    <div style="display: flex; gap: 8px;">
                        <button class="btn-icon" onclick="DecoupagePage.openEditModal(${entry.id})" title="Modifier">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                        </button>
                        <button class="btn-icon" onclick="DecoupagePage.deleteEntry(${entry.id})" title="Supprimer" style="color: #ea4335;">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');

        return `
            <div class="card" id="decoupage-table-card">
                <div class="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>Region</th>
                                <th>Departement</th>
                                <th>Arrondissement</th>
                                <th>Commune</th>
                                <th>Actions</th>
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

    renderPagination() {
        const { page, limit, total } = this.data.pagination;
        const totalPages = Math.ceil(total / limit);
        if (totalPages <= 1) return '';

        let pages = '';
        for (let i = 1; i <= totalPages; i++) {
            if (i === 1 || i === totalPages || (i >= page - 2 && i <= page + 2)) {
                pages += `<button class="btn ${i === page ? 'btn-primary' : 'btn-secondary'}" onclick="DecoupagePage.goToPage(${i})" style="min-width: 40px; padding: 8px 12px;">${i}</button>`;
            } else if (i === page - 3 || i === page + 3) {
                pages += `<span style="padding: 8px 4px; color: #999;">...</span>`;
            }
        }

        return `
            <div style="display: flex; justify-content: center; align-items: center; gap: 8px; margin-top: 20px;">
                <button class="btn btn-secondary" onclick="DecoupagePage.goToPage(${page - 1})" ${page <= 1 ? 'disabled' : ''} style="padding: 8px 12px;">
                    &laquo; Precedent
                </button>
                ${pages}
                <button class="btn btn-secondary" onclick="DecoupagePage.goToPage(${page + 1})" ${page >= totalPages ? 'disabled' : ''} style="padding: 8px 12px;">
                    Suivant &raquo;
                </button>
            </div>
        `;
    },

    renderModal() {
        return `
            <div id="decoupage-modal" style="display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.5); z-index:1000; justify-content:center; align-items:center;">
                <div style="background:white; border-radius:12px; padding:32px; width:90%; max-width:500px; box-shadow: 0 20px 60px rgba(0,0,0,0.3);">
                    <h3 id="decoupage-modal-title" style="margin-top:0; margin-bottom:24px;">Ajouter une entree</h3>
                    <div style="display:flex; flex-direction:column; gap:16px;">
                        <div>
                            <label style="display:block; font-weight:600; margin-bottom:6px; font-size:13px; color:#555;">Region *</label>
                            <input type="text" id="modal-region" class="form-control" placeholder="Ex: Dakar">
                        </div>
                        <div>
                            <label style="display:block; font-weight:600; margin-bottom:6px; font-size:13px; color:#555;">Departement *</label>
                            <input type="text" id="modal-departement" class="form-control" placeholder="Ex: Dakar">
                        </div>
                        <div>
                            <label style="display:block; font-weight:600; margin-bottom:6px; font-size:13px; color:#555;">Arrondissement</label>
                            <input type="text" id="modal-arrondissement" class="form-control" placeholder="Ex: Dakar-Plateau">
                        </div>
                        <div>
                            <label style="display:block; font-weight:600; margin-bottom:6px; font-size:13px; color:#555;">Commune</label>
                            <input type="text" id="modal-commune" class="form-control" placeholder="Ex: Dakar-Plateau">
                        </div>
                    </div>
                    <div style="display:flex; justify-content:flex-end; gap:12px; margin-top:24px;">
                        <button class="btn btn-secondary" onclick="DecoupagePage.closeModal()">Annuler</button>
                        <button class="btn btn-primary" id="decoupage-modal-save" onclick="DecoupagePage.saveEntry()">Enregistrer</button>
                    </div>
                </div>
            </div>
        `;
    },

    // === Event handlers ===

    async onRegionFilterChange(value) {
        this.data.filters.region = value;
        this.data.filters.departement = '';
        this.data.pagination.page = 1;
        this.data.departements = [];

        if (value) {
            try {
                const res = await API.decoupage.getDepartements(value);
                this.data.departements = res.data || [];
            } catch (e) {
                console.error('Error loading departements:', e);
            }
        }

        await this.refreshTableAndPagination();

        // Update departement dropdown
        const deptSelect = document.getElementById('filter-departement');
        if (deptSelect) {
            deptSelect.disabled = !value;
            deptSelect.innerHTML = '<option value="">Tous les departements</option>' +
                this.data.departements.map(d => `<option value="${d}">${d}</option>`).join('');
        }
    },

    async onDepartementFilterChange(value) {
        this.data.filters.departement = value;
        this.data.pagination.page = 1;
        await this.refreshTableAndPagination();
    },

    async resetFilters() {
        this.data.filters.region = '';
        this.data.filters.departement = '';
        this.data.departements = [];
        this.data.pagination.page = 1;

        const regionSelect = document.getElementById('filter-region');
        const deptSelect = document.getElementById('filter-departement');
        if (regionSelect) regionSelect.value = '';
        if (deptSelect) {
            deptSelect.value = '';
            deptSelect.disabled = true;
            deptSelect.innerHTML = '<option value="">Tous les departements</option>';
        }

        await this.refreshTableAndPagination();
    },

    async goToPage(page) {
        const totalPages = Math.ceil(this.data.pagination.total / this.data.pagination.limit);
        if (page < 1 || page > totalPages) return;
        this.data.pagination.page = page;
        await this.refreshTableAndPagination();
    },

    async refreshTableAndPagination() {
        await this.loadEntries();
        const tableCard = document.getElementById('decoupage-table-card');
        if (tableCard) {
            tableCard.outerHTML = this.renderTable();
        }
        // Update pagination
        const contentArea = document.querySelector('.content-area');
        if (contentArea) {
            const existingPag = contentArea.querySelector(':scope > div:last-child');
            if (existingPag && existingPag.id !== 'decoupage-table-card') {
                existingPag.remove();
            }
            const pagHtml = this.renderPagination();
            if (pagHtml) {
                contentArea.insertAdjacentHTML('beforeend', pagHtml);
            }
        }
    },

    // === Modal operations ===

    openCreateModal() {
        this.data.editingId = null;
        const modal = document.getElementById('decoupage-modal');
        const title = document.getElementById('decoupage-modal-title');
        if (title) title.textContent = 'Ajouter une entree';
        document.getElementById('modal-region').value = '';
        document.getElementById('modal-departement').value = '';
        document.getElementById('modal-arrondissement').value = '';
        document.getElementById('modal-commune').value = '';
        if (modal) modal.style.display = 'flex';
    },

    openEditModal(id) {
        const entry = this.data.entries.find(e => e.id === id);
        if (!entry) return;

        this.data.editingId = id;
        const modal = document.getElementById('decoupage-modal');
        const title = document.getElementById('decoupage-modal-title');
        if (title) title.textContent = 'Modifier l\'entree';
        document.getElementById('modal-region').value = entry.region || '';
        document.getElementById('modal-departement').value = entry.departement || '';
        document.getElementById('modal-arrondissement').value = entry.arrondissement || '';
        document.getElementById('modal-commune').value = entry.commune || '';
        if (modal) modal.style.display = 'flex';
    },

    closeModal() {
        const modal = document.getElementById('decoupage-modal');
        if (modal) modal.style.display = 'none';
        this.data.editingId = null;
    },

    async saveEntry() {
        const region = document.getElementById('modal-region').value.trim();
        const departement = document.getElementById('modal-departement').value.trim();
        const arrondissement = document.getElementById('modal-arrondissement').value.trim();
        const commune = document.getElementById('modal-commune').value.trim();

        if (!region || !departement) {
            Toast.warning('La region et le departement sont obligatoires');
            return;
        }

        const payload = { region, departement, arrondissement, commune };

        try {
            if (this.data.editingId) {
                await API.decoupage.update(this.data.editingId, payload);
                Toast.success('Entree modifiee avec succes');
            } else {
                await API.decoupage.create(payload);
                Toast.success('Entree ajoutee avec succes');
            }
            this.closeModal();
            await this.refreshTableAndPagination();
            await this.refreshStats();
        } catch (error) {
            Toast.error('Erreur: ' + error.message);
        }
    },

    async deleteEntry(id) {
        Toast.confirm('Etes-vous sur de vouloir supprimer cette entree ?', async () => {
            try {
                await API.decoupage.delete(id);
                Toast.success('Entree supprimee avec succes');
                await this.refreshTableAndPagination();
                await this.refreshStats();
            } catch (error) {
                Toast.error('Erreur: ' + error.message);
            }
        }, { type: 'danger', confirmText: 'Supprimer' });
    },

    // === Lifecycle ===

    afterRender() {
        Navbar.updateActiveMenu();

        // Close modal on backdrop click
        const modal = document.getElementById('decoupage-modal');
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.closeModal();
                }
            });
        }
    }
};
