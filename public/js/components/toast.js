// Toast & Confirm UI Component
// Replaces browser alert() and confirm() with styled popups

const Toast = {
    container: null,

    init() {
        if (this.container) return;
        this.container = document.createElement('div');
        this.container.className = 'toast-container';
        document.body.appendChild(this.container);
    },

    show(message, type = 'info', duration = 3500) {
        this.init();

        const icons = {
            success: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 6L9 17l-5-5"/></svg>',
            error: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
            warning: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
            info: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>'
        };

        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.innerHTML = `
            <div class="toast-icon">${icons[type] || icons.info}</div>
            <div class="toast-message">${message}</div>
            <button class="toast-close" onclick="this.parentElement.remove()">&times;</button>
        `;

        this.container.appendChild(toast);

        // Animate in
        requestAnimationFrame(() => toast.classList.add('toast-visible'));

        // Auto dismiss
        if (type !== 'error') {
            setTimeout(() => {
                toast.classList.remove('toast-visible');
                setTimeout(() => toast.remove(), 300);
            }, duration);
        }
    },

    success(message) {
        this.show(message, 'success');
    },

    error(message) {
        this.show(message, 'error', 6000);
    },

    warning(message) {
        this.show(message, 'warning', 4000);
    },

    info(message) {
        this.show(message, 'info');
    },

    confirm(message, onConfirm, options = {}) {
        const {
            confirmText = 'Confirmer',
            cancelText = 'Annuler',
            type = 'warning'
        } = options;

        const overlay = document.createElement('div');
        overlay.className = 'confirm-overlay';

        const typeColors = {
            warning: '#f39c12',
            danger: '#e74c3c',
            info: '#3794C4'
        };
        const color = typeColors[type] || typeColors.warning;

        const icons = {
            warning: '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="' + color + '" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
            danger: '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="' + color + '" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
            info: '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="' + color + '" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>'
        };

        overlay.innerHTML = `
            <div class="confirm-dialog">
                <div class="confirm-icon">${icons[type] || icons.warning}</div>
                <div class="confirm-message">${message}</div>
                <div class="confirm-actions">
                    <button class="confirm-btn confirm-btn-cancel">${cancelText}</button>
                    <button class="confirm-btn confirm-btn-ok" style="background:${color};">${confirmText}</button>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);
        requestAnimationFrame(() => overlay.classList.add('confirm-visible'));

        const close = () => {
            overlay.classList.remove('confirm-visible');
            setTimeout(() => overlay.remove(), 200);
        };

        overlay.querySelector('.confirm-btn-cancel').addEventListener('click', close);
        overlay.querySelector('.confirm-btn-ok').addEventListener('click', () => {
            close();
            if (onConfirm) onConfirm();
        });
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) close();
        });
    },

    /**
     * Remplaçant stylé pour window.prompt(). Renvoie une Promise qui résout sur
     * la valeur saisie (string trimée) ou null si l'utilisateur annule.
     * Usage :
     *   const v = await Toast.prompt('Titre du document :', 'mon-fichier');
     *   if (v === null) return;            // annulé
     *   if (!v) Toast.warning('Vide');     // OK avec champ vide
     */
    prompt(message, defaultValue = '', options = {}) {
        const {
            confirmText = 'OK',
            cancelText = 'Annuler',
            placeholder = '',
            type = 'info'
        } = options;

        const typeColors = { warning: '#f39c12', danger: '#e74c3c', info: '#3794C4' };
        const color = typeColors[type] || typeColors.info;

        return new Promise((resolve) => {
            // Construction par DOM (pas innerHTML) pour ne JAMAIS injecter du HTML
            // depuis un texte fourni par l'appelant — message / confirmText /
            // cancelText sont posés via textContent, donc XSS impossible même si
            // un futur appelant passe une chaîne contenant des balises.
            const overlay = document.createElement('div');
            overlay.className = 'confirm-overlay';

            const dialog = document.createElement('div');
            dialog.className = 'confirm-dialog';
            dialog.style.cssText = 'text-align:left;max-width:480px;';

            const msg = document.createElement('div');
            msg.className = 'confirm-message';
            msg.style.cssText = 'margin-bottom:12px;';
            msg.textContent = message;

            const input = document.createElement('input');
            input.type = 'text';
            input.className = 'prompt-input';
            input.style.cssText = 'width:100%;padding:10px 12px;border:1px solid #dce3ed;border-radius:6px;font-size:14px;outline:none;box-sizing:border-box;';
            input.value = defaultValue || '';
            input.placeholder = placeholder;

            const actions = document.createElement('div');
            actions.className = 'confirm-actions';
            actions.style.cssText = 'margin-top:18px;';

            const btnCancel = document.createElement('button');
            btnCancel.type = 'button';
            btnCancel.className = 'confirm-btn confirm-btn-cancel';
            btnCancel.textContent = cancelText;

            const btnOk = document.createElement('button');
            btnOk.type = 'button';
            btnOk.className = 'confirm-btn confirm-btn-ok';
            btnOk.style.background = color;
            btnOk.textContent = confirmText;

            actions.append(btnCancel, btnOk);
            dialog.append(msg, input, actions);
            overlay.appendChild(dialog);
            document.body.appendChild(overlay);
            requestAnimationFrame(() => overlay.classList.add('confirm-visible'));

            // Focus + sélection — comportement attendu d'un prompt
            setTimeout(() => { input.focus(); input.select(); }, 50);

            const cleanup = () => {
                overlay.classList.remove('confirm-visible');
                setTimeout(() => overlay.remove(), 200);
                input.removeEventListener('keydown', onInputKey);
                document.removeEventListener('keydown', onDocKey);
            };
            const submit = () => { const v = (input.value || '').trim(); cleanup(); resolve(v); };
            const cancel = () => { cleanup(); resolve(null); };

            // Enter ne doit déclencher le submit QUE si l'input a le focus —
            // sinon un Enter sur un autre élément focusé (bouton resté actif
            // après un clic) soumettrait le prompt par inadvertance.
            const onInputKey = (e) => {
                if (e.key === 'Enter') { e.preventDefault(); submit(); }
            };
            // Escape reste global (ferme le modal depuis n'importe où)
            const onDocKey = (e) => {
                if (e.key === 'Escape') cancel();
            };
            input.addEventListener('keydown', onInputKey);
            document.addEventListener('keydown', onDocKey);

            btnCancel.addEventListener('click', cancel);
            btnOk.addEventListener('click', submit);
            overlay.addEventListener('click', (e) => { if (e.target === overlay) cancel(); });
        });
    }
};
