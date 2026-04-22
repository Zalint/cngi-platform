const OpenAI = require('openai');
const ProjectModel = require('../models/project.model');
const ProjectStructure = require('../models/projectStructure.model');
const StructureModel = require('../models/structure.model');
const { canUserAccessProject } = require('../utils/projectAccess');

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
    } else if ((user.role === 'utilisateur' || user.role === 'directeur') && user.structure_id) {
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
- Utilise TOUJOURS les tools disponibles (list_projects, get_project, get_stats, list_structures) pour obtenir les données actualisées. Ne fabrique jamais de chiffres.
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
