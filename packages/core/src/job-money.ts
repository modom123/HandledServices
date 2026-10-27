/*
 * FILE    : packages/core/src/job-money.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-27_2100 UTC
 * PURPOSE : One job's money from end to end, for the Hub only (customers never see what the pro earns):
 *             customer paid (net of refunds) → the split (pro pay / what Handled keeps / est. card fee) → the pro's payout
 *             lines for the job (job pay, show-up, materials, clawbacks…; tips pass through 100% and are kept apart) →
 *             where the pro's money stands (not created yet / held / pending / approved for Monday / paid) → anything
 *             that doesn't add up (finished but no payout, payout ≠ the agreed pro pay, unpaid by the customer…).
 *           Pure functions, no I/O. Used by Hub → Money → Jobs & payouts and the job page's Money card.
 */
import { CARD_FEE } from "./pricing.ts";

export interface MoneyJob {
  status: string; price_final?: number | null; contractor_payout?: number | null; amount_paid?: number | null; amount_refunded?: number | null;
  tip_total?: number | null; paid_at?: string | null; remedy?: string | null; billed_on_terms?: boolean | null;
}
export interface MoneyLine { amount: number; status: string; kind?: string | null; paid_at?: string | null; week_of?: string | null }
export type PayoutStage = "none" | "not_created" | "held" | "pending" | "approved" | "paid" | "partly_paid";
export const PAYOUT_STAGE_LABEL: Record<PayoutStage, string> = {
  none: "No pro pay", not_created: "Not created yet", held: "Held", pending: "Pending", approved: "Owed — next Monday", paid: "Paid", partly_paid: "Partly paid",
};

const r2 = (n: number) => Math.round(n * 100) / 100;

/** The Monday on or after `d` (the weekly payout run), as YYYY-MM-DD. */
export function nextMonday(d = new Date()): string {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  x.setUTCDate(x.getUTCDate() + ((8 - x.getUTCDay()) % 7));
  return x.toISOString().slice(0, 10);
}

export function jobMoney(job: MoneyJob, lines: MoneyLine[] = []) {
  const price = Number(job.price_final ?? 0);
  const paid = Number(job.amount_paid ?? 0);
  const refunded = Number(job.amount_refunded ?? 0);
  const customerNet = r2(paid - refunded);
  const tips = lines.filter((l) => l.kind === "tip");
  const work = lines.filter((l) => l.kind !== "tip");
  const proAgreed = Number(job.contractor_payout ?? 0);
  const proLines = r2(work.reduce((t, l) => t + Number(l.amount), 0));
  const done = job.status === "completed";
  // before payout lines exist, the agreed pro pay is what the pro will get (once the job is done)
  const proPay = work.length ? proLines : job.status === "cancelled" ? 0 : proAgreed;
  const cardFee = paid > 0 ? r2(paid * CARD_FEE.pct + CARD_FEE.fixed) : 0;
  const keep = r2(customerNet - proPay);
  const by = (s: string) => r2(work.filter((l) => l.status === s).reduce((t, l) => t + Number(l.amount), 0));
  const owed = r2(by("approved") + by("clawback")), held = by("held"), pending = by("pending"), paidOut = by("paid");
  const open = work.filter((l) => ["approved", "held", "pending"].includes(l.status));
  const stage: PayoutStage = !proPay && !work.length ? "none"
    : !work.length ? "not_created"
    : open.some((l) => l.status === "held") ? "held"
    : open.some((l) => l.status === "pending") ? "pending"
    : open.some((l) => l.status === "approved") ? (paidOut > 0 ? "partly_paid" : "approved")
    : "paid";
  const lastPaid = work.filter((l) => l.status === "paid" && l.paid_at).map((l) => String(l.paid_at)).sort().at(-1) ?? null;
  const issues: string[] = [];
  if (done && proAgreed > 0 && !work.length) issues.push("Finished, but the pro's payout hasn't been created");
  if (done && !job.paid_at && !job.billed_on_terms && !job.remedy && price > 0) issues.push("Customer hasn't paid in full");
  const jobLine = work.find((l) => (l.kind ?? "job") === "job");
  if (jobLine && proAgreed > 0 && Math.abs(Number(jobLine.amount) - proAgreed) >= 1) issues.push(`Payout line ${Number(jobLine.amount).toFixed(2)} ≠ agreed pro pay ${proAgreed.toFixed(2)}`);
  if (customerNet > 0 && keep < 0) issues.push("We paid the pro more than the customer paid");
  if (held > 0) issues.push("Pro pay held (customer charge failed or disputed)");
  return {
    price, paid, refunded, customerNet, tips: r2(tips.reduce((t, l) => t + Number(l.amount), 0)),
    proAgreed, proPay: r2(proPay), keep, takePct: customerNet > 0 ? keep / customerNet : null, cardFee, keepAfterFees: r2(keep - cardFee),
    owed, held, pending, paidOut, stage, lastPaid, payday: stage === "approved" || stage === "partly_paid" ? nextMonday() : null, issues,
  };
}
export type JobMoney = ReturnType<typeof jobMoney>;
