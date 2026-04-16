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

