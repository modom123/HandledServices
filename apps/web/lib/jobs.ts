/*
 * FILE    : apps/web/lib/jobs.ts
 * PROJECT : Handled — AI-run home & business services
 * CREATED : 2026-10-01_1723 UTC
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
  BRAND, JOB_STATUS_LABEL, SERVICE_AGREEMENT_VERSION, estimate, getService, isRush, money, moneyRange, rankContractors, splitJob,
  type Contractor, type Job, type JobStatus,
} from "@handled/core";
import { adminClient } from "./supabase/server";
import { aiQuote } from "./ai/quote";
import { aiRankCandidates } from "./ai/dispatch";
import { aiQualityCheck } from "./ai/qa";
import { signedUrls } from "./photos";
import { opsEmail, sendEmail, siteUrl } from "./notify";
import { chargeSavedCard, paymentCheckoutUrl } from "./stripe";
import { invoiceUrl } from "./invoice";
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
export async function createJob({ accept_terms: _accepted, ...input }: BookingInput, customerId: string | null, ip: string | null = null) {
  const svc = getService(input.service_slug)!;
  await syncCatalog(); // new services in code must exist in the DB before a job can reference them
  const rush = isRush(input.scheduled_date);
  const est = estimate({ slug: svc.slug, answers: input.answers, frequency: input.frequency, rush });
  const { ai } = svc.siteVisit
    ? { ai: null }
    : await aiQuote({ slug: svc.slug, answers: input.answers, frequency: input.frequency, notes: input.notes, photoUrls: await signedUrls(input.photos), rush });
  const siteVisit = svc.siteVisit || Boolean(ai?.needs_site_visit);
  const price = siteVisit ? null : ai?.final_price ?? est.point;
  const { data, error } = await db()
    .from("jobs")
    .insert({
      ...input,
      customer_id: customerId,
      status: (siteVisit ? "site_visit" : "requested") satisfies JobStatus,
      estimate_low: ai?.low ?? est.low,
      estimate_high: ai?.high ?? est.high,
      price_final: price,
      contractor_payout: price ? splitJob(price, svc.slug).payout : null,
      ai_quote: ai,
      priority: rush ? "high" : "normal",
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
    await raiseAlert("payment", "warn", `${job.ref}: collect ${money(job.price_final)} before dispatch`, `${job.contact_name} · ${job.contact_phone}. Mark paid in the Handled Hub to dispatch.`, job.id);
    await sendEmail(job.contact_email, `${BRAND.name} booking ${job.ref}: complete payment`,
      `Thanks for booking ${svc.name} — ${money(job.price_final)}. A coordinator will contact you to take payment; your pro is confirmed as soon as it's paid.\n\nInvoice & service agreement: ${invoiceUrl(job.id)}\n\n${BRAND.promise}`);
  }
}

/**
 * Payment received (Stripe webhook, saved-card charge, or marked paid by ops).
 * This is the ONLY door to dispatch for paid work.
 */
export async function markPaid(jobId: string, p: { amount: number; via: string; paymentIntent?: string | null; paymentMethod?: string | null }) {
  const job = await getJob(jobId);
  if (!job || job.paid_at) return job;
  const next: JobStatus = job.contractor_id ? "assigned" : "scheduled";
  const { data } = await db().from("jobs").update({
    paid_at: new Date().toISOString(), amount_paid: p.amount, status: ["requested", "quoted"].includes(job.status) ? next : job.status,
    ...(p.paymentIntent ? { stripe_payment_intent: p.paymentIntent } : {}),
    ...(p.paymentMethod ? { stripe_payment_method: p.paymentMethod } : {}),
  }).eq("id", jobId).is("paid_at", null).select("*").single();
  const paid = data as Job;
  await addEvent(jobId, "paid", `Payment received — ${money(p.amount)}. ${BRAND.promise}`, p.via);
  await sendEmail(paid.contact_email, `Paid — your ${getService(paid.service_slug)?.name} is locked in (${paid.ref})`,
    `Thanks! We received ${money(p.amount)}. ${paid.contractor_id ? "Your pro is confirmed." : "We're matching you with a vetted pro now."}\n\nPaid invoice & service agreement: ${invoiceUrl(paid.id)}\nTrack it: ${siteUrl()}/account\n\n${BRAND.promise}`);
  if (!paid.contractor_id && (process.env.AUTO_DISPATCH ?? "true") === "true") await dispatchJob(jobId);
  return paid;
}

/** Fresh payment link (email + returned URL). */
export async function sendPaymentLink(job: Job) {
  const url = await paymentCheckoutUrl(job);
  if (url) await sendEmail(job.contact_email, `${BRAND.name}: pay ${money(job.price_final)} to lock in ${job.ref}`,
    `Your ${getService(job.service_slug)?.name} is ready to schedule at ${money(job.price_final)}.\n\nInvoice & service agreement: ${invoiceUrl(job.id)}\nPay securely here: ${url}\n\n${BRAND.promise}`);
  return url;
}

/** Send offers to the best pros. Deterministic ranking first, AI re-rank on top. */
export async function dispatchJob(jobId: string, opts: { siteVisit?: boolean; exclude?: string[] } = {}) {
  const job = await getJob(jobId);
  if (!job) throw new Error("Job not found");
  if (!opts.siteVisit && !job.paid_at && !job.remedy) {
    await raiseAlert("unpaid_dispatch", "info", `${job.ref} not dispatched — unpaid`, "Jobs go to pros only after payment.", job.id);
    return { offers: 0, reason: "unpaid" };
  }
  const { data: pros } = await db().from("contractors").select("*").eq("status", "approved");
  const sameDay = job.scheduled_date
    ? (await db().from("jobs").select("contractor_id").eq("scheduled_date", job.scheduled_date).not("contractor_id", "is", null)).data ?? []
    : [];
  const load: Record<string, number> = {};
  for (const r of sameDay as { contractor_id: string }[]) load[r.contractor_id] = (load[r.contractor_id] ?? 0) + 1;

  const ranked = rankContractors((pros ?? []) as Contractor[], job, load).filter((c) => !opts.exclude?.includes(c.contractor.id));
  if (!ranked.length) {
    await raiseAlert("no_pros", "critical", `${job.ref}: no eligible pro`, `No approved, insured pro serves ${job.zip} for ${job.service_slug}. Recruit or assign manually.`, job.id);
    return { offers: 0, reason: "no eligible pros" };
  }

  const ai = await aiRankCandidates(job, ranked);
  const order = ai?.ranking.length
    ? ai.ranking.map((r) => ({ id: r.contractor_id, score: r.score, reason: r.reason }))
    : ranked.map((c) => ({ id: c.contractor.id, score: c.score, reason: c.reasons.join(" · ") }));
  const count = ai?.offer_count ?? (job.priority === "normal" ? 1 : 2);
  const picks = order.slice(0, count);
  const payout = job.contractor_payout ?? 0;

  await db().from("job_offers").upsert(
    picks.map((p) => ({ job_id: job.id, contractor_id: p.id, payout, ai_score: p.score, ai_reason: p.reason, status: "offered" })),
    { onConflict: "job_id,contractor_id" },
  );
  if (!opts.siteVisit) await db().from("jobs").update({ status: "dispatched", ai_dispatch: ai ?? { ranking: order.slice(0, 5) } }).eq("id", job.id);
  else await db().from("jobs").update({ ai_dispatch: ai ?? { ranking: order.slice(0, 5) } }).eq("id", job.id);
  await addEvent(job.id, "dispatch", `Offered to ${picks.length} pro(s)${ai ? " (AI-ranked)" : ""}`, "ai", false);

  const byId = Object.fromEntries((pros ?? []).map((p: Contractor) => [p.id, p]));
  const svc = getService(job.service_slug)!;
  for (const p of picks) {
    const pro = byId[p.id];
    if (pro)
      await sendEmail(
        pro.email,
        `New ${opts.siteVisit ? "site visit" : "job"} offer: ${svc.name} in ${job.zip}`,
        `${opts.siteVisit ? "Site visit" : "Job"} ${job.ref} — ${svc.name}\n${job.city}, ${job.zip} · ${job.scheduled_date ?? "date TBD"} (${job.time_window})\n` +
          (payout ? `Your payout: ${money(payout)}\n` : "") +
          `\nAccept in the pro app or at ${siteUrl()}/pro — first to accept gets it.`,
      );
  }
  return { offers: picks.length, ai: Boolean(ai) };
}

/** A pro accepts an offer. Race-safe: only one pro can win the job. */
export async function acceptOffer(offerId: string, contractorId: string) {
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
    await db().from("job_offers").update({ status: "expired", responded_at: new Date().toISOString() }).eq("id", offerId);
    return { ok: false, error: "Another pro already took this job" };
  }
  const now = new Date().toISOString();
  await db().from("job_offers").update({ status: "accepted", responded_at: now }).eq("id", offerId);
  await db().from("job_offers").update({ status: "expired" }).eq("job_id", offer.job_id).eq("status", "offered");
  const { data: pro } = await db().from("contractors").select("business_name").eq("id", contractorId).single();
  const job = won as Job;
  await addEvent(job.id, "assigned", `${pro?.business_name ?? "Your pro"} is confirmed for ${job.scheduled_date ?? "your visit"}.`, "system");
  await sendEmail(job.contact_email, `Your pro is confirmed — ${job.ref}`, `${pro?.business_name} will handle your ${getService(job.service_slug)?.name}.\nTrack it: ${siteUrl()}/account`);
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

export async function startJob(jobId: string, contractorId: string) {
  const { data } = await db()
    .from("jobs")
    .update({ status: "in_progress", started_at: new Date().toISOString() })
    .eq("id", jobId).eq("contractor_id", contractorId).eq("status", "assigned")
    .select("id").maybeSingle();
  if (data) await addEvent(jobId, "started", "Your pro has arrived and started work.", "pro");
  return Boolean(data);
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
  if (qa && qa.passed && !qa.needs_human_review) {
    await finalizeJob(jobId, qa.customer_summary);
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
  await sendEmail(
    job.contact_email,
    `Done! ${getService(job.service_slug)?.name} — ${job.ref}`,
    `${summary ?? "Your job is complete."}\n\nRate your pro (takes 10 seconds): ${siteUrl()}/account\n\nNot right? Reply within ${BRAND.guaranteeDays} days and we'll make it right.`,
  );
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
  }).select("*").single();
  if (!nextJob) return;
  // Paid upfront: charge the saved card now; the visit is dispatched only once paid.
  if (await chargeSavedCard(nextJob as Job)) {
    await markPaid(nextJob.id, { amount: Number(nextJob.price_final), via: "saved card" });
    await addEvent(nextJob.id, "recurring", `Next ${job.frequency} visit booked and prepaid with the same pro.`);
  } else {
    await sendPaymentLink(nextJob as Job);
    await raiseAlert("payment", "warn", `${nextJob.ref}: recurring visit unpaid`, "Saved card failed or missing — payment link emailed. Not dispatched until paid.", nextJob.id);
  }
}

export async function raiseAlert(kind: string, severity: "info" | "warn" | "critical", title: string, body: string | null, jobId?: string | null) {
  await db().from("ops_alerts").insert({ kind, severity, title, body, job_id: jobId ?? null });
  if (severity === "critical" && opsEmail()) await sendEmail(opsEmail(), `[${BRAND.name} ops] ${title}`, body ?? "");
}

export async function setStatus(jobId: string, status: JobStatus, actor: string) {
  await db().from("jobs").update({ status }).eq("id", jobId);
  await addEvent(jobId, "status_manual", `Status set to ${JOB_STATUS_LABEL[status]}`, actor, false);
}
