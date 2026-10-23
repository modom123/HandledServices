/*
 * FILE    : apps/web/lib/materials.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-23_2200 UTC
 * PURPOSE : Materials billed at cost, server side (the rules are in packages/core/src/materials.ts):
 *             vendorList()        — the approved vendors: built-in list merged with Hub → Vendors
 *             holdMaterials()     — when the pro starts: the high end of the quote's materials estimate is held on the
 *                                   customer's card (nothing charged), and the pro's materials card points at this job
 *             settleJobMaterials() — when the job is complete: the approved receipts and card swipes are taken from the
 *                                   hold (the rest of the hold is let go), receipts the pro paid are reimbursed, and the
 *                                   card stops spending on this job; anything over the hold is billed the old way
 *             releaseMaterials()  — cancelled job: let the hold go, stop the card, flag any purchases already made
 */
import "server-only";
import { mergeVendors, money, settleMaterials, type Job, type Vendor } from "@handled/core";
import { adminClient } from "./supabase/server";
import { captureHold, holdOnSavedCard, releaseHold } from "./stripe";
import { addEvent, getJob, raiseAlert } from "./jobs";

const db = () => adminClient();
const r2 = (n: number) => Math.round(n * 100) / 100;

/** Approved vendors: the built-in list with the Hub's additions and switches (the table may not exist yet). */
export async function vendorList(): Promise<Vendor[]> {
  const { data } = await db().from("approved_vendors").select("id, name, match, groups, online, active");
  return mergeVendors((data ?? []) as Vendor[]);
}

/** Pro started: hold the materials estimate on the card and point the pro's materials card at this job. */
export async function holdMaterials(job: Job) {
  if (job.contractor_id) await db().from("contractors").update({ card_job_id: job.id }).eq("id", job.contractor_id).then(() => null, () => null);
  const high = Number(job.materials_high ?? 0);
  if (!(high > 0) || job.materials_hold_intent || job.billed_on_terms) return;
  const r = await holdOnSavedCard(job, high, "materials");
  if ("id" in r) {
    await db().from("jobs").update({ materials_hold_intent: r.id }).eq("id", job.id);
    await addEvent(job.id, "materials_hold", `Up to ${money(high)} held on your card for materials (the estimate). Only the receipts are charged; the rest is released.`, "system", true,
      `Se reservaron hasta ${money(high)} en su tarjeta para materiales (el estimado). Solo se cobran los recibos; el resto se libera.`);
    return;
  }
  // no hold: materials are billed as they're approved, the way it worked before (customer told before each charge)
  await addEvent(job.id, "materials_hold", `Couldn't hold the materials estimate on the card: ${r.error}. Materials will be billed with each receipt.`, "system", false);
}

/** Materials on this job that are approved and not paid yet (receipts and card swipes). */
async function openExpenses(jobId: string) {
  const { data } = await db().from("job_expenses").select("id, amount, source, status, created_at").eq("job_id", jobId).eq("status", "approved").order("created_at");
  return (data ?? []) as { id: string; amount: number; source: string; status: string }[];
}

/** Mark an expense paid by the customer; a receipt the pro paid for is reimbursed (card swipes were paid by our card). */
async function markExpensePaid(e: { id: string; amount: number; source: string }, paymentId: string | null) {
  if (e.source === "card") {
    await db().from("job_expenses").update({ status: "paid", payment_id: paymentId }).eq("id", e.id).eq("status", "approved");
    return;
  }
  const { reimburse } = await import("./pro-benefits");
  await reimburse(e.id, paymentId);
}

/** Job complete: charge the materials from the hold, reimburse receipts, let the rest of the hold go. */
export async function settleJobMaterials(jobId: string) {
  const job = await getJob(jobId);
  if (!job || job.materials_settled_at) return;
  if (job.contractor_id) await db().from("contractors").update({ card_job_id: null }).eq("id", job.contractor_id).eq("card_job_id", jobId).then(() => null, () => null);
  const open = await openExpenses(jobId);
  const total = r2(open.reduce((t, e) => t + Number(e.amount), 0));
  let captured = 0;
  if (job.materials_hold_intent) {
    const held = Number(job.materials_high ?? 0);
    const { capture } = settleMaterials(total, held);
    captured = capture > 0 ? await captureHold(job, job.materials_hold_intent, capture, "materials") : 0;
    // nothing to take, or a partial capture: the rest of the hold is let go by Stripe; a zero capture needs an explicit release
    if (!(captured > 0)) await releaseHold(job.materials_hold_intent);
  }
  const { data: pay } = captured > 0 ? await db().from("payments").select("id").eq("job_id", jobId).eq("kind", "materials").order("created_at", { ascending: false }).limit(1).maybeSingle() : { data: null };
  let covered = captured;
  const left: typeof open = [];
  for (const e of open) {
    if (Number(e.amount) <= covered + 0.005) { covered = r2(covered - Number(e.amount)); await markExpensePaid(e, pay?.id ?? null); }
    else left.push(e);
  }
  await db().from("jobs").update({ materials_settled_at: new Date().toISOString(), materials_hold_intent: null }).eq("id", jobId);
  if (captured > 0) await addEvent(jobId, "materials", `Materials charged at cost: ${money(captured)} (receipts on file). The rest of the hold was released.`, "system", true,
    `Materiales cobrados al costo: ${money(captured)} (recibos registrados). El resto de la reserva se liberó.`);
  else if (job.materials_hold_intent) await addEvent(jobId, "materials", "No materials were needed — the hold on your card was released.", "system", true, "No se necesitaron materiales: se liberó la reserva en su tarjeta.");
  // anything the hold didn't cover (over the estimate, or the hold failed): bill it the old way, with the customer told first
  if (left.length) {
    const { billExpense } = await import("./pro-benefits");
    for (const e of left) await billExpense(e.id, "settlement");
  }
}

/** Job cancelled: let the materials hold go and stop the card; purchases already made need a person. */
export async function releaseMaterials(job: Job) {
  if (job.materials_hold_intent) await releaseHold(job.materials_hold_intent);
  if (job.contractor_id) await db().from("contractors").update({ card_job_id: null }).eq("id", job.contractor_id).eq("card_job_id", job.id).then(() => null, () => null);
  await db().from("jobs").update({ materials_hold_intent: null }).eq("id", job.id).then(() => null, () => null);
  const open = await openExpenses(job.id);
  if (open.length) await raiseAlert("materials", "warn", `${job.ref}: cancelled with ${money(open.reduce((t, e) => t + Number(e.amount), 0))} of materials bought`,
    "Decide in the Hub: return the materials, bill the customer (late cancellation), or absorb them. Card swipes were paid with our card.", job.id);
}
