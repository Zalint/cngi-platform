// Bibliothèque d'icônes SVG inline (source : Lucide Icons, licence ISC).
// Remplace les emoji utilisés comme icônes métier dans l'application.
//
// Usage dans les templates :
//   Icon.render('map-pin')                 → 16×16, couleur héritée (currentColor)
//   Icon.render('droplet', 20)             → 20×20
//   Icon.render('siren', 18, '#c0392b')    → 18×18, rouge
//
// Accessibilité : chaque SVG inclut un aria-label dérivé du nom. Pour un
// rendu purement décoratif, passer `aria: false`.
const Icon = {
    PATHS: {
        // --- Entités métier ---
        'map-pin':        '<path d="M20 10c0 7-8 12-8 12s-8-5-8-12a8 8 0 0116 0z"/><circle cx="12" cy="10" r="3"/>',
        'route':          '<circle cx="6" cy="19" r="3"/><path d="M9 19h8.5a3.5 3.5 0 000-7h-11a3.5 3.5 0 010-7H15"/><circle cx="18" cy="5" r="3"/>',
        'package':        '<path d="M6 14a2 2 0 00-2 2v4a2 2 0 002 2h12a2 2 0 002-2v-4a2 2 0 00-2-2"/><path d="M2 14h20M12 2v8M8 6l4-4 4 4"/>',
        'building-2':     '<path d="M6 22V4a2 2 0 012-2h8a2 2 0 012 2v18Z"/><path d="M6 12H4a2 2 0 00-2 2v8h4"/><path d="M18 9h2a2 2 0 012 2v11h-4"/><path d="M10 6h4M10 10h4M10 14h4M10 18h4"/>',
        'clipboard-list': '<rect x="8" y="2" width="8" height="4" rx="1" ry="1"/><path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2"/><path d="M12 11h4M12 16h4M8 11h.01M8 16h.01"/>',
        'users':          '<path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/>',
        'user':           '<path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/>',

        // --- Types d'usage (géométries) ---
        'droplet':        '<path d="M12 2.69l5.66 5.66a8 8 0 11-11.31 0z"/>',
        'siren':          '<path d="M7 12a5 5 0 015-5v0a5 5 0 015 5v6H7z"/><path d="M9 18v2M15 18v2"/><path d="M3 14h2M19 14h2M4 8l1.5 1.5M18.5 9.5L20 8"/>',
        'waves':          '<path d="M2 6c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2s2.5 2 5 2 2.5-2 5-2c1.3 0 1.9.5 2.5 1"/><path d="M2 12c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2s2.5 2 5 2 2.5-2 5-2c1.3 0 1.9.5 2.5 1"/><path d="M2 18c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2s2.5 2 5 2 2.5-2 5-2c1.3 0 1.9.5 2.5 1"/>',
        'square':         '<rect x="3" y="3" width="18" height="18" rx="2"/>',

        // --- États / statuts ---
        'alert-triangle': '<path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
        'alert-circle':   '<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>',
        'lock':           '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/>',
        'check':          '<polyline points="20 6 9 17 4 12"/>',
        'x':              '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
        'check-circle':   '<path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>',

        // --- Actions utilisateur ---
        'bell':           '<path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/>',
        'key':            '<circle cx="7.5" cy="15.5" r="5.5"/><path d="M11.5 11.5L21 2m-3 3l3 3m-5-1l2 2"/>',
        'log-out':        '<path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>',
        'pencil':         '<path d="M17 3a2.85 2.83 0 114 4L7.5 20.5 2 22l1.5-5.5z"/>',
        'trash':          '<polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2"/>',
        'plus':           '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
        'search':         '<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>',
        'eye':            '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z"/><circle cx="12" cy="12" r="3"/>',
        'filter':         '<polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>',
        'refresh':        '<path d="M3 12a9 9 0 019-9 9.75 9.75 0 016.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 01-9 9 9.75 9.75 0 01-6.74-2.74L3 16"/><path d="M3 21v-5h5"/>',
        'download':       '<path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
        'upload':         '<path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>',

        // --- Date / reporting ---
        'calendar':       '<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>',
        'clock':          '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
        'file-spreadsheet': '<path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><path d="M8 13h2M8 17h2M14 13h2M14 17h2"/>',
        'bot':            '<rect x="3" y="11" width="18" height="10" rx="2"/><circle cx="12" cy="5" r="2"/><path d="M12 7v4"/><line x1="8" y1="16" x2="8" y2="16"/><line x1="16" y1="16" x2="16" y2="16"/>',
        'message-square': '<path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>',
        'send':           '<line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>',

        // --- Navigation ---
        'chevron-right':  '<polyline points="9 18 15 12 9 6"/>',
        'chevron-down':   '<polyline points="6 9 12 15 18 9"/>',
        'chevron-up':     '<polyline points="18 15 12 9 6 15"/>',
        'external-link':  '<path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>',
        'arrow-right':    '<line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>',

        // --- Divers ---
        'shield':         '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
        'info':           '<circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>',
        'restore':        '<path d="M3 12a9 9 0 109-9 9.75 9.75 0 00-6.74 2.74L3 8"/><path d="M3 3v5h5"/>',
        'map':            '<polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/>',
        'sun':            '<circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>',
        'moon':           '<path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/>'
    },

    /**
     * Génère le markup SVG pour une icône donnée.
     * @param {string} name - Clé dans PATHS (ex: 'map-pin')
     * @param {number} size - Taille en px (défaut 16)
     * @param {string} color - Couleur, ou 'currentColor' pour hériter (défaut)
     * @param {object} opts - { aria: true|false, className: string, stroke: number }
     */
    render(name, size = 16, color = 'currentColor', opts = {}) {
        const path = this.PATHS[name];
        if (!path) {
            console.warn(`[Icon] unknown: ${name}`);
            return '';
        }
        const { aria = true, className = '', stroke = 2 } = opts;
        const ariaAttrs = aria
            ? `role="img" aria-label="${name.replace(/-/g, ' ')}"`
            : 'aria-hidden="true"';
        const cls = className ? `class="${className}"` : '';
        return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round" ${cls} ${ariaAttrs}>${path}</svg>`;
    },

    /**
     * Raccourci qui place l'icône dans un span inline-flex avec du texte.
     * Exemple : Icon.inline('clipboard-list', 'Mes mesures')
     */
    inline(name, text, size = 14) {
        return `<span style="display:inline-flex;align-items:center;gap:6px;">${this.render(name, size)}<span>${text}</span></span>`;
    }
};
