# ============================================================================
# FILE    : scripts/build-referral-pricing-pdf_2026-10-22_0530.py
# PROJECT : Handled (HandledServices) — AI-run home & business services
# CREATED : 2026-10-22_0530 UTC
# PURPOSE : "Referral pricing" PDF: who earns what on a referred job (referrer, pro, Handled) with the shared bonus
#           (half Handled / half the pro), the two worked examples (lawn care every 2 weeks at $150, a $10,000 roof),
#           and sample prices for the new services (roofing, flooring, paving, tree trimming).
#           Every number comes from the pricing engine via scripts/referral-pricing-data_2026-10-22_0525.ts.
#           Run: python3 scripts/build-referral-pricing-pdf_2026-10-22_0530.py   → docs/HANDLED_REFERRAL_PRICING_<stamp>.pdf
# ============================================================================
import json, subprocess, datetime as dt, pathlib
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.units import inch
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, KeepTogether, PageBreak

ROOT = pathlib.Path(__file__).resolve().parent.parent
STAMP = dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%d_%H%M")
OUT = ROOT / "docs" / f"HANDLED_REFERRAL_PRICING_{STAMP}.pdf"
data = json.loads(subprocess.run(["node", "--experimental-strip-types", "scripts/referral-pricing-data_2026-10-22_0525.ts"], cwd=ROOT, capture_output=True, text=True, check=True).stdout)

BLACK, GREEN, GREEN_D, GRAY, LINE, TINT, GOLD = (colors.HexColor(c) for c in ("#0a0a0a", "#0b7a4e", "#075c3a", "#525252", "#e5e5e5", "#ecfdf5", "#fff7e6"))
ss = getSampleStyleSheet()
H1 = ParagraphStyle("h1", parent=ss["Title"], fontName="Helvetica-Bold", fontSize=20, textColor=GREEN_D, alignment=0, spaceAfter=4)
H2 = ParagraphStyle("h2", parent=ss["Heading2"], fontName="Helvetica-Bold", fontSize=13, textColor=GREEN_D, spaceBefore=10, spaceAfter=4)
P = ParagraphStyle("p", parent=ss["BodyText"], fontName="Helvetica", fontSize=9.5, leading=13, textColor=BLACK)
SM = ParagraphStyle("sm", parent=P, fontSize=8, leading=10.5, textColor=GRAY)
CELL = ParagraphStyle("cell", parent=P, fontSize=8.5, leading=10.5)
CELLB = ParagraphStyle("cellb", parent=CELL, fontName="Helvetica-Bold")

def m(n): return f"${n:,.2f}"
def pct(x): return f"{round(x * 100, 1):g}%"

def table(rows, widths, head=True, highlight=()):
    t = Table(rows, colWidths=widths, repeatRows=1 if head else 0)
    st = [("FONT", (0, 0), (-1, -1), "Helvetica", 8.5), ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
          ("GRID", (0, 0), (-1, -1), 0.4, LINE), ("ALIGN", (1, 0), (-1, -1), "RIGHT"),
          ("TOPPADDING", (0, 0), (-1, -1), 3), ("BOTTOMPADDING", (0, 0), (-1, -1), 3)]
    if head: st += [("BACKGROUND", (0, 0), (-1, 0), GREEN), ("TEXTCOLOR", (0, 0), (-1, 0), colors.white), ("FONT", (0, 0), (-1, 0), "Helvetica-Bold", 8.5)]
    for r in highlight: st += [("BACKGROUND", (0, r), (-1, r), TINT)]
    t.setStyle(TableStyle(st)); return t

R = data["rates"]; S = data["split"]
eff = dt.datetime.fromisoformat(S["effectiveFrom"].replace("Z", "+00:00")).strftime("%B %-d, %Y")
story = [
    Paragraph("Handled — Referral Pricing", H1),
    Paragraph(f"Who earns what on a referred job, with the referral bonus shared half Handled / half the pro. Generated {STAMP.replace('_', ' ')} UTC from the live pricing engine.", SM),
    Spacer(1, 8),
    Paragraph("1. What a referrer earns", H2),
    table([["You refer…", "Bonus", "For how long"],
           ["A person (your link or “send us a person”)", f"{pct(R['person'])} of Handled’s fee", f"Every job they book, {R['months']} months"],
           ["A one-time job (referral ticket)", f"{pct(R['jobOnce'])} of Handled’s fee", "That job"],
           ["A recurring job (referral ticket)", f"{pct(R['jobRecurring'])} of Handled’s fee", f"Every visit, {R['months']} months"]],
          [3.3 * inch, 1.8 * inch, 2.1 * inch]),
    Spacer(1, 4),
    Paragraph(f"<b>Handled’s fee</b> = what the customer paid − the pro’s full pay − refunds. Paid weekly through Stripe once the job is {R['holdDays']} days past completion (our make-it-right window); balances under {m(R['minPayout'])} roll to the next week.", P),
    Paragraph("2. Who pays the bonus — shared", H2),
    Paragraph(f"From jobs accepted on <b>{eff}</b> (30 days’ notice under the contractor agreement, v{S['minAgreement']}+): <b>half from Handled’s fee, half from the pro’s pay</b>. "
              "The bonus is worked out on the pro’s <b>full</b> pay, so the pro’s half never makes it bigger. The pro’s half is rounded down to the cent; Handled covers any odd cent. "
              "Pros see their half in dollars on the offer before they accept, and as its own line on their payout statement. Refunds shrink the bonus and both halves. "
              "Before that date, or when no pro is on the job, Handled pays the whole bonus.", P),
    Spacer(1, 2),
    Paragraph("Check on every row below: <b>customer pays = pro nets + referrer + Handled nets</b>, to the cent.", SM),
]

for ex in data["examples"]:
    v = ex["visits"]
    block = [Paragraph(f"{'3' if ex is data['examples'][0] else '4'}. {ex['title']}", H2),
             Paragraph(f"Customer pays <b>{m(ex['price'])}</b>{' per visit' if v > 1 else ''} ({ex['service']}). Pro’s full pay {m(ex['payout'])} · Handled’s fee {m(ex['take'])} ({pct(ex['takeRate'])}). {ex['note']}", P), Spacer(1, 4)]
    head = ["Referral · who pays", "Referrer earns", "Pro pays", "Handled pays", "Pro nets", "Handled nets"]
    rows, hl = [head], []
    for r in ex["rows"]:
        tag = "shared (from " + eff + ")" if r["proPays"] else "today (Handled pays all)"
        rows.append([Paragraph(f"<b>{r['label']}</b> ({pct(r['pct'])})<br/>{tag}", CELL), m(r["referrer"]), m(r["proShare"]), m(r["handledShare"]), m(r["pro"]), m(r["handled"])])
        if r["proPays"]: hl.append(len(rows) - 1)
    block.append(table(rows, [2.35 * inch, 0.95 * inch, 0.8 * inch, 0.9 * inch, 0.95 * inch, 0.95 * inch], highlight=hl))
    if v > 1:
        block += [Spacer(1, 6), Paragraph(f"<b>Over 12 months ({v} visits)</b> — customer pays {m(ex['price'] * v)} in total", P), Spacer(1, 3)]
        rows2, hl2 = [["Referral · who pays", "Referrer earns", "Pro pays", "Handled pays", "Pro nets", "Handled nets"]], []
        for r in ex["rows"]:
            tag = "shared" if r["proPays"] else "today"
            rows2.append([Paragraph(f"<b>{r['label']}</b> — {tag}", CELL), m(r["referrer"] * v), m(r["proShare"] * v), m(r["handledShare"] * v), m(r["pro"] * v), m(r["handled"] * v)])
            if r["proPays"]: hl2.append(len(rows2) - 1)
        block.append(table(rows2, [2.35 * inch, 0.95 * inch, 0.8 * inch, 0.9 * inch, 0.95 * inch, 0.95 * inch], highlight=hl2))
    story.append(KeepTogether(block))

story += [PageBreak(), Paragraph("5. New services — sample prices", H2),
          Paragraph("Instant estimates from the pricing engine (Michigan prices; the Seattle area and the rest of Washington are higher). Roofing gets a free inspection before the firm price; very large flooring and paving jobs and big trees get a free site visit. "
                    "“Pro pay” and “Handled fee” are at the typical price.", P), Spacer(1, 4)]
rows = [["Job", "Price range", "Typical", "Pro pay", "Handled fee"]]
for q in data["newServices"]:
    rows.append([Paragraph(f"<b>{q['service']}</b><br/>{q['label']}", CELL), f"{m(q['low'])} – {m(q['high'])}", m(q["point"]), m(q["payout"]), m(q["take"])])
story.append(table(rows, [3.0 * inch, 1.45 * inch, 0.95 * inch, 0.9 * inch, 0.95 * inch]))
story += [Spacer(1, 6), Paragraph("What a referrer would earn on these (one-time referral ticket, 20% of Handled’s fee; shared half Handled / half the pro from " + eff + "):", P), Spacer(1, 3)]
rows = [["Job", "Referrer earns", "Pro pays", "Handled pays"]]
for q in data["newServices"]:
    t = q["ticketOnce"]  # from the engine (moneySplit), not recomputed here
    rows.append([q["label"], m(t["referrer"]), m(t["proShare"]), m(t["handledShare"])])
story.append(table(rows, [3.6 * inch, 1.2 * inch, 1.2 * inch, 1.2 * inch]))
story += [Spacer(1, 10), Paragraph("Rates and rules: packages/core/src/partners.ts (PARTNER_PROGRAM, REFERRAL_COST_SPLIT) · tested in partners.test.ts · guide: docs/REFERRAL_TICKETS_2026-10-22_0400.md", SM)]

def footer(c, d):
    c.saveState(); c.setFont("Helvetica", 7.5); c.setFillColor(GRAY)
    c.drawString(0.6 * inch, 0.45 * inch, f"Handled · Referral pricing · generated {STAMP} UTC")
    c.drawRightString(letter[0] - 0.6 * inch, 0.45 * inch, f"Page {d.page}"); c.restoreState()

doc = SimpleDocTemplate(str(OUT), pagesize=letter, leftMargin=0.6 * inch, rightMargin=0.6 * inch, topMargin=0.6 * inch, bottomMargin=0.7 * inch,
                        title=f"Handled Referral Pricing {STAMP}", author="Handled", subject=f"Generated {STAMP} UTC", creator="scripts/build-referral-pricing-pdf_2026-10-22_0530.py")
doc.build(story, onFirstPage=footer, onLaterPages=footer)
print(OUT.relative_to(ROOT))
