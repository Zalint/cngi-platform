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
            const overlay = document.createElement('div');
            overlay.className = 'confirm-overlay';
            overlay.innerHTML = `
                <div class="confirm-dialog" style="text-align:left;max-width:480px;">
                    <div class="confirm-message" style="margin-bottom:12px;">${message}</div>
                    <input type="text" class="prompt-input" value=""
                           style="width:100%;padding:10px 12px;border:1px solid #dce3ed;border-radius:6px;font-size:14px;outline:none;box-sizing:border-box;" />
                    <div class="confirm-actions" style="margin-top:18px;">
                        <button class="confirm-btn confirm-btn-cancel">${cancelText}</button>
                        <button class="confirm-btn confirm-btn-ok" style="background:${color};">${confirmText}</button>
                    </div>
                </div>
            `;

            document.body.appendChild(overlay);
            requestAnimationFrame(() => overlay.classList.add('confirm-visible'));

            const input = overlay.querySelector('.prompt-input');
            input.value = defaultValue || '';
            input.placeholder = placeholder;
            // Focus + sélection — comportement attendu d'un prompt
            setTimeout(() => { input.focus(); input.select(); }, 50);

            const cleanup = () => {
                overlay.classList.remove('confirm-visible');
                setTimeout(() => overlay.remove(), 200);
                document.removeEventListener('keydown', onKey);
            };
            const submit = () => { const v = (input.value || '').trim(); cleanup(); resolve(v); };
            const cancel = () => { cleanup(); resolve(null); };

            // Clavier : Enter = OK, Escape = annule. Listener nommé pour pouvoir
            // le détacher dans cleanup() (sinon fuite à chaque prompt).
            const onKey = (e) => {
                if (e.key === 'Enter') { e.preventDefault(); submit(); }
                else if (e.key === 'Escape') { cancel(); }
            };
            document.addEventListener('keydown', onKey);

            overlay.querySelector('.confirm-btn-cancel').addEventListener('click', cancel);
            overlay.querySelector('.confirm-btn-ok').addEventListener('click', submit);
            overlay.addEventListener('click', (e) => { if (e.target === overlay) cancel(); });
        });
    }
};
