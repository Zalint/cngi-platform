/**
 * Utilitaires pour la gestion des dates
 * Support des formats: YYYY-MM-DD, DD-MM-YYYY, DD/MM/YYYY, DD/MM/YY
 */

/**
 * Convertir une date de différents formats vers YYYY-MM-DD (format SQL)
 * @param {string} dateStr - Date sous forme de chaîne
 * @returns {string} - Date au format YYYY-MM-DD ou null si invalide
 */
const toSQLDate = (dateStr) => {
    if (!dateStr) return null;
    
    // Si déjà au format YYYY-MM-DD
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
    
    // Essayer de parser comme objet Date
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) {
        return date.toISOString().split('T')[0];
    }
    
    return null;
};

/**
 * Formater une date SQL (YYYY-MM-DD) vers un format d'affichage
 * @param {string} sqlDate - Date au format YYYY-MM-DD
 * @param {string} format - Format de sortie: 'DD-MM-YYYY', 'DD/MM/YYYY', 'DD/MM/YY'
 * @returns {string} - Date formatée
 */
const formatDate = (sqlDate, format = 'DD/MM/YYYY') => {
    if (!sqlDate) return '';
    
    let date;
    if (typeof sqlDate === 'string') {
        date = new Date(sqlDate);
    } else {
        date = sqlDate;
    }
    
    if (isNaN(date.getTime())) return '';
    
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
};

/**
 * Valider une date
 * @param {string} dateStr - Date à valider
 * @returns {boolean} - true si valide
 */
const isValidDate = (dateStr) => {
    if (!dateStr) return false;
    
    const sqlDate = toSQLDate(dateStr);
    if (!sqlDate) return false;
    
    const date = new Date(sqlDate);
    return !isNaN(date.getTime());
};

/**
 * Obtenir la date courante au format SQL
 * @returns {string} - Date courante YYYY-MM-DD
 */
const getCurrentSQLDate = () => {
    return new Date().toISOString().split('T')[0];
};

/**
 * Calculer la différence en jours entre deux dates
 * @param {string} date1 - Première date
 * @param {string} date2 - Deuxième date
 * @returns {number} - Nombre de jours
 */
const daysDifference = (date1, date2) => {
    const d1 = new Date(toSQLDate(date1));
    const d2 = new Date(toSQLDate(date2));
    
    const diffTime = Math.abs(d2 - d1);
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

/**
 * Vérifier si une date est dans le passé
 * @param {string} dateStr - Date à vérifier
 * @returns {boolean} - true si dans le passé
 */
const isPastDate = (dateStr) => {
    const date = new Date(toSQLDate(dateStr));
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return date < today;
};

/**
 * Vérifier si une date est dans le futur
 * @param {string} dateStr - Date à vérifier
 * @returns {boolean} - true si dans le futur
 */
const isFutureDate = (dateStr) => {
    const date = new Date(toSQLDate(dateStr));
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return date > today;
};

module.exports = {
    toSQLDate,
    formatDate,
    isValidDate,
    getCurrentSQLDate,
    daysDifference,
    isPastDate,
    isFutureDate
};

