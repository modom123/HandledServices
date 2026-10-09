# ---------------------------------------------------------------
# FILE    : build-skills-summary-pdf_2026-10-09_1542.py
# PROJECT : Job applications: Mark Odom skills summary (PDF)
# CREATED : 2026-10-09_1542 UTC
# USAGE   : python3 scripts/build-skills-summary-pdf_2026-10-09_1542.py
# OUTPUT  : docs/MARK_ODOM_SKILLS_SUMMARY_2026-10-09_1542.pdf
# ---------------------------------------------------------------
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

OUT = Path(__file__).resolve().parent.parent / "docs" / "MARK_ODOM_SKILLS_SUMMARY_2026-10-09_1542.pdf"
NAVY = colors.HexColor("#1f3a5f")

name = ParagraphStyle("name", fontName="Helvetica-Bold", fontSize=22, textColor=NAVY, leading=26)
sub = ParagraphStyle("sub", fontName="Helvetica", fontSize=10.5, textColor=colors.HexColor("#555555"), leading=14)
h2 = ParagraphStyle("h2", fontName="Helvetica-Bold", fontSize=12.5, textColor=NAVY, spaceBefore=8, spaceAfter=3)
h3 = ParagraphStyle("h3", fontName="Helvetica-Bold", fontSize=10.5, spaceBefore=4, spaceAfter=1)
body = ParagraphStyle("body", fontName="Helvetica", fontSize=9.6, leading=12.6)
bullet = ParagraphStyle("bullet", parent=body, leftIndent=12, bulletIndent=2)

SUMMARY = (
    "Sales, marketing and business-development executive with more than 30 years of experience. He has run his own "
    "national sales company since 2001, generating more than $20 million in lifetime revenue. Before that he was an "
    "executive recruiter at Korn Ferry and a licensed financial advisor managing more than $100 million in client assets. "
    "Today he designs and builds data, automation and AI systems for organizations, and he has launched an AI-run home "
    "and business services company from concept to go-live."
)

SKILLS = [
    ("Sales and business development", [
        "Built and runs a national sales operation (Northwest Ticket &amp; Investment Company, 2001–present), $20M+ lifetime revenue",
        "Owns the full client lifecycle: prospecting, closing, account management, retention",
        "B2B outreach and partnership building: property managers, brokerages, referral partners, factoring partners",
        "Government contracting: RFP analysis, bid/no-bid decisions, proposal writing (City of Detroit RFPs)",
    ]),
    ("Marketing strategy", [
        "B.S. in Marketing; 30+ years of strategic marketing for his own businesses",
        "Local and digital marketing plans: Google Business Profile, local service ads, Nextdoor, SEO, referral programs",
        "Brand building, customer loyalty and rewards programs, pricing strategy",
    ]),
    ("Data, automation and AI (founder of IEBC, 2025–present)", [
        "Designs dashboards, CRM pipelines, automated email and text programs, and document systems",
        "Builds AI tools and AI “workforces” that run business functions with human approval and oversight",
        "Led the build of a full web and mobile platform (Next.js, React Native, Supabase/Postgres, Stripe, Xero, Claude AI) "
        "with automated quoting, dispatch, quality checks and accounting",
    ]),
    ("Executive leadership and entrepreneurship", [
        "Founder and CEO of three ventures: Northwest Ticket &amp; Investment Company, Integrated Efficiency Business "
        "Consultants (IEBC), and Handled Services LLC",
        "Business plans, 12-month operating plans and financial projections",
        "Recruiting and workforce programs: job postings, interview process, vetting, onboarding, contractor pay",
    ]),
    ("Executive recruiting and relationships", [
        "Executive recruiter at Korn Ferry International (2001–2002), placing CEOs, CFOs and COOs for global organizations",
        "Builds trust with senior leaders, partners and clients",
    ]),
    ("Finance, compliance and risk", [
        "Financial advisor and asset manager (1991–2001), more than $100M in client assets",
        "Held Series 6, 7 and 65 securities licenses and insurance licenses",
        "Contracts, service agreements, 1099 contractor compliance, bookkeeping set-up (Xero + Stripe)",
    ]),
]

CAREER = [
    ["Years", "Role", "Organization"],
    ["2026–present", "Founder", "Handled Services LLC (AI-run home and business services)"],
    ["2025–present", "Founder & CEO", "Integrated Efficiency Business Consultants (IEBC), Detroit"],
    ["2001–present", "CEO & Owner", "Northwest Ticket & Investment Company"],
    ["2001–2002", "Executive Recruiter", "Korn Ferry International"],
    ["1991–2001", "Financial Advisor & Asset Manager", "Series 6, 7, 65 and insurance licensed"],
]

story = [
    Paragraph("Mark Odom", name),
    Paragraph("Sales, Marketing &amp; AI Automation Executive · Detroit, MI · B.S. in Marketing, University of Hawaii", sub),
    Spacer(1, 6),
    Paragraph("Professional summary", h2),
    Paragraph(SUMMARY, body),
    Paragraph("Core skills", h2),
]
for title, items in SKILLS:
    story.append(Paragraph(title, h3))
    story += [Paragraph(i, bullet, bulletText="•") for i in items]

story.append(Paragraph("Career highlights", h2))
cell = ParagraphStyle("cell", parent=body, fontSize=9.5, leading=12)
rows = [[Paragraph(c, cell) for c in r] for r in CAREER]
t = Table(rows, colWidths=[1.1 * inch, 2.1 * inch, 3.8 * inch])
t.setStyle(TableStyle([
    ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#e6edf5")),
    ("LINEBELOW", (0, 0), (-1, -1), 0.4, colors.HexColor("#c8d3e0")),
    ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ("TOPPADDING", (0, 0), (-1, -1), 3),
    ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
]))
story.append(t)

doc = SimpleDocTemplate(str(OUT), pagesize=letter, leftMargin=0.75 * inch, rightMargin=0.75 * inch,
                        topMargin=0.5 * inch, bottomMargin=0.5 * inch,
                        title="Mark Odom — Skills Summary", author="Mark Odom")
doc.build(story)
print(OUT)
