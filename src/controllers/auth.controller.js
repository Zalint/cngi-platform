const jwt = require('jsonwebtoken');
const UserModel = require('../models/user.model');
const { validateUsername, validatePassword } = require('../utils/validators');

/**
 * Générer un token JWT
 */
const generateToken = (userId) => {
    return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
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
        
        // Générer le token
        const token = generateToken(user.id);
        
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
        
        // Mettre à jour le mot de passe
        await UserModel.updatePassword(req.user.id, newPassword);
        
        res.json({
            success: true,
            message: 'Mot de passe modifié avec succès'
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

