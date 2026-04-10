// Utilitaires pour le formatage des dates
// Support: YYYY-MM-DD, DD-MM-YYYY, DD/MM/YYYY, DD/MM/YY

const DateFormatter = {
    /**
     * Formater une date SQL vers format d'affichage
     * @param {string} sqlDate - Date format YYYY-MM-DD
     * @param {string} format - Format souhaité
     * @returns {string}
     */
    format(sqlDate, format = 'DD/MM/YYYY') {
        if (!sqlDate) return '';
        
        const date = new Date(sqlDate);
        if (isNaN(date.getTime())) return sqlDate;
        
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        const shortYear = String(year).slice(-2);
        
        switch (format) {
            case 'DD-MM-YYYY':
                return `${day}-${month}-${year}`;
            case 'DD/MM/YYYY':
                return `${day}/${month}/${year}`;
            case 'DD/MM/YY':
                return `${day}/${month}/${shortYear}`;
            case 'YYYY-MM-DD':
                return `${year}-${month}-${day}`;
            default:
                return `${day}/${month}/${year}`;
        }
    },

    /**
     * Convertir vers format SQL
     * @param {string} dateStr - Date dans différents formats
     * @returns {string} - Format YYYY-MM-DD
     */
    toSQL(dateStr) {
        if (!dateStr) return '';
        
        // Déjà au format YYYY-MM-DD
        if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
            return dateStr;
        }
        
        // Format DD-MM-YYYY
        if (/^\d{2}-\d{2}-\d{4}$/.test(dateStr)) {
            const [day, month, year] = dateStr.split('-');
            return `${year}-${month}-${day}`;
        }
        
        // Format DD/MM/YYYY
        if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) {
            const [day, month, year] = dateStr.split('/');
            return `${year}-${month}-${day}`;
        }
        
        // Format DD/MM/YY
        if (/^\d{2}\/\d{2}\/\d{2}$/.test(dateStr)) {
            const [day, month, year] = dateStr.split('/');
            const fullYear = parseInt(year) > 50 ? `19${year}` : `20${year}`;
            return `${fullYear}-${month}-${day}`;
        }
        
        return dateStr;
    },

    /**
     * Obtenir la date courante au format SQL
     * @returns {string}
     */
    today() {
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    },

    /**
     * Calculer les jours restants jusqu'à une date
     * @param {string} date - Date cible
     * @returns {number}
     */
    daysUntil(date) {
        const target = new Date(date);
        const today = new Date();
        const diff = target - today;
        return Math.ceil(diff / (1000 * 60 * 60 * 24));
    }
};

