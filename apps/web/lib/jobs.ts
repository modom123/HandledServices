/*
 * FILE    : apps/web/lib/jobs.ts
 * PROJECT : Handled — AI-run home & business services
 * CREATED : 2026-10-01_1723 UTC
 * UPDATED : 2026-10-02_0301 UTC — bookings record how soon the customer needs it (urgency → priority,
 *           needed-by date) and their budget.
 * UPDATED : 2026-10-02_0233 UTC — recurring visits and redos are offered to the same pro first (24h / 12h),
 *           never forced on them; offers another pro won are marked "taken", not held against anyone.
 * UPDATED : 2026-10-01_1900 UTC — Paid upfront: booking → final price (AI check runs
 *           before payment) → customer pays → only then dispatch. Recurring visits are
 *           charged before dispatch. Free site visits are the only unpaid dispatch.
 * PURPOSE : The job pipeline — booking → price → payment → dispatch → pro accepts → work →
 *           AI QA → completion, payout and review request. All writes use the service
 *           role; route handlers must authorize the caller before calling these.
 */
import "server-only";
import { z } from "zod";
import {
  BRAND, JOB_STATUS_LABEL, PROBATION, depositPolicy, SERVICE_AGREEMENT_VERSION, TIME_WINDOW_LABEL, WORK_ORDER_VERSION, buildWorkOrder, workOrderText, estimate, getService, isRush, money, moneyRange, proTier, rankContractors, sizeNeedsSiteVisit, containerPickup, splitJob, tierPayout, type QualityStats,
  type Contractor, type Job, type JobStatus,
  neededBy, urgencyPriority,
} from "@handled/core";
import { adminClient } from "./supabase/server";
import { aiQuote, type AiQuote } from "./ai/quote";
import { zipCentroid } from "./geo";
import { aiRankCandidates } from "./ai/dispatch";
import { aiQualityCheck } from "./ai/qa";
import { signedUrls } from "./photos";
import { opsEmail, sendEmail, siteUrl } from "./notify";
import { notify } from "./push";
import { amountDue, chargeSavedCard, paymentCheckoutUrl } from "./stripe";
import { invoiceUrl, readQuoteToken } from "./invoice";
import { syncCatalog } from "./catalog";

export const BookingSchema = z.object({
  service_slug: z.string().refine((s) => Boolean(getService(s)), "Unknown service"),
  answers: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])),
  frequency: z.enum(["once", "weekly", "biweekly", "monthly", "quarterly"]).default("once"),
  scheduled_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  time_window: z.enum(["morning", "midday", "afternoon", "flexible"]).default("flexible"),
  contact_name: z.string().min(2).max(120),
  contact_email: z.string().email(),
  contact_phone: z.string().min(7).max(30),
  customer_type: z.enum(["residential", "commercial"]).default("residential"),
  company_name: z.string().max(160).nullable().optional(),
  address: z.string().min(3).max(200),
  city: z.string().min(2).max(80),
  state: z.string().min(2).max(2),
  zip: z.string().regex(/^\d{5}$/),
  notes: z.string().max(2000).nullable().optional(),
  photos: z.array(z.string()).max(8).default([]),
  source: z.enum(["web", "mobile", "business", "phone", "ai_chat"]).default("web"),
  accept_terms: z.literal(true, { message: "Please accept the Service Agreement" }),
  payment_plan: z.enum(["full", "deposit"]).default("full"),
  /** From /api/quote: books at exactly the price the customer saw. */
  quote_token: z.string().max(20000).nullable().optional(),
  /** How soon they need it and what they want to spend (tracked; budget never changes the price). */
  urgency: z.enum(["asap", "this_week", "two_weeks", "month", "flexible"]).nullable().optional(),
  customer_budget: z.coerce.number().min(0).max(10_000_000).nullable().optional(),
});
export type BookingInput = z.infer<typeof BookingSchema>;

const db = () => adminClient();

export async function addEvent(jobId: string, kind: string, message: string, actor = "system", visible = true) {
  await db().from("job_events").insert({ job_id: jobId, kind, message, actor, visible_to_customer: visible });
}

export async function getJob(id: string): Promise<Job | null> {
  const { data } = await db().from("jobs").select("*").eq("id", id).maybeSingle();
  return (data as Job) ?? null;
}

/**
 * Step 1 — create the job at its FINAL price. When the customer left notes or photos the
 * AI review runs now (a few seconds) so the amount they pay never changes afterward.
 */
export async function createJob({ accept_terms: _accepted, payment_plan, quote_token, ...input }: BookingInput, customerId: string | null, ip: string | null = null) {
  const svc = getService(input.service_slug)!;
  await syncCatalog(); // new services in code must exist in the DB before a job can reference them
  const rush = isRush(input.scheduled_date);
  const est = estimate({ slug: svc.slug, answers: input.answers, frequency: input.frequency, rush });
  // the price the customer saw (signed quote) if nothing changed since; otherwise check now
  const q = readQuoteToken(quote_token);
  const same = q && q.slug === svc.slug && JSON.stringify(q.answers) === JSON.stringify(input.answers) && q.frequency === input.frequency
    && JSON.stringify(q.photos) === JSON.stringify(input.photos) && (q.notes ?? null) === (input.notes?.trim() || null) && q.rush === rush;
  const { ai } = svc.siteVisit
    ? { ai: null }
    : same
      ? { ai: q.ai as AiQuote | null }
      : await aiQuote({ slug: svc.slug, answers: input.answers, frequency: input.frequency, notes: input.notes, photoUrls: await signedUrls(input.photos), rush });
  const siteVisit = svc.siteVisit || Boolean(sizeNeedsSiteVisit(svc.slug, input.answers)) || ai?.action === "site_visit" || Boolean(ai?.needs_site_visit);
  if (ai?.answers) input.answers = ai.answers as BookingInput["answers"]; // book on the corrected scope the price was set on
  const loc = await zipCentroid(input.zip);
  // containers are two visits: drop off on the booked date, pick up when the rental ends
  let instructions: string | null = null;
  if (svc.slug === "junk-container" && input.scheduled_date) {
    const pickup = new Date(`${containerPickup(input.scheduled_date, input.answers.days)}T12:00:00`);
    const fmt = (d: Date) => d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
    instructions = `TWO VISITS. Drop off the ${input.answers.size ?? 15}-yard container on ${fmt(new Date(`${input.scheduled_date}T12:00:00`))} (${input.time_window}); pick it up on ${fmt(pickup)}. Use driveway boards. Upload the landfill weigh ticket as a receipt — any weight over the allowance is billed to the customer at cost.`;
  }
  const price = siteVisit ? null : ai?.final_price ?? est.point;
  const dep = price ? depositPolicy(svc.slug, price, input.scheduled_date) : null;
  const plan = payment_plan === "deposit" && dep?.allowed ? dep : null;
  const { data, error } = await db()
    .from("jobs")
    .insert({
      ...input,
      customer_id: customerId,
      instructions,
      lat: loc?.lat ?? null,
      lng: loc?.lng ?? null,
      status: (siteVisit ? "site_visit" : "requested") satisfies JobStatus,
      estimate_low: ai?.low ?? est.low,
      estimate_high: ai?.high ?? est.high,
      price_final: price,
      contractor_payout: price ? splitJob(price, svc.slug).payout : null,
      ai_quote: ai,
      priority: urgencyPriority(input.urgency, rush),
      urgency: input.urgency ?? null,
      needed_by: input.urgency ? neededBy(input.urgency) : input.scheduled_date ?? null,
      customer_budget: input.customer_budget || null,
      payment_plan: plan ? "deposit" : "full",
      deposit_amount: plan?.amount ?? null,
      balance_due_date: plan?.balanceDue ?? null,
      terms_version: SERVICE_AGREEMENT_VERSION,
      terms_accepted_at: new Date().toISOString(),
      terms_accepted_ip: ip,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return { job: data as Job, estimate: est, ai };
}

/** Step 2 (background) — notes, alerts, free site-visit dispatch, or payment follow-up. */
export async function onBooked(job: Job, paymentUrl: string | null) {
  const svc = getService(job.service_slug)!;
  const ai = job.ai_quote as { customer_summary?: string; risk_flags?: string[]; ops_notes?: string } | null;
  if (svc.slug === "junk-container" && job.scheduled_date)
    await addEvent(job.id, "scheduled", `Container drop-off ${job.scheduled_date}, pickup ${containerPickup(job.scheduled_date, (job.answers as Record<string, unknown>).days)}. Need it longer? Message us — extra days are $12 each.`, "system");
  if (ai?.customer_summary) await addEvent(job.id, "ai_quote", `AI reviewed your details: ${ai.customer_summary}`, "ai");
  if (ai?.risk_flags?.length) await raiseAlert("risk", "warn", `${job.ref}: ${ai.risk_flags.join(", ")}`, ai.ops_notes ?? null, job.id);

  if (job.status === "site_visit") {
    await sendEmail(job.contact_email, `${BRAND.name}: free site visit ${job.ref} booked`,
      `Hi ${job.contact_name.split(" ")[0]},\n\nA pro will visit to confirm a firm price for your ${svc.name} (estimated ${moneyRange(job.estimate_low, job.estimate_high)}). ` +
      `Nothing is owed until you approve the quote and pay to lock in the work.\n\nYour estimate & service agreement: ${invoiceUrl(job.id)}\nTrack it: ${siteUrl()}/account\n\n— ${BRAND.name}`);
    await dispatchJob(job.id, { siteVisit: true });
    return;
  }
  if (!paymentUrl) {
    // Stripe not configured — ops collects payment by phone/invoice, then marks it paid.
    await raiseAlert("payment", "warn", `${job.ref}: collect ${money(job.payment_plan === "deposit" ? job.deposit_amount : job.price_final)}${job.payment_plan === "deposit" ? " deposit" : ""} before dispatch`, `${job.contact_name} · ${job.contact_phone}. Mark paid in the Handled Hub to dispatch.`, job.id);
    await sendEmail(job.contact_email, `${BRAND.name} booking ${job.ref}: complete payment`,
      `Thanks for booking ${svc.name} — ${money(job.price_final)}. A coordinator will contact you to take payment; your pro is confirmed as soon as it's paid.\n\nInvoice & service agreement: ${invoiceUrl(job.id)}\n\n${BRAND.promise}`);
  }
}

/**
 * A payment arrived (Stripe webhook, saved-card charge, or recorded by ops). Adds it to the
 * job's running total. The first payment — a deposit or the full price — books the job and
 * releases it to dispatch; the job counts as paid (paid_at) only once it's paid in full,
 * which is what lets the pro start and get paid out. Change orders raise the price first.
 */
export async function markPaid(jobId: string, p: { amount: number; via: string; kind?: string; paymentIntent?: string | null; paymentMethod?: string | null }) {
  const job = await getJob(jobId);
  if (!job) return null;
  const svc = getService(job.service_slug);
  const patch: Record<string, unknown> = {};
  let price = Number(job.price_final ?? 0);
  if (p.kind === "change_order") {
    price = Math.round((price + p.amount) * 100) / 100;
    patch.price_final = price;
    patch.estimate_low = price; patch.estimate_high = price;
    if (!Number(job.amount_refunded)) patch.contractor_payout = splitJob(price, job.service_slug).payout;
  }
  const paidNow = Math.round((Number(job.amount_paid ?? 0) + p.amount) * 100) / 100;
  const firstPayment = !job.paid_at && !job.deposit_paid_at;
  const full = price > 0 && paidNow >= price - 0.005;
  patch.amount_paid = paidNow;
  if (full && !job.paid_at) patch.paid_at = new Date().toISOString();
  if (!full && !job.deposit_paid_at) patch.deposit_paid_at = new Date().toISOString();
  if (firstPayment && ["requested", "quoted"].includes(job.status)) patch.status = job.contractor_id ? "assigned" : "scheduled";
  if (p.paymentIntent && !job.stripe_payment_intent) patch.stripe_payment_intent = p.paymentIntent;
  if (p.paymentMethod) patch.stripe_payment_method = p.paymentMethod;
  const { data } = await db().from("jobs").update(patch).eq("id", jobId).select("*").single();
  const paid = data as Job;
  const balance = Math.max(0, price - paidNow);
  const label = p.kind === "change_order" ? "Change order paid" : full ? (firstPayment ? "Paid in full" : "Balance paid — paid in full") : "Deposit received";
  await addEvent(jobId, "paid", `${label} — ${money(p.amount)}${!full ? ` · balance ${money(balance)} due ${paid.balance_due_date ?? "before the job"}` : ""}.`, p.via);
  if (firstPayment || full || p.kind === "change_order") await notify(paid.customer_id, {
    title: full ? (firstPayment ? "Paid — you're locked in" : "Paid in full ✓") : "Deposit received — date locked in",
    body: !full ? `Balance ${money(balance)} is charged to your card on ${paid.balance_due_date ?? "the day before"}.` : paid.contractor_id ? `Your ${svc?.name} is confirmed.` : `We're matching your ${svc?.name} with a vetted pro now.`,
    data: { type: "job", jobId: paid.id },
    email: { to: paid.contact_email, subject: `${label} — ${svc?.name} (${paid.ref})`,
      text: `Thanks! We received ${money(p.amount)}.${!full ? ` Your date is locked in. The balance of ${money(balance)} will be charged to the card you used on ${paid.balance_due_date ?? "the day before your job"}.` : ""} ${paid.contractor_id ? "Your pro is confirmed." : "We're matching you with a vetted pro now — you'll get a notification the moment your job is covered."}\n\nInvoice & service agreement: ${invoiceUrl(paid.id)}\nTrack it: ${siteUrl()}/account\n\n${BRAND.promise}` },
  });
  if (p.kind === "change_order" && paid.contractor_id) {
    const { data: pro } = await db().from("contractors").select("profile_id, email").eq("id", paid.contractor_id).single();
    if (pro) await notify(pro.profile_id, { title: `Extra work approved · ${paid.ref}`, body: `The customer paid ${money(p.amount)}. Go ahead — your payout is now ${money(paid.contractor_payout)}.`, data: { type: "job_pro", jobId },
      email: { to: pro.email, subject: `Extra work approved — ${paid.ref}`, text: `The customer approved and paid ${money(p.amount)} for the extra work. Go ahead.\n\nYour payout for this job is now ${money(paid.contractor_payout)}.` } });
  }
  if (firstPayment && !paid.contractor_id && (process.env.AUTO_DISPATCH ?? "true") === "true") await dispatchJob(jobId);
  return paid;
}

/** Daily: charge balances that are due to the saved card; payment link + alert if that fails. */
export async function collectBalances() {
  const today = new Date().toISOString().slice(0, 10);
  const { data } = await db().from("jobs").select("*").eq("payment_plan", "deposit").not("deposit_paid_at", "is", null).is("paid_at", null).lte("balance_due_date", today).neq("status", "cancelled");
  let charged = 0, linked = 0;
  for (const job of (data ?? []) as Job[]) {
    const due = amountDue(job, "balance");
    if (!due) continue;
    const got = await chargeSavedCard(job, due, "balance");
    if (got) { await markPaid(job.id, { amount: got, via: "saved card", kind: "balance" }); charged++; continue; }
    await sendPaymentLink(job);
    await notify(job.customer_id, { title: "Balance due", body: `Please pay ${money(due)} to keep your ${getService(job.service_slug)?.name} on schedule.`, data: { type: "job", jobId: job.id } });
    await raiseAlert("payment", "warn", `${job.ref}: balance ${money(due)} unpaid`, "Saved card failed or missing — payment link sent. The pro can't start until it's paid.", job.id);
    linked++;
  }
  return { charged, linked };
}

/** Fresh payment link (email + returned URL). */
export async function sendPaymentLink(job: Job) {
  const url = await paymentCheckoutUrl(job);
  const deposit = job.payment_plan === "deposit" && !job.deposit_paid_at && !Number(job.amount_paid);
  const amt = amountDue(job, deposit ? "deposit" : "full");
  if (url) await sendEmail(job.contact_email, `${BRAND.name}: pay ${money(amt)} ${deposit ? "deposit " : Number(job.amount_paid) ? "balance " : ""}for ${job.ref}`,
    `Your ${getService(job.service_slug)?.name}: ${deposit ? `a ${money(amt)} deposit locks in your date (balance due ${job.balance_due_date ?? "before the job"}).` : Number(job.amount_paid) ? `remaining balance ${money(amt)}.` : `${money(amt)}, paid upfront to lock in your pro.`}\n\nInvoice & service agreement: ${invoiceUrl(job.id)}\nPay securely here: ${url}\n\n${BRAND.promise}`);
  return url;
}

/** Send offers to the best pros. Deterministic ranking first, AI re-rank on top. */
export async function dispatchJob(jobId: string, opts: { siteVisit?: boolean; exclude?: string[] } = {}) {
  const job = await getJob(jobId);
  if (!job) throw new Error("Job not found");
  if (!opts.siteVisit && !job.paid_at && !job.deposit_paid_at && !job.remedy) {
    await raiseAlert("unpaid_dispatch", "info", `${job.ref} not dispatched — unpaid`, "Jobs go to pros only after payment.", job.id);
    return { offers: 0, reason: "unpaid" };
  }
  const { data: pros } = await db().from("contractors").select("*").eq("status", "approved");
  const sameDay = job.scheduled_date
    ? (await db().from("jobs").select("contractor_id").eq("scheduled_date", job.scheduled_date).not("contractor_id", "is", null)).data ?? []
    : [];
  const load: Record<string, number> = {};
  for (const r of sameDay as { contractor_id: string }[]) load[r.contractor_id] = (load[r.contractor_id] ?? 0) + 1;

  // where: job location for distance to each pro's base (ZIP centroid, cached)
  if (job.lat == null) {
    const loc = await zipCentroid(job.zip);
    if (loc) { job.lat = loc.lat; job.lng = loc.lng; await db().from("jobs").update(loc).eq("id", job.id); }
  }
  // quality: first-time QA pass rate and redo rate from each pro's scorecard
  const { data: cards } = await db().from("contractor_scorecard").select("contractor_id, jobs_completed, redos, qa_passed, qa_checked");
  const stats: Record<string, QualityStats> = {};
  for (const r of (cards ?? []) as { contractor_id: string; jobs_completed: number; redos: number; qa_passed: number; qa_checked: number }[])
    stats[r.contractor_id] = { qaPass: Number(r.qa_checked) >= 3 ? Number(r.qa_passed) / Number(r.qa_checked) : null, redoRate: Number(r.jobs_completed) >= 3 ? Number(r.redos) / Number(r.jobs_completed) : null };
  const ranked = rankContractors((pros ?? []) as Contractor[], job, load, stats).filter((c) => !opts.exclude?.includes(c.contractor.id));
  if (!ranked.length) {
    await raiseAlert("no_pros", "critical", `${job.ref}: no eligible pro`, `No approved, insured pro who works ${job.scheduled_date ?? "that day"} (${job.time_window}) within driving distance of ${job.zip} for ${job.service_slug}. Assign manually, ask a pro to take it, or recruit.`, job.id);
    return { offers: 0, reason: "no eligible pros" };
  }

  // Recurring visit or redo: the pro who did the work gets it first, alone, before anyone else.
  // They can say no (or let it lapse) — then it goes out normally. Never forced on them.
  const dibs = await firstDibs(job, opts.exclude ?? []);
  const mine = dibs ? ranked.find((c) => c.contractor.id === dibs.contractorId) : undefined;
  if (job.remedy === "redo" && !mine && !Number(job.contractor_payout)) {
    // the original pro passed on the redo — pay whoever fixes it (out of our take on the job)
    const { data: parent } = job.parent_job_id ? await db().from("jobs").select("ref, price_final, contractor_payout").eq("id", job.parent_job_id).maybeSingle() : { data: null };
    const pay = Number(parent?.contractor_payout ?? 0) || splitJob(Number(parent?.price_final ?? 0), job.service_slug).payout;
    await db().from("jobs").update({ contractor_payout: pay }).eq("id", job.id);
    job.contractor_payout = pay;
    await raiseAlert("remedy", "info", `${job.ref}: redo going to another pro`, `The original pro passed on the redo of ${parent?.ref ?? "the job"}. The new pro is paid ${money(pay)} from our take. Review the original pro's agreement (clawback) if warranted.`, job.id);
  }
  const ai = mine ? null : await aiRankCandidates(job, ranked);
  const order = mine
    ? [{ id: mine.contractor.id, score: mine.score, reason: dibs!.kind === "redo" ? "Original pro — first chance to fix" : "Recurring customer — same pro first" }]
    : ai?.ranking.length
      ? ai.ranking.map((r) => ({ id: r.contractor_id, score: r.score, reason: r.reason }))
      : ranked.map((c) => ({ id: c.contractor.id, score: c.score, reason: c.reasons.join(" · ") }));
  const count = mine ? 1 : ai?.offer_count ?? (job.priority === "normal" ? 1 : 2);
  const picks = order.slice(0, count);
  const payout = job.contractor_payout ?? 0;
  const byId = Object.fromEntries((pros ?? []).map((p: Contractor) => [p.id, p]));
  // Pro+ / Elite pros are offered a bigger payout (clamped so our take stays ≥ 15%)
  const payFor = (id: string) => (byId[id] ? tierPayout(job.price_final, payout, proTier(byId[id])) : payout);

  const hours = mine ? (dibs!.kind === "recurring" ? 24 : 12) : job.priority === "normal" ? 2 : 1;
  const expires = new Date(Date.now() + hours * 3600 * 1000).toISOString();
  const offerKind = mine ? dibs!.kind : "job";
  const { data: offerRows } = await db().from("job_offers").upsert(
    picks.map((p) => ({ job_id: job.id, contractor_id: p.id, kind: offerKind, payout: payFor(p.id), ai_score: p.score, ai_reason: p.reason, status: "offered", offered_at: new Date().toISOString(), expires_at: expires, terms_accepted_at: null, work_order_version: null })),
    { onConflict: "job_id,contractor_id" },
  ).select("id, contractor_id");
  const offerIdFor = Object.fromEntries(((offerRows ?? []) as { id: string; contractor_id: string }[]).map((o) => [o.contractor_id, o.id]));
  if (!opts.siteVisit) await db().from("jobs").update({ status: "dispatched", ai_dispatch: ai ?? { ranking: order.slice(0, 5) } }).eq("id", job.id);
  else await db().from("jobs").update({ ai_dispatch: ai ?? { ranking: order.slice(0, 5) } }).eq("id", job.id);
  await addEvent(job.id, "dispatch", mine ? `Offered to the ${dibs!.kind === "redo" ? "original" : "recurring"} pro first (${hours}h)` : `Offered to ${picks.length} pro(s)${ai ? " (AI-ranked)" : ""}`, "ai", false);

  const svc = getService(job.service_slug)!;
  for (const p of picks) {
    const pro = byId[p.id];
    const offerId = offerIdFor[p.id];
    if (!pro || !offerId) continue;
    const pay = payFor(p.id);
    const order0 = buildWorkOrder(job, { reveal: false, payout: pay });
    const lead = offerKind === "recurring" ? `Your recurring customer · ${money(pay)}` : offerKind === "redo" ? "First chance to fix a job" : `New ${opts.siteVisit ? "site visit" : "job"} · ${pay ? money(pay) : "site visit"}`;
    const why = offerKind === "recurring" ? `Offered to you first for ${hours} hours — pass and it goes to another pro.` : offerKind === "redo" ? `The customer wasn't happy; you get the first chance to make it right (no extra pay, per your agreement). Pass within ${hours} hours and another pro is sent.` : "First to accept gets it.";
    await notify(pro.profile_id, {
      title: lead,
      body: `${svc.icon} ${svc.name} · ${job.city} ${job.zip} · ${order0.when}. ${why}`,
      data: { type: "offer", offerId },
      channel: "offers",
      email: { to: pro.email, subject: offerKind === "job" ? `New ${opts.siteVisit ? "site visit" : "job"} offer: ${svc.name} · ${pay ? money(pay) : "site visit"} · ${job.zip}` : `${lead}: ${svc.name} · ${job.zip}`,
        text: `${offerKind === "job" ? "" : `${why}\n\n`}${workOrderText(order0)}\n\nACCEPT (${offerKind === "job" ? "first to accept gets it — " : ""}offer expires ${new Date(expires).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/Detroit" })} ET):\n${siteUrl()}/pro/offers/${offerId}\nor open the ${BRAND.name} Pro app.` },
    });
  }
  return { offers: picks.length, ai: Boolean(ai) };
}

/** Who gets the first offer: the recurring plan's pro, or the original pro on a redo. */
async function firstDibs(job: Job, exclude: string[]): Promise<{ contractorId: string; kind: "recurring" | "redo" } | null> {
  let id: string | null = null, kind: "recurring" | "redo" = "recurring";
  if (job.remedy === "redo" && job.parent_job_id) {
    const { data } = await db().from("jobs").select("contractor_id").eq("id", job.parent_job_id).maybeSingle();
    id = data?.contractor_id ?? null; kind = "redo";
  } else if (job.plan_id) {
    const { data } = await db().from("recurring_plans").select("preferred_contractor_id").eq("id", job.plan_id).maybeSingle();
    id = data?.preferred_contractor_id ?? null;
  }
  return id && !exclude.includes(id) ? { contractorId: id, kind } : null;
}

/** A pro accepts an offer. Race-safe: only one pro can win the job. */
export async function acceptOffer(offerId: string, contractorId: string, meta: { ip?: string | null } = {}) {
  const { data: offer } = await db().from("job_offers").select("*").eq("id", offerId).eq("contractor_id", contractorId).maybeSingle();
  if (!offer || offer.status !== "offered") return { ok: false, error: "Offer is no longer available" };
  if (new Date(offer.expires_at) < new Date()) {
    await db().from("job_offers").update({ status: "expired" }).eq("id", offerId);
    return { ok: false, error: "Offer expired" };
  }
  const { data: won } = await db()
    .from("jobs")
    .update({ contractor_id: contractorId, status: "assigned", contractor_payout: offer.payout || undefined })
    .eq("id", offer.job_id)
    .is("contractor_id", null)
    .in("status", ["dispatched", "scheduled", "site_visit", "requested"])
    .select("*")
    .maybeSingle();
  if (!won) {
    await db().from("job_offers").update({ status: "taken", responded_at: new Date().toISOString() }).eq("id", offerId);
    return { ok: false, error: "Another pro already took this job" };
  }
  const now = new Date().toISOString();
  await db().from("job_offers").update({ status: "accepted", responded_at: now, work_order_version: WORK_ORDER_VERSION, terms_accepted_at: now, accepted_ip: meta.ip ?? null }).eq("id", offerId);
  await db().from("job_offers").update({ status: "taken" }).eq("job_id", offer.job_id).eq("status", "offered");
  const { data: pro } = await db().from("contractors").select("business_name, contact_name, email, profile_id, rating").eq("id", contractorId).single();
  const job = won as Job;
  const svc = getService(job.service_slug);
  const when = `${job.scheduled_date ? new Date(`${job.scheduled_date}T12:00:00`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }) : "your visit"} · ${TIME_WINDOW_LABEL[job.time_window]}`;
  await addEvent(job.id, "assigned", `Covered: ${pro?.business_name ?? "Your pro"} (${pro?.rating ?? "5.0"}★) is confirmed for ${when}.`, "system");
  await addEvent(job.id, "terms", `Pro accepted work order v${WORK_ORDER_VERSION}`, "pro", false);
  // customer: your job is covered
  await notify(job.customer_id, {
    title: "Your job is covered ✓",
    body: `${pro?.business_name} (${pro?.rating ?? "5.0"}★) will handle your ${svc?.name} — ${when}.`,
    data: { type: "job", jobId: job.id },
    email: { to: job.contact_email, subject: `Your job is covered — ${job.ref}`, text: `Good news: ${pro?.business_name} (${pro?.rating ?? "5.0"}★, vetted & insured) will handle your ${svc?.name} on ${when}.\n\nTrack it and message your pro: ${siteUrl()}/account\nInvoice & service agreement: ${invoiceUrl(job.id)}\n\n— ${BRAND.name}` },
  });
  // pro: confirmed, here is the full work order
  if (pro) await notify(pro.profile_id, {
    title: `Job confirmed · ${job.ref}`,
    body: `${svc?.name} · ${job.address}, ${job.city} · ${when}`,
    data: { type: "job_pro", jobId: job.id },
    email: { to: pro.email, subject: `Confirmed: ${svc?.name} ${job.ref} — work order`, text: `You've got it, ${pro.contact_name?.split(" ")[0] ?? "pro"}. Full work order below.\n\n${workOrderText(buildWorkOrder(job, { reveal: true }))}\n\nOpen the job: ${siteUrl()}/pro/jobs/${job.id}` },
  });
  return { ok: true, job };
}

export async function declineOffer(offerId: string, contractorId: string) {
  const { data: offer } = await db()
    .from("job_offers")
    .update({ status: "declined", responded_at: new Date().toISOString() })
    .eq("id", offerId)
    .eq("contractor_id", contractorId)
    .eq("status", "offered")
    .select("job_id")
    .maybeSingle();
  if (!offer) return { ok: false };
  const { count } = await db().from("job_offers").select("id", { count: "exact", head: true }).eq("job_id", offer.job_id).eq("status", "offered");
  if (!count) {
    const { data: tried } = await db().from("job_offers").select("contractor_id").eq("job_id", offer.job_id);
    await dispatchJob(offer.job_id, { exclude: (tried ?? []).map((t: { contractor_id: string }) => t.contractor_id) });
  }
  return { ok: true };
}

export async function startJob(jobId: string, contractorId: string): Promise<{ ok: boolean; error?: string }> {
  const pre = await getJob(jobId);
  if (pre && !pre.paid_at && !pre.remedy) {
    await raiseAlert("payment", "warn", `${pre.ref}: pro tried to start before the balance was paid`, null, jobId);
    return { ok: false, error: "The customer's balance isn't paid yet — don't start. We're collecting it now; you'll get a notification." };
  }
  const { data } = await db()
    .from("jobs")
    .update({ status: "in_progress", started_at: new Date().toISOString() })
    .eq("id", jobId).eq("contractor_id", contractorId).eq("status", "assigned")
    .select("id").maybeSingle();
  if (data) {
    await addEvent(jobId, "started", "Your pro has arrived and started work.", "pro");
    const job = await getJob(jobId);
    if (job) await notify(job.customer_id, { title: "Your pro has arrived", body: `Work on your ${getService(job.service_slug)?.name} has started.`, data: { type: "job", jobId } });
  }
  return data ? { ok: true } : { ok: false, error: "Job can't be started" };
}

/** Pro marks done with photos → AI QA → complete (or hold for human review). */
export async function completeJob(jobId: string, contractorId: string, photos: string[], note: string | null) {
  const { data } = await db()
    .from("jobs")
    .update({ status: "qa_review", completion_photos: photos })
    .eq("id", jobId).eq("contractor_id", contractorId).in("status", ["assigned", "in_progress"])
    .select("*").maybeSingle();
  if (!data) return false;
  await addEvent(jobId, "submitted", "Work finished — checking completion photos.", "pro");
  if (note) await db().from("messages").insert({ job_id: jobId, sender_role: "pro", body: note });
  return true;
}

export async function runQa(jobId: string, note: string | null) {
  const job = await getJob(jobId);
  if (!job || job.status !== "qa_review") return;
  const qa = await aiQualityCheck(job, await signedUrls(job.completion_photos), note);
  await db().from("jobs").update({ ai_qa: qa }).eq("id", jobId);
  // Our side of the job rating: a draft from the photo check (staff can override it).
  if (qa && job.contractor_id)
    await db().from("ops_ratings").upsert(
      { job_id: jobId, contractor_id: job.contractor_id, rating: Math.min(5, Math.max(1, Math.round(qa.score / 20))), quality: Math.min(5, Math.max(1, Math.round(qa.score / 20))), source: "ai_qa", rated_by: "AI photo QA", comment: qa.issues.join("; ") || null },
      { onConflict: "job_id", ignoreDuplicates: true },
    );
  // Probation: a new pro's first jobs always get a human review and a call to the customer.
  const { data: pro } = job.contractor_id ? await db().from("contractors").select("jobs_completed").eq("id", job.contractor_id).maybeSingle() : { data: null };
  const probation = pro != null && Number(pro.jobs_completed) < PROBATION.jobs;
  if (qa && qa.passed && !qa.needs_human_review && !probation) {
    await finalizeJob(jobId, qa.customer_summary);
  } else if (probation && qa?.passed) {
    await raiseAlert("qa", "info", `${job.ref}: probation job — human review + customer call`, `New pro (job ${Number(pro!.jobs_completed) + 1} of ${PROBATION.jobs}). AI photo QA passed (${qa.score}). Look at the photos, call the customer, then approve.`, jobId);
  } else {
    await raiseAlert("qa", "warn", `${job.ref} needs QA review`, qa ? qa.issues.join("; ") || "AI could not verify from photos" : "No photos or AI unavailable", jobId);
  }
}

/** Close the job: payout record, pro stats, review request, next recurring visit. */
export async function finalizeJob(jobId: string, summary?: string) {
  const { data } = await db()
    .from("jobs")
    .update({ status: "completed", completed_at: new Date().toISOString() })
    .eq("id", jobId).eq("status", "qa_review").select("*").maybeSingle();
  const job = data as Job | null;
  if (!job) return;
  // Paid upfront: the customer's money is already collected, so the pro's payout is approved now.
  if (job.contractor_id && job.contractor_payout) {
    await db().from("payouts").insert({ contractor_id: job.contractor_id, job_id: job.id, amount: job.contractor_payout, status: job.paid_at || job.remedy ? "approved" : "held" });
    const { data: pro } = await db().from("contractors").select("jobs_completed").eq("id", job.contractor_id).single();
    await db().from("contractors").update({ jobs_completed: (pro?.jobs_completed ?? 0) + 1 }).eq("id", job.contractor_id);
  }
  await addEvent(job.id, "completed", summary ?? "Job complete. Thank you!", "system");
  await notify(job.customer_id, {
    title: "Done ✓ — how did we do?",
    body: `${summary ?? "Your job is complete."} Tap to see photos and rate your pro.`,
    data: { type: "job", jobId: job.id },
    email: { to: job.contact_email, subject: `Done! ${getService(job.service_slug)?.name} — ${job.ref}`,
      text: `${summary ?? "Your job is complete."}\n\nRate your pro (takes 10 seconds): ${siteUrl()}/account\n\nNot right? Reply within ${BRAND.guaranteeDays} days and we'll make it right.` },
  });
  if (job.frequency !== "once") await scheduleNextVisit(job);
}

const FREQ_DAYS = { weekly: 7, biweekly: 14, monthly: 30, quarterly: 91 } as const;

async function scheduleNextVisit(job: Job) {
  if (job.frequency === "once") return;
  const base = job.scheduled_date ? new Date(`${job.scheduled_date}T12:00:00`) : new Date();
  base.setDate(base.getDate() + FREQ_DAYS[job.frequency]);
  const next = base.toISOString().slice(0, 10);
  let planId = job.plan_id;
  if (!planId) {
    const { data: plan } = await db().from("recurring_plans").insert({
      customer_id: job.customer_id, source_job_id: job.id, service_slug: job.service_slug, frequency: job.frequency,
      price: job.price_final ?? job.estimate_low, next_date: next, preferred_contractor_id: job.contractor_id,
    }).select("id").single();
    planId = plan?.id ?? null;
  } else {
    await db().from("recurring_plans").update({ next_date: next }).eq("id", planId);
  }
  const { id: _id, ref: _ref, created_at: _c, updated_at: _u, ...rest } = job;
  const { data: nextJob } = await db().from("jobs").insert({
    ...rest, plan_id: planId, scheduled_date: next, status: "requested", completion_photos: [], ai_qa: null,
    started_at: null, completed_at: null, paid_at: null, amount_paid: 0, amount_refunded: 0, stripe_payment_intent: null,
    parent_job_id: null, remedy: null,
    // not pre-assigned: the visit is offered to the same pro first when it's paid (see dispatchJob)
    contractor_id: null, contractor_payout: splitJob(Number(job.price_final ?? job.estimate_low), job.service_slug).payout,
  }).select("*").single();
  if (!nextJob) return;
  // Paid upfront: charge the saved card now; the visit is dispatched only once paid.
  if (await chargeSavedCard(nextJob as Job)) {
    await markPaid(nextJob.id, { amount: Number(nextJob.price_final), via: "saved card" });
    await addEvent(nextJob.id, "recurring", `Next ${job.frequency} visit booked and prepaid — offered to your pro first.`);
  } else {
    await sendPaymentLink(nextJob as Job);
    await raiseAlert("payment", "warn", `${nextJob.ref}: recurring visit unpaid`, "Saved card failed or missing — payment link emailed. Not dispatched until paid.", nextJob.id);
  }
}

/** Day-before reminders (daily cron): pro gets the full work order, customer a heads-up. */
export async function sendDayBeforeReminders() {
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const { data } = await db().from("jobs").select("*").eq("scheduled_date", tomorrow).in("status", ["assigned", "dispatched", "scheduled"]);
  let sent = 0;
  for (const job of (data ?? []) as Job[]) {
    const svc = getService(job.service_slug);
    const window = TIME_WINDOW_LABEL[job.time_window];
    await notify(job.customer_id, {
      title: "Tomorrow: your pro is coming",
      body: `${svc?.name} · ${window}. Please make sure we can get access.`,
      data: { type: "job", jobId: job.id },
    });
    if (job.contractor_id) {
      const { data: pro } = await db().from("contractors").select("profile_id, email").eq("id", job.contractor_id).single();
      if (pro) await notify(pro.profile_id, {
        title: `Tomorrow · ${svc?.name} · ${job.ref}`,
        body: `${job.address}, ${job.city} · ${window}`,
        data: { type: "job_pro", jobId: job.id },
        email: { to: pro.email, subject: `Tomorrow: ${svc?.name} ${job.ref}`, text: workOrderText(buildWorkOrder(job, { reveal: true })) },
      });
    }
    sent++;
  }
  return sent;
}

export async function raiseAlert(kind: string, severity: "info" | "warn" | "critical", title: string, body: string | null, jobId?: string | null) {
  await db().from("ops_alerts").insert({ kind, severity, title, body, job_id: jobId ?? null });
  if (severity === "critical" && opsEmail()) await sendEmail(opsEmail(), `[${BRAND.name} ops] ${title}`, body ?? "");
}

export async function setStatus(jobId: string, status: JobStatus, actor: string) {
  if (status === "cancelled") {
    // refunds, fees and show-up pay are handled in one place
    const { cancelJob } = await import("./pro-benefits");
    const r = await cancelJob(jobId, "ops", actor);
    if (!r.ok) await addEvent(jobId, "status_manual", `Cancel refused: ${r.error}`, actor, false);
    return;
  }
  await db().from("jobs").update({ status }).eq("id", jobId);
  await addEvent(jobId, "status_manual", `Status set to ${JOB_STATUS_LABEL[status]}`, actor, false);
}
