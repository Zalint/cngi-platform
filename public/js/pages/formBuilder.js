// Page de création/édition de formulaire

const FormBuilderPage = {
    data: {
        form: null,
        fields: [],
        structures: [],
        isEdit: false
    },

    async render(id = null) {
        try {
            this.data.isEdit = !!id;
            
            // Charger les structures
            const structuresResponse = await API.structures.getAll();
            this.data.structures = structuresResponse.data;

            // Si mode édition, charger le formulaire
            if (id) {
                const formResponse = await API.forms.getById(id);
                this.data.form = formResponse.data;
                this.data.fields = this.data.form.schema.fields || [];
            } else {
                this.data.form = null;
                this.data.fields = [];
            }

            return `
                ${Navbar.render()}
                <div class="main-content with-sidebar">
                    ${Navbar.renderTopBar(this.data.isEdit ? 'Modifier le formulaire' : 'Nouveau formulaire')}
                    <div class="content-area">
                        ${this.renderFormBuilder()}
                    </div>
                </div>
            `;
        } catch (error) {
            console.error('Error loading form builder:', error);
            return `<div class="alert alert-error">Erreur de chargement</div>`;
        }
    },

    renderFormBuilder() {
        const structureOptions = this.data.structures.map(s => 
            `<option value="${s.id}" ${this.data.form && this.data.form.assigned_to_structure_id === s.id ? 'selected' : ''}>${s.name}</option>`
        ).join('');

        return `
            <div style="display: grid; grid-template-columns: 1fr 400px; gap: 24px;">
                <!-- Zone principale -->
                <div>
                    <!-- Informations du formulaire -->
                    <div class="card mb-4">
                        <h2 style="margin-bottom: 24px;">Informations du formulaire</h2>
                        
                        <div class="form-group">
                            <label>Titre du formulaire *</label>
                            <input type="text" id="form-title" class="form-control" 
                                   value="${this.data.form ? this.data.form.title : ''}" 
                                   placeholder="Ex: Fiche d'évaluation des projets" required>
                        </div>

                        <div class="form-group">
                            <label>Description</label>
                            <textarea id="form-description" class="form-control" 
                                      placeholder="Description du formulaire...">${this.data.form ? this.data.form.description || '' : ''}</textarea>
                        </div>

                        <div class="form-group">
                            <label>Assigné à la structure</label>
                            <select id="form-structure" class="form-control">
                                <option value="">Toutes les structures</option>
                                ${structureOptions}
                            </select>
                            <small style="color: #666; font-size: 12px;">Laisser vide pour rendre le formulaire accessible à tous</small>
                        </div>
                    </div>

                    <!-- Champs du formulaire -->
                    <div class="card">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;">
                            <h2>Champs du formulaire</h2>
                            <span style="color: #666; font-size: 14px;">${this.data.fields.length} champ(s)</span>
                        </div>

                        <div id="fields-container" style="min-height: 200px;">
                            ${this.data.fields.length === 0 ? `
                                <div style="text-align: center; padding: 60px 20px; color: #999;">
                                    <div style="font-size: 48px; margin-bottom: 16px;">📝</div>
                                    <p>Aucun champ ajouté</p>
                                    <p style="font-size: 13px;">Utilisez les boutons à droite pour ajouter des champs</p>
                                </div>
                            ` : this.renderFields()}
                        </div>
                    </div>

                    <!-- Boutons d'action -->
                    <div style="margin-top: 24px; display: flex; gap: 12px;">
                        <button onclick="FormBuilderPage.saveForm()" class="btn btn-primary">
                            💾 ${this.data.isEdit ? 'Mettre à jour' : 'Créer le formulaire'}
                        </button>
                        <a href="#/forms" class="btn btn-secondary">Annuler</a>
                    </div>
                </div>

                <!-- Panneau latéral - Types de champs -->
                <div>
                    <div class="card" style="position: sticky; top: 80px;">
                        <h3 style="margin-bottom: 20px;">Ajouter un champ</h3>
                        
                        <div style="display: flex; flex-direction: column; gap: 8px;">
                            <button onclick="FormBuilderPage.addField('text')" class="btn btn-secondary" style="justify-content: flex-start;">
                                📝 Texte court
                            </button>
                            <button onclick="FormBuilderPage.addField('textarea')" class="btn btn-secondary" style="justify-content: flex-start;">
                                📄 Texte long
                            </button>
                            <button onclick="FormBuilderPage.addField('number')" class="btn btn-secondary" style="justify-content: flex-start;">
                                🔢 Nombre
                            </button>
                            <button onclick="FormBuilderPage.addField('date')" class="btn btn-secondary" style="justify-content: flex-start;">
                                📅 Date
                            </button>
                            <button onclick="FormBuilderPage.addField('select')" class="btn btn-secondary" style="justify-content: flex-start;">
                                📋 Liste déroulante
                            </button>
                            <button onclick="FormBuilderPage.addField('checkbox')" class="btn btn-secondary" style="justify-content: flex-start;">
                                ☑️ Case à cocher
                            </button>
                            <button onclick="FormBuilderPage.addField('file')" class="btn btn-secondary" style="justify-content: flex-start;">
                                📎 Fichier
                            </button>
                        </div>

                        <div style="margin-top: 24px; padding-top: 24px; border-top: 1px solid #e0e0e0;">
                            <h4 style="margin-bottom: 12px; font-size: 14px;">Aperçu JSON</h4>
                            <button onclick="FormBuilderPage.viewJSON()" class="btn btn-secondary" style="width: 100%; font-size: 13px;">
                                👁️ Voir le schéma JSON
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    },

    renderFields() {
        return this.data.fields.map((field, index) => `
            <div class="card" style="margin-bottom: 16px; padding: 20px; background: #f8f9fa;">
                <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 16px;">
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <span style="font-size: 20px;">${this.getFieldIcon(field.type)}</span>
                        <div>
                            <strong>${field.label || 'Sans titre'}</strong>
                            <div style="font-size: 12px; color: #666;">${this.getFieldTypeLabel(field.type)}</div>
                        </div>
                    </div>
                    <div style="display: flex; gap: 8px;">
                        <button onclick="FormBuilderPage.editField(${index})" class="btn-icon" title="Modifier">✏️</button>
                        <button onclick="FormBuilderPage.moveFieldUp(${index})" class="btn-icon" title="Monter" ${index === 0 ? 'disabled' : ''}>⬆️</button>
                        <button onclick="FormBuilderPage.moveFieldDown(${index})" class="btn-icon" title="Descendre" ${index === this.data.fields.length - 1 ? 'disabled' : ''}>⬇️</button>
                        <button onclick="FormBuilderPage.deleteField(${index})" class="btn-icon" title="Supprimer">🗑️</button>
                    </div>
                </div>
                <div style="font-size: 13px; color: #666;">
                    <div><strong>Nom:</strong> ${field.name}</div>
                    ${field.placeholder ? `<div><strong>Placeholder:</strong> ${field.placeholder}</div>` : ''}
                    <div><strong>Requis:</strong> ${field.required ? 'Oui ✅' : 'Non'}</div>
                    ${field.options ? `<div><strong>Options:</strong> ${field.options.length} option(s)</div>` : ''}
                </div>
            </div>
        `).join('');
    },

    getFieldIcon(type) {
        const icons = {
            text: '📝',
            textarea: '📄',
            number: '🔢',
            date: '📅',
            select: '📋',
            checkbox: '☑️',
            file: '📎'
        };
        return icons[type] || '📝';
    },

    getFieldTypeLabel(type) {
        const labels = {
            text: 'Texte court',
            textarea: 'Texte long',
            number: 'Nombre',
            date: 'Date',
            select: 'Liste déroulante',
            checkbox: 'Case à cocher',
            file: 'Fichier'
        };
        return labels[type] || type;
    },

    addField(type) {
        const fieldName = `field_${Date.now()}`;
        const field = {
            name: fieldName,
            label: `Nouveau champ ${this.getFieldTypeLabel(type)}`,
            type: type,
            required: false,
            placeholder: type === 'text' || type === 'textarea' ? 'Entrez votre texte...' : ''
        };

        if (type === 'select') {
            field.options = ['Option 1', 'Option 2', 'Option 3'];
        }

        this.data.fields.push(field);
        this.editField(this.data.fields.length - 1);
    },

    editField(index) {
        const field = this.data.fields[index];
        
        const optionsHTML = field.type === 'select' ? `
            <div class="form-group">
                <label>Options (une par ligne)</label>
                <textarea id="field-options" class="form-control" rows="4">${(field.options || []).join('\n')}</textarea>
            </div>
        ` : '';

        const modal = `
            <div id="edit-field-modal" style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 10000;">
                <div style="background: white; border-radius: 12px; padding: 32px; max-width: 600px; width: 90%; max-height: 90vh; overflow-y: auto;">
                    <h2 style="margin-bottom: 24px;">Modifier le champ</h2>
                    
                    <div class="form-group">
                        <label>Libellé du champ *</label>
                        <input type="text" id="field-label" class="form-control" value="${field.label}" required>
                    </div>

                    <div class="form-group">
                        <label>Nom technique *</label>
                        <input type="text" id="field-name" class="form-control" value="${field.name}" required>
                        <small style="color: #666; font-size: 12px;">Utilisé pour identifier le champ (sans espaces ni caractères spéciaux)</small>
                    </div>

                    <div class="form-group">
                        <label>Placeholder</label>
                        <input type="text" id="field-placeholder" class="form-control" value="${field.placeholder || ''}" placeholder="Texte d'exemple...">
                    </div>

                    ${optionsHTML}

                    <div class="form-group">
                        <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                            <input type="checkbox" id="field-required" ${field.required ? 'checked' : ''}>
                            <span>Champ obligatoire</span>
                        </label>
                    </div>

                    <div style="display: flex; gap: 12px; margin-top: 24px;">
                        <button onclick="FormBuilderPage.saveFieldEdit(${index})" class="btn btn-primary">
                            Enregistrer
                        </button>
                        <button onclick="FormBuilderPage.closeEditModal()" class="btn btn-secondary">
                            Annuler
                        </button>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modal);
    },

    saveFieldEdit(index) {
        const field = this.data.fields[index];
        
        field.label = document.getElementById('field-label').value;
        field.name = document.getElementById('field-name').value;
        field.placeholder = document.getElementById('field-placeholder').value;
        field.required = document.getElementById('field-required').checked;

        if (field.type === 'select') {
            const optionsText = document.getElementById('field-options').value;
            field.options = optionsText.split('\n').filter(o => o.trim());
        }

        this.closeEditModal();
        this.refreshFieldsDisplay();
    },

    closeEditModal() {
        const modal = document.getElementById('edit-field-modal');
        if (modal) modal.remove();
    },

    deleteField(index) {
        Toast.confirm('Supprimer ce champ ?', () => {
            this.data.fields.splice(index, 1);
            this.refreshFieldsDisplay();
        }, { type: 'danger', confirmText: 'Supprimer' });
    },

    moveFieldUp(index) {
        if (index > 0) {
            [this.data.fields[index], this.data.fields[index - 1]] = [this.data.fields[index - 1], this.data.fields[index]];
            this.refreshFieldsDisplay();
        }
    },

    moveFieldDown(index) {
        if (index < this.data.fields.length - 1) {
            [this.data.fields[index], this.data.fields[index + 1]] = [this.data.fields[index + 1], this.data.fields[index]];
            this.refreshFieldsDisplay();
        }
    },

    refreshFieldsDisplay() {
        const container = document.getElementById('fields-container');
        if (container) {
            container.innerHTML = this.data.fields.length === 0 ? `
                <div style="text-align: center; padding: 60px 20px; color: #999;">
                    <div style="font-size: 48px; margin-bottom: 16px;">📝</div>
                    <p>Aucun champ ajouté</p>
                    <p style="font-size: 13px;">Utilisez les boutons à droite pour ajouter des champs</p>
                </div>
            ` : this.renderFields();
        }
    },

    viewJSON() {
        const schema = { fields: this.data.fields };
        const jsonStr = JSON.stringify(schema, null, 2);
        
        const modal = `
            <div id="json-modal" style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 10000;">
                <div style="background: white; border-radius: 12px; padding: 32px; max-width: 800px; width: 90%; max-height: 90vh; overflow-y: auto;">
                    <h2 style="margin-bottom: 24px;">Schéma JSON du formulaire</h2>
                    <pre style="background: #f5f5f5; padding: 20px; border-radius: 8px; overflow-x: auto; font-size: 13px;">${jsonStr}</pre>
                    <button onclick="document.getElementById('json-modal').remove()" class="btn btn-secondary" style="margin-top: 16px;">
                        Fermer
                    </button>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modal);
    },

    async saveForm() {
        const title = document.getElementById('form-title').value.trim();
        const description = document.getElementById('form-description').value.trim();
        const structureId = document.getElementById('form-structure').value;

        if (!title) {
            Toast.warning('Le titre du formulaire est requis');
            return;
        }

        if (this.data.fields.length === 0) {
            Toast.warning('Ajoutez au moins un champ au formulaire');
            return;
        }

        const formData = {
            title,
            description,
            schema: { fields: this.data.fields },
            assigned_to_structure_id: structureId || null
        };

        try {
            const loadingDiv = document.createElement('div');
            loadingDiv.className = 'loading-overlay';
            loadingDiv.innerHTML = '<div class="loading"></div>';
            document.body.appendChild(loadingDiv);

            let response;
            if (this.data.isEdit) {
                response = await API.forms.update(this.data.form.id, formData);
            } else {
                response = await API.forms.create(formData);
            }

            loadingDiv.remove();

            if (response.success) {
                Toast.success(`Formulaire ${this.data.isEdit ? 'mis à jour' : 'créé'} avec succès !`);
                window.location.hash = '#/forms';
            }
        } catch (error) {
            document.querySelector('.loading-overlay')?.remove();
            Toast.error('Erreur: ' + error.message);
        }
    },

    afterRender() {
        Navbar.updateActiveMenu();
    }
};

