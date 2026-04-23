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

                    case 'my-measures':
                        content = await MyMeasuresPage.render();
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
                if (Navbar.refreshMyMeasuresBadge) Navbar.refreshMyMeasuresBadge();
                if (Navbar.refreshNotificationBell) Navbar.refreshNotificationBell();
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
                case 'my-measures':
                    if (MyMeasuresPage.afterRender) MyMeasuresPage.afterRender();
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

// Spinner thématique "eau" — séquence narrative : Sunu Nawét → goutte → pluie → caniveau → motopompe
const WaterSpinner = {
    show(label = 'Traitement en cours...') {
        this.hide();
        const overlay = document.createElement('div');
        overlay.id = 'water-spinner-overlay';
        overlay.className = 'loading-overlay loading-overlay-water';
        overlay.innerHTML = `
            <div class="water-spinner">
                <div class="ws-stage ws-stage-intro">
                    <div class="sunu-title">Sunu <span class="accent">Nawét</span></div>
                </div>
                <div class="ws-stage ws-stage-1">
                    <div class="drop-wrap">
                        <div class="drop"></div>
                        <div class="ripple"></div>
                        <div class="ripple r2"></div>
                        <div class="ripple r3"></div>
                    </div>
                </div>
                <div class="ws-stage ws-stage-2">
                    <div class="rain-wrap">
                        <div class="rain-drop"></div>
                        <div class="rain-drop"></div>
                        <div class="rain-drop"></div>
                        <div class="rain-drop"></div>
                        <div class="rain-drop"></div>
                        <div class="puddle"></div>
                    </div>
                </div>
                <div class="ws-stage ws-stage-3">
                    <div class="gut-stage">
                        <div class="gut-street"></div>
                        <div class="gut-channel">
                            <div class="gut-water"></div>
                        </div>
                        <div class="gut-drain"></div>
                        <div class="gut-suck"></div>
                        <div class="gut-suck s2"></div>
                        <div class="gut-suck s3"></div>
                    </div>
                </div>
                <div class="ws-stage ws-stage-4">
                    <div class="mp-stage">
                        <div class="mp-flood"></div>
                        <div class="mp-intake-hose"></div>
                        <div class="mp-wheel w1"></div>
                        <div class="mp-wheel w2"></div>
                        <div class="mp-body"></div>
                        <div class="mp-engine"></div>
                        <div class="mp-exhaust"></div>
                        <div class="mp-smoke"></div>
                        <div class="mp-smoke s2"></div>
                        <div class="mp-smoke s3"></div>
                        <div class="mp-discharge-hose"></div>
                        <div class="mp-jet"></div>
                        <div class="mp-jet j2"></div>
                        <div class="mp-jet j3"></div>
                        <div class="mp-jet j4"></div>
                    </div>
                </div>
            </div>
            <div class="water-spinner-label">${label}</div>
        `;
        document.body.appendChild(overlay);
    },
    setLabel(label) {
        const el = document.querySelector('#water-spinner-overlay .water-spinner-label');
        if (el) el.textContent = label;
    },
    hide() {
        document.getElementById('water-spinner-overlay')?.remove();
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

