# ============================================================================
# FILE    : scripts/build-pro-network-welcome-pdf_2026-11-10_1316.py
# PROJECT : Handled (HandledServices) — AI-run home & business services
# CREATED : 2026-11-10_1316 UTC
# PURPOSE : Builds "Welcome to the Handled Network", the guide every pro gets when they're activated (linked from the
#           welcome email, packages/core/src/pro-welcome.ts): how the pro portal works, the day of a job, how and when
#           they're paid, tiers, rewards, refer-a-pro, the Partner Program (with the real rate ladders), the rules that
#           matter and where to get help. The setup steps before approval stay in the Pro Welcome Packet (2026-10-07).
#           Every number is read from packages/core through scripts/pro-network-welcome-facts_2026-11-10_1316.mts.
#           Run from the repo root:
#             python3 scripts/build-pro-network-welcome-pdf_2026-11-10_1316.py
#           Writes docs/HANDLED_PRO_NETWORK_WELCOME_<date>.pdf and apps/web/public/docs/handled-pro-network-welcome.pdf
#           (the stable link the email uses).
# UPDATED : 2026-11-12_2300 UTC — honest about where we are (a new company growing market by market; offers may be light
#           at first) instead of "job offers from today"; setting the home ZIP, driving distance and ZIP list is step 1
#           (it decides which jobs and texts reach them); "More work while we grow".
# ============================================================================
import json, os, shutil, subprocess, sys
from datetime import datetime, timezone
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.units import inch
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
STAMP = datetime.now(timezone.utc).strftime("%Y-%m-%d_%H%M")
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, "docs", f"HANDLED_PRO_NETWORK_WELCOME_{STAMP}.pdf")
PUBLIC = os.path.join(ROOT, "apps", "web", "public", "docs", "handled-pro-network-welcome.pdf")

facts_js = os.path.join(ROOT, "scripts", "pro-network-welcome-facts_2026-11-10_1316.mts")
F = json.loads(subprocess.run(["node", "--experimental-strip-types", "--no-warnings", facts_js], cwd=ROOT, capture_output=True, text=True, check=True).stdout)

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
def keep(*xs): return KeepTogether(list(xs))
def bullets(items): return [Paragraph(i, B, bulletText="•") for i in items]
def table(rows, widths, head=True):
    data = [[Paragraph(str(c), CB if (head and r == 0) else C) for c in row] for r, row in enumerate(rows)]
    t = Table(data, colWidths=widths, repeatRows=1 if head else 0)
    st = [("VALIGN", (0, 0), (-1, -1), "TOP"), ("GRID", (0, 0), (-1, -1), 0.4, LINE),
          ("LEFTPADDING", (0, 0), (-1, -1), 5), ("RIGHTPADDING", (0, 0), (-1, -1), 5), ("TOPPADDING", (0, 0), (-1, -1), 4), ("BOTTOMPADDING", (0, 0), (-1, -1), 4)]
    if head: st += [("BACKGROUND", (0, 0), (-1, 0), TINT)]
    t.setStyle(TableStyle(st)); return t

def footer(canvas, doc):
    canvas.saveState(); canvas.setFont("Helvetica", 7.5); canvas.setFillColor(SOFT)
    canvas.drawString(0.75 * inch, 0.5 * inch, f"Handled Services LLC · Welcome to the Handled Network · {STAMP[:10]} · {F['email']} · {F['phone']}")
    canvas.drawRightString(7.75 * inch, 0.5 * inch, f"Page {doc.page}"); canvas.restoreState()

tiers = {t["name"]: t for t in F["tiers"]}
plus, elite = tiers["Pro+"], tiers["Elite"]
ip, ins, ref = F["instantPay"], F["insurance"], F["referral"]
rw = F["rewards"]
s = []

s += [Paragraph("Welcome to the Handled Network", H1),
      Paragraph("Your guide to the pro portal, getting paid, growing with us and earning more.", SUB),
      Paragraph("You're approved and live, and you can take jobs as soon as they come in. "
                "You're an <b>independent pro (1099)</b>: you choose which offers to take, your area, your days and hours, and you keep your own customers. "
                "We bring the customers, collect the payment, and handle the scheduling, reminders, reviews and support.", P),
      Paragraph("<b>A straight answer about where we are:</b> Handled is a new company. We're growing market by market, so at first "
                "offers may come a few at a time, and some weeks there may be none in your trades and area. We'd rather tell you that now than "
                "promise you a full calendar. Every job we do send is <b>prepaid, pre-priced</b> and yours to take or pass, and as we grow, the "
                "pros who are set up and quick to respond are first in line.", P),
      Paragraph("Your welcome email lists what you told us: your trades, area, schedule and the services you're cleared to take. "
                "Check it, and fix anything in <b>Pro portal → My info</b>.", P)]

s += [Paragraph("1. Your first day", H2),
      table([["#", "Do this", "Why"],
             ["1", "Set your area in <b>Setup &amp; documents</b>: your home-base ZIP, how far you'll drive, and any ZIP codes you want to cover", "We only offer you jobs inside your area, and only text you about jobs there. No home ZIP, no offers near you"],
             ["2", "Turn on notifications in the Handled app", "Offers go to the first qualified pros who accept. Notifications make sure you see them"],
             ["3", "Do the short orientation: Pro portal → <b>Welcome to Handled</b>", "How offers, photos and payouts work, in about 10 minutes"],
             ["4", "Check your <b>Calendar</b>: days off, open slots, daily limit", "Customers can only book you on days you're open. We never offer past your daily limit"],
             ["5", "Read the <b>Checklists</b> for your services", "They're what \"done\" means. Photo review checks the work against them"],
             ["6", "Optional: set <b>My prices</b>", "Your own price for each service (customers see it with your rating)"]],
            [0.3 * inch, 3.3 * inch, 3.4 * inch])]

s += [Paragraph("<b>Your area decides which jobs reach you.</b>", P)] + bullets([
    "<b>ZIP (your home base):</b> we measure the distance to every job from here. Use the place you head out to work from.",
    "<b>How far you'll drive (miles):</b> pick a realistic distance. More miles means more offers, but only take what you'll really show up for.",
    "<b>ZIP codes you want to cover (optional):</b> listed ZIPs get offers even past your driving distance. Tick <b>Only send me jobs in these ZIP codes</b> to stay inside them.",
])
s += [Paragraph("<b>More work while we grow.</b>", P)] + bullets([
    "Keep your area, days and hours complete and current: it's what brings you the most offers.",
    "Check <b>Jobs near you</b> in your portal: untaken jobs that fit you, including jobs customers post at their own price. Keep job alerts on <b>All</b> to hear first about top-pay jobs in your area.",
    "Answer fast: the first pro to accept gets the job, and accepting on time moves you up the line.",
    "Send us customers (section 6): you earn on every job, and it brings work to your area.",
])

s += [Paragraph("2. How your pro portal works", H2),
      Paragraph("Sign in at <b>handledsvc.com/pro</b> or in the Handled app. Everything is in three menus:", P),
      table([["Menu", "Page", "What it's for"],
             ["Work", "Jobs", "Your offers and today's jobs. Each offer shows the service, scope, date, area, required photos and <b>your exact pay before you accept</b>. Accept or pass. Passing never costs you anything"],
             ["", "Calendar", "The next five weeks: booked jobs, open slots against your daily limit, days off. Sync to Google, Apple or Outlook"],
             ["", "Checklists", "What each kind of job includes, in your language"],
             ["", "My crew", "Helpers you send to jobs: sign the Crew Addendum, add people (each gets a background check)"],
             ["Money", "My prices", "Set your own price per service (within a range of our suggested price)"],
             ["", "Earnings", "Every payout, instant pay, and your running 1099 total"],
             ["", "Rewards", "Your Handled Pro Rewards points and the catalog"],
             ["", "Refer & earn", "Your referral link and code, referral tickets, and your Partner Program commissions"],
             ["Account", "Welcome to Handled", "The orientation"],
             ["", "My info · Setup & documents · My contracts", "Your profile, trades and area; insurance, licenses and expiry dates; every agreement you signed"]],
            [0.85 * inch, 1.6 * inch, 4.55 * inch])]

s += [Paragraph("3. The day of a job", H2),
      table([["Step", "What you do", "What happens"],
             ["Before", "Accept the offer", "You get the full address and the customer's contact details"],
             ["Head out", "Tap <b>Start</b>", "The customer sees you're on the way, and when you arrive"],
             ["Arrive", "Take the <b>before</b> photos the job asks for", "They protect you if there's ever a question about the job"],
             ["Work", "Follow the checklist", "Scope bigger than booked? Update it in the app. The customer approves and pays for the extra <b>before</b> you do it"],
             ["Materials", "Keep the receipt", f"Materials not in the price are reimbursed at cost (up to {usd(F['materials']['autoApproveUpTo'])} approved automatically; more is reviewed)"],
             ["Finish", "Take the <b>after</b> photos and tap <b>Complete</b>", "We check the photos against the checklist, then your pay is approved"]],
            [0.9 * inch, 2.4 * inch, 3.7 * inch]),
      Paragraph(f"Your first {F['probation']['jobs']} jobs are under {usd(F['probation']['maxJobPrice'])}, and each one gets a photo review by our team.", S)]

s += [Paragraph("4. How and when you're paid", H2)] + bullets([
    "<b>The customer has already paid</b> before you're sent. You never collect money, send invoices or wait on a check.",
    "<b>The pay on the offer is the pay you get.</b> No lead fees, no subscription, no software bill.",
    "<b>Every Monday</b>, payouts go to your bank automatically through Stripe, with a statement for every job. The weekly payout is free.",
    f"<b>Instant pay</b> (optional): after {ip['minJobs']} jobs, cash out the same day for {pct(ip['feePct'])} (minimum {usd(ip['minFee'])}).",
    f"<b>Show-up pay</b>: if a customer cancels late or locks you out, you get up to {usd(F['showUpPay'])}.",
    "<b>Pay protection</b>: a refund that wasn't caused by your work comes out of our share first.",
    "<b>Tips</b> are 100% yours. Your 1099 total is always on the Earnings page.",
]) + [Paragraph("Benefit amounts are the Pro Program defaults. Your Earnings page always shows what applies to you today.", S)]

s += [Paragraph("5. How you grow with us", H2),
      table([["Tier", "You reach it at", "What you get"],
             ["Pro", "Approval", "Prepaid, pre-priced jobs in your area · weekly payouts · no lead fees"],
             ["Pro+", f"{plus['jobs']} jobs · {plus['rating']} stars · {pct(plus['onTime'])} on time", f"+{pct(plus['boost'])} of the job price on every payout · ahead of Pro-tier pros for every offer"],
             ["Elite", f"{elite['jobs']} jobs · {elite['rating']} stars · {pct(elite['onTime'])} on time", f"+{pct(elite['boost'])} of the job price on every payout · top of the list for every offer, including large and commercial jobs"]],
            [0.8 * inch, 2.2 * inch, 4.0 * inch])] + bullets([
    "<b>Recurring customers stay with you</b>: when a customer you served signs up for a plan, every visit is offered to you first, a full day before anyone else.",
    f"<b>Handled Pro Rewards</b>: {rw['earnRate']} points for every $1 Handled earns on your jobs, ×{rw['quality']:g} for perfect jobs ({rw['minRating']}+ stars, no redo), and more the longer you stay ("
    + ", ".join(f"×{t['multiplier']:g} at {t['label']}" for t in F["tenure"] if t["multiplier"] > 1)
    + f"). Points are pending for {rw['pendingDays']} days, then spendable on gear, tools, electronics and trips. Passing on offers never costs points.",
    f"<b>Insurance credit</b>: {usd(ins['stipend'])} after your {ins['afterJobs']}th job.",
])

rl, sl, ft = F["referralLadder"], F["salesLadder"], F["fastTrack"]
s += [Paragraph("6. Earn more: referrals and the Partner Program", H2),
      Paragraph("Every pro is also a partner. There are three ways to earn on top of your jobs. Commissions arrive with your weekly payout, "
                f"once each job is past our {F['partner']['holdDays']}-day make-it-right window.", P),
      table([["Way to earn", "How it works", "You earn"],
             ["Refer a pro", "Share your link with a pro you'd vouch for", f"{usd(ref['bonus'])} when they finish {ref['afterJobs']} jobs"],
             ["Refer customers", "Share your link or code, or snap photos of a job that isn't your trade and send a referral ticket", f"{pct(rl[0]['rate'])} of the job price, rising to {pct(rl[-1]['rate'])}, on every job from that customer for {F['partner']['months']} months"],
             ["Direct sales", "Sell a job on a sales ticket; the customer pays on the spot from your phone or our text", f"{pct(sl[0]['rate'])} of our profit, rising to {pct(sl[-1]['rate'])}"]],
            [1.3 * inch, 3.3 * inch, 2.4 * inch]),
      Paragraph("How your commission rate climbs", H3),
      Paragraph(f"Every raise is one point, the first ones come quickly, and your rate never goes down. Raises are based on the profit your jobs bring in "
                f"(sales count {ft['directCredit']:g}×, referrals 1×).", P),
      table([["Customer referrals (of the job price)", "Reached at"]] + [[pct(r["rate"]) + (" to start" if i == 0 else " (top)" if i == len(rl) - 1 else ""), "—" if i == 0 else usd(r["credit"])] for i, r in enumerate(rl)],
            [3.5 * inch, 3.5 * inch]),
      Spacer(1, 6),
      table([["Direct sales (of our profit)", "Reached at"]] + [[pct(r["rate"]) + (" to start" if i == 0 else " (top)" if i == len(sl) - 1 else ""), "—" if i == 0 else usd(r["credit"])] for i, r in enumerate(sl)],
            [3.5 * inch, 3.5 * inch]),
      Paragraph(f"Fast track: every {ft['jobsPerStep']} jobs also moves you up one point, up to {pct(ft['capRate'])} (a sale counts as {ft['directCredit']:g} jobs). "
                "Your partner page shows your rate and exactly what gets you the next raise.", S)]

s += [Paragraph("7. Rules that matter", H2)] + bullets([
    "<b>You stay independent.</b> Accept the jobs you want, set your area, days and daily limit, and keep your own business and other clients. There is no non-compete.",
    "<b>Customers you met through Handled</b>: work with them through the platform for 12 months after you're introduced. Your own customers are always yours.",
    "<b>Photo proof on every job.</b> If something's missed, the customer gets a free redo. Getting it right the first time raises your rating and your rewards.",
    "<b>Be respectful, honest and safe</b> (Pro Code of Conduct). Offers only stop for the objective reasons in the Deactivation Policy, with written notice and a human appeal. Money you've earned is always paid.",
    "<b>Keep your insurance and licenses current.</b> We remind you before anything expires; an expired document pauses only the services that need it.",
    "Every agreement you signed is in <b>Pro portal → My contracts</b>, in English and Spanish.",
])

s += [Paragraph("8. Help", H2),
      table([["Need", "Where"],
             ["A question about a job or a customer", "Message the customer from the job in the app, or call us"],
             ["Pay, payouts or your 1099", "Pro portal → Earnings, or call us"],
             ["Change your trades, area, hours or prices", "Pro portal → My info · Calendar · My prices"],
             ["Anything else", f"{F['phone']} · {F['email']}"]],
            [3.0 * inch, 4.0 * inch]),
      Spacer(1, 10),
      Paragraph("Glad to have you on the team. — Handled", P)]

os.makedirs(os.path.dirname(OUT), exist_ok=True)
SimpleDocTemplate(OUT, pagesize=letter, leftMargin=0.75 * inch, rightMargin=0.75 * inch, topMargin=0.7 * inch, bottomMargin=0.75 * inch,
                  title="Welcome to the Handled Network", author="Handled Services LLC").build(s, onFirstPage=footer, onLaterPages=footer)
os.makedirs(os.path.dirname(PUBLIC), exist_ok=True)
shutil.copyfile(OUT, PUBLIC)
print(OUT); print(PUBLIC)
