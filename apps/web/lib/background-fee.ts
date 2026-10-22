/*
 * FILE    : apps/web/lib/background-fee.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-22_1200 UTC
 * PURPOSE : Background check, paid over time (Hub → Pro Program → 7; rules in packages/core/src/pro-policy.ts).
 *             startBackgroundFee()      — the first check is ordered: Handled pays Checkr; the pro's fee is recorded
 *                                         (only when the policy is on and the real package price is set)
 *             takeBackgroundInstallment() — a job's payout is approved: the repayment for this job, as its own line on
 *                                         the pro's statement (negative, netted in the weekly payout like a clawback)
 *             backgroundRefundSweep()   — daily: pros who completed enough jobs in their first days get it all back
 *           Nothing is owed without jobs: repayments only ever come out of payouts. Every balance change is a
 *           compare-and-set, so a repayment or refund can never be taken or paid twice.
 */
import "server-only";
import { BRAND, backgroundInstallment, backgroundRefund, money } from "@handled/core";
import { adminClient } from "./supabase/server";
import { getPolicy } from "./pro-benefits";
import { sendEmail, siteUrl } from "./notify";
import { raiseAlert } from "./jobs";

const db = () => adminClient();
const r2 = (n: number) => Math.round(n * 100) / 100;

/** The first background check was ordered: record what the pro will repay (null = Handled pays, as before). */
export async function startBackgroundFee(contractorId: string) {
  const bc = (await getPolicy()).backgroundCheck;
  if (!bc?.enabled || !(bc.fee > 0)) return;
  await db().from("contractors").update({ background_fee: r2(bc.fee), background_fee_repaid: 0 }).eq("id", contractorId).is("background_fee", null)
    .then(() => null, () => null); // before the migration is run: Handled pays, nothing breaks
}

/** A job's payout was approved: take this job's background-check repayment (if anything is still owed). */
export async function takeBackgroundInstallment(job: { id: string; ref: string; contractor_id: string | null; contractor_payout: number | null }) {
  if (!job.contractor_id || !(Number(job.contractor_payout) > 0)) return;
  const { data: c } = await db().from("contractors").select("background_fee, background_fee_repaid, background_fee_refunded_at").eq("id", job.contractor_id).maybeSingle().then((r) => r, () => ({ data: null }));
  if (!c || c.background_fee == null || c.background_fee_refunded_at) return;
  const fee = Number(c.background_fee), repaid = Number(c.background_fee_repaid ?? 0);
  const bc = (await getPolicy()).backgroundCheck;
  const amount = backgroundInstallment({ remaining: fee - repaid, payout: Number(job.contractor_payout), perJob: bc.perJob, maxShareOfPayout: bc.maxShareOfPayout });
  if (!(amount > 0)) return;
  const now = r2(repaid + amount);
  // compare-and-set: only if nobody else moved the balance since we read it (no double repayment)
  const { data: won } = await db().from("contractors").update({ background_fee_repaid: now }).eq("id", job.contractor_id).eq("background_fee_repaid", repaid).select("id");
  if (!won?.length) return;
  const { error } = await db().from("payouts").insert({
    contractor_id: job.contractor_id, job_id: job.id, amount: -amount, status: "clawback", kind: "background_check",
    reason: `Background check repayment — ${money(amount)} (${money(now)} of ${money(fee)} repaid${now >= fee ? ", all done" : `, ${money(r2(fee - now))} to go`})`,
  });
  if (error) { // put the balance back so the books and the statement agree
    await db().from("contractors").update({ background_fee_repaid: repaid }).eq("id", job.contractor_id).eq("background_fee_repaid", now);
    await raiseAlert("payout", "warn", `${job.ref}: background check repayment not recorded`, `${error.message} — run ADD_BACKGROUND_CHECK_OVER_TIME_2026-10-22_1200.sql.`, job.id).catch(() => {});
  }
}

/** Daily: pros who completed enough jobs within their first days get back everything they repaid (and owe nothing more). */
export async function backgroundRefundSweep(now = new Date()): Promise<number> {
  const bc = (await getPolicy()).backgroundCheck;
  if (!bc?.enabled || !(bc.refundAfterJobs > 0)) return 0;
  const { data: pros, error } = await db().from("contractors").select("id, email, contact_name, background_fee, background_fee_repaid, onboarded_at")
    .not("background_fee", "is", null).is("background_fee_refunded_at", null).not("onboarded_at", "is", null).limit(2000);
  if (error) return 0;
  let refunded = 0;
  for (const p of (pros ?? []) as { id: string; email: string; contact_name: string; background_fee: number; background_fee_repaid: number; onboarded_at: string }[]) {
    const until = new Date(new Date(p.onboarded_at).getTime() + bc.refundWithinDays * 86400000);
    const { count } = await db().from("jobs").select("id", { count: "exact", head: true }).eq("contractor_id", p.id).eq("status", "completed").is("remedy", null).lte("completed_at", until.toISOString());
    const amount = backgroundRefund({ repaid: Number(p.background_fee_repaid), jobsInWindow: count ?? 0, refundAfterJobs: bc.refundAfterJobs, alreadyRefunded: false });
    // earned it: forgive anything still owed, and pay back what was repaid (if anything) — once
    if ((count ?? 0) < bc.refundAfterJobs) continue; // not there yet (only jobs finished inside the window count)
    const { data: won } = await db().from("contractors").update({ background_fee_refunded_at: now.toISOString(), background_fee: Number(p.background_fee_repaid) }).eq("id", p.id).is("background_fee_refunded_at", null).select("id");
    if (!won?.length) continue;
    if (amount > 0) await db().from("payouts").insert({ contractor_id: p.id, amount, status: "approved", kind: "background_check", reason: `Background check refunded — ${bc.refundAfterJobs} jobs in your first ${bc.refundWithinDays} days. Thank you!` });
    refunded++;
    await sendEmail(p.email, `Your background check is on us`, `Hi ${p.contact_name.split(" ")[0]},\n\nYou completed ${bc.refundAfterJobs} jobs in your first ${bc.refundWithinDays} days, so your background check is on us${amount > 0 ? `: the ${money(amount)} you repaid comes back on your next payout` : ""}${Number(p.background_fee) > Number(p.background_fee_repaid) ? ", and nothing more is taken" : ""}.\n\nYour earnings: ${siteUrl()}/pro/earnings\n\n— ${BRAND.name}`).catch(() => {});
  }
  return refunded;
}
