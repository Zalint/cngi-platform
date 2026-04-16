// Page Formulaires

const FormsPage = {
    data: {
        forms: []
    },

    async render() {
        try {
            const response = await API.forms.getAll();
            this.data.forms = response.data;

            return `
                ${Navbar.render()}
                <div class="main-content with-sidebar">
                    ${Navbar.renderTopBar('Formulaires')}
                    <div class="content-area">
                        ${this.renderToolbar()}
                        ${this.renderFormsList()}
                    </div>
                </div>
            `;
        } catch (error) {
            console.error('Error loading forms:', error);
            return `<div class="alert alert-error">Erreur de chargement des formulaires</div>`;
        }
    },

    renderToolbar() {
        return `
            <div class="toolbar">
                <h2>Formulaires disponibles</h2>
                ${Auth.hasRole('admin') ? `
                    <button class="btn btn-primary" onclick="FormsPage.createForm()">
                        <span>➕</span>
                        <span>Nouveau formulaire</span>
                    </button>
                ` : ''}
            </div>
        `;
    },

    renderFormsList() {
        if (!this.data.forms || this.data.forms.length === 0) {
            return `
                <div class="card text-center" style="padding: 80px 20px;">
                    <div style="font-size: 64px; margin-bottom: 20px; opacity: 0.5;">📝</div>
                    <h3>Aucun formulaire</h3>
                    <p style="color: #666;">Aucun formulaire disponible pour le moment</p>
                </div>
            `;
        }

        const cards = this.data.forms.map(form => `
            <div class="card" style="margin-bottom: 24px; cursor: pointer;" onclick="FormsPage.viewForm(${form.id})">
                <div style="display: flex; justify-content: space-between; align-items: start;">
                    <div style="flex: 1;">
                        <h3 style="font-size: 18px; color: #1e3c72; margin-bottom: 8px;">${form.title}</h3>
                        <p style="color: #666; margin-bottom: 12px;">${form.description || 'Aucune description'}</p>
                        <div style="display: flex; gap: 16px; font-size: 13px; color: #666;">
                            <span>📋 ${form.submissions_count || 0} soumissions</span>
                            ${form.structure_name ? `<span>🏢 ${form.structure_name}</span>` : '<span>🌍 Tous</span>'}
                        </div>
                    </div>
                    <div style="display: flex; gap: 8px;" onclick="event.stopPropagation();">
                        <button class="btn-icon" onclick="FormsPage.viewForm(${form.id})" title="Voir">👁️</button>
                        ${Auth.hasAnyRole('admin', 'utilisateur') ? `
                            <button class="btn-icon" onclick="FormsPage.fillForm(${form.id})" title="Remplir">✏️</button>
                        ` : ''}
                        ${Auth.hasRole('admin') ? `
                            <button class="btn-icon" onclick="FormsPage.editForm(${form.id})" title="Modifier">⚙️</button>
                            <button class="btn-icon" onclick="FormsPage.deleteForm(${form.id})" title="Supprimer">🗑️</button>
                        ` : ''}
                    </div>
                </div>
            </div>
        `).join('');

        return `<div>${cards}</div>`;
    },

    viewForm(id) {
        window.location.hash = `#/forms/${id}`;
    },

    fillForm(id) {
        // TODO: Implement form filling - Page de soumission
        Toast.info('Fonctionnalite de remplissage de formulaire en cours de developpement');
    },

    createForm() {
        window.location.hash = '#/forms/new';
    },

    editForm(id) {
        event.stopPropagation();
        window.location.hash = `#/forms/${id}/edit`;
    },

    async deleteForm(id) {
        event.stopPropagation();

        Toast.confirm('Etes-vous sur de vouloir supprimer ce formulaire ?', async () => {
            try {
                await API.forms.delete(id);
                Toast.success('Formulaire supprime');
                window.location.reload();
            } catch (error) {
                Toast.error('Erreur: ' + error.message);
            }
        }, { type: 'danger' });
    },

    afterRender() {
        Navbar.updateActiveMenu();
    }
};

