    -- ============================================
    -- CNGI Database Schema
    -- Plateforme de suivi des actions
    -- ============================================

    -- Drop existing tables (in reverse order of dependencies)
    DROP TABLE IF EXISTS uploads CASCADE;
    DROP TABLE IF EXISTS financing CASCADE;
    DROP TABLE IF EXISTS stakeholders CASCADE;
    DROP TABLE IF EXISTS measures CASCADE;
    DROP TABLE IF EXISTS sites CASCADE;
    DROP TABLE IF EXISTS localities CASCADE;
    DROP TABLE IF EXISTS projects CASCADE;
    DROP TABLE IF EXISTS forms CASCADE;
    DROP TABLE IF EXISTS users CASCADE;
    DROP TABLE IF EXISTS structures CASCADE;

    -- ============================================
    -- STRUCTURES (Directions: DPGI, ONAS, etc.)
    -- ============================================
    CREATE TABLE structures (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        code VARCHAR(50) NOT NULL UNIQUE,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX idx_structures_code ON structures(code);

    -- ============================================
    -- USERS
    -- ============================================
    CREATE TABLE users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(100) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE,
        first_name VARCHAR(100),
        last_name VARCHAR(100),
        role VARCHAR(50) NOT NULL CHECK (role IN ('admin', 'utilisateur', 'directeur')),
        structure_id INTEGER REFERENCES structures(id) ON DELETE SET NULL,
        is_active BOOLEAN DEFAULT true,
        last_login TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX idx_users_username ON users(username);
    CREATE INDEX idx_users_role ON users(role);
    CREATE INDEX idx_users_structure ON users(structure_id);

    -- ============================================
    -- FORMS (Formulaires dynamiques)
    -- ============================================
    CREATE TABLE forms (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        schema JSONB NOT NULL,
        assigned_to_structure_id INTEGER REFERENCES structures(id) ON DELETE CASCADE,
        is_active BOOLEAN DEFAULT true,
        created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX idx_forms_structure ON forms(assigned_to_structure_id);
    CREATE INDEX idx_forms_active ON forms(is_active);

    -- ============================================
    -- PROJECTS (Actions/Projets)
    -- ============================================
    CREATE TABLE projects (
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
    );

    CREATE INDEX idx_projects_structure ON projects(structure_id);
    CREATE INDEX idx_projects_status ON projects(status);
    CREATE INDEX idx_projects_created_by ON projects(created_by_user_id);
    CREATE INDEX idx_projects_manager ON projects(project_manager_id);

    -- ============================================
    -- PROJECT_STRUCTURES (Mapping Projets-Structures)
    -- Many-to-Many relationship: Un projet peut être assigné à plusieurs structures
    -- ============================================
    CREATE TABLE project_structures (
        project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        structure_id INTEGER NOT NULL REFERENCES structures(id) ON DELETE CASCADE,
        assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        assigned_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        PRIMARY KEY (project_id, structure_id)
    );

    CREATE INDEX idx_project_structures_project ON project_structures(project_id);
    CREATE INDEX idx_project_structures_structure ON project_structures(structure_id);


    -- ============================================
    -- LOCALITIES (Localités)
    -- ============================================
    CREATE TABLE localities (
        id SERIAL PRIMARY KEY,
        project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
        region VARCHAR(100),
        departement VARCHAR(100),
        commune VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX idx_localities_project ON localities(project_id);

    -- ============================================
    -- SITES (Sites d'intervention)
    -- ============================================
    CREATE TABLE sites (
        id SERIAL PRIMARY KEY,
        project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
        locality_id INTEGER REFERENCES localities(id) ON DELETE SET NULL,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        latitude DECIMAL(10, 8),
        longitude DECIMAL(11, 8),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX idx_sites_project ON sites(project_id);
    CREATE INDEX idx_sites_locality ON sites(locality_id);
    CREATE INDEX idx_sites_coordinates ON sites(latitude, longitude);

    -- ============================================
    -- MEASURES (Mesures/Actions spécifiques)
    -- ============================================
    CREATE TABLE measures (
        id SERIAL PRIMARY KEY,
        project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
        site_id INTEGER REFERENCES sites(id) ON DELETE SET NULL,
        assigned_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        description TEXT NOT NULL,
        type VARCHAR(100),
        status VARCHAR(50) DEFAULT 'preconisee' CHECK (status IN ('preconisee', 'executee', 'non_executee', 'observations')),
        constraints TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX idx_measures_project ON measures(project_id);
    CREATE INDEX idx_measures_site ON measures(site_id);
    CREATE INDEX idx_measures_status ON measures(status);
    CREATE INDEX idx_measures_assigned_user ON measures(assigned_user_id);

    -- ============================================
    -- MEASURE_COMMENTS (Commentaires sur les mesures)
    -- ============================================
    CREATE TABLE measure_comments (
        id SERIAL PRIMARY KEY,
        measure_id INTEGER NOT NULL REFERENCES measures(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        comment TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX idx_measure_comments_measure ON measure_comments(measure_id);
    CREATE INDEX idx_measure_comments_user ON measure_comments(user_id);

    -- ============================================
    -- STAKEHOLDERS (Parties prenantes)
    -- ============================================
    CREATE TABLE stakeholders (
        id SERIAL PRIMARY KEY,
        project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        type VARCHAR(100),
        contact_name VARCHAR(255),
        contact_email VARCHAR(255),
        contact_phone VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX idx_stakeholders_project ON stakeholders(project_id);

    -- ============================================
    -- FINANCING (Financement)
    -- ============================================
    CREATE TABLE financing (
        id SERIAL PRIMARY KEY,
        project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
        amount DECIMAL(15, 2),
        currency VARCHAR(10) DEFAULT 'FCFA',
        source VARCHAR(255),
        availability VARCHAR(50) CHECK (availability IN ('disponible', 'non_disponible', 'partiel')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX idx_financing_project ON financing(project_id);

    -- ============================================
    -- UPLOADS (Fichiers téléchargés)
    -- ============================================
    CREATE TABLE uploads (
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
    );

    CREATE INDEX idx_uploads_entity ON uploads(entity_type, entity_id);
    CREATE INDEX idx_uploads_user ON uploads(uploaded_by_user_id);

    -- ============================================
    -- TRIGGERS for updated_at
    -- ============================================
    CREATE OR REPLACE FUNCTION update_updated_at_column()
    RETURNS TRIGGER AS $$
    BEGIN
        NEW.updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
    END;
    $$ language 'plpgsql';

    CREATE TRIGGER update_structures_updated_at BEFORE UPDATE ON structures
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

    CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

    CREATE TRIGGER update_forms_updated_at BEFORE UPDATE ON forms
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

    CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON projects
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

    -- ============================================
    -- VIEWS
    -- ============================================

    -- Vue pour les statistiques du dashboard
    CREATE OR REPLACE VIEW dashboard_stats AS
    SELECT
        (SELECT COUNT(*) FROM projects WHERE status = 'en_cours') as actions_en_cours,
        (SELECT COUNT(*) FROM projects WHERE status = 'termine') as actions_terminees,
        (SELECT COUNT(*) FROM projects WHERE status = 'retard') as actions_retard,
        (SELECT COUNT(DISTINCT structure_id) FROM projects) as structures_actives,
        (SELECT COUNT(*) FROM stakeholders) as total_intervenants;

    -- Vue pour les projets avec informations complètes
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
    LEFT JOIN users u ON p.created_by_user_id = u.id;

    -- ============================================
    -- Initial Data (will be completed in seed.js)
    -- ============================================
    COMMENT ON TABLE structures IS 'Structures/Directions (DPGI, ONAS, BNSP, CETUD, etc.)';
    COMMENT ON TABLE users IS 'Utilisateurs avec rôles (admin, utilisateur, directeur)';
    COMMENT ON TABLE forms IS 'Formulaires dynamiques configurables';
    COMMENT ON TABLE projects IS 'Projets/Actions de gestion des inondations';
    COMMENT ON COLUMN projects.project_manager_id IS 'Chef de projet responsable du suivi du projet';
    COMMENT ON TABLE localities IS 'Localités (Région, Département, Commune)';
    COMMENT ON TABLE sites IS 'Sites géographiques des interventions';
    COMMENT ON TABLE measures IS 'Mesures/Actions spécifiques par site';
    COMMENT ON COLUMN measures.assigned_user_id IS 'Utilisateur assigné à cette mesure pour mise à jour du statut';
    COMMENT ON TABLE measure_comments IS 'Commentaires/observations sur les mesures par les utilisateurs assignés';
    COMMENT ON TABLE stakeholders IS 'Parties prenantes/Intervenants';
    COMMENT ON TABLE financing IS 'Informations de financement';
    COMMENT ON TABLE uploads IS 'Fichiers téléchargés';

