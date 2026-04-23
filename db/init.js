const { pool } = require('../src/config/db');

/**
 * Initialise le schéma de la base de données au démarrage.
 * Utilise IF NOT EXISTS pour ne pas écraser les données existantes.
 */
async function initDatabase() {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Structures
        await client.query(`
            CREATE TABLE IF NOT EXISTS structures (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL UNIQUE,
                code VARCHAR(50) NOT NULL UNIQUE,
                description TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_structures_code ON structures(code)`);

        // Migration idempotente : corrige un ancien libellé erroné pour DPGI
        // ("Direction de la Planification..." → "Direction de la Prévention...")
        await client.query(`
            UPDATE structures
            SET name = 'Direction de la Prévention et de la Gestion des Inondations',
                description = 'Direction en charge de la prévention et coordination'
            WHERE code = 'DPGI'
              AND name <> 'Direction de la Prévention et de la Gestion des Inondations'
        `);

        // Users
        await client.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                username VARCHAR(100) NOT NULL UNIQUE,
                password_hash VARCHAR(255) NOT NULL,
                email VARCHAR(255) UNIQUE,
                first_name VARCHAR(100),
                last_name VARCHAR(100),
                role VARCHAR(50) NOT NULL CHECK (role IN ('admin', 'utilisateur', 'directeur', 'superviseur', 'commandement_territorial')),
                structure_id INTEGER REFERENCES structures(id) ON DELETE SET NULL,
                territorial_level VARCHAR(20),
                territorial_value VARCHAR(100),
                title VARCHAR(150),
                is_active BOOLEAN DEFAULT true,
                last_login TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        // Migration: update role CHECK constraint for existing DBs
        await client.query(`
            DO $$ BEGIN
                ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
                ALTER TABLE users ADD CONSTRAINT users_role_check
                    CHECK (role IN ('admin', 'utilisateur', 'directeur', 'superviseur', 'commandement_territorial'));
                ALTER TABLE users ADD COLUMN IF NOT EXISTS territorial_level VARCHAR(20);
                ALTER TABLE users ADD COLUMN IF NOT EXISTS territorial_value VARCHAR(100);
                ALTER TABLE users ADD COLUMN IF NOT EXISTS title VARCHAR(150);
            EXCEPTION WHEN others THEN NULL;
            END $$
        `);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_users_role ON users(role)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_users_structure ON users(structure_id)`);

        // Forms
        await client.query(`
            CREATE TABLE IF NOT EXISTS forms (
                id SERIAL PRIMARY KEY,
                title VARCHAR(255) NOT NULL,
                description TEXT,
                schema JSONB NOT NULL,
                assigned_to_structure_id INTEGER REFERENCES structures(id) ON DELETE CASCADE,
                is_active BOOLEAN DEFAULT true,
                created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_forms_structure ON forms(assigned_to_structure_id)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_forms_active ON forms(is_active)`);

        // Projects
        await client.query(`
            CREATE TABLE IF NOT EXISTS projects (
                id SERIAL PRIMARY KEY,
                title VARCHAR(255) NOT NULL,
                description TEXT,
                structure_id INTEGER REFERENCES structures(id) ON DELETE CASCADE,
                project_manager_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                status VARCHAR(50) DEFAULT 'demarrage' CHECK (status IN ('demarrage', 'en_cours', 'termine', 'retard', 'annule')),
                progress_percentage INTEGER DEFAULT 0 CHECK (progress_percentage >= 0 AND progress_percentage <= 100),
                start_date DATE,
                end_date DATE,
                deadline_date DATE,
                budget DECIMAL(15, 2),
                created_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_projects_structure ON projects(structure_id)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_projects_created_by ON projects(created_by_user_id)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_projects_manager ON projects(project_manager_id)`);

        // Migration: new columns on projects (constraints, expected_measures, priority, project_type)
        await client.query(`
            DO $$ BEGIN
                ALTER TABLE projects ADD COLUMN IF NOT EXISTS constraints TEXT;
                ALTER TABLE projects ADD COLUMN IF NOT EXISTS expected_measures TEXT;
                ALTER TABLE projects ADD COLUMN IF NOT EXISTS priority VARCHAR(20) DEFAULT 'normale';
                ALTER TABLE projects ADD COLUMN IF NOT EXISTS project_type VARCHAR(50);
                ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_priority_check;
                ALTER TABLE projects ADD CONSTRAINT projects_priority_check
                    CHECK (priority IN ('normale', 'haute', 'urgente'));
                ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_project_type_check;
                ALTER TABLE projects ADD CONSTRAINT projects_project_type_check
                    CHECK (project_type IS NULL OR project_type IN ('renforcement_resilience', 'structurant'));
            EXCEPTION WHEN others THEN NULL;
            END $$
        `);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_projects_priority ON projects(priority)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_projects_type ON projects(project_type)`);

        // Project Structures
        await client.query(`
            CREATE TABLE IF NOT EXISTS project_structures (
                project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
                structure_id INTEGER NOT NULL REFERENCES structures(id) ON DELETE CASCADE,
                assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                assigned_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                PRIMARY KEY (project_id, structure_id)
            )
        `);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_project_structures_project ON project_structures(project_id)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_project_structures_structure ON project_structures(structure_id)`);

        // Decoupage administratif du Sénégal
        await client.query(`
            CREATE TABLE IF NOT EXISTS decoupage (
                id SERIAL PRIMARY KEY,
                region VARCHAR(100) NOT NULL,
                departement VARCHAR(100) NOT NULL,
                arrondissement VARCHAR(100) NOT NULL,
                commune VARCHAR(150) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(region, departement, arrondissement, commune)
            )
        `);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_decoupage_region ON decoupage(region)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_decoupage_dept ON decoupage(departement)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_decoupage_arrond ON decoupage(arrondissement)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_decoupage_commune ON decoupage(commune)`);

        // Localities
        await client.query(`
            CREATE TABLE IF NOT EXISTS localities (
                id SERIAL PRIMARY KEY,
                project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
                region VARCHAR(100),
                departement VARCHAR(100),
                arrondissement VARCHAR(100),
                commune VARCHAR(150),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        // Add arrondissement column if missing (migration)
        await client.query(`
            DO $$ BEGIN
                ALTER TABLE localities ADD COLUMN IF NOT EXISTS arrondissement VARCHAR(100);
            EXCEPTION WHEN duplicate_column THEN NULL;
            END $$
        `);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_localities_project ON localities(project_id)`);

        // Sites
        await client.query(`
            CREATE TABLE IF NOT EXISTS sites (
                id SERIAL PRIMARY KEY,
                project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
                locality_id INTEGER REFERENCES localities(id) ON DELETE SET NULL,
                name VARCHAR(255) NOT NULL,
                description TEXT,
                region VARCHAR(100),
                departement VARCHAR(100),
                arrondissement VARCHAR(100),
                commune VARCHAR(150),
                latitude DECIMAL(10, 8),
                longitude DECIMAL(11, 8),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        // Add location columns if missing (migration)
        await client.query(`
            DO $$ BEGIN
                ALTER TABLE sites ADD COLUMN IF NOT EXISTS region VARCHAR(100);
                ALTER TABLE sites ADD COLUMN IF NOT EXISTS departement VARCHAR(100);
                ALTER TABLE sites ADD COLUMN IF NOT EXISTS arrondissement VARCHAR(100);
                ALTER TABLE sites ADD COLUMN IF NOT EXISTS commune VARCHAR(150);
                ALTER TABLE sites ADD COLUMN IF NOT EXISTS is_pcs BOOLEAN DEFAULT false;
                ALTER TABLE sites ADD COLUMN IF NOT EXISTS vulnerability_level VARCHAR(20) DEFAULT 'normal';
            EXCEPTION WHEN duplicate_column THEN NULL;
            END $$;
            UPDATE sites SET vulnerability_level = 'normal' WHERE vulnerability_level IS NULL;
            ALTER TABLE sites ALTER COLUMN vulnerability_level SET NOT NULL;
            ALTER TABLE sites ALTER COLUMN vulnerability_level SET DEFAULT 'normal';
            DO $$ BEGIN
                ALTER TABLE sites ADD CONSTRAINT sites_vuln_chk CHECK (vulnerability_level IN ('normal','elevee','tres_elevee'));
            EXCEPTION WHEN duplicate_object THEN NULL;
            END $$
        `);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_sites_project ON sites(project_id)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_sites_locality ON sites(locality_id)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_sites_coordinates ON sites(latitude, longitude)`);

        // Measures
        await client.query(`
            CREATE TABLE IF NOT EXISTS measures (
                id SERIAL PRIMARY KEY,
                project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
                site_id INTEGER REFERENCES sites(id) ON DELETE SET NULL,
                assigned_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                description TEXT NOT NULL,
                type VARCHAR(100),
                status VARCHAR(50) DEFAULT 'preconisee' CHECK (status IN ('preconisee', 'executee', 'non_executee', 'observations')),
                constraints TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_measures_project ON measures(project_id)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_measures_site ON measures(site_id)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_measures_status ON measures(status)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_measures_assigned_user ON measures(assigned_user_id)`);

        // Migration: add structure_id on measures (reassign action to another structure)
        await client.query(`
            DO $$ BEGIN
                ALTER TABLE measures ADD COLUMN IF NOT EXISTS structure_id INTEGER REFERENCES structures(id) ON DELETE SET NULL;
            EXCEPTION WHEN others THEN NULL;
            END $$
        `);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_measures_structure ON measures(structure_id)`);

        // Measure Comments
        await client.query(`
            CREATE TABLE IF NOT EXISTS measure_comments (
                id SERIAL PRIMARY KEY,
                measure_id INTEGER NOT NULL REFERENCES measures(id) ON DELETE CASCADE,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                comment TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_measure_comments_measure ON measure_comments(measure_id)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_measure_comments_user ON measure_comments(user_id)`);

        // Stakeholders
        await client.query(`
            CREATE TABLE IF NOT EXISTS stakeholders (
                id SERIAL PRIMARY KEY,
                project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
                name VARCHAR(255) NOT NULL,
                type VARCHAR(100),
                contact_name VARCHAR(255),
                contact_email VARCHAR(255),
                contact_phone VARCHAR(50),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_stakeholders_project ON stakeholders(project_id)`);

        // Financing
        await client.query(`
            CREATE TABLE IF NOT EXISTS financing (
                id SERIAL PRIMARY KEY,
                project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
                amount DECIMAL(15, 2),
                currency VARCHAR(10) DEFAULT 'FCFA',
                source VARCHAR(255),
                availability VARCHAR(50) CHECK (availability IN ('disponible', 'non_disponible', 'partiel')),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_financing_project ON financing(project_id)`);

        // Uploads
        await client.query(`
            CREATE TABLE IF NOT EXISTS uploads (
                id SERIAL PRIMARY KEY,
                filename VARCHAR(255) NOT NULL,
                original_filename VARCHAR(255) NOT NULL,
                path VARCHAR(500) NOT NULL,
                mime_type VARCHAR(100),
                size INTEGER,
                entity_type VARCHAR(50),
                entity_id INTEGER,
                uploaded_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_uploads_entity ON uploads(entity_type, entity_id)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_uploads_user ON uploads(uploaded_by_user_id)`);
        await client.query(`
            DO $$ BEGIN
                ALTER TABLE uploads ADD COLUMN IF NOT EXISTS label VARCHAR(255);
            EXCEPTION WHEN duplicate_column THEN NULL;
            END $$
        `);

        // App Config (configurable dropdowns)
        await client.query(`
            CREATE TABLE IF NOT EXISTS app_config (
                id SERIAL PRIMARY KEY,
                category VARCHAR(50) NOT NULL,
                value VARCHAR(100) NOT NULL,
                label VARCHAR(150) NOT NULL,
                sort_order INTEGER DEFAULT 0,
                is_active BOOLEAN DEFAULT true,
                UNIQUE(category, value)
            )
        `);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_app_config_category ON app_config(category)`);

        // Observations du Superviseur (Ministre) — directives adressées à tous
        await client.query(`
            CREATE TABLE IF NOT EXISTS observations (
                id SERIAL PRIMARY KEY,
                author_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
                title VARCHAR(200) NOT NULL,
                content TEXT NOT NULL,
                priority VARCHAR(20) DEFAULT 'info' CHECK (priority IN ('info', 'importante', 'urgente')),
                deadline DATE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_observations_author ON observations(author_id)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_observations_project ON observations(project_id)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_observations_created ON observations(created_at DESC)`);

        // Suivi de lecture (pour le badge de non-lues)
        await client.query(`
            CREATE TABLE IF NOT EXISTS observation_views (
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                last_viewed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (user_id)
            )
        `);

        // PV de visite du Commandement Territorial (compte-rendu de visite)
        await client.query(`
            CREATE TABLE IF NOT EXISTS pv_reports (
                id SERIAL PRIMARY KEY,
                author_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                territorial_level VARCHAR(20) NOT NULL CHECK (territorial_level IN ('region', 'departement', 'arrondissement')),
                territorial_value VARCHAR(100) NOT NULL,
                visit_date DATE,
                title VARCHAR(200) NOT NULL,
                avancement TEXT,
                observations TEXT,
                recommendations TEXT,
                content TEXT,
                priority VARCHAR(20) DEFAULT 'info' CHECK (priority IN ('info', 'importante', 'urgente')),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_pv_reports_author ON pv_reports(author_id)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_pv_reports_territory ON pv_reports(territorial_level, territorial_value)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_pv_reports_created ON pv_reports(created_at DESC)`);

        // Références optionnelles vers projets/mesures/sites/localités
        await client.query(`
            CREATE TABLE IF NOT EXISTS pv_projects (
                pv_id INTEGER NOT NULL REFERENCES pv_reports(id) ON DELETE CASCADE,
                project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
                PRIMARY KEY (pv_id, project_id)
            )
        `);
        await client.query(`
            CREATE TABLE IF NOT EXISTS pv_measures (
                pv_id INTEGER NOT NULL REFERENCES pv_reports(id) ON DELETE CASCADE,
                measure_id INTEGER NOT NULL REFERENCES measures(id) ON DELETE CASCADE,
                PRIMARY KEY (pv_id, measure_id)
            )
        `);
        await client.query(`
            CREATE TABLE IF NOT EXISTS pv_sites (
                pv_id INTEGER NOT NULL REFERENCES pv_reports(id) ON DELETE CASCADE,
                site_id INTEGER NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
                PRIMARY KEY (pv_id, site_id)
            )
        `);
        await client.query(`
            CREATE TABLE IF NOT EXISTS pv_localities (
                pv_id INTEGER NOT NULL REFERENCES pv_reports(id) ON DELETE CASCADE,
                locality_id INTEGER NOT NULL REFERENCES localities(id) ON DELETE CASCADE,
                PRIMARY KEY (pv_id, locality_id)
            )
        `);

        // Suivi de lecture par PV (granularité fine — permet le sticker par item)
        await client.query(`
            CREATE TABLE IF NOT EXISTS pv_reads (
                pv_id INTEGER NOT NULL REFERENCES pv_reports(id) ON DELETE CASCADE,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                read_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (pv_id, user_id)
            )
        `);

        // API Keys (authentification de l'API externe v1)
        await client.query(`
            CREATE TABLE IF NOT EXISTS api_keys (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                key_hash VARCHAR(128) NOT NULL UNIQUE,
                key_prefix VARCHAR(20) NOT NULL,
                label VARCHAR(100),
                is_active BOOLEAN DEFAULT true,
                last_used_at TIMESTAMP,
                expires_at TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(key_hash)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_api_keys_user ON api_keys(user_id)`);

        // Project Comments
        await client.query(`
            CREATE TABLE IF NOT EXISTS project_comments (
                id SERIAL PRIMARY KEY,
                project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                comment TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_project_comments_project ON project_comments(project_id)`);

        // Trigger function
        await client.query(`
            CREATE OR REPLACE FUNCTION update_updated_at_column()
            RETURNS TRIGGER AS $$
            BEGIN
                NEW.updated_at = CURRENT_TIMESTAMP;
                RETURN NEW;
            END;
            $$ language 'plpgsql'
        `);

        // Triggers (DROP + CREATE to avoid errors)
        const triggers = [
            { name: 'update_structures_updated_at', table: 'structures' },
            { name: 'update_users_updated_at', table: 'users' },
            { name: 'update_forms_updated_at', table: 'forms' },
            { name: 'update_projects_updated_at', table: 'projects' }
        ];
        for (const t of triggers) {
            await client.query(`DROP TRIGGER IF EXISTS ${t.name} ON ${t.table}`);
            await client.query(`
                CREATE TRIGGER ${t.name} BEFORE UPDATE ON ${t.table}
                FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()
            `);
        }

        // Views (drop first to handle column changes)
        await client.query(`DROP VIEW IF EXISTS dashboard_stats CASCADE`);
        await client.query(`DROP VIEW IF EXISTS projects_view CASCADE`);

        await client.query(`
            CREATE OR REPLACE VIEW dashboard_stats AS
            SELECT
                (SELECT COUNT(*) FROM projects WHERE status = 'en_cours') as actions_en_cours,
                (SELECT COUNT(*) FROM projects WHERE status = 'termine') as actions_terminees,
                (SELECT COUNT(*) FROM projects WHERE status = 'retard') as actions_retard,
                (SELECT COUNT(DISTINCT structure_id) FROM projects) as structures_actives,
                (SELECT COUNT(*) FROM stakeholders) as total_intervenants
        `);

        await client.query(`
            CREATE OR REPLACE VIEW projects_view AS
            SELECT
                p.*,
                s.name as structure_name,
                s.code as structure_code,
                u.username as creator_username,
                u.first_name as creator_first_name,
                u.last_name as creator_last_name,
                (SELECT COUNT(*) FROM sites WHERE project_id = p.id) as sites_count,
                (SELECT COUNT(*) FROM measures WHERE project_id = p.id) as measures_count
            FROM projects p
            LEFT JOIN structures s ON p.structure_id = s.id
            LEFT JOIN users u ON p.created_by_user_id = u.id
        `);

        await client.query('COMMIT');
        console.log('Database schema initialized successfully');

        // Seed config and decoupage data
        await seedConfig(pool);
        await seedDecoupage(pool);

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Database initialization failed:', error);
        throw error;
    } finally {
        client.release();
    }
}

async function seedConfig(pool) {
    const count = await pool.query('SELECT COUNT(*) FROM app_config');
    if (parseInt(count.rows[0].count) > 0) return;

    console.log('Seeding app config...');
    const configs = [
        // Measure types
        { category: 'measure_type', value: 'Pompage', label: 'Pompage', sort_order: 1 },
        { category: 'measure_type', value: 'Nettoyage', label: 'Nettoyage', sort_order: 2 },
        { category: 'measure_type', value: 'Curage', label: 'Curage', sort_order: 3 },
        { category: 'measure_type', value: 'Equipement', label: 'Équipement', sort_order: 4 },
        { category: 'measure_type', value: 'Organisation', label: 'Organisation', sort_order: 5 },
        { category: 'measure_type', value: 'Construction', label: 'Construction', sort_order: 6 },
        { category: 'measure_type', value: 'Rehabilitation', label: 'Réhabilitation', sort_order: 7 },
        { category: 'measure_type', value: 'Autre', label: 'Autre', sort_order: 99 },
        // Measure statuses
        { category: 'measure_status', value: 'preconisee', label: 'Préconisée', sort_order: 1 },
        { category: 'measure_status', value: 'executee', label: 'Exécutée', sort_order: 2 },
        { category: 'measure_status', value: 'non_executee', label: 'Non exécutée', sort_order: 3 },
        { category: 'measure_status', value: 'observations', label: 'Observations', sort_order: 4 },
    ];

    for (const c of configs) {
        await pool.query(
            `INSERT INTO app_config (category, value, label, sort_order) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING`,
            [c.category, c.value, c.label, c.sort_order]
        );
    }
    console.log(`App config: ${configs.length} entries inserted`);
}

async function seedDecoupage(pool) {
    const count = await pool.query('SELECT COUNT(*) FROM decoupage');
    if (parseInt(count.rows[0].count) > 0) return;

    console.log('Seeding decoupage administratif...');
    const fs = require('fs');
    const path = require('path');
    const dataPath = path.join(__dirname, 'decoupage-data.json');
    if (!fs.existsSync(dataPath)) {
        console.log('decoupage-data.json not found, skipping seed');
        return;
    }

    const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        for (const row of data) {
            await client.query(
                `INSERT INTO decoupage (region, departement, arrondissement, commune)
                 VALUES ($1, $2, $3, $4)
                 ON CONFLICT (region, departement, arrondissement, commune) DO NOTHING`,
                [row.region, row.departement, row.arrondissement, row.commune]
            );
        }
        await client.query('COMMIT');
        console.log(`Decoupage: ${data.length} communes inserted`);
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Decoupage seed error:', err.message);
    } finally {
        client.release();
    }
}

module.exports = initDatabase;
