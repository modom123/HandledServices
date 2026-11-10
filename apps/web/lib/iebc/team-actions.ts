/*
 * FILE    : apps/web/lib/iebc/team-actions.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-11-10_2230 UTC
 * PURPOSE : IEBC Workforce actions for the roles added on 2026-11-10 (migration 20261110223000_iebc_team_expansion):
 *             partners    — Lucas Thorne, Partner Success: every partner's roadmap stage, payout setup, earnings; coach by email
 *             pro_success — Grace O'Connor / Leo Fitzgerald: new pros' first jobs, pros gone quiet; check in by email
 *             bids        — Veronica Chase / Margaret Okonkwo: the gov opportunity pipeline and bids; bid / no-bid decisions
 *             legal       — Olivia Grant, Rafael Ortiz, Margaret Okonkwo (Legal & Compliance): contract versions and who
 *                           hasn't signed the current one, chargebacks and refunds, licensing / insurance gaps by state,
 *                           and "needs attorney review" flags. Legal agents only draft and flag: they never send legal
 *                           advice to customers or pros, and every write they make waits for human approval (suggest /
 *                           approval autonomy) — the binding call is a licensed attorney's.
 *           Merged into ACTIONS (actions.ts); the gateway enforces scopes, autonomy and the audit log as for every action.
 */
import "server-only";
import { z } from "zod";
import { AGREEMENT_VERSION, BRAND, LICENSED_TRADES, SERVICE_AGREEMENT_VERSION, SERVICES, SITE_MARKETS, roadmapFor, roadmapProgress } from "@handled/core";
import { adminClient } from "../supabase/server";
import { sendEmail } from "../notify";
import { raiseAlert } from "../jobs";
import { logRecruiting } from "../recruiting";
import { partnerGrowthStats, type Partner } from "../partners";
import type { ActionCtx, ActionDef } from "./actions";

const db = () => adminClient();
const def = <P extends z.ZodType>(d: Omit<ActionDef, "params" | "run" | "scope"> & { scope: TeamScope; params: P; run: (p: z.infer<P>, ctx: ActionCtx) => Promise<unknown> }) => d as unknown as ActionDef;
export type TeamScope = "partners" | "pro_success" | "bids" | "legal";
const daysAgo = (n: number) => new Date(Date.now() - n * 86400000).toISOString();
const daysSince = (iso: string | null | undefined) => (iso ? Math.floor((Date.now() - new Date(iso).getTime()) / 86400000) : null);
const signoff = (actor: string) => `\n\n— ${actor.replace(/ \(IEBC\).*$/, "")}, ${BRAND.name}\n${BRAND.supportPhone} · ${BRAND.supportEmail}`;

type Pro = { id: string; business_name: string | null; contact_name: string | null; email: string | null; status: string; onboarded_at: string | null; jobs_completed: number | null; rating: number | null; base_city: string | null; base_state: string | null; trades: string[] | null; showcase_opt_in?: boolean | null; license_number?: string | null; license_expires?: string | null; insured_until?: string | null; agreement_version?: string | null; agreement_signed_at?: string | null };
const proName = (c: Pro) => c.business_name || c.contact_name || "pro";

/** Last completed job per pro (one query). */
async function lastJobs(ids: string[]) {
  const out = new Map<string, string>();
  if (!ids.length) return out;
  const { data } = await db().from("jobs").select("contractor_id, completed_at").in("contractor_id", ids).eq("status", "completed").order("completed_at", { ascending: false }).limit(5000);
  for (const j of (data ?? []) as { contractor_id: string; completed_at: string | null }[]) if (j.completed_at && !out.has(j.contractor_id)) out.set(j.contractor_id, j.completed_at);
  return out;
}

export const TEAM_ACTIONS: Record<string, ActionDef> = {
  // ─── partners (Partner Success) ───
  "partners.list": def({
    scope: "partners", write: false, risk: "low",
    description: "Active referral / sales partners with their growth roadmap, current stage and what's left in it, whether payouts are set up, customers, paying jobs, earnings and commission rates. Newest first (max 50).",
    params: z.object({ limit: z.number().int().min(1).max(50).optional(), needs_payout_setup: z.boolean().optional() }),
    run: async ({ limit, needs_payout_setup }) => {
      const { data } = await db().from("referral_partners").select("*").eq("status", "active").order("created_at", { ascending: false }).limit(limit ?? 50);
      const rows = [];
      for (const p of (data ?? []) as Partner[]) {
        const s = await partnerGrowthStats(p).catch(() => null);
        if (!s || (needs_payout_setup && s.payoutsReady)) continue;
        const map = roadmapFor(p.kind);
        const prog = roadmapProgress(map, s);
        const st = prog.stages[prog.current];
        rows.push({
          id: p.id, code: p.code, name: p.name, email: p.email, kind: p.kind, joined_days_ago: daysSince(p.created_at),
          roadmap: map.name, stage: prog.complete ? "roadmap complete" : st?.name, goals_left: prog.complete ? [] : (st?.goals ?? []).filter((g) => !g.done).map((g) => `${g.label} (${g.value}/${g.target})`), next_action: prog.nextAction,
          payouts_set_up: s.payoutsReady, customers: s.customers, paying_jobs: s.jobs, earned: s.earned, referral_rate: s.referralRate, sales_rate: s.salesRate,
        });
      }
      return rows;
    },
  }),
  "partners.message": def({
    scope: "partners", write: true, risk: "low",
    description: "Email one partner a personal coaching note (next roadmap step, a service play, a payout-setup reminder). Plain text; signed by you.",
    params: z.object({ partner_id: z.string().uuid(), subject: z.string().min(3).max(120), body: z.string().min(20).max(4000) }),
    run: async ({ partner_id, subject, body }, ctx) => {
      const { data: p } = await db().from("referral_partners").select("email, name, status").eq("id", partner_id).maybeSingle();
      if (!p || p.status !== "active") throw new Error("No active partner with that id");
      if (!(await sendEmail(p.email, subject, `${body}${signoff(ctx.actor)}`))) throw new Error("Email didn't send");
      return `emailed ${p.name}`;
    },
  }),

  // ─── pro_success (Pro Success / at-risk watch) ───
  "pro_success.pros": def({
    scope: "pro_success", write: false, risk: "low",
    description: "Approved pros with their first-job and activity picture: days since approval, jobs completed, days since the last completed job, rating, area, and website showcase opt-in. view=new (approved in the last `days`, default 60), quiet (no completed job in `days`, default 30) or all.",
    params: z.object({ view: z.enum(["new", "quiet", "all"]).optional(), days: z.number().int().min(1).max(365).optional(), state: z.string().length(2).optional() }),
    run: async ({ view = "new", days, state }) => {
      let q = db().from("contractors").select("*").eq("status", "approved").order("onboarded_at", { ascending: false }).limit(500);
      if (state) q = q.eq("base_state", state.toUpperCase());
      if (view === "new") q = q.gte("onboarded_at", daysAgo(days ?? 60));
      const { data } = await q;
      const pros = (data ?? []) as Pro[];
      const last = await lastJobs(pros.map((c) => c.id));
      const quietDays = days ?? 30;
      return pros.map((c) => ({
        id: c.id, name: proName(c), email: c.email, area: [c.base_city, c.base_state].filter(Boolean).join(", "),
        approved_days_ago: daysSince(c.onboarded_at), jobs_completed: Number(c.jobs_completed ?? 0), days_since_last_job: daysSince(last.get(c.id)),
        rating: c.rating, showcase_opt_in: Boolean(c.showcase_opt_in),
      })).filter((r) => view !== "quiet" || (r.days_since_last_job ?? r.approved_days_ago ?? 0) >= quietDays).slice(0, 200);
    },
  }),
  "pro_success.message": def({
    scope: "pro_success", write: true, risk: "low",
    description: "Email one approved pro a personal check-in (first job tips, orientation, rewards, the website showcase, a quiet-pro check-in). Logged in their recruiting history.",
    params: z.object({ contractor_id: z.string().uuid(), subject: z.string().min(3).max(120), body: z.string().min(20).max(4000) }),
    run: async ({ contractor_id, subject, body }, ctx) => {
      const { data: c } = await db().from("contractors").select("email, business_name, contact_name, status").eq("id", contractor_id).maybeSingle();
      if (!c?.email) throw new Error("No pro with an email on file");
      if (!(await sendEmail(c.email, subject, `${body}${signoff(ctx.actor)}`))) throw new Error("Email didn't send");
      await logRecruiting("pro_success_checkin", { contractorId: contractor_id }, subject, ctx.actor);
      return `emailed ${c.business_name || c.contact_name}`;
    },
  }),

  // ─── bids (Government capture) ───
  "bids.pipeline": def({
    scope: "bids", write: false, risk: "low",
    description: "Government opportunities still open (best fit first, with AI summary, deadline, set-aside and place of performance) and our bids in progress with their status and due dates.",
    params: z.object({ min_fit: z.number().int().min(0).max(100).optional(), limit: z.number().int().min(1).max(50).optional() }),
    run: async ({ min_fit, limit }) => {
      const [{ data: opps }, { data: bids }] = await Promise.all([
        db().from("gov_opportunities").select("notice_id, title, agency, notice_type, set_aside, naics, response_deadline, pop_city, pop_state, fit_score, status, owner, notes, ai_summary, ui_link")
          .eq("active", true).in("status", ["new", "reviewing", "bidding"]).gte("fit_score", min_fit ?? 0).gte("response_deadline", new Date().toISOString())
          .order("fit_score", { ascending: false }).limit(limit ?? 25),
        db().from("bids").select("id, title, agency, source, due_at, questions_due_at, status, no_bid_reason, notice_id").not("status", "in", "(won,lost,cancelled,no_bid)").order("due_at", { ascending: true }).limit(50),
      ]);
      return { opportunities: opps ?? [], bids: bids ?? [] };
    },
  }),
  "bids.decide": def({
    scope: "bids", write: true, risk: "high",
    description: "Record the bid / no-bid call on a government opportunity: bidding (go), reviewing (needs more info) or passed (no-bid), with the reason. Always waits for human approval.",
    params: z.object({ notice_id: z.string().min(3), decision: z.enum(["bidding", "reviewing", "passed"]), reason: z.string().min(10).max(1500) }),
    run: async ({ notice_id, decision, reason }, ctx) => {
      const { data: o } = await db().from("gov_opportunities").select("notes").eq("notice_id", notice_id).maybeSingle();
      if (!o) throw new Error(`No opportunity ${notice_id}`);
      const note = `${new Date().toISOString().slice(0, 10)} ${ctx.actor}: ${decision} — ${reason}`;
      await db().from("gov_opportunities").update({ status: decision, owner: ctx.actor, notes: [o.notes, note].filter(Boolean).join("\n"), updated_at: new Date().toISOString() }).eq("notice_id", notice_id);
      return `${notice_id} → ${decision}`;
    },
  }),

  // ─── legal (Legal & Compliance) ───
  "legal.contracts": def({
    scope: "legal", write: false, risk: "low",
    description: "Contract status: the current pro agreement and service agreement versions, approved pros who haven't signed the current pro agreement, and how many acceptances each contract version has.",
    params: z.object({}),
    run: async () => {
      const [{ data: pros }, { data: acc }] = await Promise.all([
        db().from("contractors").select("id, business_name, contact_name, email, agreement_version, agreement_signed_at, base_state").eq("status", "approved").limit(2000),
        db().from("contract_acceptances").select("contract_key, version, audience").gte("created_at", daysAgo(365)).limit(20000),
      ]);
      const counts: Record<string, number> = {};
      for (const a of (acc ?? []) as { contract_key: string; version: string; audience: string }[]) { const k = `${a.audience}:${a.contract_key}@${a.version}`; counts[k] = (counts[k] ?? 0) + 1; }
      const behind = ((pros ?? []) as Pro[]).filter((c) => c.agreement_version !== AGREEMENT_VERSION);
      return {
        current: { pro_agreement: AGREEMENT_VERSION, service_agreement: SERVICE_AGREEMENT_VERSION },
        pros_not_on_current_agreement: behind.map((c) => ({ id: c.id, name: proName(c), email: c.email, state: c.base_state, signed_version: c.agreement_version ?? null, signed_at: c.agreement_signed_at ?? null })),
        acceptances_last_year: counts,
      };
    },
  }),
  "legal.disputes": def({
    scope: "legal", write: false, risk: "low",
    description: "Chargebacks and refunds in the last `days` (default 90): open dispute alerts with the job, and jobs with money refunded — for evidence packs and pattern spotting.",
    params: z.object({ days: z.number().int().min(1).max(365).optional() }),
    run: async ({ days }) => {
      const since = daysAgo(days ?? 90);
      const [{ data: alerts }, { data: refunded }, { data: disputed }] = await Promise.all([
        db().from("ops_alerts").select("id, severity, title, body, job_id, resolved, created_at").eq("kind", "dispute").gte("created_at", since).order("created_at", { ascending: false }).limit(100),
        db().from("jobs").select("ref, service_slug, price_final, amount_refunded, remedy, contact_email, completed_at, terms_accepted_at").gt("amount_refunded", 0).gte("created_at", since).order("created_at", { ascending: false }).limit(100),
        db().from("jobs").select("ref, service_slug, price_final, disputed_at, terms_accepted_at, terms_accepted_ip, status").not("disputed_at", "is", null).gte("disputed_at", since).limit(100),
      ]);
      return { dispute_alerts: alerts ?? [], chargebacks: disputed ?? [], refunds: refunded ?? [] };
    },
  }),
  "legal.licensing": def({
    scope: "legal", write: false, risk: "low",
    description: "Licensing and insurance by market: the states we serve, the services that need a licensed pro, and approved pros with a licensed trade but no license on file, a license expiring within 60 days, or insurance lapsed / expiring within 30 days.",
    params: z.object({ state: z.string().length(2).optional() }),
    run: async ({ state }) => {
      let q = db().from("contractors").select("id, business_name, contact_name, email, base_state, trades, license_number, license_expires, insured_until").eq("status", "approved").limit(3000);
      if (state) q = q.eq("base_state", state.toUpperCase());
      const { data } = await q;
      const soon = (d: string | null | undefined, n: number) => Boolean(d && new Date(d).getTime() < Date.now() + n * 86400000);
      const gaps = ((data ?? []) as Pro[]).map((c) => {
        const licensed = (c.trades ?? []).filter((t) => LICENSED_TRADES.includes(t));
        const issues = [
          licensed.length && !c.license_number ? `licensed trade (${licensed.join(", ")}) with no license on file` : null,
          licensed.length && c.license_number && soon(c.license_expires, 60) ? `license expires ${c.license_expires}` : null,
          c.insured_until && soon(c.insured_until, 30) ? `insurance ${new Date(c.insured_until).getTime() < Date.now() ? "lapsed" : "expires"} ${c.insured_until}` : null,
        ].filter(Boolean);
        return { id: c.id, name: proName(c), email: c.email, state: c.base_state, issues };
      }).filter((r) => r.issues.length);
      return {
        markets: SITE_MARKETS.map((m) => ({ market: m.name, states: m.states })),
        licensed_services: SERVICES.filter((s) => s.licensed).map((s) => ({ slug: s.slug, name: s.name, trades: s.trades })),
        pro_gaps: gaps,
      };
    },
  }),
  "legal.flag": def({
    scope: "legal", write: true, risk: "low",
    description: "Flag something for the owner and a licensed attorney: a contract term, a dispute, a market's licensing or permit rule, a bid's legal requirements. Creates a Hub alert (critical ones are emailed). Never sent to customers or pros.",
    params: z.object({ area: z.enum(["pros", "clients", "contracts", "regulations", "permits", "bids"]), severity: z.enum(["info", "warn", "critical"]), title: z.string().min(5).max(160), details: z.string().min(20).max(4000), job_ref: z.string().regex(/^H-\d+$/i).optional() }),
    run: async ({ area, severity, title, details, job_ref }, ctx) => {
      let jobId: string | null = null;
      if (job_ref) jobId = ((await db().from("jobs").select("id").eq("ref", job_ref.toUpperCase()).maybeSingle()).data as { id: string } | null)?.id ?? null;
      await raiseAlert(`legal_${area}`, severity, `Legal review (${area}): ${title}`, `${details}\n\nFlagged by ${ctx.actor}. Needs review by a licensed attorney before anything binding is done.`, jobId);
      return "flagged for legal review";
    },
  }),
};
