/*
 * FILE    : apps/web/lib/accounting.ts
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-06_2205 UTC
 * PURPOSE : Stripe → Xero. Xero is the books; Stripe is set up in Xero as its own bank account ("Stripe", 1090) and
 *           everything is booked from Stripe's balance transactions — the record of every cent that moved — one
 *           business day (America/Detroit) at a time, once the day is over:
 *             • RECEIVE "Stripe YYYY-MM-DD"  money in: service sales, memberships, talent fees, tips (owed to pros),
 *                                            gift cards (liability), materials (pass-through), sales tax collected,
 *                                            instant-pay fees kept
 *             • SPEND   "Stripe YYYY-MM-DD"  money out: Stripe fees, refunds, chargebacks, adjustments
 *             • SPEND per pro (contact = the pro)  their payout transfer, split into job pay / bonuses / tips /
 *                                            materials from our payouts ledger — spend by contact = 1099 detail
 *             • SPEND per referral partner (contact = the partner)  their weekly commissions (6130 Referral commissions)
 *             • Bank transfer per Stripe payout   Stripe → your checking account, dated the arrival day, so it
 *                                            matches the deposit on the bank feed
 *             • Business invoices on terms → Xero sales invoices (Accounts Receivable, aging, factoring), and the
 *               Stripe payment for one → a Xero payment against that invoice instead of revenue.
 *           Any difference between what was booked and Stripe's net for the day goes to "Stripe adjustments", so the
 *           Stripe account in Xero always equals the Stripe balance. Every document is pushed once (xero_sync_log
 *           unique kind+ref, plus Xero Idempotency-Key); failures are retried on the next run.
 */
import "server-only";
import type Stripe from "stripe";
import { getStripe } from "./stripe";
import { adminClient } from "./supabase/server";
import { raiseAlert } from "./jobs";
import {
  BUSINESS_TZ, DEFAULT_ACCOUNTS, accountCode, accountRef, findOrCreateContact, getConnection, saveSettings, xero,
  type AccountKey, type XeroSettings,
} from "./xero";

const db = () => adminClient();
const dollars = (c: number) => Math.round(c) / 100;

// ─── Business days ───────────────────────────────────────────────────────────

function offsetMinutes(at: Date, tz: string) {
  const v = new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "shortOffset" }).formatToParts(at).find((p) => p.type === "timeZoneName")?.value ?? "GMT";
  const m = v.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/);
  return m ? (m[1] === "-" ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3] ?? 0)) : 0;
}
/** Midnight of a local calendar day, as a UTC Date. */
function dayStart(day: string, tz: string) {
  const guess = Date.parse(`${day}T00:00:00Z`);
  let start = guess - offsetMinutes(new Date(guess + 12 * 3600000), tz) * 60000;
  const o2 = offsetMinutes(new Date(start), tz);
  start = guess - o2 * 60000;
  return new Date(start);
}
export const localDay = (d: Date, tz = BUSINESS_TZ) => new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
const addDays = (day: string, n: number) => new Date(Date.parse(`${day}T12:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
const isDay = (s: unknown): s is string => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);

// ─── Classifying Stripe money ────────────────────────────────────────────────

type Cls = { kind: string; grossCents: number; taxCents: number; businessInvoiceId: string | null; talent: boolean; label: string };

type PayRow = { id: string; kind: string; amount: number; tax_amount?: number | null; business_invoice_id?: string | null; talent_placement_id?: string | null; talent_retainer_id?: string | null; description?: string | null };

function fromRow(r: PayRow): Cls {
  const tax = Math.round(Number(r.tax_amount ?? 0) * 100);
  return { kind: r.kind, grossCents: Math.round(Number(r.amount) * 100) + tax, taxCents: tax, businessInvoiceId: r.business_invoice_id ?? null, talent: Boolean(r.talent_placement_id || r.talent_retainer_id), label: r.description ?? r.kind };
}

/** What a payment intent paid for, from our payments table (or the intent's own metadata). Cached per run. */
async function classify(piId: string | null, cache: Map<string, Cls>, description?: string | null): Promise<Cls> {
  const fallback: Cls = { kind: description?.startsWith("Subscription") ? "membership" : "custom", grossCents: 0, taxCents: 0, businessInvoiceId: null, talent: false, label: description ?? "Stripe charge" };
  if (!piId) return fallback;
  const hit = cache.get(piId);
  if (hit) return hit;
  const cols = "id, kind, amount, tax_amount, business_invoice_id, talent_placement_id, talent_retainer_id, description";
  let { data: row } = await db().from("payments").select(cols).or(`stripe_payment_intent_id.eq.${piId},stripe_session_id.eq.${piId}`).limit(1).maybeSingle();
  let cls: Cls = fallback;
  if (!row) {
    const pi = await getStripe()?.paymentIntents.retrieve(piId).catch(() => null);
    const pid = pi?.metadata?.payment_id;
    if (pid) row = (await db().from("payments").select(cols).eq("id", pid).maybeSingle()).data;
    if (!row && pi) cls = { ...fallback, kind: pi.metadata?.kind || (pi.description?.startsWith("Subscription") ? "membership" : fallback.kind), label: pi.description ?? fallback.label };
  }
  if (row) cls = fromRow(row as PayRow);
  cache.set(piId, cls);
  return cls;
}

/** Which account a customer payment of this kind is booked to. */
function salesAccount(c: Cls): AccountKey {
  if (c.kind === "tip") return "tips";
  if (c.kind === "gift_card") return "gift_cards";
  if (c.kind === "materials") return "materials";
  if (c.kind === "membership") return "membership_revenue";
  if (c.kind === "invoice" && c.talent) return "talent_revenue";
  return "service_revenue";
}
/** Which account a refund of this kind comes out of. Pass-through money goes back to its liability. */
function refundAccount(c: Cls): AccountKey {
  if (c.kind === "tip" || c.kind === "gift_card" || c.kind === "materials") return salesAccount(c);
  return "refunds";
}
/** Which account a pro payout line of this kind is booked to. */
function payoutAccount(kind: string): AccountKey {
  if (kind === "tip") return "tips";
  if (kind === "materials") return "materials";
  if (kind === "referral" || kind === "stipend") return "pro_incentives";
  return "subcontractors"; // job, show_up, guarantee, placement, clawback (negative)
}

const id = (v: string | { id: string } | null | undefined) => (v ? (typeof v === "string" ? v : v.id) : null);

// ─── One business day ────────────────────────────────────────────────────────

export type DayPlan = {
  day: string;
  postings: { account: AccountKey; cents: number }[];          // + money into Stripe, − money out (general)
  pros: { payee: "pro" | "partner"; contractorId: string; name: string; email: string | null; xeroContactId: string | null; lines: { account: AccountKey; cents: number }[] }[];
  payouts: { id: string; cents: number; arrival: string }[];    // + Stripe → checking, − checking → Stripe
  invoicePayments: { chargeId: string; invoiceId: string; xeroInvoiceId: string; number: string; cents: number }[];
  stripeNetCents: number;
  bookedCents: number;
  count: number;
  waiting: string[];                                            // reasons the day can't be booked yet
};

/** Read every Stripe balance transaction of a business day and work out the entries. Nothing is written. */
export async function planDay(day: string, settings: XeroSettings): Promise<DayPlan> {
  const s = getStripe();
  if (!s) throw new Error("Stripe isn't configured");
  const tz = settings.timezone || BUSINESS_TZ;
  const gte = Math.floor(dayStart(day, tz).getTime() / 1000), lt = Math.floor(dayStart(addDays(day, 1), tz).getTime() / 1000);
  const cache = new Map<string, Cls>();
  const post = new Map<AccountKey, number>();
  const add = (k: AccountKey, c: number) => { if (c) post.set(k, (post.get(k) ?? 0) + c); };
  const pros = new Map<string, Map<AccountKey, number>>();
  const payouts: DayPlan["payouts"] = [];
  const invoicePayments: DayPlan["invoicePayments"] = [];
  const waiting: string[] = [];
  let net = 0, count = 0;
  const invCache = new Map<string, { xero_invoice_id: string | null; number: string; issued_on: string } | null>();

  for await (const bt of s.balanceTransactions.list({ created: { gte, lt }, limit: 100, expand: ["data.source"] })) {
    count++;
    net += bt.net;
    if (bt.fee) add("stripe_fees", -bt.fee);
    const src = bt.source && typeof bt.source !== "string" ? bt.source : null;
    const cat = bt.reporting_category;
    if (cat === "charge" || cat === "payment") {
      const ch = src as Stripe.Charge | null;
      const c = await classify(id(ch?.payment_intent as never), cache, ch?.description);
      const tax = c.taxCents && c.grossCents ? Math.min(bt.amount, Math.round((bt.amount * c.taxCents) / c.grossCents)) : 0;
      add("sales_tax", tax);
      if (c.businessInvoiceId) {
        if (!invCache.has(c.businessInvoiceId)) invCache.set(c.businessInvoiceId, (await db().from("business_invoices").select("xero_invoice_id, number, issued_on").eq("id", c.businessInvoiceId).maybeSingle()).data);
        const inv = invCache.get(c.businessInvoiceId);
        if (inv?.xero_invoice_id) { invoicePayments.push({ chargeId: ch?.id ?? bt.id, invoiceId: c.businessInvoiceId, xeroInvoiceId: inv.xero_invoice_id, number: inv.number, cents: bt.amount - tax }); continue; }
        // an invoice that should be in Xero but isn't yet: booking it as revenue now would count it twice later
        if (inv && settings.sync_from && inv.issued_on >= settings.sync_from) { waiting.push(`invoice ${inv.number} isn't in Xero yet`); continue; }
      }
      add(salesAccount(c), bt.amount - tax);
    } else if (cat === "refund" || cat === "partial_capture_reversal") {
      const rf = src as Stripe.Refund | null;
      const c = await classify(id(rf?.payment_intent as never), cache);
      const tax = c.taxCents && c.grossCents ? Math.max(bt.amount, Math.round((bt.amount * c.taxCents) / c.grossCents)) : 0; // both negative
      add("sales_tax", tax);
      add(refundAccount(c), bt.amount - tax);
    } else if (cat === "dispute" || cat === "dispute_reversal") {
      add("chargebacks", bt.amount);
    } else if (cat === "transfer") {
      const tr = src as Stripe.Transfer | null;
      // referral partner commissions: one spend per partner (contact = the partner) → 1099 detail
      if (tr?.metadata?.partner_id) {
        const key = `partner:${tr.metadata.partner_id}`;
        const m = pros.get(key) ?? new Map<AccountKey, number>();
        m.set("referral_commissions", (m.get("referral_commissions") ?? 0) - bt.amount);
        pros.set(key, m);
        continue;
      }
      const pro = tr?.metadata?.contractor_id ? `pro:${tr.metadata.contractor_id}` : null;
      const sent = -bt.amount;
      const { data: rows } = tr ? await db().from("payouts").select("kind, amount").eq("stripe_transfer_id", tr.id) : { data: null };
      const lines = new Map<AccountKey, number>();
      let ledger = 0;
      for (const r of (rows ?? []) as { kind: string; amount: number }[]) {
        const c = r.kind === "clawback" ? -Math.abs(Math.round(Number(r.amount) * 100)) : Math.round(Number(r.amount) * 100);
        lines.set(payoutAccount(r.kind), (lines.get(payoutAccount(r.kind)) ?? 0) + c);
        ledger += c;
      }
      if (!ledger) { lines.clear(); lines.set("subcontractors", sent); ledger = sent; }
      add("instant_pay_fees", ledger - sent); // instant cash-out: the pro's fee stays with us
      if (pro) {
        const m = pros.get(pro) ?? new Map<AccountKey, number>();
        for (const [k, c] of lines) m.set(k, (m.get(k) ?? 0) + c);
        pros.set(pro, m);
      } else for (const [k, c] of lines) add(k, -c);
    } else if (cat === "transfer_reversal") {
      add("subcontractors", bt.amount);
    } else if (cat === "payout" || cat === "payout_reversal") {
      const po = src as Stripe.Payout | null;
      payouts.push({ id: po?.id ?? bt.id, cents: -bt.amount, arrival: po?.arrival_date ? localDay(new Date(po.arrival_date * 1000), tz) : day });
    } else if (cat === "topup" || cat === "topup_reversal") {
      payouts.push({ id: id(bt.source as never) ?? bt.id, cents: -bt.amount, arrival: day });
    } else if (cat === "fee" || cat === "tax" || bt.type === "stripe_fee") {
      add("stripe_fees", bt.amount);
    } else {
      add("adjustments", bt.amount);
    }
  }

  // pro spends: an account that nets to ≤ 0 for a pro (e.g. only a deduction) is booked in the general entries instead
  const ids = (kind: string) => [...pros.keys()].filter((k) => k.startsWith(`${kind}:`)).map((k) => k.slice(kind.length + 1));
  const [{ data: cons }, { data: parts }] = await Promise.all([
    ids("pro").length ? db().from("contractors").select("id, business_name, email, xero_contact_id").in("id", ids("pro")) : Promise.resolve({ data: [] }),
    ids("partner").length ? db().from("referral_partners").select("id, name, company, email, xero_contact_id").in("id", ids("partner")) : Promise.resolve({ data: [] }),
  ]);
  const proPlans: DayPlan["pros"] = [];
  for (const [key, m] of pros) {
    const [payee, cid] = key.split(":") as ["pro" | "partner", string];
    const lines: { account: AccountKey; cents: number }[] = [];
    for (const [k, c] of m) { if (c > 0) lines.push({ account: k, cents: c }); else add(k, -c); }
    if (!lines.length) continue;
    if (payee === "pro") {
      const con = (cons ?? []).find((x: { id: string }) => x.id === cid) as { business_name: string; email: string | null; xero_contact_id: string | null } | undefined;
      proPlans.push({ payee, contractorId: cid, name: con?.business_name ?? `Pro ${cid.slice(0, 8)}`, email: con?.email ?? null, xeroContactId: con?.xero_contact_id ?? null, lines });
    } else {
      const p = (parts ?? []).find((x: { id: string }) => x.id === cid) as { name: string; company: string | null; email: string | null; xero_contact_id: string | null } | undefined;
      proPlans.push({ payee, contractorId: cid, name: p ? (p.company ? `${p.name} (${p.company})` : p.name) : `Partner ${cid.slice(0, 8)}`, email: p?.email ?? null, xeroContactId: p?.xero_contact_id ?? null, lines });
    }
  }
  const booked = () => [...post.values()].reduce((t, c) => t + c, 0) - proPlans.reduce((t, p) => t + p.lines.reduce((a, l) => a + l.cents, 0), 0)
    + invoicePayments.reduce((t, p) => t + p.cents, 0) - payouts.reduce((t, p) => t + p.cents, 0);
  if (!waiting.length) add("adjustments", net - booked()); // keep the Stripe account in Xero equal to Stripe
  return {
    day, postings: [...post.entries()].filter(([, c]) => c !== 0).map(([account, cents]) => ({ account, cents })),
    pros: proPlans, payouts, invoicePayments, stripeNetCents: net, bookedCents: booked(), count, waiting,
  };
}

// ─── Pushing to Xero, once ───────────────────────────────────────────────────

type LogKind = "stripe_day" | "stripe_receive" | "stripe_spend" | "pro_payout" | "bank_payout" | "invoice" | "invoice_payment" | "invoice_void";

/** Run `push` unless (kind, ref) is already done. Records the outcome. Returns the Xero id, or throws. */
async function once(kind: LogKind, ref: string, meta: { day?: string | null; amount?: number | null; detail?: unknown }, push: () => Promise<string>): Promise<string> {
  const { data: prev } = await db().from("xero_sync_log").select("status, xero_id, attempts").eq("kind", kind).eq("ref", ref).maybeSingle();
  if (prev?.status === "done") return prev.xero_id as string;
  const base = { kind, ref, day: meta.day ?? null, amount: meta.amount ?? null, detail: meta.detail ?? null, attempts: Number(prev?.attempts ?? 0) + 1, updated_at: new Date().toISOString() };
  try {
    const xid = await push();
    await db().from("xero_sync_log").upsert({ ...base, status: "done", xero_id: xid, error: null }, { onConflict: "kind,ref" });
    return xid;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await db().from("xero_sync_log").upsert({ ...base, status: "error", error: msg.slice(0, 2000) }, { onConflict: "kind,ref" });
    throw e;
  }
}

async function stripeContact(settings: XeroSettings) {
  if (settings.stripe_contact_id) return settings.stripe_contact_id;
  const cid = await findOrCreateContact({ name: "Stripe" });
  await saveSettings({ stripe_contact_id: cid });
  settings.stripe_contact_id = cid;
  return cid;
}

const line = (settings: XeroSettings, k: AccountKey, cents: number, description: string) => ({
  Description: description, Quantity: 1, UnitAmount: dollars(Math.abs(cents)), AccountCode: accountCode(settings, k),
});

async function bankTransaction(settings: XeroSettings, o: { type: "RECEIVE" | "SPEND"; contactId: string; date: string; reference: string; lines: ReturnType<typeof line>[]; key: string }) {
  const r = await xero<{ BankTransactions: { BankTransactionID: string }[] }>("PUT", "/BankTransactions", {
    BankTransactions: [{
      Type: o.type, Contact: { ContactID: o.contactId }, BankAccount: accountRef(accountCode(settings, "stripe_bank")), Date: o.date, Reference: o.reference.slice(0, 255),
      LineAmountTypes: "NoTax", CurrencyCode: "USD", IsReconciled: Boolean(settings.reconciled), LineItems: o.lines,
    }],
  }, { idempotencyKey: o.key });
  return r.BankTransactions[0].BankTransactionID;
}

export type DayResult = { day: string; status: "done" | "error" | "waiting" | "empty"; docs: number; errors: string[]; netCents: number };

/** Book one finished business day of Stripe activity into Xero. Safe to run again: done documents are skipped. */
export async function syncStripeDay(day: string, settings: XeroSettings): Promise<DayResult> {
  const plan = await planDay(day, settings);
  const errors: string[] = [];
  let docs = 0;
  const detail = { count: plan.count, stripe_net: dollars(plan.stripeNetCents), postings: plan.postings.map((p) => ({ account: p.account, amount: dollars(p.cents) })), pros: plan.pros.length, payouts: plan.payouts.length, invoice_payments: plan.invoicePayments.length };
  if (plan.waiting.length) {
    await db().from("xero_sync_log").upsert({ kind: "stripe_day", ref: day, day, status: "error", error: `Waiting: ${plan.waiting.join("; ")}`, detail, updated_at: new Date().toISOString() }, { onConflict: "kind,ref" });
    return { day, status: "waiting", docs: 0, errors: plan.waiting, netCents: plan.stripeNetCents };
  }
  if (!plan.count) {
    await db().from("xero_sync_log").upsert({ kind: "stripe_day", ref: day, day, status: "skipped", amount: 0, detail, error: null, updated_at: new Date().toISOString() }, { onConflict: "kind,ref" });
    return { day, status: "empty", docs: 0, errors, netCents: 0 };
  }
  const tryDoc = async (f: () => Promise<unknown>) => { try { await f(); docs++; } catch (e) { errors.push(e instanceof Error ? e.message : String(e)); } };
  const contact = await stripeContact(settings);
  const name = (k: AccountKey) => `${DEFAULT_ACCOUNTS[k].name} — Stripe ${day}`;

  const ins = plan.postings.filter((p) => p.cents > 0), outs = plan.postings.filter((p) => p.cents < 0);
  if (ins.length) await tryDoc(() => once("stripe_receive", day, { day, amount: dollars(ins.reduce((t, p) => t + p.cents, 0)) }, () =>
    bankTransaction(settings, { type: "RECEIVE", contactId: contact, date: day, reference: `Stripe ${day}`, lines: ins.map((p) => line(settings, p.account, p.cents, name(p.account))), key: `receive-${day}` })));
  if (outs.length) await tryDoc(() => once("stripe_spend", day, { day, amount: dollars(-outs.reduce((t, p) => t + p.cents, 0)) }, () =>
    bankTransaction(settings, { type: "SPEND", contactId: contact, date: day, reference: `Stripe ${day}`, lines: outs.map((p) => line(settings, p.account, p.cents, name(p.account))), key: `spend-${day}` })));

  for (const p of plan.pros) {
    const total = p.lines.reduce((t, l) => t + l.cents, 0);
    const ref = p.payee === "pro" ? `${day}:${p.contractorId}` : `${day}:partner:${p.contractorId}`;
    await tryDoc(() => once("pro_payout", ref, { day, amount: dollars(total), detail: { pro: p.name } }, async () => {
      let cid = p.xeroContactId;
      if (!cid) {
        cid = await findOrCreateContact({ name: p.name, email: p.email, isSupplier: true });
        await db().from(p.payee === "pro" ? "contractors" : "referral_partners").update({ xero_contact_id: cid }).eq("id", p.contractorId);
      }
      return bankTransaction(settings, { type: "SPEND", contactId: cid, date: day, reference: `${p.payee === "pro" ? "Pro payout" : "Referral commissions"} ${day}`, lines: p.lines.map((l) => line(settings, l.account, l.cents, `${DEFAULT_ACCOUNTS[l.account].name} — ${p.name}`)), key: `${p.payee}-${day}-${p.contractorId}` });
    }));
  }

  for (const po of plan.payouts) {
    await tryDoc(() => once("bank_payout", `${day}:${po.id}`, { day, amount: dollars(po.cents), detail: { arrival: po.arrival } }, async () => {
      const checking = accountCode(settings, "checking_bank");
      if (!checking) throw new Error("Set your checking account (Hub → Accounting → Account mapping) so Stripe payouts can be recorded");
      const stripe = accountRef(accountCode(settings, "stripe_bank")), bank = accountRef(checking);
      const out = po.cents > 0;
      const r = await xero<{ BankTransfers: { BankTransferID: string }[] }>("PUT", "/BankTransfers", {
        BankTransfers: [{ FromBankAccount: out ? stripe : bank, ToBankAccount: out ? bank : stripe, Amount: dollars(Math.abs(po.cents)), Date: po.arrival, Reference: `Stripe payout ${po.id}`.slice(0, 255), ...(settings.reconciled ? (out ? { FromIsReconciled: true } : { ToIsReconciled: true }) : {}) }],
      }, { idempotencyKey: `payout-${po.id}` });
      return r.BankTransfers[0].BankTransferID;
    }));
  }

  for (const ip of plan.invoicePayments) {
    await tryDoc(() => once("invoice_payment", ip.chargeId, { day, amount: dollars(ip.cents), detail: { invoice: ip.number } }, async () => {
      const r = await xero<{ Payments: { PaymentID: string }[] }>("PUT", "/Payments", {
        Payments: [{ Invoice: { InvoiceID: ip.xeroInvoiceId }, Account: accountRef(accountCode(settings, "stripe_bank")), Date: day, Amount: dollars(ip.cents), Reference: `Stripe ${ip.chargeId}`, IsReconciled: Boolean(settings.reconciled) }],
      }, { idempotencyKey: `invpay-${ip.chargeId}` });
      return r.Payments[0].PaymentID;
    }));
  }

  const status = errors.length ? "error" : "done";
  await db().from("xero_sync_log").upsert({ kind: "stripe_day", ref: day, day, status, amount: dollars(plan.stripeNetCents), detail: { ...detail, documents: docs }, error: errors.length ? errors.join(" | ").slice(0, 2000) : null, updated_at: new Date().toISOString() }, { onConflict: "kind,ref" });
  return { day, status, docs, errors, netCents: plan.stripeNetCents };
}

// ─── Business invoices on terms → Xero sales invoices ────────────────────────

type InvRow = { id: string; account_id: string; number: string; period_start: string; period_end: string; issued_on: string; due_date: string; total: number; status: string; xero_invoice_id: string | null };

export async function syncBusinessInvoices(settings: XeroSettings, limit = 40) {
  let made = 0, voided = 0;
  const errors: string[] = [];
  let q = db().from("business_invoices").select("id, account_id, number, period_start, period_end, issued_on, due_date, total, status, xero_invoice_id").is("xero_invoice_id", null).in("status", ["open", "paid"]).order("issued_on").limit(limit);
  if (settings.sync_from) q = q.gte("issued_on", settings.sync_from);
  const { data: invs } = await q;
  for (const inv of (invs ?? []) as InvRow[]) {
    try {
      await once("invoice", inv.id, { day: inv.issued_on, amount: Number(inv.total), detail: { number: inv.number } }, async () => {
        const { data: acct } = await db().from("business_accounts").select("id, company, email, billing_email, xero_contact_id").eq("id", inv.account_id).single();
        let cid = acct?.xero_contact_id as string | null;
        if (!cid) {
          cid = await findOrCreateContact({ name: acct?.company ?? `Business ${inv.account_id.slice(0, 8)}`, email: acct?.billing_email || acct?.email, isCustomer: true });
          await db().from("business_accounts").update({ xero_contact_id: cid }).eq("id", inv.account_id);
        }
        const { data: jobs } = await db().from("jobs").select("ref, service_slug, price_final, completed_at, address").eq("business_invoice_id", inv.id).order("completed_at");
        const { getService } = await import("@handled/core");
        const lines = ((jobs ?? []) as { ref: string; service_slug: string; price_final: number; completed_at: string | null; address: string | null }[]).map((j) => ({
          Description: `${getService(j.service_slug)?.name ?? j.service_slug} — ${j.ref}${j.completed_at ? ` — ${j.completed_at.slice(0, 10)}` : ""}${j.address ? ` — ${j.address}` : ""}`.slice(0, 4000),
          Quantity: 1, UnitAmount: Number(j.price_final ?? 0), AccountCode: accountCode(settings, "service_revenue"),
        }));
        const diff = Math.round((Number(inv.total) - lines.reduce((t, l) => t + l.UnitAmount, 0)) * 100) / 100;
        if (diff) lines.push({ Description: "Adjustment", Quantity: 1, UnitAmount: diff, AccountCode: accountCode(settings, "service_revenue") });
        if (!lines.length) lines.push({ Description: `Services ${inv.period_start} to ${inv.period_end}`, Quantity: 1, UnitAmount: Number(inv.total), AccountCode: accountCode(settings, "service_revenue") });
        const r = await xero<{ Invoices: { InvoiceID: string }[] }>("PUT", "/Invoices", {
          Invoices: [{
            Type: "ACCREC", Contact: { ContactID: cid }, Date: inv.issued_on, DueDate: inv.due_date, InvoiceNumber: inv.number,
            Reference: `Handled services ${inv.period_start} to ${inv.period_end}`, LineAmountTypes: "NoTax", CurrencyCode: "USD", Status: "AUTHORISED", LineItems: lines,
          }],
        }, { idempotencyKey: `invoice-${inv.id}` });
        const xid = r.Invoices[0].InvoiceID;
        await db().from("business_invoices").update({ xero_invoice_id: xid }).eq("id", inv.id);
        return xid;
      });
      made++;
    } catch (e) {
      errors.push(`${inv.number}: ${e instanceof Error ? e.message : e}`);
    }
  }
  // voided here → void in Xero (only possible while it has no payments there)
  const { data: dead } = await db().from("business_invoices").select("id, number, xero_invoice_id").eq("status", "void").not("xero_invoice_id", "is", null).limit(limit);
  for (const inv of (dead ?? []) as { id: string; number: string; xero_invoice_id: string }[]) {
    try {
      await once("invoice_void", inv.id, { detail: { number: inv.number } }, async () => {
        await xero("POST", `/Invoices/${inv.xero_invoice_id}`, { Invoices: [{ InvoiceID: inv.xero_invoice_id, Status: "VOIDED" }] });
        return inv.xero_invoice_id;
      });
      voided++;
    } catch (e) {
      errors.push(`void ${inv.number}: ${e instanceof Error ? e.message : e}`);
    }
  }
  return { made, voided, errors };
}

// ─── The run ─────────────────────────────────────────────────────────────────

/**
 * Daily (cron) or on demand: invoices first (so their payments can be applied), then every finished business day
 * from the later of sync_from and `lookbackDays` ago, up to yesterday, that isn't booked yet. `only` = one day.
 */
export async function runAccountingSync(o: { only?: string; lookbackDays?: number; maxDays?: number } = {}) {
  const conn = await getConnection();
  if (!conn?.tenant_id) return { ok: false as const, error: "Xero isn't connected" };
  const settings = conn.settings;
  const tz = settings.timezone || BUSINESS_TZ;
  const yesterday = addDays(localDay(new Date(), tz), -1);
  const invoices = await syncBusinessInvoices(settings);
  let days: string[];
  if (o.only) {
    if (!isDay(o.only) || o.only > yesterday) return { ok: false as const, error: "Pick a finished day (yesterday or earlier)" };
    days = [o.only];
  } else {
    const from = [settings.sync_from, addDays(yesterday, -(o.lookbackDays ?? 7) + 1)].filter(isDay).sort().pop()!;
    const { data: done } = await db().from("xero_sync_log").select("ref").eq("kind", "stripe_day").in("status", ["done", "skipped"]).gte("day", from);
    const booked = new Set(((done ?? []) as { ref: string }[]).map((r) => r.ref));
    days = [];
    for (let d = from; d <= yesterday && days.length < (o.maxDays ?? 31); d = addDays(d, 1)) if (!booked.has(d)) days.push(d);
  }
  const results: DayResult[] = [];
  for (const d of days) {
    try { results.push(await syncStripeDay(d, settings)); } catch (e) { results.push({ day: d, status: "error", docs: 0, errors: [e instanceof Error ? e.message : String(e)], netCents: 0 }); }
  }
  const failed = results.filter((r) => r.status === "error" || r.status === "waiting");
  if (failed.length || invoices.errors.length)
    await raiseAlert("accounting", "warn", `Xero sync: ${failed.length} day(s) and ${invoices.errors.length} invoice(s) need attention`, [...failed.map((r) => `${r.day}: ${r.errors.join("; ")}`), ...invoices.errors].join("\n").slice(0, 3000)).catch(() => {});
  return { ok: true as const, invoices, days: results };
}

/** For the Hub preview: the entries a day would produce, with account codes. */
export async function previewDay(day: string) {
  const conn = await getConnection();
  const settings = conn?.settings ?? { accounts: {} };
  const plan = await planDay(day, settings);
  const label = (k: AccountKey) => `${accountCode(settings, k) || "—"} ${DEFAULT_ACCOUNTS[k].name}`;
  return {
    day, count: plan.count, stripeNet: dollars(plan.stripeNetCents), waiting: plan.waiting,
    receive: plan.postings.filter((p) => p.cents > 0).map((p) => ({ account: label(p.account), amount: dollars(p.cents) })),
    spend: plan.postings.filter((p) => p.cents < 0).map((p) => ({ account: label(p.account), amount: dollars(-p.cents) })),
    pros: plan.pros.map((p) => ({ pro: p.name, lines: p.lines.map((l) => ({ account: label(l.account), amount: dollars(l.cents) })) })),
    payouts: plan.payouts.map((p) => ({ id: p.id, amount: dollars(p.cents), arrival: p.arrival })),
    invoicePayments: plan.invoicePayments.map((p) => ({ invoice: p.number, amount: dollars(p.cents) })),
  };
}
