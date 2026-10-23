/*
 * FILE    : packages/core/src/ats.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-23_1100 UTC
 * PURPOSE : Getting candidates into the pro recruiting pipeline from outside the /pros form (pure functions, no I/O):
 *             parseIndeedApply()   — an Indeed Apply application (JSON POSTed to our postUrl) → one candidate
 *             parseCandidatesCsv() — a CSV export (Indeed "Candidates" export, a spreadsheet, another ATS) → candidates;
 *                                    columns are matched by name, in any order, with common aliases
 *             inferTrades()        — trade ids from a job title / jobMeta / notes ("House Cleaner" → cleaning)
 *           The web app saves them with lib/recruiting-intake.ts (dedupe, résumé, confirmation, AI screen).
 * UPDATED : 2026-10-23_1600 UTC — carpentry, masonry and roofing are their own trades (carpenters no longer map to handyman).
 */
import { TRADES } from "./services.ts";
import { MAX_TRADES } from "./pro-program.ts";

export interface Candidate {
  full_name: string;
  email: string;
  phone: string;
  business_name?: string;
  trades: string[];
  zips?: string;
  location?: string;
  years_experience?: number;
  message?: string;
  source: string;
  external_id?: string;
  external_job?: Record<string, unknown>;
  screener?: unknown;
  resume?: { data: string; fileName: string; contentType: string }; // base64
}

// keyword → trade id; first match per keyword, several trades can match one title
const TRADE_WORDS: [RegExp, string][] = [
  [/\b(clean(er|ers|ing)?|maid|housekeep\w*|janitor\w*|custodian)\b/i, "cleaning"],
  [/\bwindow/i, "windows"],
  [/\b(carpet|upholster)/i, "carpet"],
  [/\borganiz/i, "organizing"],
  [/\bgutter/i, "gutters"],
  [/\b(lawn|landscap\w*|mow\w*|groundskeep\w*)\b/i, "lawn"],
  [/\b(tree|arborist)/i, "tree"],
  [/\bsnow/i, "snow"],
  [/\b(dog|pet)\b/i, "pet_care"],
  [/\b(pressure|power)[\s-]?wash/i, "pressure_washing"],
  [/\b(courier|errand|personal assistant)/i, "errands"],
  [/\b(detail(er|ing)?)\b/i, "auto_detailing"],
  [/\b(mover|moving|junk|haul\w*)\b/i, "hauling"],
  [/\b(handyman|handy man|maintenance tech\w*)\b/i, "handyman"],
  [/\b(carpent\w*|deck build\w*)\b/i, "carpentry"],
  [/\b(mason\w*|brick\w*|concrete|tuckpoint\w*|chimney)\b/i, "masonry"],
  [/\b(roof\w*|shingl\w*)\b/i, "roofing"],
  [/\bplumb/i, "plumbing"],
  [/\belectric(ians?|al)\b/i, "electrical"],
  [/\b(hvac|heating|air condition\w*|refrigeration)\b/i, "hvac"],
  [/\bpaint(er|ers|ing)?\b/i, "painting"],
  [/\b(remodel\w*|general contractor|renovat\w*)\b/i, "remodel"],
  [/\b(security guard|security officer)\b/i, "security"],
  [/\b(driver|chauffeur|limo)\b/i, "transportation"],
  [/\brecruit(er|ing)\b/i, "recruiter"],
  [/\b(web (design|develop)\w*|wordpress)\b/i, "web_design"],
];
const TRADE_IDS = new Set(TRADES.map((t) => t.id));

/** Trade ids named in free text. jobMeta can also list ids directly: "trades=cleaning,windows". */
export function inferTrades(...texts: (string | null | undefined)[]): string[] {
  const out = new Set<string>();
  for (const raw of texts) {
    const text = String(raw ?? "");
    const listed = text.match(/trades?\s*[=:]\s*([a-z_,\s]+)/i)?.[1];
    if (listed) for (const id of listed.split(/[,\s]+/)) if (TRADE_IDS.has(id.trim())) out.add(id.trim());
    for (const tok of text.toLowerCase().split(/[,;/|]+/)) if (TRADE_IDS.has(tok.trim())) out.add(tok.trim()); // ids as-is
    for (const [re, id] of TRADE_WORDS) if (re.test(text)) out.add(id);
  }
  return [...out].filter((id) => TRADE_IDS.has(id)).slice(0, MAX_TRADES);
}

const str = (v: unknown) => (typeof v === "string" ? v.trim() : typeof v === "number" ? String(v) : "");
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
export const cleanPhone = (p: string) => p.replace(/[^\d+]/g, "").slice(0, 20);
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * An Indeed Apply application. Field names follow Indeed's application data reference (applicant.fullName / email /
 * phoneNumber / coverletter / resume.file{data,fileName,contentType}, job.jobId / jobTitle / jobLocation / jobMeta,
 * id, questions); a few alternate spellings are accepted so a format change doesn't drop a candidate.
 */
export function parseIndeedApply(body: unknown): { ok: true; candidate: Candidate } | { ok: false; error: string } {
  const b = obj(body), a = obj(b.applicant), job = obj(b.job);
  const email = str(a.email ?? a.emailAddress).toLowerCase();
  const name = str(a.fullName) || [str(a.firstName), str(a.lastName)].filter(Boolean).join(" ");
  if (!EMAIL.test(email)) return { ok: false, error: "applicant.email missing or invalid" };
  if (!name) return { ok: false, error: "applicant.fullName missing" };
  const file = obj(obj(a.resume).file);
  const resumeText = str(obj(a.resume).text);
  const title = str(job.jobTitle ?? job.title), meta = str(job.jobMeta ?? job.meta);
  const loc = str(job.jobLocation ?? job.location);
  const cover = str(a.coverletter ?? a.coverLetter);
  return {
    ok: true,
    candidate: {
      full_name: name.slice(0, 120), email, phone: cleanPhone(str(a.phoneNumber ?? a.phone)),
      trades: inferTrades(meta, title),
      location: loc || undefined,
      zips: str(a.zip ?? a.postalCode ?? obj(a.location).postalCode) || undefined,
      message: [cover, resumeText && !str(file.data) ? `Résumé (text): ${resumeText}` : ""].filter(Boolean).join("\n\n").slice(0, 2000) || undefined,
      source: "indeed",
      external_id: str(b.id ?? b.applicationId) || undefined,
      external_job: { id: str(job.jobId ?? job.id) || null, title: title || null, location: loc || null, meta: meta || null, url: str(job.jobUrl) || null },
      screener: b.questions ?? b.screenerQuestions ?? undefined,
      resume: str(file.data) ? { data: str(file.data), fileName: str(file.fileName) || "resume", contentType: str(file.contentType) || "application/octet-stream" } : undefined,
    },
  };
}

/** One CSV line → cells (quotes, escaped quotes and commas inside quotes). */
function cells(line: string): string[] {
  const out: string[] = []; let cur = "", q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (q) { if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; } else if (ch === '"') q = false; else cur += ch; }
    else if (ch === '"') q = true;
    else if (ch === "," || ch === "\t") { out.push(cur); cur = ""; }
    else cur += ch;
  }
  out.push(cur);
  return out.map((c) => c.trim());
}
/** Split rows, keeping newlines that sit inside quotes. */
function rows(text: string): string[] {
  const out: string[] = []; let cur = "", q = false;
  for (const ch of text.replace(/^﻿/, "").replace(/\r\n?/g, "\n")) {
    if (ch === '"') q = !q;
    if (ch === "\n" && !q) { if (cur.trim()) out.push(cur); cur = ""; } else cur += ch;
  }
  if (cur.trim()) out.push(cur);
  return out;
}

const COLS: Record<string, string[]> = {
  name: ["name", "full name", "candidate", "candidate name", "applicant", "applicant name"],
  first: ["first name", "first"], last: ["last name", "last"],
  email: ["email", "email address", "e-mail", "candidate email"],
  phone: ["phone", "phone number", "mobile", "cell", "candidate phone"],
  business: ["business", "business name", "company"],
  job: ["job title", "job", "position", "applied for", "job name"],
  trades: ["trades", "trade", "skills"],
  location: ["location", "candidate location", "city", "address"],
  zip: ["zip", "zip code", "postal code", "zips"],
  years: ["years", "years experience", "years of experience", "relevant experience", "experience"],
  notes: ["notes", "message", "summary", "cover letter"],
  source: ["source"],
};

/**
 * Candidates from CSV text (Indeed's candidate export, a spreadsheet saved as CSV, another ATS). Needs a header row with
 * at least a name and an email column. Returns the good rows and a reason for each skipped row.
 */
export function parseCandidatesCsv(text: string, defaultSource = "import"): { candidates: Candidate[]; skipped: { row: number; reason: string }[] } {
  const lines = rows(text);
  if (lines.length < 2) return { candidates: [], skipped: [{ row: 1, reason: "Needs a header row and at least one candidate" }] };
  const head = cells(lines[0]).map((h) => h.toLowerCase().replace(/[_*]/g, " ").replace(/\s+/g, " ").trim());
  const col = (k: string) => head.findIndex((h) => COLS[k].includes(h));
  const idx = Object.fromEntries(Object.keys(COLS).map((k) => [k, col(k)])) as Record<string, number>;
  if (idx.email < 0 || (idx.name < 0 && idx.first < 0)) return { candidates: [], skipped: [{ row: 1, reason: "The header row needs a Name (or First name) column and an Email column" }] };
  const candidates: Candidate[] = [], skipped: { row: number; reason: string }[] = [], seen = new Set<string>();
  lines.slice(1).forEach((line, i) => {
    const c = cells(line), get = (k: string) => (idx[k] >= 0 ? c[idx[k]] ?? "" : "");
    const email = get("email").toLowerCase();
    const name = get("name") || [get("first"), get("last")].filter(Boolean).join(" ");
    if (!EMAIL.test(email)) return skipped.push({ row: i + 2, reason: `No valid email${name ? ` for ${name}` : ""}` });
    if (!name) return skipped.push({ row: i + 2, reason: `No name for ${email}` });
    if (seen.has(email)) return skipped.push({ row: i + 2, reason: `${email} is listed twice` });
    seen.add(email);
    const years = parseInt(get("years"), 10);
    candidates.push({
      full_name: name.slice(0, 120), email, phone: cleanPhone(get("phone")), business_name: get("business") || undefined,
      trades: inferTrades(get("trades"), get("job"), get("notes")), location: get("location") || undefined, zips: get("zip") || undefined,
      years_experience: Number.isFinite(years) && years >= 0 && years <= 80 ? years : undefined,
      message: [get("job") && `Applied for: ${get("job")}`, get("notes")].filter(Boolean).join("\n").slice(0, 2000) || undefined,
      source: (get("source") || defaultSource).toLowerCase().slice(0, 60),
    });
  });
  return { candidates, skipped };
}
