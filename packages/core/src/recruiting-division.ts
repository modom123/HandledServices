/*
 * FILE    : packages/core/src/recruiting-division.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-27_1700 UTC
 * PURPOSE : The Recruiting division in one model (pure functions, no I/O). Every role we're filling is an Opening on one
 *           of three tracks, top down:
 *             pro    — independent pros (1099) for our own network, one evergreen opening per trade we're short of
 *                      (supply gaps) or always recruit (MARKETING_FOCUS.trades); applicants join the pro pipeline
 *             staff  — people who work for Handled itself (internal Talent searches)
 *             client — roles we fill for client companies (Handled Talent searches)
 *           Indeed is the primary sourcing tool: indeedPost() writes a ready-to-paste Indeed job for any opening (job type,
 *           pay line, description, screener questions, the tracked apply link, and the jobMeta that routes Indeed Apply
 *           applications back to the right pipeline). Pro posts avoid employment words (contractorWordingIssues) so they
 *           match the Independent Contractor Agreement. Used by Hub → Recruiting and the public /careers page.
 */
import { BRAND } from "./brand.ts";
import { MARKETING_FOCUS } from "./focus.ts";
import { TRADES } from "./services.ts";
import { COVERAGES, TRADE_PROFILES } from "./vetting.ts";

export type Track = "pro" | "staff" | "client";
export const TRACK_LABEL: Record<Track, string> = { pro: "Independent pros", staff: "Handled team", client: "Client roles" };
export const TRACK_ICON: Record<Track, string> = { pro: "🧰", staff: "🏢", client: "🤝" };

export interface Opening {
  /** Stable id: "pro:<trade>", "staff:<searchId>", "client:<searchId>" — also the Indeed jobMeta that routes applicants. */
  key: string;
  track: Track;
  title: string;
  location: string;
  /** Pro openings: the trade. */
  trade?: string;
  /** Talent searches: the search id. */
  searchId?: string;
  /** How many people we still need (pros: from supply gaps; searches: openings). */
  needed: number;
  /** Why it's open, in a few words ("short of pros in 4 ZIPs", "always recruiting", "client: Acme"). */
  reason: string;
  workplace?: "onsite" | "hybrid" | "remote";
  salaryMin?: number | null;
  salaryMax?: number | null;
  description?: string | null;
  mustHaves?: string | null;
  /** Client roles: hide the company on public pages. */
  confidential?: boolean;
}

export const tradeLabel = (id: string) => (TRADES.find((t) => t.id === id)?.label ?? id).replace(/\s*\((licensed|certified|remote|Handled Talent)\)/i, "");

/** Pro openings: every trade short of pros (from supply gaps: trade → pros needed, ZIPs short), plus the trades we always recruit. */
export function proOpenings(shortages: { trade: string; needed: number; zips: number }[], area = "Metro Detroit, MI"): Opening[] {
  const m = new Map<string, Opening>();
  for (const s of shortages) {
    if (!TRADES.some((t) => t.id === s.trade) || s.needed <= 0) continue;
    const o = m.get(s.trade);
    if (o) { o.needed += s.needed; continue; }
    m.set(s.trade, { key: `pro:${s.trade}`, track: "pro", trade: s.trade, title: `Independent ${tradeLabel(s.trade)} Pro`, location: area, needed: s.needed, reason: "" });
  }
  for (const r of m.values()) { const z = shortages.filter((s) => s.trade === r.trade).reduce((n, s) => n + s.zips, 0); r.reason = z ? `short of pros in ${z} ZIP${z === 1 ? "" : "s"}` : "customers waiting"; }
  for (const t of MARKETING_FOCUS.trades) if (!m.has(t)) m.set(t, { key: `pro:${t}`, track: "pro", trade: t, title: `Independent ${tradeLabel(t)} Pro`, location: area, needed: 0, reason: "always recruiting (marketing focus)" });
  return [...m.values()].sort((a, b) => b.needed - a.needed || a.title.localeCompare(b.title));
}

/** A Talent search as an opening: internal (our own team) or a client's role. */
export function searchOpening(s: { id: string; title: string; location: string | null; workplace?: string | null; salary_min?: number | null; salary_max?: number | null; openings?: number | null; description?: string | null; must_haves?: string | null; company?: string | null }, internal: boolean): Opening {
  return {
    key: `${internal ? "staff" : "client"}:${s.id}`, track: internal ? "staff" : "client", searchId: s.id, title: s.title, location: s.location ?? (s.workplace === "remote" ? "Remote" : "Detroit, MI"),
    needed: Math.max(1, Number(s.openings ?? 1)), reason: internal ? "Handled team" : `client: ${s.company ?? "—"}`, workplace: (s.workplace as Opening["workplace"]) ?? "onsite",
    salaryMin: s.salary_min ?? null, salaryMax: s.salary_max ?? null, description: s.description ?? null, mustHaves: s.must_haves ?? null, confidential: !internal,
  };
}

/** Where an Indeed applicant lands. Pros: the pro application, tagged with the trade; staff/client roles: their /careers page. */
export function applyUrl(site: string, o: Opening, source = "indeed"): string {
  const base = site.replace(/\/$/, "");
  if (o.track === "pro") return `${base}/pros?utm_source=${source}&utm_campaign=${encodeURIComponent(o.trade ?? "pros")}&opening=${encodeURIComponent(o.key)}#apply`;
  return `${base}/careers/${o.searchId}?utm_source=${source}`;
}

/** Parse the opening key Indeed sends back in jobMeta ("opening=staff:<uuid>"), or null. */
export function openingFromMeta(meta: string | null | undefined): { track: Track; id: string } | null {
  const m = String(meta ?? "").match(/opening\s*=\s*(pro|staff|client):([a-z0-9_-]+)/i);
  return m ? { track: m[1].toLowerCase() as Track, id: m[2] } : null;
}

/** Words that make 1099 work read like a job with us (and hurt the independent-contractor position). */
const EMPLOYMENT_WORDS = ["hire", "hiring", "employee", "employment", "shift", "hourly wage", "supervisor", "training program", "uniform", "full-time", "part-time", "wage"];
export function contractorWordingIssues(text: string): string[] {
  const t = ` ${text.toLowerCase()} `;
  return EMPLOYMENT_WORDS.filter((w) => new RegExp(`[^a-z]${w.replace(/ /g, "\\s+")}s?[^a-z]`).test(t) && !/not employment/.test(t.slice(Math.max(0, t.indexOf(w) - 30), t.indexOf(w) + 30)));
}

export interface IndeedPost { title: string; jobType: string; location: string; pay: string; description: string; screeners: string[]; applyUrl: string; jobMeta: string; issues: string[] }

const money = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;

/** A ready-to-paste Indeed job for an opening. */
export function indeedPost(o: Opening, site: string): IndeedPost {
  const url = applyUrl(site, o);
  if (o.track === "pro") {
    const p = TRADE_PROFILES[o.trade ?? ""];
    const trade = tradeLabel(o.trade ?? "");
    const gl = p ? `General liability insurance (${money(p.glMin)})${p.requires.length ? ` plus ${p.requires.map((k) => COVERAGES[k].label.toLowerCase()).join(" and ")}` : ""}` : "General liability insurance";
    const need = [
      `Your own ${trade.toLowerCase()} business: independent pro, sole proprietor or LLC`,
      ...(p?.license ? [p.license] : []),
      `${gl}. We can point you to fast, low-cost options.`,
      "A background check (we arrange it)",
      "Reliable transportation, a smartphone and your own tools",
      "A W-9 (you're paid as an independent contractor on a 1099)",
    ];
    const description = [
      `**Run your ${trade.toLowerCase()} business. We bring you the customers.**`,
      `${BRAND.name} sends independent pros prepaid ${trade.toLowerCase()} jobs near where they work${o.location ? ` (${o.location})` : ""}. ${p?.does ?? ""} You see exactly what you'll earn before you accept. Take the jobs you want and skip the ones you don't.`,
      "**Why pros like it**",
      "- **No lead fees, no subscription.** We only earn when you get paid.\n- **Prepaid jobs.** The customer pays before you arrive, so you never chase anyone for money.\n- **Weekly payouts,** or instant pay for qualifying pros.\n- **Your schedule.** Choose your days, how many jobs and how far you'll drive.\n- **Keep your own clients.** Work with us as much or as little as you like.",
      "**What you need**",
      need.map((x) => `- ${x}`).join("\n"),
      "**How it works**\n1. Apply in about 5 minutes.\n2. Finish setup on your phone: agreement, W-9, insurance, background check and payout account.\n3. Job offers start. Accept the ones you want.",
      "¿Habla español? Puede aplicar y trabajar con nosotros en español.",
      "*This is an independent contractor opportunity, not employment. You run your own business and decide which jobs to take.*",
    ].join("\n\n");
    return {
      title: `Independent ${trade} — Pick Your Own Jobs, Paid Per Job (1099)`, jobType: "Contract", location: o.location,
      pay: "Paid per job — every offer shows your exact pay before you accept (pros keep about 75% of everyday jobs)",
      description, applyUrl: url, jobMeta: `opening=${o.key}`, issues: contractorWordingIssues(description.replace(/not employment/g, "")),
      screeners: ["Do you have general liability insurance (or can you get it within a week)?", ...(p?.license ? ["Do you hold the license this trade requires in your state?"] : []), "Do you have reliable transportation and your own tools?"],
    };
  }
  const pay = o.salaryMin || o.salaryMax ? `${o.salaryMin ? money(o.salaryMin) : ""}${o.salaryMin && o.salaryMax ? " – " : ""}${o.salaryMax ? money(o.salaryMax) : ""} a year` : "Pay discussed in the first call";
  const who = o.track === "staff" ? `${BRAND.name} (${BRAND.legalName})` : "Our client";
  const description = [
    o.track === "staff" ? `**Join the ${BRAND.name} team.** ${BRAND.name} is one company for everything a home or business needs: 100+ services, done by vetted local pros and run by a small team with AI doing the busywork.` : `**${o.title}** — ${BRAND.name} Talent is filling this role for one of our clients${o.location ? ` in ${o.location}` : ""}. Candidates never pay a fee.`,
    o.description ?? "",
    o.mustHaves ? `**What you bring**\n${o.mustHaves.split(/\n|;/).map((x) => x.trim()).filter(Boolean).map((x) => `- ${x}`).join("\n")}` : "",
    `**How to apply**\nApply in a few minutes: ${url}. A recruiter from ${BRAND.name} reviews every application, usually within two business days.`,
    `${who} is an equal opportunity employer. We consider every qualified applicant without regard to race, color, religion, sex, sexual orientation, gender identity, national origin, age, disability, veteran status or any other protected characteristic.`,
  ].filter(Boolean).join("\n\n");
  return {
    title: o.title, jobType: "Full-time", location: o.workplace === "remote" ? "Remote" : o.location, pay, description, applyUrl: url, jobMeta: `opening=${o.key}`, issues: [],
    screeners: ["Are you authorized to work in the United States?", "How many years of experience do you have in a role like this?"],
  };
}

/** Pipeline stages shared across tracks, top down (pro stages and Talent stages map onto these for the Overview). */
export const DIVISION_STAGES = ["applied", "screening", "interview", "offer", "onboarding", "active"] as const;
export type DivisionStage = (typeof DIVISION_STAGES)[number];
export const DIVISION_STAGE_LABEL: Record<DivisionStage, string> = { applied: "Applied", screening: "Screening", interview: "Interview", offer: "Offer / invited", onboarding: "Onboarding", active: "Hired / active" };

/** Pro pipeline stage (core recruiting.ts PipelineStage) → division stage; null = out of the funnel (rejected, dropped). */
export function proStageToDivision(stage: string): DivisionStage | null {
  if (["applied"].includes(stage)) return "applied";
  if (["screened"].includes(stage)) return "screening";
  if (["interview", "interviewed"].includes(stage)) return "interview";
  if (["invited"].includes(stage)) return "offer";
  if (["onboarding", "verifying", "background"].includes(stage)) return "onboarding";
  if (["active"].includes(stage)) return "active";
  return null;
}
/** Talent stage → division stage. */
export function talentStageToDivision(stage: string): DivisionStage | null {
  if (stage === "sourced") return "applied";
  if (["screened", "submitted", "client_review"].includes(stage)) return "screening";
  if (stage === "interview") return "interview";
  if (stage === "offer") return "offer";
  if (stage === "placed") return "active";
  return null;
}

/**
 * Where AI works in the division, step by step, and where a person always decides. Agent kinds match mission.ts AGENTS
 * (and ai_runs.kind); "auto" steps are rules and schedules, not AI.
 */
export const DIVISION_AI: { step: string; agents: string[]; auto: string[]; human: string }[] = [
  { step: "Openings", agents: ["growth_planner"], auto: ["Supply gaps open a pro trade when customers are waiting"], human: "Staff create team roles; clients' searches start with an intake call" },
  { step: "Sourcing (Indeed first)", agents: [], auto: ["Indeed post kit and tracked apply links", "Indeed Apply and CSV import route each applicant to the right pipeline", "Pro leads: finds and emails independent pros where we're short"], human: "Staff post on Indeed and paste the link" },
  { step: "Screening", agents: ["screen"], auto: ["Confirmation email to every applicant"], human: "Decline only by a person" },
  { step: "Interview", agents: ["interview_turn", "interview_eval"], auto: [], human: "A person decides who's invited (or interviews them with the scorecard)" },
  { step: "Onboarding", agents: ["doc_check"], auto: ["Setup reminders, background check (Checkr), drop-offs", "Activation when every step is verified"], human: "Staff verify documents the AI flags and review any background result that isn't clear" },
  { step: "Active", agents: ["dispatch"], auto: ["Insurance and license renewal reminders"], human: "Staff pause or offboard" },
];

/**
 * The subcontractor's digital file, column by column (Hub → Recruiting → Pro files). Each column is one or more steps of
 * the onboarding checklist the pro sees (compliance.ts onboardingChecklist), so the file and setup never disagree.
 */
export const PRO_FILE_ITEMS: { id: string; label: string; steps: (s: string) => boolean }[] = [
  { id: "photo", label: "Photo", steps: (k) => k === "photo" },
  { id: "resume", label: "Résumé", steps: (k) => k === "resume" },
  { id: "id", label: "ID", steps: (k) => k === "id" },
  { id: "w9", label: "W-9", steps: (k) => k === "w9" },
  { id: "agreement", label: "Agreement", steps: (k) => k === "agreement" },
  { id: "skills", label: "Skills", steps: (k) => k === "specialties" },
  { id: "insurance", label: "Insurance", steps: (k) => k === "coi" || k.startsWith("coverage:") },
  { id: "license", label: "License", steps: (k) => k === "license" },
  { id: "background", label: "Background", steps: (k) => k === "background" },
  { id: "payout", label: "Payout", steps: (k) => k === "payout" },
];
export type FileCell = "done" | "missing" | "expiring" | "n/a";
/** One pro's file status per column, and how complete it is (required items only). */
export function proFileStatus(steps: { key: string; done: boolean; optional?: boolean; expiring?: boolean }[]) {
  const cells: Record<string, FileCell> = {};
  for (const it of PRO_FILE_ITEMS) {
    const mine = steps.filter((s) => it.steps(s.key) && !s.optional);
    cells[it.id] = !mine.length ? "n/a" : mine.some((s) => !s.done) ? "missing" : mine.some((s) => s.expiring) ? "expiring" : "done";
  }
  const req = Object.values(cells).filter((c) => c !== "n/a");
  const pct = req.length ? Math.round((req.filter((c) => c !== "missing").length / req.length) * 100) : 100;
  return { cells, pct, missing: PRO_FILE_ITEMS.filter((it) => cells[it.id] === "missing").map((it) => it.label), expiring: PRO_FILE_ITEMS.filter((it) => cells[it.id] === "expiring").map((it) => it.label) };
}
