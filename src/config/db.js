const { Pool } = require('pg');

// Configuration du pool PostgreSQL
const poolConfig = process.env.DATABASE_URL
    ? {
        connectionString: process.env.DATABASE_URL,
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
        ssl: { rejectUnauthorized: false }
    }
    : {
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        database: process.env.DB_NAME,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    };

const pool = new Pool(poolConfig);

// Test de connexion
pool.on('connect', () => {
    if (process.env.NODE_ENV === 'development') {
        console.log('✅ Database connected successfully');
    }
});

pool.on('error', (err) => {
    console.error('❌ Unexpected error on idle client', err);
    process.exit(-1);
});

/**
 * Fonction helper pour exécuter une requête
 * @param {string} text - Requête SQL
 * @param {Array} params - Paramètres de la requête
 * @returns {Promise} - Résultat de la requête
 */
const query = async (text, params) => {
    const start = Date.now();
    try {
        const res = await pool.query(text, params);
        const duration = Date.now() - start;
        
        if (process.env.NODE_ENV === 'development') {
            console.log('📊 Executed query', { text, duration, rows: res.rowCount });
        }
        
        return res;
    } catch (error) {
        console.error('❌ Database query error:', error);
        throw error;
    }
};

/**
 * Obtenir un client pour gérer des transactions
 * @returns {Promise} - Client PostgreSQL
 */
const getClient = async () => {
    const client = await pool.connect();
    const query = client.query;
    const release = client.release;
    
    // Set a timeout of 5 seconds, after which we will log this client's last query
    const timeout = setTimeout(() => {
        console.error('⚠️ A client has been checked out for more than 5 seconds!');
    }, 5000);
    
    // Monkey patch the query method to keep track of the last query executed
    client.query = (...args) => {
        client.lastQuery = args;
        return query.apply(client, args);
    };
    
    // Monkey patch the release method to clear our timeout
    client.release = () => {
        clearTimeout(timeout);
        // Set the query and release methods back to their old un-monkey-patched version
        client.query = query;
        client.release = release;
        return release.apply(client);
    };
    
    return client;
};

module.exports = {
    query,
    getClient,
    pool
};

