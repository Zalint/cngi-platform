// Application principale - Routeur SPA

const App = {
    init() {
        // Initialiser le routeur
        window.addEventListener('hashchange', () => this.router());
        window.addEventListener('load', () => this.router());
    },

    async router() {
        const hash = window.location.hash || '#/login';
        const path = hash.substring(1); // Enlever le #
        
        // Parse la route et les paramètres
        const [route, ...params] = path.split('/').filter(p => p);
        
        // Afficher le loader
        this.showLoader();

        try {
            let content = '';

            // Routes publiques
            if (route === 'login') {
                if (Auth.isAuthenticated()) {
                    window.location.hash = '#/dashboard';
                    return;
                }
                content = LoginPage.render();
            }
            // Routes protégées
            else {
                if (!Auth.isAuthenticated()) {
                    window.location.hash = '#/login';
                    return;
                }

                switch (route) {
                    case 'dashboard':
                        content = await DashboardPage.render();
                        break;
                    
                    case 'projects':
                        if (params.length === 0) {
                            content = await ProjectsPage.render();
                        } else if (params[0] === 'new') {
                            if (Auth.hasAnyRole('superviseur', 'commandement_territorial')) {
                                content = '<div class="alert alert-error">Accès refusé</div>';
                            } else {
                                content = await ProjectFormPage.render();
                            }
                        } else if (params[1] === 'edit') {
                            if (Auth.hasAnyRole('superviseur', 'commandement_territorial')) {
                                content = '<div class="alert alert-error">Accès refusé</div>';
                            } else {
                                const projectId = parseInt(params[0]);
                                content = await ProjectFormPage.render(projectId);
                            }
                        } else {
                            const projectId = parseInt(params[0]);
                            content = await ProjectDetailPage.render(projectId);
                        }
                        break;
                    
                    case 'forms':
                        if (Auth.hasAnyRole('superviseur', 'commandement_territorial')) {
                            content = '<div class="alert alert-error">Accès refusé</div>';
                        } else if (params.length === 0) {
                            content = await FormsPage.render();
                        } else if (params[0] === 'new') {
                            content = await FormBuilderPage.render();
                        } else if (params[1] === 'edit') {
                            const formId = parseInt(params[0]);
                            content = await FormBuilderPage.render(formId);
                        } else {
                            const formId = parseInt(params[0]);
                            content = await FormViewPage.render(formId);
                        }
                        break;
                    
                    case 'admin':
                        if (!Auth.hasRole('admin')) {
                            content = '<div class="alert alert-error">Accès refusé</div>';
                        } else {
                            content = await AdminPage.render();
                        }
                        break;
                    
                    case 'project-structures':
                        if (!Auth.hasRole('admin')) {
                            content = '<div class="alert alert-error">Accès refusé</div>';
                        } else {
                            content = await ProjectStructuresPage.render();
                        }
                        break;
                    
                    case 'users':
                        if (!Auth.hasRole('admin')) {
                            content = '<div class="alert alert-error">Accès refusé</div>';
                        } else {
                            content = await UsersPage.render();
                        }
                        break;

                    case 'decoupage':
                        if (!Auth.hasRole('admin')) {
                            content = '<div class="alert alert-error">Accès refusé</div>';
                        } else {
                            content = await DecoupagePage.render();
                        }
                        break;

                    case 'observations':
                        content = await ObservationsPage.render();
                        break;

                    case 'pv':
                        content = await PvPage.render();
                        break;

                    default:
                        // Par défaut, rediriger vers dashboard
                        window.location.hash = '#/dashboard';
                        return;
                }
            }

            // Injecter le contenu
            document.getElementById('app').innerHTML = content;

            // Appeler afterRender si disponible
            this.callAfterRender(route, params);

            // Rafraîchir les badges non lus
            if (Auth.isAuthenticated() && typeof Navbar !== 'undefined') {
                if (Navbar.refreshObservationBadge) Navbar.refreshObservationBadge();
                if (Navbar.refreshPvBadge) Navbar.refreshPvBadge();
            }

        } catch (error) {
            console.error('Routing error:', error);
            document.getElementById('app').innerHTML = `
                <div class="alert alert-error">
                    <h3>Erreur</h3>
                    <p>${error.message}</p>
                    <button class="btn btn-secondary" onclick="window.location.hash='#/dashboard'">
                        Retour au dashboard
                    </button>
                </div>
            `;
        } finally {
            this.hideLoader();
        }
    },

    callAfterRender(route, params) {
        // Appeler la méthode afterRender de la page si elle existe
        setTimeout(() => {
            switch (route) {
                case 'login':
                    if (LoginPage.afterRender) LoginPage.afterRender();
                    break;
                case 'dashboard':
                    if (DashboardPage.afterRender) DashboardPage.afterRender();
                    break;
                case 'projects':
                    if (params.length === 0 && ProjectsPage.afterRender) {
                        ProjectsPage.afterRender();
                    } else if (params[0] === 'new' && ProjectFormPage.afterRender) {
                        ProjectFormPage.afterRender();
                    } else if (params[1] === 'edit' && ProjectFormPage.afterRender) {
                        ProjectFormPage.afterRender();
                    } else if (params.length > 0 && ProjectDetailPage.afterRender) {
                        ProjectDetailPage.afterRender();
                    }
                    break;
                case 'observations':
                    if (ObservationsPage.afterRender) ObservationsPage.afterRender();
                    break;
                case 'pv':
                    if (PvPage.afterRender) PvPage.afterRender();
                    break;
                case 'forms':
                    if (params.length === 0 && FormsPage.afterRender) {
                        FormsPage.afterRender();
                    } else if (params[0] === 'new' && FormBuilderPage.afterRender) {
                        FormBuilderPage.afterRender();
                    } else if (params[1] === 'edit' && FormBuilderPage.afterRender) {
                        FormBuilderPage.afterRender();
                    } else if (params.length > 0 && FormViewPage.afterRender) {
                        FormViewPage.afterRender();
                    }
                    break;
                case 'admin':
                    if (AdminPage.afterRender) AdminPage.afterRender();
                    break;
                case 'project-structures':
                    if (ProjectStructuresPage.afterRender) ProjectStructuresPage.afterRender();
                    break;
                case 'users':
                    if (UsersPage.afterRender) UsersPage.afterRender();
                    break;
                case 'decoupage':
                    if (DecoupagePage.afterRender) DecoupagePage.afterRender();
                    break;
            }
        }, 100);
    },

    showLoader() {
        const loader = document.getElementById('loader');
        if (!loader) {
            const loaderEl = document.createElement('div');
            loaderEl.id = 'loader';
            loaderEl.className = 'loading-overlay';
            loaderEl.innerHTML = '<div class="loading"></div>';
            document.body.appendChild(loaderEl);
        }
    },

    hideLoader() {
        const loader = document.getElementById('loader');
        if (loader) {
            loader.remove();
        }
    }
};

// Initialiser l'application au chargement
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});

// Gestion des erreurs globales
window.addEventListener('error', (event) => {
    console.error('Global error:', event.error);
});

window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason);
});

