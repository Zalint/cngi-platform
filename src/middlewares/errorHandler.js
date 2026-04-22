/**
 * Middleware pour gérer les routes non trouvées (404)
 */
const notFound = (req, res, next) => {
    const error = new Error(`Not Found - ${req.originalUrl}`);
    res.status(404);
    next(error);
};

/**
 * Middleware de gestion centralisée des erreurs
 */
const errorHandler = (err, req, res, next) => {
    // Déterminer le status code (honore err.statusCode si défini par le code applicatif)
    let statusCode = err.statusCode || (res.statusCode === 200 ? 500 : res.statusCode);
    let message = err.message;
    
    // Erreurs spécifiques PostgreSQL
    if (err.code) {
        switch (err.code) {
            case '23505': // Violation de contrainte unique
                statusCode = 409;
                message = 'Cette valeur existe déjà dans la base de données';
                break;
            case '23503': // Violation de clé étrangère
                statusCode = 400;
                message = 'Référence invalide à une ressource inexistante';
                break;
            case '23502': // Violation de NOT NULL
                statusCode = 400;
                message = 'Champ requis manquant';
                break;
            case '22P02': // Type de données invalide
                statusCode = 400;
                message = 'Format de données invalide';
                break;
            default:
                if (process.env.NODE_ENV === 'development') {
                    console.error('PostgreSQL Error Code:', err.code);
                }
        }
    }
    
    // Erreurs JWT
    if (err.name === 'JsonWebTokenError') {
        statusCode = 401;
        message = 'Token invalide';
    }
    
    if (err.name === 'TokenExpiredError') {
        statusCode = 401;
        message = 'Token expiré';
    }
    
    // Erreurs de validation
    if (err.name === 'ValidationError') {
        statusCode = 400;
        message = err.message;
    }
    
    // Réponse d'erreur
    const response = {
        success: false,
        message,
        statusCode
    };
    
    // Ajouter la stack trace en mode développement
    if (process.env.NODE_ENV === 'development') {
        response.stack = err.stack;
        response.error = err;
        console.error('❌ Error:', err);
    }
    
    res.status(statusCode).json(response);
};

module.exports = {
    notFound,
    errorHandler
};

