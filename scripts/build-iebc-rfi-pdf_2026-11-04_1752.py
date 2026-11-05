# ============================================================================
# FILE    : scripts/build-iebc-rfi-pdf_2026-11-04_1752.py
# RUN     : python3 scripts/build-iebc-rfi-pdf_2026-11-04_1752.py docs/IN.md docs/OUT.pdf
#           (needs pandoc and Node Playwright/Chromium, both preinstalled in cloud sessions)
# PROJECT : Handled (HandledServices) / IEBC
# CREATED : 2026-11-04_1752 UTC
# UPDATED : 2026-11-05_1705 UTC — IEBC letterhead contact details filled in.
# PURPOSE : Turns the RFI 550595 response draft (Markdown) into a submission PDF on IEBC letterhead.
#           Internal "before you submit" sections and "Internal note" blocks are left out; every [bracket]
#           still to fill is highlighted yellow. Fill the CONTACT values below and re-run to update the letterhead.
# ============================================================================
import html, json, os, re, subprocess, sys, tempfile

SRC, OUT = sys.argv[1], sys.argv[2]

# ─── Letterhead contact details (fill in, then re-run) ───
COMPANY = "Integrated Efficiency Business Consultants, LLC"
STREET = "405 W. Greenlawn Ave. #G11 #4194"
CITY = "Lansing, Michigan 48910"
PHONE = "(313) 639-9373"
EMAIL = "info@handledsvc.com"
WEBSITE = "iebusinessconsultants.com"
DOC_LABEL = "Response to RFI No. 550595 · Detroit Housing Resource Helpline"

NAVY, ACCENT, INK, MUTED, LINE, TINT = "#13294b", "#1f8a70", "#1a1a1a", "#5b6472", "#d9dee5", "#f3f6f9"


def mark(s):
    """Highlight [placeholders] so nothing unfilled slips through."""
    return re.sub(r"\[([^\]\[<>]{1,220})\]", r'<mark>[\1]</mark>', s)


LOGO = f"""<svg width="34" height="34" viewBox="0 0 34 34" xmlns="http://www.w3.org/2000/svg">
<rect width="34" height="34" rx="7" fill="{NAVY}"/>
<rect x="7" y="19" width="5" height="8" rx="1" fill="#ffffff"/>
<rect x="14.5" y="13" width="5" height="14" rx="1" fill="#ffffff"/>
<rect x="22" y="7" width="5" height="20" rx="1" fill="{ACCENT}"/></svg>"""


def esc_tpl(s):
    return mark(html.escape(s)).replace("<mark>", '<span style="background:#fff3a3">').replace("</mark>", "</span>")


HEADER = f"""<div style="width:100%;margin:0 0.65in;font-family:Inter,sans-serif;-webkit-print-color-adjust:exact;">
<div style="display:flex;align-items:center;justify-content:space-between;border-bottom:2px solid {NAVY};padding-bottom:6px;">
 <div style="display:flex;align-items:center;gap:9px;">{LOGO}
  <div><div style="font-size:15px;font-weight:800;letter-spacing:2px;color:{NAVY};line-height:1;">IEBC</div>
  <div style="font-size:7.5px;color:{MUTED};letter-spacing:.3px;margin-top:3px;">{html.escape(COMPANY)}</div></div></div>
 <div style="text-align:right;font-size:7.5px;color:{MUTED};line-height:1.5;">
  {esc_tpl(STREET)} · {esc_tpl(CITY)}<br>{esc_tpl(PHONE)} · {esc_tpl(EMAIL)} · {esc_tpl(WEBSITE)}</div>
</div>
<div style="height:2px;width:56px;background:{ACCENT};margin-top:-2px;"></div></div>"""

FOOTER = f"""<div style="width:100%;margin:0 0.65in;font-family:Inter,sans-serif;font-size:7.5px;color:{MUTED};
display:flex;justify-content:space-between;border-top:1px solid {LINE};padding-top:5px;">
<span>{html.escape(DOC_LABEL)}</span>
<span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span></div>"""

DIAGRAM = f"""<figure class="dfd"><svg viewBox="0 0 760 380" xmlns="http://www.w3.org/2000/svg" role="img"
 aria-label="Data flow: resident to contact center to intake record, out to programs, back with outcomes, and into reporting">
<defs><marker id="a" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
<path d="M0,0 L10,5 L0,10 z" fill="{MUTED}"/></marker></defs>
<style>.b{{fill:#fff;stroke:{NAVY};stroke-width:1.3}} .s{{fill:{TINT};stroke:{NAVY};stroke-width:2}} .p{{fill:#fff;stroke:{ACCENT};stroke-width:1.3}}
.t{{font:600 11px Inter,sans-serif;fill:{INK}}} .m{{font:400 9px Inter,sans-serif;fill:{MUTED}}} .l{{stroke:{MUTED};stroke-width:1.2;fill:none}}
.z{{fill:none;stroke:{LINE};stroke-dasharray:5 4;stroke-width:1.2}}</style>
<rect class="z" x="140" y="8" width="552" height="170" rx="10"/><text class="m" x="150" y="24">Contractor cloud tenant (US regions) · SSO + MFA · encrypted</text>
<rect class="b" x="10" y="60" width="110" height="46" rx="6"/><text class="t" x="65" y="80" text-anchor="middle">Resident</text><text class="m" x="65" y="95" text-anchor="middle">866-313-2520</text>
<rect class="b" x="160" y="40" width="150" height="46" rx="6"/><text class="t" x="235" y="60" text-anchor="middle">Contact center / IVR</text><text class="m" x="235" y="75" text-anchor="middle">4-language greeting · callback</text>
<rect class="b" x="350" y="40" width="150" height="46" rx="6"/><text class="t" x="425" y="60" text-anchor="middle">Agent desktop</text><text class="m" x="425" y="75" text-anchor="middle">screening decision tree</text>
<rect class="s" x="530" y="40" width="150" height="56" rx="6"/><text class="t" x="605" y="62" text-anchor="middle">Intake / Case record</text><text class="m" x="605" y="78" text-anchor="middle">system of record (intake)</text>
<rect class="b" x="160" y="112" width="150" height="46" rx="6"/><text class="t" x="235" y="132" text-anchor="middle">Messaging</text><text class="m" x="235" y="147" text-anchor="middle">SMS · email · voice</text>
<rect class="b" x="350" y="112" width="150" height="46" rx="6"/><text class="t" x="425" y="132" text-anchor="middle">Recordings · transcripts</text><text class="m" x="425" y="147" text-anchor="middle">QA · audit log</text>
<path class="l" d="M120,80 L158,66" marker-end="url(#a)"/><path class="l" d="M310,63 L348,63" marker-end="url(#a)"/>
<path class="l" d="M500,63 L528,63" marker-end="url(#a)"/><path class="l" d="M235,86 L235,110" marker-end="url(#a)"/>
<path class="l" d="M310,90 L350,118" marker-end="url(#a)"/><path class="l" d="M158,135 L65,135 L65,108" marker-end="url(#a)"/>
<path class="l" d="M590,96 L590,104 L300,104 L300,110" marker-end="url(#a)"/>
<text class="m" x="70" y="150">texts / follow-up</text>
<rect class="b" x="20" y="232" width="150" height="46" rx="6"/><text class="t" x="95" y="252" text-anchor="middle">CAM / Pathways</text><text class="m" x="95" y="267" text-anchor="middle">shelter intake · API/SFTP</text>
<rect class="b" x="190" y="232" width="150" height="46" rx="6"/><text class="t" x="265" y="252" text-anchor="middle">City systems</text><text class="m" x="265" y="267" text-anchor="middle">Salesforce · Smartsheet · Google</text>
<rect class="b" x="360" y="232" width="150" height="46" rx="6"/><text class="t" x="435" y="252" text-anchor="middle">Partner programs</text><text class="m" x="435" y="267" text-anchor="middle">SeeClickFix · Accela · CRMs</text>
<rect class="p" x="530" y="232" width="150" height="46" rx="6"/><text class="t" x="605" y="252" text-anchor="middle">Handled endpoint</text><text class="m" x="605" y="267" text-anchor="middle">service referral · photos back</text>
<path class="l" d="M600,96 L600,200 L95,200 L95,230" marker-end="url(#a)"/><path class="l" d="M265,200 L265,230" marker-end="url(#a)"/>
<path class="l" d="M435,200 L435,230" marker-end="url(#a)"/><path class="l" d="M605,200 L605,230" marker-end="url(#a)"/>
<path class="l" d="M660,230 L660,110 L682,110" stroke-dasharray="4 3" marker-end="url(#a)"/>
<text class="m" x="612" y="194" text-anchor="end">referral packets out (real time)</text><text class="m" x="668" y="160">outcomes</text><text class="m" x="668" y="171">returned</text>
<rect class="b" x="190" y="316" width="190" height="46" rx="6"/><text class="t" x="285" y="336" text-anchor="middle">Warehouse (Snowflake)</text><text class="m" x="285" y="351" text-anchor="middle">reporting copy · every 15 min</text>
<rect class="b" x="440" y="316" width="190" height="46" rx="6"/><text class="t" x="535" y="336" text-anchor="middle">Tableau dashboards</text><text class="m" x="535" y="351" text-anchor="middle">City · role-based</text>
<path class="l" d="M180,300 L180,339 L188,339" marker-end="url(#a)"/><path class="l" d="M20,300 L680,300" stroke-dasharray="2 3"/>
<text class="m" x="24" y="294">all call, case, referral and outcome data</text>
<path class="l" d="M380,339 L438,339" marker-end="url(#a)"/></svg>
<figcaption>Figure 1. Data flow. Each numbered flow is detailed in the table below.</figcaption></figure>"""

CSS = f"""
@page {{ size: Letter; margin: 1.05in 0.65in 0.75in 0.65in; }}
* {{ -webkit-print-color-adjust: exact; print-color-adjust: exact; }}
body {{ font-family: Inter, sans-serif; font-size: 9.6pt; line-height: 1.5; color: {INK}; margin: 0; background: #fff; }}
h1 {{ font-family: 'Inter Display', Inter, sans-serif; font-size: 25pt; line-height: 1.15; color: {NAVY}; margin: 0 0 12pt; font-weight: 700; }}
h2 {{ font-family: 'Inter Display', Inter, sans-serif; font-size: 16pt; color: {NAVY}; margin: 0 0 10pt; padding-bottom: 5pt;
     border-bottom: 1.5px solid {LINE}; break-before: page; break-after: avoid; }}
h2#part-5-recommendations-for-the-citys-rfp {{ break-before: auto; margin-top: 22pt; }}
h3 {{ font-size: 11pt; color: {NAVY}; margin: 15pt 0 5pt; break-after: avoid; }}
p {{ margin: 0 0 7pt; }} ul, ol {{ margin: 0 0 8pt; padding-left: 17pt; }} li {{ margin: 0 0 3pt; }}
table {{ width: 100%; border-collapse: collapse; margin: 4pt 0 11pt; font-size: 8.4pt; line-height: 1.38; }}
th {{ background: {NAVY}; color: #fff; text-align: left; font-weight: 600; padding: 5pt 6pt; }}
td {{ border-bottom: 1px solid {LINE}; padding: 4.5pt 6pt; vertical-align: top; }}
tr:nth-child(even) td {{ background: {TINT}; }} tr {{ break-inside: avoid; }} thead {{ display: table-header-group; }}
mark {{ background: #fff3a3; color: inherit; padding: 0 1px; }}
blockquote {{ margin: 0 0 9pt; padding: 7pt 11pt; border-left: 3px solid {ACCENT}; background: {TINT}; }}
hr {{ display: none; }}
strong {{ font-weight: 650; }}
.cover {{ min-height: 8.2in; display: flex; flex-direction: column; justify-content: center; }}
.cover .eyebrow {{ font-size: 9pt; letter-spacing: 2px; text-transform: uppercase; color: {ACCENT}; font-weight: 700; margin-bottom: 10pt; }}
.cover p {{ font-size: 11pt; margin: 0 0 5pt; }} .cover .rule {{ width: 70px; height: 3px; background: {ACCENT}; margin: 6pt 0 18pt; }}
.dfd {{ margin: 6pt 0 12pt; break-inside: avoid; }} .dfd svg {{ width: 100%; height: auto; }}
figcaption {{ font-size: 8pt; color: {MUTED}; margin-top: 3pt; }}
"""


def prepare_markdown(md):
    md = re.sub(r"^<!--.*?-->\s*", "", md, flags=re.S)                                   # file header comment
    md = re.sub(r"^## Before you submit \(internal.*?^---\s*$", "", md, flags=re.S | re.M)  # internal checklist
    md = re.sub(r"(?m)^> \*\*Internal note.*\n(?:^>.*\n)*", "", md)                       # internal-note blockquotes
    md = md.replace("*Suggested statement:* ", "")
    md = re.sub(r"^If both companies share an owner, add: \*\"(.*?)\"\*", r"[If under common ownership, keep: \1]", md, flags=re.M)
    md = md.replace("*(A drawn version goes in the PDF. Each flow is listed below.)*", "@@DIAGRAM@@")
    md = re.sub(r"```\n Resident.*?```\n", "", md, flags=re.S)                             # ASCII diagram → SVG
    return md


def main():
    md = prepare_markdown(open(SRC, encoding="utf-8").read())
    body = subprocess.run(["pandoc", "-f", "gfm", "-t", "html5", "--wrap=none"], input=md, capture_output=True,
                          text=True, check=True).stdout
    body = body.replace("<p>@@DIAGRAM@@</p>", DIAGRAM)
    # Cover page = everything before the cover letter heading.
    cut = body.find('<h2 id="cover-letter">')
    cover, rest = body[:cut], body[cut:]
    cover = cover.replace("<h1", '<div class="eyebrow">City of Detroit · Office of Contracting and Procurement</div><h1', 1)
    cover = re.sub(r"(</h1>)", r'\1<div class="rule"></div>', cover, count=1)
    rest = rest.replace('<h2 id="cover-letter">', '<h2 id="cover-letter" style="break-before:page">', 1)
    # Highlight placeholders outside of tags and the SVG.
    parts = re.split(r"(<svg.*?</svg>|<[^>]+>)", f'<section class="cover">{cover}</section>{rest}', flags=re.S)
    body = "".join(p if p.startswith("<") else mark(p) for p in parts)
    doc = f"""<!doctype html><html lang="en"><head><meta charset="utf-8">
<!-- Generated by scripts/build-iebc-rfi-pdf_2026-11-04_1752.py from {html.escape(SRC)} -->
<title>IEBC Response to RFI 550595</title><style>{CSS}</style></head><body>{body}</body></html>"""
    with tempfile.TemporaryDirectory() as tmp:
        src = os.path.join(tmp, "doc.html")
        open(src, "w", encoding="utf-8").write(doc)
        cfg = os.path.join(tmp, "cfg.json")
        json.dump({"src": src, "out": os.path.abspath(OUT), "header": HEADER, "footer": FOOTER}, open(cfg, "w"))
        js = """const {chromium}=require('playwright');const c=require(process.argv[1]);(async()=>{
const b=await chromium.launch();const p=await b.newPage();await p.goto('file://'+c.src,{waitUntil:'networkidle'});
await p.pdf({path:c.out,format:'Letter',printBackground:true,displayHeaderFooter:true,headerTemplate:c.header,
footerTemplate:c.footer,preferCSSPageSize:true});await b.close();})();"""
        subprocess.run(["node", "-e", js, cfg], check=True)
    print("wrote", OUT)


if __name__ == "__main__":
    main()
