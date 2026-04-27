const OpenAI = require('openai');
const db = require('../config/db');
const ProjectModel = require('../models/project.model');
const ProjectStructure = require('../models/projectStructure.model');
const StructureModel = require('../models/structure.model');
const ObservationModel = require('../models/observation.model');
const PvModel = require('../models/pv.model');
const { canUserAccessProject } = require('../utils/projectAccess');

// Borne dure sur le nombre de lignes renvoyées aux tools list_sites / list_geometries
// pour éviter de gonfler le contexte du LLM (et les coûts). Si l'utilisateur a besoin
// de plus, il doit filtrer (project_id, structure, vulnerability, commune...).
const LIST_CAP = 100;

const STATUS_LABELS = {
    demarrage: 'Démarrage', en_cours: 'En cours', termine: 'Terminé', retard: 'En retard', annule: 'Annulé'
};
const PRIORITY_LABELS = { normale: 'Normale', haute: 'Haute', urgente: 'Urgente' };
const TYPE_LABELS = { renforcement_resilience: 'Renforcement de la résilience', structurant: 'Structurant' };

// ==================== Données visibles selon le rôle ====================

async function getProjectsForUser(user, filters = {}) {
    let projects;
    if (user.role === 'commandement_territorial') {
        projects = await ProjectModel.findByTerritory(user.territorial_level, user.territorial_value);
    } else if (user.role === 'utilisateur' && user.structure_id) {
        projects = await ProjectStructure.getProjectsByStructure(user.structure_id);
    } else {
        projects = await ProjectModel.findAll({});
    }

    if (filters.status) projects = projects.filter(p => p.status === filters.status);
    if (filters.priority) projects = projects.filter(p => p.priority === filters.priority);
    if (filters.project_type) projects = projects.filter(p => p.project_type === filters.project_type);
    if (filters.structure) {
        const code = String(filters.structure).toUpperCase();
        projects = projects.filter(p => (p.structure_code || '').toUpperCase() === code);
    }
    return projects;
}

/**
 * Renvoie l'ensemble des project_id que l'utilisateur peut voir, en respectant
 * la matrice d'accès par rôle (même logique que getProjectsForUser, sans filtres).
 * Utilisé pour restreindre les requêtes sites / geometries ciblées par le LLM.
 */
async function getVisibleProjectIds(user) {
    const projects = await getProjectsForUser(user, {});
    return new Set(projects.map(p => p.id));
}

// ==================== Tools exposés au LLM ====================

const tools = [
    {
        type: 'function',
        function: {
            name: 'list_projects',
            description: 'Liste les projets visibles par l\'utilisateur, avec filtres optionnels. Renvoie un résumé (id, titre, structure, statut, priorité, avancement, échéance).',
            parameters: {
                type: 'object',
                properties: {
                    status: { type: 'string', enum: ['demarrage', 'en_cours', 'termine', 'retard', 'annule'], description: 'Filtrer par statut' },
                    priority: { type: 'string', enum: ['normale', 'haute', 'urgente'], description: 'Filtrer par priorité' },
                    project_type: { type: 'string', enum: ['renforcement_resilience', 'structurant'] },
                    structure: { type: 'string', description: 'Code structure (ex: DPGI, ONAS)' }
                }
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'get_project',
            description: 'Récupère les détails complets d\'un projet (description, contraintes, mesures, sites, chef, budget, etc.) à partir de son ID.',
            parameters: {
                type: 'object',
                properties: { id: { type: 'integer', description: 'ID du projet' } },
                required: ['id']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'get_stats',
            description: 'Statistiques agrégées des projets visibles : total, répartition par statut/priorité/structure, avancement moyen.',
            parameters: { type: 'object', properties: {} }
        }
    },
    {
        type: 'function',
        function: {
            name: 'list_structures',
            description: 'Liste toutes les structures du CNGIRI (DPGI, ONAS, BNSP, CETUD, AGEROUTE, DPC, etc.).',
            parameters: { type: 'object', properties: {} }
        }
    },
    {
        type: 'function',
        function: {
            name: 'list_observations',
            description: "Liste les observations/directives du Ministre (Superviseur). Filtres optionnels : projet, priorité, portée (globale ou liée à un projet).",
            parameters: {
                type: 'object',
                properties: {
                    project_id: { type: 'integer' },
                    priority: { type: 'string', enum: ['info', 'importante', 'urgente'] },
                    scope: { type: 'string', enum: ['global', 'project'] }
                }
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'list_pv',
            description: "Liste les PV de visite du Commandement Territorial visibles par l'utilisateur. Chaque PV contient avancement, observations, recommandations + projets/sites/localités/mesures liés.",
            parameters: { type: 'object', properties: {} }
        }
    },
    {
        type: 'function',
        function: {
            name: 'get_pv',
            description: 'Récupère le détail complet d\'un PV de visite par ID.',
            parameters: {
                type: 'object',
                properties: { id: { type: 'integer' } },
                required: ['id']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'list_sites',
            description: `Liste les sites d'intervention (points géolocalisés) visibles par l'utilisateur. Retourne nom, description, localisation (région/département/commune), coordonnées, vulnérabilité, marqueur PCS, et le projet associé. Capé à ${LIST_CAP} résultats — utiliser les filtres pour cibler.`,
            parameters: {
                type: 'object',
                properties: {
                    project_id:    { type: 'integer', description: 'Filtrer sur un projet précis' },
                    structure:     { type: 'string',  description: 'Code structure du projet (ex: DPGI, ONAS)' },
                    vulnerability: { type: 'string',  enum: ['normal', 'elevee', 'tres_elevee'] },
                    region:        { type: 'string',  description: 'Région (ex: Dakar, Thiès)' },
                    departement:   { type: 'string' },
                    commune:       { type: 'string' },
                    is_pcs:        { type: 'boolean', description: 'Sites PCS (Plan Communal de Sauvegarde) uniquement. Réservé aux projets DPGI.' }
                }
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'list_geometries',
            description: `Liste les tracés (polylignes et polygones) dessinés sur la carte : conduites de drainage, zones d'intervention, zones inondables. Retourne nom, kind (linestring/polygon), usage, structure, vulnérabilité et projet. Capé à ${LIST_CAP} résultats.`,
            parameters: {
                type: 'object',
                properties: {
                    project_id:    { type: 'integer', description: 'Filtrer sur un projet précis' },
                    structure:     { type: 'string',  description: 'Code structure (ex: ONAS, DPGI)' },
                    usage:         { type: 'string',  enum: ['drainage', 'intervention', 'zone_inondable', 'autre'] },
                    kind:          { type: 'string',  enum: ['linestring', 'polygon'] },
                    vulnerability: { type: 'string',  enum: ['normal', 'elevee', 'tres_elevee'] }
                }
            }
        }
    }
];

// ==================== Exécution d'un tool ====================

async function executeTool(name, args, user) {
    try {
        if (name === 'list_projects') {
            const projects = await getProjectsForUser(user, args);
            return projects.map(p => ({
                id: p.id,
                titre: p.title,
                structure: p.structure_code,
                statut: STATUS_LABELS[p.status] || p.status,
                priorite: PRIORITY_LABELS[p.priority || 'normale'],
                avancement_pct: p.progress_percentage || 0,
                echeance: p.deadline_date,
                chef: p.project_manager_first_name
                    ? `${p.project_manager_first_name} ${p.project_manager_last_name || ''}`.trim()
                    : null
            }));
        }

        if (name === 'get_project') {
            const project = await ProjectModel.findById(args.id);
            if (!project) return { error: 'Projet non trouvé' };
            // Vérif accès pour tous les non-admin (inclut commandement_territorial)
            const access = await canUserAccessProject(user, args.id);
            if (!access) return { error: 'Accès refusé à ce projet' };
            return {
                id: project.id,
                titre: project.title,
                structure: project.structure_code,
                statut: STATUS_LABELS[project.status] || project.status,
                priorite: PRIORITY_LABELS[project.priority || 'normale'],
                type: TYPE_LABELS[project.project_type] || null,
                avancement_pct: project.progress_percentage || 0,
                date_debut: project.start_date,
                echeance: project.deadline_date,
                budget_fcfa: project.budget ? Number(project.budget) : null,
                chef: project.project_manager_first_name
                    ? `${project.project_manager_first_name} ${project.project_manager_last_name || ''}`.trim()
                    : null,
                description: project.description,
                contraintes: project.constraints,
                mesures_attendues: project.expected_measures,
                nb_sites: (project.sites || []).length,
                sites: (project.sites || []).slice(0, 10).map(s => ({
                    nom: s.name, region: s.region, commune: s.commune
                })),
                mesures: (project.measures || []).map(m => ({
                    description: m.description,
                    type: m.type,
                    statut: m.status,
                    structure_assignee: m.structure_code,
                    utilisateur_assigne: m.assigned_username
                        ? `${m.assigned_first_name || ''} ${m.assigned_last_name || ''}`.trim() || m.assigned_username
                        : null
                })),
                structures_assignees: (project.assigned_structures || []).map(s => s.code)
            };
        }

        if (name === 'get_stats') {
            const projects = await getProjectsForUser(user, {});
            const stats = {
                total: projects.length,
                par_statut: { demarrage: 0, en_cours: 0, termine: 0, retard: 0, annule: 0 },
                par_priorite: { normale: 0, haute: 0, urgente: 0 },
                par_structure: {},
                avancement_moyen_pct: 0
            };
            let sum = 0;
            for (const p of projects) {
                stats.par_statut[p.status] = (stats.par_statut[p.status] || 0) + 1;
                const prio = p.priority || 'normale';
                stats.par_priorite[prio] = (stats.par_priorite[prio] || 0) + 1;
                const code = p.structure_code || 'INCONNU';
                stats.par_structure[code] = (stats.par_structure[code] || 0) + 1;
                sum += p.progress_percentage || 0;
            }
            stats.avancement_moyen_pct = projects.length ? Math.round(sum / projects.length) : 0;
            return stats;
        }

        if (name === 'list_structures') {
            const all = await StructureModel.findAll();
            return all.map(s => ({ id: s.id, code: s.code, name: s.name, description: s.description }));
        }

        if (name === 'list_observations') {
            const observations = await ObservationModel.findAll(args || {});
            return observations.map(o => ({
                id: o.id,
                titre: o.title,
                contenu: o.content,
                priorite: o.priority,
                echeance: o.deadline,
                projet_id: o.project_id,
                projet_titre: o.project_title || null,
                auteur_prenom: o.author_first_name || null,
                auteur_nom: o.author_last_name || null,
                auteur_nom_complet: [o.author_first_name, o.author_last_name].filter(Boolean).join(' ') || o.author_username || null,
                auteur_titre: o.author_title || null,
                auteur_username: o.author_username || null,
                cree_le: o.created_at
            }));
        }

        if (name === 'list_pv') {
            const pvs = await PvModel.findAllVisible(user);
            return pvs.map(p => ({
                id: p.id,
                titre: p.title,
                priorite: p.priority,
                territoire: `${p.territorial_level}=${p.territorial_value}`,
                date_visite: p.visit_date,
                avancement: p.avancement,
                observations: p.observations,
                recommandations: p.recommendations,
                notes: p.content,
                auteur_prenom: p.author_first_name || null,
                auteur_nom: p.author_last_name || null,
                auteur_nom_complet: [p.author_first_name, p.author_last_name].filter(Boolean).join(' ') || p.author_username || null,
                auteur_titre: p.author_title || null,
                projets: (p.projects || []).map(x => ({ id: x.id, titre: x.title })),
                sites: (p.sites || []).map(x => ({ id: x.id, nom: x.name })),
                localites: (p.localities || []).map(x => [x.region, x.departement, x.arrondissement, x.commune].filter(Boolean).join(' › ')),
                mesures: (p.measures || []).map(x => ({ id: x.id, description: x.description })),
                cree_le: p.created_at
            }));
        }

        if (name === 'get_pv') {
            const pv = await PvModel.findByIdForUser(args.id, user);
            if (!pv) return { error: 'PV non trouvé ou accès refusé' };
            return {
                id: pv.id,
                titre: pv.title,
                priorite: pv.priority,
                territoire: `${pv.territorial_level}=${pv.territorial_value}`,
                date_visite: pv.visit_date,
                avancement: pv.avancement,
                observations: pv.observations,
                recommandations: pv.recommendations,
                notes: pv.content,
                auteur_prenom: pv.author_first_name || null,
                auteur_nom: pv.author_last_name || null,
                auteur_nom_complet: [pv.author_first_name, pv.author_last_name].filter(Boolean).join(' ') || pv.author_username || null,
                auteur_titre: pv.author_title || null,
                projets: (pv.projects || []).map(x => ({ id: x.id, titre: x.title })),
                sites: (pv.sites || []).map(x => ({ id: x.id, nom: x.name })),
                localites: (pv.localities || []).map(x => ({ id: x.id, region: x.region, departement: x.departement, arrondissement: x.arrondissement, commune: x.commune })),
                mesures: (pv.measures || []).map(x => ({ id: x.id, description: x.description }))
            };
        }

        if (name === 'list_sites') {
            const visible = await getVisibleProjectIds(user);
            if (visible.size === 0) return [];

            const conds = ['s.project_id = ANY($1::int[])'];
            const params = [Array.from(visible)];
            let i = 2;
            if (Number.isInteger(args.project_id)) {
                conds.push(`s.project_id = $${i++}`); params.push(args.project_id);
            }
            if (args.vulnerability && ['normal','elevee','tres_elevee'].includes(args.vulnerability)) {
                conds.push(`s.vulnerability_level = $${i++}`); params.push(args.vulnerability);
            }
            if (args.region)      { conds.push(`s.region = $${i++}`);      params.push(args.region); }
            if (args.departement) { conds.push(`s.departement = $${i++}`); params.push(args.departement); }
            if (args.commune)     { conds.push(`s.commune = $${i++}`);     params.push(args.commune); }
            if (args.structure) {
                conds.push(`UPPER(st.code) = $${i++}`); params.push(String(args.structure).toUpperCase());
            }
            if (args.is_pcs === true || args.is_pcs === false) {
                conds.push(`s.is_pcs = $${i++}`); params.push(args.is_pcs);
            }

            const result = await db.query(`
                SELECT s.id, s.name, s.description, s.region, s.departement, s.commune,
                       s.latitude, s.longitude, s.is_pcs, s.vulnerability_level,
                       p.id as project_id, p.title as project_title, p.status as project_status,
                       st.code as structure_code
                FROM sites s
                INNER JOIN projects p ON s.project_id = p.id AND p.deleted_at IS NULL
                LEFT JOIN structures st ON p.structure_id = st.id
                WHERE ${conds.join(' AND ')}
                ORDER BY s.name
                LIMIT ${LIST_CAP}
            `, params);

            return result.rows.map(r => ({
                id: r.id,
                nom: r.name,
                description: r.description,
                region: r.region,
                departement: r.departement,
                commune: r.commune,
                latitude: r.latitude != null ? Number(r.latitude) : null,
                longitude: r.longitude != null ? Number(r.longitude) : null,
                pcs: !!r.is_pcs,
                vulnerabilite: r.vulnerability_level,
                projet_id: r.project_id,
                projet_titre: r.project_title,
                projet_statut: STATUS_LABELS[r.project_status] || r.project_status,
                structure: r.structure_code
            }));
        }

        if (name === 'list_geometries') {
            const visible = await getVisibleProjectIds(user);
            if (visible.size === 0) return [];

            const conds = ['g.project_id = ANY($1::int[])'];
            const params = [Array.from(visible)];
            let i = 2;
            if (Number.isInteger(args.project_id)) {
                conds.push(`g.project_id = $${i++}`); params.push(args.project_id);
            }
            if (args.usage && ['drainage','intervention','zone_inondable','autre'].includes(args.usage)) {
                conds.push(`g.usage_type = $${i++}`); params.push(args.usage);
            }
            if (args.kind && ['linestring','polygon'].includes(args.kind)) {
                conds.push(`g.kind = $${i++}`); params.push(args.kind);
            }
            if (args.vulnerability && ['normal','elevee','tres_elevee'].includes(args.vulnerability)) {
                conds.push(`g.vulnerability_level = $${i++}`); params.push(args.vulnerability);
            }
            if (args.structure) {
                conds.push(`UPPER(st.code) = $${i++}`); params.push(String(args.structure).toUpperCase());
            }

            const result = await db.query(`
                SELECT g.id, g.name, g.description, g.kind, g.usage_type, g.vulnerability_level,
                       g.project_id, p.title as project_title, p.status as project_status,
                       st.code as structure_code
                FROM geometries g
                INNER JOIN projects p ON g.project_id = p.id AND p.deleted_at IS NULL
                LEFT JOIN structures st ON g.structure_id = st.id
                WHERE ${conds.join(' AND ')}
                ORDER BY g.name
                LIMIT ${LIST_CAP}
            `, params);

            return result.rows.map(r => ({
                id: r.id,
                nom: r.name,
                description: r.description,
                type_geometrie: r.kind, // linestring | polygon
                usage: r.usage_type,
                vulnerabilite: r.vulnerability_level,
                projet_id: r.project_id,
                projet_titre: r.project_title,
                projet_statut: STATUS_LABELS[r.project_status] || r.project_status,
                structure: r.structure_code
            }));
        }

        return { error: `Tool ${name} inconnu` };
    } catch (err) {
        return { error: err.message };
    }
}

// ==================== Controller principal ====================

exports.chat = async (req, res, next) => {
    try {
        const { messages = [] } = req.body || {};
        if (!Array.isArray(messages) || messages.length === 0) {
            return res.status(400).json({ success: false, message: 'Messages requis' });
        }

        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) {
            return res.status(500).json({ success: false, message: 'OPENAI_API_KEY manquante' });
        }

        const client = new OpenAI({ apiKey });
        const model = process.env.OPENAI_MODEL || 'gpt-4.1-mini';

        // Contexte utilisateur
        const who = `${req.user.first_name || req.user.username} (${req.user.role})` +
            (req.user.structure_id ? `, structure_id=${req.user.structure_id}` : '');

        const today = new Date().toLocaleDateString('fr-FR');

        const systemMessage = {
            role: 'system',
            content: `Tu es l'assistant IA du CNGIRI (Comité National de Gestion Intégrée du Risque d'Inondation) au Sénégal.

Date du jour : ${today}
Utilisateur connecté : ${who}

Ton rôle : répondre aux questions sur l'état des projets de gestion des inondations en utilisant les données réelles de la plateforme.

Consignes :
- Utilise TOUJOURS les tools disponibles (list_projects, get_project, get_stats, list_structures, list_sites, list_geometries, list_observations, list_pv, get_pv) pour obtenir les données actualisées. Ne fabrique jamais de chiffres.
- Pour les questions sur les sites (points d'intervention, coordonnées, PCS, vulnérabilité), utilise list_sites avec des filtres (commune, région, structure…).
- Pour les questions sur les tracés (conduites de drainage, zones inondables, zones d'intervention), utilise list_geometries (filtre par usage: drainage / intervention / zone_inondable).
- Pour les questions sur les directives du Ministre, utilise list_observations.
- Pour les questions sur les visites de terrain, comptes-rendus, PV, recommandations du Préfet/Gouverneur, utilise list_pv (et get_pv pour le détail).
- Réponds en français, ton direct et factuel.
- Formate tes réponses en Markdown : gras, listes, tableaux quand c'est pertinent.
- Reste concis : va à l'essentiel, pas de longs préambules.
- Si une question est ambiguë, demande une précision.
- Si tu ne peux pas répondre avec les données disponibles, dis-le clairement.
- Pour les questions sur un projet précis, fais d'abord list_projects pour identifier l'ID, puis get_project.`
        };

        const conversationMessages = [systemMessage, ...messages];

        // Boucle d'appel avec tool use (max 5 itérations pour éviter les boucles infinies)
        let finalMessage = null;
        for (let iter = 0; iter < 5; iter++) {
            const completion = await client.chat.completions.create({
                model,
                messages: conversationMessages,
                tools,
                tool_choice: 'auto',
                temperature: 0.2
            });

            const msg = completion.choices[0].message;
            conversationMessages.push(msg);

            // Pas de tool call → réponse finale
            if (!msg.tool_calls || msg.tool_calls.length === 0) {
                finalMessage = msg;
                break;
            }

            // Exécuter chaque tool call
            for (const call of msg.tool_calls) {
                let args = {};
                try { args = JSON.parse(call.function.arguments || '{}'); } catch {}
                const result = await executeTool(call.function.name, args, req.user);
                conversationMessages.push({
                    role: 'tool',
                    tool_call_id: call.id,
                    content: JSON.stringify(result).slice(0, 30000) // cap pour éviter explosion
                });
            }
        }

        if (!finalMessage) {
            return res.status(500).json({ success: false, message: 'Pas de réponse générée' });
        }

        res.json({
            success: true,
            message: finalMessage.content || '',
            // Exposer l'usage pour debug éventuel
        });
    } catch (error) {
        console.error('Chat error:', error);
        next(error);
    }
};
