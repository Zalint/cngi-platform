-- Migration: Ajouter contrainte unique sur les commentaires de mesures
-- Un utilisateur ne peut avoir qu'un seul commentaire par mesure

-- Supprimer les doublons existants (garder le plus récent)
DELETE FROM measure_comments mc1
USING measure_comments mc2
WHERE mc1.measure_id = mc2.measure_id
  AND mc1.user_id = mc2.user_id
  AND mc1.created_at < mc2.created_at;

-- Ajouter la contrainte unique
ALTER TABLE measure_comments
ADD CONSTRAINT measure_comments_unique_user_measure UNIQUE (measure_id, user_id);

