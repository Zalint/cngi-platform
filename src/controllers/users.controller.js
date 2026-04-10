const UserModel = require('../models/user.model');
const { validateUserData } = require('../utils/validators');

/**
 * @route   GET /api/users
 * @desc    Récupérer tous les utilisateurs (filtrés selon le rôle)
 * @access  Private
 */
exports.getAllUsers = async (req, res, next) => {
    try {
        let users = await UserModel.findAll();
        
        // Si l'utilisateur n'est pas admin ou directeur, filtrer par sa structure
        if (req.user.role === 'utilisateur' && req.user.structure_id) {
            users = users.filter(u => u.structure_id === req.user.structure_id);
        }
        
        res.json({
            success: true,
            count: users.length,
            data: users
        });
    } catch (error) {
        next(error);
    }
};

/**
 * @route   GET /api/users/:id
 * @desc    Récupérer un utilisateur par ID
 * @access  Private
 */
exports.getUserById = async (req, res, next) => {
    try {
        const user = await UserModel.findById(req.params.id);
        
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
 * @route   POST /api/users
 * @desc    Créer un nouvel utilisateur
 * @access  Private (Admin only)
 */
exports.createUser = async (req, res, next) => {
    try {
        // Validation
        const validation = validateUserData(req.body);
        if (!validation.valid) {
            return res.status(400).json({
                success: false,
                message: 'Données invalides',
                errors: validation.errors
            });
        }
        
        // Vérifier si le username existe déjà
        if (await UserModel.usernameExists(req.body.username)) {
            return res.status(409).json({
                success: false,
                message: 'Ce nom d\'utilisateur existe déjà'
            });
        }
        
        // Vérifier si l'email existe déjà
        if (req.body.email && await UserModel.emailExists(req.body.email)) {
            return res.status(409).json({
                success: false,
                message: 'Cet email existe déjà'
            });
        }
        
        const user = await UserModel.create(req.body);
        
        res.status(201).json({
            success: true,
            message: 'Utilisateur créé avec succès',
            data: user
        });
    } catch (error) {
        next(error);
    }
};

/**
 * @route   PUT /api/users/:id
 * @desc    Mettre à jour un utilisateur
 * @access  Private (Admin only)
 */
exports.updateUser = async (req, res, next) => {
    try {
        // Validation
        const validation = validateUserData(req.body, true);
        if (!validation.valid) {
            return res.status(400).json({
                success: false,
                message: 'Données invalides',
                errors: validation.errors
            });
        }
        
        const user = await UserModel.update(req.params.id, req.body);
        
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'Utilisateur non trouvé'
            });
        }
        
        res.json({
            success: true,
            message: 'Utilisateur mis à jour avec succès',
            data: user
        });
    } catch (error) {
        next(error);
    }
};

/**
 * @route   DELETE /api/users/:id
 * @desc    Supprimer un utilisateur
 * @access  Private (Admin only)
 */
exports.deleteUser = async (req, res, next) => {
    try {
        const user = await UserModel.delete(req.params.id);
        
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'Utilisateur non trouvé'
            });
        }
        
        res.json({
            success: true,
            message: 'Utilisateur supprimé avec succès'
        });
    } catch (error) {
        next(error);
    }
};

/**
 * @route   GET /api/users/structure/:structureId
 * @desc    Récupérer les utilisateurs d'une structure
 * @access  Private
 */
exports.getUsersByStructure = async (req, res, next) => {
    try {
        const users = await UserModel.findByStructure(req.params.structureId);
        
        res.json({
            success: true,
            count: users.length,
            data: users
        });
    } catch (error) {
        next(error);
    }
};

