const jwt = require('jsonwebtoken');
const db = require('../config/db');
const trackActivity = require('./trackActivity');

/**
 * Middleware pour vérifier le token JWT
 */
const protect = async (req, res, next) => {
    let token;
    
    // Vérifier si le token existe dans le header Authorization
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            // Extraire le token
            token = req.headers.authorization.split(' ')[1];
            
            // Vérifier le token
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            
            // Récupérer l'utilisateur depuis la base de données
            const result = await db.query(
                `SELECT u.id, u.username, u.email, u.first_name, u.last_name, u.role, u.structure_id, u.is_active,
                        u.territorial_level, u.territorial_value, u.token_version,
                        s.name as structure_name, s.code as structure_code
                 FROM users u
                 LEFT JOIN structures s ON u.structure_id = s.id
                 WHERE u.id = $1`,
                [decoded.id]
            );
            
            if (result.rows.length === 0) {
                return res.status(401).json({
                    success: false,
                    message: 'Utilisateur non trouvé'
                });
            }
            
            const user = result.rows[0];
            
            // Vérifier si l'utilisateur est actif
            if (!user.is_active) {
                return res.status(401).json({
                    success: false,
                    message: 'Compte désactivé'
                });
            }

            // Vérifier que le token n'a pas été révoqué (force-logout, changement
            // de mot de passe, déconnexion tous appareils). Tokens anciens sans
            // 'tv' sont traités comme version 0 (compat ascendante).
            const tokenVersion = decoded.tv ?? 0;
            const currentVersion = user.token_version ?? 0;
            if (tokenVersion !== currentVersion) {
                return res.status(401).json({
                    success: false,
                    message: 'Session révoquée, veuillez vous reconnecter'
                });
            }
            
            // Ajouter l'utilisateur à la requête
            req.user = user;

            // Tracker l'activité (throttled 1/min/user, fire-and-forget)
            return trackActivity(req, res, next);
            
        } catch (error) {
            console.error('Auth middleware error:', error);
            return res.status(401).json({
                success: false,
                message: 'Token invalide ou expiré'
            });
        }
    } else {
        return res.status(401).json({
            success: false,
            message: 'Pas de token, accès refusé'
        });
    }
};

/**
 * Middleware pour vérifier les rôles
 * @param  {...string} roles - Rôles autorisés
 */
const authorize = (...roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: 'Non authentifié'
            });
        }
        
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                message: `Accès refusé. Rôle requis: ${roles.join(', ')}`
            });
        }
        
        next();
    };
};

/**
 * Middleware pour vérifier l'accès à une structure
 * Utilisateur peut accéder seulement à sa structure
 * Admin peut accéder à toutes les structures
 */
const checkStructureAccess = async (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({
            success: false,
            message: 'Non authentifié'
        });
    }
    
    // Admin a accès à tout
    if (req.user.role === 'admin') {
        return next();
    }
    
    // Pour les autres, vérifier la structure
    const structureId = req.params.structureId || req.body.structure_id || req.query.structure_id;
    
    if (structureId && parseInt(structureId) !== req.user.structure_id) {
        return res.status(403).json({
            success: false,
            message: 'Accès refusé à cette structure'
        });
    }
    
    next();
};

module.exports = {
    protect,
    authorize,
    checkStructureAccess
};

