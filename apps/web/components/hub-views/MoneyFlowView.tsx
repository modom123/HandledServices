/*
 * FILE    : apps/web/app/hub/payments/page.tsx
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-11_2242 UTC
 * PURPOSE : Hub → Payments: where every dollar stands. Money in — unpaid jobs, deposits with a balance due, failed card
 *           payments, open business invoices (overdue first) and recent refunds. Money out — pro payouts pending,
 *           approved and held, and what was paid in the last 30 days. Staff can send a payment link or charge a saved card
 *           for a balance (components/DispatchActions); refunds and payout decisions stay with admins (Hub → Finance).
 * UPDATED : 2026-10-15_0300 UTC — "pay after": balance failed after the job (tile + list); 25%-paid jobs before the job aren't "owed".
 * UPDATED : 2026-10-28_1735 UTC — now the "Money in & out" view of Mastermind → Money (/hub/money?view=flow); was /hub/payments.
 */
import Link from "next/link";
import { getService, money, paymentState, type BoardJobInput } from "@handled/core";
import { adminClient } from "@/lib/supabase/server";
import { getViewer, isAdmin } from "@/lib/auth";
import { Badge, fmtDate } from "@/components/ui";
import { DispatchActions } from "@/components/DispatchActions";


type J = BoardJobInput & { id: string; ref: string; service_slug: string; contact_name: string; contact_email: string; created_at: string; updated_at: string };
const daysSince = (iso: string) => Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86400000));

export default async function Payments() {
  const admin = isAdmin(await getViewer());
  const db = adminClient();
  const since30 = new Date(Date.now() - 30 * 86400000).toISOString();
  const cols = "id, ref, service_slug, status, scheduled_date, time_window, zip, contractor_id, price_final, paid_at, deposit_paid_at, payment_plan, balance_attempts, billed_on_terms, amount_paid, amount_refunded, remedy, contact_name, contact_email, created_at, updated_at";
  const [{ data: owed }, { data: refunds }, { data: failed }, { data: invoices }, { data: payouts }, { data: paidOut }] = await Promise.all([
    db.from("jobs").select(cols).is("paid_at", null).eq("billed_on_terms", false).is("remedy", null).not("status", "in", "(cancelled,site_visit)").gt("price_final", 0).order("created_at").limit(300),
    db.from("jobs").select(cols).gt("amount_refunded", 0).gte("updated_at", since30).order("updated_at", { ascending: false }).limit(50),
    db.from("payments").select("id, amount, kind, created_at, jobs(id, ref, contact_name)").eq("status", "failed").gte("created_at", since30).order("created_at", { ascending: false }).limit(50),
    db.from("business_invoices").select("id, number, total, amount_paid, due_date, issued_on, payment_url, reminders_sent, business_accounts(company)").eq("status", "open").order("due_date").limit(100),
    db.from("payouts").select("id, amount, status, created_at, contractors(business_name), jobs(id, ref)").in("status", ["pending", "approved", "held"]).order("created_at").limit(300),
    db.from("payouts").select("amount").eq("status", "paid").gte("paid_at", since30),
  ]);
  const jobs = (owed ?? []) as unknown as J[];
  const unpaid = jobs.filter((j) => paymentState(j).key === "unpaid");
  const balance = jobs.filter((j) => paymentState(j).key === "balance");
  const failedAfter = jobs.filter((j) => paymentState(j).key === "balance_failed");
  const due = (j: J) => Math.max(0, Number(j.price_final ?? 0) - Number(j.amount_paid ?? 0));
  const inv = (invoices ?? []) as unknown as { id: string; number: string; total: number; amount_paid: number; due_date: string; issued_on: string; payment_url: string | null; reminders_sent: number; business_accounts: { company: string } | null }[];
  const today = new Date().toISOString().slice(0, 10);
  const po = (payouts ?? []) as unknown as { id: string; amount: number; status: string; created_at: string; contractors: { business_name: string } | null; jobs: { id: string; ref: string } | null }[];
  const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
  const tiles: [string, string, string, boolean][] = [
    ["Unpaid jobs", money(sum(unpaid.map(due))), `${unpaid.length} job${unpaid.length === 1 ? "" : "s"}`, unpaid.length > 0],
    ["Balances due", money(sum(balance.map(due))), `${balance.length} after a deposit`, false],
    ["Balance failed after the job", money(sum(failedAfter.map(due))), `${failedAfter.length} job${failedAfter.length === 1 ? "" : "s"} — retried daily`, failedAfter.length > 0],
    ["Open invoices", money(sum(inv.map((i) => Number(i.total) - Number(i.amount_paid)))), `${inv.filter((i) => i.due_date < today).length} overdue`, inv.some((i) => i.due_date < today)],
    ["Failed payments (30 days)", String((failed ?? []).length), "card declined or expired", (failed ?? []).length > 0],
    ["Payouts owed to pros", money(sum(po.filter((p) => p.status !== "held").map((p) => Number(p.amount)))), `${po.filter((p) => p.status === "held").length} held`, false],
    ["Paid to pros (30 days)", money(sum(((paidOut ?? []) as { amount: number }[]).map((p) => Number(p.amount)))), "weekly payouts", false],
  ];
  const JobTable = ({ list, kind }: { list: J[]; kind: "unpaid" | "balance" }) => (
    <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-sm">
      <thead><tr className="text-left text-xs uppercase tracking-wide text-ink-soft"><th className="pb-2">Job</th><th className="pb-2">Customer</th><th className="pb-2">Date</th><th className="pb-2">{kind === "unpaid" ? "Price" : "Balance"}</th><th className="pb-2">Waiting</th><th className="pb-2">Actions</th></tr></thead>
      <tbody className="divide-y divide-line">{list.map((j) => (
        <tr key={j.id} className="align-top">
          <td className="py-2 pr-3"><Link className="font-semibold text-brand underline" href={`/hub/jobs/${j.id}`}>{j.ref}</Link><div className="text-xs">{getService(j.service_slug)?.name ?? j.service_slug}</div></td>
          <td className="py-2 pr-3 text-xs">{j.contact_name}<br /><span className="text-ink-soft">{j.contact_email}</span></td>
          <td className="py-2 pr-3 text-xs">{j.scheduled_date ? fmtDate(j.scheduled_date) : "—"}</td>
          <td className="py-2 pr-3 font-semibold">{money(due(j))}</td>
          <td className="py-2 pr-3 text-xs">{daysSince(j.created_at)} d</td>
          <td className="py-2 pr-3"><DispatchActions payOnly job={{ id: j.id, contractorId: j.contractor_id, status: j.status, date: j.scheduled_date, window: j.time_window, standby: 0, payment: paymentState(j).key, siteVisit: false }} pros={[]} /></td>
        </tr>
      ))}</tbody>
    </table></div>
  );

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold">Payments</h1><p className="text-sm text-ink-soft">Money in and money out, job by job. Paid upfront is the rule: unpaid jobs aren't dispatched. Customers get automatic payment reminders; use the buttons to send a link now.{!admin && " Refunds and payout decisions are made by admins in Hub → Finance."}</p></div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {tiles.map(([label, value, sub, alert]) => <div key={label} className={`card ${alert ? "border-amber-300 bg-amber-50" : ""}`}><div className="text-xs text-ink-soft">{label}</div><div className="text-xl font-bold">{value}</div><div className="text-xs text-ink-soft">{sub}</div></div>)}
      </div>

      <section className="card"><h2 className="mb-2 font-bold">Unpaid jobs</h2>{unpaid.length ? <JobTable list={unpaid} kind="unpaid" /> : <p className="text-sm text-ink-soft">Every priced job is paid.</p>}</section>
      {failedAfter.length > 0 && <section className="card"><h2 className="mb-2 font-bold">Job done — balance charge failed</h2><p className="mb-2 text-xs text-ink-soft">25% was paid at booking; the card didn&apos;t take the rest. A payment link went out and the card is retried daily (3 tries). The pro is paid as usual — collecting this is on us.</p><JobTable list={failedAfter} kind="balance" /></section>}
      <section className="card"><h2 className="mb-2 font-bold">Deposit paid — balance due</h2>{balance.length ? <JobTable list={balance} kind="balance" /> : <p className="text-sm text-ink-soft">No balances waiting.</p>}</section>

      <section className="card"><h2 className="mb-2 font-bold">Failed payments <span className="text-sm font-normal text-ink-soft">last 30 days</span></h2>
        {(failed ?? []).length ? <ul className="divide-y divide-line text-sm">{((failed ?? []) as unknown as { id: string; amount: number; kind: string; created_at: string; jobs: { id: string; ref: string; contact_name: string } | null }[]).map((f) => (
          <li key={f.id} className="flex flex-wrap justify-between gap-2 py-2"><span>{f.jobs ? <Link className="font-semibold text-brand underline" href={`/hub/jobs/${f.jobs.id}`}>{f.jobs.ref}</Link> : "—"} · {f.jobs?.contact_name} · {f.kind}</span><span>{money(f.amount)} · {fmtDate(f.created_at.slice(0, 10))}</span></li>
        ))}</ul> : <p className="text-sm text-ink-soft">No failed payments.</p>}</section>

      <section className="card"><h2 className="mb-2 font-bold">Open business invoices</h2>
        {inv.length ? <div className="overflow-x-auto"><table className="w-full min-w-[640px] text-sm">
          <thead><tr className="text-left text-xs uppercase tracking-wide text-ink-soft"><th className="pb-2">Invoice</th><th className="pb-2">Company</th><th className="pb-2">Owed</th><th className="pb-2">Due</th><th className="pb-2">Reminders</th><th className="pb-2" /></tr></thead>
          <tbody className="divide-y divide-line">{inv.map((i) => (
            <tr key={i.id}><td className="py-2 pr-3 font-semibold">{i.number}</td><td className="py-2 pr-3">{i.business_accounts?.company ?? "—"}</td><td className="py-2 pr-3">{money(Number(i.total) - Number(i.amount_paid))}</td>
              <td className="py-2 pr-3">{fmtDate(i.due_date)} {i.due_date < today && <Badge tone="red">{daysSince(`${i.due_date}T12:00:00Z`)} d overdue</Badge>}</td><td className="py-2 pr-3 text-xs">{i.reminders_sent}</td>
              <td className="py-2 pr-3 text-xs">{i.payment_url && <a className="text-brand underline" href={i.payment_url} target="_blank" rel="noreferrer">Payment page ↗</a>}</td></tr>
          ))}</tbody></table></div> : <p className="text-sm text-ink-soft">No open invoices.</p>}
        <p className="mt-2 text-xs text-ink-soft">Invoices go out on the 1st; overdue reminders are automatic. Account terms are in Hub → Customers & B2B.</p></section>

      <section className="card"><h2 className="mb-2 font-bold">Refunds <span className="text-sm font-normal text-ink-soft">last 30 days</span></h2>
        {(refunds ?? []).length ? <ul className="divide-y divide-line text-sm">{((refunds ?? []) as unknown as J[]).map((j) => (
          <li key={j.id} className="flex flex-wrap justify-between gap-2 py-2"><span><Link className="font-semibold text-brand underline" href={`/hub/jobs/${j.id}`}>{j.ref}</Link> · {j.contact_name}</span><span>{money(j.amount_refunded)} of {money(j.amount_paid)}</span></li>
        ))}</ul> : <p className="text-sm text-ink-soft">No refunds.</p>}</section>

      <p className="text-sm text-ink-soft">Pro payouts go out every Monday automatically. {admin ? <>See them, approve or pay early in the <Link className="underline" href="/hub/money">payout queue</Link>.</> : "Admins approve and pay them in Money."}</p>
    </div>
  );
}
