require('dotenv').config();
const app = require('./app');
const fs = require('fs');
const path = require('path');
const initDatabase = require('../db/init');

const PORT = process.env.PORT || 3000;

// Créer le dossier uploads s'il n'existe pas
const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
    console.log('Created uploads directory');
}

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

