// Page de connexion

const LoginPage = {
    render() {
        return `
            <div class="login-container">
                <div class="login-card">
                    <div class="logo-section">
                        <img src="https://mha.gouv.sn/wp-content/uploads/2020/10/logo_mha_transparent3-1.png" alt="MHA" style="height: 70px; margin-bottom: 16px;" onerror="this.style.display='none'">
                        <h1>CNGI</h1>
                        <p>Comité National de Gestion des Inondations</p>
                        <p style="font-size: 11px; color: #8896AB; margin-top: 4px;">Ministère de l'Hydraulique et de l'Assainissement — DPGI</p>
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

