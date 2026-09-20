from __future__ import annotations

import csv
from io import BytesIO, StringIO
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle


def roster_csv(rows: list[dict]) -> bytes:
    sio = StringIO()
    writer = csv.DictWriter(sio, fieldnames=[
        "name", "email", "progress", "status", "risk_score", "risk_level", "average_score", "trend",
    ])
    writer.writeheader()
    for row in rows:
        risk = row.get("academic_risk") or {}
        writer.writerow({
            "name": row.get("name"),
            "email": row.get("email"),
            "progress": row.get("progress"),
            "status": row.get("status"),
            "risk_score": risk.get("score"),
            "risk_level": risk.get("level"),
            "average_score": risk.get("average_score"),
            "trend": risk.get("trend"),
        })
    return sio.getvalue().encode("utf-8-sig")


def _table(data, widths=None):
    table = Table(data, colWidths=widths, repeatRows=1)
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1F2A44")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("GRID", (0, 0), (-1, -1), 0.4, colors.grey),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 8),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F4F6FA")]),
    ]))
    return table


def review_pdf(title: str, bins: list[dict]) -> bytes:
    buf = BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, rightMargin=34, leftMargin=34, topMargin=34, bottomMargin=34)
    styles = getSampleStyleSheet()
    story = [Paragraph(title, styles["Title"]), Spacer(1, 12)]
    data = [["Misconception", "Students", "Occurrences", "Avg %"]]
    for item in bins:
        data.append([
            item["misconception"], ", ".join(item["students"]), item["occurrences"], item["average_score"],
        ])
    if len(data) == 1:
        data.append(["No misconception data", "-", "-", "-"])
    story.append(_table(data, [205, 180, 75, 65]))
    doc.build(story)
    return buf.getvalue()


def class_summary_pdf(class_name: str, snapshot: dict) -> bytes:
    buf = BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, rightMargin=34, leftMargin=34, topMargin=34, bottomMargin=34)
    styles = getSampleStyleSheet()
    story = [Paragraph(f"{class_name} - Teacher Class Summary", styles["Title"]), Spacer(1, 12)]
    metrics = snapshot.get("metrics", {})
    story.append(_table([
        ["Students", "Avg Progress", "Avg Score", "Risk > threshold", "Open Actions"],
        [metrics.get("students", 0), f"{metrics.get('average_progress', 0)}%", metrics.get("average_final_score") or "-", metrics.get("students_over_threshold", 0), metrics.get("open_interventions", 0)],
    ], [80, 100, 90, 115, 95]))
    story.append(Spacer(1, 16))
    story.append(Paragraph("Students needing review", styles["Heading2"]))
    rows = [["Student", "Risk", "Progress", "Avg Score", "Reasons"]]
    for item in snapshot.get("risk_students", [])[:15]:
        risk = item["risk"]
        if risk.get("score", 0) < 25:
            continue
        rows.append([
            item["name"], f"{risk['score']} ({risk['level']})", f"{item['progress']}%",
            risk.get("average_score") if risk.get("average_score") is not None else "-",
            "; ".join(r.get("message", "") for r in risk.get("reasons", [])[:2]),
        ])
    if len(rows) == 1:
        rows.append(["No current academic-risk signals", "-", "-", "-", "-"])
    story.append(_table(rows, [100, 75, 65, 70, 215]))
    story.append(Spacer(1, 16))
    story.append(Paragraph("Assessment health", styles["Heading2"]))
    arows = [["Assessment", "Students", "Attempts", "Avg %", "Top misconception"]]
    for item in snapshot.get("assessment_health", []):
        arows.append([item["assessment"], item["students_submitted"], item["total_attempts"], item["average_final"] or "-", item.get("top_misconception") or "-"])
    if len(arows) == 1:
        arows.append(["No assessments", "-", "-", "-", "-"])
    story.append(_table(arows, [155, 70, 70, 70, 190]))
    doc.build(story)
    return buf.getvalue()
