/*
 * FILE    : apps/web/lib/remedies.ts
 * PROJECT : Handled — AI-run home & business services
 * CREATED : 2026-10-01_1900 UTC
 * UPDATED : 2026-10-02_0233 UTC — a redo is an offer to the original pro, then any pro (paid from our take).
 * UPDATED : 2026-10-01_2124 UTC — Pay protection: a refund that isn't the pro's fault comes
 *           out of our take first when the pro qualifies (Hub → Pro Program).
 * UPDATED : 2026-10-02_1412 UTC — Spanish versions of customer and pro texts, emails, push and timeline.
 * UPDATED : 2026-10-03_0119 UTC — pay protection always on; a pro-at-fault refund is only a proposed deduction
 *           (notice, 3 business days, a person decides) — never taken automatically.
 * UPDATED : 2026-10-07_1610 UTC — refunds go across every card payment (refundAcross), so a deposit-plan job can be refunded past the deposit.
 * PURPOSE : Making it right after an upfront payment — never by holding money back:
 *             refund         — partial or full, back to the card. Shared with the pro in the
 *                              original split, or charged to the pro first when the pro was at
 *                              fault. A payout already sent becomes a clawback.
 *             redo           — the original pro comes back free ($0 to the customer, $0 payout).
 *             complimentary  — a free extra service; the pro is paid normally out of our take
 *                              on the original job, capped so the pair can't go negative.
 * UPDATED : 2026-10-04_1934 UTC — business accounts on terms: a refund before payment is a credit on the invoice.
 */
import "server-only";
import { BRAND, estimate, getService, serviceText, money, refundSplit, splitJob, type Answers, type Job } from "@handled/core";
import { proposeDeduction } from "./deductions";
import { adminClient } from "./supabase/server";
import { addEvent, dispatchJob, getJob, raiseAlert } from "./jobs";
import { refundAcross } from "./stripe";
import { sendEmail } from "./notify";
import { syncCatalog } from "./catalog";
import { localeOf } from "./push";

const db = () => adminClient();

/** "2026-10-05" → "lunes, 5 de octubre" (Spanish texts). */
function esDate(d: string | null | undefined) {
  if (!d || !/^\d{4}-\d{2}-\d{2}$/.test(d)) return d ?? "";
  return new Date(`${d}T12:00:00Z`).toLocaleDateString("es-US", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
}

export async function issueRefund(jobId: string, amount: number, proAtFault: boolean, actor: string, reason: string) {
  const job = await getJob(jobId);
  if (!job?.paid_at && !job?.billed_on_terms) return { ok: false, error: "Job isn't paid" };
  // Pay protection is always on: a refund that isn't the pro's fault comes out of our share (pro agreement §17).
  // When the pro may be at fault, the customer is refunded now from our share too, and the pro's part is only
  // PROPOSED — notice, 3 business days to respond, a person decides (lib/deductions).
  // business account on terms, not paid yet: a credit on the invoice instead of a card refund (our share; the pro keeps their pay)
  if (job.billed_on_terms && !job.paid_at) {
    const credit = Math.min(amount, Number(job.price_final ?? 0));
    if (credit <= 0) return { ok: false, error: "Nothing left to credit" };
    await db().from("jobs").update({ price_final: Number(job.price_final) - credit, amount_refunded: Number(job.amount_refunded) + credit }).eq("id", jobId);
    const invId = (job as typeof job & { business_invoice_id?: string | null }).business_invoice_id;
    if (invId) {
      const { data: inv } = await db().from("business_invoices").select("total, status").eq("id", invId).maybeSingle();
      if (inv?.status === "open") await db().from("business_invoices").update({ total: Math.max(0, Number(inv.total) - credit) }).eq("id", invId);
    }
    await addEvent(jobId, "refund", `Credit on your account invoice: ${money(credit)}. ${reason}`, actor, true, `Crédito en la factura de su cuenta: ${money(credit)}. ${reason}`);
    return { ok: true, refunded: credit };
  }
  const base = { paid: Number(job.amount_paid), alreadyRefunded: Number(job.amount_refunded), payout: Number(job.contractor_payout ?? 0), refund: amount };
  const protectPro = Boolean(job.contractor_id);
  const split = refundSplit({ ...base, proAtFault: false, protectPro });
  const proposed = proAtFault && job.contractor_id ? refundSplit({ ...base, proAtFault: true, protectPro: false }).fromPro : 0;
  if (split.refund <= 0) return { ok: false, error: "Nothing left to refund" };
  // across every card payment (a deposit and a balance are two payments), newest first
  const r = await refundAcross(job, split.refund, "make_it_right");
  if (r.refunded <= 0) return { ok: false, error: r.error ?? "The refund didn't go through" };
  if (r.refunded < split.refund - 0.005) await raiseAlert("refund", "critical", `Refund only partly sent — ${job.ref}`, `${money(r.refunded)} of ${money(split.refund)} went back to the card${r.error ? ` (${r.error})` : ""}. Send the rest by hand.`, jobId);

  await db().from("jobs").update({ amount_refunded: Number(job.amount_refunded) + split.refund, contractor_payout: split.newPayout }).eq("id", jobId);
  await db().from("payments").insert({ job_id: jobId, kind: "refund", amount: -split.refund, status: "paid", stripe_session_id: r.ids[0] ?? null });
  if (job.contractor_id && split.fromPro > 0) {
    const { data: payout } = await db().from("payouts").select("id, amount, status").eq("job_id", jobId).eq("kind", "job").neq("status", "clawback").maybeSingle();
    if (payout && payout.status !== "paid") await db().from("payouts").update({ amount: split.newPayout }).eq("id", payout.id);
    else if (payout) await db().from("payouts").insert({ contractor_id: job.contractor_id, job_id: jobId, amount: -split.fromPro, status: "clawback", kind: "clawback", reason });
  }
  await addEvent(jobId, "refund", `Refund issued: ${money(split.refund)}. ${reason}`, actor, true, `Reembolso emitido: ${money(split.refund)}. ${reason}`);
  if (proposed > 0 && job.contractor_id) await proposeDeduction({ contractorId: job.contractor_id, jobId, amount: proposed, reason: `Workmanship refund on ${job.ref}: ${reason}`, source: "refund",
    evidence: `${(job.completion_photos ?? []).length} completion photo(s) on the job page; refund of ${money(split.refund)} to the customer.` });
  await addEvent(jobId, "human_touch", `Refund ${money(split.refund)} (pro ${money(split.fromPro)} / us ${money(split.fromUs)})${proposed > 0 ? ` · ${money(proposed)} proposed as a pro deduction (pending their response)` : " · pay protection"}`, actor, false);
  if ((await localeOf(job.customer_id, job.locale)) === "es") await sendEmail(job.contact_email, `Reembolso emitido — ${job.ref}`, `Reembolsamos ${money(split.refund)} a su tarjeta (puede tardar de 5 a 10 días hábiles). ${reason}\n\nLamentamos que no haya quedado bien. — ${BRAND.name}`);
  else await sendEmail(job.contact_email, `Refund issued — ${job.ref}`, `We've refunded ${money(split.refund)} to your card (allow 5–10 business days). ${reason}\n\nWe're sorry it wasn't right. — ${BRAND.name}`);
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

/**
 * The original pro gets the first chance to fix it — free to the customer, no payout (pro
 * agreement). It's an offer, not an order: if they pass or don't answer in 12 hours, another
 * pro is sent and paid from our take (dispatchJob).
 */
export async function createRedo(jobId: string, date: string, actor: string, note: string) {
  const parent = await getJob(jobId);
  if (!parent) return { ok: false, error: "Job not found" };
  if (!parent.contractor_id) return { ok: false, error: "No original pro on this job — use a complimentary service or refund" };
  const redo = await childJob(parent, {
    remedy: "redo", status: "scheduled", scheduled_date: date, price_final: 0, contractor_payout: 0, estimate_low: 0, estimate_high: 0,
    contractor_id: null, notes: `REDO of ${parent.ref}: ${note}`,
  });
  await dispatchJob(redo.id);
  await addEvent(parent.id, "remedy", `Free redo scheduled for ${date} (${redo.ref}).`, actor, true, `Trabajo repetido sin costo programado para el ${esDate(date)} (${redo.ref}).`);
  await addEvent(parent.id, "human_touch", `Redo ${redo.ref}`, actor, false);
  if ((await localeOf(parent.customer_id, parent.locale)) === "es") await sendEmail(parent.contact_email, `Lo vamos a solucionar — ${parent.ref}`, `Enviaremos a un profesional de nuevo el ${esDate(date)} para rehacer el trabajo, sin costo. Su profesional original tiene la primera opción; si no puede asistir, irá otro profesional verificado. Recibirá una notificación cuando esté confirmado.\n\n— ${BRAND.name}`);
  else await sendEmail(parent.contact_email, `We'll make it right — ${parent.ref}`, `We're sending a pro back on ${date} to fix it, free of charge. Your original pro gets the first chance; if they can't make it, another vetted pro will. You'll get a notification once it's confirmed.\n\n— ${BRAND.name}`);
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
  const svcEs = serviceText("es", svc.slug, svc).name;
  await addEvent(parent.id, "remedy", `Complimentary ${svc.name} scheduled for ${date} (${job.ref}) — on us.`, actor, true, `${svcEs} de cortesía programado para el ${esDate(date)} (${job.ref}) — por nuestra cuenta.`);
  await addEvent(parent.id, "human_touch", `Complimentary ${svc.slug} ${job.ref}`, actor, false);
  if ((await localeOf(parent.customer_id, parent.locale)) === "es") await sendEmail(parent.contact_email, `Un agradecimiento de ${BRAND.name}`, `Agregamos un servicio gratuito de ${svcEs} el ${esDate(date)} — por nuestra cuenta. ${note}`);
  else await sendEmail(parent.contact_email, `A thank-you from ${BRAND.name}`, `We've added a free ${svc.name} on ${date} — on us. ${note}`);
  await dispatchJob(job.id);
  return { ok: true, ref: job.ref, payout, ourTakeLeft: ourTake - payout };
}
