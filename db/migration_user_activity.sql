-- Ajoute le tracking d'activité en quasi-temps-réel pour l'écran admin
-- "Sessions actives". Mis à jour par un middleware avec throttle 1/min/user
-- pour ne pas marteler la DB.

ALTER TABLE users ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMP;

-- Index partiel : on ne requête que les "récemment actifs" pour l'écran admin.
-- Postgres utilise quand même l'index pour ORDER BY DESC sur la colonne entière,
-- mais on garde simple : index B-tree classique.
CREATE INDEX IF NOT EXISTS idx_users_last_activity ON users(last_activity_at DESC);

-- Token versioning : permet de révoquer toutes les sessions d'un utilisateur
-- (force-logout admin, "déconnecter tous mes appareils", changement de
-- password). Le JWT embarque la version au moment de la signature ; protect
-- rejette si la version du token != version courante en DB.
ALTER TABLE users ADD COLUMN IF NOT EXISTS token_version INTEGER NOT NULL DEFAULT 0;

-- Bandeau d'annonces (broadcast admin → users). Voir db/init.js pour le
-- CREATE TABLE complet, qui est exécuté au démarrage et ajoute aussi la
-- contrainte CHECK (expires_at IS NULL OR expires_at >= starts_at) en mode
-- NOT VALID (pour ne pas crasher si des lignes legacy violent la règle).
-- Une fois les données nettoyées, lancer manuellement :
--     ALTER TABLE announcements VALIDATE CONSTRAINT announcements_valid_window;
