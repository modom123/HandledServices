# ============================================================================
# FILE    : scripts/build-pro-welcome-packet_2026-10-07_1530.py
# PROJECT : Handled (HandledServices) — AI-run home & business services
# CREATED : 2026-10-07_1530 UTC
# PURPOSE : Builds the Pro Welcome Packet PDF sent to every invited pro (independent contractor, 1099):
#           the steps, what they sign online, what they upload, and how they get paid. Mirrors the live onboarding
#           (packages/core/src/compliance.ts onboardingChecklist, apps/web/lib/contracts/pro.ts proSigningSet).
#           Run: python3 scripts/build-pro-welcome-packet_2026-10-07_1530.py
# ============================================================================
import sys
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.units import inch
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether

OUT = sys.argv[1] if len(sys.argv) > 1 else "docs/HANDLED_PRO_WELCOME_PACKET_2026-10-07_1530.pdf"
GREEN, DEEP, TINT, INK, SOFT = colors.HexColor("#1f7a4d"), colors.HexColor("#0f3d27"), colors.HexColor("#ecf5f0"), colors.HexColor("#1a1f1c"), colors.HexColor("#5b6660")

ss = getSampleStyleSheet()
H1 = ParagraphStyle("H1", parent=ss["Title"], fontName="Helvetica-Bold", fontSize=24, leading=28, textColor=DEEP, alignment=0, spaceAfter=6)
H2 = ParagraphStyle("H2", parent=ss["Heading2"], fontName="Helvetica-Bold", fontSize=15, leading=19, textColor=GREEN, spaceBefore=14, spaceAfter=6)
H3 = ParagraphStyle("H3", parent=ss["Heading3"], fontName="Helvetica-Bold", fontSize=11.5, leading=15, textColor=INK, spaceBefore=8, spaceAfter=3)
P = ParagraphStyle("P", parent=ss["BodyText"], fontName="Helvetica", fontSize=10, leading=14, textColor=INK, spaceAfter=5)
S = ParagraphStyle("S", parent=P, fontSize=8.5, leading=11.5, textColor=SOFT)
B = ParagraphStyle("B", parent=P, leftIndent=12, bulletIndent=2, spaceAfter=2)
C = ParagraphStyle("C", parent=P, fontSize=9, leading=12, spaceAfter=0)
CB = ParagraphStyle("CB", parent=C, fontName="Helvetica-Bold")

def bullets(items): return [Paragraph(i, B, bulletText="•") for i in items]
def table(rows, widths, head=True):
    data = [[Paragraph(str(c), CB if (head and r == 0) else C) for c in row] for r, row in enumerate(rows)]
    t = Table(data, colWidths=widths, repeatRows=1 if head else 0)
    st = [("VALIGN", (0, 0), (-1, -1), "TOP"), ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#dfe5e1")),
          ("LEFTPADDING", (0, 0), (-1, -1), 5), ("RIGHTPADDING", (0, 0), (-1, -1), 5), ("TOPPADDING", (0, 0), (-1, -1), 4), ("BOTTOMPADDING", (0, 0), (-1, -1), 4)]
    if head: st += [("BACKGROUND", (0, 0), (-1, 0), TINT)]
    t.setStyle(TableStyle(st)); return t

def footer(canvas, doc):
    canvas.saveState(); canvas.setFont("Helvetica", 7.5); canvas.setFillColor(SOFT)
    canvas.drawString(0.75 * inch, 0.5 * inch, "Handled Services LLC · Pro Welcome Packet · 2026-10-07 · info@handledsvc.com")
    canvas.drawRightString(7.75 * inch, 0.5 * inch, f"Page {doc.page}"); canvas.restoreState()

s = []
s += [Paragraph("Welcome to Handled", H1),
      Paragraph("<b>Pro Welcome Packet</b> — your setup steps, what you'll sign, what to upload, and how you get paid.", P),
      Paragraph("You'll be joining as an <b>independent pro (1099)</b>: you run your own business, you choose which offers to take, and you set your own hours. "
                "Everything below is done <b>online, from your phone or computer</b>. There's nothing to print, mail or fax. Most pros finish the setup in about <b>15 minutes</b>. "
                "Offers start the day you're approved.", P),
      Spacer(1, 4)]

s += [Paragraph("1. Have these ready", H2),
      table([["What", "Why", "Who needs it"],
             ["Phone or computer with a camera", "Uploads, photo ID check, selfie", "Everyone"],
             ["Legal name, business name (if any), mailing address, SSN or EIN", "Your W-9, so we can issue your 1099", "Everyone"],
             ["A completed IRS Form W-9 (PDF or photo). Get the fillable form at irs.gov/FormW9", "Tax paperwork for independent contractors", "Everyone"],
             ["Certificate of insurance (COI): general liability, with <b>Handled Services LLC</b> listed as additional insured", "Required before any job. $1M per occurrence minimum (some trades higher), $2M aggregate", "Everyone"],
             ["Trade-specific insurance (commercial auto, janitorial bond, liquor, passenger carrier)", "Only if your trade or job type requires it. The checklist shows exactly which ones", "Some trades"],
             ["State trade license number, expiry date and a photo of the license", "Plumbing, electrical, HVAC, painting, remodeling, food service, passenger transport, medical courier", "Licensed trades"],
             ["Workers' comp policy, or sign the no-employees statement", "Michigan law, if you have employees", "Everyone (most solo pros just sign the statement)"],
             ["Bank account (routing and account number)", "Your weekly payout, set up securely through Stripe", "Everyone"],
             ["Driver's license or state ID", "Photo ID check", "Everyone"]],
            [2.55 * inch, 2.55 * inch, 1.9 * inch])]

s += [Paragraph("2. The steps, start to finish", H2),
      table([["#", "Step", "How it's done", "Time"],
             ["1", "Apply", "Online at handledsvc.com/pros: your trades (up to 3), area and experience", "5 min"],
             ["2", "Short screening interview", "Online, on your own time. A link is emailed to you, and a person reviews it", "10–15 min"],
             ["3", "Invitation email", "One click signs you in and opens your setup checklist. No password needed", "—"],
             ["4", "Tax info (W-9)", "Type your legal name, tax classification and the last 4 of your SSN/EIN, then upload your signed W-9", "3 min"],
             ["5", "Sign your agreements", "Read them in the portal (English or Spanish), type your name and tap <i>I agree</i>. See section 3", "5 min"],
             ["6", "Your specialties, work area and hours", "Pick what you do best, your business address, how far you'll drive, your days and hours, and your daily job limit", "3 min"],
             ["7", "Insurance and licenses", "Upload your COI, any trade coverage and your license. We verify with the insurer or the state", "3 min + our review (usually 1 business day)"],
             ["8", "Photo ID check", "Photo of your ID plus a selfie, through Stripe Identity (or a short video call with us)", "2 min"],
             ["9", "Background check", "Checkr emails you its own disclosure and authorization form to sign online. See section 3", "5 min + 1–5 business days"],
             ["10", "Payout setup", "Connect your bank through Stripe (secure; Stripe also confirms your tax details)", "3 min"],
             ["11", "Approved: offers start", "We email you once everything is verified. Offers appear in the app and by text", "—"]],
            [0.3 * inch, 1.7 * inch, 3.75 * inch, 1.25 * inch]),
      Paragraph("You can stop at any point and pick up where you left off. The checklist in your Pro portal shows what's done and what's next. We'll send friendly reminders if something is waiting on you.", S)]

s += [PageBreak(), Paragraph("3. What you'll sign (all online)", H2),
      Paragraph("These are signed electronically in your Pro portal. You can read every document in full, in English or Spanish, before you sign. "
                "A signed copy of each one is saved in <b>Pro portal → My contracts</b>, and you can open or download it any time.", P),
      Paragraph("Everyone signs:", H3),
      table([["Document", "In plain English"],
             ["<b>Independent Contractor Agreement</b>", "You run your own business: you choose your offers, hours, methods and helpers, and you can work for anyone, including competitors. Every offer shows your exact payout before you accept; you can also decline or counter. Payouts go out free every week (instant cash-out is optional, for a 1.75% fee). Discounts never reduce your pay, and tips are 100% yours. You fix workmanship issues within 30 days. You agree not to take customers you met through us off the platform for 12 months. There is no non-compete. Disputes go to individual arbitration, and you can opt out within 30 days."],
             ["<b>Pro Code of Conduct</b>", "Be respectful, honest and safe. Zero tolerance for harassment, discrimination, violence, theft or working impaired. Take photos of the work area only. No smoking at customers' homes."],
             ["<b>Pro Deactivation Policy</b>", "Offers stop only for the objective reasons listed, never for declining offers or working elsewhere. Performance issues get a written warning and time to improve. You always get written notice and a human appeal. Money you've earned is always paid."],
             ["<b>Background Check Notice</b>", "Plain-English explanation of our yearly check (criminal records, sex-offender registries, and your driving record for driving trades). It also covers your right to a free copy of your report and to dispute it, with at least 5 business days to respond before any decision."],
             ["<b>Location & Communications Consent</b>", "Location is used only while you're on call or have a job that day. Customers see an approximate position only on the way to their job, and stored locations are erased after 12 hours. Texts, push and email are about offers and jobs; reply STOP any time. Marketing messages are optional."]],
            [2.0 * inch, 5.0 * inch]),
      Paragraph("Also signed, depending on your situation:", H3),
      table([["Document", "Who signs it"],
             ["<b>Trade addendum</b> (one per trade group)", "Matches the trades you picked: Cleaning, Carpet, Organizing & Auto Detailing · Outdoor Work, Trees, Snow & Heights · Hauling, Junk Removal & Containers · Licensed Trades & Home Improvement · Errands & Deliveries · Events, Food & Venues · Pet Care & Pet Waste · Security · Passenger Transportation · Medical Courier & HIPAA · Recruiting"],
             ["<b>No-employees statement</b> (workers' comp)", "Solo pros with no employees, instead of a workers' comp policy"],
             ["<b>Crew Addendum</b>", "Pros who add helpers or crew members to their account"],
             ["<b>Rewards Terms</b>", "When you join Handled Pro Rewards (points on your jobs, redeemed for gear, gift cards and trips)"],
             ["<b>Background check disclosure & authorization</b>", "Everyone. This is signed on <b>Checkr's</b> secure site (a separate standalone form, as federal law requires), not in our portal"],
             ["<b>Stripe Connected Account Agreement</b>", "Everyone, during payout setup on Stripe's site. Stripe holds your bank details; we never see your full account number"]],
            [2.3 * inch, 4.7 * inch])]

s += [Paragraph("How electronic signing works", H3)] + bullets([
    "You read the document, type your full legal name, and tap <b>I agree</b>. That's a legally binding electronic signature under the federal ESIGN Act and Michigan's Uniform Electronic Transactions Act.",
    "We record the date and time, the version you signed, and a digital fingerprint of the exact text you saw, so the copy in <i>My contracts</i> is exactly what you agreed to.",
    "If a document changes later, we'll show you what changed and ask you to sign the new version in your portal.",
    "Spanish versions are available for every document. Switch the language in your portal.",
])

s += [Paragraph("4. What you'll upload", H2),
      table([["Upload", "What we check", "When it's due again"],
             ["Signed W-9", "Name and tax number match", "If your business details change"],
             ["Certificate of insurance (general liability)", "Limits, dates, and Handled Services LLC as additional insured", "Before it expires. Offers pause on the expiry date and restart when you upload the renewal"],
             ["Trade coverage (auto, bond, liquor, passenger)", "Limits and dates", "Before it expires"],
             ["Trade license", "Active with the state, matching name", "Before it expires"],
             ["Workers' comp policy (if you have employees)", "Active policy", "Before it expires"]],
            [2.1 * inch, 2.6 * inch, 2.3 * inch]),
      Paragraph("Only the last 4 digits of your SSN/EIN are stored in our database. Your W-9 and other documents are kept in private storage that only you and authorized Handled staff can open.", S)]

s += [Paragraph("5. After you're approved", H2)] + bullets([
    "<b>Offers</b> arrive in the app and by text, each showing the scope, date and your exact payout. Accept, decline or counter. Declining never counts against you.",
    "<b>Pay:</b> customers prepay. Your payout goes out <b>free every Monday</b> to your bank. Need it sooner? Instant cash-out is optional, for a 1.75% fee.",
    "<b>Taxes:</b> you'll get a 1099-NEC each January for the year's payouts. Set money aside, since no taxes are withheld.",
    "<b>Rewards:</b> earn Pro Rewards points on every job, with more for great work and for staying with us.",
    "<b>Reminders:</b> we'll remind you 30 days before any insurance or license expires.",
    "<b>Help:</b> reply to any Handled email, or write to info@handledsvc.com.",
])
s += [Spacer(1, 10), Paragraph("This packet summarizes your agreements. If anything here differs from a signed agreement, the signed agreement controls. Template under attorney review.", S)]

doc = SimpleDocTemplate(OUT, pagesize=letter, leftMargin=0.75 * inch, rightMargin=0.75 * inch, topMargin=0.7 * inch, bottomMargin=0.75 * inch,
                        title="Handled Pro Welcome Packet", author="Handled Services LLC")
doc.build(s, onFirstPage=footer, onLaterPages=footer)
print("wrote", OUT)
