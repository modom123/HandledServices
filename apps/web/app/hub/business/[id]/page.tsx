/*
 * FILE    : apps/web/app/hub/business/[id]/page.tsx
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-04_1934 UTC
 * UPDATED : 2026-10-06_0841 UTC — scope of work from the Request for Proposal, and what to ask on the follow-up call.
 * PURPOSE : Handled Hub → one business account: billing (prepay, or invoicing on terms approved case by case
 *           with a reason and credit limit; hold), open balance and invoices, priority dispatch, pilot offer,
 *           properties, members, dedicated pros and recent jobs.
 * UPDATED : 2026-10-05_2141 UTC — Notes & history: permanent conversation log for the account, plus its history as a lead.
 */
import Link from "next/link";
import { notFound } from "next/navigation";
import { BUSINESS_TERMS, getService, money, rfpFollowUp, rfpSummary, URGENCY, type RfpScope } from "@handled/core";
import { adminClient } from "@/lib/supabase/server";
import { openBalance, type BusinessAccount, type Property } from "@/lib/business";
import { Badge, Stat, StatusBadge, fmtDate } from "@/components/ui";
import { timeline } from "@/lib/notes";
import { AddNote, Timeline } from "@/components/AccountNotes";
import { AddMemberHub, AddPropertyHub, DedicatedHub, PilotControl, RunInvoices, StatusSelect, TermsControl, Toggle } from "@/components/HubBusiness";

export const dynamic = "force-dynamic";

export default async function HubBusinessAccount({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = adminClient();
  const { data } = await db.from("business_accounts").select("*").eq("id", id).maybeSingle();
  if (!data) notFound();
  const a = data as BusinessAccount & { locations: number; services_needed: string[]; notes: string | null; monthly_budget?: number | null; start_by?: string | null; rfp_scope?: RfpScope | null; preferred_contact?: string | null };
  const [{ data: props }, { data: members }, { data: ded }, { data: pros }, { data: jobs }, { data: invoices }, balance] = await Promise.all([
    db.from("business_properties").select("*").eq("account_id", id).order("created_at"),
    db.from("business_members").select("id, email, role, profile_id").eq("account_id", id),
    db.from("business_pros").select("contractor_id").eq("account_id", id),
    db.from("contractors").select("id, business_name").eq("status", "approved").order("business_name"),
    db.from("jobs").select("id, ref, service_slug, status, scheduled_date, price_final, billed_on_terms, paid_at").eq("business_account_id", id).order("created_at", { ascending: false }).limit(50),
    db.from("business_invoices").select("*").eq("account_id", id).order("issued_on", { ascending: false }),
    openBalance(id),
  ]);
  const history = await timeline("business_account", id);
  const jobRows = (jobs ?? []) as { id: string; ref: string; service_slug: string; status: string; scheduled_date: string | null; price_final: number | null; billed_on_terms: boolean; paid_at: string | null }[];
  const lifetime = jobRows.filter((j) => j.status === "completed").reduce((t, j) => t + Number(j.price_final ?? 0), 0);
  const paidInvoices = ((invoices ?? []) as { status: string; due_date: string; paid_at: string | null }[]).filter((i) => i.status === "paid");
  const late = paidInvoices.filter((i) => i.paid_at && i.paid_at.slice(0, 10) > i.due_date).length;
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/hub/customers" className="text-xs text-ink-soft">← Customers</Link>
          <h1 className="text-2xl font-bold">{a.company}</h1>
          <p className="text-sm text-ink-soft">{a.contact_name} · {a.email}{a.phone ? ` · ${a.phone}` : ""}{a.industry ? ` · ${a.industry}` : ""} · {a.locations} location(s)</p>
          {a.services_needed?.length > 0 && <p className="text-xs text-ink-soft">Asked about: {a.services_needed.map((s) => getService(s)?.name ?? s).join(", ")}</p>}
          {a.notes && <p className="text-xs text-ink-soft">“{a.notes}”</p>}
        </div>
        <div className="flex items-center gap-2"><StatusSelect id={id} status={a.status} /><Toggle id={id} action="priority" on={a.priority} labels={["Turn on priority dispatch", "Priority dispatch: on"]} /></div>
      </div>

      {a.rfp_scope && (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="card text-sm">
            <div className="font-semibold">📋 Scope of work (from their request)</div>
            <ul className="mt-2 space-y-1">{rfpSummary(a.rfp_scope, { locations: a.locations, industry: a.industry, startBy: URGENCY.find((u) => u.id === a.start_by)?.label ?? a.start_by, budget: a.monthly_budget ?? null }).map((l) => <li key={l}>{l}</li>)}</ul>
          </div>
          <div className="card border-amber-300 bg-amber-50 text-sm">
            <div className="font-semibold">📞 Ask on the follow-up call</div>
            <ul className="mt-2 list-disc space-y-1 pl-5">{rfpFollowUp(a.rfp_scope, { locations: a.locations, budget: a.monthly_budget ?? null, phone: a.phone }).map((q) => <li key={q}>{q}</li>)}</ul>
            <p className="mt-2 text-xs text-ink-soft">Then: walkthrough → written proposal per site → set status to “proposal”.</p>
          </div>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-4">
        <Stat label="Lifetime (completed)" value={money(lifetime)} hint={`${jobRows.filter((j) => j.status === "completed").length} jobs (recent 50)`} />
        <Stat label="Open balance" value={money(balance)} hint={a.billing_mode === "terms" ? `limit ${money(Number(a.credit_limit))}` : "prepay"} />
        <Stat label="Invoices paid" value={`${paidInvoices.length}`} hint={`${late} paid late`} />
        <Stat label="Billing" value={a.billing_mode === "terms" ? `Net ${a.terms_days}` : "Prepay"} hint={a.terms_hold ? "ON HOLD (overdue)" : a.terms_approved_by ? `approved by ${a.terms_approved_by} ${a.terms_approved_at?.slice(0, 10)}` : a.terms_requested_at ? `requested ${a.terms_requested_at.slice(0, 10)}` : "—"} />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <div className="card space-y-3">
          <div className="font-semibold">Billing: invoicing is case by case</div>
          <p className="text-xs text-ink-soft">Every account starts on prepay. Approve terms only with a reason (history with us, size, references or a credit check) and a credit limit. Jobs go on the invoice only while the account is within its limit and not on hold; overdue invoices put it on hold automatically after {BUSINESS_TERMS.holdAfterDaysOverdue} days, and paying lifts it.</p>
          {a.terms_requested_at && a.billing_mode !== "terms" && <p className="rounded-lg bg-amber-50 p-2 text-sm">They asked for invoicing on {a.terms_requested_at.slice(0, 10)}.</p>}
          <TermsControl id={id} mode={a.billing_mode} days={a.terms_days} limit={Number(a.credit_limit)} note={a.terms_note} hold={a.terms_hold} />
          <div className="border-t border-line pt-3"><div className="text-sm font-semibold">Pilot offer</div><PilotControl id={id} pct={a.pilot_discount_pct} jobs={a.pilot_jobs_left} /></div>
        </div>
        <div className="card space-y-3">
          <div className="flex items-center justify-between"><div className="font-semibold">Invoices</div><RunInvoices /></div>
          <ul className="divide-y divide-line text-sm">{((invoices ?? []) as { id: string; number: string; period_start: string; period_end: string; total: number; amount_paid: number; due_date: string; status: string; reminders_sent: number; payment_url: string | null }[]).map((i) => (
            <li key={i.id} className="flex flex-wrap justify-between gap-2 py-1.5"><span><b>{i.number}</b> · {i.period_start}–{i.period_end}</span><span>{money(Number(i.total))} · due {i.due_date} · <Badge tone={i.status === "paid" ? "green" : "amber"}>{i.status}</Badge>{i.reminders_sent ? <span className="ml-1 text-xs text-ink-soft">{i.reminders_sent} reminder(s)</span> : null}</span></li>
          ))}{!(invoices ?? []).length && <li className="py-1.5 text-ink-soft">No invoices yet.</li>}</ul>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <div className="card space-y-2">
          <div className="font-semibold">Properties</div>
          <ul className="text-sm">{((props ?? []) as Property[]).map((p) => <li key={p.id} className={p.active ? "" : "opacity-50"}><b>{p.name}</b> · {p.address}, {p.city} {p.zip}{p.access_notes ? ` · ${p.access_notes}` : ""}</li>)}</ul>
          <AddPropertyHub id={id} />
        </div>
        <div className="card space-y-2">
          <div className="font-semibold">Members</div>
          <ul className="text-sm">{((members ?? []) as { id: string; email: string; role: string; profile_id: string | null }[]).map((m) => <li key={m.id}>{m.email} · {m.role}{m.profile_id ? "" : " · not signed in yet"}</li>)}</ul>
          <AddMemberHub id={id} />
          <div className="border-t border-line pt-2 font-semibold">Dedicated pros (first look on this account’s jobs)</div>
          <DedicatedHub id={id} pros={((pros ?? []) as { id: string; business_name: string }[]).map((p) => ({ id: p.id, name: p.business_name }))} current={((ded ?? []) as { contractor_id: string }[]).map((d) => d.contractor_id)} />
        </div>
      </div>

      <div className="card overflow-x-auto p-0"><div className="p-4 font-semibold">Jobs</div><table className="w-full text-sm"><tbody>
        {jobRows.map((j) => <tr key={j.id} className="border-t border-line"><td className="p-3"><Link href={`/hub/jobs/${j.id}`} className="underline">{j.ref}</Link></td><td className="p-3">{getService(j.service_slug)?.name}</td><td className="p-3 text-xs">{fmtDate(j.scheduled_date)}</td><td className="p-3"><StatusBadge status={j.status as never} /></td><td className="p-3 text-right">{money(Number(j.price_final ?? 0))} {j.billed_on_terms ? <span className="text-xs text-ink-soft">{j.paid_at ? "invoiced · paid" : "invoiced"}</span> : null}</td></tr>)}
      </tbody></table></div>

      <section className="card space-y-3">
        <h2 className="text-lg font-bold">Notes &amp; history ({history.length})</h2>
        <AddNote subjectType="business_account" subjectId={id} />
        <Timeline items={history} />
      </section>
    </div>
  );
}
