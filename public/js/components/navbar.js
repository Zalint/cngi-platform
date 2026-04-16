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
                    <div class="app-title">CNGI</div>
                    <div class="app-subtitle">Comité National de Gestion des Inondations</div>
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
            'directeur': 'Directeur'
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
    }
};

