const express = require('express');
const path = require('path');
const multer = require('multer');

// Import routes
const authRoutes = require('./routes/auth.routes');
const usersRoutes = require('./routes/users.routes');
const structuresRoutes = require('./routes/structures.routes');
const formsRoutes = require('./routes/forms.routes');
const projectsRoutes = require('./routes/projects.routes');
const submissionsRoutes = require('./routes/submissions.routes');
const dashboardRoutes = require('./routes/dashboard.routes');
const uploadsRoutes = require('./routes/uploads.routes');
const seedRoutes = require('./routes/seed.routes');
const measureCommentsRoutes = require('./routes/measureComments.routes');
const decoupageRoutes = require('./routes/decoupage.routes');
const configRoutes = require('./routes/config.routes');

// Import middlewares
const { notFound, errorHandler } = require('./middlewares/errorHandler');

const app = express();

// ============================================
// Middlewares de base
// ============================================

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// CORS headers
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    
    // Handle preflight requests
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
});

// Logging middleware (development only)
if (process.env.NODE_ENV === 'development') {
    app.use((req, res, next) => {
        console.log(`${req.method} ${req.url}`);
        next();
    });
}

// ============================================
// Static files
// ============================================

// Désactiver le cache pour les fichiers statiques en développement
if (process.env.NODE_ENV === 'development') {
    app.use((req, res, next) => {
        res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
        res.set('Pragma', 'no-cache');
        res.set('Expires', '0');
        next();
    });
}

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Serve frontend files
app.use(express.static(path.join(__dirname, '../public'), {
    maxAge: process.env.NODE_ENV === 'development' ? 0 : '1d'
}));

// ============================================
// API Routes
// ============================================

app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/structures', structuresRoutes);
app.use('/api/forms', formsRoutes);
app.use('/api/projects', projectsRoutes);
app.use('/api/submissions', submissionsRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/uploads', uploadsRoutes);
app.use('/api/seed', seedRoutes);
app.use('/api', measureCommentsRoutes);
app.use('/api/decoupage', decoupageRoutes);
app.use('/api/config', configRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV
    });
});

// ============================================
// SPA Routing - Serve index.html for all non-API routes
// ============================================

app.get('*', (req, res, next) => {
    // If the request is for an API route that doesn't exist, pass to error handler
    if (req.url.startsWith('/api/')) {
        return next();
    }
    
    // Otherwise serve the SPA
    res.sendFile(path.join(__dirname, '../public/index.html'));
});

// ============================================
// Error Handlers (must be last)
// ============================================

app.use(notFound);
app.use(errorHandler);

module.exports = app;

