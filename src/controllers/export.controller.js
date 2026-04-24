const ExcelJS = require('exceljs');
const ProjectModel = require('../models/project.model');
const ProjectStructure = require('../models/projectStructure.model');

const STATUS_LABELS = {
    demarrage: 'Démarrage',
    en_cours: 'En cours',
    termine: 'Terminé',
    retard: 'En retard',
    annule: 'Annulé'
};

const PRIORITY_LABELS = {
    normale: 'Normale',
    haute: 'Haute',
    urgente: 'Urgente'
};

const TYPE_LABELS = {
    renforcement_resilience: 'Renforcement de la résilience',
    structurant: 'Structurant'
};

const MEASURE_STATUS_LABELS = {
    preconisee: 'Préconisée',
    executee: 'Exécutée',
    non_executee: 'Non exécutée',
    observations: 'Observations'
};

// Couleurs ARGB pour mise en forme (cohérent avec la palette UI)
const PRIORITY_FILL = {
    urgente: 'FFE74C3C',
    haute: 'FFE67E22',
    normale: null
};

const STATUS_FILL = {
    demarrage: 'FFF39C12',
    en_cours: 'FF3794C4',
    termine: 'FF27AE60',
    retard: 'FFE74C3C',
    annule: 'FF8896AB'
};

function setHeaderStyle(row) {
    row.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF202B5D' } };
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
        cell.alignment = { vertical: 'middle', horizontal: 'left' };
        cell.border = {
            bottom: { style: 'medium', color: { argb: 'FF202B5D' } }
        };
    });
    row.height = 22;
}

function autoFitColumns(sheet, min = 10, max = 60) {
    sheet.columns.forEach(col => {
        let maxLen = col.header ? String(col.header).length : 10;
        col.eachCell({ includeEmpty: false }, cell => {
            const len = cell.value == null ? 0 : String(cell.value).length;
            if (len > maxLen) maxLen = len;
        });
        col.width = Math.min(Math.max(maxLen + 2, min), max);
    });
}

/**
 * Charge les détails des projets par petits lots pour ne pas saturer le pool pg.
 * Chaque findById fait ~8 SELECTs séquentiels en interne ; en parallèle total
 * sur N projets on atteint vite la limite de connexions du pool (10 par défaut,
 * plus bas sur Render starter) → "timeout exceeded when trying to connect".
 *
 * Concurrence 3 : compromis entre vitesse et pression pool. Pour 50 projets
 * × ~50 ms/query on reste sous la seconde pour le batch.
 */
async function loadDetailsWithConcurrency(projects, concurrency = 3) {
    const results = new Array(projects.length);
    let cursor = 0;
    async function worker() {
        while (true) {
            const i = cursor++;
            if (i >= projects.length) return;
            try {
                results[i] = await ProjectModel.findById(projects[i].id);
            } catch (err) {
                // Un projet qui échoue ne doit pas faire tomber l'export entier.
                // On laisse results[i] = undefined ; il sera filtré plus bas.
                console.error(`Export: findById(${projects[i].id}) a échoué:`, err.message);
                results[i] = null;
            }
        }
    }
    await Promise.all(Array.from({ length: Math.min(concurrency, projects.length) }, worker));
    return results.filter(Boolean);
}

exports.exportProjectsXlsx = async (req, res, next) => {
    try {
        // Récupérer tous les projets visibles selon le rôle
        let projects;
        if (req.user.role === 'commandement_territorial') {
            projects = await ProjectModel.findByTerritory(req.user.territorial_level, req.user.territorial_value);
        } else if ((req.user.role === 'utilisateur' || req.user.role === 'directeur') && req.user.structure_id) {
            projects = await ProjectStructure.getProjectsByStructure(req.user.structure_id);
        } else {
            projects = await ProjectModel.findAll({});
        }

        // Charger les détails complets (measures, sites, funding…) par lots de 3
        // pour ne pas saturer le pool pg. Voir loadDetailsWithConcurrency.
        const detailed = await loadDetailsWithConcurrency(projects, 3);

        const wb = new ExcelJS.Workbook();
        wb.creator = 'CNGIRI Platform';
        wb.created = new Date();

        // ==================== Feuille 1 : Projets (vue d'ensemble) ====================
        const projSheet = wb.addWorksheet('Projets', {
            views: [{ state: 'frozen', ySplit: 1 }]
        });

        projSheet.columns = [
            { header: 'ID',                     key: 'id',              width: 6 },
            { header: 'Titre',                  key: 'title',           width: 40 },
            { header: 'Structure principale',   key: 'structure',       width: 30 },
            { header: 'Structures associées',   key: 'secondaries',     width: 25 },
            { header: 'Chef de projet',         key: 'manager',         width: 25 },
            { header: 'Statut',                 key: 'status',          width: 14 },
            { header: 'Priorité',               key: 'priority',        width: 12 },
            { header: 'Type',                   key: 'project_type',    width: 25 },
            { header: 'Avancement (%)',         key: 'progress',        width: 14 },
            { header: 'Date début',             key: 'start',           width: 12 },
            { header: 'Échéance',               key: 'deadline',        width: 12 },
            { header: 'Budget (FCFA)',          key: 'budget',          width: 18 },
            { header: 'Sites',                  key: 'sites_count',     width: 8 },
            { header: 'Mesures',                key: 'measures_count',  width: 9 },
            { header: 'Description',            key: 'description',     width: 50 },
            { header: 'Contraintes',            key: 'constraints',     width: 50 },
            { header: 'Mesures attendues',      key: 'expected',        width: 50 },
            { header: 'Créé le',                key: 'created_at',      width: 12 }
        ];

        setHeaderStyle(projSheet.getRow(1));

        detailed.forEach(p => {
            const secondaries = (p.assigned_structures || [])
                .filter(s => s.id !== p.structure_id)
                .map(s => s.code).join(', ');
            const manager = p.project_manager_first_name
                ? `${p.project_manager_first_name} ${p.project_manager_last_name || ''}`.trim()
                : '';

            const row = projSheet.addRow({
                id: p.id,
                title: p.title,
                structure: p.structure_name ? `${p.structure_name} (${p.structure_code})` : '',
                secondaries,
                manager,
                status: STATUS_LABELS[p.status] || p.status || '',
                priority: PRIORITY_LABELS[p.priority] || 'Normale',
                project_type: TYPE_LABELS[p.project_type] || '',
                progress: p.progress_percentage || 0,
                start: p.start_date ? new Date(p.start_date) : null,
                deadline: p.deadline_date ? new Date(p.deadline_date) : null,
                budget: p.budget ? Number(p.budget) : null,
                sites_count: (p.sites || []).length,
                measures_count: (p.measures || []).length,
                description: p.description || '',
                constraints: p.constraints || '',
                expected: p.expected_measures || '',
                created_at: p.created_at ? new Date(p.created_at) : null
            });

            // Statut coloré
            const statusCell = row.getCell('status');
            const statusFill = STATUS_FILL[p.status];
            if (statusFill) {
                statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: statusFill } };
                statusCell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
                statusCell.alignment = { horizontal: 'center' };
            }

            // Priorité colorée
            const prioCell = row.getCell('priority');
            const prioFill = PRIORITY_FILL[p.priority];
            if (prioFill) {
                prioCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: prioFill } };
                prioCell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
                prioCell.alignment = { horizontal: 'center' };
            }

            row.getCell('progress').numFmt = '0"%"';
            row.getCell('budget').numFmt = '#,##0 "FCFA"';
            row.getCell('start').numFmt = 'dd/mm/yyyy';
            row.getCell('deadline').numFmt = 'dd/mm/yyyy';
            row.getCell('created_at').numFmt = 'dd/mm/yyyy';
            row.alignment = { vertical: 'top', wrapText: true };
        });

        projSheet.autoFilter = { from: 'A1', to: { row: 1, column: projSheet.columns.length } };

        // ==================== Feuille 2 : Mesures ====================
        const measSheet = wb.addWorksheet('Mesures', {
            views: [{ state: 'frozen', ySplit: 1 }]
        });
        measSheet.columns = [
            { header: 'ID Projet',          key: 'pid',         width: 10 },
            { header: 'Projet',             key: 'project',     width: 40 },
            { header: 'Description mesure', key: 'description', width: 50 },
            { header: 'Type',               key: 'type',        width: 18 },
            { header: 'Statut',             key: 'status',      width: 14 },
            { header: 'Structure assignée', key: 'structure',   width: 20 },
            { header: 'Utilisateur assigné', key: 'user',       width: 25 },
            { header: 'Contraintes',        key: 'constraints', width: 40 }
        ];
        setHeaderStyle(measSheet.getRow(1));

        detailed.forEach(p => {
            (p.measures || []).forEach(m => {
                const row = measSheet.addRow({
                    pid: p.id,
                    project: p.title,
                    description: m.description || '',
                    type: m.type || '',
                    status: MEASURE_STATUS_LABELS[m.status] || m.status || '',
                    structure: m.structure_code || '',
                    user: m.assigned_username
                        ? `${m.assigned_first_name || ''} ${m.assigned_last_name || ''}`.trim() || m.assigned_username
                        : '',
                    constraints: m.constraints || ''
                });
                row.alignment = { vertical: 'top', wrapText: true };
            });
        });
        measSheet.autoFilter = { from: 'A1', to: { row: 1, column: measSheet.columns.length } };

        // ==================== Feuille 3 : Sites ====================
        const sitesSheet = wb.addWorksheet('Sites', { views: [{ state: 'frozen', ySplit: 1 }] });
        sitesSheet.columns = [
            { header: 'ID Projet',     key: 'pid',       width: 10 },
            { header: 'Projet',        key: 'project',   width: 40 },
            { header: 'Nom du site',   key: 'name',      width: 30 },
            { header: 'Description',   key: 'description', width: 40 },
            { header: 'Région',        key: 'region',    width: 18 },
            { header: 'Département',   key: 'departement', width: 18 },
            { header: 'Arrondissement', key: 'arrondissement', width: 18 },
            { header: 'Commune',       key: 'commune',   width: 18 },
            { header: 'Latitude',      key: 'lat',       width: 12 },
            { header: 'Longitude',     key: 'lng',       width: 12 }
        ];
        setHeaderStyle(sitesSheet.getRow(1));
        detailed.forEach(p => {
            (p.sites || []).forEach(s => {
                sitesSheet.addRow({
                    pid: p.id,
                    project: p.title,
                    name: s.name || '',
                    description: s.description || '',
                    region: s.region || '',
                    departement: s.departement || '',
                    arrondissement: s.arrondissement || '',
                    commune: s.commune || '',
                    lat: s.latitude,
                    lng: s.longitude
                });
            });
        });
        sitesSheet.autoFilter = { from: 'A1', to: { row: 1, column: sitesSheet.columns.length } };

        // ==================== Feuille 4 : Financements ====================
        const fundSheet = wb.addWorksheet('Financements', { views: [{ state: 'frozen', ySplit: 1 }] });
        fundSheet.columns = [
            { header: 'ID Projet',       key: 'pid',       width: 10 },
            { header: 'Projet',          key: 'project',   width: 40 },
            { header: 'Source',          key: 'source',    width: 30 },
            { header: 'Montant',         key: 'amount',    width: 18 },
            { header: 'Devise',          key: 'currency',  width: 10 },
            { header: 'Disponibilité',   key: 'availability', width: 15 }
        ];
        setHeaderStyle(fundSheet.getRow(1));
        detailed.forEach(p => {
            (p.funding || []).forEach(f => {
                const row = fundSheet.addRow({
                    pid: p.id,
                    project: p.title,
                    source: f.source || '',
                    amount: f.amount ? Number(f.amount) : null,
                    currency: f.currency || 'FCFA',
                    availability: f.availability || ''
                });
                row.getCell('amount').numFmt = '#,##0';
            });
        });
        fundSheet.autoFilter = { from: 'A1', to: { row: 1, column: fundSheet.columns.length } };

        // Appliquer autofit en dernier (après toutes les rows)
        [measSheet, sitesSheet, fundSheet].forEach(s => autoFitColumns(s));

        // Envoyer
        const filename = `CNGIRI_Projets_${new Date().toISOString().slice(0, 10)}.xlsx`;
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        await wb.xlsx.write(res);
        res.end();
    } catch (error) {
        // Pool pg saturé : message plus parlant (503) plutôt qu'un 500 générique.
        if (error && error.message && error.message.includes('timeout exceeded when trying to connect')) {
            return res.status(503).json({
                success: false,
                message: 'La base de données est temporairement surchargée. Réessayez dans quelques secondes.',
                statusCode: 503
            });
        }
        next(error);
    }
};
