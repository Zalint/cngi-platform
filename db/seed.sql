-- ============================================
-- CNGI Database Seed - PRODUCTION
-- Mot de passe par défaut: mha@2024
-- ============================================

BEGIN;

-- 1. Structures
INSERT INTO structures (name, code, description) VALUES
    ('Direction de la Planification et de la Gestion des Inondations', 'DPGI', 'Direction en charge de la planification et coordination'),
    ('Office National de l''Assainissement du Sénégal', 'ONAS', 'Gestion de l''assainissement et des eaux usées'),
    ('Brigade Nationale des Sapeurs-Pompiers', 'BNSP', 'Intervention d''urgence et secours'),
    ('Conseil Exécutif des Transports Urbains de Dakar', 'CETUD', 'Gestion des infrastructures de transport'),
    ('Agence des Routes', 'AGEROUTE', 'Gestion et entretien des routes'),
    ('Direction de la Protection Civile', 'DPC', 'Coordination de la protection civile')
ON CONFLICT (code) DO NOTHING;

-- 2. Users (mot de passe: mha@2024)
INSERT INTO users (username, password_hash, email, first_name, last_name, role, structure_id) VALUES
    -- Admin & Directeur
    ('admin', '$2a$10$PIRb2BS6W47iP1MtphWzje7tF1qyokGg3cSAtL4N6GiP1XeJfihYS', 'admin@cngi.sn', 'Admin', 'Système', 'admin', NULL),
    ('directeur', '$2a$10$PIRb2BS6W47iP1MtphWzje7tF1qyokGg3cSAtL4N6GiP1XeJfihYS', 'directeur@cngi.sn', 'Directeur', 'Général', 'directeur', NULL),
    -- DPGI (3)
    ('user_dpgi', '$2a$10$PIRb2BS6W47iP1MtphWzje7tF1qyokGg3cSAtL4N6GiP1XeJfihYS', 'user.dpgi@cngi.sn', 'Mamadou', 'Diallo', 'utilisateur', (SELECT id FROM structures WHERE code = 'DPGI')),
    ('user_dpgi2', '$2a$10$PIRb2BS6W47iP1MtphWzje7tF1qyokGg3cSAtL4N6GiP1XeJfihYS', 'cheikh.sy@dpgi.sn', 'Cheikh', 'Sy', 'utilisateur', (SELECT id FROM structures WHERE code = 'DPGI')),
    ('user_dpgi3', '$2a$10$PIRb2BS6W47iP1MtphWzje7tF1qyokGg3cSAtL4N6GiP1XeJfihYS', 'mariama.ba@dpgi.sn', 'Mariama', 'Ba', 'utilisateur', (SELECT id FROM structures WHERE code = 'DPGI')),
    -- ONAS (3)
    ('user_onas', '$2a$10$PIRb2BS6W47iP1MtphWzje7tF1qyokGg3cSAtL4N6GiP1XeJfihYS', 'user.onas@cngi.sn', 'Aïssatou', 'Sow', 'utilisateur', (SELECT id FROM structures WHERE code = 'ONAS')),
    ('user_onas2', '$2a$10$PIRb2BS6W47iP1MtphWzje7tF1qyokGg3cSAtL4N6GiP1XeJfihYS', 'ousmane.diop@onas.sn', 'Ousmane', 'Diop', 'utilisateur', (SELECT id FROM structures WHERE code = 'ONAS')),
    ('user_onas3', '$2a$10$PIRb2BS6W47iP1MtphWzje7tF1qyokGg3cSAtL4N6GiP1XeJfihYS', 'fatou.mbaye@onas.sn', 'Fatou', 'Mbaye', 'utilisateur', (SELECT id FROM structures WHERE code = 'ONAS')),
    -- BNSP (3)
    ('user_bnsp', '$2a$10$PIRb2BS6W47iP1MtphWzje7tF1qyokGg3cSAtL4N6GiP1XeJfihYS', 'user.bnsp@cngi.sn', 'Ibrahima', 'Fall', 'utilisateur', (SELECT id FROM structures WHERE code = 'BNSP')),
    ('user_bnsp2', '$2a$10$PIRb2BS6W47iP1MtphWzje7tF1qyokGg3cSAtL4N6GiP1XeJfihYS', 'moussa.ndao@bnsp.sn', 'Moussa', 'Ndao', 'utilisateur', (SELECT id FROM structures WHERE code = 'BNSP')),
    ('user_bnsp3', '$2a$10$PIRb2BS6W47iP1MtphWzje7tF1qyokGg3cSAtL4N6GiP1XeJfihYS', 'awa.gueye@bnsp.sn', 'Awa', 'Gueye', 'utilisateur', (SELECT id FROM structures WHERE code = 'BNSP')),
    -- CETUD (3)
    ('user_cetud', '$2a$10$PIRb2BS6W47iP1MtphWzje7tF1qyokGg3cSAtL4N6GiP1XeJfihYS', 'user.cetud@cngi.sn', 'Fatou', 'Ndiaye', 'utilisateur', (SELECT id FROM structures WHERE code = 'CETUD')),
    ('user_cetud2', '$2a$10$PIRb2BS6W47iP1MtphWzje7tF1qyokGg3cSAtL4N6GiP1XeJfihYS', 'amadou.kane@cetud.sn', 'Amadou', 'Kane', 'utilisateur', (SELECT id FROM structures WHERE code = 'CETUD')),
    ('user_cetud3', '$2a$10$PIRb2BS6W47iP1MtphWzje7tF1qyokGg3cSAtL4N6GiP1XeJfihYS', 'mame.diarra@cetud.sn', 'Mame', 'Diarra', 'utilisateur', (SELECT id FROM structures WHERE code = 'CETUD')),
    -- AGEROUTE (2)
    ('user_ageroute', '$2a$10$PIRb2BS6W47iP1MtphWzje7tF1qyokGg3cSAtL4N6GiP1XeJfihYS', 'samba.seck@ageroute.sn', 'Samba', 'Seck', 'utilisateur', (SELECT id FROM structures WHERE code = 'AGEROUTE')),
    ('user_ageroute2', '$2a$10$PIRb2BS6W47iP1MtphWzje7tF1qyokGg3cSAtL4N6GiP1XeJfihYS', 'khadija.sarr@ageroute.sn', 'Khadija', 'Sarr', 'utilisateur', (SELECT id FROM structures WHERE code = 'AGEROUTE')),
    -- DPC (2)
    ('user_dpc', '$2a$10$PIRb2BS6W47iP1MtphWzje7tF1qyokGg3cSAtL4N6GiP1XeJfihYS', 'abdou.niang@dpc.sn', 'Abdou', 'Niang', 'utilisateur', (SELECT id FROM structures WHERE code = 'DPC')),
    ('user_dpc2', '$2a$10$PIRb2BS6W47iP1MtphWzje7tF1qyokGg3cSAtL4N6GiP1XeJfihYS', 'sokhna.toure@dpc.sn', 'Sokhna', 'Touré', 'utilisateur', (SELECT id FROM structures WHERE code = 'DPC'))
ON CONFLICT (username) DO NOTHING;

-- 3. Projects
INSERT INTO projects (title, description, structure_id, project_manager_id, status, progress_percentage, start_date, deadline_date, created_by_user_id) VALUES
    (
        'Tournées d''observation',
        'Inspection des zones à risque d''inondation dans la région de Dakar, identification des points critiques',
        (SELECT id FROM structures WHERE code = 'DPGI'),
        (SELECT id FROM users WHERE username = 'user_dpgi2'),
        'en_cours', 65, '2024-01-15', '2024-06-15',
        (SELECT id FROM users WHERE username = 'user_dpgi')
    ),
    (
        'Création de bassins de rétention',
        'Construction de bassins de rétention d''eau dans les zones sensibles pour prévenir les inondations',
        (SELECT id FROM structures WHERE code = 'ONAS'),
        (SELECT id FROM users WHERE username = 'user_onas2'),
        'retard', 45, '2024-02-01', '2024-04-30',
        (SELECT id FROM users WHERE username = 'user_onas')
    ),
    (
        'Confection de digues',
        'Édification de digues de protection le long des cours d''eau à risque',
        (SELECT id FROM structures WHERE code = 'BNSP'),
        (SELECT id FROM users WHERE username = 'user_bnsp2'),
        'en_cours', 30, '2024-03-01', '2024-06-12',
        (SELECT id FROM users WHERE username = 'user_bnsp')
    ),
    (
        'Reconstruction de voirie',
        'Réhabilitation des voiries endommagées suite aux inondations de 2023',
        (SELECT id FROM structures WHERE code = 'CETUD'),
        (SELECT id FROM users WHERE username = 'user_cetud2'),
        'en_cours', 55, '2024-02-15', '2024-05-20',
        (SELECT id FROM users WHERE username = 'user_cetud')
    ),
    (
        'Curage de canaux',
        'Nettoyage et curage des réseaux d''assainissement pour faciliter l''évacuation des eaux',
        (SELECT id FROM structures WHERE code = 'ONAS'),
        (SELECT id FROM users WHERE username = 'user_onas3'),
        'termine', 100, '2024-01-10', '2024-03-10',
        (SELECT id FROM users WHERE username = 'user_onas')
    ),
    (
        'Pose de stations de pompage',
        'Installation de stations de pompage dans les zones basses pour évacuation rapide des eaux',
        (SELECT id FROM structures WHERE code = 'ONAS'),
        (SELECT id FROM users WHERE username = 'user_onas'),
        'en_cours', 20, '2024-03-15', '2024-07-25',
        (SELECT id FROM users WHERE username = 'user_onas')
    );

-- 4. Project-Structure Mappings
INSERT INTO project_structures (project_id, structure_id, assigned_by_user_id) VALUES
    -- Projet Tournées d'observation: DPGI + DPC
    ((SELECT id FROM projects WHERE title = 'Tournées d''observation'), (SELECT id FROM structures WHERE code = 'DPGI'), (SELECT id FROM users WHERE username = 'admin')),
    ((SELECT id FROM projects WHERE title = 'Tournées d''observation'), (SELECT id FROM structures WHERE code = 'DPC'), (SELECT id FROM users WHERE username = 'admin')),
    -- Projet Bassins de rétention: ONAS + DPGI + DPC
    ((SELECT id FROM projects WHERE title = 'Création de bassins de rétention'), (SELECT id FROM structures WHERE code = 'ONAS'), (SELECT id FROM users WHERE username = 'admin')),
    ((SELECT id FROM projects WHERE title = 'Création de bassins de rétention'), (SELECT id FROM structures WHERE code = 'DPGI'), (SELECT id FROM users WHERE username = 'admin')),
    ((SELECT id FROM projects WHERE title = 'Création de bassins de rétention'), (SELECT id FROM structures WHERE code = 'DPC'), (SELECT id FROM users WHERE username = 'admin')),
    -- Projet Digues: BNSP + DPGI
    ((SELECT id FROM projects WHERE title = 'Confection de digues'), (SELECT id FROM structures WHERE code = 'BNSP'), (SELECT id FROM users WHERE username = 'admin')),
    ((SELECT id FROM projects WHERE title = 'Confection de digues'), (SELECT id FROM structures WHERE code = 'DPGI'), (SELECT id FROM users WHERE username = 'admin')),
    -- Projet Voirie: CETUD + AGEROUTE
    ((SELECT id FROM projects WHERE title = 'Reconstruction de voirie'), (SELECT id FROM structures WHERE code = 'CETUD'), (SELECT id FROM users WHERE username = 'admin')),
    ((SELECT id FROM projects WHERE title = 'Reconstruction de voirie'), (SELECT id FROM structures WHERE code = 'AGEROUTE'), (SELECT id FROM users WHERE username = 'admin')),
    -- Projet Curage: ONAS + DPGI
    ((SELECT id FROM projects WHERE title = 'Curage de canaux'), (SELECT id FROM structures WHERE code = 'ONAS'), (SELECT id FROM users WHERE username = 'admin')),
    ((SELECT id FROM projects WHERE title = 'Curage de canaux'), (SELECT id FROM structures WHERE code = 'DPGI'), (SELECT id FROM users WHERE username = 'admin')),
    -- Projet Pompage: ONAS + BNSP
    ((SELECT id FROM projects WHERE title = 'Pose de stations de pompage'), (SELECT id FROM structures WHERE code = 'ONAS'), (SELECT id FROM users WHERE username = 'admin')),
    ((SELECT id FROM projects WHERE title = 'Pose de stations de pompage'), (SELECT id FROM structures WHERE code = 'BNSP'), (SELECT id FROM users WHERE username = 'admin'));

-- 5. Localities
INSERT INTO localities (project_id, region, departement, commune) VALUES
    ((SELECT id FROM projects WHERE title = 'Tournées d''observation'), 'Dakar', 'Dakar', 'Plateau'),
    ((SELECT id FROM projects WHERE title = 'Tournées d''observation'), 'Dakar', 'Dakar', 'Médina'),
    ((SELECT id FROM projects WHERE title = 'Création de bassins de rétention'), 'Dakar', 'Guédiawaye', 'Guédiawaye'),
    ((SELECT id FROM projects WHERE title = 'Création de bassins de rétention'), 'Dakar', 'Pikine', 'Pikine');

-- 6. Sites
INSERT INTO sites (project_id, name, description, latitude, longitude) VALUES
    ((SELECT id FROM projects WHERE title = 'Tournées d''observation'), 'Boulevard de l''Arsenal', 'Point bas en face Dakar Marine', 14.6928, -17.4467),
    ((SELECT id FROM projects WHERE title = 'Tournées d''observation'), 'Point bas Ambassade Japon', 'Traversée Rtm', 14.7167, -17.4677),
    ((SELECT id FROM projects WHERE title = 'Création de bassins de rétention'), 'Corniche Ouest', 'Trémie ATEPA', 14.7000, -17.4700),
    ((SELECT id FROM projects WHERE title = 'Création de bassins de rétention'), 'Tunnel de Soumbédioune', 'Surveillance et maintenance de l''ouvrage', 14.6850, -17.4450);

-- 7. Measures
INSERT INTO measures (project_id, description, type, status) VALUES
    ((SELECT id FROM projects WHERE title = 'Tournées d''observation'), 'Mise en place d''un dispositif pour le pompage des eaux', 'Pompage', 'executee'),
    ((SELECT id FROM projects WHERE title = 'Tournées d''observation'), 'Installation de camions hydrocureurs', 'Équipement', 'executee'),
    ((SELECT id FROM projects WHERE title = 'Tournées d''observation'), 'Désensablement de l''axe', 'Nettoyage', 'executee'),
    ((SELECT id FROM projects WHERE title = 'Création de bassins de rétention'), 'Curage du réseau', 'Curage', 'preconisee'),
    ((SELECT id FROM projects WHERE title = 'Création de bassins de rétention'), 'Mise en place d''une équipe de surveillance et d''intervention', 'Organisation', 'executee');

-- 8. Stakeholders
INSERT INTO stakeholders (project_id, name, type, contact_name) VALUES
    ((SELECT id FROM projects WHERE title = 'Tournées d''observation'), 'DPGI', 'Direction', 'Coordinateur DPGI'),
    ((SELECT id FROM projects WHERE title = 'Création de bassins de rétention'), 'ONAS', 'Office', 'Directeur Technique'),
    ((SELECT id FROM projects WHERE title = 'Création de bassins de rétention'), 'FERA', 'Financeur', 'Responsable Projets');

-- 9. Financing
INSERT INTO financing (project_id, amount, currency, source, availability) VALUES
    ((SELECT id FROM projects WHERE title = 'Tournées d''observation'), 50000000, 'FCFA', 'Budget État', 'disponible'),
    ((SELECT id FROM projects WHERE title = 'Création de bassins de rétention'), 188437675, 'FCFA', 'FERA', 'disponible');

-- 10. Sample Form
INSERT INTO forms (title, description, schema, assigned_to_structure_id, created_by) VALUES
    ('Fiche d''évaluation des plans d''action',
     'Formulaire pour la gestion et prévention des inondations',
     '{"fields":[{"name":"localite_region","label":"Région","type":"text","required":true},{"name":"localite_departement","label":"Département","type":"text","required":true},{"name":"localite_commune","label":"Commune","type":"text","required":true},{"name":"site_name","label":"Nom du site","type":"text","required":true},{"name":"site_description","label":"Description du site","type":"textarea","required":true},{"name":"mesures_preconisees","label":"Mesures préconisées","type":"textarea","required":true},{"name":"date_debut","label":"Date de début","type":"date","required":true},{"name":"date_fin","label":"Date de fin","type":"date","required":true},{"name":"cout_fcfa","label":"Coût (FCFA)","type":"number","required":false},{"name":"source_financement","label":"Source de financement","type":"text","required":false}]}',
     NULL,
     (SELECT id FROM users WHERE username = 'admin'));

COMMIT;
