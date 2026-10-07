/*
 * FILE    : apps/web/lib/business.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-04_1934 UTC
 * PURPOSE : Business accounts (rules in core business-accounts.ts):
 *             myAccounts / memberOf     — which accounts a signed-in person belongs to (by login or email)
 *             bookingContext            — booking for one of the account's properties: pilot discount,
 *                                         priority, and whether the job goes on the invoice or is prepaid
 *             openBalance               — what the account owes on terms (uninvoiced jobs + open invoices)
 *             runInvoices               — monthly: one invoice per account for last month's terms jobs,
 *                                         with a card / bank payment link (Stripe), emailed to billing
 *             invoiceSweep              — daily: reminders before and after the due date; terms go on hold
 *                                         when an invoice is 10+ days overdue, and come back when it's paid
 *             settleInvoice             — Stripe paid the invoice → invoice and its jobs marked paid
 *           Terms (Net 15/30/45) are approved by staff case by case; every account starts on prepay.
 */
import "server-only";
import { BRAND, BUSINESS_TERMS, addDaysIso, daysOverdue, invoiceNumber, invoicePeriod, money, pilotDiscount, invoiceReminderDue, termsDecision, type BusinessAccountTerms } from "@handled/core";
import { adminClient } from "./supabase/server";
import { opsEmail, sendEmail, siteUrl } from "./notify";
import { raiseAlert } from "./jobs";
import { createCheckout } from "./stripe";

const db = () => adminClient();

export interface BusinessAccount extends BusinessAccountTerms {
  id: string; company: string; contact_name: string; email: string; phone: string | null; status: string;
  billing_email: string | null; terms_approved_at: string | null; terms_approved_by: string | null; terms_note: string | null; terms_requested_at: string | null;
  industry: string | null; created_at: string;
}
export interface Property { id: string; account_id: string; name: string; address: string; city: string; state: string; zip: string; units: number | null; access_notes: string | null; active: boolean }
export interface Member { id: string; account_id: string; email: string; profile_id: string | null; role: "admin" | "booker" }

/** Accounts this person belongs to. Links their login to an invited email the first time they sign in. */
export async function myAccounts(v: { userId: string; email: string }): Promise<{ account: BusinessAccount; role: Member["role"] }[]> {
  const email = v.email.trim().toLowerCase();
  // two simple queries (no filter-string building with user-supplied emails)
  const [{ data: byLogin }, { data: byEmail }] = await Promise.all([
    db().from("business_members").select("account_id, role, profile_id, email").eq("profile_id", v.userId),
    db().from("business_members").select("account_id, role, profile_id, email").eq("email", email),
  ]);
  const seen = new Set<string>();
  const rows = ([...(byLogin ?? []), ...(byEmail ?? [])] as Member[]).filter((r) => (seen.has(r.account_id) ? false : (seen.add(r.account_id), true)));
  const unlinked = rows.filter((r) => !r.profile_id && r.email === email);
  if (unlinked.length) await db().from("business_members").update({ profile_id: v.userId }).eq("email", email).is("profile_id", null);
  if (!rows.length) return [];
  const { data: accts } = await db().from("business_accounts").select("*").in("id", [...new Set(rows.map((r) => r.account_id))]);
  return ((accts ?? []) as BusinessAccount[]).map((account) => ({ account, role: rows.find((r) => r.account_id === account.id)!.role }));
}

export async function memberOf(v: { userId: string; email: string }, accountId: string) {
  return (await myAccounts(v)).find((a) => a.account.id === accountId) ?? null;
}

/** Owed on terms: jobs billed to the account not yet invoiced, plus open invoice balances. */
export async function openBalance(accountId: string): Promise<number> {
  const [{ data: jobs }, { data: inv }] = await Promise.all([
    db().from("jobs").select("price_final").eq("business_account_id", accountId).eq("billed_on_terms", true).is("business_invoice_id", null).neq("status", "cancelled"),
    db().from("business_invoices").select("total, amount_paid").eq("account_id", accountId).eq("status", "open"),
  ]);
  return ((jobs ?? []) as { price_final: number }[]).reduce((t, j) => t + Number(j.price_final ?? 0), 0)
    + ((inv ?? []) as { total: number; amount_paid: number }[]).reduce((t, i) => t + Number(i.total) - Number(i.amount_paid ?? 0), 0);
}

/** Everything createJob needs to book for an account's property. Throws if the person can't book there. */
export async function bookingContext(customerId: string | null, email: string, propertyId: string) {
  if (!customerId) throw new Error("Sign in to book for your business account");
  const { data: prop } = await db().from("business_properties").select("*").eq("id", propertyId).maybeSingle();
  if (!prop || !(prop as Property).active) throw new Error("That property isn't on your account");
  const mine = await memberOf({ userId: customerId, email }, (prop as Property).account_id);
  if (!mine) throw new Error("That property isn't on your account");
  return { account: mine.account, property: prop as Property };
}

/** Pilot discount and terms decision for a price on an account. */
export async function accountPricing(account: BusinessAccount, listPrice: number, payout: number, priceAfterOther: number) {
  const pilot = pilotDiscount(account, listPrice, payout);
  const price = Math.max(0, priceAfterOther - pilot);
  const decision = termsDecision(account, await openBalance(account.id), price);
  return { pilot, price, ...decision };
}

/** Monthly invoices for terms jobs completed in the period. Idempotent: jobs already invoiced are skipped. */
export async function runInvoices(on = new Date()) {
  const period = invoicePeriod(on);
  const { data: jobs } = await db().from("jobs").select("id, ref, business_account_id, business_property_id, service_slug, price_final, completed_at, scheduled_date, address")
    .eq("billed_on_terms", true).is("business_invoice_id", null).eq("status", "completed").lte("completed_at", `${period.end}T23:59:59Z`).limit(5000);
  const byAcct = new Map<string, { id: string; price_final: number }[]>();
  for (const j of (jobs ?? []) as { id: string; business_account_id: string; price_final: number }[]) byAcct.set(j.business_account_id, [...(byAcct.get(j.business_account_id) ?? []), j]);
  let made = 0;
  for (const [accountId, list] of byAcct) {
    const { data: a } = await db().from("business_accounts").select("*").eq("id", accountId).single();
    const account = a as BusinessAccount;
    const total = Math.round(list.reduce((t, j) => t + Number(j.price_final ?? 0), 0) * 100) / 100;
    const { count } = await db().from("business_invoices").select("id", { count: "exact", head: true }).eq("account_id", accountId);
    const due = addDaysIso(period.issue, account.terms_days || 30);
    const { data: inv, error } = await db().from("business_invoices").insert({
      account_id: accountId, number: `${invoiceNumber((count ?? 0) + 1, period)}-${accountId.slice(0, 4).toUpperCase()}`, period_start: period.start, period_end: period.end,
      issued_on: period.issue, due_date: due, total, status: "open",
    }).select("*").single();
    if (error || !inv) { await raiseAlert("billing", "warn", `Invoice not created: ${account.company}`, error?.message ?? null); continue; }
    await db().from("jobs").update({ business_invoice_id: inv.id }).in("id", list.map((j) => j.id));
    const pay = await createCheckout({ amount: total, name: `${BRAND.name} invoice ${inv.number}`, description: `${list.length} job(s), ${period.start} to ${period.end}`, kind: "invoice", customerEmail: account.billing_email || account.email, customerName: account.company, successPath: "/pay/thanks" }).catch(() => null);
    if (pay) {
      await db().from("payments").update({ business_invoice_id: inv.id }).eq("id", pay.paymentId);
      await db().from("business_invoices").update({ payment_url: pay.url }).eq("id", inv.id);
    }
    await sendInvoiceEmail(account, { ...inv, payment_url: pay?.url ?? null }, list.length, "new");
    made++;
  }
  return made;
}

type Invoice = { id: string; number: string; total: number; amount_paid?: number; due_date: string; period_start: string; period_end: string; payment_url: string | null; reminders_sent?: number };

async function sendInvoiceEmail(account: BusinessAccount, inv: Invoice, jobs: number | null, kind: "new" | "reminder" | "hold") {
  const to = account.billing_email || account.email;
  const owed = Number(inv.total) - Number(inv.amount_paid ?? 0);
  const link = inv.payment_url ?? `${siteUrl()}/account/business`;
  const subject = kind === "new" ? `${BRAND.name} invoice ${inv.number}: ${money(owed)} due ${inv.due_date}`
    : kind === "hold" ? `Invoicing on hold: ${inv.number} is past due` : `Reminder: ${BRAND.name} invoice ${inv.number} (${money(owed)}) due ${inv.due_date}`;
  const text = kind === "hold"
    ? `Hi ${account.contact_name.split(" ")[0]},\n\nInvoice ${inv.number} for ${money(owed)} was due ${inv.due_date}. Until it's paid, new bookings for ${account.company} are paid at booking instead of invoiced. Invoicing resumes automatically once it's paid.\n\nPay by card or bank: ${link}\nQuestions: reply to this email.\n\n${BRAND.name}`
    : `Hi ${account.contact_name.split(" ")[0]},\n\n${kind === "new" ? `Here's your invoice for ${inv.period_start} to ${inv.period_end}${jobs ? ` (${jobs} job${jobs === 1 ? "" : "s"})` : ""}.` : "A friendly reminder about this invoice."}\n\nInvoice: ${inv.number}\nAmount due: ${money(owed)}\nDue: ${inv.due_date}\n\nPay by card or bank: ${link}\nEvery job, with photos: ${siteUrl()}/account/business\n\nThank you for working with ${BRAND.name}.`;
  await sendEmail(to, subject, text).catch((e) => console.error("[invoice email]", e));
}

/** Daily: reminders, and terms on hold when 10+ days overdue. */
export async function invoiceSweep(today = new Date()) {
  const { data } = await db().from("business_invoices").select("*, business_accounts(*)").eq("status", "open").limit(2000);
  let reminded = 0, held = 0;
  for (const row of (data ?? []) as (Invoice & { account_id: string; business_accounts: BusinessAccount })[]) {
    const account = row.business_accounts;
    const step = invoiceReminderDue(row.due_date, row.reminders_sent ?? 0, today);
    if (step !== null) {
      await sendInvoiceEmail(account, row, null, "reminder");
      await db().from("business_invoices").update({ reminders_sent: (row.reminders_sent ?? 0) + 1, last_reminder_at: today.toISOString() }).eq("id", row.id);
      reminded++;
    }
    if (daysOverdue(row.due_date, today) >= BUSINESS_TERMS.holdAfterDaysOverdue && !account.terms_hold && account.billing_mode === "terms") {
      await db().from("business_accounts").update({ terms_hold: true }).eq("id", account.id);
      await sendInvoiceEmail(account, row, null, "hold");
      await raiseAlert("billing", "warn", `Terms on hold: ${account.company}`, `Invoice ${row.number} (${money(Number(row.total) - Number(row.amount_paid ?? 0))}) is ${daysOverdue(row.due_date, today)} days past due. New bookings are prepaid until it's paid. Call them.`);
      held++;
    }
  }
  return { reminded, held };
}

/** Stripe paid an invoice (webhook). Marks the invoice and its jobs paid and lifts a hold if nothing else is overdue. */
export async function settleInvoice(invoiceId: string, amount: number) {
  const { data: inv } = await db().from("business_invoices").select("*").eq("id", invoiceId).maybeSingle();
  if (!inv) return;
  const paid = Math.round((Number(inv.amount_paid ?? 0) + amount) * 100) / 100;
  const full = paid >= Number(inv.total) - 0.005;
  const now = new Date().toISOString();
  await db().from("business_invoices").update({ amount_paid: paid, ...(full ? { status: "paid", paid_at: now } : {}) }).eq("id", invoiceId);
  if (full) {
    const { data: jobs } = await db().from("jobs").select("id, price_final").eq("business_invoice_id", invoiceId);
    for (const j of (jobs ?? []) as { id: string; price_final: number }[]) await db().from("jobs").update({ amount_paid: j.price_final, paid_at: now }).eq("id", j.id);
    const { data: still } = await db().from("business_invoices").select("due_date").eq("account_id", inv.account_id).eq("status", "open");
    if (!((still ?? []) as { due_date: string }[]).some((x) => daysOverdue(x.due_date) >= BUSINESS_TERMS.holdAfterDaysOverdue))
      await db().from("business_accounts").update({ terms_hold: false }).eq("id", inv.account_id);
  }
  if (opsEmail()) await sendEmail(opsEmail(), `Invoice ${inv.number} paid: ${money(amount)}`, `${full ? "Paid in full." : `Partial payment; ${money(Number(inv.total) - paid)} still open.`}`).catch(() => {});
}

/** A customer asks for invoicing on terms → staff decides case by case. */
export async function requestTerms(account: BusinessAccount, who: string, note: string | null) {
  await db().from("business_accounts").update({ terms_requested_at: new Date().toISOString() }).eq("id", account.id);
  await raiseAlert("billing", "info", `Invoicing requested: ${account.company}`, `${who} asked for invoicing on terms.${note ? ` Note: ${note}` : ""} Review the account (history, payment record, size) and decide in Hub → Customers → ${account.company}.`);
}
