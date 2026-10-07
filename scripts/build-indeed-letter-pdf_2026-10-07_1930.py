# ============================================================================
# FILE    : scripts/build-indeed-letter-pdf_2026-10-07_1930.py
# PROJECT : Handled (HandledServices) — AI-run home & business services
# CREATED : 2026-10-07_1930 UTC
# UPDATED : 2026-10-07_1945 UTC — on the official letterhead (logo, contact block, footer).
# PURPOSE : One-page marketing letter (PDF) for businesses hiring cleaners on Indeed: cover the work as a service
#           instead of a hire. Two versions: a general one ("To the hiring team") ready to attach or print, and a
#           fill-in one with blanks for the company, contact and job title.
#           Run: python3 scripts/build-indeed-letter-pdf_2026-10-07_1930.py
# ============================================================================
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.units import inch
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle

GREEN, DEEP, TINT, INK, SOFT = colors.HexColor("#1f7a4d"), colors.HexColor("#0f3d27"), colors.HexColor("#ecf5f0"), colors.HexColor("#1a1f1c"), colors.HexColor("#5b6660")
ss = getSampleStyleSheet()
P = ParagraphStyle("P", parent=ss["BodyText"], fontName="Helvetica", fontSize=10.5, leading=14.5, textColor=INK, spaceAfter=7)
H = ParagraphStyle("H", parent=P, fontName="Helvetica-Bold", fontSize=15, leading=19, textColor=DEEP, spaceAfter=4)
B = ParagraphStyle("B", parent=P, leftIndent=14, bulletIndent=3, spaceAfter=3)
S = ParagraphStyle("S", parent=P, fontSize=8.5, leading=11, textColor=SOFT)
C = ParagraphStyle("C", parent=P, fontSize=9.5, leading=12.5, spaceAfter=0)
CB = ParagraphStyle("CB", parent=C, fontName="Helvetica-Bold")

PHONE, EMAIL, SITE = "(313) 639-9373", "info@handledsvc.com", "handledsvc.com"

LOGO = "apps/web/public/brand/handled-lockup.png"

def head(canvas, doc):
    """Official letterhead: logo top left, contact block top right, a green rule, and the footer line."""
    canvas.saveState()
    canvas.drawImage(LOGO, 0.75 * inch, 10.05 * inch, width=2.6 * inch, height=2.6 * inch * 240 / 891, mask="auto")
    canvas.setFillColor(INK); canvas.setFont("Helvetica-Bold", 9)
    canvas.drawRightString(7.75 * inch, 10.5 * inch, "Handled Services LLC")
    canvas.setFont("Helvetica", 8.5); canvas.setFillColor(SOFT)
    canvas.drawRightString(7.75 * inch, 10.35 * inch, f"{PHONE}  ·  {EMAIL}")
    canvas.drawRightString(7.75 * inch, 10.2 * inch, SITE)
    canvas.setStrokeColor(GREEN); canvas.setLineWidth(1.4); canvas.line(0.75 * inch, 9.92 * inch, 7.75 * inch, 9.92 * inch)
    canvas.setStrokeColor(colors.HexColor("#dfe5e1")); canvas.setLineWidth(0.5); canvas.line(0.75 * inch, 0.68 * inch, 7.75 * inch, 0.68 * inch)
    canvas.setFillColor(SOFT); canvas.setFont("Helvetica", 7.5)
    canvas.drawCentredString(4.25 * inch, 0.5 * inch, "Home & business services in Michigan and Washington  ·  Vetted, background-checked, insured pros  ·  30-day make-it-right guarantee")
    canvas.restoreState()

def letter_flow(fill_in: bool):
    s = []
    if fill_in:
        s += [Paragraph("Date: ______________ &nbsp; To: ________________________ &nbsp; Company: ________________________", P),
              Paragraph("Re: Your ________________________ opening", P)]
        greet, opening = "Dear ____________________,", "I saw that your company is hiring for the role above. Instead of another hire, would it help to have that work covered as a service, starting next week?"
    else:
        greet, opening = "To the hiring team,", "I saw that your company is hiring for cleaning, janitorial or housekeeping help. Instead of another hire, would it help to have that work covered as a service, starting next week?"
    s += ([] if fill_in else [Paragraph("Cleaning covered — without the hiring.", H)]) + [Paragraph(greet, P), Paragraph(opening, P),
          Paragraph("Handled sends vetted, background-checked, insured cleaning pros on the schedule you set. You get one invoice. "
                    "No recruiting, payroll, taxes, workers' comp, time-off coverage or no-shows to manage.", P),
          Paragraph("<b>How it works</b>", P)]
    s += [Paragraph(x, B, bulletText="•") for x in [
        "<b>Your scope, your schedule.</b> Daily, weekly or after hours, with the same pros on your account whenever possible.",
        "<b>Proof every visit.</b> Before-and-after photos and a checklist for each clean.",
        "<b>Covered if someone's out.</b> If a pro can't make it, we send a backup.",
        "<b>Make-it-right guarantee.</b> Tell us within 30 days and we fix it at no charge.",
        "<b>Simple billing.</b> Pay per visit by card, or one monthly invoice on approved terms.",
    ]]
    s += [Spacer(1, 6), Paragraph("<b>The real cost of a $16/hour hire</b>", P)]
    t = Table([[Paragraph(c, CB if r == 0 else C) for c in row] for r, row in enumerate([
        ["", "Employee at $16/hr", "Handled"],
        ["Wage", "$16.00/hr", "Included in one flat visit price"],
        ["Payroll taxes, workers' comp", "about $2–3/hr", "None for you"],
        ["Time off, sick days, no-shows", "about $1–2/hr", "Backup pro at no extra cost"],
        ["Recruiting and turnover", "about $1–3/hr", "None for you"],
        ["Real cost", "about $21–24/hr", "Known up front"],
    ])], colWidths=[2.3 * inch, 2.0 * inch, 2.7 * inch])
    t.setStyle(TableStyle([("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#dfe5e1")), ("BACKGROUND", (0, 0), (-1, 0), TINT),
                           ("BACKGROUND", (0, 5), (-1, 5), TINT), ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                           ("TOPPADDING", (0, 0), (-1, -1), 4), ("BOTTOMPADDING", (0, 0), (-1, -1), 4)]))
    s += [t, Paragraph("Typical employer cost ranges; your numbers may differ.", S), Spacer(1, 4),
          Paragraph("Could we do a 15-minute walkthrough this week? I'll quote it on the spot, and we can start with a trial clean "
                    "so you can judge the work before committing. If you'd rather keep hiring, we can also cover shifts until your new person starts.", P),
          Spacer(1, 4), Paragraph("Thank you,", P), Spacer(1, 8 if fill_in else 6),
          Paragraph("______________________________" if fill_in else "The Handled team", P),
          Paragraph(f"Handled Services LLC · {PHONE} · {EMAIL} · {SITE}", P)]
    return s

for fill_in, name in [(False, "docs/HANDLED_INDEED_OUTREACH_LETTER_2026-10-07_1930.pdf"), (True, "docs/HANDLED_INDEED_OUTREACH_LETTER_FILL_IN_2026-10-07_1930.pdf")]:
    doc = SimpleDocTemplate(name, pagesize=letter, leftMargin=0.75 * inch, rightMargin=0.75 * inch, topMargin=1.3 * inch, bottomMargin=0.7 * inch,
                            title="Handled — Cleaning covered without the hiring", author="Handled Services LLC")
    doc.build(letter_flow(fill_in), onFirstPage=head, onLaterPages=head)
    print("wrote", name)
