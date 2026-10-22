# ============================================================================
# FILE    : scripts/build-recruiting-flyer-pdf_2026-10-22_0535.py
# PROJECT : Handled (HandledServices) — AI-run home & business services
# CREATED : 2026-10-22_0535 UTC
# PURPOSE : The referral RECRUITING FLYER (one printable letter page): what a referrer earns, how it works, who it's for,
#           and a QR code that opens the partner sign-up (handledsvc.com/join → /partners#join, tagged src=flyer).
#           Referrer-facing: no Handled margins or pro shares. Dollar examples come from the pricing engine
#           (scripts/referral-pricing-data_2026-10-22_0525.ts).
#           Personal flyer for a pro or partner (they're told when someone joins from it):
#             python3 scripts/build-recruiting-flyer-pdf_2026-10-22_0535.py --code JANE7K2Q --name "Jane Lee"
#           Options: --site https://handledsvc.com (default) · --src flyer · --out <path>
#           Output: docs/HANDLED_REFERRAL_FLYER_<stamp>[_CODE].pdf
# ============================================================================
import argparse, json, subprocess, datetime as dt, pathlib
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.units import inch
from reportlab.pdfgen import canvas
from reportlab.graphics.barcode.qr import QrCodeWidget
from reportlab.graphics.shapes import Drawing
from reportlab.graphics import renderPDF
from reportlab.platypus import Paragraph
from reportlab.lib.styles import ParagraphStyle

ap = argparse.ArgumentParser()
ap.add_argument("--site", default="https://handledsvc.com")
ap.add_argument("--src", default="flyer")
ap.add_argument("--code", default=None, help="partner code for a personal flyer")
ap.add_argument("--name", default=None, help="name shown on a personal flyer")
ap.add_argument("--out", default=None)
a = ap.parse_args()

ROOT = pathlib.Path(__file__).resolve().parent.parent
STAMP = dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%d_%H%M")
code = (a.code or "").strip().upper() or None
OUT = pathlib.Path(a.out) if a.out else ROOT / "docs" / f"HANDLED_REFERRAL_FLYER_{STAMP}{'_' + code if code else ''}.pdf"
site = a.site.rstrip("/")
url = f"{site}/join" + (f"?src={a.src}" if a.src != "flyer" else "") + (("&" if a.src != "flyer" else "?") + f"by={code}" if code else "")
shown = url.replace("https://", "").replace("http://", "")
d = json.loads(subprocess.run(["node", "--experimental-strip-types", "scripts/referral-pricing-data_2026-10-22_0525.ts"], cwd=ROOT, capture_output=True, text=True, check=True).stdout)
R = d["rates"]
lawn, roof = d["examples"]
def ex(e, label): return next(r for r in e["rows"] if r["label"].startswith(label) and not r["proPays"])  # the referrer earns the same either way
lawn_t, lawn_p, roof_t = ex(lawn, "Referral ticket"), ex(lawn, "Referred person"), ex(roof, "Referral ticket")
def m0(n): return f"${n:,.0f}"
def pc(x): return f"{round(x * 100):d}%"

GREEN, GREEN_D, INK, GRAY, TINT, GOLD, LINE = (colors.HexColor(c) for c in ("#0b7a4e", "#075c3a", "#0a0a0a", "#525252", "#ecfdf5", "#d4a017", "#e5e5e5"))
W, H = letter
c = canvas.Canvas(str(OUT), pagesize=letter)
c.setTitle("Handled — Get paid for referrals" + (f" ({code})" if code else "")); c.setAuthor("Handled"); c.setSubject(f"Recruiting flyer · generated {STAMP} UTC · QR {url}")
c.setCreator("scripts/build-recruiting-flyer-pdf_2026-10-22_0535.py")

def para(text, x, y, w, size=10, leading=None, color=INK, font="Helvetica", align=0):
    st = ParagraphStyle("p", fontName=font, fontSize=size, leading=leading or size * 1.3, textColor=color, alignment=align)
    p = Paragraph(text, st); _, h = p.wrap(w, 1000); p.drawOn(c, x, y - h); return y - h

# ── header band ──
c.setFillColor(GREEN_D); c.rect(0, H - 2.35 * inch, W, 2.35 * inch, stroke=0, fill=1)
c.setFillColor(colors.white); c.setFont("Helvetica-Bold", 13); c.drawString(0.6 * inch, H - 0.55 * inch, "HANDLED  ·  PARTNER PROGRAM")
c.setFont("Helvetica-Bold", 30); c.drawString(0.6 * inch, H - 1.1 * inch, "Get paid for sending")
c.setFillColor(colors.HexColor("#f7d774")); c.drawString(0.6 * inch, H - 1.55 * inch, "us work.")
para(f"Know someone who needs a roof, a lawn crew, a clean house or a new floor? Send them to Handled and earn a share of every job — paid to your bank every week.",
     0.6 * inch, H - 1.72 * inch, 4.6 * inch, size=10.5, color=colors.white)
# QR card (top right)
qx, qy, qs = W - 2.55 * inch, H - 2.2 * inch, 1.95 * inch
c.setFillColor(colors.white); c.roundRect(qx - 0.12 * inch, qy - 0.32 * inch, qs + 0.24 * inch, qs + 0.5 * inch, 8, stroke=0, fill=1)
w = QrCodeWidget(url); w.barLevel = "M"; b = w.getBounds(); dr = Drawing(qs, qs, transform=[qs / (b[2] - b[0]), 0, 0, qs / (b[3] - b[1]), 0, 0]); dr.add(w)
renderPDF.draw(dr, c, qx, qy)
c.setFillColor(GREEN_D); c.setFont("Helvetica-Bold", 9.5); c.drawCentredString(qx + qs / 2, qy - 0.2 * inch, "Scan to join — free")

# ── what you earn ──
y = H - 2.75 * inch
c.setFillColor(GREEN_D); c.setFont("Helvetica-Bold", 16); c.drawString(0.6 * inch, y, "What you earn"); y -= 0.2 * inch
cards = [
    (pc(R["jobOnce"]), "Send us a one-time job", f"A roof replacement around {m0(roof['price'])} → you earn about <b>{m0(roof_t['referrer'])}</b>.", "Fill out a referral ticket for the job."),
    (pc(R["jobRecurring"]), "Send us a recurring job", f"Lawn care every 2 weeks at {m0(lawn['price'])} → about <b>{m0(lawn_t['referrer'] * lawn['visits'])} a year</b>.", f"Every visit pays you for {R['months']} months."),
    (pc(R["person"]), "Refer a person", f"Everything they book for {R['months']} months — lawn every 2 weeks alone is about <b>{m0(lawn_p['referrer'] * lawn['visits'])} a year</b>.", "Share your link or send them to us."),
]
cw, gap, ch = (W - 1.2 * inch - 2 * 0.2 * inch) / 3, 0.2 * inch, 1.75 * inch
for i, (big, title, body, note) in enumerate(cards):
    x = 0.6 * inch + i * (cw + gap); top = y - 0.05 * inch
    c.setFillColor(TINT); c.setStrokeColor(LINE); c.roundRect(x, top - ch, cw, ch, 8, stroke=1, fill=1)
    c.setFillColor(GOLD); c.rect(x, top - 4, cw, 4, stroke=0, fill=1)
    c.setFillColor(GREEN_D); c.setFont("Helvetica-Bold", 26); c.drawString(x + 0.15 * inch, top - 0.45 * inch, big)
    c.setFont("Helvetica", 8); c.setFillColor(GRAY); c.drawString(x + 0.15 * inch + c.stringWidth(big, "Helvetica-Bold", 26) + 4, top - 0.45 * inch, "of our fee")
    yy = para(f"<b>{title}</b>", x + 0.15 * inch, top - 0.58 * inch, cw - 0.3 * inch, size=10.5)
    yy = para(body, x + 0.15 * inch, yy - 3, cw - 0.3 * inch, size=9)
    para(note, x + 0.15 * inch, yy - 3, cw - 0.3 * inch, size=8, color=GRAY)
y = y - 0.05 * inch - ch - 0.12 * inch
y = para("Our fee is what’s left of the price after the pro is paid. Examples use our current prices in Michigan; your earnings depend on what customers book.", 0.6 * inch, y, W - 1.2 * inch, size=7.5, color=GRAY)

# ── how it works ──
y -= 0.25 * inch
c.setFillColor(GREEN_D); c.setFont("Helvetica-Bold", 16); c.drawString(0.6 * inch, y, "How it works"); y -= 0.12 * inch
steps = [("1", "Scan & join", "Free, about 2 minutes. You get your own link and partner page."),
         ("2", "Send us work", "Fill out a referral ticket for a job, or share your link. We text or email them a ready-to-book price."),
         ("3", "We do the job", "Insured, background-checked pros. Photo proof when it’s done, and a free redo if anything’s missed."),
         ("4", "You get paid", f"Every Monday through Stripe, once a job is {R['holdDays']} days past completion. You’re told at every step.")]
sw = (W - 1.2 * inch - 3 * 0.15 * inch) / 4
for i, (n, t, body) in enumerate(steps):
    x = 0.6 * inch + i * (sw + 0.15 * inch)
    c.setFillColor(GREEN); c.circle(x + 0.16 * inch, y - 0.2 * inch, 0.14 * inch, stroke=0, fill=1)
    c.setFillColor(colors.white); c.setFont("Helvetica-Bold", 11); c.drawCentredString(x + 0.16 * inch, y - 0.24 * inch, n)
    c.setFillColor(INK); c.setFont("Helvetica-Bold", 10.5); c.drawString(x + 0.38 * inch, y - 0.24 * inch, t)
    para(body, x, y - 0.42 * inch, sw, size=8.5, color=GRAY)
y -= 1.3 * inch

# ── who + what we do ──
c.setFillColor(GREEN_D); c.setFont("Helvetica-Bold", 13); c.drawString(0.6 * inch, y, "Perfect for"); c.drawString(W / 2 + 0.1 * inch, y, "Work you can send us")
para("Real estate agents · property managers & HOAs · contractors and tradespeople · business owners · neighbors, friends & family · Handled pros and clients (join in one tap from your account)",
     0.6 * inch, y - 0.1 * inch, W / 2 - 0.8 * inch, size=9)
para("Roofing · flooring · paving & driveways · tree trimming & removal · lawn, leaves & snow · cleaning & power washing · painting · handyman, plumbing, electrical & HVAC · remodels · junk hauling & moving · and more",
     W / 2 + 0.1 * inch, y - 0.1 * inch, W / 2 - 0.7 * inch, size=9)
y -= 1.05 * inch

# ── join band ──
c.setFillColor(TINT); c.setStrokeColor(GREEN); c.roundRect(0.6 * inch, y - 1.15 * inch, W - 1.2 * inch, 1.15 * inch, 10, stroke=1, fill=1)
qs2 = 0.95 * inch
w2 = QrCodeWidget(url); w2.barLevel = "M"; b2 = w2.getBounds(); dr2 = Drawing(qs2, qs2, transform=[qs2 / (b2[2] - b2[0]), 0, 0, qs2 / (b2[3] - b2[1]), 0, 0]); dr2.add(w2)
renderPDF.draw(dr2, c, W - 0.6 * inch - qs2 - 0.12 * inch, y - 1.08 * inch)
c.setFillColor(GREEN_D); c.setFont("Helvetica-Bold", 17); c.drawString(0.85 * inch, y - 0.38 * inch, "Join free: scan the code or visit")
c.setFont("Helvetica-Bold", 15); c.setFillColor(INK); c.drawString(0.85 * inch, y - 0.66 * inch, shown)
c.setFont("Helvetica", 9.5); c.setFillColor(GRAY)
c.drawString(0.85 * inch, y - 0.92 * inch, ("Invited by " + a.name + "  ·  " if a.name else "") + "Questions? (313) 639-9373  ·  info@handledsvc.com")

# ── small print ──
para(f"Handled Partner Program. Earnings are a share of Handled’s fee on completed, paid jobs: {pc(R['jobOnce'])} on a one-time job and {pc(R['jobRecurring'])} on each visit of a recurring job sent on a referral ticket, "
     f"or {pc(R['person'])} on jobs from a person you refer, for {R['months']} months. Paid weekly via Stripe after our {R['holdDays']}-day make-it-right window; balances under ${R['minPayout']} roll over. "
     f"People you refer must be new to Handled; a ticket must be one the customer asked you to send. Full terms at {site.replace('https://', '')}/partners. Flyer {STAMP} UTC.",
     0.6 * inch, 0.95 * inch, W - 1.2 * inch, size=6.5, color=GRAY)
c.showPage(); c.save()
print(OUT.relative_to(ROOT) if OUT.is_relative_to(ROOT) else OUT, "→ QR:", url)
