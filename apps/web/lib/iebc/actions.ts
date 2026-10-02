/*
 * FILE    : apps/web/lib/iebc/actions.ts
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-01_1800 UTC
 * UPDATED : 2026-10-02_0255 UTC — read.roster: live pro status, location and week ahead.
 * UPDATED : 2026-10-02_0157 UTC — actions receive the acting agent (ctx.actor) for the audit
 *           trail; recruiting actions go through lib/recruiting (same path as the Hub buttons):
 *           pipeline, invite/decline, nudge, documents with AI readings, background checks.
 * UPDATED : 2026-10-02_1412 UTC — Spanish versions of person-facing texts, emails and push.
 * PURPOSE : The actions IEBC's AI employees may take in this business. Each action
 *           declares its scope (which department may use it), whether it writes, and
 *           its risk. The gateway (gateway.ts) enforces scopes + autonomy and logs
 *           everything to agent_actions.
 */
import "server-only";
import { z } from "zod";
import { BRAND, JOB_STATUSES, money, necThreshold, onboardingChecklist, splitJob } from "@handled/core";
import { adminClient } from "../supabase/server";
import { addEvent, dispatchJob, finalizeJob, getJob, raiseAlert, sendPaymentLink, setStatus } from "../jobs";
import { createComplimentary, createRedo, issueRefund } from "../remedies";
import { sendEmail } from "../notify";
import { localeOf } from "../push";
import { activatePro, decideDocument, inviteApplicant, logRecruiting, nudgePro, orderBackgroundCheck, pipeline, rejectApplicant, revivePro } from "../recruiting";

export type Scope = "read" | "ops" | "finance" | "recruiting" | "retention" | "sales";

export interface ActionDef {
  scope: Scope;
  write: boolean;
  /** High-risk writes always need human approval, even for autonomous agents. */
  risk: "low" | "high";
  description: string;
  params: z.ZodType;
  run: (p: never, ctx: ActionCtx) => Promise<unknown>;
}

/** Who is acting — "Tyler Walsh (IEBC)", or "… approved by <staff>" for queued actions. */
export interface ActionCtx { actor: string }

const db = () => adminClient();
const ref = z.string().regex(/^H-\d+$/i).transform((r) => r.toUpperCase());
async function jobByRef(r: string) {
  const { data } = await db().from("jobs").select("*").eq("ref", r).maybeSingle();
  if (!data) throw new Error(`No job ${r}`);
  return data;
}
const def = <P extends z.ZodType>(d: Omit<ActionDef, "params" | "run"> & { params: P; run: (p: z.infer<P>, ctx: ActionCtx) => Promise<unknown> }) => d as unknown as ActionDef;

export const ACTIONS: Record<string, ActionDef> = {
  // ─── read (any assigned agent with "read") ───
  "read.kpis": def({
    scope: "read", write: false, risk: "low", description: "Bookings, completed jobs, revenue, payouts, margin and rating for a date range (default: last 30 days).",
    params: z.object({ from: z.string().optional(), to: z.string().optional() }),
    run: async ({ from, to }) => {
      const f = from ?? new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
      const t = `${to ?? new Date().toISOString().slice(0, 10)}T23:59:59`;
      const [{ data: jobs }, { data: reviews }] = await Promise.all([
        db().from("jobs").select("status, price_final, contractor_payout, service_slug").gte("created_at", f).lte("created_at", t),
        db().from("reviews").select("rating").gte("created_at", f).lte("created_at", t),
      ]);
      const done = (jobs ?? []).filter((j) => j.status === "completed");
      const revenue = done.reduce((s, j) => s + Number(j.price_final ?? 0), 0);
      const payouts = done.reduce((s, j) => s + Number(j.contractor_payout ?? 0), 0);
      return { from: f, to: t.slice(0, 10), bookings: jobs?.length ?? 0, completed: done.length, gross_bookings: revenue, paid_to_pros: payouts, our_take: revenue - payouts, take_rate: revenue ? +((revenue - payouts) / revenue).toFixed(3) : null,
        avg_rating: reviews?.length ? +(reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(2) : null };
    },
  }),
  "read.jobs": def({
    scope: "read", write: false, risk: "low", description: "List jobs (max 100) filtered by status, date range or unassigned.",
    params: z.object({ status: z.array(z.enum(JOB_STATUSES)).optional(), date_from: z.string().optional(), date_to: z.string().optional(), unassigned_only: z.boolean().optional() }),
    run: async (p) => {
      let q = db().from("jobs").select("ref, status, service_slug, contact_name, company_name, city, zip, scheduled_date, time_window, estimate_low, estimate_high, price_final, contractor_id, priority").order("scheduled_date").limit(100);
      if (p.status?.length) q = q.in("status", p.status);
      if (p.date_from) q = q.gte("scheduled_date", p.date_from);
      if (p.date_to) q = q.lte("scheduled_date", p.date_to);
      if (p.unassigned_only) q = q.is("contractor_id", null);
      return (await q).data;
    },
  }),
  "read.job": def({
    scope: "read", write: false, risk: "low", description: "One job with its offers and timeline.",
    params: z.object({ ref }),
    run: async ({ ref: r }) => {
      const job = await jobByRef(r);
      const [{ data: offers }, { data: events }] = await Promise.all([
        db().from("job_offers").select("status, payout, ai_score, ai_reason, contractors(business_name)").eq("job_id", job.id),
        db().from("job_events").select("kind, message, actor, created_at").eq("job_id", job.id).order("created_at"),
      ]);
      const { stripe_customer_id: _a, stripe_payment_method: _b, ...safe } = job;
      return { job: safe, offers, events };
    },
  }),
  "read.pros": def({
    scope: "read", write: false, risk: "low", description: "Subcontractor network with performance and compliance fields.",
    params: z.object({ trade: z.string().optional(), status: z.enum(["applied", "vetting", "approved", "suspended"]).optional() }),
    run: async ({ trade, status }) => {
      let q = db().from("contractors").select("id, business_name, trades, service_zips, status, rating, jobs_completed, acceptance_rate, on_time_rate, insured_until, background_checked, daily_capacity");
      if (trade) q = q.contains("trades", [trade]);
      if (status) q = q.eq("status", status);
      return (await q).data;
    },
  }),
  "read.roster": def({
    scope: "read", write: false, risk: "low", description: "Live roster: each active pro's status now (on a job / on call / booked / open / off), live location while on call or on a job, today's jobs, and the next 7 days booked vs daily limit.",
    params: z.object({}),
    run: async () => (await import("../roster")).liveRoster(),
  }),
  "read.alerts": def({
    scope: "read", write: false, risk: "low", description: "Unresolved ops alerts.",
    params: z.object({}),
    run: async () => (await db().from("ops_alerts").select("id, kind, severity, title, body, created_at").eq("resolved", false).order("created_at", { ascending: false }).limit(50)).data,
  }),
  "read.applications": def({
    scope: "read", write: false, risk: "low", description: "Open subcontractor applications with AI screening.",
    params: z.object({}),
    run: async () => (await db().from("contractor_applications").select("id, business_name, contact_name, trades, zips, years_experience, crew_size, insured, status, ai_screen, created_at").in("status", ["new", "reviewing"])).data,
  }),
  "read.reviews": def({
    scope: "read", write: false, risk: "low", description: "Recent customer reviews (default 30 days), optionally only low ratings.",
    params: z.object({ days: z.number().int().min(1).max(365).default(30), max_rating: z.number().int().min(1).max(5).optional() }),
    run: async ({ days, max_rating }) => {
      let q = db().from("reviews").select("rating, comment, created_at, jobs(ref, service_slug, contact_name), contractors(business_name)").gte("created_at", new Date(Date.now() - days * 86400000).toISOString());
      if (max_rating) q = q.lte("rating", max_rating);
      return (await q).data;
    },
  }),
  "read.lapsed_customers": def({
    scope: "read", write: false, risk: "low", description: "Customers whose last completed job is older than N days with nothing booked (win-back list).",
    params: z.object({ days: z.number().int().min(14).max(730).default(60) }),
    run: async ({ days }) => {
      const { data } = await db().from("jobs").select("contact_name, contact_email, service_slug, status, completed_at, created_at").order("created_at", { ascending: false }).limit(5000);
      const by = new Map<string, { name: string; email: string; last_completed: string | null; open: boolean; services: Set<string> }>();
      for (const j of data ?? []) {
        const k = j.contact_email.toLowerCase();
        const c = by.get(k) ?? { name: j.contact_name, email: k, last_completed: null, open: false, services: new Set<string>() };
        if (j.status === "completed" && (!c.last_completed || j.completed_at > c.last_completed)) c.last_completed = j.completed_at;
        if (!["completed", "cancelled"].includes(j.status)) c.open = true;
        c.services.add(j.service_slug);
        by.set(k, c);
      }
      const cutoff = Date.now() - days * 86400000;
      return [...by.values()].filter((c) => !c.open && c.last_completed && new Date(c.last_completed).getTime() < cutoff).map((c) => ({ ...c, services: [...c.services] }));
    },
  }),

  // ─── ops ───
  "ops.dispatch_job": def({
    scope: "ops", write: true, risk: "low", description: "Send offers for an unassigned job to the best available pros.",
    params: z.object({ ref }),
    run: async ({ ref: r }) => {
      const job = await jobByRef(r);
      if (job.contractor_id) throw new Error("Job already has a pro");
      return dispatchJob(job.id, { siteVisit: job.status === "site_visit" });
    },
  }),
  "ops.set_job_status": def({
    scope: "ops", write: true, risk: "low", description: "Change a job's status. Cancelling is high-risk and always needs approval.",
    params: z.object({ ref, status: z.enum(JOB_STATUSES) }),
    run: async ({ ref: r, status }) => {
      const job = await jobByRef(r);
      await setStatus(job.id, status, "IEBC workforce");
      return { ref: r, status };
    },
  }),
  "ops.add_job_note": def({
    scope: "ops", write: true, risk: "low", description: "Add an internal note to a job's timeline.",
    params: z.object({ ref, note: z.string().min(1).max(2000) }),
    run: async ({ ref: r, note }) => { const job = await jobByRef(r); await addEvent(job.id, "iebc_note", note, "IEBC workforce", false); return "noted"; },
  }),
  "ops.rate_job": def({
    scope: "ops", write: true, risk: "low", description: "Our rating (1-5) of the pro on a completed job: overall plus quality, punctuality, professionalism. Feeds the pro's blended rating.",
    params: z.object({ ref, rating: z.number().int().min(1).max(5), quality: z.number().int().min(1).max(5).optional(), punctuality: z.number().int().min(1).max(5).optional(),
      professionalism: z.number().int().min(1).max(5).optional(), comment: z.string().max(1000).optional() }),
    run: async ({ ref: r, ...rating }) => {
      const job = await jobByRef(r);
      if (!job.contractor_id) throw new Error("No pro on this job");
      await db().from("ops_ratings").upsert({ job_id: job.id, contractor_id: job.contractor_id, ...rating, source: "iebc", rated_by: "IEBC workforce" }, { onConflict: "job_id" });
      return "rated";
    },
  }),
  "ops.set_instructions": def({
    scope: "ops", write: true, risk: "low", description: "Write the instructions printed on the pro's work order (access, parking, what to bring).",
    params: z.object({ ref, instructions: z.string().min(3).max(4000) }),
    run: async ({ ref: r, instructions }) => { const job = await jobByRef(r); await db().from("jobs").update({ instructions }).eq("id", job.id); await addEvent(job.id, "instructions", "Work-order instructions updated", "IEBC workforce", false); return "saved"; },
  }),
  "ops.create_alert": def({
    scope: "ops", write: true, risk: "low", description: "Pin an alert to the command center dashboard.",
    params: z.object({ title: z.string().max(200), body: z.string().max(2000), severity: z.enum(["info", "warn", "critical"]) }),
    run: async ({ title, body, severity }) => { await raiseAlert("iebc", severity, title, body); return "alert created"; },
  }),
  "ops.approve_qa": def({
    scope: "ops", write: true, risk: "high", description: "Close a job held in QA review (charges the customer and approves the payout).",
    params: z.object({ ref, summary: z.string().max(500).optional() }),
    run: async ({ ref: r, summary }) => { const job = await jobByRef(r); await finalizeJob(job.id, summary); return "closed"; },
  }),

  // ─── finance ───
  "finance.payout_queue": def({
    scope: "finance", write: false, risk: "low", description: "Payouts owed to pros.",
    params: z.object({}),
    run: async () => (await db().from("payouts").select("id, amount, status, created_at, contractors(business_name), jobs(ref)").in("status", ["approved", "pending", "held"])).data,
  }),
  "finance.set_job_price": def({
    scope: "finance", write: true, risk: "high", description: "Set the firm price on a job (e.g. after a site visit). Payout is recalculated.",
    params: z.object({ ref, price: z.number().positive() }),
    run: async ({ ref: r, price }) => {
      const job = await jobByRef(r);
      await db().from("jobs").update({ price_final: price, estimate_low: price, estimate_high: price, contractor_payout: splitJob(price, job.service_slug).payout, status: job.status === "site_visit" ? "quoted" : job.status }).eq("id", job.id);
      await addEvent(job.id, "quoted", `Firm price: ${money(price)} — pay to lock in your pro.`, "IEBC workforce", true, `Precio final: ${money(price)}. Pague para asegurar a su profesional.`);
      const fresh = await getJob(job.id);
      const link = fresh && !fresh.paid_at ? await sendPaymentLink(fresh) : null;
      return { ref: r, price, payment_link_sent: Boolean(link) };
    },
  }),
  "finance.mark_payout_paid": def({
    scope: "finance", write: true, risk: "high", description: "Mark a payout as paid.",
    params: z.object({ payout_id: z.string().uuid() }),
    run: async ({ payout_id }) => { await db().from("payouts").update({ status: "paid", paid_at: new Date().toISOString() }).eq("id", payout_id); return "paid"; },
  }),

  // ─── recruiting & compliance ───
  "recruiting.decide_application": def({
    scope: "recruiting", write: true, risk: "high",
    description: "Invite or decline an applicant (same as the Hub's Invite/Decline). Invite creates the pro record and emails a one-click link to their setup checklist; decline sends a polite email. 'reviewing' just marks it as under review.",
    params: z.object({ application_id: z.string().uuid(), decision: z.enum(["approve", "reject", "reviewing"]), reason: z.string().max(300).optional() }),
    run: async ({ application_id, decision, reason }, ctx) => {
      if (decision === "approve") {
        const r = await inviteApplicant(application_id, ctx.actor, reason ?? "");
        if (!r.ok) throw new Error(r.error);
        return { application_id, invited: true, contractor_id: r.contractorId };
      }
      if (decision === "reject") { await rejectApplicant(application_id, ctx.actor, reason); return { application_id, declined: true }; }
      await db().from("contractor_applications").update({ status: "reviewing" }).eq("id", application_id);
      await logRecruiting("reviewing", { applicationId: application_id }, reason ?? null, ctx.actor);
      return { application_id, status: "reviewing" };
    },
  }),
  "recruiting.activate_pro": def({
    scope: "recruiting", write: true, risk: "high", description: "Activate a pro whose setup is complete and verified (W-9, agreement, area, insurance & trade coverage, license if required, background, payout). Sends the 'You're live' email and push.",
    params: z.object({ contractor_id: z.string().uuid() }),
    run: async ({ contractor_id }, ctx) => { await activatePro(contractor_id, ctx.actor); return "activated"; },
  }),
  "recruiting.pipeline": def({
    scope: "recruiting", write: false, risk: "low",
    description: "The recruiting pipeline: every applicant/pro in setup with stage, setup progress, steps left, source, AI screen score, reminders sent and days since applying. Filter by stage.",
    params: z.object({ stage: z.enum(["applied", "screened", "invited", "onboarding", "verifying", "background", "active", "rejected", "dropped"]).optional(), limit: z.number().int().min(1).max(200).default(50) }),
    run: async ({ stage, limit }) => (await pipeline()).filter((r) => !stage || r.stage === stage).slice(0, limit).map((r) => ({
      application_id: r.app.id ?? null, contractor_id: r.pro?.id ?? null, business: r.app.business_name, contact: r.app.contact_name, trades: r.app.trades,
      stage: r.stage, stage_label: r.label, setup: r.total ? `${r.done}/${r.total}` : null, steps_left: r.left, source: r.app.source ?? null,
      ai_score: (r.app.ai_screen as { score?: number } | null)?.score ?? null, reminders_sent: r.pro?.onboarding_reminders ?? 0,
      days_since_applied: Math.floor((Date.now() - new Date(String(r.app.created_at)).getTime()) / 86400000),
    })),
  }),
  "recruiting.history": def({
    scope: "recruiting", write: false, risk: "low", description: "Full history for one applicant or pro: every email, reminder, step, document check, decision and status change.",
    params: z.object({ application_id: z.string().uuid().optional(), contractor_id: z.string().uuid().optional() }),
    run: async ({ application_id, contractor_id }) => {
      if (!application_id && !contractor_id) throw new Error("application_id or contractor_id required");
      let q = db().from("recruiting_events").select("kind, note, actor, created_at").order("created_at");
      q = application_id && contractor_id ? q.or(`application_id.eq.${application_id},contractor_id.eq.${contractor_id}`) : application_id ? q.eq("application_id", application_id) : q.eq("contractor_id", contractor_id!);
      return (await q).data;
    },
  }),
  "recruiting.nudge_pro": def({
    scope: "recruiting", write: true, risk: "low", description: "Send a pro who is stuck in setup a personal reminder now (email + push with a one-click link and the exact steps left). Add a short helpful note, e.g. where to get insurance.",
    params: z.object({ contractor_id: z.string().uuid(), note: z.string().max(600).optional() }),
    run: async ({ contractor_id, note }, ctx) => nudgePro(contractor_id, note, ctx.actor),
  }),
  "recruiting.revive_pro": def({
    scope: "recruiting", write: true, risk: "low", description: "Restart setup reminders for a pro marked dropped.",
    params: z.object({ contractor_id: z.string().uuid(), note: z.string().max(300).optional() }),
    run: async ({ contractor_id, note }, ctx) => { await revivePro(contractor_id, ctx.actor, note); return "revived"; },
  }),
  "recruiting.add_note": def({
    scope: "recruiting", write: true, risk: "low", description: "Add a note to an applicant's or pro's recruiting history (calls, what they said, follow-up plans).",
    params: z.object({ application_id: z.string().uuid().optional(), contractor_id: z.string().uuid().optional(), note: z.string().min(1).max(1000) }),
    run: async ({ application_id, contractor_id, note }, ctx) => { await logRecruiting("note", { applicationId: application_id, contractorId: contractor_id }, note, ctx.actor); return "noted"; },
  }),
  "recruiting.documents": def({
    scope: "recruiting", write: false, risk: "low", description: "Documents waiting for verification (or all for one pro), with the AI reading of each: insured name, limits, additional insured, expiry and problems.",
    params: z.object({ contractor_id: z.string().uuid().optional() }),
    run: async ({ contractor_id }) => {
      let q = db().from("contractor_documents").select("id, contractor_id, kind, status, expires_on, notes, ai_check, created_at, contractors(business_name)").order("created_at", { ascending: false }).limit(100);
      q = contractor_id ? q.eq("contractor_id", contractor_id) : q.eq("status", "pending");
      return (await q).data;
    },
  }),
  "recruiting.verify_document": def({
    scope: "recruiting", write: true, risk: "high", description: "Verify or reject a pro's document (insurance, license, coverage, background report). Verifying updates their compliance dates; rejecting asks the pro to re-upload with your reason. Always waits for human approval.",
    params: z.object({ contractor_id: z.string().uuid(), document_id: z.string().uuid(), decision: z.enum(["verify", "reject"]), reason: z.string().max(300).optional() }),
    run: async ({ contractor_id, document_id, decision, reason }, ctx) => decideDocument(contractor_id, document_id, decision, ctx.actor, reason),
  }),
  "recruiting.order_background_check": def({
    scope: "recruiting", write: true, risk: "low", description: "Order (or re-order) a pro's background check — through Checkr when connected, otherwise as an ops task.",
    params: z.object({ contractor_id: z.string().uuid() }),
    run: async ({ contractor_id }) => {
      await db().from("contractors").update({ background_status: null }).eq("id", contractor_id).eq("background_checked", false);
      await orderBackgroundCheck(contractor_id);
      return (await db().from("contractors").select("background_status").eq("id", contractor_id).single()).data;
    },
  }),
  "read.pro_scorecards": def({
    scope: "read", write: false, risk: "low", description: "Per-pro asset scorecard: jobs, bookings and take generated, 90-day take, quality, onboarding status.",
    params: z.object({}),
    run: async () => {
      const [{ data: cards }, { data: pros }] = await Promise.all([
        db().from("contractor_scorecard").select("*"),
        db().from("contractors").select("*"),
      ]);
      return (cards ?? []).map((c: Record<string, unknown>) => {
        const pro = (pros ?? []).find((p: { id: string }) => p.id === c.contractor_id);
        const ob = pro ? onboardingChecklist(pro) : null;
        return { ...c, onboarding_complete: ob?.complete, missing: ob?.steps.filter((x) => !x.done).map((x) => x.label), expiring: ob?.steps.filter((x) => x.expiring).map((x) => x.label) };
      });
    },
  }),
  "read.tax_1099": def({
    scope: "finance", write: false, risk: "low", description: "1099 totals by pro for a tax year with the reporting threshold.",
    params: z.object({ year: z.number().int().min(2025).max(2100) }),
    run: async ({ year }) => ({ threshold: necThreshold(year), rows: (await db().from("contractor_1099").select("business_name, legal_name, entity_type, tin_last4, w9_received_at, paid_total, owed_total").eq("tax_year", year)).data }),
  }),
  "recruiting.flag_expiring_insurance": def({
    scope: "recruiting", write: true, risk: "low", description: "Raise alerts for active pros whose insurance expires within N days.",
    params: z.object({ days: z.number().int().min(1).max(90).default(30) }),
    run: async ({ days }) => {
      const limit = new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
      const { data } = await db().from("contractors").select("id, business_name, insured_until").eq("status", "approved").lte("insured_until", limit);
      for (const c of data ?? []) await raiseAlert("insurance", "warn", `${c.business_name}: insurance expires ${c.insured_until}`, "Request an updated certificate of insurance.");
      return { flagged: data?.length ?? 0 };
    },
  }),

  // ─── retention / customer care ───
  "retention.message_customer": def({
    scope: "retention", write: true, risk: "low", description: "Send the customer on a job a message (job thread + email). Use for follow-ups, review requests, apologies. Write subject and body in the customer's language (the job's locale: en or es).",
    params: z.object({ ref, subject: z.string().max(150), body: z.string().min(1).max(3000) }),
    run: async ({ ref: r, subject, body }) => {
      const job = await jobByRef(r);
      await db().from("messages").insert({ job_id: job.id, sender_role: "ops", body });
      const lang = await localeOf(job.customer_id, job.locale);
      await sendEmail(job.contact_email, subject, `${body}\n\n— ${lang === "es" ? `El equipo de ${BRAND.name}` : `The ${BRAND.name} team`}`);
      return { sent: true, customer_language: lang };
    },
  }),
  "retention.make_it_right": def({
    scope: "retention", write: true, risk: "high", description: "Make a paid job right: refund (amount, pro_at_fault), free redo by the same pro (date), or a complimentary extra service (service_slug, date). Capped so a job never goes below $0.",
    params: z.object({ ref, type: z.enum(["refund", "redo", "complimentary"]), amount: z.number().positive().optional(), pro_at_fault: z.boolean().default(true),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), service_slug: z.string().optional(), reason: z.string().min(3).max(500) }),
    run: async (p) => {
      const job = await jobByRef(p.ref);
      if (p.type === "refund") return issueRefund(job.id, p.amount ?? 0, p.pro_at_fault, "IEBC workforce", p.reason);
      if (!p.date) throw new Error("date required");
      if (p.type === "redo") return createRedo(job.id, p.date, "IEBC workforce", p.reason);
      if (!p.service_slug) throw new Error("service_slug required");
      return createComplimentary(job.id, p.service_slug, undefined, p.date, "IEBC workforce", p.reason);
    },
  }),
  "retention.email_customer": def({
    scope: "retention", write: true, risk: "high", description: "Email a past customer by address (win-back). High-risk: outbound marketing needs approval. Write in the customer's language (their last booking's locale: en or es).",
    params: z.object({ email: z.string().email(), subject: z.string().max(150), body: z.string().min(1).max(3000) }),
    run: async ({ email, subject, body }) => {
      const { data: last } = await db().from("jobs").select("customer_id, locale").ilike("contact_email", email).order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (!last) throw new Error("Not an existing customer");
      const lang = await localeOf(last.customer_id, last.locale);
      await sendEmail(email, subject, `${body}\n\n— ${lang === "es" ? `El equipo de ${BRAND.name}` : `The ${BRAND.name} team`}`);
      return { sent: true, customer_language: lang };
    },
  }),

  // ─── sales / B2B / leads ───
  "sales.list_accounts": def({
    scope: "sales", write: false, risk: "low", description: "Commercial accounts and callback leads.",
    params: z.object({}),
    run: async () => ({
      accounts: (await db().from("business_accounts").select("*").order("created_at", { ascending: false })).data,
      leads: (await db().from("leads").select("*").order("created_at", { ascending: false }).limit(100)).data,
    }),
  }),
  "sales.create_lead": def({
    scope: "sales", write: true, risk: "low", description: "Record a new lead (residential or commercial).",
    params: z.object({ name: z.string(), email: z.string().email().optional(), phone: z.string().optional(), zip: z.string().optional(), service_slug: z.string().optional(), message: z.string().max(2000) }),
    run: async (p) => { await db().from("leads").insert({ ...p, source: "iebc" }); return "lead created"; },
  }),
  "sales.update_account": def({
    scope: "sales", write: true, risk: "low", description: "Update a commercial account's stage, monthly value or notes.",
    params: z.object({ id: z.string().uuid(), status: z.enum(["lead", "proposal", "active", "paused", "lost"]).optional(), monthly_value: z.number().min(0).optional(), notes: z.string().max(4000).optional() }),
    run: async ({ id, ...patch }) => { await db().from("business_accounts").update(patch).eq("id", id); return "updated"; },
  }),
};

/** Writes that are high-risk only for certain params. */
export function effectiveRisk(action: string, params: Record<string, unknown>): "low" | "high" {
  if (action === "ops.set_job_status" && params.status === "cancelled") return "high";
  return ACTIONS[action]?.risk ?? "high";
}
