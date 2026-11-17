/*
 * FILE    : apps/web/lib/pro-benefits.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-01_2124 UTC
 * UPDATED : 2026-10-02_1412 UTC — Spanish versions of customer and pro texts, emails, push and timeline.
 * PURPOSE : The six Pro Program benefits, applied under the rules set in
 *           Handled Hub → Pro Program (who qualifies, amounts):
 *             cancelJob()          — refunds, the late/lockout fee, and show-up pay to the pro
 *             cashOutNow()         — instant pay to the pro's Stripe Connect account, for a fee
 *             submitExpense() etc. — materials at cost: customer pays first, then the pro is reimbursed
 *             grantStipends()      — one-time insurance stipend after N jobs
 *             runGuarantee()       — weekly-minimum top-ups (pending staff approval, budget-capped)
 *           Pay protection lives in remedies.ts (issueRefund).
 * UPDATED : 2026-10-02_0233 UTC — the promises behind the Pro Program, automated:
 *             runWeeklyPayouts()   — Mondays: every approved balance sent free via Stripe Connect
 *             refreshProStats()    — daily: on-time rates (tiers use them) and acceptance rates (shown to the pro only)
 *             payReferralBonuses() — daily: refer-a-pro bonus once the new pro hits N jobs
 * UPDATED : 2026-10-03_0117 UTC — applied deductions take at most half of a payout run and never tips
 *           (the rest carries to the next run), per the pro agreement.
 * UPDATED : 2026-10-07_1610 UTC — payouts: only the transfer decides success (a failure after money moved is reported, never undone, so nothing is paid twice); runs check the Stripe balance first; per-attempt idempotency keys; the instant fee is sent back when the instant payout fails.
 * UPDATED : 2026-10-07_1900 UTC — arrival windows (late cancellations, show-up pay) use the job's time zone.
 * UPDATED : 2026-11-17_1700 UTC — payout fix (a pro who finished setup got "finish your payout setup"):
 *           • the pro's Stripe account is found even when it was made on their Partner page (same email) — proPayoutAccount
 *           • readiness from connectStatus (transfers capability active), not bank "payouts_enabled"; a Stripe error is
 *             never reported to the pro as "not set up" — the payout waits and staff get a critical alert to fix it
 *           • a pro who really isn't ready is told exactly what Stripe still needs, with a direct link; staff see each
 *             pro by name with the reason (not just a count)
 *           • payContractor(): one pro's payout, used by the Monday run and by Hub "Pay now" (payNow, method manual)
 *           • 2026-11-17_1900 UTC — PayPal / Venmo: pros who chose them are paid through the PayPal Payouts API (payViaPaypal),
 *             $1.50 per payout kept by Handled (rows stay gross; fee in rail_fee); statuses followed daily
 *             (syncPaypalPayouts): returned / failed pay goes back to owed and the pro is asked to fix their details
 *           • scale: the run has its own cron (/api/cron/payouts), pays 6 pros at a time within a time budget (68 pros ≈
 *             under a minute), reserves Stripe funds before each transfer, and repairs any payout cut off mid-way
 *             (marked paid, no transfer): matched to its Stripe transfer, or put back to be paid (recoverStrandedPayouts)
 * UPDATED : 2026-10-15_0300 UTC — cancelJob lets go of a "pay after" balance hold.
 * UPDATED : 2026-11-12_1900 UTC — cancelling a name-your-price board post nobody has taken keeps the $1 posting fee.
 */
import "server-only";
import {
  BRAND, LATE_CANCEL_FEE, PRO_POLICY_DEFAULTS, clawbackPlan, PRO_REFERRAL, STATS_WINDOW_DAYS, acceptanceRate, onTimeRate, referralDue, type TimeWindow, getService, serviceText, guaranteeTopUp, instantPayFee, materialsDecision, mergePolicy, money, qualifies, showUpPay, whyNot,
  type Contractor, type Job, type ProPolicy, timeZoneForZip, zonedInstant, BOARD_POST_FEE, isBoardPost } from "@handled/core";
import { adminClient } from "./supabase/server";
import { addEvent, getJob, raiseAlert } from "./jobs";
import { localeOf, notify } from "./push";
import { opsEmail, sendEmail, siteUrl } from "./notify";
import { availableBalance as platformBalance, chargeSavedCard, connectStatus, createCheckout, dueInWords, getStripe, refundAcross } from "./stripe";
import { PAYOUT_RAILS, cleanPayoutHandle, maskHandle, minPayout, paypalItemOutcome, railFee, railOf, type PayoutRail } from "@handled/core";
import { uploadDoc } from "./photos";

const db = () => adminClient();

/** "2026-10-05" → "lunes, 5 de octubre" (Spanish texts). */
function esDate(d: string | null | undefined) {
  if (!d || !/^\d{4}-\d{2}-\d{2}$/.test(d)) return d ?? "";
  return new Date(`${d}T12:00:00Z`).toLocaleDateString("es-US", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
}
const r2 = (n: number) => Math.round(n * 100) / 100;

// ─── Policy ──────────────────────────────────────────────────────────────────

export async function getPolicy(): Promise<ProPolicy> {
  const { data } = await db().from("pro_program_settings").select("settings").eq("id", 1).maybeSingle();
  return mergePolicy((data?.settings ?? {}) as never);
}

export async function savePolicy(settings: Partial<ProPolicy>, who: string) {
  const merged = mergePolicy(settings as never);
  await db().from("pro_program_settings").upsert({ id: 1, settings: merged, updated_at: new Date().toISOString(), updated_by: who });
  return merged;
}

export { PRO_POLICY_DEFAULTS };

/** Which benefits a pro gets right now, with the reason for any they don't. */
export async function benefitsFor(c: Contractor, policy?: ProPolicy) {
  const p = policy ?? (await getPolicy());
  return (Object.keys(PRO_POLICY_DEFAULTS) as (keyof ProPolicy)[]).map((k) => ({ key: k, why: whyNot(p[k], c) }));
}

// ─── 2. Cancellations, lockouts and show-up pay ──────────────────────────────

const WINDOW_START: Record<string, number> = { morning: 8, midday: 11, afternoon: 14, flexible: 8 };

/** When the arrival window starts, in the job's own time zone (Pacific in Washington, Eastern in Michigan). */
export function windowStart(job: Pick<Job, "scheduled_date" | "time_window"> & { zip?: string | null }): Date | null {
  if (!job.scheduled_date) return null;
  return zonedInstant(job.scheduled_date, WINDOW_START[job.time_window] ?? 8, timeZoneForZip(job.zip));
}

/** A customer cancelling inside 24 hours of the arrival window is a late cancellation. */
export function isLate(job: Pick<Job, "scheduled_date" | "time_window"> & { zip?: string | null }, now = new Date()) {
  const start = windowStart(job);
  return Boolean(start && start.getTime() - now.getTime() < 24 * 3600 * 1000);
}

export type CancelReason = "customer" | "late" | "lockout" | "ops" | "weather" | "pro";

/**
 * Cancel a job. Customer cancellations inside 24 hours and lockouts keep the late fee
 * (Service Agreement §4–5); everything else is refunded in full. When a fee is kept and a
 * qualifying pro was booked, the pro gets show-up pay out of that fee (never more than the fee
 * we keep after card costs, so the cancelled job never costs us money).
 */
export async function cancelJob(jobId: string, reason: CancelReason, actor: string, note = "") {
  const job = await getJob(jobId);
  if (!job) return { ok: false, error: "Job not found" };
  if (["completed", "cancelled", "qa_review"].includes(job.status)) return { ok: false, error: `Job is ${job.status}` };
  if (job.status === "in_progress" && reason !== "lockout") return { ok: false, error: "Work has started — use a refund instead" };
  await (await import("./coverage")).releaseBackups(jobId).catch(() => null);
  // "pay after": a balance held on the card when the pro started is let go (the late / lockout fee comes from what was paid)
  if (job.balance_hold_intent) await (await import("./stripe")).releaseHold(job.balance_hold_intent);
  const why: CancelReason = reason === "customer" && isLate(job) ? "late" : reason;
  const paid = r2(Number(job.amount_paid ?? 0) - Number(job.amount_refunded ?? 0));
  // a name-your-price board post nobody has taken yet: only the $1 posting fee was paid, and it isn't refunded
  const postFee = isBoardPost(job) && !job.paid_at && !job.contractor_id ? Math.min(BOARD_POST_FEE, Math.max(0, paid)) : 0;
  const fee = ["late", "lockout"].includes(why) ? Math.min(LATE_CANCEL_FEE, Math.max(0, paid)) : postFee;
  const owed = r2(paid - fee);

  let refunded = 0;
  if (owed > 0) {
    const r = await refundAcross(job, owed);
    refunded = r.refunded;
    if (r.refunded < owed) await raiseAlert("payment", "critical", `${job.ref}: refund ${money(owed - r.refunded)} by hand`, r.error ?? "Stripe couldn't refund all of it", jobId);
    if (refunded > 0) await db().from("payments").insert({ job_id: jobId, kind: "refund", amount: -refunded, status: "paid", paid_at: new Date().toISOString(), description: `Cancellation (${why})`, stripe_session_id: r.ids[0] ?? null });
  }
  await db().from("jobs").update({
    status: "cancelled", cancelled_at: new Date().toISOString(), cancel_reason: why, cancel_fee: fee,
    amount_refunded: r2(Number(job.amount_refunded ?? 0) + refunded),
  }).eq("id", jobId);
  await db().from("job_offers").update({ status: "taken" }).eq("job_id", jobId).eq("status", "offered");

  // show-up pay to the pro who was booked
  let proPay = 0;
  if (fee > 0 && job.contractor_id) {
    const policy = await getPolicy();
    const { data: pro } = await db().from("contractors").select("*").eq("id", job.contractor_id).single();
    const trade = getService(job.service_slug)?.trades.find((t) => (pro?.trades ?? []).includes(t));
    if (pro && qualifies(policy.showUpPay, pro as Contractor, trade)) {
      proPay = showUpPay(policy, Number(job.amount_paid ?? 0), fee);
      if (proPay > 0) await db().from("payouts").insert({ contractor_id: pro.id, job_id: jobId, amount: proPay, status: "approved", kind: "show_up", reason: `Show-up pay — ${why === "lockout" ? "couldn't get in" : "late cancellation"}` });
    }
  }

  const label = { customer: "Cancelled by the customer", late: "Late cancellation", lockout: "Pro couldn't get access", ops: "Cancelled by Handled", weather: "Cancelled for weather", pro: "Pro cancelled" }[why];
  const labelEs = { customer: "Cancelado por el cliente", late: "Cancelación tardía", lockout: "El profesional no pudo entrar", ops: "Cancelado por Handled", weather: "Cancelado por el clima", pro: "El profesional canceló" }[why];
  await addEvent(jobId, "cancelled", `${label}. ${refunded ? `Refunded ${money(refunded)}.` : ""}${fee ? ` ${money(fee)} fee kept.` : ""}${note ? ` ${note}` : ""}`, actor, true,
    `${labelEs}. ${refunded ? `Reembolso de ${money(refunded)}.` : ""}${fee ? ` Se retuvo un cargo de ${money(fee)}.` : ""}${note ? ` ${note}` : ""}`);
  if (proPay) await addEvent(jobId, "human_touch", `Show-up pay ${money(proPay)} to the pro`, actor, false);
  const svc = getService(job.service_slug);
  const svcEs = svc ? serviceText("es", svc.slug, svc).name : "";
  await notify(job.customer_id, {
    title: `Cancelled — ${svc?.name}`, body: refunded ? `We refunded ${money(refunded)} to your card.` : "Your booking is cancelled.",
    data: { type: "job", jobId },
    email: { to: job.contact_email, subject: `Cancelled: ${svc?.name} (${job.ref})`, text: `Your ${svc?.name} on ${job.scheduled_date ?? "the booked date"} is cancelled (${label.toLowerCase()}).${refunded ? `\n\nRefund: ${money(refunded)} to your card (5–10 business days).` : ""}${fee ? `\nFee kept: ${money(fee)} (late cancellation / no access, per the Service Agreement).` : ""}\n\nBook again any time: ${siteUrl()}/services\n\n— ${BRAND.name}` },
    locale: job.locale,
    es: {
      title: `Cancelado — ${svcEs}`, body: refunded ? `Reembolsamos ${money(refunded)} a su tarjeta.` : "Su reserva está cancelada.",
      subject: `Cancelado: ${svcEs} (${job.ref})`,
      text: `Su servicio de ${svcEs} del ${job.scheduled_date ? esDate(job.scheduled_date) : "día reservado"} está cancelado (${labelEs.toLowerCase()}).${refunded ? `\n\nReembolso: ${money(refunded)} a su tarjeta (de 5 a 10 días hábiles).` : ""}${fee ? `\nCargo retenido: ${money(fee)} (cancelación tardía / sin acceso, según el Acuerdo de Servicio).` : ""}\n\nReserve de nuevo cuando quiera: ${siteUrl()}/services\n\n— ${BRAND.name}`,
    },
  });
  if (job.contractor_id) {
    const { data: pro } = await db().from("contractors").select("profile_id, email").eq("id", job.contractor_id).single();
    if (pro) await notify(pro.profile_id, {
      title: `Job cancelled · ${job.ref}`, body: proPay ? `You'll get ${money(proPay)} show-up pay on your next payout.` : `${svc?.name} on ${job.scheduled_date} is off your schedule.`,
      data: { type: "job_pro", jobId },
      email: { to: pro.email, subject: `Cancelled: ${job.ref}`, text: `${svc?.name} on ${job.scheduled_date} (${job.city}) is cancelled: ${label.toLowerCase()}.${proPay ? `\n\nShow-up pay: ${money(proPay)}, added to your next payout.` : ""}` },
      es: {
        title: `Trabajo cancelado · ${job.ref}`, body: proPay ? `Recibirá ${money(proPay)} de pago por presentarse en su próximo pago.` : `${svcEs} del ${esDate(job.scheduled_date)} ya no está en su agenda.`,
        subject: `Cancelado: ${job.ref}`,
        text: `${svcEs} del ${esDate(job.scheduled_date)} (${job.city}) está cancelado: ${labelEs.toLowerCase()}.${proPay ? `\n\nPago por presentarse: ${money(proPay)}, agregado a su próximo pago.` : ""}`,
      },
    });
  }
  return { ok: true, reason: why, refunded, fee, proPay };
}

// ─── 3. Instant pay ──────────────────────────────────────────────────────────

export async function availableBalance(contractorId: string) {
  const { data } = await db().from("payouts").select("id, amount, status, paid_at, kind, reason, deduction_id, job_id").eq("contractor_id", contractorId).or("status.eq.approved,and(status.eq.clawback,paid_at.is.null)");
  const all = (data ?? []) as { id: string; amount: number; status: string; kind: string; reason: string | null; deduction_id: string | null; job_id: string | null }[];
  const pos = all.filter((r) => r.status === "approved");
  // applied deductions take at most half of this run's pay and never come out of tips (pro agreement §17)
  const plan = clawbackPlan(pos, all.filter((r) => r.status === "clawback").map((r) => ({ id: r.id, amount: Number(r.amount) })));
  const applied = new Map(plan.apply.map((x) => [x.id, x.amount]));
  const rows = [...pos, ...all.filter((r) => applied.has(r.id)).map((r) => ({ ...r, amount: -applied.get(r.id)! }))];
  return { contractorId, rows, total: r2(rows.reduce((t, r) => t + Number(r.amount), 0)), carry: plan.carry, all };
}

/**
 * Before paying out: split any deduction that only partly fits this run, so the paid row is exactly
 * the applied piece and the rest stays owed for the next run.
 */
async function prepareDeductions(b: Awaited<ReturnType<typeof availableBalance>>) {
  for (const c of b.carry) {
    const row = b.all.find((r) => r.id === c.id);
    const applied = b.rows.find((r) => r.id === c.id);
    if (!row || !applied) continue; // nothing applied this run — whole row waits
    await db().from("payouts").update({ amount: applied.amount }).eq("id", row.id);
    await db().from("payouts").insert({ contractor_id: b.contractorId, job_id: row.job_id, amount: -c.amount, status: "clawback", kind: "clawback", reason: `${row.reason ?? "Deduction"} (rest, next payout)`, deduction_id: row.deduction_id });
  }
}

/** Pay out everything approved right now (minus the instant fee) to the pro's debit card. */
export async function cashOutNow(contractorId: string) {
  const s = getStripe();
  if (!s) return { ok: false, error: "Instant pay isn't available yet" };
  const policy = await getPolicy();
  const { data: pro } = await db().from("contractors").select("*").eq("id", contractorId).single();
  if (!pro) return { ok: false, error: "Pro not found" };
  const no = whyNot(policy.instantPay, pro as Contractor);
  if (no) return { ok: false, error: `Instant pay: ${no}` };
  if (railOf(pro.payout_method) !== "stripe") return { ok: false, error: "Instant pay goes to a debit card through Stripe. You're paid by PayPal / Venmo every Monday — switch to bank deposit in Setup to use instant pay." };
  const acct = await proPayoutAccount(pro as PayoutPro);
  const cs = await connectStatus(acct);
  if (cs.state === "error") return { ok: false, error: "We couldn't reach Stripe just now — please try again in a few minutes" };
  if (cs.state !== "ready" || !cs.payoutsEnabled) return { ok: false, error: "Finish your Stripe payout setup first", needsSetup: true };
  pro.stripe_account_id = acct;
  const bal = await availableBalance(contractorId);
  const { rows, total } = bal;
  if (total < policy.instantPay.minAmount) return { ok: false, error: `Minimum cash-out is ${money(policy.instantPay.minAmount)} (you have ${money(total)})` };
  const fee = instantPayFee(policy, total);
  const net = r2(total - fee);
  const now = new Date().toISOString();
  const pos = rows.filter((r) => r.status === "approved").map((r) => r.id);
  const neg = rows.filter((r) => r.status === "clawback").map((r) => r.id);
  await prepareDeductions(bal);
  // claim the rows first so two taps can't pay twice
  const { data: claimed } = await db().from("payouts").update({ status: "paid", paid_at: now, method: "instant" }).in("id", pos).eq("status", "approved").select("id");
  if ((claimed ?? []).length !== pos.length) {
    if (claimed?.length) await db().from("payouts").update({ status: "approved", paid_at: null, method: null }).in("id", claimed.map((x: { id: string }) => x.id));
    return { ok: false, error: "Your balance just changed — try again" };
  }
  // only the transfer itself decides success: once money has moved, nothing after it may put the rows back to "approved"
  let t: { id: string };
  try {
    const funds = await platformBalance();
    if (funds !== null && funds < net) throw new Error("Instant pay is busy right now — your money is safe and goes out with Monday's payout, or try again later");
    t = await s.transfers.create({ amount: Math.round(net * 100), currency: "usd", destination: pro.stripe_account_id, description: `${BRAND.name} instant pay`, metadata: { contractor_id: contractorId } }, { idempotencyKey: `instant-${contractorId}-${now}` });
  } catch (e) {
    await db().from("payouts").update({ status: "approved", paid_at: null, method: null }).in("id", pos);
    return { ok: false, error: e instanceof Error ? e.message : "Transfer failed" };
  }
  let instant = true;
  try {
    await db().from("payouts").update({ stripe_transfer_id: t.id }).in("id", pos);
    if (pos[0]) await db().from("payouts").update({ instant_fee: fee }).eq("id", pos[0]);
    if (neg.length) await db().from("payouts").update({ paid_at: now, stripe_transfer_id: t.id }).in("id", neg);
  } catch (e) {
    await raiseAlert("payout", "warn", `Instant pay sent but not fully recorded — ${pro.business_name}`, `Transfer ${t.id}: ${e instanceof Error ? e.message : String(e)}`).catch(() => {});
  }
  try { await s.payouts.create({ amount: Math.round(net * 100), currency: "usd", method: "instant" }, { stripeAccount: pro.stripe_account_id }); } catch { instant = false; }
  if (!instant && fee > 0) {
    // the instant payout didn't happen, so the instant fee isn't owed: send it to them too
    try {
      await s.transfers.create({ amount: Math.round(fee * 100), currency: "usd", destination: pro.stripe_account_id, description: `${BRAND.name} instant pay fee returned`, metadata: { contractor_id: contractorId, kind: "instant_fee_refund" } }, { idempotencyKey: `instant-fee-back-${t.id}` });
      if (pos[0]) await db().from("payouts").update({ instant_fee: 0 }).eq("id", pos[0]);
    } catch (e) {
      await raiseAlert("payout", "warn", `Return the instant fee by hand — ${pro.business_name}`, `${money(fee)} fee kept on transfer ${t.id}, but the instant payout failed: ${e instanceof Error ? e.message : String(e)}`).catch(() => {});
    }
  }
  return { ok: true, amount: instant ? net : total, fee: instant ? fee : 0, instant, note: instant ? "On its way to your debit card — usually within 30 minutes." : "Sent to your Stripe account with no fee; it reaches your bank on Stripe's standard schedule (add a debit card in Stripe for instant)." };
}

// ─── 5. Materials at cost ─────────────────────────────────────────────────────

/** A pro submits a receipt for materials not included in the job price. */
export async function submitExpense(jobId: string, contractorId: string, amount: number, description: string, receipt: File) {
  const job = await getJob(jobId);
  if (!job || job.contractor_id !== contractorId) return { ok: false, error: "Not your job" };
  if (!["assigned", "in_progress", "qa_review", "completed"].includes(job.status)) return { ok: false, error: "Materials can be added to active or just-finished jobs" };
  const policy = await getPolicy();
  const { data: pro } = await db().from("contractors").select("*").eq("id", contractorId).single();
  const trade = getService(job.service_slug)?.trades.find((t) => (pro?.trades ?? []).includes(t));
  const no = pro ? whyNot(policy.materials, pro as Contractor, trade) : "pro not found";
  if (no) return { ok: false, error: `Materials reimbursement: ${no}. Materials for this job are included in your payout.` };
  const { data: prior } = await db().from("job_expenses").select("amount, status").eq("job_id", jobId).in("status", ["pending", "approved", "billed", "paid"]);
  const already = (prior ?? []).reduce((t: number, e: { amount: number }) => t + Number(e.amount), 0);
  const decision = materialsDecision(policy, amount, Number(job.price_final ?? 0), already, trade);
  if (decision === "over_cap") return { ok: false, error: trade && policy.materials.shoppingTrades.includes(trade) ? `Purchases over ${money(policy.materials.shoppingMax)} need the customer's OK first — call us.` : `That's more than ${Math.round(policy.materials.maxShareOfPrice * 100)}% of the job price in materials. Call us — we'll send the customer a change order first.` };
  const path = await uploadDoc(receipt, `${contractorId}/receipts/${jobId}`);
  const { data: exp } = await db().from("job_expenses").insert({ job_id: jobId, contractor_id: contractorId, amount, description, receipt_path: path }).select("id").single();
  await addEvent(jobId, "materials", `Materials submitted: ${money(amount)} — ${description}`, "pro", false);
  if (decision === "auto") return { ok: true, ...(await approveExpense(exp!.id, "auto-approved")) };
  await raiseAlert("materials", "info", `${job.ref}: approve materials ${money(amount)}`, `${description}. Over the ${money(policy.materials.autoApproveUpTo)} auto-approve limit — open the job in the Hub.`, jobId);
  return { ok: true, status: "pending" };
}

/** Approve: bill the customer at cost (saved card, else a pay link). The pro is reimbursed once paid. */
export async function approveExpense(expenseId: string, who: string) {
  const { data: e } = await db().from("job_expenses").select("*").eq("id", expenseId).single();
  if (!e || e.status !== "pending") return { status: e?.status ?? "missing" };
  const job = (await getJob(e.job_id))!;
  await db().from("job_expenses").update({ status: "approved", decided_by: who, decided_at: new Date().toISOString() }).eq("id", expenseId);
  const canCharge = Boolean(job.stripe_customer_id && job.stripe_payment_method);
  // tell the customer before the card is charged (Service Agreement §3)
  const es = (await localeOf(job.customer_id, job.locale)) === "es";
  if (canCharge && es) await sendEmail(job.contact_email, `Materiales para ${job.ref}: ${money(Number(e.amount))}`, `Su profesional necesitó materiales que no estaban incluidos en su precio: ${e.description}. Cobraremos ${money(Number(e.amount))} (al costo, sin recargo) a la tarjeta registrada. Tenemos el recibo — responda a este correo si desea una copia.\n\n— ${BRAND.name}`);
  else if (canCharge) await sendEmail(job.contact_email, `Materials for ${job.ref}: ${money(Number(e.amount))}`, `Your pro needed materials that weren't in your price: ${e.description}. We're charging ${money(Number(e.amount))} (at cost, no markup) to the card on file. The receipt is on file — reply for a copy.\n\n— ${BRAND.name}`);
  const got = canCharge ? await chargeSavedCard(job, Number(e.amount), "materials", expenseId.slice(0, 8)) : 0;
  if (got) {
    const { data: pay } = await db().from("payments").select("id").eq("job_id", job.id).eq("kind", "materials").order("created_at", { ascending: false }).limit(1).maybeSingle();
    await reimburse(expenseId, pay?.id ?? null);
    return { status: "paid" };
  }
  const link = await createCheckout({ amount: Number(e.amount), kind: "materials", job, name: `Materials — ${job.ref}`, description: `${e.description} (at cost, receipt on file)`, customerEmail: job.contact_email, customerName: job.contact_name, createdBy: who });
  await db().from("job_expenses").update({ status: "billed", payment_id: link?.paymentId ?? null }).eq("id", expenseId);
  if (link && es) await sendEmail(job.contact_email, `Materiales para ${job.ref}: ${money(Number(e.amount))}`, `Su profesional necesitó materiales que no estaban incluidos en su precio: ${e.description}. Costo: ${money(Number(e.amount))} (al costo, sin recargo).\n\nPague aquí: ${link.url}\n\n— ${BRAND.name}`);
  else if (link) await sendEmail(job.contact_email, `Materials for ${job.ref}: ${money(Number(e.amount))}`, `Your pro needed materials that weren't in your price: ${e.description}. Cost: ${money(Number(e.amount))} (at cost, no markup).\n\nPay here: ${link.url}\n\n— ${BRAND.name}`);
  else await raiseAlert("materials", "warn", `${job.ref}: collect materials ${money(Number(e.amount))}`, "Stripe isn't configured — collect by hand, then mark the expense paid.", job.id);
  return { status: "billed" };
}

/** Customer paid the materials → reimburse the pro at cost (pass-through: our take is unchanged). */
export async function reimburse(expenseId: string, paymentId: string | null) {
  const { data: e } = await db().from("job_expenses").select("*").eq("id", expenseId).single();
  if (!e || e.status === "paid") return;
  const { data: payout } = await db().from("payouts").insert({ contractor_id: e.contractor_id, job_id: e.job_id, amount: e.amount, status: "approved", kind: "materials", reason: `Materials at cost: ${e.description}` }).select("id").single();
  await db().from("job_expenses").update({ status: "paid", payment_id: paymentId ?? e.payment_id, payout_id: payout?.id ?? null }).eq("id", expenseId);
  await addEvent(e.job_id, "materials", `Materials ${money(Number(e.amount))} paid by the customer; pro reimbursed`, "system", false);
}

export async function rejectExpense(expenseId: string, who: string, why: string) {
  const { data: e } = await db().from("job_expenses").update({ status: "rejected", decided_by: who, decided_at: new Date().toISOString(), notes: why }).eq("id", expenseId).eq("status", "pending").select("*").maybeSingle();
  if (!e) return;
  const { data: pro } = await db().from("contractors").select("profile_id, email").eq("id", e.contractor_id).single();
  if (pro) await notify(pro.profile_id, { title: "Materials not approved", body: `${money(Number(e.amount))} — ${why}`, data: { type: "job_pro", jobId: e.job_id }, email: { to: pro.email, subject: "Materials receipt not approved", text: `${e.description} (${money(Number(e.amount))}) wasn't approved: ${why}` },
    es: { title: "Materiales no aprobados", body: `${money(Number(e.amount))} — ${why}`, subject: "Recibo de materiales no aprobado", text: `${e.description} (${money(Number(e.amount))}) no fue aprobado: ${why}` } });
}

// ─── 4. Insurance stipend ──────────────────────────────────────────────────────

/** Daily: grant the one-time insurance stipend to every pro who has newly qualified. */
export async function grantStipends() {
  const policy = await getPolicy();
  if (!policy.insurance.enabled || !(policy.insurance.stipend > 0)) return 0;
  const { data } = await db().from("contractors").select("*").eq("status", "approved").is("insurance_stipend_paid_at", null).gte("jobs_completed", policy.insurance.afterJobs);
  let n = 0;
  for (const c of (data ?? []) as Contractor[]) {
    if (!qualifies(policy.insurance, c)) continue;
    const { data: claimed } = await db().from("contractors").update({ insurance_stipend_paid_at: new Date().toISOString() }).eq("id", c.id).is("insurance_stipend_paid_at", null).select("id").maybeSingle();
    if (!claimed) continue;
    await db().from("payouts").insert({ contractor_id: c.id, amount: policy.insurance.stipend, status: "approved", kind: "stipend", reason: `Insurance stipend after ${policy.insurance.afterJobs} jobs` });
    await notify(c.profile_id, { title: `${money(policy.insurance.stipend)} insurance stipend`, body: "Thanks for great work — it's on your next payout.", data: { type: "earnings" }, email: { to: c.email, subject: `${money(policy.insurance.stipend)} insurance stipend`, text: `You've finished ${policy.insurance.afterJobs} jobs with ${BRAND.name}. We've added a ${money(policy.insurance.stipend)} insurance stipend to your next payout.` },
      es: { title: `Apoyo para seguro de ${money(policy.insurance.stipend)}`, body: "Gracias por su excelente trabajo — se incluirá en su próximo pago.", subject: `Apoyo para seguro de ${money(policy.insurance.stipend)}`, text: `Ha completado ${policy.insurance.afterJobs} trabajos con ${BRAND.name}. Agregamos un apoyo para seguro de ${money(policy.insurance.stipend)} a su próximo pago.` } });
    n++;
  }
  return n;
}

// ─── 6. Guaranteed weekly minimum ────────────────────────────────────────────────

/**
 * Mondays: for last week (Mon–Sun), top up qualifying pros to the weekly minimum. Each
 * top-up is created as 'pending' — staff approve it in Finance — and the week's total is
 * capped at the weekly budget (smallest top-ups first, so the most pros are covered).
 * "Available" days are days the pro didn't decline or ignore an offer.
 */
export async function runGuarantee(now = new Date()) {
  const policy = await getPolicy();
  const g = policy.guarantee;
  if (!g.enabled) return { created: 0 };
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  end.setUTCDate(end.getUTCDate() - ((end.getUTCDay() + 6) % 7)); // this Monday 00:00
  const start = new Date(end); start.setUTCDate(start.getUTCDate() - 7);
  const week = start.toISOString().slice(0, 10);
  const { data: pros } = await db().from("contractors").select("*").eq("status", "approved");
  const candidates: { c: Contractor; topUp: number }[] = [];
  for (const c of (pros ?? []) as Contractor[]) {
    if (!qualifies(g, c)) continue;
    const { data: done } = await db().from("payouts").select("id").eq("contractor_id", c.id).eq("kind", "guarantee").eq("reason", `Guaranteed minimum — week of ${week}`).maybeSingle();
    if (done) continue;
    const [{ data: pays }, { data: offers }] = await Promise.all([
      db().from("payouts").select("amount").eq("contractor_id", c.id).eq("kind", "job").gte("created_at", start.toISOString()).lt("created_at", end.toISOString()),
      db().from("job_offers").select("status, offered_at").eq("contractor_id", c.id).gte("offered_at", start.toISOString()).lt("offered_at", end.toISOString()),
    ]);
    const list = (offers ?? []) as { status: string; offered_at: string }[];
    const turnedDown = new Set(list.filter((o) => ["declined", "expired"].includes(o.status)).map((o) => o.offered_at.slice(0, 10)));
    const topUp = guaranteeTopUp(policy, {
      earned: (pays ?? []).reduce((t: number, p: { amount: number }) => t + Number(p.amount), 0),
      offered: list.length, accepted: list.filter((o) => o.status === "accepted").length,
      daysAvailable: 7 - turnedDown.size, month: start.getUTCMonth() + 1,
    });
    if (topUp > 0) candidates.push({ c, topUp });
  }
  let budget = g.weeklyBudget, created = 0;
  const skipped: string[] = [];
  for (const { c, topUp } of candidates.sort((a, b) => a.topUp - b.topUp)) {
    if (topUp > budget) { skipped.push(c.business_name); continue; }
    budget -= topUp;
    await db().from("payouts").insert({ contractor_id: c.id, amount: topUp, status: "pending", kind: "guarantee", reason: `Guaranteed minimum — week of ${week}` });
    created++;
  }
  if (created || skipped.length) await raiseAlert("payout", "info", `Guaranteed minimum: ${created} top-up(s) to approve`, `Week of ${week}. Approve in Finance.${skipped.length ? ` Over budget, not created: ${skipped.join(", ")}.` : ""}`);
  if (skipped.length && opsEmail()) await sendEmail(opsEmail(), "Guaranteed minimum over budget", `Week of ${week}: ${skipped.join(", ")} qualified but the weekly budget (${money(g.weeklyBudget)}) ran out.`);
  return { created, skipped };
}

// ─── Weekly payout run (the free, automatic way pros get paid) ─────────────────────

/** Monday of the week containing `d` (UTC date string). */
function mondayOf(d: Date) {
  const m = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  m.setUTCDate(m.getUTCDate() - ((m.getUTCDay() + 6) % 7));
  return m.toISOString().slice(0, 10);
}

type PayoutPro = { id: string; profile_id: string | null; email: string | null; business_name: string; stripe_account_id: string | null };

/**
 * The Stripe account a pro is paid to: their own, or — when they set up payouts on the Partner page with the same email
 * — that one (then saved on the pro so it's found directly next time). Same person, same bank.
 */
export async function proPayoutAccount(pro: PayoutPro): Promise<string | null> {
  if (pro.stripe_account_id) return pro.stripe_account_id;
  if (!pro.email) return null;
  const { data } = await db().from("referral_partners").select("stripe_account_id").ilike("email", pro.email.replace(/[\\%_]/g, "\\$&")).not("stripe_account_id", "is", null).limit(1).maybeSingle();
  const acct = (data?.stripe_account_id as string | null) ?? null;
  if (acct) await db().from("contractors").update({ stripe_account_id: acct }).eq("id", pro.id);
  return acct;
}

export type PayResult =
  | { kind: "paid"; amount: number; transfer: string }
  | { kind: "nothing" }
  | { kind: "not_ready"; amount: number; why: string }
  | { kind: "error"; amount: number; why: string };

/**
 * Pay one pro their whole approved balance now (one Stripe transfer, one statement). Used by the Monday run and Hub
 * "Pay now". Only the transfer decides success; a failure after money moved is reported, never undone.
 */
export async function payContractor(id: string, o: { week: string; method: "weekly" | "manual"; funds: { left: number | null }; remind: boolean }): Promise<PayResult> {
  // select("*"): works whether or not the PayPal / Venmo columns exist yet
  const { data: pro } = await db().from("contractors").select("*").eq("id", id).single();
  if (!pro) return { kind: "error", amount: 0, why: "Pro not found" };
  const bal = await availableBalance(id);
  const { total: amount } = bal;
  if (amount <= 0) return { kind: "nothing" };
  const rail = railOf(pro.payout_method as string | null);
  if (rail !== "stripe") return payViaPaypal(pro as PaypalPro, rail, bal, o);
  const s = getStripe();
  if (!s) return { kind: "error", amount, why: "Stripe isn't configured" };
  const { rows } = bal;
  const acct = await proPayoutAccount(pro as PayoutPro);
  const cs = await connectStatus(acct);
  // our side couldn't read Stripe: never tell the pro they didn't set up — staff fix it and pay
  if (cs.state === "error") return { kind: "error", amount, why: cs.error ?? "Couldn't read the pro's Stripe account" };
  if (cs.state !== "ready") {
    const steps = dueInWords(cs.due);
    const why = !acct ? "never started Stripe payout setup" : cs.state === "not_started" ? "started Stripe setup but didn't finish it" : `Stripe needs more info${steps.length ? `: ${steps.join("; ")}` : ""}${cs.disabledReason ? ` (${cs.disabledReason})` : ""}`;
    if (o.remind) {
      const link = `${siteUrl()}/pro/onboarding#step-payout`;
      const todo = steps.length ? `\n\nWhat Stripe still needs from you:\n${steps.map((x) => `  • ${x}`).join("\n")}` : "";
      await notify(pro.profile_id, { title: `${money(amount)} is waiting for you`, body: !acct || cs.state === "not_started" ? "Connect your bank through Stripe so we can send it." : "Stripe needs a little more info before we can send it.", data: { type: "earnings" },
        email: { to: pro.email, subject: `${money(amount)} is ready — ${!acct || cs.state === "not_started" ? "connect your bank to get it" : "Stripe needs one more thing"}`,
          text: `You have ${money(amount)} approved and ready to send.${!acct ? " We don't have a bank on file for you yet." : cs.state === "not_started" ? " Your Stripe setup was started but not finished." : " Your Stripe account is set up, but Stripe has paused transfers until you finish a step."}${todo}\n\nIt takes a few minutes: ${link}\n\nAs soon as it's done, we send your money (you don't have to wait for next week). Questions? Just reply.\n\n— ${BRAND.name}` },
        es: { title: `${money(amount)} le están esperando`, body: "Conecte su banco en Stripe para que podamos enviarlo.", subject: `${money(amount)} listos — termine su configuración de pagos`, text: `Tiene ${money(amount)} aprobados. ${!acct ? "Aún no tenemos su banco." : cs.state === "not_started" ? "Su configuración en Stripe quedó sin terminar." : "Stripe necesita un dato más antes de enviar transferencias."}\n\nToma unos minutos: ${link}\n\nEn cuanto termine, le enviamos su dinero.\n\n— ${BRAND.name}` } });
    }
    return { kind: "not_ready", amount, why };
  }
  // Stripe confirms the bank: make sure the pro's checklist says so too (an old "ach" entry would show setup unfinished)
  await db().from("contractors").update({ payout_method: "stripe_connect" }).eq("id", id).neq("payout_method", "stripe_connect");
  await db().from("contractors").update({ payout_method: "stripe_connect" }).eq("id", id).is("payout_method", null);
  if (o.funds.left !== null && o.funds.left < amount) return { kind: "error", amount, why: `not enough available in Stripe yet (${money(o.funds.left)} available, ${money(amount)} needed) — card payments take ~2 days to become available` };
  // reserve the money now (no await between the check and this line), so pros paid in parallel can't overspend the balance
  if (o.funds.left !== null) o.funds.left = r2(o.funds.left - amount);
  const release = () => { if (o.funds.left !== null) o.funds.left = r2(o.funds.left + amount); };
  await prepareDeductions(bal);
  const pos = rows.filter((r) => r.status === "approved").map((r) => r.id);
  const neg = rows.filter((r) => r.status === "clawback").map((r) => r.id);
  const stamp = new Date().toISOString();
  // claim first so a parallel instant cash-out (or a second click) can't pay the same rows twice
  const { data: claimed } = await db().from("payouts").update({ status: "paid", paid_at: stamp, method: o.method, week_of: o.week }).in("id", pos).eq("status", "approved").select("id");
  if ((claimed ?? []).length !== pos.length) {
    if (claimed?.length) await db().from("payouts").update({ status: "approved", paid_at: null, method: null, week_of: null }).in("id", claimed.map((x: { id: string }) => x.id));
    release();
    return { kind: "error", amount, why: "balance changed while paying — try again" };
  }
  let t: { id: string };
  try {
    t = await s.transfers.create({ amount: Math.round(amount * 100), currency: "usd", destination: acct!, description: `${BRAND.name} ${o.method === "weekly" ? "weekly payout" : "payout"} — week of ${o.week}`, metadata: { contractor_id: id, week_of: o.week } }, { idempotencyKey: `${o.method}-${id}-${o.week}-${stamp}` });
  } catch (e) {
    // Stripe didn't answer (network / 5xx): the transfer MAY have gone through. Don't guess — leave the rows claimed;
    // recoverStrandedPayouts checks Stripe after 15 minutes and either records the transfer or re-queues the pay.
    // Re-queuing now could pay the pro twice next run.
    const err = e as { type?: string; statusCode?: number; message?: string };
    if (err?.type === "StripeConnectionError" || (err?.statusCode ?? 0) >= 500) {
      await raiseAlert("payout", "warn", `Payout outcome unknown — ${pro.business_name} ${money(amount)}`, `Stripe didn't answer (${err.message ?? "no response"}). The next payout run (or Pay now after 15 minutes) checks Stripe and records or re-queues it — never pays twice.`).catch(() => {});
      return { kind: "error", amount, why: "Stripe didn't answer — will be checked and settled automatically (never paid twice)" };
    }
    await db().from("payouts").update({ status: "approved", paid_at: null, method: null, week_of: null }).in("id", pos);
    release();
    return { kind: "error", amount, why: e instanceof Error ? e.message : "transfer failed" };
  }
  // money has moved: from here on, problems are reported, never undone (undoing would pay twice next week)
  try {
    await db().from("payouts").update({ stripe_transfer_id: t.id }).in("id", pos);
    if (neg.length) await db().from("payouts").update({ paid_at: stamp, stripe_transfer_id: t.id, week_of: o.week }).in("id", neg);
    await notify(pro.profile_id, { title: `Paid: ${money(amount)}`, body: `Your payout is on its way to your bank (${pos.length} item${pos.length === 1 ? "" : "s"}).`, data: { type: "earnings" },
      email: { to: pro.email, subject: `${BRAND.name} payout: ${money(amount)}`, text: `We sent ${money(amount)} to your Stripe account${o.method === "weekly" ? ` for the week of ${o.week}` : ""}. It reaches your bank on Stripe's standard schedule (usually 2 business days).\n\nStatement for every job: ${siteUrl()}/pro/earnings\n\n— ${BRAND.name}` },
      es: { title: `Pagado: ${money(amount)}`, body: `Su pago va en camino a su banco (${pos.length} concepto${pos.length === 1 ? "" : "s"}).`, subject: `Pago de ${BRAND.name}: ${money(amount)}`, text: `Enviamos ${money(amount)} a su cuenta de Stripe${o.method === "weekly" ? ` por la semana del ${esDate(o.week)}` : ""}. Llegará a su banco según el calendario estándar de Stripe (normalmente 2 días hábiles).\n\nDetalle de cada trabajo: ${siteUrl()}/pro/earnings\n\n— ${BRAND.name}` } });
  } catch (e) {
    await raiseAlert("payout", "warn", `Payout sent but not fully recorded — ${pro.business_name}`, `Transfer ${t.id}: ${e instanceof Error ? e.message : String(e)}`).catch(() => {});
  }
  return { kind: "paid", amount, transfer: t.id };
}

type PaypalPro = PayoutPro & { payout_handle?: string | null };

/** Payout to a pro's PayPal or Venmo (PayPal Payouts API). Same claim-before-send and never-pay-twice rules as Stripe. */
async function payViaPaypal(pro: PaypalPro, rail: Exclude<PayoutRail, "stripe">, bal: Awaited<ReturnType<typeof availableBalance>>, o: { week: string; method: "weekly" | "manual"; remind: boolean }): Promise<PayResult> {
  const { paypalConfigured, sendPaypalPayout, PaypalError } = await import("./paypal");
  const amount = bal.total;
  const name = PAYOUT_RAILS[rail].label;
  if (!paypalConfigured()) return { kind: "error", amount, why: `${name} payouts aren't connected yet (PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET missing in Vercel) — our side, the pro did nothing wrong` };
  const h = cleanPayoutHandle(rail, pro.payout_handle);
  if (!h.ok || !h.handle) {
    if (o.remind) {
      const link = `${siteUrl()}/pro/onboarding#step-payout`;
      await notify(pro.profile_id, { title: `${money(amount)} is waiting for you`, body: `Add your ${rail === "venmo" ? "Venmo phone number" : "PayPal email"} so we can send it.`, data: { type: "earnings" },
        email: { to: pro.email ?? "", subject: `${money(amount)} is ready — add your ${name} details`, text: `You have ${money(amount)} approved. You chose ${name}, but we don't have a valid ${rail === "venmo" ? "Venmo phone number" : "PayPal email"} for you. Add it (or switch to free direct deposit to your bank): ${link}\n\n— ${BRAND.name}` } });
    }
    return { kind: "not_ready", amount, why: `chose ${name} but has no valid ${rail === "venmo" ? "Venmo phone" : "PayPal email"}` };
  }
  if (amount < minPayout(rail)) return { kind: "nothing" }; // smaller than the fee + $1: waits for the next run
  const fee = railFee(rail, amount);
  const net = r2(amount - fee);
  await prepareDeductions(bal);
  const pos = bal.rows.filter((r) => r.status === "approved").map((r) => r.id);
  const neg = bal.rows.filter((r) => r.status === "clawback").map((r) => r.id);
  const stamp = new Date().toISOString();
  const senderBatchId = `handled-${pro.id.slice(0, 8)}-${o.week}-${Date.parse(stamp)}`;
  // claim first (also records which batch id we're about to use, so an interrupted send can be traced in PayPal)
  const { data: claimed, error: claimErr } = await db().from("payouts").update({ status: "paid", paid_at: stamp, method: o.method, week_of: o.week, rail, rail_ref: senderBatchId, rail_status: "SENDING" }).in("id", pos).eq("status", "approved").select("id");
  if (claimErr && /rail/i.test(claimErr.message)) return { kind: "error", amount, why: "Run supabase/setup/RUN_ONCE_PAYPAL_VENMO_PAYOUTS_2026-11-17_1900.sql first" };
  const undo = () => db().from("payouts").update({ status: "approved", paid_at: null, method: null, week_of: null, rail: null, rail_ref: null, rail_status: null, rail_fee: 0 }).in("id", pos);
  if ((claimed ?? []).length !== pos.length) {
    if (claimed?.length) await db().from("payouts").update({ status: "approved", paid_at: null, method: null, week_of: null, rail: null, rail_ref: null, rail_status: null }).in("id", claimed.map((x: { id: string }) => x.id));
    return { kind: "error", amount, why: "balance changed while paying — try again" };
  }
  let sent: { batchId: string; itemId: string | null; status: string };
  try {
    sent = await sendPaypalPayout({ rail, handle: h.handle, amount: net, senderBatchId, subject: `${BRAND.name} payout: ${money(net)}`,
      note: `${BRAND.name} payout${o.method === "weekly" ? ` for the week of ${o.week}` : ""}: ${money(amount)} earned − ${money(fee)} ${name} fee = ${money(net)}. Statement: ${siteUrl()}/pro/earnings` });
  } catch (e) {
    if (e instanceof PaypalError && e.definite) { await undo(); return { kind: "error", amount, why: e.message }; }
    await raiseAlert("payout", "warn", `${name} payout outcome unknown — ${pro.business_name} ${money(net)}`, `PayPal didn't answer (${e instanceof Error ? e.message : String(e)}). Look for sender batch ${senderBatchId} in PayPal → Activity before paying again. The rows stay marked as sent so nothing is paid twice.`).catch(() => {});
    return { kind: "error", amount, why: `${name}: PayPal didn't answer — check PayPal for batch ${senderBatchId} before paying again (never sent twice automatically)` };
  }
  // money has moved: record it; problems from here are reported, never undone
  try {
    await db().from("payouts").update({ rail_ref: `${sent.batchId}:${sent.itemId ?? ""}`, rail_status: sent.status }).in("id", pos);
    await db().from("payouts").update({ rail_fee: fee }).eq("id", pos[0]);
    if (neg.length) await db().from("payouts").update({ paid_at: stamp, week_of: o.week, rail, rail_ref: `${sent.batchId}:${sent.itemId ?? ""}` }).in("id", neg);
    await notify(pro.profile_id, { title: `Paid: ${money(net)} to ${name}`, body: `${money(amount)} earned − ${money(fee)} ${name} fee.`, data: { type: "earnings" },
      email: { to: pro.email ?? "", subject: `${BRAND.name} payout: ${money(net)} sent to your ${name}`, text: `We sent ${money(net)} to your ${name} (${maskHandle(h.handle)}): ${money(amount)} earned − ${money(fee)} ${name} fee. It usually shows up within minutes.\n\nStatement for every job: ${siteUrl()}/pro/earnings\nPrefer free direct deposit to your bank? Switch any time: ${siteUrl()}/pro/onboarding#step-payout\n\n— ${BRAND.name}` } });
  } catch (e) {
    await raiseAlert("payout", "warn", `${name} payout sent but not fully recorded — ${pro.business_name}`, `PayPal batch ${sent.batchId}: ${e instanceof Error ? e.message : String(e)}`).catch(() => {});
  }
  return { kind: "paid", amount, transfer: `${name.toLowerCase()}:${sent.batchId}` };
}

/**
 * Daily: follow PayPal / Venmo payouts until they land. Returned, failed or blocked → the pay goes back to owed (fee
 * dropped), the pro is asked to check their details, staff are told. Unclaimed (no account on that email / phone yet) →
 * the pro is told to claim it within 30 days. Interrupted sends (no PayPal id recorded) → staff check PayPal by hand.
 */
export async function syncPaypalPayouts() {
  const { paypalConfigured, paypalItem } = await import("./paypal");
  if (!paypalConfigured()) return { checked: 0, failed: 0 };
  const since = new Date(Date.now() - 40 * 86400000).toISOString();
  const { data, error } = await db().from("payouts").select("id, contractor_id, amount, rail, rail_ref, rail_status, paid_at").eq("status", "paid").in("rail", ["paypal", "venmo"]).gte("paid_at", since).limit(2000);
  if (error) return { checked: 0, failed: 0 };
  const open = ((data ?? []) as { id: string; contractor_id: string; amount: number; rail: "paypal" | "venmo"; rail_ref: string | null; rail_status: string | null; paid_at: string }[])
    .filter((r) => !["SUCCESS", "FAILED", "RETURNED", "REFUNDED", "BLOCKED", "DENIED", "REVERSED"].includes(String(r.rail_status)));
  const groups = new Map<string, typeof open>();
  for (const r of open) groups.set(String(r.rail_ref), [...(groups.get(String(r.rail_ref)) ?? []), r]);
  let checked = 0, failed = 0;
  for (const [ref, g] of groups) {
    const name = PAYOUT_RAILS[g[0].rail].label;
    const { data: pro } = await db().from("contractors").select("profile_id, email, business_name").eq("id", g[0].contractor_id).single();
    if (!ref.includes(":")) {
      if (Date.now() - new Date(g[0].paid_at).getTime() > 30 * 60000 && g[0].rail_status !== "CHECK_PAYPAL") {
        await db().from("payouts").update({ rail_status: "CHECK_PAYPAL" }).in("id", g.map((r) => r.id));
        await raiseAlert("payout", "critical", `${name} payout interrupted — ${pro?.business_name ?? g[0].contractor_id}`, `No PayPal confirmation was recorded for sender batch ${ref}. Look it up in PayPal → Activity. If it was NOT sent, mark these lines approved again in Hub → Money so the next run pays them.`).catch(() => {});
      }
      continue;
    }
    const [batchId, itemId] = ref.split(":");
    const it = await paypalItem({ batchId, itemId: itemId || null }).catch(() => null);
    if (!it) continue;
    checked++;
    const outcome = paypalItemOutcome(it.status);
    const total = r2(g.reduce((t, r) => t + Number(r.amount), 0));
    if (it.status !== g[0].rail_status) await db().from("payouts").update({ rail_status: it.status, rail_ref: `${batchId}:${it.itemId ?? ""}` }).in("id", g.map((r) => r.id));
    if (outcome === "failed") {
      failed++;
      await db().from("payouts").update({ status: "approved", paid_at: null, method: null, week_of: null, rail: null, rail_ref: null, rail_status: null, rail_fee: 0 }).in("id", g.map((r) => r.id));
      await notify(pro?.profile_id ?? null, { title: `Your ${name} payout didn't go through`, body: `Check your ${name} details — we'll send ${money(total)} again on the next payout.`, data: { type: "earnings" },
        email: { to: pro?.email ?? null, subject: `Your ${name} payout didn't go through`, text: `${name} sent back your ${BRAND.name} payout${it.error ? ` (${it.error})` : ""}. Nothing is lost: ${money(total)} is owed to you again and goes out on the next payout.\n\nPlease check your ${name} ${g[0].rail === "venmo" ? "phone number" : "email"}, or switch to free direct deposit to your bank: ${siteUrl()}/pro/onboarding#step-payout\n\n— ${BRAND.name}` } });
      await raiseAlert("payout", "warn", `${name} payout returned — ${pro?.business_name ?? ""} ${money(total)}`, `PayPal status ${it.status}${it.error ? `: ${it.error}` : ""}. Put back to owed; the pro was asked to fix their details.`).catch(() => {});
    } else if (outcome === "unclaimed" && g[0].rail_status !== "UNCLAIMED") {
      await notify(pro?.profile_id ?? null, { title: `Claim your ${name} payout`, body: `We sent ${money(total)} — accept it in ${name} within 30 days.`, data: { type: "earnings" },
        email: { to: pro?.email ?? null, subject: `Claim your ${BRAND.name} payout in ${name}`, text: `We sent your payout to ${name}, but there's no ${name} account on that ${g[0].rail === "venmo" ? "phone number" : "email"} yet. Sign up or add it in ${name} within 30 days to receive it — otherwise it comes back to us and we'll send it again.\n\nOr switch to free direct deposit to your bank: ${siteUrl()}/pro/onboarding#step-payout\n\n— ${BRAND.name}` } });
    }
  }
  return { checked, failed };
}

/**
 * Mondays: send every pro their approved balance (jobs, show-up pay, stipends, materials,
 * referral bonuses, approved minimum top-ups, minus open clawbacks) to their Stripe account,
 * free. One transfer and one statement per pro. Pros who really aren't set up are told exactly what's missing; their
 * balance waits (Hub "Pay now" sends it as soon as they finish). A Stripe error is ours to fix, never "not set up".
 */
export const PAYOUT_CONCURRENCY = 6;

export async function runWeeklyPayouts(now = new Date(), opts: { method: "weekly" | "manual"; budgetMs: number } = { method: "weekly", budgetMs: 240_000 }) {
  const week = mondayOf(now);
  const recovered = await recoverStrandedPayouts().catch((e) => { console.error("[payout recovery]", e); return null; });
  await syncPaypalPayouts().catch((e) => console.error("[paypal sync]", e));
  if (!getStripe()) { await raiseAlert("payout", "warn", `Weekly payouts not sent (week of ${week})`, "Stripe isn't configured — pay pros manually in Finance."); return { paid: 0, waiting: 0, total: 0 }; }
  const { data: due } = await db().from("payouts").select("contractor_id").eq("status", "approved");
  const ids = [...new Set(((due ?? []) as { contractor_id: string }[]).map((x) => x.contractor_id))];
  const funds = { left: await platformBalance() }; // card money takes ~2 days to become available in Stripe
  let paid = 0, total = 0;
  const failed: string[] = [], waiting: string[] = [];
  const names = new Map(((await db().from("contractors").select("id, business_name").in("id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"])).data ?? []).map((c: { id: string; business_name: string }) => [c.id, c.business_name]));
  // several pros at once (Stripe allows far more), and stop starting new ones before the function's time limit:
  // anyone not reached stays approved and is paid by the next run or Hub "Pay everyone now" — never half-paid
  const started = Date.now();
  const queue = [...ids];
  const skipped: string[] = [];
  const worker = async () => {
    for (let id = queue.shift(); id; id = queue.shift()) {
      if (Date.now() - started > opts.budgetMs) { skipped.push(names.get(id) ?? id); continue; }
      const r = await payContractor(id, { week, method: opts.method, funds, remind: opts.method === "weekly" }).catch((e) => ({ kind: "error" as const, amount: 0, why: e instanceof Error ? e.message : String(e) }));
      const who = names.get(id) ?? id;
      if (r.kind === "paid") { paid++; total = r2(total + r.amount); }
      else if (r.kind === "not_ready") waiting.push(`${who} — ${money(r.amount)}: ${r.why}${opts.method === "weekly" ? " (reminded with the exact steps)" : ""}`);
      else if (r.kind === "error") failed.push(`${who} — ${money(r.amount)}: ${r.why}`);
    }
  };
  await Promise.all(Array.from({ length: Math.min(PAYOUT_CONCURRENCY, ids.length || 1) }, worker));
  if (skipped.length) await raiseAlert("payout", "critical", `Payout run ran out of time: ${skipped.length} pro(s) not paid yet`, `${skipped.join(", ")}\n\nTheir balances are untouched. Hub → Money → "Pay everyone now" finishes the run.`);
  if (failed.length) await raiseAlert("payout", "critical", `Weekly payouts: ${failed.length} NOT sent — fix and use Pay now`, `${failed.join("\n")}\n\nThese pros were NOT told anything was wrong on their side. Fix the cause, then Hub → Pros → (pro) → Pay now.`);
  if (waiting.length) await raiseAlert("payout", "warn", `Weekly payouts: ${waiting.length} pro(s) waiting on Stripe setup`, `${waiting.join("\n")}\n\nCheck each in Hub → Pros → (pro) → Payout status. When they finish, use Pay now.`);
  await raiseAlert("payout", "info", `${opts.method === "weekly" ? "Weekly payouts" : "Payout run"} sent: ${paid} pro(s), ${money(total)}`, recovered && (recovered.matched || recovered.reopened) ? `Repaired ${recovered.matched} interrupted payout(s) and re-queued ${recovered.reopened}.` : null);
  return { paid, waiting: waiting.length, total, failed: failed.length, notReached: skipped.length };
}

/**
 * Payouts cut off mid-way (rows claimed as paid, but no Stripe transfer recorded — e.g. the server stopped between the
 * claim and the transfer). Older than 15 minutes: if Stripe has the transfer (same pro, after the claim), record it;
 * if not, put the rows back to approved so they're paid on the next run. Nobody is paid twice or skipped.
 */
export async function recoverStrandedPayouts() {
  const s = getStripe();
  if (!s) return { matched: 0, reopened: 0 };
  const cutoff = new Date(Date.now() - 15 * 60000).toISOString();
  const { data } = await db().from("payouts").select("id, contractor_id, paid_at, amount, week_of").eq("status", "paid").in("method", ["weekly", "manual"]).is("stripe_transfer_id", null).or("rail.is.null,rail.eq.stripe").lt("paid_at", cutoff).gt("paid_at", new Date(Date.now() - 30 * 86400000).toISOString()).limit(1000);
  const rows = (data ?? []) as { id: string; contractor_id: string; paid_at: string; amount: number; week_of: string | null }[];
  const groups = new Map<string, typeof rows>();
  for (const r of rows) groups.set(`${r.contractor_id}|${r.paid_at}`, [...(groups.get(`${r.contractor_id}|${r.paid_at}`) ?? []), r]);
  let matched = 0, reopened = 0;
  for (const [key, g] of groups) {
    const [cid, at] = key.split("|");
    const { data: pro } = await db().from("contractors").select("stripe_account_id, business_name").eq("id", cid).single();
    const since = Math.floor(new Date(at).getTime() / 1000) - 60;
    const list = pro?.stripe_account_id ? await s.transfers.list({ destination: pro.stripe_account_id, created: { gte: since }, limit: 20 }).catch(() => null) : null;
    if (pro?.stripe_account_id && !list) continue; // couldn't ask Stripe: leave it for the next run rather than guess
    // our transfer for this claim: same pro and week (metadata), sent within 10 minutes of the claim
    const t = list?.data.find((x) => x.metadata?.contractor_id === cid && x.metadata?.week_of === g[0].week_of && x.created <= since + 660 && !x.reversed);
    if (t) { await db().from("payouts").update({ stripe_transfer_id: t.id }).in("id", g.map((r) => r.id)); matched += g.length; }
    else {
      await db().from("payouts").update({ status: "approved", paid_at: null, method: null, week_of: null }).in("id", g.map((r) => r.id)).is("stripe_transfer_id", null);
      reopened += g.length;
      await raiseAlert("payout", "warn", `Interrupted payout re-queued — ${pro?.business_name ?? cid}`, `${g.length} line(s) were marked paid but no Stripe transfer exists. Put back to approved; they go out on the next run or with Pay now.`).catch(() => {});
    }
  }
  return { matched, reopened };
}

/** Hub (admins) "Pay now": send one pro's approved balance right away (method manual), same checks as Monday. */
export async function payNow(contractorId: string, actor: string) {
  await recoverStrandedPayouts().catch((e) => console.error("[payout recovery]", e));
  const r = await payContractor(contractorId, { week: mondayOf(new Date()), method: "manual", funds: { left: await platformBalance() }, remind: false });
  if (r.kind === "paid") await raiseAlert("payout", "info", `Paid now by ${actor}: ${money(r.amount)}`, `Transfer ${r.transfer}`).catch(() => {});
  return r;
}

// ─── Real numbers behind tiers and dispatch ──────────────────────────────────────

/** Daily: acceptance and on-time rates from the last 90 days of offers and jobs. */
export async function refreshProStats(now = new Date()) {
  const since = new Date(now.getTime() - STATS_WINDOW_DAYS * 86400000).toISOString();
  const { data: pros } = await db().from("contractors").select("id, acceptance_rate, on_time_rate").eq("status", "approved");
  let changed = 0;
  for (const c of (pros ?? []) as { id: string; acceptance_rate: number; on_time_rate: number }[]) {
    const [{ data: offers }, { data: jobs }] = await Promise.all([
      db().from("job_offers").select("status").eq("contractor_id", c.id).gte("offered_at", since).neq("status", "offered"),
      db().from("jobs").select("scheduled_date, time_window, started_at").eq("contractor_id", c.id).not("started_at", "is", null).gte("started_at", since),
    ]);
    const acceptance_rate = acceptanceRate((offers ?? []) as { status: string }[], Number(c.acceptance_rate));
    const on_time_rate = onTimeRate((jobs ?? []) as { scheduled_date: string | null; time_window: TimeWindow; started_at: string | null }[], Number(c.on_time_rate));
    if (acceptance_rate !== Number(c.acceptance_rate) || on_time_rate !== Number(c.on_time_rate)) {
      await db().from("contractors").update({ acceptance_rate, on_time_rate }).eq("id", c.id);
      changed++;
    }
  }
  return changed;
}

// ─── Refer-a-pro bonus ─────────────────────────────────────────────────────────────

/** Daily: pay the referrer once the pro they referred finishes PRO_REFERRAL.afterJobs jobs. */
export async function payReferralBonuses() {
  const { data } = await db().from("contractors").select("id, business_name, referred_by, jobs_completed, referral_bonus_paid_at, status")
    .not("referred_by", "is", null).is("referral_bonus_paid_at", null).eq("status", "approved").gte("jobs_completed", PRO_REFERRAL.afterJobs);
  let n = 0;
  for (const c of (data ?? []) as { id: string; business_name: string; referred_by: string; jobs_completed: number; referral_bonus_paid_at: string | null; status: string }[]) {
    if (!referralDue(c)) continue;
    const { data: claimed } = await db().from("contractors").update({ referral_bonus_paid_at: new Date().toISOString() }).eq("id", c.id).is("referral_bonus_paid_at", null).select("id").maybeSingle();
    if (!claimed) continue;
    const { data: ref } = await db().from("contractors").select("id, profile_id, email, status").eq("id", c.referred_by).maybeSingle();
    if (!ref || ref.status !== "approved") continue;
    await db().from("payouts").insert({ contractor_id: ref.id, amount: PRO_REFERRAL.bonus, status: "approved", kind: "referral", reason: `Referral bonus — ${c.business_name} finished ${PRO_REFERRAL.afterJobs} jobs` });
    await notify(ref.profile_id, { title: `${money(PRO_REFERRAL.bonus)} referral bonus`, body: `${c.business_name} finished ${PRO_REFERRAL.afterJobs} jobs. It's on your next payout.`, data: { type: "earnings" },
      email: { to: ref.email, subject: `${money(PRO_REFERRAL.bonus)} referral bonus`, text: `Thanks for referring ${c.business_name}. They've finished ${PRO_REFERRAL.afterJobs} jobs, so we've added ${money(PRO_REFERRAL.bonus)} to your next payout.\n\n— ${BRAND.name}` },
      es: { title: `Bono por referido de ${money(PRO_REFERRAL.bonus)}`, body: `${c.business_name} completó ${PRO_REFERRAL.afterJobs} trabajos. Se incluirá en su próximo pago.`, subject: `Bono por referido de ${money(PRO_REFERRAL.bonus)}`, text: `Gracias por referir a ${c.business_name}. Ya completó ${PRO_REFERRAL.afterJobs} trabajos, así que agregamos ${money(PRO_REFERRAL.bonus)} a su próximo pago.\n\n— ${BRAND.name}` } });
    n++;
  }
  return n;
}
