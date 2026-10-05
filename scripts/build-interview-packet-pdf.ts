/*
 * FILE    : scripts/build-interview-packet-pdf.ts
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-05_0352 UTC
 * PURPOSE : Printable interview packet → docs/INTERVIEW_PACKET_<timestamp>.pdf (US Letter), built from
 *           packages/core/src/interview.ts — the same questions and scoring the AI interviewer and the Hub use.
 *           Includes a one-page scoring sheet and approval checklist per candidate (print extra copies).
 *           Run: node --experimental-strip-types scripts/build-interview-packet-pdf.ts
 *           Needs Chromium (CHROME_PATH, default /opt/pw-browsers/chromium).
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { COMPETENCIES, DO_NOT_ASK, INTERVIEW_PASS, QUESTIONS, type Competency, type InterviewQuestion, type TradeGroup } from "../packages/core/src/interview.ts";
import { BRAND } from "../packages/core/src/brand.ts";

const now = new Date();
const ts = now.toISOString().slice(0, 16).replace("T", "_").replace(":", "");
const out = `docs/INTERVIEW_PACKET_${ts}.pdf`;
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const comps = Object.keys(COMPETENCIES) as Competency[];
const GROUP: Record<TradeGroup, string> = {
  cleaning: "Cleaning · windows · carpet · organizing · car detailing", repair: "Handyman · remodeling · low voltage", outdoor: "Lawn · trees · snow · gutters · pressure washing · pet waste",
  moving: "Hauling · moving · containers", painting: "Painting", licensed: "Plumbing · electrical · HVAC", pets: "Pet care", transport: "Transportation", errands: "Errands & couriers", events: "Events",
};
const groups = [...new Set(QUESTIONS.filter((q) => q.group).map((q) => q.group!))];

const question = (q: InterviewQuestion, n: string) => `
  <div class="q">
    <div class="qhead"><span class="num">${n}</span><div><div class="qen">${esc(q.en)}</div><div class="qes">${esc(q.es)}</div></div>${q.competency ? `<span class="tag">${esc(COMPETENCIES[q.competency].en)}</span>` : `<span class="tag muted">not scored</span>`}</div>
    <div class="look"><b>Look for:</b> ${esc(q.lookFor)}${q.redFlag ? ` <span class="red"><b>Red flag:</b> ${esc(q.redFlag)}</span>` : ""}</div>
    <div class="lines"><div></div><div></div><div></div></div>
  </div>`;

const checklist = ["Application received", "Application screened", "Screening interview done", "Decision by a person: invite", "Pro account created (signed in with the application email)", "W-9 on file", "Independent contractor agreement signed",
  "Specialties chosen", "Work area & days set", "Insurance certificate (COI) verified", "Trade coverages verified (where the trade needs them)", "Workers' comp, or a no-employees statement",
  "Trade license verified (where required)", "Photo ID verified", "Background check cleared", "Payout method set", "Approved — receiving job offers", "First job completed and reviewed"];

const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${BRAND.name} — Pro Interview Packet (${ts} UTC)</title>
<!-- Generated ${ts} UTC by scripts/build-interview-packet-pdf.ts from packages/core/src/interview.ts -->
<style>
  @page { size: Letter; margin: 0.6in 0.65in 0.7in; @bottom-left { content: "${BRAND.name} · Pro interview packet · ${ts} UTC"; font: 8pt Helvetica, Arial, sans-serif; color: #64748b; } @bottom-right { content: "Page " counter(page) " of " counter(pages); font: 8pt Helvetica, Arial, sans-serif; color: #64748b; } }
  * { box-sizing: border-box; }
  body { font-family: Helvetica, Arial, sans-serif; font-size: 10pt; color: #0f172a; line-height: 1.35; margin: 0; }
  h1 { font-size: 26pt; margin: 0 0 6pt; color: #0f766e; }
  h2 { font-size: 15pt; margin: 0 0 8pt; padding-bottom: 4pt; border-bottom: 2px solid #0f766e; color: #0f172a; }
  h3 { font-size: 11.5pt; margin: 12pt 0 6pt; color: #0f766e; }
  .page { page-break-after: always; }
  .page:last-child { page-break-after: auto; }
  .cover { display: flex; flex-direction: column; justify-content: space-between; height: 9.4in; }
  .brand { font-size: 13pt; font-weight: 800; color: #0f766e; letter-spacing: .5px; }
  .sub { font-size: 12pt; color: #334155; max-width: 5.5in; }
  .field { display: grid; grid-template-columns: 1.4in 1fr; gap: 10pt 8pt; margin-top: 18pt; font-size: 11pt; }
  .field div:nth-child(even) { border-bottom: 1px solid #94a3b8; height: 20pt; }
  .box { border: 1px solid #cbd5e1; border-radius: 6pt; padding: 8pt 10pt; margin: 8pt 0; }
  .note { background: #f0fdfa; border-color: #99f6e4; }
  .warn { background: #fff7ed; border-color: #fdba74; }
  ol, ul { margin: 4pt 0; padding-left: 16pt; } li { margin: 2pt 0; }
  .cols { columns: 2; column-gap: 18pt; } .cols li { break-inside: avoid; }
  .q { break-inside: avoid; border: 1px solid #e2e8f0; border-radius: 6pt; padding: 7pt 9pt; margin: 0 0 7pt; }
  .qhead { display: flex; gap: 8pt; align-items: flex-start; }
  .num { flex: none; width: 18pt; height: 18pt; border-radius: 50%; background: #0f766e; color: #fff; font-weight: 700; font-size: 9pt; display: flex; align-items: center; justify-content: center; }
  .qhead > div { flex: 1; } .qen { font-weight: 700; font-size: 10.5pt; } .qes { font-style: italic; color: #475569; font-size: 9pt; }
  .tag { flex: none; font-size: 7.5pt; background: #ccfbf1; color: #115e59; border-radius: 8pt; padding: 1pt 6pt; white-space: nowrap; } .tag.muted { background: #f1f5f9; color: #64748b; }
  .look { font-size: 8.5pt; color: #334155; margin: 4pt 0 0 26pt; } .red { color: #b91c1c; }
  .lines { margin: 4pt 0 0 26pt; } .lines div { border-bottom: 1px solid #cbd5e1; height: 15pt; }
  table { width: 100%; border-collapse: collapse; } th, td { border: 1px solid #cbd5e1; padding: 5pt 6pt; vertical-align: top; text-align: left; font-size: 9pt; } th { background: #f1f5f9; }
  .score td { height: 30pt; } .bubbles { white-space: nowrap; font-size: 11pt; letter-spacing: 2pt; }
  .check li { list-style: none; margin-left: -16pt; padding: 3pt 0; border-bottom: 1px dotted #cbd5e1; display: flex; justify-content: space-between; }
  .check li span:last-child { color: #94a3b8; font-size: 8.5pt; }
  .muted { color: #64748b; }
</style></head><body>

<section class="page cover">
  <div>
    <div class="brand">${esc(BRAND.name.toUpperCase())}</div>
    <h1 style="margin-top:1.2in">Pro Interview Packet</h1>
    <p class="sub">Screening interview for independent pros (1099 businesses): the process, what never to ask, the questions with what a good answer has, the scoring guide, a scoring sheet and the approval checklist.</p>
    <div class="field">
      <div>Candidate</div><div></div><div>Business</div><div></div><div>Trades</div><div></div><div>Phone / email</div><div></div><div>Interviewer</div><div></div><div>Date</div><div></div>
    </div>
  </div>
  <h3 style="margin-top:22pt">How to run the interview (about 20–30 minutes)</h3>
  <ol>
    <li>Introduce yourself and ${esc(BRAND.name)}; explain it's a short conversation about their work, and that they'll hear back within 2 business days.</li>
    <li>Ask the <b>core questions</b> (section 3), then <b>2–4 questions for their trades</b> (section 4). Use your own words; one follow-up if an answer is vague.</li>
    <li>Write down what they actually say — those notes are your evidence for each score.</li>
    <li>Leave time for their questions. Don't promise approval.</li>
    <li>Score right after (sections 5–6), then enter it in the Hub.</li>
  </ol>
  <div class="box note"><b>The same questions are used everywhere.</b> The AI interviewer, the Hub scorecard (Hub → Recruiting → the candidate → “Interview them myself”) and this packet all come from one list, so every candidate is judged the same way. A person makes every decision. Enter your scores in the Hub afterwards so they're on the candidate's record.</div>
</section>

<section class="page">
  <h2>1. How a pro gets approved</h2>
  <ol>
    <li><b>Applies</b> at /pros. An AI screen of their business qualifications.</li>
    <li><b>Screening interview</b>: the AI interviewer (a private link by email, about 15 minutes, English or Spanish), or you, in person or by phone, with this packet.</li>
    <li><b>A person decides</b>: invite to set up · follow up first · not now.</li>
    <li><b>Setup in the pro portal</b>: W-9 · independent contractor agreement · specialties · work area & days · insurance certificate (general liability, plus coverages their trade needs) · workers' comp or a no-employees statement · trade license where required · photo ID check · background check (consent through the screening provider) · payout method.</li>
    <li>Documents verified and background check clear → <b>approved to receive job offers</b>.</li>
    <li><b>First jobs are probation</b>: smaller jobs, a human review of each, and a call to the customer.</li>
  </ol>
  <div class="box warn"><b>Wording.</b> Pros run their own businesses. Say <b>“approved”</b>, not “hired”. They choose their jobs, days, area, methods and tools. Don't promise a number of jobs or an income; any pay figure before approval is an estimate.</div>

  <h2 style="margin-top:16pt">2. Never ask about</h2>
  <ul class="cols">${DO_NOT_ASK.map((d) => `<li>✖ ${esc(d.en)}<br><span class="muted" style="font-size:8.5pt">${esc(d.es)}</span></li>`).join("")}</ul>
  <div class="box">If a candidate brings one of these up, don't follow up and don't let it affect the decision. Ask everyone the same core questions. Score <b>what they said</b>, not accent, grammar or which language they use. If someone asks for an accommodation (more time, a phone interview, an interpreter), say yes.</div>

</section>

<section class="page">
  <h2>3. Questions for everyone</h2>
  ${QUESTIONS.filter((q) => !q.group).map((q, i) => question(q, String(i + 1))).join("")}
</section>

<section class="page">
  <h2>4. Questions by trade <span class="muted" style="font-size:10pt;font-weight:400">— ask the ones for the candidate's trades</span></h2>
  ${groups.map((g) => { const qs = QUESTIONS.filter((q) => q.group === g).map((q, i) => question(q, `${g[0].toUpperCase()}${i + 1}`)); return `<div style="break-inside: avoid"><h3>${esc(GROUP[g])}</h3>${qs[0] ?? ""}</div>${qs.slice(1).join("")}`; }).join("")}
</section>

<section class="page">
  <h2>5. Scoring guide (1–5)</h2>
  <table><thead><tr><th style="width:22%">Competency</th><th>1 — concerning</th><th>3 — meets</th><th>5 — excellent</th></tr></thead>
    <tbody>${comps.map((c) => `<tr><td><b>${esc(COMPETENCIES[c].en)}</b><br><span class="muted">${esc(COMPETENCIES[c].es)}</span></td><td>${esc(COMPETENCIES[c].anchors[1])}</td><td>${esc(COMPETENCIES[c].anchors[3])}</td><td>${esc(COMPETENCIES[c].anchors[5])}</td></tr>`).join("")}</tbody></table>
  <div class="box note" style="margin-top:10pt">
    <b>Result</b><br>
    ✔ <b>Advance (invite)</b>: average of the six scores ≥ ${INTERVIEW_PASS.average} and no score below ${INTERVIEW_PASS.floor}.<br>
    ↻ <b>Follow up</b>: a very low score in one area, or an area you didn't cover — a short call on that topic first.<br>
    ✖ <b>Not now</b>: average under 2.6, or any knockout.
  </div>
  <div class="box warn"><b>Knockouts</b>: won't carry required insurance · would do licensed work without the license · would knowingly continue unsafe work · abusive or threatening in the interview.</div>
  <p class="muted">2 and 4 are in between: use them when an answer is better than one description but not quite the next.</p>
</section>

<section class="page">
  <h2>6. Scoring sheet</h2>
  <p>Candidate: ______________________________ &nbsp; Trades: ______________________ &nbsp; Date: __________</p>
  <table class="score"><thead><tr><th style="width:26%">Competency</th><th style="width:22%">Score (circle)</th><th>Evidence — what they said</th></tr></thead>
    <tbody>${comps.map((c) => `<tr><td><b>${esc(COMPETENCIES[c].en)}</b></td><td class="bubbles">① ② ③ ④ ⑤</td><td></td></tr>`).join("")}
    <tr><td><b>Average</b></td><td></td><td>Knockout? ☐ No ☐ Yes: ____________________________</td></tr></tbody></table>
  <h3>Result</h3>
  <p style="font-size:11pt">☐ Advance — invite to set up &nbsp;&nbsp; ☐ Follow up first &nbsp;&nbsp; ☐ Not now</p>
  <p>Reason / follow-up topic: _______________________________________________________________</p>
  <p>___________________________________________________________________________________</p>
  <h3>Overall notes</h3>
  <div class="lines" style="margin-left:0"><div></div><div></div><div></div><div></div><div></div></div>
  <p class="muted" style="margin-top:10pt">Interviewer signature: ____________________________ &nbsp; Entered in the Hub ☐</p>
</section>

<section class="page">
  <h2>7. Approval checklist</h2>
  <p>Candidate: ______________________________ &nbsp; Applied: __________</p>
  <ul class="check">${checklist.map((x) => `<li><span>☐ &nbsp;${esc(x)}</span><span>date ________</span></li>`).join("")}</ul>
  <div class="box note" style="margin-top:12pt">The Hub tracks every step for each candidate (Hub → Recruiting → click a name): what's next, whether it waits on the candidate or on us, and a red flag when someone is stuck — 2+ days waiting on our decision or 7+ days with no progress.</div>
</section>
</body></html>`;

const dir = mkdtempSync(join(tmpdir(), "packet-"));
const htmlFile = join(dir, "packet.html");
writeFileSync(htmlFile, html);
execFileSync(process.env.CHROME_PATH || "/opt/pw-browsers/chromium", ["--headless", "--no-sandbox", "--disable-gpu", "--no-pdf-header-footer", `--print-to-pdf=${join(process.cwd(), out)}`, `file://${htmlFile}`], { stdio: "ignore" });
console.log(`wrote ${out}`);
