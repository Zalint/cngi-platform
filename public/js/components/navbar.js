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
                    <h2>CNGI</h2>
                    <p>Plateforme de suivi des actions</p>
                </div>

                <div class="sidebar-menu">
                    <a href="#/dashboard" class="menu-item" data-page="dashboard">
                        <span class="menu-item-icon">📊</span>
                        <span>Tableau de bord</span>
                    </a>
                    <a href="#/projects" class="menu-item" data-page="projects">
                        <span class="menu-item-icon">📋</span>
                        <span>Projets</span>
                    </a>
                    ${isAdmin ? `
                    <a href="#/users" class="menu-item" data-page="users">
                        <span class="menu-item-icon">👥</span>
                        <span>Utilisateurs</span>
                    </a>
                    <a href="#/admin" class="menu-item" data-page="admin">
                        <span class="menu-item-icon">⚙️</span>
                        <span>Administration</span>
                    </a>
                    ` : ''}
                </div>

                <div class="sidebar-footer">
                    <button class="logout-btn" onclick="Navbar.logout()">
                        🚪 Déconnexion
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
        if (confirm('Êtes-vous sûr de vouloir vous déconnecter ?')) {
            Auth.logout();
            window.location.hash = '#/login';
        }
    }
};

