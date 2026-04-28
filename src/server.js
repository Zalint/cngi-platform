require('dotenv').config();
const app = require('./app');
const initDatabase = require('../db/init');
const storage = require('./config/storage');

const PORT = process.env.PORT || 3000;

// Initialise le backend de stockage des uploads (création du dossier en mode
// disk, vérification du bucket en mode r2). Voir src/config/storage.js.
storage.init();

// Initialiser la base de données puis démarrer le serveur
initDatabase().then(() => {
    const server = app.listen(PORT, () => {
        console.log('');
        console.log('================================');
        console.log(`CNGI Platform Server Running`);
        console.log(`Environment: ${process.env.NODE_ENV}`);
        console.log(`Port: ${PORT}`);
        console.log(`URL: http://localhost:${PORT}`);
        console.log('================================');
        console.log('');
    });

    // Gestion des erreurs non capturées
    process.on('unhandledRejection', (err) => {
        console.error('UNHANDLED REJECTION! Shutting down...');
        console.error(err.name, err.message);
        server.close(() => {
            process.exit(1);
        });
    });

    process.on('SIGTERM', () => {
        console.log('SIGTERM received. Shutting down gracefully...');
        server.close(() => {
            console.log('Process terminated');
        });
    });
}).catch((err) => {
    console.error('Failed to initialize database:', err);
    process.exit(1);
});

process.on('uncaughtException', (err) => {
    console.error('UNCAUGHT EXCEPTION! Shutting down...');
    console.error(err.name, err.message);
    process.exit(1);
});

