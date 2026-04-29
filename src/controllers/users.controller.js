const UserModel = require('../models/user.model');
const db = require('../config/db');
const trackActivity = require('../middlewares/trackActivity');
const { validateUserData } = require('../utils/validators');

/**
 * @route   POST /api/users/:id/force-logout
 * @desc    Force la déconnexion d'un utilisateur (incrémente token_version).
 *          Le user devra se reconnecter à sa prochaine action.
 * @access  Admin
 */
exports.forceLogout = async (req, res, next) => {
    try {
        // Validation stricte : "12abc" doit être rejeté (parseInt l'accepterait).
        if (typeof req.params.id !== 'string' || !/^\d+$/.test(req.params.id)) {
            return res.status(400).json({ success: false, message: 'ID invalide' });
        }
        const targetId = parseInt(req.params.id, 10);
        if (!Number.isSafeInteger(targetId) || targetId <= 0) {
            return res.status(400).json({ success: false, message: 'ID invalide' });
        }
        if (targetId === req.user.id) {
            return res.status(400).json({
                success: false,
                message: 'Utilisez "Déconnecter mes autres appareils" pour votre propre compte.'
            });
        }
        // revokeAllSessions = bump token_version + reset last_activity_at, pour
        // que le user passe immédiatement "hors ligne" dans la liste admin
        // (sinon il reste affiché "en ligne" tant que les 5 min de seuil
        // d'activité ne sont pas écoulées, ce qui est trompeur).
        const newVersion = await UserModel.revokeAllSessions(targetId);
        if (newVersion === null) {
            return res.status(404).json({ success: false, message: 'Utilisateur non trouvé' });
        }
        // Purge l'entrée du throttle pour que sa prochaine activité (post
        // reconnexion) soit écrite immédiatement, sans attendre la fenêtre de 1 min.
        trackActivity.clearUser(targetId);
        res.json({
            success: true,
            message: 'Sessions de l\'utilisateur révoquées'
        });
    } catch (error) {
        next(error);
    }
};

/**
 * @route   GET /api/users/active-sessions
 * @desc    Liste les utilisateurs avec leur activité récente (admin uniquement).
 *          "En ligne" = activité dans les 5 dernières minutes.
 * @access  Admin
 */
exports.getActiveSessions = async (req, res, next) => {
    try {
        const onlineThresholdMin = Math.max(1, Math.min(60, parseInt(req.query.online_minutes, 10) || 5));

        const result = await db.query(`
            SELECT u.id, u.username, u.first_name, u.last_name, u.email, u.role, u.title,
                   u.is_active, u.last_login, u.last_activity_at,
                   s.code as structure_code, s.name as structure_name,
                   (u.last_activity_at IS NOT NULL
                    AND u.last_activity_at > NOW() - ($1 || ' minutes')::interval) as is_online
            FROM users u
            LEFT JOIN structures s ON u.structure_id = s.id
            WHERE u.is_active = true
            ORDER BY
                CASE WHEN u.last_activity_at IS NULL THEN 1 ELSE 0 END,
                u.last_activity_at DESC NULLS LAST,
                u.last_login DESC NULLS LAST
        `, [String(onlineThresholdMin)]);

        const now = Date.now();
        const users = result.rows.map(r => ({
            id: r.id,
            username: r.username,
            nom_complet: [r.first_name, r.last_name].filter(Boolean).join(' ') || r.username,
            first_name: r.first_name,
            last_name: r.last_name,
            email: r.email,
            title: r.title,
            role: r.role,
            structure_code: r.structure_code,
            structure_name: r.structure_name,
            last_login: r.last_login,
            last_activity_at: r.last_activity_at,
            is_online: r.is_online,
            seconds_since_activity: r.last_activity_at
                ? Math.round((now - new Date(r.last_activity_at).getTime()) / 1000)
                : null
        }));

        const stats = {
            total: users.length,
            online: users.filter(u => u.is_online).length,
            active_24h: users.filter(u => u.last_activity_at &&
                (now - new Date(u.last_activity_at).getTime()) < 24 * 3600 * 1000).length,
            active_7d: users.filter(u => u.last_activity_at &&
                (now - new Date(u.last_activity_at).getTime()) < 7 * 24 * 3600 * 1000).length,
            never_logged: users.filter(u => !u.last_login).length
        };

        res.json({
            success: true,
            online_threshold_minutes: onlineThresholdMin,
            stats,
            count: users.length,
            data: users
        });
    } catch (error) {
        next(error);
    }
};

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

