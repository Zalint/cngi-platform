// Gestion de l'authentification

const Auth = {
    TOKEN_KEY: 'cngi_token',
    USER_KEY: 'cngi_user',

    /**
     * Sauvegarder le token et l'utilisateur
     */
    saveAuth(token, user) {
        localStorage.setItem(this.TOKEN_KEY, token);
        localStorage.setItem(this.USER_KEY, JSON.stringify(user));
    },

    /**
     * Récupérer le token
     */
    getToken() {
        return localStorage.getItem(this.TOKEN_KEY);
    },

    /**
     * Récupérer l'utilisateur
     */
    getUser() {
        const userStr = localStorage.getItem(this.USER_KEY);
        return userStr ? JSON.parse(userStr) : null;
    },

    /**
     * Vérifier si l'utilisateur est connecté
     */
    isAuthenticated() {
        return !!this.getToken();
    },

    /**
     * Déconnecter l'utilisateur
     */
    logout() {
        localStorage.removeItem(this.TOKEN_KEY);
        localStorage.removeItem(this.USER_KEY);
    },

    /**
     * Met à jour uniquement le token (utilisé après "logout all devices" ou
     * changement de mot de passe — le serveur renvoie un token frais pour
     * garder la session courante alors que les autres sont révoquées).
     */
    setToken(token) {
        if (token) localStorage.setItem(this.TOKEN_KEY, token);
    },

    /**
     * Vérifier si l'utilisateur a un rôle spécifique
     */
    hasRole(role) {
        const user = this.getUser();
        return user && user.role === role;
    },

    /**
     * Vérifier si l'utilisateur a l'un des rôles
     */
    hasAnyRole(...roles) {
        const user = this.getUser();
        return user && roles.includes(user.role);
    },

    /**
     * Rôles de lecture seule (aucune écriture possible)
     */
    isReadOnly() {
        return this.hasAnyRole('lecteur', 'auditeur');
    },

    /**
     * Peut modifier quoi que ce soit (créer / éditer / supprimer)
     */
    canWrite() {
        return !this.isReadOnly();
    },

    /**
     * Peut voir les montants financiers (budget, coûts)
     */
    canSeeBudget() {
        return !this.hasRole('lecteur');
    },

    /**
     * Peut exporter / générer un rapport IA (extraction de données)
     */
    canExport() {
        return !this.hasRole('lecteur');
    },

    /**
     * Obtenir les initiales pour l'avatar
     */
    getInitials() {
        const user = this.getUser();
        if (!user) return '??';
        
        if (user.first_name && user.last_name) {
            return (user.first_name[0] + user.last_name[0]).toUpperCase();
        }
        
        return user.username.substring(0, 2).toUpperCase();
    },

    /**
     * Obtenir le nom complet
     */
    getFullName() {
        const user = this.getUser();
        if (!user) return '';
        
        if (user.first_name && user.last_name) {
            return `${user.first_name} ${user.last_name}`;
        }
        
        return user.username;
    }
};

