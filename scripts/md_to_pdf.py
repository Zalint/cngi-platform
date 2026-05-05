#!/usr/bin/env python
"""Convertit docs/SIG_HANDOVER.md en PDF avec une mise en page propre.

Sortie : page de titre, sommaire automatique, sections numérotées,
code blocks, tableaux, pied de page CNGIRI.

Usage : python scripts/md_to_pdf.py
"""

import os
import re
import sys
from datetime import datetime

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm, mm
from reportlab.platypus import (
    BaseDocTemplate, Frame, PageBreak, PageTemplate, Paragraph, Preformatted,
    Spacer, Table, TableStyle, NextPageTemplate
)
from reportlab.pdfgen import canvas

# Couleurs CNGIRI
NAVY = colors.HexColor("#202B5D")
BLUE = colors.HexColor("#3794C4")
GREY_TEXT = colors.HexColor("#475569")
GREY_LIGHT = colors.HexColor("#94a3b8")
BG_CODE = colors.HexColor("#f1f5f9")
BORDER = colors.HexColor("#e2e8f0")

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "docs", "SIG_HANDOVER.md")
DST = os.path.join(ROOT, "docs", "SIG_HANDOVER.pdf")


# ────────────────────── Styles ──────────────────────

def styles():
    s = getSampleStyleSheet()
    s.add(ParagraphStyle(
        name="CoverTitle", fontName="Helvetica-Bold", fontSize=28,
        textColor=NAVY, leading=34, spaceAfter=12, alignment=0
    ))
    s.add(ParagraphStyle(
        name="CoverSub", fontName="Helvetica", fontSize=14,
        textColor=BLUE, leading=20, spaceAfter=24
    ))
    s.add(ParagraphStyle(
        name="CoverMeta", fontName="Helvetica", fontSize=10,
        textColor=GREY_TEXT, leading=14
    ))
    s.add(ParagraphStyle(
        name="H1", fontName="Helvetica-Bold", fontSize=18, textColor=NAVY,
        leading=22, spaceBefore=18, spaceAfter=10, keepWithNext=True
    ))
    s.add(ParagraphStyle(
        name="H2", fontName="Helvetica-Bold", fontSize=14, textColor=NAVY,
        leading=18, spaceBefore=14, spaceAfter=8, keepWithNext=True
    ))
    s.add(ParagraphStyle(
        name="H3", fontName="Helvetica-Bold", fontSize=12, textColor=BLUE,
        leading=16, spaceBefore=10, spaceAfter=6, keepWithNext=True
    ))
    s.add(ParagraphStyle(
        name="Body", fontName="Helvetica", fontSize=10, textColor=colors.black,
        leading=14, spaceAfter=8, alignment=0
    ))
    s.add(ParagraphStyle(
        name="ListItem", fontName="Helvetica", fontSize=10, textColor=colors.black,
        leading=14, leftIndent=14, bulletIndent=4, spaceAfter=2
    ))
    s.add(ParagraphStyle(
        name="CodeBlock", fontName="Courier", fontSize=8.5, textColor=NAVY,
        backColor=BG_CODE, leading=11, leftIndent=8, spaceAfter=8,
        borderColor=BORDER, borderWidth=0.5, borderPadding=6
    ))
    s.add(ParagraphStyle(
        name="TocEntry", fontName="Helvetica", fontSize=10, textColor=GREY_TEXT,
        leading=16, leftIndent=10, spaceAfter=2
    ))
    s.add(ParagraphStyle(
        name="TableCell", fontName="Helvetica", fontSize=8.5, textColor=colors.black,
        leading=11
    ))
    s.add(ParagraphStyle(
        name="TableHeader", fontName="Helvetica-Bold", fontSize=8.5, textColor=colors.white,
        leading=11
    ))
    return s


STY = styles()


# ────────────────────── Markdown → flowables ──────────────────────

def inline(text: str) -> str:
    """Convertit le markdown inline (gras, italique, code, liens) en HTML pour Paragraph."""
    # Code inline d'abord pour ne pas qu'il soit interprété
    text = re.sub(r"`([^`]+?)`", lambda m: f'<font name="Courier" backColor="#f1f5f9">{esc(m.group(1))}</font>', text)
    # Gras
    text = re.sub(r"\*\*([^*]+?)\*\*", r"<b>\1</b>", text)
    # Italique
    text = re.sub(r"(?<!\*)\*([^*]+?)\*(?!\*)", r"<i>\1</i>", text)
    # Liens
    text = re.sub(r"\[([^\]]+)\]\(([^)]+)\)",
                  r'<link href="\2" color="#3794C4">\1</link>', text)
    return text


def esc(s: str) -> str:
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def parse_table(lines):
    """Parse un tableau markdown standard. Retourne (headers, rows)."""
    if len(lines) < 2:
        return None
    headers = [c.strip() for c in lines[0].strip("|").split("|")]
    # Ligne 1 : header. Ligne 2 : séparateur ---. À partir de ligne 2 : data.
    rows = []
    for ln in lines[2:]:
        if not ln.strip().startswith("|"):
            break
        cells = [c.strip() for c in ln.strip("|").split("|")]
        rows.append(cells)
    return headers, rows


def render_table(headers, rows):
    """Convertit un tableau markdown en flowable Table reportlab."""
    data = [[Paragraph(inline(esc(h)), STY["TableHeader"]) for h in headers]]
    for row in rows:
        data.append([Paragraph(inline(esc(c)), STY["TableCell"]) for c in row])

    # Largeurs équilibrées sur 16 cm
    available = 16 * cm
    n = len(headers)
    col_widths = [available / n] * n

    table = Table(data, colWidths=col_widths, repeatRows=1)
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), NAVY),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("ALIGN", (0, 0), (-1, -1), "LEFT"),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("FONTSIZE", (0, 0), (-1, -1), 8.5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, BG_CODE]),
        ("GRID", (0, 0), (-1, -1), 0.4, BORDER),
    ]))
    return table


def parse_markdown(md: str):
    """Découpe le markdown en flowables ordonnés. Retourne aussi la liste des sections (pour le sommaire)."""
    lines = md.split("\n")
    flowables = []
    sections = []  # [(level, title), ...]
    i = 0
    while i < len(lines):
        ln = lines[i]

        # Code block ```
        if ln.startswith("```"):
            j = i + 1
            buf = []
            while j < len(lines) and not lines[j].startswith("```"):
                buf.append(lines[j])
                j += 1
            code = "\n".join(buf)
            flowables.append(Preformatted(code, STY["CodeBlock"]))
            i = j + 1
            continue

        # Tableau (ligne commence par |)
        if ln.strip().startswith("|") and i + 1 < len(lines) and re.match(r"^\s*\|[\s|:-]+$", lines[i + 1]):
            tbl_lines = [ln]
            j = i + 1
            while j < len(lines) and lines[j].strip().startswith("|"):
                tbl_lines.append(lines[j])
                j += 1
            parsed = parse_table(tbl_lines)
            if parsed:
                headers, rows = parsed
                flowables.append(render_table(headers, rows))
                flowables.append(Spacer(1, 6))
            i = j
            continue

        # Titres
        m = re.match(r"^(#{1,4})\s+(.*?)\s*$", ln)
        if m:
            level = len(m.group(1))
            title = m.group(2)
            # Retire les emojis/icones initiales pour le sommaire (mais garde dans le titre)
            sections.append((level, title))
            sty = {1: "H1", 2: "H1", 3: "H2", 4: "H3"}.get(level, "H3")
            flowables.append(Paragraph(inline(esc(title)), STY[sty]))
            i += 1
            continue

        # Liste à puces
        if re.match(r"^\s*[-*]\s+", ln):
            items = []
            while i < len(lines) and re.match(r"^\s*[-*]\s+", lines[i]):
                content = re.sub(r"^\s*[-*]\s+", "", lines[i])
                items.append(content)
                i += 1
            for item in items:
                flowables.append(Paragraph(f"• {inline(esc(item))}", STY["ListItem"]))
            flowables.append(Spacer(1, 4))
            continue

        # Liste numérotée
        if re.match(r"^\s*\d+\.\s+", ln):
            n = 1
            while i < len(lines) and re.match(r"^\s*\d+\.\s+", lines[i]):
                content = re.sub(r"^\s*\d+\.\s+", "", lines[i])
                flowables.append(Paragraph(f"{n}. {inline(esc(content))}", STY["ListItem"]))
                n += 1
                i += 1
            flowables.append(Spacer(1, 4))
            continue

        # Citation > ...
        if ln.startswith("> "):
            buf = []
            while i < len(lines) and lines[i].startswith("> "):
                buf.append(lines[i][2:])
                i += 1
            text = " ".join(buf)
            quote_sty = ParagraphStyle(
                "Quote", parent=STY["Body"], leftIndent=12, fontSize=10,
                textColor=GREY_TEXT, borderPadding=(4, 0, 4, 8),
                borderColor=BLUE, borderWidth=0
            )
            flowables.append(Paragraph(f"<i>{inline(esc(text))}</i>", quote_sty))
            flowables.append(Spacer(1, 6))
            continue

        # Ligne de séparation ---
        if re.match(r"^---+\s*$", ln):
            flowables.append(Spacer(1, 4))
            from reportlab.platypus.flowables import HRFlowable
            flowables.append(HRFlowable(width="100%", thickness=0.5, color=BORDER))
            flowables.append(Spacer(1, 4))
            i += 1
            continue

        # Ligne vide
        if ln.strip() == "":
            i += 1
            continue

        # Paragraphe (peut s'étendre sur plusieurs lignes)
        para_lines = [ln]
        j = i + 1
        while j < len(lines) and lines[j].strip() and not (
            lines[j].startswith("#") or lines[j].startswith("```")
            or lines[j].startswith("> ") or lines[j].strip().startswith("|")
            or re.match(r"^\s*[-*]\s+", lines[j])
            or re.match(r"^\s*\d+\.\s+", lines[j])
            or re.match(r"^---+\s*$", lines[j])
        ):
            para_lines.append(lines[j])
            j += 1
        text = " ".join(para_lines)
        flowables.append(Paragraph(inline(esc(text)), STY["Body"]))
        i = j

    return flowables, sections


# ────────────────────── Page templates ──────────────────────

def cover_page(canv, doc):
    """Page de garde."""
    canv.saveState()
    # Bandeau dégradé en haut
    canv.setFillColor(NAVY)
    canv.rect(0, A4[1] - 6 * cm, A4[0], 6 * cm, fill=1, stroke=0)
    canv.setFillColor(BLUE)
    canv.rect(0, A4[1] - 6 * cm, A4[0], 0.3 * cm, fill=1, stroke=0)

    # Logo / titre projet
    canv.setFont("Helvetica-Bold", 14)
    canv.setFillColor(colors.white)
    canv.drawString(2 * cm, A4[1] - 2.2 * cm, "CNGIRI")
    canv.setFont("Helvetica", 9)
    canv.drawString(2 * cm, A4[1] - 2.7 * cm,
                    "Comité National de Gestion Intégrée du Risque d'Inondation")

    # Pied de page
    canv.setFillColor(GREY_LIGHT)
    canv.setFont("Helvetica", 8)
    canv.drawString(2 * cm, 1.5 * cm,
                    f"Document généré le {datetime.now().strftime('%d/%m/%Y')}")
    canv.drawRightString(A4[0] - 2 * cm, 1.5 * cm, "CNGIRI · cngiri.com")
    canv.restoreState()


def content_page(canv, doc):
    """Pages de contenu : entête + pied de page."""
    canv.saveState()
    # Entête
    canv.setFillColor(NAVY)
    canv.setFont("Helvetica-Bold", 9)
    canv.drawString(2 * cm, A4[1] - 1.5 * cm, "CNGIRI")
    canv.setFillColor(GREY_TEXT)
    canv.setFont("Helvetica", 8)
    canv.drawString(2 * cm + 1.8 * cm, A4[1] - 1.5 * cm,
                    "· Cartographie : état et cahier des charges SIG")
    canv.setStrokeColor(BORDER)
    canv.setLineWidth(0.4)
    canv.line(2 * cm, A4[1] - 1.7 * cm, A4[0] - 2 * cm, A4[1] - 1.7 * cm)

    # Pied
    canv.setFillColor(GREY_LIGHT)
    canv.setFont("Helvetica", 8)
    canv.drawString(2 * cm, 1.2 * cm, "Document interne CNGIRI")
    canv.drawRightString(A4[0] - 2 * cm, 1.2 * cm, f"Page {doc.page}")
    canv.restoreState()


# ────────────────────── Build ──────────────────────

def build():
    if not os.path.exists(SRC):
        sys.exit(f"Fichier source introuvable : {SRC}")

    with open(SRC, "r", encoding="utf-8") as f:
        md = f.read()

    flowables, sections = parse_markdown(md)

    # Page de garde
    cover = [
        Spacer(1, 7 * cm),
        Paragraph("Cartographie CNGIRI", STY["CoverTitle"]),
        Paragraph("État, architecture et cahier des charges SIG",
                  STY["CoverSub"]),
        Spacer(1, 3 * cm),
        Paragraph("<b>Objet</b><br/>"
                  "Décrire ce qui est en place côté plateforme, ce qu'il reste à"
                  " faire côté SIG, et comment les deux se branchent.", STY["CoverMeta"]),
        Spacer(1, 0.6 * cm),
        Paragraph("<b>Public</b><br/>"
                  "Développeur SIG, équipe technique CNGIRI, direction.",
                  STY["CoverMeta"]),
        Spacer(1, 0.6 * cm),
        Paragraph(f"<b>Date</b><br/>{datetime.now().strftime('%d %B %Y')}",
                  STY["CoverMeta"]),
        PageBreak(),
    ]

    # Sommaire : sections principales (niveau 2 = "1. Pourquoi…", "2. Ce qui…", etc.)
    # Le niveau 1 est utilisé pour le titre du document seulement.
    toc = [Paragraph("Sommaire", STY["H1"]), Spacer(1, 6)]
    for level, title in sections:
        if level == 2:
            toc.append(Paragraph(title, STY["TocEntry"]))
    toc.append(PageBreak())

    # Doc avec deux templates : cover (sans header) puis content
    doc = BaseDocTemplate(
        DST, pagesize=A4,
        leftMargin=2 * cm, rightMargin=2 * cm,
        topMargin=2.2 * cm, bottomMargin=2 * cm,
        title="Cartographie CNGIRI — Cahier des charges SIG",
        author="CNGIRI"
    )
    frame_cover = Frame(0, 0, A4[0], A4[1], leftPadding=2 * cm,
                        rightPadding=2 * cm, topPadding=0,
                        bottomPadding=0, id="cover")
    frame_content = Frame(2 * cm, 2 * cm, A4[0] - 4 * cm, A4[1] - 4.2 * cm,
                          id="content")
    doc.addPageTemplates([
        PageTemplate(id="cover", frames=[frame_cover], onPage=cover_page),
        PageTemplate(id="content", frames=[frame_content], onPage=content_page),
    ])

    story = cover + [NextPageTemplate("content")] + toc + flowables
    doc.build(story)
    size = os.path.getsize(DST)
    print(f"OK -> {DST} ({size:,} octets)")


if __name__ == "__main__":
    build()
