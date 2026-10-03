/*
 * FILE    : apps/web/lib/pro-benefits.ts
 * PROJECT : Handled (myhumanai) — AI-run home & business services
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
 */
import "server-only";
import {
  BRAND, LATE_CANCEL_FEE, PRO_POLICY_DEFAULTS, clawbackPlan, PRO_REFERRAL, STATS_WINDOW_DAYS, acceptanceRate, onTimeRate, referralDue, type TimeWindow, getService, serviceText, guaranteeTopUp, instantPayFee, materialsDecision, mergePolicy, money, qualifies, showUpPay, whyNot,
  type Contractor, type Job, type ProPolicy,
} from "@handled/core";
import { adminClient } from "./supabase/server";
import { addEvent, getJob, raiseAlert } from "./jobs";
import { localeOf, notify } from "./push";
import { opsEmail, sendEmail, siteUrl } from "./notify";
import { chargeSavedCard, connectReady, createCheckout, getStripe, refundAcross } from "./stripe";
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

/** When the arrival window starts, in the market's time zone (America/Detroit). */
export function windowStart(job: Pick<Job, "scheduled_date" | "time_window">): Date | null {
  if (!job.scheduled_date) return null;
  const noon = new Date(`${job.scheduled_date}T12:00:00Z`);
  const off = new Intl.DateTimeFormat("en-US", { timeZone: "America/Detroit", timeZoneName: "shortOffset" }).formatToParts(noon).find((x) => x.type === "timeZoneName")?.value ?? "GMT-5";
  const hours = Number(off.replace("GMT", "") || 0);
  const h = WINDOW_START[job.time_window] ?? 8;
  return new Date(Date.UTC(noon.getUTCFullYear(), noon.getUTCMonth(), noon.getUTCDate(), h - hours));
}

/** A customer cancelling inside 24 hours of the arrival window is a late cancellation. */
export function isLate(job: Pick<Job, "scheduled_date" | "time_window">, now = new Date()) {
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
  const why: CancelReason = reason === "customer" && isLate(job) ? "late" : reason;
  const paid = r2(Number(job.amount_paid ?? 0) - Number(job.amount_refunded ?? 0));
  const fee = ["late", "lockout"].includes(why) ? Math.min(LATE_CANCEL_FEE, Math.max(0, paid)) : 0;
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
  if (!(await connectReady(pro.stripe_account_id))) return { ok: false, error: "Finish your Stripe payout setup first", needsSetup: true };
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
  try {
    const t = await s.transfers.create({ amount: Math.round(net * 100), currency: "usd", destination: pro.stripe_account_id, description: `${BRAND.name} instant pay`, metadata: { contractor_id: contractorId } }, { idempotencyKey: `instant-${contractorId}-${pos.sort().join("").slice(0, 200)}` });
    await db().from("payouts").update({ stripe_transfer_id: t.id }).in("id", pos);
    if (pos[0]) await db().from("payouts").update({ instant_fee: fee }).eq("id", pos[0]);
    if (neg.length) await db().from("payouts").update({ paid_at: now, stripe_transfer_id: t.id }).in("id", neg);
    let instant = true;
    try { await s.payouts.create({ amount: Math.round(net * 100), currency: "usd", method: "instant" }, { stripeAccount: pro.stripe_account_id }); } catch { instant = false; }
    return { ok: true, amount: net, fee, instant, note: instant ? "On its way to your debit card — usually within 30 minutes." : "Sent to your Stripe account; it reaches your bank on Stripe's standard schedule (add a debit card in Stripe for instant)." };
  } catch (e) {
    await db().from("payouts").update({ status: "approved", paid_at: null, method: null }).in("id", pos);
    return { ok: false, error: e instanceof Error ? e.message : "Transfer failed" };
  }
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

/**
 * Mondays: send every pro their approved balance (jobs, show-up pay, stipends, materials,
 * referral bonuses, approved minimum top-ups, minus open clawbacks) to their Stripe account,
 * free. One transfer and one statement per pro. Pros without payout setup are reminded and
 * their balance waits for next week (or instant pay once set up).
 */
export async function runWeeklyPayouts(now = new Date()) {
  const s = getStripe();
  const week = mondayOf(now);
  if (!s) { await raiseAlert("payout", "warn", `Weekly payouts not sent (week of ${week})`, "Stripe isn't configured — pay pros manually in Finance."); return { paid: 0, waiting: 0, total: 0 }; }
  const { data: due } = await db().from("payouts").select("contractor_id").eq("status", "approved");
  const ids = [...new Set(((due ?? []) as { contractor_id: string }[]).map((x) => x.contractor_id))];
  let paid = 0, waiting = 0, total = 0;
  const failed: string[] = [];
  for (const id of ids) {
    const { data: pro } = await db().from("contractors").select("id, profile_id, email, business_name, stripe_account_id").eq("id", id).single();
    if (!pro) continue;
    const bal = await availableBalance(id);
    const { rows, total: amount } = bal;
    if (amount <= 0) continue;
    if (!(await connectReady(pro.stripe_account_id))) {
      waiting++;
      await notify(pro.profile_id, { title: `${money(amount)} is waiting for you`, body: "Finish your payout setup in Earnings so we can send it.", data: { type: "earnings" },
        email: { to: pro.email, subject: `${money(amount)} is ready — finish your payout setup`, text: `You have ${money(amount)} approved. Finish your Stripe payout setup so we can send it: ${siteUrl()}/pro/earnings\n\n— ${BRAND.name}` },
        es: { title: `${money(amount)} le están esperando`, body: "Termine la configuración de pagos en Ganancias para que podamos enviarlo.", subject: `${money(amount)} listos — termine la configuración de pagos`, text: `Tiene ${money(amount)} aprobados. Termine la configuración de pagos en Stripe para que podamos enviarlos: ${siteUrl()}/pro/earnings\n\n— ${BRAND.name}` } });
      continue;
    }
    await prepareDeductions(bal);
    const pos = rows.filter((r) => r.status === "approved").map((r) => r.id);
    const neg = rows.filter((r) => r.status === "clawback").map((r) => r.id);
    const stamp = new Date().toISOString();
    // claim first so a parallel instant cash-out can't pay the same rows twice
    const { data: claimed } = await db().from("payouts").update({ status: "paid", paid_at: stamp, method: "weekly", week_of: week }).in("id", pos).eq("status", "approved").select("id");
    if ((claimed ?? []).length !== pos.length) {
      if (claimed?.length) await db().from("payouts").update({ status: "approved", paid_at: null, method: null, week_of: null }).in("id", claimed.map((x: { id: string }) => x.id));
      failed.push(`${pro.business_name} (balance changed)`);
      continue;
    }
    try {
      const t = await s.transfers.create({ amount: Math.round(amount * 100), currency: "usd", destination: pro.stripe_account_id, description: `${BRAND.name} weekly payout — week of ${week}`, metadata: { contractor_id: id, week_of: week } }, { idempotencyKey: `weekly-${id}-${week}` });
      await db().from("payouts").update({ stripe_transfer_id: t.id }).in("id", pos);
      if (neg.length) await db().from("payouts").update({ paid_at: stamp, stripe_transfer_id: t.id, week_of: week }).in("id", neg);
      paid++; total = r2(total + amount);
      await notify(pro.profile_id, { title: `Paid: ${money(amount)}`, body: `Your weekly payout is on its way to your bank (${pos.length} item${pos.length === 1 ? "" : "s"}).`, data: { type: "earnings" },
        email: { to: pro.email, subject: `${BRAND.name} weekly payout: ${money(amount)}`, text: `We sent ${money(amount)} to your Stripe account for the week of ${week}. It reaches your bank on Stripe's standard schedule (usually 2 business days).\n\nStatement for every job: ${siteUrl()}/pro/earnings\n\n— ${BRAND.name}` },
        es: { title: `Pagado: ${money(amount)}`, body: `Su pago semanal va en camino a su banco (${pos.length} concepto${pos.length === 1 ? "" : "s"}).`, subject: `Pago semanal de ${BRAND.name}: ${money(amount)}`, text: `Enviamos ${money(amount)} a su cuenta de Stripe por la semana del ${esDate(week)}. Llegará a su banco según el calendario estándar de Stripe (normalmente 2 días hábiles).\n\nDetalle de cada trabajo: ${siteUrl()}/pro/earnings\n\n— ${BRAND.name}` } });
    } catch (e) {
      await db().from("payouts").update({ status: "approved", paid_at: null, method: null, week_of: null }).in("id", pos);
      failed.push(`${pro.business_name}: ${e instanceof Error ? e.message : "transfer failed"}`);
    }
  }
  if (failed.length) await raiseAlert("payout", "critical", `Weekly payouts: ${failed.length} failed`, failed.join("\n"));
  await raiseAlert("payout", "info", `Weekly payouts sent: ${paid} pro(s), ${money(total)}`, waiting ? `${waiting} pro(s) still need to finish payout setup — reminded.` : null);
  return { paid, waiting, total, failed: failed.length };
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
