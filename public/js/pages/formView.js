// Page de visualisation d'un formulaire

const FormViewPage = {
    data: {
        form: null,
        submissions: []
    },

    async render(id) {
        try {
            // Charger le formulaire et ses soumissions
            const [formResponse, submissionsResponse] = await Promise.all([
                API.forms.getById(id),
                API.forms.getSubmissions(id)
            ]);

            this.data.form = formResponse.data;
            this.data.submissions = submissionsResponse.data;

            return `
                ${Navbar.render()}
                <div class="main-content with-sidebar">
                    ${Navbar.renderTopBar('Détail du formulaire')}
                    <div class="content-area">
                        ${this.renderFormInfo()}
                        ${this.renderFormSchema()}
                        ${this.renderSubmissions()}
                    </div>
                </div>
            `;
        } catch (error) {
            console.error('Error loading form:', error);
            return `
                ${Navbar.render()}
                <div class="main-content with-sidebar">
                    ${Navbar.renderTopBar('Erreur')}
                    <div class="content-area">
                        <div class="alert alert-error">Formulaire non trouvé</div>
                        <a href="#/forms" class="btn btn-secondary">← Retour aux formulaires</a>
                    </div>
                </div>
            `;
        }
    },

    renderFormInfo() {
        const f = this.data.form;

        return `
            <div class="card mb-4">
                <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 24px;">
                    <div style="flex: 1;">
                        <h2 style="font-size: 24px; color: #1e3c72; margin-bottom: 8px;">${f.title}</h2>
                        ${f.description ? `<p style="color: #666; margin-bottom: 16px;">${f.description}</p>` : ''}
                        
                        <div style="display: flex; gap: 20px; font-size: 14px; color: #666;">
                            ${f.structure_name ? `
                                <div>
                                    <strong>Structure:</strong> ${f.structure_name} (${f.structure_code})
                                </div>
                            ` : `
                                <div>
                                    <strong>Accessible à:</strong> Toutes les structures
                                </div>
                            `}
                            <div>
                                <strong>Soumissions:</strong> ${this.data.submissions.length}
                            </div>
                            <div>
                                <strong>Champs:</strong> ${f.schema.fields.length}
                            </div>
                        </div>
                    </div>
                    
                    ${Auth.hasRole('admin') ? `
                        <div style="display: flex; gap: 8px;">
                            <a href="#/forms/${f.id}/edit" class="btn btn-primary">
                                ✏️ Modifier
                            </a>
                        </div>
                    ` : ''}
                </div>

                <div style="display: flex; gap: 12px;">
                    <a href="#/forms" class="btn btn-secondary">← Retour</a>
                    ${Auth.hasAnyRole('admin', 'utilisateur') ? `
                        <button onclick="FormViewPage.fillForm()" class="btn btn-success">
                            📝 Remplir ce formulaire
                        </button>
                    ` : ''}
                </div>
            </div>
        `;
    },

    renderFormSchema() {
        const fields = this.data.form.schema.fields;

        return `
            <div class="card mb-4">
                <h2 style="margin-bottom: 24px;">📋 Structure du formulaire</h2>
                
                <div style="display: flex; flex-direction: column; gap: 16px;">
                    ${fields.map((field, index) => `
                        <div class="card" style="padding: 20px; background: #f8f9fa;">
                            <div style="display: flex; align-items: start; gap: 16px;">
                                <div style="width: 40px; height: 40px; background: #1e3c72; color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 700; flex-shrink: 0;">
                                    ${index + 1}
                                </div>
                                <div style="flex: 1;">
                                    <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 8px;">
                                        <div>
                                            <h3 style="font-size: 16px; margin-bottom: 4px;">${field.label}</h3>
                                            <div style="font-size: 13px; color: #666;">
                                                <span style="background: #e3f2fd; color: #1976d2; padding: 2px 8px; border-radius: 12px; margin-right: 8px;">
                                                    ${this.getFieldTypeLabel(field.type)}
                                                </span>
                                                <span style="color: #999;">Nom: ${field.name}</span>
                                            </div>
                                        </div>
                                        ${field.required ? `
                                            <span style="background: #ffebee; color: #d32f2f; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 600;">
                                                Obligatoire
                                            </span>
                                        ` : ''}
                                    </div>
                                    
                                    ${field.placeholder ? `
                                        <div style="font-size: 13px; color: #666; margin-top: 8px;">
                                            <strong>Placeholder:</strong> ${field.placeholder}
                                        </div>
                                    ` : ''}
                                    
                                    ${field.options && field.options.length > 0 ? `
                                        <div style="margin-top: 12px;">
                                            <strong style="font-size: 13px; color: #666;">Options:</strong>
                                            <div style="display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px;">
                                                ${field.options.map(opt => `
                                                    <span style="background: white; border: 1px solid #e0e0e0; padding: 4px 12px; border-radius: 6px; font-size: 13px;">
                                                        ${opt}
                                                    </span>
                                                `).join('')}
                                            </div>
                                        </div>
                                    ` : ''}
                                    
                                    <!-- Aperçu du champ -->
                                    <div style="margin-top: 16px; padding: 16px; background: white; border-radius: 8px; border: 2px dashed #e0e0e0;">
                                        <label style="display: block; font-weight: 500; margin-bottom: 8px; font-size: 14px;">
                                            Aperçu du champ ${field.required ? '<span style="color: #d32f2f;">*</span>' : ''}
                                        </label>
                                        ${this.renderFieldPreview(field)}
                                    </div>
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    },

    renderFieldPreview(field) {
        switch (field.type) {
            case 'text':
                return `<input type="text" class="form-control" placeholder="${field.placeholder || ''}" disabled>`;
            
            case 'textarea':
                return `<textarea class="form-control" rows="3" placeholder="${field.placeholder || ''}" disabled></textarea>`;
            
            case 'number':
                return `<input type="number" class="form-control" placeholder="${field.placeholder || ''}" disabled>`;
            
            case 'date':
                return `<input type="date" class="form-control" disabled>`;
            
            case 'select':
                return `
                    <select class="form-control" disabled>
                        <option>Sélectionnez une option...</option>
                        ${(field.options || []).map(opt => `<option>${opt}</option>`).join('')}
                    </select>
                `;
            
            case 'checkbox':
                return `
                    <label style="display: flex; align-items: center; gap: 8px;">
                        <input type="checkbox" disabled>
                        <span>${field.label}</span>
                    </label>
                `;
            
            case 'file':
                return `
                    <input type="file" class="form-control" disabled>
                `;
            
            default:
                return `<input type="text" class="form-control" disabled>`;
        }
    },

    getFieldTypeLabel(type) {
        const labels = {
            text: 'Texte court',
            textarea: 'Texte long',
            number: 'Nombre',
            date: 'Date',
            select: 'Liste',
            checkbox: 'Case à cocher',
            file: 'Fichier'
        };
        return labels[type] || type;
    },

    renderSubmissions() {
        if (this.data.submissions.length === 0) {
            return `
                <div class="card text-center" style="padding: 60px 20px;">
                    <div style="font-size: 64px; margin-bottom: 20px; opacity: 0.3;">📝</div>
                    <h3>Aucune soumission</h3>
                    <p style="color: #666; margin-bottom: 24px;">Ce formulaire n'a pas encore été rempli</p>
                    ${Auth.hasAnyRole('admin', 'utilisateur') ? `
                        <button onclick="FormViewPage.fillForm()" class="btn btn-primary">
                            Être le premier à remplir ce formulaire
                        </button>
                    ` : ''}
                </div>
            `;
        }

        const rows = this.data.submissions.map(sub => `
            <tr>
                <td><strong>#${sub.id}</strong></td>
                <td>${sub.submitter_username || 'N/A'}</td>
                <td>${sub.project_title || 'Aucun projet'}</td>
                <td>${DateFormatter.format(sub.submitted_at, 'DD/MM/YYYY')}</td>
                <td>
                    <button onclick="FormViewPage.viewSubmission(${sub.id})" class="btn-icon" title="Voir">👁️</button>
                </td>
            </tr>
        `).join('');

        return `
            <div class="card">
                <h2 style="margin-bottom: 24px;">📊 Soumissions (${this.data.submissions.length})</h2>
                
                <div class="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>Soumis par</th>
                                <th>Projet lié</th>
                                <th>Date</th>
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

    async fillForm() {
        try {
            // Charger les projets accessibles à l'utilisateur
            const projectsResponse = await API.projects.getAll();
            const projects = projectsResponse.data;

            if (projects.length === 0) {
                alert('Aucun projet disponible. Veuillez créer un projet d\'abord.');
                return;
            }

            const form = this.data.form;
            const fields = form.schema.fields;

            const modal = `
                <div id="fill-form-modal" style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 10000; overflow-y: auto;">
                    <div style="background: white; border-radius: 12px; padding: 32px; max-width: 900px; width: 90%; max-height: 90vh; overflow-y: auto; margin: 20px;">
                        <h2 style="margin-bottom: 24px; color: #1e3c72;">📝 Remplir le formulaire : ${form.title}</h2>
                        
                        <form id="dynamic-form">
                            <!-- Sélection obligatoire du projet -->
                            <div class="form-group" style="margin-bottom: 24px; padding: 20px; background: #e3f2fd; border-radius: 8px; border: 2px solid #1976d2;">
                                <label style="font-weight: 700; margin-bottom: 8px; display: block; color: #1976d2;">
                                    🏗️ Projet associé <span style="color: #d32f2f;">*</span>
                                </label>
                                <select name="project_id" class="form-control" required style="font-size: 16px; padding: 12px;">
                                    <option value="">-- Sélectionnez un projet --</option>
                                    ${projects.map(p => `
                                        <option value="${p.id}">${p.title}${p.structure_name ? ` (${p.structure_name})` : ''}</option>
                                    `).join('')}
                                </select>
                                <small style="display: block; margin-top: 8px; color: #666;">
                                    Ce formulaire doit être lié à un projet. Sélectionnez le projet concerné.
                                </small>
                            </div>

                            <div style="border-top: 2px solid #e0e0e0; padding-top: 24px; margin-top: 24px;">
                                <h3 style="margin-bottom: 20px; color: #333;">Champs du formulaire</h3>
                                
                                ${fields.map((field, index) => this.renderFormField(field, index)).join('')}
                            </div>

                            <div style="display: flex; gap: 12px; justify-content: flex-end; margin-top: 32px; padding-top: 24px; border-top: 2px solid #e0e0e0;">
                                <button type="button" onclick="FormViewPage.closeFormModal()" class="btn btn-secondary">
                                    Annuler
                                </button>
                                <button type="submit" class="btn btn-primary">
                                    💾 Enregistrer
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            `;
            
            document.body.insertAdjacentHTML('beforeend', modal);

            // Attacher l'événement de soumission
            document.getElementById('dynamic-form').addEventListener('submit', async (e) => {
                e.preventDefault();
                await this.submitForm(e.target);
            });

        } catch (error) {
            console.error('Error opening form:', error);
            alert('Erreur lors de l\'ouverture du formulaire: ' + error.message);
        }
    },

    renderFormField(field, index) {
        let inputHtml = '';
        const requiredMark = field.required ? '<span style="color: #d32f2f;">*</span>' : '';

        switch (field.type) {
            case 'text':
                inputHtml = `
                    <input 
                        type="text" 
                        name="${field.name}" 
                        class="form-control" 
                        placeholder="${field.placeholder || ''}"
                        ${field.required ? 'required' : ''}
                    >
                `;
                break;
            
            case 'textarea':
                inputHtml = `
                    <textarea 
                        name="${field.name}" 
                        class="form-control" 
                        rows="4" 
                        placeholder="${field.placeholder || ''}"
                        ${field.required ? 'required' : ''}
                    ></textarea>
                `;
                break;
            
            case 'number':
                inputHtml = `
                    <input 
                        type="number" 
                        name="${field.name}" 
                        class="form-control" 
                        placeholder="${field.placeholder || ''}"
                        ${field.required ? 'required' : ''}
                    >
                `;
                break;
            
            case 'date':
                inputHtml = `
                    <input 
                        type="date" 
                        name="${field.name}" 
                        class="form-control"
                        ${field.required ? 'required' : ''}
                    >
                `;
                break;
            
            case 'select':
                inputHtml = `
                    <select 
                        name="${field.name}" 
                        class="form-control"
                        ${field.required ? 'required' : ''}
                    >
                        <option value="">Sélectionnez une option...</option>
                        ${(field.options || []).map(opt => `<option value="${opt}">${opt}</option>`).join('')}
                    </select>
                `;
                break;
            
            case 'checkbox':
                inputHtml = `
                    <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                        <input 
                            type="checkbox" 
                            name="${field.name}"
                            value="true"
                            ${field.required ? 'required' : ''}
                        >
                        <span>${field.label}</span>
                    </label>
                `;
                break;
            
            case 'file':
                inputHtml = `
                    <input 
                        type="file" 
                        name="${field.name}" 
                        class="form-control"
                        ${field.required ? 'required' : ''}
                    >
                `;
                break;
            
            default:
                inputHtml = `
                    <input 
                        type="text" 
                        name="${field.name}" 
                        class="form-control"
                        ${field.required ? 'required' : ''}
                    >
                `;
        }

        return `
            <div class="form-group" style="margin-bottom: 24px;">
                <label style="font-weight: 600; margin-bottom: 8px; display: block; color: #333;">
                    ${index + 1}. ${field.label} ${requiredMark}
                </label>
                ${inputHtml}
                ${field.placeholder && field.type !== 'text' && field.type !== 'textarea' ? `
                    <small style="display: block; margin-top: 4px; color: #666;">${field.placeholder}</small>
                ` : ''}
            </div>
        `;
    },

    async submitForm(formElement) {
        try {
            const formData = new FormData(formElement);
            const data = {};
            
            // Récupérer le project_id
            const projectId = formData.get('project_id');
            if (!projectId) {
                alert('Veuillez sélectionner un projet');
                return;
            }

            // Construire l'objet de données
            for (const [key, value] of formData.entries()) {
                if (key !== 'project_id') {
                    data[key] = value;
                }
            }

            // Désactiver le bouton de soumission
            const submitBtn = formElement.querySelector('button[type="submit"]');
            submitBtn.disabled = true;
            submitBtn.textContent = '⏳ Envoi en cours...';

            // Envoyer la soumission
            await API.submissions.create({
                form_id: this.data.form.id,
                project_id: parseInt(projectId),
                data: data
            });

            // Fermer le modal
            this.closeFormModal();

            // Afficher un message de succès
            alert('✅ Formulaire soumis avec succès !');

            // Recharger la page pour afficher la nouvelle soumission
            window.location.reload();

        } catch (error) {
            console.error('Error submitting form:', error);
            alert('Erreur lors de la soumission du formulaire: ' + (error.message || 'Erreur inconnue'));
            
            // Réactiver le bouton
            const submitBtn = formElement.querySelector('button[type="submit"]');
            submitBtn.disabled = false;
            submitBtn.textContent = '💾 Enregistrer';
        }
    },

    closeFormModal() {
        const modal = document.getElementById('fill-form-modal');
        if (modal) {
            modal.remove();
        }
    },

    async viewSubmission(id) {
        try {
            const response = await API.submissions.getById(id);
            const submission = response.data;
            
            const dataStr = JSON.stringify(submission.data, null, 2);
            
            const modal = `
                <div id="submission-modal" style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 10000;">
                    <div style="background: white; border-radius: 12px; padding: 32px; max-width: 800px; width: 90%; max-height: 90vh; overflow-y: auto;">
                        <h2 style="margin-bottom: 24px;">Détails de la soumission #${submission.id}</h2>
                        
                        <div style="margin-bottom: 20px;">
                            <div style="margin-bottom: 8px;"><strong>Formulaire:</strong> ${submission.form_title}</div>
                            <div style="margin-bottom: 8px;"><strong>Soumis par:</strong> ${submission.submitter_username}</div>
                            <div style="margin-bottom: 8px;"><strong>Projet:</strong> ${submission.project_title || 'Aucun'}</div>
                            <div style="margin-bottom: 8px;"><strong>Date:</strong> ${DateFormatter.format(submission.submitted_at)}</div>
                        </div>
                        
                        <h3 style="margin-bottom: 16px;">Données soumises:</h3>
                        <pre style="background: #f5f5f5; padding: 20px; border-radius: 8px; overflow-x: auto; font-size: 13px;">${dataStr}</pre>
                        
                        <button onclick="document.getElementById('submission-modal').remove()" class="btn btn-secondary" style="margin-top: 16px;">
                            Fermer
                        </button>
                    </div>
                </div>
            `;
            
            document.body.insertAdjacentHTML('beforeend', modal);
        } catch (error) {
            alert('Erreur lors du chargement de la soumission: ' + error.message);
        }
    },

    afterRender() {
        Navbar.updateActiveMenu();
    }
};

