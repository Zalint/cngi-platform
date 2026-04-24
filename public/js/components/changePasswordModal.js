// Modale pour changer le mot de passe utilisateur.
// Affiche les contraintes en temps réel (check / cross à chaque frappe).

const ChangePasswordModal = {
    RULES: [
        { key: 'minLength', test: (p) => p.length >= 8,   label: 'Au moins 8 caractères' },
        { key: 'upperCase', test: (p) => /[A-Z]/.test(p), label: 'Au moins une majuscule (A-Z)' },
        { key: 'lowerCase', test: (p) => /[a-z]/.test(p), label: 'Au moins une minuscule (a-z)' },
        { key: 'digit',     test: (p) => /[0-9]/.test(p), label: 'Au moins un chiffre (0-9)' }
    ],

    open() {
        this.close(); // au cas où une modale serait déjà ouverte

        const overlay = document.createElement('div');
        overlay.id = 'change-password-overlay';
        overlay.className = 'confirm-overlay confirm-visible';
        overlay.innerHTML = `
            <div class="confirm-dialog" style="text-align:left;max-width:500px;">
                <h3 style="margin-bottom:8px;color:#202B5D;display:inline-flex;align-items:center;gap:8px;">${Icon.render('key', 18, '#202B5D')} Changer le mot de passe</h3>
                <p style="color:#62718D;font-size:13px;margin-bottom:16px;">
                    Choisis un mot de passe qui respecte toutes les règles ci-dessous.
                </p>

                <form id="cp-form" autocomplete="off">
                    <div class="form-group">
                        <label>Mot de passe actuel *</label>
                        <input type="password" id="cp-current" class="form-control" autocomplete="current-password" required>
                    </div>

                    <div class="form-group">
                        <label>Nouveau mot de passe *</label>
                        <input type="password" id="cp-new" class="form-control" autocomplete="new-password" required>
                    </div>

                    <div id="cp-rules" style="background:#f8f9fa;border-radius:6px;padding:10px 14px;margin:8px 0 16px;">
                        ${this.RULES.map(r => `
                            <div class="cp-rule" data-key="${r.key}" style="display:flex;align-items:center;gap:8px;font-size:12px;color:#8896AB;line-height:1.7;">
                                <span class="cp-rule-icon" style="font-weight:700;color:#c0392b;width:14px;text-align:center;">✗</span>
                                <span>${r.label}</span>
                            </div>
                        `).join('')}
                    </div>

                    <div class="form-group">
                        <label>Confirmation du nouveau mot de passe *</label>
                        <input type="password" id="cp-confirm" class="form-control" autocomplete="new-password" required>
                        <div id="cp-match-msg" style="font-size:11px;margin-top:4px;"></div>
                    </div>

                    <div class="confirm-actions" style="margin-top:16px;">
                        <button type="button" class="confirm-btn confirm-btn-cancel" onclick="ChangePasswordModal.close()">Annuler</button>
                        <button type="submit" class="confirm-btn confirm-btn-ok" style="background:#202B5D;" id="cp-submit" disabled>Enregistrer</button>
                    </div>
                </form>
            </div>
        `;
        document.body.appendChild(overlay);

        const $new = document.getElementById('cp-new');
        const $confirm = document.getElementById('cp-confirm');
        const $submit = document.getElementById('cp-submit');
        const $matchMsg = document.getElementById('cp-match-msg');
        const $form = document.getElementById('cp-form');

        const updateState = () => {
            const pwd = $new.value;
            // Validation règles
            const ruleResults = this.RULES.map(r => ({ ...r, ok: r.test(pwd) }));
            ruleResults.forEach(r => {
                const row = document.querySelector(`.cp-rule[data-key="${r.key}"]`);
                if (!row) return;
                const icon = row.querySelector('.cp-rule-icon');
                if (r.ok) {
                    icon.textContent = '✓';
                    icon.style.color = '#27ae60';
                    row.style.color = '#202B5D';
                } else {
                    icon.textContent = '✗';
                    icon.style.color = '#c0392b';
                    row.style.color = '#8896AB';
                }
            });
            const allRulesOk = ruleResults.every(r => r.ok);

            // Validation confirmation
            const confirmVal = $confirm.value;
            let matchOk = false;
            if (!confirmVal) {
                $matchMsg.textContent = '';
            } else if (pwd !== confirmVal) {
                $matchMsg.textContent = '✗ Les deux mots de passe ne correspondent pas';
                $matchMsg.style.color = '#c0392b';
            } else {
                $matchMsg.textContent = '✓ Les mots de passe correspondent';
                $matchMsg.style.color = '#27ae60';
                matchOk = true;
            }

            $submit.disabled = !(allRulesOk && matchOk);
        };

        $new.addEventListener('input', updateState);
        $confirm.addEventListener('input', updateState);

        $form.addEventListener('submit', async (ev) => {
            ev.preventDefault();
            await this.submit();
        });

        // Focus sur le premier champ
        setTimeout(() => document.getElementById('cp-current')?.focus(), 50);
    },

    async submit() {
        const $submit = document.getElementById('cp-submit');
        const current_password = document.getElementById('cp-current').value;
        const new_password = document.getElementById('cp-new').value;
        if (!current_password || !new_password) return;

        $submit.disabled = true;
        const originalText = $submit.textContent;
        $submit.textContent = '⏳ Enregistrement...';

        try {
            await API.auth.changePassword({ current_password, new_password });
            Toast.success('Mot de passe modifié avec succès.');
            this.close();
        } catch (err) {
            console.error(err);
            Toast.error(err?.message || 'Erreur lors du changement de mot de passe.');
            $submit.disabled = false;
            $submit.textContent = originalText;
        }
    },

    close() {
        document.getElementById('change-password-overlay')?.remove();
    }
};
