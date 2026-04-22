const OpenAI = require('openai');
const { marked } = require('marked');
const PDFDocument = require('pdfkit');
const {
    Document, Packer, Paragraph, HeadingLevel, TextRun, AlignmentType,
    Table, TableRow, TableCell, WidthType, BorderStyle, ShadingType
} = require('docx');

const ProjectModel = require('../models/project.model');
const ProjectStructure = require('../models/projectStructure.model');

const STATUS_LABELS = {
    demarrage: 'Démarrage', en_cours: 'En cours', termine: 'Terminé', retard: 'En retard', annule: 'Annulé'
};
const PRIORITY_LABELS = { normale: 'Normale', haute: 'Haute', urgente: 'Urgente' };
const TYPE_LABELS = { renforcement_resilience: 'Renforcement de la résilience', structurant: 'Structurant' };

// Compacte les données pour réduire les tokens envoyés au LLM
function summarizeProjects(projects) {
    return projects.map(p => ({
        id: p.id,
        titre: p.title,
        structure: p.structure_code,
        chef: p.project_manager_first_name ? `${p.project_manager_first_name} ${p.project_manager_last_name || ''}`.trim() : null,
        statut: STATUS_LABELS[p.status] || p.status,
        priorite: PRIORITY_LABELS[p.priority] || 'Normale',
        type: TYPE_LABELS[p.project_type] || null,
        avancement_pct: p.progress_percentage || 0,
        date_debut: p.start_date,
        echeance: p.deadline_date,
        budget_fcfa: p.budget ? Number(p.budget) : null,
        nb_sites: (p.sites || []).length,
        nb_mesures: (p.measures || []).length,
        description: (p.description || '').slice(0, 300),
        contraintes: (p.constraints || '').slice(0, 300),
        mesures_attendues: (p.expected_measures || '').slice(0, 300),
        mesures: (p.measures || []).map(m => ({
            description: (m.description || '').slice(0, 200),
            type: m.type,
            statut: m.status,
            structure_assignee: m.structure_code
        })),
        sites: (p.sites || []).map(s => ({ nom: s.name, commune: s.commune, region: s.region }))
    }));
}

function buildPrompt(projects, userContext) {
    const today = new Date().toLocaleDateString('fr-FR');
    return `Tu es analyste senior pour le CNGIRI (Comité National de Gestion Intégrée du Risque d'Inondation) au Sénégal.

Date du rapport : ${today}
Utilisateur : ${userContext}
Nombre de projets à analyser : ${projects.length}

Voici les données JSON des projets :
\`\`\`json
${JSON.stringify(projects, null, 2)}
\`\`\`

Produis un **rapport exécutif détaillé** en Markdown, en français, structuré ainsi :

# Rapport d'activité CNGIRI — ${today}

## 1. Résumé exécutif
Synthèse en 5-7 phrases : volume de projets, grandes tendances, état général, points d'attention majeurs.

## 2. État global
- Répartition par statut (démarrage / en cours / terminé / en retard / annulé)
- Répartition par priorité (normale / haute / urgente)
- Taux d'avancement moyen global
- Projets sans chef ou sans échéance (points à corriger)

## 3. Analyse par structure
Pour chaque structure qui porte des projets : nombre de projets, statut global, taux moyen d'avancement, faits marquants.

## 4. Projets prioritaires (urgents et haute priorité)
Liste détaillée : titre, structure, statut, avancement, échéance, blocages identifiés.

## 5. Projets en retard
Liste détaillée avec analyse des causes probables à partir des contraintes déclarées.

## 6. Mesures et actions
Synthèse des mesures préconisées vs exécutées par structure. Signaler les blocages récurrents.

## 7. Recommandations
3 à 5 recommandations actionnables, classées par impact/urgence, avec justification courte.

Consignes de style :
- Ton professionnel, factuel, direct.
- Pas de langue de bois, pas de formules creuses.
- Utilise des listes à puces et des tableaux Markdown quand utile.
- Cite les titres exacts des projets et codes des structures.
- Si une donnée est absente, dis-le explicitement plutôt que d'inventer.`;
}

async function callLLM(prompt) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error('OPENAI_API_KEY manquante dans .env');
    const client = new OpenAI({ apiKey });
    const model = process.env.OPENAI_MODEL || 'gpt-4.1-mini';

    const completion = await client.chat.completions.create({
        model,
        messages: [
            { role: 'system', content: 'Tu es un analyste senior spécialisé en gestion des risques d\'inondation et en pilotage de projets publics au Sénégal. Tu produis des rapports précis, structurés et actionnables.' },
            { role: 'user', content: prompt }
        ],
        temperature: 0.3
    });
    return completion.choices[0].message.content;
}

// ==================== PDF Generation ====================
const PDF_COLORS = {
    h1: '#202B5D',
    h2: '#202B5D',
    h3: '#3794C4',
    text: '#2c3e50',
    muted: '#7f8c8d',
    tableHeader: '#202B5D',
    tableHeaderText: '#FFFFFF',
    tableRowAlt: '#f5f7fa',
    tableBorder: '#dce3ed',
    accent: '#3794C4'
};

const renderInlinePdf = (text) => (text || '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/`(.+?)`/g, '$1')
    .replace(/\[(.+?)\]\(.+?\)/g, '$1');

// Réinitialise le flux de texte après une opération avec positionnement absolu
function resetFlow(doc) {
    doc.x = doc.page.margins.left;
}

function renderMarkdownToPdf(doc, markdown) {
    const tokens = marked.lexer(markdown);

    for (const t of tokens) {
        resetFlow(doc);

        if (t.type === 'heading') {
            if (doc.y > 700) doc.addPage();
            if (t.depth === 1) {
                doc.moveDown(0.3);
                doc.fontSize(22).fillColor(PDF_COLORS.h1).font('Helvetica-Bold').text(renderInlinePdf(t.text), { width: doc.page.width - doc.page.margins.left - doc.page.margins.right });
                const lineY = doc.y + 2;
                doc.moveTo(doc.page.margins.left, lineY).lineTo(doc.page.width - doc.page.margins.right, lineY).strokeColor(PDF_COLORS.h1).lineWidth(1.5).stroke();
                doc.moveDown(0.8);
            } else if (t.depth === 2) {
                doc.moveDown(0.6);
                doc.fontSize(15).fillColor(PDF_COLORS.h2).font('Helvetica-Bold').text(renderInlinePdf(t.text), { width: doc.page.width - doc.page.margins.left - doc.page.margins.right });
                doc.moveDown(0.4);
            } else {
                doc.moveDown(0.4);
                doc.fontSize(12).fillColor(PDF_COLORS.h3).font('Helvetica-Bold').text(renderInlinePdf(t.text), { width: doc.page.width - doc.page.margins.left - doc.page.margins.right });
                doc.moveDown(0.2);
            }
        } else if (t.type === 'paragraph') {
            doc.fontSize(10).fillColor(PDF_COLORS.text).font('Helvetica').text(renderInlinePdf(t.text), {
                align: 'justify',
                width: doc.page.width - doc.page.margins.left - doc.page.margins.right
            });
            doc.moveDown(0.5);
        } else if (t.type === 'list') {
            for (let i = 0; i < t.items.length; i++) {
                const item = t.items[i];
                const bullet = t.ordered ? `${(t.start || 1) + i}.` : '•';
                resetFlow(doc);
                const startY = doc.y;
                // Bullet
                doc.fontSize(10).fillColor(PDF_COLORS.accent).font('Helvetica-Bold').text(bullet, doc.page.margins.left, startY, { continued: false, lineBreak: false, width: 12 });
                // Texte aligné à droite du bullet
                doc.fontSize(10).fillColor(PDF_COLORS.text).font('Helvetica').text(renderInlinePdf(item.text), doc.page.margins.left + 14, startY, {
                    width: doc.page.width - doc.page.margins.left - doc.page.margins.right - 14,
                    align: 'left'
                });
                doc.moveDown(0.2);
            }
            doc.moveDown(0.3);
        } else if (t.type === 'table') {
            renderPdfTable(doc, t);
            resetFlow(doc);
            doc.moveDown(0.5);
        } else if (t.type === 'hr') {
            doc.moveDown(0.2);
            doc.moveTo(doc.page.margins.left, doc.y).lineTo(doc.page.width - doc.page.margins.right, doc.y).strokeColor('#dddddd').lineWidth(0.5).stroke();
            doc.moveDown(0.5);
        } else if (t.type === 'blockquote') {
            doc.fontSize(10).fillColor(PDF_COLORS.muted).font('Helvetica-Oblique').text(renderInlinePdf(t.text || ''), {
                indent: 10,
                width: doc.page.width - doc.page.margins.left - doc.page.margins.right - 10
            });
            doc.moveDown(0.4);
        } else if (t.type === 'space') {
            doc.moveDown(0.3);
        }
    }
}

// Calcule largeurs proportionnelles au contenu (avec min/max)
function computeColumnWidths(doc, table, tableWidth, padding) {
    const cols = table.header.length;
    const minCol = 50;
    const maxCol = tableWidth * 0.55;
    doc.fontSize(9).font('Helvetica');

    // Mesure de chaque cellule
    const measures = new Array(cols).fill(0);
    for (let i = 0; i < cols; i++) {
        const h = String(table.header[i].text || table.header[i] || '');
        measures[i] = Math.max(measures[i], doc.widthOfString(h, { font: 'Helvetica-Bold' }) + 2 * padding + 8);
    }
    for (const row of table.rows) {
        for (let i = 0; i < cols && i < row.length; i++) {
            const text = String((row[i] && row[i].text) || row[i] || '');
            // Limite à la largeur de la première ligne pour l'estimation
            const firstLine = text.split(/\s+/).slice(0, 10).join(' ');
            measures[i] = Math.max(measures[i], Math.min(doc.widthOfString(firstLine) + 2 * padding + 6, maxCol));
        }
    }
    // Clamp au min
    for (let i = 0; i < cols; i++) measures[i] = Math.max(measures[i], minCol);

    // Normaliser pour remplir toute la largeur
    const sum = measures.reduce((a, b) => a + b, 0);
    const scale = tableWidth / sum;
    return measures.map(m => m * scale);
}

function renderPdfTable(doc, table) {
    resetFlow(doc);
    const left = doc.page.margins.left;
    const tableWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const padding = 5;

    const colWidths = computeColumnWidths(doc, table, tableWidth, padding);
    const cols = colWidths.length;

    const drawHeader = () => {
        const headerY = doc.y;
        // Calcul hauteur header en fonction du contenu
        doc.fontSize(9).font('Helvetica-Bold');
        let headerH = 18;
        for (let i = 0; i < cols; i++) {
            const txt = String(table.header[i].text || table.header[i] || '');
            const h = doc.heightOfString(txt, { width: colWidths[i] - 2 * padding }) + 8;
            if (h > headerH) headerH = h;
        }
        doc.rect(left, headerY, tableWidth, headerH).fill(PDF_COLORS.tableHeader);
        doc.fillColor(PDF_COLORS.tableHeaderText).fontSize(9).font('Helvetica-Bold');
        let x = left;
        for (let i = 0; i < cols; i++) {
            const txt = String(table.header[i].text || table.header[i] || '');
            doc.text(txt, x + padding, headerY + 4, { width: colWidths[i] - 2 * padding, lineBreak: true });
            x += colWidths[i];
        }
        doc.y = headerY + headerH;
    };

    // Saut de page si nécessaire
    if (doc.y > 680) doc.addPage();
    drawHeader();

    doc.fillColor(PDF_COLORS.text).fontSize(9).font('Helvetica');
    for (let r = 0; r < table.rows.length; r++) {
        const row = table.rows[r];
        // Calcul hauteur de ligne
        let h = 14;
        for (let i = 0; i < cols && i < row.length; i++) {
            const text = String((row[i] && row[i].text) || row[i] || '');
            const cellH = doc.heightOfString(text, { width: colWidths[i] - 2 * padding }) + 8;
            if (cellH > h) h = cellH;
        }
        // Saut de page si ligne ne tient pas
        if (doc.y + h > doc.page.height - doc.page.margins.bottom) {
            doc.addPage();
            drawHeader();
            doc.fillColor(PDF_COLORS.text).fontSize(9).font('Helvetica');
        }
        const y = doc.y;
        // Bande alternée
        if (r % 2 === 1) {
            doc.rect(left, y, tableWidth, h).fill(PDF_COLORS.tableRowAlt);
            doc.fillColor(PDF_COLORS.text);
        }
        // Cellules
        let x = left;
        for (let i = 0; i < cols; i++) {
            const text = String((row[i] && row[i].text) || row[i] || '');
            doc.text(text, x + padding, y + 4, { width: colWidths[i] - 2 * padding, lineBreak: true });
            x += colWidths[i];
        }
        doc.y = y + h;

        // Ligne séparatrice horizontale
        doc.moveTo(left, doc.y).lineTo(left + tableWidth, doc.y).strokeColor(PDF_COLORS.tableBorder).lineWidth(0.3).stroke();
    }

    // Bordure extérieure
    const tableTop = doc.y; // approx; on va redessiner un rect autour
    // (Déjà fait par les bandes + séparateurs — on ajoute juste les bordures verticales)
}

async function generatePdfBuffer(markdown, title) {
    return new Promise((resolve, reject) => {
        const doc = new PDFDocument({
            size: 'A4',
            margins: { top: 60, bottom: 60, left: 50, right: 50 },
            info: { Title: title, Author: 'CNGIRI Platform' }
        });
        const chunks = [];
        doc.on('data', c => chunks.push(c));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        // Footer avec numéro de page
        let pageNumber = 0;
        doc.on('pageAdded', () => { pageNumber++; });
        pageNumber = 1;

        renderMarkdownToPdf(doc, markdown);

        // Ajouter footer à chaque page
        const range = doc.bufferedPageRange();
        for (let i = range.start; i < range.start + range.count; i++) {
            doc.switchToPage(i);
            doc.fontSize(8).fillColor('#888').font('Helvetica')
                .text(
                    `CNGIRI — Rapport généré le ${new Date().toLocaleDateString('fr-FR')} — Page ${i + 1} / ${range.count}`,
                    50, doc.page.height - 40,
                    { align: 'center', width: doc.page.width - 100 }
                );
        }
        doc.end();
    });
}

// ==================== DOCX Generation ====================
const DOCX_COLORS = {
    primary: '202B5D',
    secondary: '3794C4',
    headerBg: '202B5D',
    headerText: 'FFFFFF',
    rowAlt: 'F5F7FA',
    text: '2C3E50'
};

function inlineDocx(text) {
    return (text || '')
        .replace(/\*\*(.+?)\*\*/g, '$1')
        .replace(/\*(.+?)\*/g, '$1')
        .replace(/`(.+?)`/g, '$1')
        .replace(/\[(.+?)\]\(.+?\)/g, '$1');
}

function buildDocxCell(text, opts = {}) {
    const { bold = false, bgColor = null, textColor = DOCX_COLORS.text, size = 20 } = opts;
    return new TableCell({
        margins: { top: 100, bottom: 100, left: 120, right: 120 },
        shading: bgColor ? { type: ShadingType.CLEAR, color: 'auto', fill: bgColor } : undefined,
        children: [new Paragraph({
            children: [new TextRun({
                text: inlineDocx(text),
                bold,
                color: textColor,
                size,
                font: 'Calibri'
            })]
        })]
    });
}

function buildDocxTable(mdTable) {
    const headers = mdTable.header.map(h => String(h.text || h || ''));
    const rows = mdTable.rows.map(r => r.map(c => String((c && c.text) || c || '')));

    const headerRow = new TableRow({
        tableHeader: true,
        children: headers.map(h => buildDocxCell(h, {
            bold: true,
            bgColor: DOCX_COLORS.headerBg,
            textColor: DOCX_COLORS.headerText,
            size: 20
        }))
    });

    const bodyRows = rows.map((row, idx) => new TableRow({
        children: headers.map((_, i) => buildDocxCell(row[i] || '', {
            bgColor: idx % 2 === 1 ? DOCX_COLORS.rowAlt : null,
            size: 20
        }))
    }));

    const border = { style: BorderStyle.SINGLE, size: 4, color: 'DCE3ED' };

    return new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: {
            top: border, bottom: border, left: border, right: border,
            insideHorizontal: border, insideVertical: border
        },
        rows: [headerRow, ...bodyRows]
    });
}

function markdownToDocxElements(markdown) {
    const tokens = marked.lexer(markdown);
    const children = [];

    const levelMap = {
        1: HeadingLevel.HEADING_1,
        2: HeadingLevel.HEADING_2,
        3: HeadingLevel.HEADING_3,
        4: HeadingLevel.HEADING_4
    };

    for (const t of tokens) {
        if (t.type === 'heading') {
            children.push(new Paragraph({
                heading: levelMap[t.depth] || HeadingLevel.HEADING_4,
                spacing: { before: t.depth === 1 ? 240 : 200, after: 120 },
                children: [new TextRun({
                    text: inlineDocx(t.text),
                    bold: true,
                    color: t.depth <= 2 ? DOCX_COLORS.primary : DOCX_COLORS.secondary
                })]
            }));
        } else if (t.type === 'paragraph') {
            children.push(new Paragraph({
                children: [new TextRun({
                    text: inlineDocx(t.text),
                    size: 22,
                    color: DOCX_COLORS.text
                })],
                spacing: { after: 120, line: 300 },
                alignment: AlignmentType.JUSTIFIED
            }));
        } else if (t.type === 'list') {
            for (const item of t.items) {
                children.push(new Paragraph({
                    children: [new TextRun({
                        text: inlineDocx(item.text),
                        size: 22,
                        color: DOCX_COLORS.text
                    })],
                    bullet: { level: 0 },
                    spacing: { after: 60 }
                }));
            }
            children.push(new Paragraph({ text: '', spacing: { after: 120 } }));
        } else if (t.type === 'table') {
            children.push(buildDocxTable(t));
            children.push(new Paragraph({ text: '', spacing: { after: 120 } }));
        } else if (t.type === 'hr') {
            children.push(new Paragraph({
                border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: 'DCE3ED' } },
                spacing: { before: 120, after: 120 }
            }));
        } else if (t.type === 'space') {
            // Ignorer : l'espacement est déjà géré par les spacing individuels
        }
    }

    return children;
}

async function generateDocxBuffer(markdown, title) {
    const doc = new Document({
        creator: 'CNGIRI Platform',
        title,
        styles: {
            default: {
                document: { run: { font: 'Calibri', size: 22 } },
                heading1: { run: { font: 'Calibri', size: 32, bold: true, color: DOCX_COLORS.primary } },
                heading2: { run: { font: 'Calibri', size: 26, bold: true, color: DOCX_COLORS.primary } },
                heading3: { run: { font: 'Calibri', size: 22, bold: true, color: DOCX_COLORS.secondary } },
                heading4: { run: { font: 'Calibri', size: 20, bold: true, color: DOCX_COLORS.secondary } }
            }
        },
        sections: [{
            properties: {
                page: { margin: { top: 1000, right: 1000, bottom: 1000, left: 1000 } }
            },
            children: markdownToDocxElements(markdown)
        }]
    });
    return Packer.toBuffer(doc);
}

// ==================== Controller ====================
exports.generateReport = async (req, res, next) => {
    try {
        const { format = 'pdf', status, structure_id, priority } = req.body || {};

        if (!['pdf', 'docx'].includes(format)) {
            return res.status(400).json({ success: false, message: 'Format invalide (pdf|docx)' });
        }

        // Charger les projets selon le rôle
        let projects;
        if (req.user.role === 'commandement_territorial') {
            projects = await ProjectModel.findByTerritory(req.user.territorial_level, req.user.territorial_value);
        } else if ((req.user.role === 'utilisateur' || req.user.role === 'directeur') && req.user.structure_id) {
            projects = await ProjectStructure.getProjectsByStructure(req.user.structure_id);
        } else {
            projects = await ProjectModel.findAll({});
        }

        // Filtres optionnels
        if (status) projects = projects.filter(p => p.status === status);
        if (priority) projects = projects.filter(p => p.priority === priority);
        if (structure_id) {
            const sid = parseInt(structure_id);
            projects = projects.filter(p => p.structure_id === sid);
        }

        if (projects.length === 0) {
            return res.status(400).json({ success: false, message: 'Aucun projet ne correspond aux filtres' });
        }

        // Charger détails complets
        const detailed = await Promise.all(projects.map(p => ProjectModel.findById(p.id)));

        // Construire le prompt
        const compact = summarizeProjects(detailed);
        const userContext = `${req.user.first_name || req.user.username} (${req.user.role})`;
        const prompt = buildPrompt(compact, userContext);

        // Appeler le LLM
        const markdown = await callLLM(prompt);

        const title = `CNGIRI Rapport ${new Date().toISOString().slice(0, 10)}`;
        const baseName = `CNGIRI_Rapport_${new Date().toISOString().slice(0, 10)}`;

        if (format === 'pdf') {
            const buf = await generatePdfBuffer(markdown, title);
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename="${baseName}.pdf"`);
            return res.end(buf);
        } else {
            const buf = await generateDocxBuffer(markdown, title);
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
            res.setHeader('Content-Disposition', `attachment; filename="${baseName}.docx"`);
            return res.end(buf);
        }
    } catch (error) {
        console.error('Report generation error:', error);
        next(error);
    }
};
