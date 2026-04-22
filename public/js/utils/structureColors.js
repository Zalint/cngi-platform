// Palette unique partagée — une couleur par code structure (uniformisée partout)
const StructureColors = {
    // Couleurs fixes pour les structures connues
    _fixed: {
        DPGI:     '#3794C4', // bleu CNGI
        ONAS:     '#27ae60', // vert
        BNSP:     '#e74c3c', // rouge pompiers
        CETUD:    '#9b59b6', // violet
        AGEROUTE: '#f39c12', // orange
        DPC:      '#16a085'  // sarcelle
    },
    // Palette fallback pour toute nouvelle structure (générée de façon déterministe)
    _fallback: ['#1abc9c', '#2980b9', '#d35400', '#c0392b', '#7f8c8d', '#8e44ad', '#2c3e50', '#e67e22', '#34495e'],

    // Hash simple d'une chaîne → index stable
    _hash(str) {
        let h = 0;
        for (let i = 0; i < (str || '').length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
        return h;
    },

    /**
     * Retourne la couleur associée à un code structure.
     * @param {string} code - code structure (ex: 'DPGI')
     * @returns {string} couleur hex
     */
    get(code) {
        if (!code) return '#8896AB';
        const key = String(code).toUpperCase();
        if (this._fixed[key]) return this._fixed[key];
        const idx = this._hash(key) % this._fallback.length;
        return this._fallback[idx];
    }
};
