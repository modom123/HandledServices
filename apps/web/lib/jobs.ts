/*
 * FILE    : apps/web/lib/jobs.ts
 * PROJECT : Handled — AI-run home & business services
 * CREATED : 2026-10-01_1723 UTC
 * PURPOSE : The job pipeline — booking → AI quote → dispatch → pro accepts → work →
 *           AI QA → completion, payout and review request. All writes use the service
 *           role; route handlers must authorize the caller before calling these.
 */
import "server-only";
import { z } from "zod";
import {
  BRAND, JOB_STATUS_LABEL, estimate, getService, isRush, money, moneyRange, rankContractors,
  type Contractor, type Job, type JobStatus,
} from "@handled/core";
import { adminClient } from "./supabase/server";
import { aiQuote } from "./ai/quote";
import { aiRankCandidates } from "./ai/dispatch";
import { aiQualityCheck } from "./ai/qa";
import { signedUrls } from "./photos";
import { opsEmail, sendEmail, siteUrl } from "./notify";
import { chargeCompletedJob } from "./stripe";

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

/** Step 1 — create the job with the deterministic estimate (fast, no AI on the request path). */
export async function createJob(input: BookingInput, customerId: string | null) {
  const svc = getService(input.service_slug)!;
  const rush = isRush(input.scheduled_date);
  const est = estimate({ slug: svc.slug, answers: input.answers, frequency: input.frequency, rush });
  const status: JobStatus = svc.siteVisit ? "site_visit" : "requested";
  const { data, error } = await db()
    .from("jobs")
    .insert({
      ...input,
      customer_id: customerId,
      status,
      estimate_low: est.low,
      estimate_high: est.high,
      price_final: svc.siteVisit ? null : est.point,
      contractor_payout: svc.siteVisit ? null : est.payout,
      priority: rush ? "high" : "normal",
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return { job: data as Job, estimate: est };
}

/** Step 2 (background) — AI quote review, customer confirmation, auto-dispatch. */
export async function afterBooking(job: Job) {
  const svc = getService(job.service_slug)!;
  const photoUrls = await signedUrls(job.photos);
  const { ai } = await aiQuote({
    slug: job.service_slug, answers: job.answers as never, frequency: job.frequency,
    notes: job.notes, photoUrls, rush: job.priority !== "normal", jobId: job.id,
  });
  let current = job;
  if (ai) {
    const patch: Partial<Job> = { ai_quote: ai, estimate_low: ai.low, estimate_high: ai.high };
    if (!svc.siteVisit) {
      patch.price_final = ai.final_price;
      patch.contractor_payout = Math.round(ai.final_price * svc.payoutShare);
    }
    if (ai.needs_site_visit && !svc.siteVisit) patch.status = "site_visit";
    const { data } = await db().from("jobs").update(patch).eq("id", job.id).select("*").single();
    current = (data as Job) ?? current;
    await addEvent(job.id, "ai_quote", `AI reviewed your details: ${ai.customer_summary}`, "ai");
    if (ai.risk_flags.length) await raiseAlert("risk", "warn", `${job.ref}: ${ai.risk_flags.join(", ")}`, ai.ops_notes, job.id);
  }

  await sendEmail(
    job.contact_email,
    `${BRAND.name} booking ${job.ref} received`,
    `Hi ${job.contact_name.split(" ")[0]},\n\nThanks for booking ${svc.name}.\n` +
      (svc.siteVisit || current.status === "site_visit"
        ? `Estimated range: ${moneyRange(current.estimate_low, current.estimate_high)}. A pro will visit to confirm a firm price before any work starts.\n`
        : `Your price: ${money(current.price_final)} per visit. We're matching you with a vetted pro now.\n`) +
      `\nTrack it any time: ${siteUrl()}/account\n\n— ${BRAND.name}`,
  );

  const auto = (process.env.AUTO_DISPATCH ?? "true") === "true";
  if (auto && current.status === "requested" && current.scheduled_date) {
    await db().from("jobs").update({ status: "scheduled" }).eq("id", job.id);
    await dispatchJob(job.id);
  } else if (current.status === "site_visit") {
    await dispatchJob(job.id, { siteVisit: true });
  }
}

/** Send offers to the best pros. Deterministic ranking first, AI re-rank on top. */
export async function dispatchJob(jobId: string, opts: { siteVisit?: boolean; exclude?: string[] } = {}) {
  const job = await getJob(jobId);
  if (!job) throw new Error("Job not found");
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
  if (job.contractor_id && job.contractor_payout) {
    await db().from("payouts").insert({ contractor_id: job.contractor_id, job_id: job.id, amount: job.contractor_payout, status: "approved" });
    const { data: pro } = await db().from("contractors").select("jobs_completed").eq("id", job.contractor_id).single();
    await db().from("contractors").update({ jobs_completed: (pro?.jobs_completed ?? 0) + 1 }).eq("id", job.contractor_id);
  }
  await chargeCompletedJob(job);
  await addEvent(job.id, "completed", summary ?? "Job complete. Thank you!", "system");
  await sendEmail(
    job.contact_email,
    `Done! ${getService(job.service_slug)?.name} — ${job.ref}`,
    `${summary ?? "Your job is complete."}\n\nTotal: ${money(job.price_final)}\nRate your pro (takes 10 seconds): ${siteUrl()}/account\n\nNot right? Reply within ${BRAND.guaranteeDays} days and we'll make it right.`,
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
    ...rest, plan_id: planId, scheduled_date: next, status: "assigned", completion_photos: [], ai_qa: null,
    started_at: null, completed_at: null,
  }).select("id, ref").single();
  if (nextJob) await addEvent(nextJob.id, "recurring", `Next ${job.frequency} visit booked with the same pro.`);
}

export async function raiseAlert(kind: string, severity: "info" | "warn" | "critical", title: string, body: string | null, jobId?: string | null) {
  await db().from("ops_alerts").insert({ kind, severity, title, body, job_id: jobId ?? null });
  if (severity === "critical" && opsEmail()) await sendEmail(opsEmail(), `[${BRAND.name} ops] ${title}`, body ?? "");
}

export async function setStatus(jobId: string, status: JobStatus, actor: string) {
  await db().from("jobs").update({ status }).eq("id", jobId);
  await addEvent(jobId, "status_manual", `Status set to ${JOB_STATUS_LABEL[status]}`, actor, false);
}
