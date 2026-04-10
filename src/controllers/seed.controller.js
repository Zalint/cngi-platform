const db = require('../config/db');
const bcrypt = require('bcryptjs');

/**
 * @route   POST /api/seed/reset
 * @desc    Vider toutes les données (Admin only)
 * @access  Private (Admin)
 */
exports.resetDatabase = async (req, res, next) => {
    try {
        console.log('🗑️ Resetting database...');
        
        await db.query('BEGIN');
        
        // Supprimer dans l'ordre inverse des dépendances
        await db.query('DELETE FROM measure_comments');
        await db.query('DELETE FROM uploads');
        await db.query('DELETE FROM financing');
        await db.query('DELETE FROM stakeholders');
        await db.query('DELETE FROM measures');
        await db.query('DELETE FROM sites');
        await db.query('DELETE FROM localities');
        await db.query('DELETE FROM project_structures');
        await db.query('DELETE FROM projects');
        await db.query('DELETE FROM users');
        await db.query('DELETE FROM structures');
        
        // Reset les séquences
        await db.query(`
            SELECT setval(pg_get_serial_sequence('structures', 'id'), 1, false);
            SELECT setval(pg_get_serial_sequence('users', 'id'), 1, false);
            SELECT setval(pg_get_serial_sequence('projects', 'id'), 1, false);
            SELECT setval(pg_get_serial_sequence('localities', 'id'), 1, false);
            SELECT setval(pg_get_serial_sequence('sites', 'id'), 1, false);
            SELECT setval(pg_get_serial_sequence('measures', 'id'), 1, false);
            SELECT setval(pg_get_serial_sequence('measure_comments', 'id'), 1, false);
            SELECT setval(pg_get_serial_sequence('stakeholders', 'id'), 1, false);
            SELECT setval(pg_get_serial_sequence('financing', 'id'), 1, false);
            SELECT setval(pg_get_serial_sequence('uploads', 'id'), 1, false);
        `);
        
        await db.query('COMMIT');
        
        console.log('✅ Database reset successfully');
        
        res.json({
            success: true,
            message: 'Base de données vidée avec succès'
        });
    } catch (error) {
        await db.query('ROLLBACK');
        console.error('❌ Error resetting database:', error);
        next(error);
    }
};

/**
 * @route   POST /api/seed/populate
 * @desc    Remplir la base avec les données initiales (Admin only)
 * @access  Private (Admin)
 */
exports.populateDatabase = async (req, res, next) => {
    try {
        console.log('🌱 Populating database...');
        
        await db.query('BEGIN');
        
        // 1. Insert Structures
        const structuresResult = await db.query(`
            INSERT INTO structures (name, code, description) VALUES
            ('Direction de la Planification et de la Gestion des Inondations', 'DPGI', 'Direction en charge de la planification et coordination'),
            ('Office National de l''Assainissement du Sénégal', 'ONAS', 'Gestion de l''assainissement et des eaux usées'),
            ('Brigade Nationale des Sapeurs-Pompiers', 'BNSP', 'Intervention d''urgence et secours'),
            ('Conseil Exécutif des Transports Urbains de Dakar', 'CETUD', 'Gestion des infrastructures de transport'),
            ('Agence des Routes', 'AGEROUTE', 'Gestion et entretien des routes'),
            ('Direction de la Protection Civile', 'DPC', 'Coordination de la protection civile')
            RETURNING id, code
        `);
        
        const structures = {};
        structuresResult.rows.forEach(row => {
            structures[row.code] = row.id;
        });
        
        // 2. Insert Users
        const adminPassword = await bcrypt.hash('mha@2024', 10);
        
        await db.query(`
            INSERT INTO users (username, password_hash, email, first_name, last_name, role, structure_id) VALUES
            ('admin', $1, 'admin@cngi.sn', 'Admin', 'Système', 'admin', NULL),
            ('directeur', $1, 'directeur@cngi.sn', 'Directeur', 'Général', 'directeur', NULL),
            ('user_dpgi', $1, 'user.dpgi@cngi.sn', 'Mamadou', 'Diallo', 'utilisateur', $2),
            ('user_dpgi2', $1, 'cheikh.sy@dpgi.sn', 'Cheikh', 'Sy', 'utilisateur', $2),
            ('user_dpgi3', $1, 'mariama.ba@dpgi.sn', 'Mariama', 'Ba', 'utilisateur', $2),
            ('user_onas', $1, 'user.onas@cngi.sn', 'Aïssatou', 'Sow', 'utilisateur', $3),
            ('user_bnsp', $1, 'user.bnsp@cngi.sn', 'Ibrahima', 'Fall', 'utilisateur', $4),
            ('user_cetud', $1, 'user.cetud@cngi.sn', 'Fatou', 'Ndiaye', 'utilisateur', $5)
        `, [adminPassword, structures.DPGI, structures.ONAS, structures.BNSP, structures.CETUD]);
        
        // 3. Insert Sample Projects
        const projectsResult = await db.query(`
            INSERT INTO projects (title, description, structure_id, status, progress_percentage, start_date, deadline_date, created_by_user_id) VALUES
            (
                'Tournées d''observation', 
                'Inspection des zones à risque d''inondation dans la région de Dakar, identification des points critiques',
                $1, 'en_cours', 65, '2024-01-15', '2024-06-15', 
                (SELECT id FROM users WHERE username = 'user_dpgi')
            ),
            (
                'Création de bassins de rétention',
                'Construction de bassins de rétention d''eau dans les zones sensibles pour prévenir les inondations',
                $2, 'retard', 45, '2024-02-01', '2024-04-30',
                (SELECT id FROM users WHERE username = 'user_onas')
            ),
            (
                'Confection de digues',
                'Édification de digues de protection le long des cours d''eau à risque',
                $3, 'en_cours', 30, '2024-03-01', '2024-06-12',
                (SELECT id FROM users WHERE username = 'user_bnsp')
            ),
            (
                'Reconstruction de voirie',
                'Réhabilitation des voiries endommagées suite aux inondations de 2023',
                $4, 'en_cours', 55, '2024-02-15', '2024-05-20',
                (SELECT id FROM users WHERE username = 'user_cetud')
            ),
            (
                'Curage de canaux',
                'Nettoyage et curage des réseaux d''assainissement pour faciliter l''évacuation des eaux',
                $2, 'termine', 100, '2024-01-10', '2024-03-10',
                (SELECT id FROM users WHERE username = 'user_onas')
            ),
            (
                'Pose de stations de pompage',
                'Installation de stations de pompage dans les zones basses pour évacuation rapide des eaux',
                $2, 'en_cours', 20, '2024-03-15', '2024-07-25',
                (SELECT id FROM users WHERE username = 'user_onas')
            )
            RETURNING id, title
        `, [structures.DPGI, structures.ONAS, structures.BNSP, structures.CETUD]);
        
        const project1Id = projectsResult.rows.find(p => p.title === 'Tournées d\'observation').id;
        const project2Id = projectsResult.rows.find(p => p.title === 'Création de bassins de rétention').id;
        const project3Id = projectsResult.rows.find(p => p.title === 'Confection de digues').id;
        const project4Id = projectsResult.rows.find(p => p.title === 'Reconstruction de voirie').id;
        const project5Id = projectsResult.rows.find(p => p.title === 'Curage de canaux').id;
        const project6Id = projectsResult.rows.find(p => p.title === 'Pose de stations de pompage').id;
        
        const adminUserId = (await db.query('SELECT id FROM users WHERE username = \'admin\'')).rows[0].id;
        
        // 4. Insert Project-Structure Mappings
        await db.query(`
            INSERT INTO project_structures (project_id, structure_id, assigned_by_user_id) VALUES
            -- Projet 1 (DPGI): accessible par DPGI + DPC
            ($1, $7, $13),
            ($1, $12, $13),
            -- Projet 2 (ONAS): accessible par ONAS + DPGI + DPC
            ($2, $8, $13),
            ($2, $7, $13),
            ($2, $12, $13),
            -- Projet 3 (BNSP): accessible par BNSP + DPGI
            ($3, $9, $13),
            ($3, $7, $13),
            -- Projet 4 (CETUD): accessible par CETUD + AGEROUTE
            ($4, $10, $13),
            ($4, $11, $13),
            -- Projet 5 (ONAS): accessible par ONAS + DPGI
            ($5, $8, $13),
            ($5, $7, $13),
            -- Projet 6 (ONAS): accessible par ONAS + BNSP
            ($6, $8, $13),
            ($6, $9, $13)
        `, [
            project1Id, project2Id, project3Id, project4Id, project5Id, project6Id,
            structures.DPGI, structures.ONAS, structures.BNSP, structures.CETUD, structures.AGEROUTE, structures.DPC,
            adminUserId
        ]);
        
        // 5. Insert Localities and Sites
        await db.query(`
            INSERT INTO localities (project_id, region, departement, commune) VALUES
            ($1, 'Dakar', 'Dakar', 'Plateau'),
            ($1, 'Dakar', 'Dakar', 'Médina'),
            ($2, 'Dakar', 'Guédiawaye', 'Guédiawaye'),
            ($2, 'Dakar', 'Pikine', 'Pikine')
        `, [project1Id, project2Id]);
        
        await db.query(`
            INSERT INTO sites (project_id, name, description, latitude, longitude) VALUES
            ($1, 'Boulevard de l''Arsenal', 'Point bas en face Dakar Marine', 14.6928, -17.4467),
            ($1, 'Point bas Ambassade Japon', 'Traversée Rtm', 14.7167, -17.4677),
            ($2, 'Corniche Ouest', 'Trémie ATEPA', 14.7000, -17.4700),
            ($2, 'Tunnel de Soumbédioune', 'Surveillance et maintenance de l''ouvrage', 14.6850, -17.4450)
        `, [project1Id, project2Id]);
        
        // 6. Insert Measures
        await db.query(`
            INSERT INTO measures (project_id, description, type, status) VALUES
            ($1, 'Mise en place d''un dispositif pour le pompage des eaux', 'Pompage', 'executee'),
            ($1, 'Installation de camions hydrocureurs', 'Équipement', 'executee'),
            ($1, 'Désensablement de l''axe', 'Nettoyage', 'executee'),
            ($2, 'Curage du réseau', 'Curage', 'preconisee'),
            ($2, 'Mise en place d''une équipe de surveillance et d''intervention', 'Organisation', 'executee')
        `, [project1Id, project2Id]);
        
        // 7. Insert Stakeholders
        await db.query(`
            INSERT INTO stakeholders (project_id, name, type, contact_name) VALUES
            ($1, 'DPGI', 'Direction', 'Coordinateur DPGI'),
            ($2, 'ONAS', 'Office', 'Directeur Technique'),
            ($2, 'FERA', 'Financeur', 'Responsable Projets')
        `, [project1Id, project2Id]);
        
        // 8. Insert Financing
        await db.query(`
            INSERT INTO financing (project_id, amount, currency, source, availability) VALUES
            ($1, 50000000, 'FCFA', 'Budget État', 'disponible'),
            ($2, 188437675, 'FCFA', 'FERA', 'disponible')
        `, [project1Id, project2Id]);
        
        await db.query('COMMIT');
        
        console.log('✅ Database populated successfully');
        
        res.json({
            success: true,
            message: 'Base de données remplie avec succès',
            data: {
                structures: 6,
                users: 8,
                projects: 6,
                sites: 4,
                measures: 5,
                stakeholders: 3,
                financing: 2
            }
        });
    } catch (error) {
        await db.query('ROLLBACK');
        console.error('❌ Error populating database:', error);
        next(error);
    }
};

/**
 * @route   POST /api/seed/reset-and-populate
 * @desc    Vider et remplir la base (Admin only)
 * @access  Private (Admin)
 */
exports.resetAndPopulate = async (req, res, next) => {
    try {
        console.log('🔄 Reset and populate database...');
        
        // Reset
        await exports.resetDatabase({ body: {} }, { 
            json: () => console.log('✅ Reset done')
        }, () => {});
        
        // Populate
        await exports.populateDatabase(req, res, next);
        
    } catch (error) {
        next(error);
    }
};

