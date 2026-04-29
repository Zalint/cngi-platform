const jwt = require('jsonwebtoken');
const UserModel = require('../models/user.model');
const { validateUsername, validatePassword } = require('../utils/validators');

/**
 * Générer un token JWT. Inclut token_version pour permettre la révocation
 * des sessions (cf. UserModel.bumpTokenVersion).
 */
const generateToken = (userId, tokenVersion = 0) => {
    return jwt.sign({ id: userId, tv: tokenVersion }, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRES_IN || '7d'
    });
};

/**
 * @route   POST /api/auth/login
 * @desc    Authentifier un utilisateur
 * @access  Public
 */
exports.login = async (req, res, next) => {
    try {
        const { username, password } = req.body;
        
        // Validation
        if (!username || !password) {
            return res.status(400).json({
                success: false,
                message: 'Veuillez fournir un nom d\'utilisateur et un mot de passe'
            });
        }
        
        // Vérifier si l'utilisateur existe
        const user = await UserModel.findByUsername(username);
        
        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Identifiants incorrects'
            });
        }
        
        // Vérifier si le compte est actif
        if (!user.is_active) {
            return res.status(401).json({
                success: false,
                message: 'Compte désactivé'
            });
        }
        
        // Vérifier le mot de passe
        const isPasswordValid = await UserModel.comparePassword(password, user.password_hash);
        
        if (!isPasswordValid) {
            return res.status(401).json({
                success: false,
                message: 'Identifiants incorrects'
            });
        }
        
        // Mettre à jour la dernière connexion
        await UserModel.updateLastLogin(user.id);
        
        // Générer le token (avec token_version pour révocation)
        const token = generateToken(user.id, user.token_version || 0);
        
        // Supprimer le hash du mot de passe de la réponse
        delete user.password_hash;
        
        res.json({
            success: true,
            message: 'Connexion réussie',
            data: {
                user,
                token
            }
        });
        
    } catch (error) {
        next(error);
    }
};

/**
 * @route   GET /api/auth/me
 * @desc    Récupérer les informations de l'utilisateur connecté
 * @access  Private
 */
exports.getMe = async (req, res, next) => {
    try {
        const user = await UserModel.findById(req.user.id);
        
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'Utilisateur non trouvé'
            });
        }
        
        res.json({
            success: true,
            data: user
        });
        
    } catch (error) {
        next(error);
    }
};

/**
 * @route   POST /api/auth/change-password
 * @desc    Changer le mot de passe de l'utilisateur connecté
 * @access  Private
 */
exports.changePassword = async (req, res, next) => {
    try {
        const { currentPassword, newPassword } = req.body;
        
        if (!currentPassword || !newPassword) {
            return res.status(400).json({
                success: false,
                message: 'Veuillez fournir l\'ancien et le nouveau mot de passe'
            });
        }
        
        // Valider le nouveau mot de passe
        const passwordValidation = validatePassword(newPassword);
        if (!passwordValidation.valid) {
            return res.status(400).json({
                success: false,
                message: passwordValidation.message
            });
        }
        
        // Récupérer l'utilisateur avec le mot de passe
        const user = await UserModel.findByUsername(req.user.username);
        
        // Vérifier l'ancien mot de passe
        const isPasswordValid = await UserModel.comparePassword(currentPassword, user.password_hash);
        
        if (!isPasswordValid) {
            return res.status(401).json({
                success: false,
                message: 'Mot de passe actuel incorrect'
            });
        }
        
        // Mettre à jour le mot de passe ET invalider les autres sessions en une
        // seule requête atomique (évite l'état partiel si la 2e requête échoue).
        const updated = await UserModel.updatePasswordAndBumpVersion(req.user.id, newPassword);
        if (!updated) {
            // Aucune ligne mise à jour = user introuvable / supprimé pendant la
            // requête (race entre `protect` et le UPDATE). Ce n'est pas une
            // erreur serveur : on demande au client de se reconnecter.
            return res.status(401).json({
                success: false,
                message: 'Session invalide, veuillez vous reconnecter'
            });
        }
        const newVersion = updated.token_version;

        // Re-signer un token frais pour la session courante (sinon l'utilisateur
        // serait déconnecté immédiatement après son propre changement de password).
        const freshToken = generateToken(req.user.id, newVersion);

        res.json({
            success: true,
            message: 'Mot de passe modifié. Toutes les autres sessions ont été déconnectées.',
            data: { token: freshToken }
        });
        
    } catch (error) {
        next(error);
    }
};

/**
 * @route   POST /api/auth/logout-all-devices
 * @desc    Invalide toutes les sessions actives de l'utilisateur (incrémente
 *          token_version). L'appareil courant reçoit un token frais pour
 *          rester connecté ; les autres seront déconnectés à leur prochaine
 *          requête.
 * @access  Private
 */
exports.logoutAllDevices = async (req, res, next) => {
    try {
        const newVersion = await UserModel.bumpTokenVersion(req.user.id);
        const freshToken = generateToken(req.user.id, newVersion);
        res.json({
            success: true,
            message: 'Toutes les autres sessions ont été déconnectées.',
            data: { token: freshToken }
        });
    } catch (error) {
        next(error);
    }
};

/**
 * @route   POST /api/auth/logout
 * @desc    Déconnecter l'utilisateur (côté client)
 * @access  Private
 */
exports.logout = async (req, res, next) => {
    try {
        // La déconnexion est gérée côté client en supprimant le token
        // Cette route est optionnelle mais peut être utilisée pour des logs
        
        res.json({
            success: true,
            message: 'Déconnexion réussie'
        });
        
    } catch (error) {
        next(error);
    }
};

