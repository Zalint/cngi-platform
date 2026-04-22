// Composant Navbar avec sidebar

const Navbar = {
    render() {
        const user = Auth.getUser();
        if (!user) return '';

        const isAdmin = Auth.hasRole('admin');
        const isUtilisateur = Auth.hasRole('utilisateur');
        
        return `
            <div class="sidebar show">
                <div class="sidebar-header">
                    <div class="logo-container">
                        <img src="https://mha.gouv.sn/wp-content/uploads/2020/10/logo_mha_transparent3-1.png" alt="MHA" onerror="this.style.display='none'">
                    </div>
                    <div class="app-title">CNGIRI</div>
                    <div class="app-subtitle">Comité National de Gestion Intégrée du Risque d'Inondation</div>
                    <p style="font-size: 10px; opacity: 0.4; margin-top: 8px;">DPGI — Maître d'ouvrage</p>
                </div>

                <div class="sidebar-menu">
                    <div class="sidebar-section-label">Suivi</div>
                    <a href="#/dashboard" class="menu-item" data-page="dashboard">
                        <span class="menu-item-icon">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
                        </span>
                        <span>Tableau de bord</span>
                    </a>
                    <a href="#/projects" class="menu-item" data-page="projects">
                        <span class="menu-item-icon">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>
                        </span>
                        <span>Projets</span>
                    </a>
                    <a href="#/observations" class="menu-item" data-page="observations">
                        <span class="menu-item-icon">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="15" y2="17"/></svg>
                        </span>
                        <span>Observations</span>
                        <span id="nav-observations-badge" class="nav-badge" style="display:none;"></span>
                    </a>
                    <a href="#/pv" class="menu-item" data-page="pv">
                        <span class="menu-item-icon">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 11H7v9a2 2 0 002 2h8a2 2 0 002-2v-9h-2"/><path d="M16 3h-8a2 2 0 00-2 2v2h12V5a2 2 0 00-2-2z"/><path d="M10 12h4M10 16h4"/></svg>
                        </span>
                        <span>PV de visite</span>
                        <span id="nav-pv-badge" class="nav-badge nav-badge-green" style="display:none;"></span>
                    </a>

                    ${isAdmin ? `
                    <div class="sidebar-section-label">Administration</div>
                    <a href="#/users" class="menu-item" data-page="users">
                        <span class="menu-item-icon">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4-4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>
                        </span>
                        <span>Utilisateurs</span>
                    </a>
                    <a href="#/admin" class="menu-item" data-page="admin">
                        <span class="menu-item-icon">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>
                        </span>
                        <span>Administration</span>
                    </a>
                    <a href="#/decoupage" class="menu-item" data-page="decoupage">
                        <span class="menu-item-icon">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
                        </span>
                        <span>Découpage</span>
                    </a>
                    <a href="#/project-structures" class="menu-item" data-page="project-structures">
                        <span class="menu-item-icon">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4-4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>
                        </span>
                        <span>Rattacher structure</span>
                    </a>
                    ` : ''}
                </div>

                <div class="sidebar-footer">
                    <button class="logout-btn" onclick="Navbar.logout()">
                        Déconnexion
                    </button>
                </div>
            </div>
        `;
    },

    renderTopBar(title = 'Dashboard') {
        const user = Auth.getUser();
        if (!user) return '';

        const roleLabels = {
            'admin': 'Administrateur',
            'utilisateur': 'Utilisateur',
            'directeur': 'Directeur',
            'superviseur': 'Superviseur',
            'commandement_territorial': 'Cmdt territorial'
        };

        return `
            <div class="top-bar">
                <h1>${title}</h1>
                <div class="user-profile">
                    <div class="user-info">
                        <div class="user-name">${Auth.getFullName()}</div>
                        <div class="user-role">${roleLabels[user.role] || user.role}${user.structure_name ? ' - ' + user.structure_code : ''}</div>
                    </div>
                    <div class="user-avatar">${Auth.getInitials()}</div>
                </div>
            </div>
        `;
    },

    updateActiveMenu() {
        const currentHash = window.location.hash;
        const menuItems = document.querySelectorAll('.menu-item');
        
        menuItems.forEach(item => {
            item.classList.remove('active');
            const page = item.getAttribute('data-page');
            if (currentHash.includes(page)) {
                item.classList.add('active');
            }
        });
    },

    logout() {
        Toast.confirm('Etes-vous sur de vouloir vous deconnecter ?', () => {
            Auth.logout();
            window.location.hash = '#/login';
        }, { type: 'info', confirmText: 'Deconnexion' });
    },

    async refreshObservationBadge() {
        const badge = document.getElementById('nav-observations-badge');
        if (!badge) return;
        try {
            const res = await API.observations.getUnreadCount();
            const n = res.count || 0;
            if (n > 0) {
                badge.textContent = n > 9 ? '9+' : String(n);
                badge.style.display = 'inline-flex';
            } else {
                badge.style.display = 'none';
            }
        } catch (e) { /* silencieux */ }
    },

    async refreshPvBadge() {
        const badge = document.getElementById('nav-pv-badge');
        if (!badge) return;
        try {
            const res = await API.pv.getUnreadCount();
            const n = res.count || 0;
            if (n > 0) {
                badge.textContent = n > 9 ? '9+' : String(n);
                badge.style.display = 'inline-flex';
            } else {
                badge.style.display = 'none';
            }
        } catch (e) { /* silencieux */ }
    }
};

