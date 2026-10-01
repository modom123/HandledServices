/*
 * FILE    : apps/web/lib/remedies.ts
 * PROJECT : Handled — AI-run home & business services
 * CREATED : 2026-10-01_1900 UTC
 * UPDATED : 2026-10-01_2124 UTC — Pay protection: a refund that isn't the pro's fault comes
 *           out of our take first when the pro qualifies (Hub → Pro Program).
 * PURPOSE : Making it right after an upfront payment — never by holding money back:
 *             refund         — partial or full, back to the card. Shared with the pro in the
 *                              original split, or charged to the pro first when the pro was at
 *                              fault. A payout already sent becomes a clawback.
 *             redo           — the original pro comes back free ($0 to the customer, $0 payout).
 *             complimentary  — a free extra service; the pro is paid normally out of our take
 *                              on the original job, capped so the pair can't go negative.
 */
import "server-only";
import { BRAND, estimate, getService, money, qualifies, refundSplit, splitJob, type Answers, type Contractor, type Job } from "@handled/core";
import { getPolicy } from "./pro-benefits";
import { adminClient } from "./supabase/server";
import { addEvent, dispatchJob, getJob } from "./jobs";
import { refundPayment } from "./stripe";
import { sendEmail } from "./notify";
import { syncCatalog } from "./catalog";

const db = () => adminClient();

export async function issueRefund(jobId: string, amount: number, proAtFault: boolean, actor: string, reason: string) {
  const job = await getJob(jobId);
  if (!job?.paid_at) return { ok: false, error: "Job isn't paid" };
  let protectPro = false;
  if (!proAtFault && job.contractor_id) {
    const { data: pro } = await db().from("contractors").select("*").eq("id", job.contractor_id).single();
    const trade = getService(job.service_slug)?.trades.find((t) => (pro?.trades ?? []).includes(t));
    protectPro = Boolean(pro) && qualifies((await getPolicy()).payProtection, pro as Contractor, trade);
  }
  const split = refundSplit({ paid: Number(job.amount_paid), alreadyRefunded: Number(job.amount_refunded), payout: Number(job.contractor_payout ?? 0), refund: amount, proAtFault, protectPro });
  if (split.refund <= 0) return { ok: false, error: "Nothing left to refund" };
  const r = await refundPayment(job, split.refund);
  if (!r.ok) return { ok: false, error: r.error };

  await db().from("jobs").update({ amount_refunded: Number(job.amount_refunded) + split.refund, contractor_payout: split.newPayout }).eq("id", jobId);
  await db().from("payments").insert({ job_id: jobId, kind: "refund", amount: -split.refund, status: "paid", stripe_session_id: r.id ?? null });
  if (job.contractor_id && split.fromPro > 0) {
    const { data: payout } = await db().from("payouts").select("id, amount, status").eq("job_id", jobId).eq("kind", "job").neq("status", "clawback").maybeSingle();
    if (payout && payout.status !== "paid") await db().from("payouts").update({ amount: split.newPayout }).eq("id", payout.id);
    else if (payout) await db().from("payouts").insert({ contractor_id: job.contractor_id, job_id: jobId, amount: -split.fromPro, status: "clawback", kind: "clawback", reason });
  }
  await addEvent(jobId, "refund", `Refund issued: ${money(split.refund)}. ${reason}`, actor);
  await addEvent(jobId, "human_touch", `Refund ${money(split.refund)} (pro ${money(split.fromPro)} / us ${money(split.fromUs)})${protectPro ? " · pay protection" : ""}`, actor, false);
  await sendEmail(job.contact_email, `Refund issued — ${job.ref}`, `We've refunded ${money(split.refund)} to your card (allow 5–10 business days). ${reason}\n\nWe're sorry it wasn't right. — ${BRAND.name}`);
  return { ok: true, ...split };
}

async function childJob(parent: Job, patch: Partial<Job>) {
  const { id: _i, ref: _r, created_at: _c, updated_at: _u, ...rest } = parent;
  const { data, error } = await db().from("jobs").insert({
    ...rest, completion_photos: [], photos: [], ai_quote: null, ai_dispatch: null, ai_qa: null, started_at: null, completed_at: null,
    plan_id: null, frequency: "once", amount_paid: 0, amount_refunded: 0, stripe_payment_intent: null, parent_job_id: parent.id,
    paid_at: new Date().toISOString(), // nothing owed — this job is on us
    ...patch,
  }).select("*").single();
  if (error) throw new Error(error.message);
  return data as Job;
}

/** The original pro returns to fix it — free to the customer, no payout (pro agreement). */
export async function createRedo(jobId: string, date: string, actor: string, note: string) {
  const parent = await getJob(jobId);
  if (!parent) return { ok: false, error: "Job not found" };
  if (!parent.contractor_id) return { ok: false, error: "No original pro on this job — use a complimentary service or refund" };
  const redo = await childJob(parent, {
    remedy: "redo", status: "assigned", scheduled_date: date, price_final: 0, contractor_payout: 0, estimate_low: 0, estimate_high: 0,
    notes: `REDO of ${parent.ref}: ${note}`,
  });
  await addEvent(parent.id, "remedy", `Free redo scheduled for ${date} (${redo.ref}).`, actor);
  await addEvent(parent.id, "human_touch", `Redo ${redo.ref}`, actor, false);
  await sendEmail(parent.contact_email, `We'll make it right — ${parent.ref}`, `Your pro is coming back on ${date} to fix it, free of charge.\n\n— ${BRAND.name}`);
  return { ok: true, ref: redo.ref };
}

/** A free extra service. The pro is paid normally; the cost comes out of our take on the original job. */
export async function createComplimentary(jobId: string, serviceSlug: string, answers: Answers | undefined, date: string, actor: string, note: string) {
  const parent = await getJob(jobId);
  const svc = getService(serviceSlug);
  if (!parent || !svc) return { ok: false, error: "Job or service not found" };
  await syncCatalog();
  const e = estimate({ slug: svc.slug, answers: { ...Object.fromEntries(svc.questions.map((q) => [q.id, q.default])), ...(answers ?? {}) } });
  const payout = splitJob(e.point, svc.slug).payout;
  const { data: siblings } = await db().from("jobs").select("contractor_payout").eq("parent_job_id", parent.id).eq("remedy", "complimentary");
  const alreadyGiven = (siblings ?? []).reduce((t: number, j: { contractor_payout: number | null }) => t + Number(j.contractor_payout ?? 0), 0);
  const ourTake = Number(parent.amount_paid) - Number(parent.amount_refunded) - Number(parent.contractor_payout ?? 0) - alreadyGiven;
  if (payout > ourTake) return { ok: false, error: `A free ${svc.name} costs ${money(payout)} in payout but our remaining take on ${parent.ref} is ${money(ourTake)}. Offer a partial refund or a smaller add-on.` };
  const job = await childJob(parent, {
    remedy: "complimentary", service_slug: svc.slug, answers: e.items.length ? (answers ?? {}) : {}, status: "scheduled", scheduled_date: date,
    price_final: 0, contractor_payout: payout, estimate_low: 0, estimate_high: 0, contractor_id: null,
    notes: `COMPLIMENTARY (from ${parent.ref}): ${note}`,
  });
  await addEvent(parent.id, "remedy", `Complimentary ${svc.name} scheduled for ${date} (${job.ref}) — on us.`, actor);
  await addEvent(parent.id, "human_touch", `Complimentary ${svc.slug} ${job.ref}`, actor, false);
  await sendEmail(parent.contact_email, `A thank-you from ${BRAND.name}`, `We've added a free ${svc.name} on ${date} — on us. ${note}`);
  await dispatchJob(job.id);
  return { ok: true, ref: job.ref, payout, ourTakeLeft: ourTake - payout };
}
