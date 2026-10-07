/*
 * FILE    : apps/web/lib/disputes.ts
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-02_0316 UTC
 * UPDATED : 2026-10-03_0119 UTC — lost chargebacks follow the pro agreement (§18).
 * PURPOSE : Card chargebacks. When a customer disputes a charge with their bank:
 *             • the dispute is recorded and the job is flagged
 *             • the pro's payout for that job is held if it hasn't gone out yet
 *             • ops get a critical alert listing the evidence we already have (signed service
 *               agreement + IP, before/after photos, AI QA result, messages) and the deadline
 *           Closed as won → held payouts are released; lost → released unless the reason is about
 *           the work ("not received"/"unacceptable"), then a proposed deduction (notice, response, a person decides).
 * UPDATED : 2026-10-07_1610 UTC — duplicate "created"/"closed" deliveries are ignored (no second deduction or alert); a lost
 *           dispute adds its amount to the job's amount_refunded.
 */
import "server-only";
import type Stripe from "stripe";
import { chargebackFromWork, money } from "@handled/core";
import { proposeDeduction } from "./deductions";
import { adminClient } from "./supabase/server";
import { addEvent, raiseAlert } from "./jobs";
import { siteUrl } from "./notify";

const db = () => adminClient();

async function jobForPaymentIntent(pi: string | null) {
  if (!pi) return null;
  const { data: j } = await db().from("jobs").select("id, ref, contractor_id, terms_accepted_at, terms_accepted_ip, photos, completion_photos, ai_qa, status, contractor_payout").eq("stripe_payment_intent", pi).maybeSingle();
  if (j) return j;
  const { data: pay } = await db().from("payments").select("job_id").eq("stripe_session_id", pi).maybeSingle();
  if (!pay?.job_id) return null;
  return (await db().from("jobs").select("id, ref, contractor_id, terms_accepted_at, terms_accepted_ip, photos, completion_photos, ai_qa, status, contractor_payout").eq("id", pay.job_id).maybeSingle()).data;
}

export async function handleDispute(d: Stripe.Dispute, type: string) {
  const pi = typeof d.payment_intent === "string" ? d.payment_intent : d.payment_intent?.id ?? null;
  const job = await jobForPaymentIntent(pi);
  const amount = d.amount / 100;
  const closed = type === "charge.dispute.closed";
  // Stripe can deliver the same event more than once: act on "created" and "closed" only the first time
  const { data: before } = await db().from("payment_disputes").select("id, closed_at").eq("stripe_dispute_id", d.id).maybeSingle();
  const firstOpen = !before && !closed; // the first event we see for this dispute (created, or updated if it arrives first)
  const firstClose = closed && !before?.closed_at;
  await db().from("payment_disputes").upsert({
    stripe_dispute_id: d.id, payment_intent: pi, job_id: job?.id ?? null, amount, reason: d.reason, status: d.status,
    evidence_due_by: d.evidence_details?.due_by ? new Date(d.evidence_details.due_by * 1000).toISOString() : null,
    ...(closed ? { closed_at: new Date().toISOString() } : {}),
  }, { onConflict: "stripe_dispute_id" });

  if (firstOpen) {
    let held = 0;
    if (job) {
      await db().from("jobs").update({ disputed_at: new Date().toISOString() }).eq("id", job.id);
      const { data } = await db().from("payouts").update({ status: "held", reason: `Chargeback ${d.id}` }).eq("job_id", job.id).in("status", ["pending", "approved"]).select("id");
      held = data?.length ?? 0;
      await addEvent(job.id, "dispute", `Card dispute opened (${d.reason}) for ${money(amount)}. ${held ? `${held} payout(s) held.` : "Payout already sent."}`, "stripe", false);
    }
    const evidence = job ? [
      job.terms_accepted_at ? `✓ Service agreement accepted ${job.terms_accepted_at.slice(0, 16)} from IP ${job.terms_accepted_ip ?? "?"}` : "✗ No agreement acceptance on file",
      `${(job.photos ?? []).length} customer photo(s), ${(job.completion_photos ?? []).length} completion photo(s)`,
      job.ai_qa ? `AI photo QA: ${(job.ai_qa as { passed?: boolean; score?: number }).passed ? "passed" : "not passed"} (${(job.ai_qa as { score?: number }).score ?? "?"})` : "No AI QA result",
      `Job status: ${job.status}`,
    ].join("\n") : "Couldn't match this charge to a job — check Stripe.";
    const due = d.evidence_details?.due_by ? new Date(d.evidence_details.due_by * 1000).toISOString().slice(0, 10) : "see Stripe";
    await raiseAlert("dispute", "critical", `Chargeback ${money(amount)}${job ? ` on ${job.ref}` : ""} — respond by ${due}`,
      `Reason: ${d.reason}. ${held ? `Pro payout held (${held}).` : job?.contractor_id ? "Pro was already paid — consider a clawback if we lose." : ""}\n\nEvidence we have:\n${evidence}\n\nRespond in Stripe → Disputes. Invoice & signed agreement: ${job ? `${siteUrl()}/invoice/${job.id}` : "—"}`, job?.id ?? null);
  }

  if (firstClose && job) {
    // a lost dispute is money returned to the customer: count it like a refund (partner commissions, points, reports)
    if (d.status === "lost") {
      const { data: j } = await db().from("jobs").select("amount_refunded").eq("id", job.id).single();
      await db().from("jobs").update({ amount_refunded: Math.round((Number(j?.amount_refunded ?? 0) + amount) * 100) / 100 }).eq("id", job.id);
    }
    if (d.status === "won") {
      await db().from("payouts").update({ status: "approved", reason: null }).eq("job_id", job.id).eq("status", "held").eq("reason", `Chargeback ${d.id}`);
      await addEvent(job.id, "dispute", `Card dispute won — held payout released.`, "stripe", false);
      await raiseAlert("dispute", "info", `Chargeback won on ${job.ref}`, "Held payout released.", job.id);
    } else if (!chargebackFromWork(d.reason) || !job.contractor_id) {
      // fraud, "unrecognized", duplicate, credit not processed… — not about the pro's work: their pay is released
      await db().from("payouts").update({ status: "approved", reason: null }).eq("job_id", job.id).eq("status", "held").eq("reason", `Chargeback ${d.id}`);
      await addEvent(job.id, "dispute", `Card dispute closed: ${d.status} (${d.reason}) — not about the work, held payout released.`, "stripe", false);
      await raiseAlert("dispute", "warn", `Chargeback ${d.status} on ${job.ref} — ${money(amount)}`, `Reason "${d.reason}" isn't about the pro's work, so their payout was released (pro agreement §18). The loss stays with us.`, job.id);
    } else {
      // possibly about the work: the payout stays held only while the pro is asked for their side
      const payout = Number(job.contractor_payout ?? 0);
      await proposeDeduction({ contractorId: job.contractor_id, jobId: job.id, amount: Math.min(amount, payout), reason: `Card dispute lost on ${job.ref} — the customer said the work was ${d.reason === "product_not_received" ? "not done" : "not acceptable"}`, source: "chargeback",
        evidence: `Dispute ${d.id}, ${money(amount)}, reason ${d.reason}. Completion photos and messages are on the job page.` });
      await addEvent(job.id, "dispute", `Card dispute closed: ${d.status} (${d.reason}). Pro asked for their side before any deduction.`, "stripe", false);
    }
  }
}
