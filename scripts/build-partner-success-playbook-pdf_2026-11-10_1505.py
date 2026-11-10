# ============================================================================
# FILE    : scripts/build-partner-success-playbook-pdf_2026-11-10_1505.py
# PROJECT : Handled (HandledServices) — AI-run home & business services
# CREATED : 2026-11-10_1505 UTC
# PURPOSE : Builds the Partner Success Playbook PDF: partner success = Handled success. The three roadmaps (Neighborhood
#           Connector, Property & Real Estate Accounts, Field Sales Pro) stage by stage with goals, actions and services to
#           sell; the bundles that turn one job into three; the seasonal calendar; how pay works and how the rate climbs.
#           Content comes from packages/core/src/partner-success.ts (via scripts/partner-success-facts_2026-11-10_1505.mts),
#           the same source as /partner/grow. Run from the repo root:
#             python3 scripts/build-partner-success-playbook-pdf_2026-11-10_1505.py
#           Writes docs/HANDLED_PARTNER_SUCCESS_PLAYBOOK_<date>.pdf and apps/web/public/docs/handled-partner-success-playbook.pdf.
# ============================================================================
import json, os, shutil, subprocess, sys
from datetime import datetime, timezone
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.units import inch
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, KeepTogether

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
STAMP = datetime.now(timezone.utc).strftime("%Y-%m-%d_%H%M")
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, "docs", f"HANDLED_PARTNER_SUCCESS_PLAYBOOK_{STAMP}.pdf")
PUBLIC = os.path.join(ROOT, "apps", "web", "public", "docs", "handled-partner-success-playbook.pdf")
F = json.loads(subprocess.run(["node", "--experimental-strip-types", "--no-warnings", os.path.join(ROOT, "scripts", "partner-success-facts_2026-11-10_1505.mts")],
                              cwd=ROOT, capture_output=True, text=True, check=True).stdout)

NAVY, GREEN, TINT, INK, SOFT, LINE = (colors.HexColor(x) for x in ("#0f2a5c", "#166534", "#eef3f9", "#0b1f3a", "#3a4a60", "#dbe3ee"))
ss = getSampleStyleSheet()
H1 = ParagraphStyle("H1", parent=ss["Title"], fontName="Helvetica-Bold", fontSize=26, leading=30, textColor=NAVY, alignment=0, spaceAfter=4)
SUB = ParagraphStyle("SUB", parent=ss["BodyText"], fontName="Helvetica", fontSize=12, leading=16, textColor=GREEN, spaceAfter=10)
H2 = ParagraphStyle("H2", parent=ss["Heading2"], fontName="Helvetica-Bold", fontSize=15, leading=19, textColor=NAVY, spaceBefore=14, spaceAfter=6, keepWithNext=1)
H3 = ParagraphStyle("H3", parent=ss["Heading3"], fontName="Helvetica-Bold", fontSize=11.5, leading=15, textColor=GREEN, spaceBefore=8, spaceAfter=3, keepWithNext=1)
P = ParagraphStyle("P", parent=ss["BodyText"], fontName="Helvetica", fontSize=10, leading=14, textColor=INK, spaceAfter=5)
S = ParagraphStyle("S", parent=P, fontSize=8.5, leading=11.5, textColor=SOFT)
B = ParagraphStyle("B", parent=P, leftIndent=12, bulletIndent=2, spaceAfter=2)
C = ParagraphStyle("C", parent=P, fontSize=9, leading=12, spaceAfter=0)
CB = ParagraphStyle("CB", parent=C, fontName="Helvetica-Bold")

def pct(r): return f"{round(r * 100, 2):g}%"
def usd(n): return f"${n:,.2f}" if n % 1 else f"${n:,.0f}"
def esc(t): return t.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
def bullets(items): return [Paragraph(esc(i), B, bulletText="•") for i in items]
def table(rows, widths, head=True):
    data = [[Paragraph(str(c), CB if (head and r == 0) else C) for c in row] for r, row in enumerate(rows)]
    t = Table(data, colWidths=widths, repeatRows=1 if head else 0)
    st = [("VALIGN", (0, 0), (-1, -1), "TOP"), ("GRID", (0, 0), (-1, -1), 0.4, LINE),
          ("LEFTPADDING", (0, 0), (-1, -1), 5), ("RIGHTPADDING", (0, 0), (-1, -1), 5), ("TOPPADDING", (0, 0), (-1, -1), 4), ("BOTTOMPADDING", (0, 0), (-1, -1), 4)]
    if head: st += [("BACKGROUND", (0, 0), (-1, 0), TINT)]
    t.setStyle(TableStyle(st)); return t

def footer(canvas, doc):
    canvas.saveState(); canvas.setFont("Helvetica", 7.5); canvas.setFillColor(SOFT)
    canvas.drawString(0.75 * inch, 0.5 * inch, f"Handled Services LLC · Partner Success Playbook · {STAMP[:10]} · {F['email']} · {F['phone']}")
    canvas.drawRightString(7.75 * inch, 0.5 * inch, f"Page {doc.page}"); canvas.restoreState()

pr, rl, sl, ft, dr = F["program"], F["referralLadder"], F["salesLadder"], F["fastTrack"], F["draw"]
s = [Paragraph("Partner Success Playbook", H1),
     Paragraph("Your success is our success. Three roads to grow your partner business, stage by stage.", SUB),
     Paragraph("Every customer you send gets an upfront price, a vetted pro, photo proof and a free redo if anything's missed. "
               "That makes them easy to send, and easy to send again. The fastest way to grow is to sell <b>more kinds of services to the same customers</b>, "
               "and to turn one-time jobs into recurring plans and accounts. Your partner page at <b>handledsvc.com/partner/grow</b> tracks every goal below from your real numbers.", P)]

s += [Paragraph("How you earn", H2),
      table([["Way to earn", "How it works", "You earn"],
             ["Referrals", "Share your link or code, or send a referral ticket. We sell it.", f"{pct(rl[0]['rate'])} of the job price, rising to {pct(rl[-1]['rate'])}, on every job from that customer for {pr['months']} months"],
             ["Direct sales", "Write a sales ticket; the customer pays on your phone or from our text.", f"{pct(sl[0]['rate'])} of our profit, rising to {pct(sl[-1]['rate'])}, on every job from that customer for {pr['months']} months"],
             ["Field Sales lead pay", f"A complete sales ticket for a new customer. Starts after {dr['unlockLeads']} leads and {dr['unlockPaidSales']} paid-out sale.", f"{usd(dr['perLead'])} per lead (up to {dr['weeklyCap']} a week), an advance on that lead's commission"]],
            [1.3 * inch, 3.0 * inch, 2.7 * inch]),
      Paragraph(f"Paid every Monday by direct deposit (Stripe) once each job is {pr['holdDays']} days past completion. Balances under {usd(pr['minPayout'])} roll to the next week. "
                f"Set up payouts first, on your partner page: we can't pay you until you do.", S),
      Paragraph("How your rate climbs", H3),
      Paragraph(f"Every raise is one point and your rate never goes down. Raises come from the profit your customers' jobs bring in (direct sales count {ft['directCredit']:g}×, referrals 1×). "
                f"Fast track: every {ft['jobsPerStep']} jobs is also +1 point, up to {pct(ft['capRate'])}.", P),
      table([["Referrals (of the job price)", "Reached at", "Direct sales (of our profit)", "Reached at"]]
            + [[pct(rl[i]['rate']) if i < len(rl) else "", ("—" if i == 0 else usd(rl[i]['credit'])) if i < len(rl) else "",
                pct(sl[i]['rate']) if i < len(sl) else "", ("—" if i == 0 else usd(sl[i]['credit'])) if i < len(sl) else ""] for i in range(max(len(rl), len(sl)))],
            [1.9 * inch, 1.6 * inch, 1.9 * inch, 1.6 * inch])]

for n, r in enumerate(F["roadmaps"], 1):
    s += [Paragraph(f"Road {n}: {esc(r['name'])}", H2),
          Paragraph(f"<b>For:</b> {esc(r['forWho'])}", P),
          Paragraph(f"<b>The promise:</b> {esc(r['promise'])}", P)]
    for i, st in enumerate(r["stages"], 1):
        goals = "<br/>".join("☐ " + esc(g["label"]) for g in st["goals"]).replace("☐", "[ ]")
        acts = "<br/>".join("• " + esc(a) for a in st["actions"])
        s += [KeepTogether([Paragraph(f"Stage {i}: {esc(st['name'])}", H3),
                            Paragraph(esc(st["why"]), S),
                            table([["Goals", "How", "Sell"], [goals, acts, ", ".join(esc(x) for x in st["sell"])]], [1.75 * inch, 3.45 * inch, 1.8 * inch]),
                            Paragraph(f"<b>Unlocks:</b> {esc(st['unlocks'])}", S)])]

s += [Paragraph("Bundles: turn one job into three", H2),
      Paragraph("When you hear one of these, suggest the rest. Customers who book three kinds of services stay longer and pay you more.", P),
      table([["Bundle", "When you hear it", "Suggest"]] + [[esc(p["name"]), esc(p["when"]), ", ".join(esc(x) for x in p["services"])] for p in F["plays"]],
            [1.6 * inch, 2.2 * inch, 3.2 * inch]),
      Paragraph("What to sell when", H2),
      table([["Season", "Months", "Sell"]] + [[c["season"], c["months"], ", ".join(esc(x) for x in c["services"])] for c in F["seasons"]],
            [1.1 * inch, 1.1 * inch, 4.8 * inch]),
      Paragraph("The rules that keep it working", H2)] + bullets([
    "Only send people who agreed to hear from us, and only photograph property with the owner's OK.",
    "Never take payment yourself, and don't promise prices or services we didn't offer.",
    "Each customer belongs to the first partner who sent them. Referring yourself, your household or your own business doesn't count.",
    "No spam and no fake reviews. Breaking the rules ends the partnership.",
]) + [Spacer(1, 8), Paragraph(f"Questions? {F['phone']} · {F['email']} · Your roadmap and progress: handledsvc.com/partner/grow", P)]

os.makedirs(os.path.dirname(OUT), exist_ok=True)
SimpleDocTemplate(OUT, pagesize=letter, leftMargin=0.75 * inch, rightMargin=0.75 * inch, topMargin=0.7 * inch, bottomMargin=0.75 * inch,
                  title="Partner Success Playbook", author="Handled Services LLC").build(s, onFirstPage=footer, onLaterPages=footer)
os.makedirs(os.path.dirname(PUBLIC), exist_ok=True)
shutil.copyfile(OUT, PUBLIC)
print(OUT); print(PUBLIC)
