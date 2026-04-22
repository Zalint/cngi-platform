require('dotenv').config();
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');

const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD
});

async function seed() {
    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');
        
        console.log('🌱 Starting database seeding...');
        
        // 1. Insert Structures
        console.log('📋 Inserting structures...');
        const structuresResult = await client.query(`
            INSERT INTO structures (name, code, description) VALUES
            ('Direction de la Prévention et de la Gestion des Inondations', 'DPGI', 'Direction en charge de la prévention et coordination'),
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
        console.log(`✅ ${structuresResult.rowCount} structures inserted`);
        
        // 2. Insert Users
        console.log('👥 Inserting users...');
        const adminPassword = await bcrypt.hash('mha@2024', 10);
        
        const usersResult = await client.query(`
            INSERT INTO users (username, password_hash, email, first_name, last_name, role, structure_id) VALUES
            ('admin', $1, 'admin@cngi.sn', 'Admin', 'Système', 'admin', NULL),
            ('directeur', $1, 'directeur@cngi.sn', 'Directeur', 'Général', 'directeur', NULL),
            -- DPGI Users (3 utilisateurs)
            ('user_dpgi', $1, 'user.dpgi@cngi.sn', 'Mamadou', 'Diallo', 'utilisateur', $2),
            ('user_dpgi2', $1, 'cheikh.sy@dpgi.sn', 'Cheikh', 'Sy', 'utilisateur', $2),
            ('user_dpgi3', $1, 'mariama.ba@dpgi.sn', 'Mariama', 'Ba', 'utilisateur', $2),
            -- ONAS Users (3 utilisateurs)
            ('user_onas', $1, 'user.onas@cngi.sn', 'Aïssatou', 'Sow', 'utilisateur', $3),
            ('user_onas2', $1, 'ousmane.diop@onas.sn', 'Ousmane', 'Diop', 'utilisateur', $3),
            ('user_onas3', $1, 'fatou.mbaye@onas.sn', 'Fatou', 'Mbaye', 'utilisateur', $3),
            -- BNSP Users (3 utilisateurs)
            ('user_bnsp', $1, 'user.bnsp@cngi.sn', 'Ibrahima', 'Fall', 'utilisateur', $4),
            ('user_bnsp2', $1, 'moussa.ndao@bnsp.sn', 'Moussa', 'Ndao', 'utilisateur', $4),
            ('user_bnsp3', $1, 'awa.gueye@bnsp.sn', 'Awa', 'Gueye', 'utilisateur', $4),
            -- CETUD Users (3 utilisateurs)
            ('user_cetud', $1, 'user.cetud@cngi.sn', 'Fatou', 'Ndiaye', 'utilisateur', $5),
            ('user_cetud2', $1, 'amadou.kane@cetud.sn', 'Amadou', 'Kane', 'utilisateur', $5),
            ('user_cetud3', $1, 'mame.diarra@cetud.sn', 'Mame', 'Diarra', 'utilisateur', $5),
            -- AGEROUTE Users (2 utilisateurs)
            ('user_ageroute', $1, 'samba.seck@ageroute.sn', 'Samba', 'Seck', 'utilisateur', $6),
            ('user_ageroute2', $1, 'khadija.sarr@ageroute.sn', 'Khadija', 'Sarr', 'utilisateur', $6),
            -- DPC Users (2 utilisateurs)
            ('user_dpc', $1, 'abdou.niang@dpc.sn', 'Abdou', 'Niang', 'utilisateur', $7),
            ('user_dpc2', $1, 'sokhna.toure@dpc.sn', 'Sokhna', 'Touré', 'utilisateur', $7)
            RETURNING id, username
        `, [adminPassword, structures.DPGI, structures.ONAS, structures.BNSP, structures.CETUD, structures.AGEROUTE, structures.DPC]);
        
        console.log(`✅ ${usersResult.rowCount} users inserted`);
        
        // 3. Insert Sample Projects
        console.log('📦 Inserting sample projects...');
        
        const projectsResult = await client.query(`
            INSERT INTO projects (title, description, structure_id, project_manager_id, status, progress_percentage, start_date, deadline_date, created_by_user_id) VALUES
            (
                'Tournées d''observation', 
                'Inspection des zones à risque d''inondation dans la région de Dakar, identification des points critiques',
                $1, 
                (SELECT id FROM users WHERE username = 'user_dpgi2'),
                'en_cours', 65, '2024-01-15', '2024-06-15', 
                (SELECT id FROM users WHERE username = 'user_dpgi')
            ),
            (
                'Création de bassins de rétention',
                'Construction de bassins de rétention d''eau dans les zones sensibles pour prévenir les inondations',
                $2,
                (SELECT id FROM users WHERE username = 'user_onas2'),
                'retard', 45, '2024-02-01', '2024-04-30',
                (SELECT id FROM users WHERE username = 'user_onas')
            ),
            (
                'Confection de digues',
                'Édification de digues de protection le long des cours d''eau à risque',
                $3,
                (SELECT id FROM users WHERE username = 'user_bnsp2'),
                'en_cours', 30, '2024-03-01', '2024-06-12',
                (SELECT id FROM users WHERE username = 'user_bnsp')
            ),
            (
                'Reconstruction de voirie',
                'Réhabilitation des voiries endommagées suite aux inondations de 2023',
                $4,
                (SELECT id FROM users WHERE username = 'user_cetud2'),
                'en_cours', 55, '2024-02-15', '2024-05-20',
                (SELECT id FROM users WHERE username = 'user_cetud')
            ),
            (
                'Curage de canaux',
                'Nettoyage et curage des réseaux d''assainissement pour faciliter l''évacuation des eaux',
                $2,
                (SELECT id FROM users WHERE username = 'user_onas3'),
                'termine', 100, '2024-01-10', '2024-03-10',
                (SELECT id FROM users WHERE username = 'user_onas')
            ),
            (
                'Pose de stations de pompage',
                'Installation de stations de pompage dans les zones basses pour évacuation rapide des eaux',
                $2,
                (SELECT id FROM users WHERE username = 'user_onas'),
                'en_cours', 20, '2024-03-15', '2024-07-25',
                (SELECT id FROM users WHERE username = 'user_onas')
            )
            RETURNING id, title
        `, [structures.DPGI, structures.ONAS, structures.BNSP, structures.CETUD]);
        
        console.log(`✅ ${projectsResult.rowCount} projects inserted`);
        
        // 4. Insert Project-Structure Mappings
        console.log('🔗 Inserting project-structure mappings...');
        
        const project1Id = projectsResult.rows.find(p => p.title === 'Tournées d\'observation').id;
        const project2Id = projectsResult.rows.find(p => p.title === 'Création de bassins de rétention').id;
        const project3Id = projectsResult.rows.find(p => p.title === 'Confection de digues').id;
        const project4Id = projectsResult.rows.find(p => p.title === 'Reconstruction de voirie').id;
        const project5Id = projectsResult.rows.find(p => p.title === 'Curage de canaux').id;
        const project6Id = projectsResult.rows.find(p => p.title === 'Pose de stations de pompage').id;
        
        const adminUserId = usersResult.rows.find(u => u.username === 'admin').id;
        
        // Assign projects to multiple structures
        await client.query(`
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
            structures.DPGI, structures.ONAS, structures.BNSP, structures.CETUD, 
            structures.AGEROUTE, structures.DPC, adminUserId
        ]);
        
        console.log('✅ Project-structure mappings inserted');
        
        // 5. Insert Sample Localities and Sites
        console.log('📍 Inserting localities and sites...');
        
        await client.query(`
            INSERT INTO localities (project_id, region, departement, commune) VALUES
            ($1, 'Dakar', 'Dakar', 'Plateau'),
            ($1, 'Dakar', 'Dakar', 'Médina'),
            ($2, 'Dakar', 'Guédiawaye', 'Guédiawaye'),
            ($2, 'Dakar', 'Pikine', 'Pikine')
        `, [project1Id, project2Id]);
        
        await client.query(`
            INSERT INTO sites (project_id, name, description, latitude, longitude) VALUES
            ($1, 'Boulevard de l''Arsenal', 'Point bas en face Dakar Marine', 14.6928, -17.4467),
            ($1, 'Point bas Ambassade Japon', 'Traversée Rtm', 14.7167, -17.4677),
            ($2, 'Corniche Ouest', 'Trémie ATEPA', 14.7000, -17.4700),
            ($2, 'Tunnel de Soumbédioune', 'Surveillance et maintenance de l''ouvrage', 14.6850, -17.4450)
        `, [project1Id, project2Id]);
        
        console.log('✅ Localities and sites inserted');
        
        // 6. Insert Sample Measures
        console.log('🔧 Inserting measures...');
        await client.query(`
            INSERT INTO measures (project_id, description, type, status) VALUES
            ($1, 'Mise en place d''un dispositif pour le pompage des eaux', 'Pompage', 'executee'),
            ($1, 'Installation de camions hydrocureurs', 'Équipement', 'executee'),
            ($1, 'Désensablement de l''axe', 'Nettoyage', 'executee'),
            ($2, 'Curage du réseau', 'Curage', 'preconisee'),
            ($2, 'Mise en place d''une équipe de surveillance et d''intervention', 'Organisation', 'executee')
        `, [project1Id, project2Id]);
        
        console.log('✅ Measures inserted');
        
        // 7. Insert Sample Stakeholders
        console.log('👔 Inserting stakeholders...');
        await client.query(`
            INSERT INTO stakeholders (project_id, name, type, contact_name) VALUES
            ($1, 'DPGI', 'Direction', 'Coordinateur DPGI'),
            ($2, 'ONAS', 'Office', 'Directeur Technique'),
            ($2, 'FERA', 'Financeur', 'Responsable Projets')
        `, [project1Id, project2Id]);
        
        console.log('✅ Stakeholders inserted');
        
        // 8. Insert Sample Financing
        console.log('Inserting financing...');
        await client.query(`
            INSERT INTO financing (project_id, amount, currency, source, availability) VALUES
            ($1, 50000000, 'FCFA', 'Budget État', 'disponible'),
            ($2, 188437675, 'FCFA', 'FERA', 'disponible')
        `, [project1Id, project2Id]);
        
        console.log('✅ Financing inserted');
        
        // 9. Insert Sample Dynamic Form
        console.log('📝 Inserting sample form...');
        const formSchema = {
            fields: [
                {
                    name: 'localite_region',
                    label: 'Région',
                    type: 'text',
                    required: true
                },
                {
                    name: 'localite_departement',
                    label: 'Département',
                    type: 'text',
                    required: true
                },
                {
                    name: 'localite_commune',
                    label: 'Commune',
                    type: 'text',
                    required: true
                },
                {
                    name: 'site_name',
                    label: 'Nom du site',
                    type: 'text',
                    required: true
                },
                {
                    name: 'site_description',
                    label: 'Description du site',
                    type: 'textarea',
                    required: true
                },
                {
                    name: 'mesures_preconisees',
                    label: 'Mesures préconisées',
                    type: 'textarea',
                    required: true
                },
                {
                    name: 'date_debut',
                    label: 'Date de début',
                    type: 'date',
                    required: true
                },
                {
                    name: 'date_fin',
                    label: 'Date de fin',
                    type: 'date',
                    required: true
                },
                {
                    name: 'cout_fcfa',
                    label: 'Coût (FCFA)',
                    type: 'number',
                    required: false
                },
                {
                    name: 'source_financement',
                    label: 'Source de financement',
                    type: 'text',
                    required: false
                }
            ]
        };
        
        await client.query(`
            INSERT INTO forms (title, description, schema, assigned_to_structure_id, created_by) VALUES
            ('Fiche d''évaluation des plans d''action', 
             'Formulaire pour la gestion et prévention des inondations',
             $1,
             NULL,
             (SELECT id FROM users WHERE username = 'admin'))
        `, [JSON.stringify(formSchema)]);
        
        console.log('✅ Sample form inserted');
        
        await client.query('COMMIT');
        console.log('');
        console.log('✅ ✅ ✅ Database seeded successfully! ✅ ✅ ✅');
        console.log('');
        console.log('📊 Summary:');
        console.log('   - Structures: 6');
        console.log('   - Users: 20 (2-3 par structure avec des noms sénégalais)');
        console.log('   - Projects: 6 (avec chefs de projet assignés)');
        console.log('   - Sites: 4+');
        console.log('');
        console.log('🔐 Default credentials:');
        console.log('   Admin:      admin / mha@2024');
        console.log('   Directeur:  directeur / mha@2024');
        console.log('   Utilisateur DPGI:  user_dpgi / mha@2024');
        console.log('   Utilisateur ONAS:  user_onas / mha@2024');
        console.log('   ... et tous les autres utilisateurs avec le même mot de passe');
        console.log('');
        
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Error seeding database:', error);
        throw error;
    } finally {
        client.release();
        await pool.end();
    }
}

seed().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});

