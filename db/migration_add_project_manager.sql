-- Migration: Ajout du système Chef de Projet et Assignation aux Mesures
-- Date: 2025-12-18

BEGIN;

-- 1. Ajouter le champ project_manager_id dans projects
ALTER TABLE projects
ADD COLUMN project_manager_id INTEGER REFERENCES users(id) ON DELETE SET NULL;

-- Index pour améliorer les performances
CREATE INDEX idx_projects_manager ON projects(project_manager_id);

-- 2. Ajouter le champ assigned_user_id dans measures
ALTER TABLE measures
ADD COLUMN assigned_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;

-- Index pour améliorer les performances
CREATE INDEX idx_measures_assigned_user ON measures(assigned_user_id);

-- 3. Créer la table measure_comments pour les commentaires sur les mesures
CREATE TABLE measure_comments (
    id SERIAL PRIMARY KEY,
    measure_id INTEGER NOT NULL REFERENCES measures(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    comment TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_measure_comments_measure ON measure_comments(measure_id);
CREATE INDEX idx_measure_comments_user ON measure_comments(user_id);

-- Commentaires sur les changements
COMMENT ON COLUMN projects.project_manager_id IS 'Chef de projet responsable du suivi du projet';
COMMENT ON COLUMN measures.assigned_user_id IS 'Utilisateur assigné à cette mesure pour mise à jour du statut';
COMMENT ON TABLE measure_comments IS 'Commentaires/observations sur les mesures par les utilisateurs assignés';

COMMIT;

-- Afficher un résumé
SELECT 'Migration terminée avec succès!' as message;

