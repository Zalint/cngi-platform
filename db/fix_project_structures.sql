-- Script pour corriger les mappings projet-structure manquants
-- Ce script ajoute automatiquement les mappings pour tous les projets qui n'en ont pas

INSERT INTO project_structures (project_id, structure_id, assigned_by_user_id)
SELECT 
    p.id as project_id,
    p.structure_id,
    p.created_by_user_id as assigned_by_user_id
FROM projects p
WHERE p.structure_id IS NOT NULL
AND NOT EXISTS (
    SELECT 1 
    FROM project_structures ps 
    WHERE ps.project_id = p.id AND ps.structure_id = p.structure_id
)
ON CONFLICT (project_id, structure_id) DO NOTHING;

-- Afficher le résultat
SELECT 
    p.id, 
    p.title, 
    s.name as structure_name,
    COUNT(ps.structure_id) as mappings_count
FROM projects p
LEFT JOIN structures s ON p.structure_id = s.id
LEFT JOIN project_structures ps ON ps.project_id = p.id
GROUP BY p.id, p.title, s.name
ORDER BY p.id;

