/*
 * FILE    : packages/core/src/talent.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-05_2034 UTC
 * PURPOSE : Handled Talent — the recruiting agency as a service. Companies hire us to fill roles; independent recruiters
 *           (pros with the "recruiter" trade) source and submit candidates; we run the client relationship, contracts,
 *           invoicing and payouts.
 *             TALENT_TERMS       — contingency 25% of the first year's base salary (recruiter 20%, Handled 5%); retained
 *                                  30% in three payments; 90-day guarantee; 12-month candidate ownership; net 30
 *             placementFee       — the fee and the split for a hire
 *             retainedSchedule   — the three retained payments, and the true-up to the actual salary at hire
 *             guaranteeOutcome   — a hire who leaves early: covered or not, replacement or prorated refund, the
 *                                  recruiter's share of any refund
 *             ownershipCheck     — who "owns" a candidate for a client (first written submission, 12 months), so two
 *                                  recruiters never both claim one hire and a client can't hire around the fee
 *             fairHiringCheck    — words in a job order that suggest discrimination (age, sex, national origin…) with
 *                                  a plain fix; we don't post or source for a discriminatory order
 *           Candidates never pay a fee. Recruiters are independent businesses paid a share of the fee we collect.
 */

export const TALENT_TERMS = {
  /** Contingency fee, % of the first year's base salary. */
  contingencyPct: 25,
  /** The recruiter's share on a contingency hire, % of the first year's base salary. */
  recruiterPct: 20,
  /** Retained search fee, % of the first year's base salary. */
  retainedPct: 30,
  /** The recruiter's share of every retained payment (same 80/20 split as contingency). */
  retainedRecruiterShare: 0.8,
  /** Minimum fee per hire ($0 = none). */
  minimumFee: 0 as number,
  /** Guarantee: a hire who leaves within this many days is replaced (or refunded, prorated). */
  guaranteeDays: 90,
  /** A client who hires a candidate we introduced, within this many months, owes the fee. */
  ownershipMonths: 12,
  /** Invoice due this many days after the start date. */
  invoiceDueDays: 30,
  /** Retained: days from engagement to the shortlist payment. */
  shortlistDays: 30,
} as const;

export type SearchType = "contingency" | "retained";
export type SearchStatus = "intake" | "open" | "on_hold" | "filled" | "cancelled";
export const SEARCH_STATUS_LABEL: Record<SearchStatus, string> = { intake: "New request", open: "Open", on_hold: "On hold", filled: "Filled", cancelled: "Cancelled" };

export type TalentStage = "sourced" | "screened" | "submitted" | "client_review" | "interview" | "offer" | "placed" | "rejected" | "withdrawn";
export const TALENT_STAGES: { id: TalentStage; label: string; active: boolean }[] = [
  { id: "sourced", label: "Sourced", active: true },
  { id: "screened", label: "Screened", active: true },
  { id: "submitted", label: "Submitted to client", active: true },
  { id: "client_review", label: "Client reviewing", active: true },
  { id: "interview", label: "Interviewing", active: true },
  { id: "offer", label: "Offer", active: true },
  { id: "placed", label: "Hired", active: false },
  { id: "rejected", label: "Not selected", active: false },
  { id: "withdrawn", label: "Withdrew", active: false },
];
export const TALENT_STAGE_LABEL = Object.fromEntries(TALENT_STAGES.map((s) => [s.id, s.label])) as Record<TalentStage, string>;
/** Stages the client can see (anything before "submitted" is the recruiter's own pipeline). */
export const TALENT_CLIENT_VISIBLE: TalentStage[] = ["submitted", "client_review", "interview", "offer", "placed", "rejected", "withdrawn"];

const r2 = (n: number) => Math.round(n * 100) / 100;

// ───────────────────────────── fees ─────────────────────────────

export interface FeeTerms { feePct: number; recruiterPct: number; minimumFee: number }

/** The fee for a hire and how it splits. If the minimum fee applies, the recruiter's share scales with it. */
export function placementFee(baseSalary: number, t: Partial<FeeTerms> = {}) {
  const feePct = t.feePct ?? TALENT_TERMS.contingencyPct;
  const recruiterPct = Math.min(t.recruiterPct ?? TALENT_TERMS.recruiterPct, feePct);
  const salary = Math.max(0, Number(baseSalary) || 0);
  const byPct = r2(salary * (feePct / 100));
  const fee = Math.max(byPct, t.minimumFee ?? TALENT_TERMS.minimumFee);
  const recruiterPay = feePct > 0 ? r2(fee * (recruiterPct / feePct)) : 0;
  return { salary, feePct, fee, recruiterPay, platform: r2(fee - recruiterPay), minimumApplied: fee > byPct };
}

export interface RetainedPayment { key: "engagement" | "shortlist" | "placement"; label: string; amount: number; recruiterPay: number; due: string }

/**
 * Retained search: one third at engagement, one third at the shortlist (or 30 days), the balance at hire — trued up to
 * the actual salary (never below zero). Each payment splits with the recruiter at the retained share.
 */
export function retainedSchedule(o: { estimatedSalary: number; feePct?: number; recruiterShare?: number; engagedOn: string; actualSalary?: number | null; paidSoFar?: number }) {
  const pct = o.feePct ?? TALENT_TERMS.retainedPct;
  const share = o.recruiterShare ?? TALENT_TERMS.retainedRecruiterShare;
  const est = r2(Math.max(0, o.estimatedSalary) * (pct / 100));
  const third = r2(est / 3);
  const addDays = (iso: string, d: number) => { const x = new Date(`${iso.slice(0, 10)}T12:00:00Z`); x.setUTCDate(x.getUTCDate() + d); return x.toISOString().slice(0, 10); };
  const total = o.actualSalary ? r2(o.actualSalary * (pct / 100)) : est;
  const firstTwo = r2(third * 2);
  const last = r2(Math.max(0, total - Math.max(firstTwo, o.paidSoFar ?? 0)));
  const pay = (key: RetainedPayment["key"], label: string, amount: number, due: string): RetainedPayment => ({ key, label, amount, recruiterPay: r2(amount * share), due });
  return {
    feePct: pct, estimatedFee: est, totalFee: r2(firstTwo + last),
    payments: [
      pay("engagement", "At engagement", third, o.engagedOn.slice(0, 10)),
      pay("shortlist", "At shortlist (or 30 days)", third, addDays(o.engagedOn, TALENT_TERMS.shortlistDays)),
      pay("placement", o.actualSalary ? "At hire (trued up to the actual salary)" : "At hire", last, "on start date"),
    ],
  };
}

// ───────────────────────────── guarantee ─────────────────────────────

export type ExitReason = "resigned" | "terminated_performance" | "terminated_cause" | "laid_off" | "position_eliminated" | "other";
export const TALENT_EXIT_LABEL: Record<ExitReason, string> = {
  resigned: "Resigned", terminated_performance: "Let go for performance", terminated_cause: "Let go for cause", laid_off: "Laid off", position_eliminated: "Position eliminated / restructured", other: "Other",
};
const COVERED: ExitReason[] = ["resigned", "terminated_performance", "terminated_cause"];

/**
 * A hire who leaves within the guarantee. Covered when they resigned or were let go for performance or cause — not for
 * layoffs or eliminated roles — and only if the fee was paid on time. The client picks a free replacement search
 * (default) or a refund prorated to the days left in the guarantee; the recruiter returns their share of any refund.
 */
export function guaranteeOutcome(o: { fee: number; recruiterPay: number; startDate: string; endDate: string; reason: ExitReason; paidOnTime: boolean; remedy?: "replacement" | "refund"; guaranteeDays?: number }) {
  const days = o.guaranteeDays ?? TALENT_TERMS.guaranteeDays;
  const worked = Math.max(0, Math.round((new Date(`${o.endDate.slice(0, 10)}T12:00:00Z`).getTime() - new Date(`${o.startDate.slice(0, 10)}T12:00:00Z`).getTime()) / 86400000));
  const within = worked < days;
  const covered = within && COVERED.includes(o.reason) && o.paidOnTime;
  const why = !within ? `Worked ${worked} days — past the ${days}-day guarantee` : !COVERED.includes(o.reason) ? `${TALENT_EXIT_LABEL[o.reason]} isn't covered (layoffs and eliminated roles aren't)` : !o.paidOnTime ? "The fee wasn't paid on time, so the guarantee doesn't apply" : `Left after ${worked} days — covered`;
  if (!covered) return { covered: false, worked, why, remedy: null, refund: 0, recruiterClawback: 0 };
  const remedy = o.remedy ?? "replacement";
  if (remedy === "replacement") return { covered: true, worked, why, remedy, refund: 0, recruiterClawback: 0 };
  const share = (days - worked) / days;
  const refund = r2(o.fee * share);
  return { covered: true, worked, why, remedy, refund, recruiterClawback: r2(o.recruiterPay * share) };
}

// ───────────────────────────── candidate ownership ─────────────────────────────

export interface PriorSubmission { client_id: string; candidate_email: string; recruiter_id: string; submitted_at: string; stage?: TalentStage }

/**
 * Who owns this candidate for this client? The first written submission to the client owns them for 12 months: a second
 * recruiter can't submit them, and the client owes the fee if they hire them directly in that window.
 */
export function ownershipCheck(prior: PriorSubmission[], next: { client_id: string; candidate_email: string; recruiter_id: string }, now = new Date()) {
  const email = next.candidate_email.trim().toLowerCase();
  const cutoff = new Date(now); cutoff.setUTCMonth(cutoff.getUTCMonth() - TALENT_TERMS.ownershipMonths);
  const live = prior
    .filter((p) => p.client_id === next.client_id && p.candidate_email.trim().toLowerCase() === email && new Date(p.submitted_at) >= cutoff && p.stage !== "withdrawn")
    .sort((a, b) => a.submitted_at.localeCompare(b.submitted_at));
  const owner = live[0];
  if (!owner) return { ok: true as const, owner: null, reason: null };
  if (owner.recruiter_id === next.recruiter_id) return { ok: false as const, owner, reason: "You already submitted this candidate to this client" };
  const until = new Date(owner.submitted_at); until.setUTCMonth(until.getUTCMonth() + TALENT_TERMS.ownershipMonths);
  return { ok: false as const, owner, reason: `Another recruiter submitted this candidate to this client first; they own the introduction until ${until.toISOString().slice(0, 10)}` };
}

// ───────────────────────────── fair hiring ─────────────────────────────

const FAIR_RULES: { re: RegExp; issue: string; fix: string }[] = [
  { re: /\b(young|youthful|energetic young|digital native|recent (college )?grad(uate)?s? only|under \d{2}|max(imum)? age|no older than)\b/i, issue: "Age preference", fix: "Describe the skills and experience needed instead (age discrimination is illegal for workers 40+, and Michigan protects all ages)." },
  { re: /\b(salesman|foreman|handyman|waitress|hostess|he will|she will|male only|female only|men only|women only)\b/i, issue: "Gendered wording", fix: "Use neutral titles and 'they' (sales representative, crew lead, server)." },
  { re: /\b(native (english )?speaker|no accent|american[- ]born|u\.?s\.? citizens? only|green card holders? only)\b/i, issue: "National origin / citizenship", fix: "Say 'fluent in English' if the job needs it, and 'authorized to work in the U.S.' — citizenship only when a law or contract requires it." },
  { re: /\b(no (criminal|felony) (record|history)|clean record|never been arrested)\b/i, issue: "Blanket record ban", fix: "Say a background check is required for this role; records are assessed case by case (and some local laws limit when you can ask)." },
  { re: /\b(must be (single|married)|no kids|no children|childless|pregnan)/i, issue: "Family / marital status", fix: "Remove it — say what schedule or travel the job needs instead." },
  { re: /\b(christian|muslim|jewish|church[- ]going)\b/i, issue: "Religion", fix: "Remove it unless the employer is a religious organization hiring for a religious role." },
  { re: /\b(able[- ]bodied|no disabilities|perfect health|must be healthy)\b/i, issue: "Disability", fix: "List the job's essential physical tasks (e.g. 'lift 50 lb with or without accommodation')." },
  { re: /\b(height|weight) (requirement|minimum|maximum)\b/i, issue: "Height / weight", fix: "Michigan bans height and weight discrimination — remove unless it's a true job requirement you can prove." },
];

export function fairHiringCheck(text: string) {
  return FAIR_RULES.filter((r) => r.re.test(text)).map((r) => ({ issue: r.issue, fix: r.fix, match: text.match(r.re)?.[0] ?? "" }));
}

export const FAIR_HIRING_RULES = [
  "Candidates never pay a fee.",
  "We source, screen and submit on skills, experience and the job's real requirements — never on age, race, color, religion, sex, pregnancy, sexual orientation, gender identity, national origin, disability, genetic information, height, weight, marital or familial status, or veteran status.",
  "We don't take a job order that asks us to discriminate, and we tell the client why.",
  "Every candidate agrees before their résumé goes to a client, and knows which company it's going to.",
  "AI may help find, summarize and schedule, but a person makes every decision to submit or reject, and candidates are told when AI is used.",
  "Candidate data is used only for that candidate's job search and deleted on request.",
];

export const normalizeEmail = (e: string) => e.trim().toLowerCase();
