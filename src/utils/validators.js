const { isValidDate } = require('./dateHelpers');

/**
 * Valider un email
 * @param {string} email - Email à valider
 * @returns {boolean} - true si valide
 */
const isValidEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
};

/**
 * Valider un mot de passe
 * @param {string} password - Mot de passe à valider
 * @returns {object} - { valid: boolean, message: string }
 */
/**
 * Règles de robustesse du mot de passe.
 * Contraintes :
 *   - au moins 8 caractères
 *   - au moins 1 majuscule
 *   - au moins 1 minuscule
 *   - au moins 1 chiffre
 * Un caractère spécial est encouragé mais non obligatoire, pour ne pas bloquer
 * les claviers locaux qui ont une disposition différente.
 */
const PASSWORD_RULES = [
    { key: 'minLength',  test: (p) => p.length >= 8,     label: 'Au moins 8 caractères' },
    { key: 'upperCase',  test: (p) => /[A-Z]/.test(p),   label: 'Au moins une majuscule (A-Z)' },
    { key: 'lowerCase',  test: (p) => /[a-z]/.test(p),   label: 'Au moins une minuscule (a-z)' },
    { key: 'digit',      test: (p) => /[0-9]/.test(p),   label: 'Au moins un chiffre (0-9)' }
];

const validatePassword = (password) => {
    if (!password) {
        return { valid: false, message: 'Mot de passe requis', failed: [] };
    }
    const failed = PASSWORD_RULES.filter(r => !r.test(password)).map(r => r.label);
    if (failed.length > 0) {
        return {
            valid: false,
            message: 'Le mot de passe ne respecte pas les règles : ' + failed.join(' · '),
            failed
        };
    }
    return { valid: true, message: 'Mot de passe valide', failed: [] };
};

/**
 * Valider un nom d'utilisateur
 * @param {string} username - Nom d'utilisateur à valider
 * @returns {object} - { valid: boolean, message: string }
 */
const validateUsername = (username) => {
    if (!username) {
        return { valid: false, message: 'Nom d\'utilisateur requis' };
    }
    
    if (username.length < 3) {
        return { valid: false, message: 'Nom d\'utilisateur doit contenir au moins 3 caractères' };
    }
    
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
        return { valid: false, message: 'Nom d\'utilisateur ne peut contenir que des lettres, chiffres et underscores' };
    }
    
    return { valid: true, message: 'Nom d\'utilisateur valide' };
};

/**
 * Valider un rôle utilisateur
 * @param {string} role - Rôle à valider
 * @returns {boolean} - true si valide
 */
const isValidRole = (role) => {
    const validRoles = ['admin', 'utilisateur', 'directeur', 'superviseur', 'commandement_territorial', 'lecteur', 'auditeur'];
    return validRoles.includes(role);
};

/**
 * Valider un statut de projet
 * @param {string} status - Statut à valider
 * @returns {boolean} - true si valide
 */
const isValidProjectStatus = (status) => {
    const validStatuses = ['demarrage', 'en_cours', 'termine', 'retard', 'annule'];
    return validStatuses.includes(status);
};

/**
 * Valider un pourcentage
 * @param {number} percentage - Pourcentage à valider
 * @returns {boolean} - true si valide
 */
const isValidPercentage = (percentage) => {
    return typeof percentage === 'number' && percentage >= 0 && percentage <= 100;
};

/**
 * Valider les données d'un projet (pour création)
 * @param {object} projectData - Données du projet
 * @returns {object} - { valid: boolean, errors: array }
 */
const VALID_PRIORITIES = ['normale', 'haute', 'urgente'];
const VALID_PROJECT_TYPES = ['renforcement_resilience', 'structurant'];

const validateProjectData = (projectData) => {
    const errors = [];

    if (!projectData.title || projectData.title.trim() === '') {
        errors.push('Titre du projet requis');
    }

    if (!projectData.structure_id) {
        errors.push('Structure requise');
    }

    if (projectData.status && !isValidProjectStatus(projectData.status)) {
        errors.push('Statut invalide');
    }

    if (projectData.progress_percentage !== undefined && !isValidPercentage(projectData.progress_percentage)) {
        errors.push('Pourcentage d\'avancement invalide (0-100)');
    }

    if (projectData.start_date && !isValidDate(projectData.start_date)) {
        errors.push('Date de début invalide');
    }

    if (projectData.end_date && !isValidDate(projectData.end_date)) {
        errors.push('Date de fin invalide');
    }

    if (projectData.deadline_date && !isValidDate(projectData.deadline_date)) {
        errors.push('Date d\'échéance invalide');
    }

    if (projectData.priority && !VALID_PRIORITIES.includes(projectData.priority)) {
        errors.push('Priorité invalide (normale, haute, urgente)');
    }

    if (projectData.project_type && !VALID_PROJECT_TYPES.includes(projectData.project_type)) {
        errors.push('Type de projet invalide');
    }

    return {
        valid: errors.length === 0,
        errors
    };
};

/**
 * Valider les données d'un projet (pour mise à jour partielle)
 * @param {object} projectData - Données du projet
 * @returns {object} - { valid: boolean, errors: array }
 */
const validateProjectDataForUpdate = (projectData) => {
    const errors = [];
    
    // Pour une mise à jour, les champs ne sont validés que s'ils sont présents
    if (projectData.title !== undefined && projectData.title.trim() === '') {
        errors.push('Titre du projet ne peut pas être vide');
    }
    
    if (projectData.status !== undefined && !isValidProjectStatus(projectData.status)) {
        errors.push('Statut invalide');
    }
    
    if (projectData.progress_percentage !== undefined && !isValidPercentage(projectData.progress_percentage)) {
        errors.push('Pourcentage d\'avancement invalide (0-100)');
    }
    
    if (projectData.start_date !== undefined && projectData.start_date !== null && !isValidDate(projectData.start_date)) {
        errors.push('Date de début invalide');
    }
    
    if (projectData.end_date !== undefined && projectData.end_date !== null && !isValidDate(projectData.end_date)) {
        errors.push('Date de fin invalide');
    }
    
    if (projectData.deadline_date !== undefined && projectData.deadline_date !== null && !isValidDate(projectData.deadline_date)) {
        errors.push('Date d\'échéance invalide');
    }

    if (projectData.priority !== undefined && projectData.priority !== null && !VALID_PRIORITIES.includes(projectData.priority)) {
        errors.push('Priorité invalide (normale, haute, urgente)');
    }

    if (projectData.project_type !== undefined && projectData.project_type !== null && projectData.project_type !== '' && !VALID_PROJECT_TYPES.includes(projectData.project_type)) {
        errors.push('Type de projet invalide');
    }

    return {
        valid: errors.length === 0,
        errors
    };
};

/**
 * Valider les données d'un utilisateur
 * @param {object} userData - Données de l'utilisateur
 * @param {boolean} isUpdate - Si c'est une mise à jour (password optionnel)
 * @returns {object} - { valid: boolean, errors: array }
 */
const validateUserData = (userData, isUpdate = false) => {
    const errors = [];
    
    if (!isUpdate || userData.username) {
        const usernameValidation = validateUsername(userData.username);
        if (!usernameValidation.valid) {
            errors.push(usernameValidation.message);
        }
    }
    
    if (!isUpdate && userData.password) {
        const passwordValidation = validatePassword(userData.password);
        if (!passwordValidation.valid) {
            errors.push(passwordValidation.message);
        }
    }
    
    if (userData.email && !isValidEmail(userData.email)) {
        errors.push('Email invalide');
    }
    
    if (!isUpdate && !userData.role) {
        errors.push('Rôle requis');
    }
    
    if (userData.role && !isValidRole(userData.role)) {
        errors.push('Rôle invalide (admin, utilisateur, directeur)');
    }
    
    return {
        valid: errors.length === 0,
        errors
    };
};

/**
 * Valider les données d'une structure
 * @param {object} structureData - Données de la structure
 * @returns {object} - { valid: boolean, errors: array }
 */
const validateStructureData = (structureData) => {
    const errors = [];
    
    if (!structureData.name || structureData.name.trim() === '') {
        errors.push('Nom de la structure requis');
    }
    
    if (!structureData.code || structureData.code.trim() === '') {
        errors.push('Code de la structure requis');
    }
    
    if (structureData.code && !/^[A-Z0-9]+$/.test(structureData.code)) {
        errors.push('Code doit contenir uniquement des lettres majuscules et chiffres');
    }
    
    return {
        valid: errors.length === 0,
        errors
    };
};

/**
 * Sanitize une chaîne de caractères (prévenir XSS)
 * @param {string} str - Chaîne à nettoyer
 * @returns {string} - Chaîne nettoyée
 */
const sanitizeString = (str) => {
    if (typeof str !== 'string') return str;
    
    return str
        .replace(/[<>]/g, '')
        .trim();
};

module.exports = {
    isValidEmail,
    validatePassword,
    validateUsername,
    isValidRole,
    isValidProjectStatus,
    isValidPercentage,
    validateProjectData,
    validateProjectDataForUpdate,
    validateUserData,
    PASSWORD_RULES,
    validateStructureData,
    sanitizeString
};

