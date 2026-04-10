// Page de connexion

const LoginPage = {
    render() {
        return `
            <div class="login-container">
                <div class="login-card">
                    <div class="logo-section">
                        <h1>CNGI</h1>
                        <p>Plateforme de suivi des actions</p>
                    </div>

                    <div id="error-message" class="alert alert-error hidden"></div>

                    <form id="login-form">
                        <div class="form-group">
                            <label for="username">Nom d'utilisateur</label>
                            <input type="text" id="username" class="form-control" placeholder="Entrez votre nom d'utilisateur" required>
                        </div>

                        <div class="form-group">
                            <label for="password">Mot de passe</label>
                            <input type="password" id="password" class="form-control" placeholder="Entrez votre mot de passe" required>
                        </div>

                        <button type="submit" class="btn btn-primary" style="width: 100%;">
                            Se connecter
                        </button>
                    </form>

                    <div style="margin-top: 30px; padding-top: 30px; border-top: 1px solid #e0e0e0;">
                        <p style="text-align: center; color: #666; font-size: 13px; margin-bottom: 16px;">
                            Comptes de démonstration :
                        </p>
                        <div style="padding: 16px; background: #f8f9fa; border-radius: 8px; font-size: 13px;">
                            <div style="margin-bottom: 8px;"><strong>Admin:</strong> admin / mha@2024</div>
                            <div style="margin-bottom: 8px;"><strong>Utilisateur DPGI:</strong> user_dpgi / mha@2024</div>
                            <div><strong>Directeur:</strong> directeur / mha@2024</div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    },

    afterRender() {
        const form = document.getElementById('login-form');
        form.addEventListener('submit', this.handleLogin);
    },

    async handleLogin(e) {
        e.preventDefault();

        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;
        const errorMsg = document.getElementById('error-message');

        try {
            errorMsg.classList.add('hidden');
            
            const response = await API.auth.login({ username, password });

            if (response.success) {
                Auth.saveAuth(response.data.token, response.data.user);
                window.location.hash = '#/dashboard';
            } else {
                errorMsg.textContent = response.message || 'Erreur de connexion';
                errorMsg.classList.remove('hidden');
            }
        } catch (error) {
            errorMsg.textContent = error.message || 'Erreur de connexion';
            errorMsg.classList.remove('hidden');
        }
    }
};

