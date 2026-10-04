/*
 * FILE    : apps/web/app/(site)/account/business/page.tsx
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : TSTAMP UTC
 * PURPOSE : Business account portal (property managers, brokerages, stagers, stores, storage):
 *           billing status (prepay or invoiced on approved terms, credit limit, open balance), pilot
 *           offer, properties with one-tap booking, recent jobs, pros who worked for the account
 *           (choose dedicated pros), invoices with payment links, and the team.
 */
import Link from "next/link";
import { redirect } from "next/navigation";
import { getService, money, termsDecision } from "@handled/core";
import { getViewer } from "@/lib/auth";
import { myAccounts, openBalance, type Property } from "@/lib/business";
import { adminClient } from "@/lib/supabase/server";
import { Badge, Empty, StatusBadge, fmtDate } from "@/components/ui";
import { AddProperty, BillingEmail, DedicatedToggle, InviteMember, PropertyActive, RemoveMember, RequestTerms } from "@/components/BusinessPortal";

export const metadata = { title: "Business account" };
export const dynamic = "force-dynamic";

type JobRow = { id: string; ref: string; service_slug: string; status: string; scheduled_date: string | null; price_final: number | null; business_property_id: string | null; customer_id: string | null; contractor_id: string | null; billed_on_terms: boolean; contractors: { business_name: string; rating: number } | null };

export default async function BusinessAccount() {
  const v = await getViewer();
  if (!v) redirect("/login?next=/account/business");
  const accounts = await myAccounts(v);
  if (!accounts.length) return (
    <div className="wrap py-14"><div className="card max-w-xl"><h1 className="text-2xl font-bold">No business account yet</h1>
      <p className="mt-2 text-ink-soft">Business accounts are for property managers, real estate teams, stagers, stores and facilities: properties on file, one-tap booking, dedicated pros and (when approved) monthly invoicing. You’re signed in as {v.email}.</p>
      <div className="mt-4 flex gap-3"><Link href="/business" className="btn-primary">Set up a business account</Link><Link href="/account" className="btn-ghost">My bookings</Link></div></div></div>
  );
  const db = adminClient();
  return (
    <div className="wrap space-y-10 py-12">
      {await Promise.all(accounts.map(async ({ account: a, role }) => {
        const [{ data: props }, { data: jobs }, { data: invoices }, { data: members }, { data: dedicated }, balance] = await Promise.all([
          db.from("business_properties").select("*").eq("account_id", a.id).order("created_at"),
          db.from("jobs").select("id, ref, service_slug, status, scheduled_date, price_final, business_property_id, customer_id, contractor_id, billed_on_terms, contractors(business_name, rating)").eq("business_account_id", a.id).order("created_at", { ascending: false }).limit(40),
          db.from("business_invoices").select("*").eq("account_id", a.id).order("issued_on", { ascending: false }).limit(24),
          db.from("business_members").select("id, email, role, profile_id").eq("account_id", a.id).order("created_at"),
          db.from("business_pros").select("contractor_id").eq("account_id", a.id),
          openBalance(a.id),
        ]);
        const properties = (props ?? []) as Property[];
        const jobRows = (jobs ?? []) as unknown as JobRow[];
        const dedicatedIds = new Set(((dedicated ?? []) as { contractor_id: string }[]).map((d) => d.contractor_id));
        const pros = new Map<string, { name: string; rating: number; jobs: number }>();
        for (const j of jobRows) if (j.contractor_id && j.status === "completed" && j.contractors) pros.set(j.contractor_id, { name: j.contractors.business_name, rating: Number(j.contractors.rating), jobs: (pros.get(j.contractor_id)?.jobs ?? 0) + 1 });
        const onTerms = a.billing_mode === "terms";
        const canInvoice = onTerms && termsDecision(a, balance, 0).onTerms;
        const admin = role === "admin";
        return (
          <section key={a.id} className="space-y-6">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div><h1 className="text-3xl font-extrabold tracking-tight">{a.company}</h1><p className="text-sm text-ink-soft">Business account · you’re {admin ? "an admin" : "a booker"}</p></div>
              <div className="flex flex-wrap gap-2 text-sm">
                <Badge tone={onTerms ? (canInvoice ? "green" : "amber") : "slate"}>{onTerms ? (a.terms_hold ? "Invoicing on hold" : `Invoiced · Net ${a.terms_days}`) : "Pay at booking"}</Badge>
                {a.priority && <Badge tone="brand">Priority dispatch</Badge>}
                {a.pilot_jobs_left > 0 && a.pilot_discount_pct > 0 && <Badge tone="brand">Pilot: {a.pilot_discount_pct}% off {a.pilot_jobs_left} more job{a.pilot_jobs_left === 1 ? "" : "s"}</Badge>}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="card"><div className="text-xs font-semibold uppercase tracking-wide text-ink-soft">Open balance</div><div className="mt-1 text-2xl font-bold">{money(balance)}</div><div className="text-xs text-ink-soft">{onTerms ? `credit limit ${money(Number(a.credit_limit))}` : "prepay: nothing owed"}</div></div>
              <div className="card"><div className="text-xs font-semibold uppercase tracking-wide text-ink-soft">Properties</div><div className="mt-1 text-2xl font-bold">{properties.filter((p) => p.active).length}</div></div>
              <div className="card"><div className="text-xs font-semibold uppercase tracking-wide text-ink-soft">Jobs</div><div className="mt-1 text-2xl font-bold">{jobRows.length}</div><div className="text-xs text-ink-soft">{jobRows.filter((j) => j.status === "completed").length} completed (recent)</div></div>
            </div>

            <div className="card space-y-3">
              <div className="font-semibold">Properties</div>
              {!properties.length && <Empty>Add your first property to book in one tap.</Empty>}
              <ul className="divide-y divide-line">{properties.map((p) => (
                <li key={p.id} className={`flex flex-wrap items-center justify-between gap-2 py-2 text-sm ${p.active ? "" : "opacity-50"}`}>
                  <div><b>{p.name}</b> · {p.address}, {p.city} {p.zip}{p.units ? ` · ${p.units} units` : ""}{p.access_notes && <div className="text-xs text-ink-soft">Access: {p.access_notes}</div>}</div>
                  <div className="flex items-center gap-3">
                    {p.active && ["unit-turnover", "house-cleaning", "junk-removal", "handyman"].map((s) => <Link key={s} href={`/book?service=${s}&property=${p.id}`} className="text-xs font-semibold text-brand underline">{getService(s)?.name}</Link>)}
                    {p.active && <Link href={`/book?property=${p.id}`} className="btn-primary px-3 py-1 text-xs">Book</Link>}
                    <PropertyActive accountId={a.id} id={p.id} active={p.active} />
                  </div>
                </li>
              ))}</ul>
              <AddProperty accountId={a.id} />
            </div>

            <div className="card overflow-x-auto p-0">
              <div className="p-4 font-semibold">Recent jobs</div>
              {!jobRows.length ? <div className="px-4 pb-4"><Empty>No jobs yet.</Empty></div> : (
                <table className="w-full text-sm"><tbody>{jobRows.map((j) => (
                  <tr key={j.id} className="border-t border-line">
                    <td className="p-3">{j.customer_id === v.userId ? <Link href={`/account/jobs/${j.id}`} className="font-medium underline">{j.ref}</Link> : j.ref}</td>
                    <td className="p-3">{getService(j.service_slug)?.name}</td>
                    <td className="p-3 text-xs">{properties.find((p) => p.id === j.business_property_id)?.name ?? "—"}</td>
                    <td className="p-3 text-xs">{fmtDate(j.scheduled_date)}</td>
                    <td className="p-3"><StatusBadge status={j.status as never} /></td>
                    <td className="p-3 text-right">{money(Number(j.price_final ?? 0))}{j.billed_on_terms ? <span className="ml-1 text-xs text-ink-soft">invoiced</span> : null}</td>
                  </tr>
                ))}</tbody></table>
              )}
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <div className="card space-y-2">
                <div className="font-semibold">Your pros</div>
                <p className="text-xs text-ink-soft">Dedicated pros see your jobs first, for a short window, before anyone else. Choose from pros who have finished a job for you.</p>
                {!pros.size && <Empty>Pros appear here after your first completed job.</Empty>}
                <ul className="space-y-1 text-sm">{[...pros].map(([id, p]) => (
                  <li key={id} className="flex items-center justify-between gap-2"><span>{p.name} · {p.rating.toFixed(1)}★ · {p.jobs} job{p.jobs === 1 ? "" : "s"}</span>{admin ? <DedicatedToggle accountId={a.id} contractorId={id} on={dedicatedIds.has(id)} /> : dedicatedIds.has(id) ? <span className="text-xs text-brand">★ Dedicated</span> : null}</li>
                ))}</ul>
              </div>

              <div className="card space-y-2">
                <div className="font-semibold">Billing</div>
                {onTerms
                  ? <p className="text-sm text-ink-soft">Jobs go on a monthly invoice, due {a.terms_days} days after it’s issued (on the 1st). Credit limit {money(Number(a.credit_limit))}.{a.terms_hold ? " Invoicing is on hold until the overdue invoice is paid; bookings are paid at booking meanwhile." : ""}</p>
                  : <RequestTerms accountId={a.id} requested={Boolean(a.terms_requested_at)} />}
                {admin && <div><div className="text-xs font-semibold uppercase tracking-wide text-ink-soft">Invoices go to</div><BillingEmail accountId={a.id} current={a.billing_email ?? a.email} /></div>}
                <ul className="divide-y divide-line text-sm">{((invoices ?? []) as { id: string; number: string; period_start: string; period_end: string; total: number; amount_paid: number; due_date: string; status: string; payment_url: string | null }[]).map((i) => (
                  <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <span><b>{i.number}</b> · {i.period_start} to {i.period_end}</span>
                    <span className="flex items-center gap-2">{money(Number(i.total))} · due {i.due_date} · <Badge tone={i.status === "paid" ? "green" : i.due_date < new Date().toISOString().slice(0, 10) ? "red" : "amber"}>{i.status === "open" && i.due_date < new Date().toISOString().slice(0, 10) ? "overdue" : i.status}</Badge>
                      {i.status === "open" && i.payment_url && <a href={i.payment_url} className="btn-primary px-3 py-1 text-xs">Pay</a>}</span>
                  </li>
                ))}</ul>
              </div>
            </div>

            <div className="card space-y-2">
              <div className="font-semibold">Team</div>
              <ul className="text-sm">{((members ?? []) as { id: string; email: string; role: string; profile_id: string | null }[]).map((m) => (
                <li key={m.id} className="flex items-center justify-between py-1"><span>{m.email} · {m.role === "admin" ? "admin" : "can book"}{m.profile_id ? "" : " · invited"}</span>{admin && <RemoveMember accountId={a.id} id={m.id} />}</li>
              ))}</ul>
              {admin && <InviteMember accountId={a.id} />}
            </div>
          </section>
        );
      }))}
    </div>
  );
}
