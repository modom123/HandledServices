# ============================================================================
# FILE    : scripts/build-business-plan-pdf_2026-10-07_0330.py
# RUN     : python3 scripts/build-business-plan-pdf_2026-10-07_0330.py . docs/OUT.pdf docs/OUT.md /tmp/chart.png  (needs reportlab, matplotlib)
# PROJECT : Handled (myhumanai)
# CREATED : 2026-10-07_0330 UTC
# UPDATED : 2026-10-07_0350 UTC — grand opening discount removed (owner decision); early bookings trimmed to match.
# PURPOSE : 12-month projected income statement + 52-week operating plan, merged with the existing business plan
#           (docs/BUSINESS_PLAN_2026-10-01_1830.md) into one PDF. Every number comes from the ASSUMPTIONS below.
# ============================================================================
import re, sys, datetime as dt
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from reportlab.lib.pagesizes import letter, landscape
from reportlab.lib import colors
from reportlab.lib.units import inch
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (BaseDocTemplate, PageTemplate, Frame, Paragraph, Spacer, Table, TableStyle, PageBreak,
                                Image, NextPageTemplate, KeepTogether)

REPO = sys.argv[1]
OUT_PDF = sys.argv[2]
OUT_MD = sys.argv[3]
CHART = sys.argv[4]
STAMP = "2026-10-07_0350"

BLACK, GREEN, GREEN_D, GRAY, LINE, TINT = colors.HexColor("#0a0a0a"), colors.HexColor("#0b7a4e"), colors.HexColor("#075c3a"), colors.HexColor("#525252"), colors.HexColor("#e5e5e5"), colors.HexColor("#ecfdf5")

# ─── Assumptions (base case = the plan's conservative, self-funded year 1, plus what we built since Oct 1) ───
MONTHS = ["Nov 26", "Dec 26", "Jan 27", "Feb 27", "Mar 27", "Apr 27", "May 27", "Jun 27", "Jul 27", "Aug 27", "Sep 27", "Oct 27"]
GROSS = [15000, 24000, 34000, 45000, 56000, 64000, 72000, 80000, 86000, 92000, 98000, 105000]  # bookings at list price
TAKE = 0.28            # blended share we keep (cleaning/hauling 35%, lawn 30%, trees 25%, rides 20%, remodels 15%)
PROMO_FACTOR = [0] * 12   # no launch discount (owner decision 2026-10-07)
PROMO_SHARE, PROMO_DEPTH = 0.75, 0.17                    # 75% of bookings discounted; avg 17% (20% "up to", capped)
CARD = 0.030           # Stripe 2.9% + 30¢ ≈ 3.0% of what customers pay
RESERVE = 0.01         # make-it-right guarantee reserve
REFERRED = [0.03, 0.05, 0.07, 0.09, 0.11, 0.13, 0.15, 0.16, 0.17, 0.18, 0.19, 0.20]  # share of bookings from partners
PARTNER_PCT = 0.10     # partners earn 10% of our take on their customers
IEBC = 0.10            # IEBC AI workforce: 10% of net take
OPEX = {
    "People (founder draw, ops, B2B sales)": [0, 1500, 2000, 3000, 3500, 4500, 6000, 6500, 7000, 7500, 8000, 8500],
    "Marketing (local ads, Nextdoor, flyers, partners)": [2500, 2500, 3000, 3000, 3500, 4000, 4500, 5000, 5000, 5500, 5500, 6000],
    "Technology & AI (Vercel, Supabase, Resend, Twilio, Claude)": [150, 170, 190, 210, 230, 250, 270, 290, 310, 330, 350, 370],
    "Business software (Xero, Gusto, Instantly, Google Workspace)": [160, 160, 160, 160, 160, 160, 230, 230, 230, 230, 230, 230],
    "Insurance (general liability + umbrella)": [350] * 12,
    "Pro vetting (background checks, ID)": [420, 350, 280, 280, 280, 280, 210, 210, 210, 210, 210, 210],
    "Accounting & legal (CPA, filings)": [300] * 12,
    "Other G&A (phone, supplies, bank, misc.)": [250, 250, 250, 250, 300, 300, 300, 300, 350, 350, 350, 350],
}
STARTUP = 18000        # one-time before launch: LLC, first insurance premium, legal review of agreements, trademark, brand

def model():
    rows = {}
    rows["Gross bookings"] = GROSS
    disc = [round(g * PROMO_SHARE * PROMO_DEPTH * f) for g, f in zip(GROSS, PROMO_FACTOR)]
    net_b = [g - d for g, d in zip(GROSS, disc)]
    rows["Customer payments"] = net_b
    pay = [round(g * (1 - TAKE)) for g in GROSS]
    rows["Less: paid to pros"] = [-p for p in pay]
    take = [n - p for n, p in zip(net_b, pay)]
    rows["Our take (revenue)"] = take
    card = [round(n * CARD) for n in net_b]; res = [round(n * RESERVE) for n in net_b]
    ref = [round(g * r * TAKE * PARTNER_PCT) for g, r in zip(GROSS, REFERRED)]
    rows["Card processing (Stripe)"] = [-c for c in card]
    rows["Guarantee reserve (1%)"] = [-r for r in res]
    rows["Referral partner commissions"] = [-r for r in ref]
    net_take = [t - c - r for t, c, r in zip(take, card, res)]
    iebc = [round(max(0, n) * IEBC) for n in net_take]
    rows["IEBC AI workforce (10% of net take)"] = [-i for i in iebc]
    contrib = [t - c - r - f - i for t, c, r, f, i in zip(take, card, res, ref, iebc)]
    rows["Contribution after variable costs"] = contrib
    for k, v in OPEX.items(): rows[k] = [-x for x in v]
    opex = [sum(v[m] for v in OPEX.values()) for m in range(12)]
    rows["Total operating expenses"] = [-o for o in opex]
    ni = [c - o for c, o in zip(contrib, opex)]
    rows["Net operating income"] = ni
    cum, run = [], -STARTUP
    for x in ni: run += x; cum.append(run)
    rows["Cumulative (after $18k startup)"] = cum
    return rows, {"disc": disc, "take": take, "ni": ni, "net_b": net_b, "opex": opex, "cum": cum}

ROWS, K = model()
BOLD = {"Customer payments", "Our take (revenue)", "Contribution after variable costs", "Total operating expenses", "Net operating income", "Cumulative (after $18k startup)"}

def money(v, k=False):
    if k: return f"{'-' if v < 0 else ''}${abs(v)/1000:,.1f}k"
    return f"({abs(v):,.0f})" if v < 0 else f"{v:,.0f}"

# ─── Chart ───
fig, ax = plt.subplots(figsize=(10, 3.6), dpi=200)
x = range(12)
ax.bar([i - 0.2 for i in x], [g / 1000 for g in GROSS], width=0.4, color="#d4d4d4", label="Gross bookings")
ax.bar([i + 0.2 for i in x], [t / 1000 for t in K["take"]], width=0.4, color="#0b7a4e", label="Our take (revenue)")
ax.plot(list(x), [n / 1000 for n in K["ni"]], color="#0a0a0a", marker="o", linewidth=2, label="Net operating income")
ax.axhline(0, color="#0a0a0a", linewidth=0.6)
ax.set_xticks(list(x)); ax.set_xticklabels(MONTHS, fontsize=8); ax.set_ylabel("$ thousands", fontsize=8)
ax.tick_params(axis="y", labelsize=8); ax.spines[["top", "right"]].set_visible(False)
ax.legend(fontsize=8, frameon=False, loc="upper left")
fig.tight_layout(); fig.savefig(CHART); plt.close(fig)

# ─── 52-week plan ───
start = dt.date(2026, 10, 12)  # Monday
WEEKS = [
 ("Go-live setup", "Run the pending Supabase SQL; Resend domain verified (/auth/check all green); Vercel production branch = main; NEXT_PUBLIC_SITE_URL set", "Sign-in works for every role"),
 ("Go-live setup", "Stripe live keys + webhook; connect Xero (Hub → Accounting), create accounts, map checking; Gusto set up for future W-2 staff", "Test booking paid end to end"),
 ("Recruit pros", "Post Indeed/Facebook jobs; approve first cleaners, haulers, lawn/snow crews (up to 3 trades each); background + ID checks", "12 pros approved"),
 ("Soft launch", "Open for bookings Nov 2 at full price; friends & family bookings; Google Business Profile live; referral partners share their links", "First 10 paid jobs"),
 ("Partner program", "Pitch 25 realtors + 15 property managers on the referral program (/partners): 10% of our fee for 12 months", "10 partners signed"),
 ("Snow season prep", "Sign seasonal snow plans (driveways measured in sq ft); line up 4 plow/shovel pros; business lots quoted", "20 snow plans"),
 ("Cleaning push", "Detroit cleaning marketing plan: Nextdoor, local ads, move-out cleans for realtors' listings", "25 cleanings booked"),
 ("B2B pilots", "Business sales engine (Hub → Business leads): pilot offers to offices, clinics, property managers", "2 business pilots"),
 ("Holiday rush", "Holiday deep cleans, junk removal, event rentals; gift cards on the site", "$28k December bookings"),
 ("Quality loop", "Review every photo-QA flag; fix pricing accuracy outliers; 4.8+ rating target", "QA pass ≥ 85%"),
 ("Year-end close", "Xero month-end close; 1099 worksheet for pros and partners; CPA review", "Books closed for 2026"),
 ("Recurring plans", "Convert one-time customers to biweekly plans (AI-timed offer); Handled Plus memberships", "40 recurring customers"),
 ("Gov contracts", "Bid engine: 3 cleaning/facility bids (measured lines, deal-maker pricing); register SAM/City of Detroit", "3 bids submitted"),
 ("Recruit wave 2", "Fill supply gaps from Hub → Supply gaps; second pro per trade for backup coverage", "25 pros approved"),
 ("Winter push", "Email past visitors, partners and the waitlist; snow and deep-clean ads; Handled Plus offer", "$45k February bookings"),
 ("Local PR", "Story to local media and community groups: AI-run local services company in Detroit", "2 press mentions"),
 ("Partner thank-you & reviews", "Partner appreciation event; Google reviews push from happy customers", "50 Google reviews"),
 ("Price check", "Review conversion and pricing accuracy per service; adjust market factors", "Take ≥ 27% blended"),
 ("Commercial cleaning", "Janitorial proposals (bonded crews for $1,500+ jobs); factoring partner chosen for net-30 clients", "3 commercial accounts"),
 ("Spring lawn prep", "Lawn plans sold with measured yard sq ft; aeration/fertilization upsells; recruit lawn crews", "60 lawn plans pre-sold"),
 ("Q1 review", "Income statement vs plan; adjust marketing to best channel (attribution); city scorecard", "Q1 profit target hit"),
 ("Spring cleaning", "Spring deep-clean campaign; windows, gutters, power washing", "$56k March bookings"),
 ("Partner wave 2", "Recruit 30 more partners (contractors, movers, stagers); partner payouts running Mondays", "40 active partners"),
 ("Lawn season live", "Weekly lawn routes; route density bonuses keep pros loyal", "150 lawn customers"),
 ("Hire ops lead", "First full-time ops & quality lead (Gusto payroll); AI-driven rate review", "AI-driven ≥ 80%"),
 ("Remodel pipeline", "Free site visits for bath/kitchen remodels; milestone payments over ACH", "2 remodels signed"),
 ("Gov bids round 2", "Bid on spring/summer grounds contracts using learned market prices from paid jobs", "1 contract won"),
 ("Moves season", "Small moves + junk removal for May–June moves; staging transport for realtors", "$72k May bookings"),
 ("Customer success", "Guarantee/redo audit; repeat-customer rate; referral credits", "Repeat rate ≥ 35%"),
 ("Q2 review", "Half-year close in Xero; update 52-week plan; decide second city criteria", "Half-year profitable"),
 ("Summer events", "Parties & events (catering, rentals, DJs); corporate BBQs", "10 events booked"),
 ("Pro rewards", "Tier upgrades (Pro+/Elite); instant pay at 1.75%; guaranteed weekly minimums", "Pro retention ≥ 85%"),
 ("B2B expansion", "Property-management portfolios: unit turnovers on terms (approved case by case)", "8 business accounts"),
 ("Marketing optimization", "Shift budget to lowest cost-per-booking channel; test the Modern look in one market via ?theme=", "Cost per booking < $35"),
 ("Fall prep", "Leaf removal plans (measured yards); gutter season; snow plan renewals start", "100 leaf jobs pre-sold"),
 ("Back-to-school & move-ins", "Move-in cleans, organizing, handyman", "$86k July bookings"),
 ("Bid engine tune-up", "Record every award/loss; deal-maker learns from results + paid invoices", "Win rate ≥ 25%"),
 ("Q3 review", "Quarter close; profit vs cap (opex ≤ 85% of net take); hire B2B account manager?", "Q3 on plan"),
 ("Leaf season", "Leaf removal + gutter cleaning peak; storm cleanup readiness", "$92k August bookings"),
 ("Snow plans 2027-28", "Sell next winter's seasonal snow plans early (measured driveways/lots)", "150 snow plans"),
 ("Second city scouting", "City scorecard: pick next metro (Ann Arbor / Grand Rapids / Toledo) by demand + supply", "Next city chosen"),
 ("Recruit for city 2", "Pro lead engine in the new city; partner outreach list", "15 pros in pipeline"),
 ("Holiday prep", "Holiday cleaning + gift cards; corporate holiday events", "Holiday calendar 50% booked"),
 ("Operations review", "AI-driven rate, QA, response times; automate the top 3 manual tasks", "AI-driven ≥ 85%"),
 ("Gov bids round 3", "Winter facility/snow contracts with deal-maker pricing", "2 bids submitted"),
 ("Finance check", "Annual budget for year 2 in Xero; line of credit sized to cash gap", "Year-2 budget approved"),
 ("City 2 soft launch prep", "Constraint-driven launch set (junk, cleaning, lawn/snow, handyman); local partners", "Launch date set"),
 ("Year-end promotions", "Handled Plus annual offer; partner bonus for top referrers", "+50 Plus members"),
 ("Year-end close", "Xero close; 1099s for pros and partners (Stripe Connect tax forms); CPA", "Books closed"),
 ("Annual review", "12-month income statement vs actuals; update the 5-year plan", "Year 1 profitable"),
 ("City 2 launch", "Open city 2 with the launch set; launch playbook reused", "First 10 jobs in city 2"),
 ("Plan year 2", "Set year-2 targets ($2M take growth case); hiring plan; B2B portfolios", "Year-2 plan published"),
]
assert len(WEEKS) == 52, len(WEEKS)

# ─── Markdown (for the repo) ───
def write_md():
    L = [f"<!--\n  FILE    : docs/OPERATING_PLAN_12M_52W_{STAMP}.md\n  PROJECT : Handled (myhumanai)\n  CREATED : {STAMP} UTC\n  PURPOSE : 12-month projected income statement (Nov 2026 – Oct 2027) and the 52-week operating plan; the PDF\n            docs/HANDLED_BUSINESS_PLAN_FINAL_{STAMP}.pdf combines these with BUSINESS_PLAN_2026-10-01_1830.md.\n-->\n",
         "# 12-month income statement (projected, base case)\n",
         "| Line | " + " | ".join(MONTHS) + " | Year |", "|---" * 14 + "|"]
    for k, v in ROWS.items():
        tot = v[-1] if k.startswith("Cumulative") else sum(v)
        L.append(f"| {k} | " + " | ".join(money(x) for x in v) + f" | {money(tot)} |")
    L += ["", "# 52-week plan", "", "| Week | Starts | Focus | Actions | Target |", "|---|---|---|---|---|"]
    for i, (f, a, t) in enumerate(WEEKS):
        L.append(f"| {i+1} | {(start + dt.timedelta(weeks=i)).isoformat()} | {f} | {a} | {t} |")
    open(OUT_MD, "w").write("\n".join(L) + "\n")
write_md()

# ─── PDF ───
ss = getSampleStyleSheet()
H1 = ParagraphStyle("H1", parent=ss["Heading1"], fontName="Helvetica-Bold", fontSize=18, textColor=BLACK, spaceAfter=8, spaceBefore=4)
H2 = ParagraphStyle("H2", parent=ss["Heading2"], fontName="Helvetica-Bold", fontSize=13, textColor=GREEN_D, spaceAfter=6, spaceBefore=10)
H3 = ParagraphStyle("H3", parent=ss["Heading3"], fontName="Helvetica-Bold", fontSize=11, textColor=BLACK, spaceAfter=4, spaceBefore=8)
P = ParagraphStyle("P", parent=ss["BodyText"], fontName="Helvetica", fontSize=9.5, leading=13, textColor=BLACK, spaceAfter=5)
SMALL = ParagraphStyle("S", parent=P, fontSize=7.5, leading=9.5)
CELL = ParagraphStyle("C", parent=P, fontSize=7.5, leading=9, spaceAfter=0)
CELLB = ParagraphStyle("CB", parent=CELL, fontName="Helvetica-Bold")

def esc(s): return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
def inline(s):
    s = esc(s)
    s = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", s)
    s = re.sub(r"(?<!\*)\*(?!\s)(.+?)(?<!\s)\*(?!\*)", r"<i>\1</i>", s)
    s = re.sub(r"`([^`]+)`", r"<font face='Courier' size='8'>\1</font>", s)
    s = re.sub(r"\[([^\]]+)\]\(([^)]+)\)", r"\1", s)
    return s

def tstyle(header=True, zebra=True):
    st = [("FONT", (0, 0), (-1, -1), "Helvetica", 7.5), ("GRID", (0, 0), (-1, -1), 0.25, LINE), ("VALIGN", (0, 0), (-1, -1), "TOP"),
          ("LEFTPADDING", (0, 0), (-1, -1), 4), ("RIGHTPADDING", (0, 0), (-1, -1), 4), ("TOPPADDING", (0, 0), (-1, -1), 2.5), ("BOTTOMPADDING", (0, 0), (-1, -1), 2.5)]
    if header: st += [("BACKGROUND", (0, 0), (-1, 0), BLACK), ("TEXTCOLOR", (0, 0), (-1, 0), colors.white), ("FONT", (0, 0), (-1, 0), "Helvetica-Bold", 7.5)]
    return st

def footer(canvas, doc):
    canvas.saveState()
    w, h = canvas._pagesize
    canvas.setFillColor(BLACK); canvas.rect(0, h - 6, w, 6, stroke=0, fill=1)
    canvas.setFillColor(GREEN); canvas.rect(0, h - 8, w, 2, stroke=0, fill=1)
    canvas.setFont("Helvetica", 7); canvas.setFillColor(GRAY)
    canvas.drawString(0.6 * inch, 0.4 * inch, "Handled Services LLC — Business Plan & 12-Month Operating Plan · Confidential · Projections, not guarantees")
    canvas.drawRightString(w - 0.6 * inch, 0.4 * inch, f"Page {doc.page}")
    canvas.restoreState()

doc = BaseDocTemplate(OUT_PDF, pagesize=letter, leftMargin=0.6 * inch, rightMargin=0.6 * inch, topMargin=0.6 * inch, bottomMargin=0.7 * inch,
                      title="Handled — Business Plan & 12-Month Operating Plan", author="Handled Services LLC")
pw, ph = letter
lw, lh = landscape(letter)
doc.addPageTemplates([
    PageTemplate("portrait", [Frame(0.6 * inch, 0.7 * inch, pw - 1.2 * inch, ph - 1.3 * inch, id="p")], onPage=footer, pagesize=letter),
    PageTemplate("landscape", [Frame(0.5 * inch, 0.7 * inch, lw - 1.0 * inch, lh - 1.25 * inch, id="l")], onPage=footer, pagesize=landscape(letter)),
])
S = []

# Cover
S += [Spacer(1, 1.6 * inch), Paragraph("<font color='#0b7a4e'>Handled</font>", ParagraphStyle("brand", parent=H1, fontSize=40, leading=46)),
      Paragraph("Business Plan &amp; 12-Month Operating Plan", ParagraphStyle("t", parent=H1, fontSize=24, leading=30)),
      Spacer(1, 10), Paragraph("Home &amp; business services, handled. Metro Detroit launch, built to scale nationwide.", P),
      Spacer(1, 30)]
yr_take = sum(K["take"]); yr_ni = sum(K["ni"]); yr_gross = sum(GROSS)
cover = [["Year 1 gross bookings", f"${yr_gross/1000:,.0f}k"], ["Year 1 revenue (our take)", f"${yr_take/1000:,.0f}k"],
         ["Year 1 net operating income", f"${yr_ni/1000:,.1f}k"], ["Break-even month", next((MONTHS[i] for i, v in enumerate(K["ni"]) if v > 0), "—")],
         ["Startup paid back", next((MONTHS[i] for i, v in enumerate(K["cum"]) if v >= 0), "after month 12")]]
t = Table(cover, colWidths=[3 * inch, 2 * inch]); t.setStyle(TableStyle(tstyle(header=False) + [("FONT", (0, 0), (-1, -1), "Helvetica", 11), ("FONT", (1, 0), (1, -1), "Helvetica-Bold", 11), ("TEXTCOLOR", (1, 0), (1, -1), GREEN_D), ("TOPPADDING", (0, 0), (-1, -1), 6), ("BOTTOMPADDING", (0, 0), (-1, -1), 6)]))
S += [t, Spacer(1, 40), Paragraph(f"Prepared {dt.date(2026, 10, 7).strftime('%B %d, %Y')} · Base case (conservative, self-funded). Growth case shown for comparison.", SMALL), PageBreak()]

# Executive summary
S += [Paragraph("Executive summary", H1),
      Paragraph("Handled is one company and one app for home and business services: cleaning, lawn and snow, hauling, repairs, trades, remodels, errands, events and rides. Customers get an upfront price in about a minute, a vetted and insured pro, photo-checked work and a 30-day make-it-right guarantee. Handled keeps 15–35% of every job (like Uber) and pays pros only from money already collected, so no job can lose money.", P),
      Paragraph("What's new since the October 1 plan (built and live):", H3)]
for b in ["<b>Accounting:</b> Xero is the books of record; every day of Stripe activity, business invoices and pro payouts post automatically.",
          "<b>Referral Partner Program:</b> realtors, property managers, contractors and neighbors earn 10% of our fee for 12 months on customers they send.",
          "<b>Measured pricing:</b> lawns, snow, trees, junk, deliveries and more are priced from real measurements (sq ft, lb, cu yd).",
          "<b>Bid engine deal-maker:</b> public bids are priced for the best expected profit, anchored on past awards and on what our own customers pay.",
          "<b>Pro rules:</b> pros pick up to 3 trades; residential cleaners need no license or bond (bond only for $1,500+ commercial jobs); instant pay at 1.75%.",
          "<b>Sign-in:</b> one email with a code and a link that works on any device, for customers, businesses, pros, partners and staff."]:
    S.append(Paragraph("• " + b, P))
S += [Paragraph("Year 1 at a glance (base case)", H3)]
q = lambda arr, a, b: sum(arr[a:b])
qt = [["", "Q1 (Nov–Jan)", "Q2 (Feb–Apr)", "Q3 (May–Jul)", "Q4 (Aug–Oct)", "Year 1"],
      ["Gross bookings"] + [f"${q(GROSS, i, i+3)/1000:,.0f}k" for i in (0, 3, 6, 9)] + [f"${yr_gross/1000:,.0f}k"],
      ["Our take (revenue)"] + [f"${q(K['take'], i, i+3)/1000:,.1f}k" for i in (0, 3, 6, 9)] + [f"${yr_take/1000:,.1f}k"],
      ["Operating expenses"] + [f"${q(K['opex'], i, i+3)/1000:,.1f}k" for i in (0, 3, 6, 9)] + [f"${sum(K['opex'])/1000:,.1f}k"],
      ["Net operating income"] + [money(q(K['ni'], i, i+3), True) for i in (0, 3, 6, 9)] + [money(yr_ni, True)]]
t = Table(qt, colWidths=[1.9 * inch] + [1.05 * inch] * 5); t.setStyle(TableStyle(tstyle() + [("ALIGN", (1, 0), (-1, -1), "RIGHT"), ("FONT", (0, -1), (-1, -1), "Helvetica-Bold", 7.5), ("BACKGROUND", (0, -1), (-1, -1), TINT)]))
S += [t, Spacer(1, 8),
      Paragraph(f"The first months run at a small loss while volume builds (no launch discount: customers pay full price from day one). The business turns profitable in {next((MONTHS[i] for i, v in enumerate(K['ni']) if v > 0), '—')} and earns back the ${STARTUP/1000:.0f}k startup cost in {next((MONTHS[i] for i, v in enumerate(K['cum']) if v >= 0), 'year 2')}. Spending stays inside the plan's rule: operating costs at or below 85% of net take.", P),
      Paragraph(f"Spending check: operating costs plus IEBC and partner commissions come to {(sum(K['opex']) - ROWS['IEBC AI workforce (10% of net take)'][0]*0 + -sum(ROWS['IEBC AI workforce (10% of net take)']) + -sum(ROWS['Referral partner commissions'])) / (sum(K['take']) + sum(ROWS['Card processing (Stripe)']) + sum(ROWS['Guarantee reserve (1%)'])):.0%} of net take for the year (plan rule: 85% or less).", P),
      Paragraph("Growth case for comparison: the October 4 growth plan targets $0.5M of take in year 1 ($2.5M bookings), which needs business accounts and outside capital earlier. The base case below is what the business can do self-funded.", P),
      NextPageTemplate("landscape"), PageBreak()]

# Income statement (landscape)
S += [Paragraph("12-month projected income statement — base case (Nov 2026 – Oct 2027)", H1)]
data = [["", *MONTHS, "Year 1"]]
for k, v in ROWS.items():
    tot = v[-1] if k.startswith("Cumulative") else sum(v)
    data.append([Paragraph(k, CELLB if k in BOLD else CELL), *[money(x) for x in v], money(tot)])
t = Table(data, colWidths=[2.55 * inch] + [0.53 * inch] * 12 + [0.62 * inch], repeatRows=1)
st = tstyle() + [("ALIGN", (1, 1), (-1, -1), "RIGHT"), ("FONT", (1, 1), (-1, -1), "Helvetica", 7)]
for i, k in enumerate(ROWS.keys(), start=1):
    if k in BOLD: st += [("FONT", (1, i), (-1, i), "Helvetica-Bold", 7), ("BACKGROUND", (0, i), (-1, i), TINT)]
for i, v in enumerate(K["ni"]):
    if v < 0: st += [("TEXTCOLOR", (i + 1, list(ROWS).index("Net operating income") + 1), (i + 1, list(ROWS).index("Net operating income") + 1), colors.HexColor("#b91c1c"))]
t.setStyle(TableStyle(st))
S += [t, Spacer(1, 6), Paragraph("Dollars; (parentheses) = cost or loss. Taxes not shown (LLC income passes through to the owner).", SMALL),
      Spacer(1, 4), Image(CHART, width=9.4 * inch, height=3.38 * inch), PageBreak()]

S += [Paragraph("Assumptions behind the numbers", H1)]
asm = [["Item", "Assumption", "Where it comes from"],
       ["Bookings ramp", f"${GROSS[0]/1000:.0f}k in month 1 to ${GROSS[-1]/1000:.0f}k in month 12 (${yr_gross/1000:,.0f}k year 1)", "Business plan base case ($0.67M) plus the referral partner boost; full price from day one"],
       ["Our take", f"{TAKE:.0%} blended of list price", "35% cleaning/hauling, 30% lawn/handyman, 25% trees, 20% rides, 15% remodels"],
       ["Card processing", f"{CARD:.1%} of customer payments", "Stripe 2.9% + 30¢"],
       ["Guarantee reserve", f"{RESERVE:.0%} of customer payments", "30-day make-it-right guarantee"],
       ["Referral partners", f"{REFERRED[0]:.0%} → {REFERRED[-1]:.0%} of bookings referred; partners earn {PARTNER_PCT:.0%} of our take", "Partner Program (paid after the 30-day window)"],
       ["IEBC AI workforce", f"{IEBC:.0%} of net take", "Business plan §3 revenue share"],
       ["People", "Founder draw from month 2; part-time ops; full-time ops & quality lead from May (Gusto)", "Business plan team table, paced to cash"],
       ["Marketing", "$2.5k → $6k a month: Google Business Profile, local service ads, Nextdoor, flyers, partner kits", "Detroit cleaning marketing plan"],
       ["Technology", "Vercel, Supabase, Resend, Twilio, Claude AI (~$0.50/job)", "Current stack"],
       ["Software", "Xero, Gusto (from first W-2 hire), Instantly, Google Workspace", "Current stack"],
       ["Startup (one-time)", f"${STARTUP/1000:.0f}k before launch", "LLC, first insurance premium, legal review, trademark, brand"]]
t = Table([[Paragraph(c, CELLB if i == 0 else CELL) for c in r] for i, r in enumerate(asm)], colWidths=[1.6 * inch, 4.4 * inch, 3.9 * inch], repeatRows=1)
t.setStyle(TableStyle(tstyle()))
S += [t, Spacer(1, 8), Paragraph("Biggest swings: the blended take (every point is about $8k a year), how fast first customers turn into recurring plans, and how fast business accounts and public contracts arrive. Hub → Finance and Xero show actuals against this plan every month.", P),
      NextPageTemplate("landscape"), PageBreak()]

# 52-week plan
S += [Paragraph("52-week operating plan", H1), Paragraph("Week 1 starts Monday, October 12, 2026. Soft launch begins in week 4 (November 2).", P)]
data = [["Wk", "Starts", "Focus", "Key actions", "Target"]]
for i, (f, a, tg) in enumerate(WEEKS):
    data.append([str(i + 1), (start + dt.timedelta(weeks=i)).strftime("%b %d"), Paragraph(f, CELLB), Paragraph(a, CELL), Paragraph(tg, CELL)])
t = Table(data, colWidths=[0.35 * inch, 0.6 * inch, 1.7 * inch, 5.3 * inch, 2.0 * inch], repeatRows=1)
st = tstyle()
for i in range(1, 53):
    if (i - 1) // 13 % 2 == 1: st.append(("BACKGROUND", (0, i), (-1, i), colors.HexColor("#f7f7f7")))
t.setStyle(TableStyle(st))
S += [t, NextPageTemplate("portrait"), PageBreak()]

# Existing business plan (from markdown)
S += [Paragraph("Business plan", H1), Paragraph("The October plan, unchanged except where noted above. Section numbers follow the original.", SMALL)]
md = open(f"{REPO}/docs/BUSINESS_PLAN_2026-10-01_1830.md").read()
md = re.sub(r"<!--.*?-->", "", md, flags=re.S)
lines = md.split("\n"); i = 0
avail = pw - 1.2 * inch
while i < len(lines):
    ln = lines[i].rstrip()
    if ln.startswith("|"):
        block = []
        while i < len(lines) and lines[i].startswith("|"): block.append(lines[i]); i += 1
        rows = [[c.strip() for c in r.strip().strip("|").split("|")] for r in block if not re.match(r"^\|\s*-", r)]
        n = max(len(r) for r in rows)
        rows = [r + [""] * (n - len(r)) for r in rows]
        t = Table([[Paragraph(inline(c), CELLB if ri == 0 else CELL) for c in r] for ri, r in enumerate(rows)], colWidths=[avail / n] * n, repeatRows=1)
        t.setStyle(TableStyle(tstyle())); S += [t, Spacer(1, 6)]; continue
    if ln.startswith("# "): pass  # document title already on the cover
    elif ln.startswith("## "): S.append(Paragraph(inline(ln[3:]), H2))
    elif ln.startswith("### "): S.append(Paragraph(inline(ln[4:]), H3))
    elif re.match(r"^\s*(-|\d+\.)\s", ln):
        m = re.match(r"^\s*(-|\d+\.)\s+(.*)$", ln); bullet = "•" if m.group(1) == "-" else m.group(1)
        S.append(Paragraph(f"{bullet} {inline(m.group(2))}", ParagraphStyle("li", parent=P, leftIndent=12, firstLineIndent=-9)))
    elif ln.strip() == "---": S.append(Spacer(1, 4))
    elif ln.strip():
        para = [ln]
        while i + 1 < len(lines) and lines[i + 1].strip() and not re.match(r"^(\||#|\s*-\s|\s*\d+\.\s|---)", lines[i + 1]): i += 1; para.append(lines[i].strip())
        S.append(Paragraph(inline(" ".join(para)), P))
    i += 1

doc.build(S)
print("ok", OUT_PDF)
