/*
 * FILE    : apps/web/app/hub/talent/page.tsx
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-05_2034 UTC
 * PURPOSE : Handled Hub → Talent: the recruiting agency at a glance — open searches, pipeline, hires, fees billed and
 *           collected, what's owed to recruiters, new requests from the website, clients and new searches.
 */
import Link from "next/link";
import { SEARCH_STATUS_LABEL, TALENT_TERMS, money, type SearchStatus } from "@handled/core";
import { adminClient } from "@/lib/supabase/server";
import { Stat } from "@/components/ui";
import { NewClientForm, NewSearchForm } from "@/components/TalentUI";

export const dynamic = "force-dynamic";

export default async function TalentHub() {
  const db = adminClient();
  const [{ data: searches }, { data: clients }, { data: subs }, { data: placements }] = await Promise.all([
    db.from("talent_searches").select("id, title, status, type, created_at, salary_min, salary_max, talent_clients(company)").order("created_at", { ascending: false }).limit(300),
    db.from("talent_clients").select("id, company, contact_name, email, status, agreement_signed_at").order("company").limit(500),
    db.from("talent_submissions").select("search_id, stage, submitted_at").limit(5000),
    db.from("talent_placements").select("id, fee, recruiter_pay, platform, status, amount_paid, start_date, invoice_due, invoice_number, talent_searches(title), talent_clients(company), talent_candidates(full_name)").order("start_date", { ascending: false }).limit(300),
  ]);
  const S = searches ?? [], P = placements ?? [], U = subs ?? [];
  const count = (id: string, stages: string[]) => U.filter((x) => x.search_id === id && stages.includes(x.stage)).length;
  const month = new Date(); month.setUTCDate(1);
  const live = P.filter((p) => !["void", "refunded"].includes(p.status));
  const billed = live.reduce((t, p) => t + Number(p.fee), 0);
  const collected = live.filter((p) => p.status === "paid").reduce((t, p) => t + Number(p.fee), 0);
  const ours = live.reduce((t, p) => t + Number(p.platform), 0);
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Handled Talent</h1>
        <p className="max-w-3xl text-sm text-ink-soft">Recruiting as a service. Contingency {TALENT_TERMS.contingencyPct}% of first-year base salary (recruiter {TALENT_TERMS.recruiterPct}%, Handled {TALENT_TERMS.contingencyPct - TALENT_TERMS.recruiterPct}%), retained {TALENT_TERMS.retainedPct}% in three payments, {TALENT_TERMS.guaranteeDays}-day guarantee, {TALENT_TERMS.ownershipMonths}-month candidate ownership. Hires are invoiced on the start date; the recruiter&apos;s share goes out in the weekly payout once the client pays. Public page: <Link href="/talent" className="underline">/talent</Link>.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-6">
        <Stat label="Open searches" value={S.filter((s) => s.status === "open").length} />
        <Stat label="New requests" value={S.filter((s) => s.status === "intake").length} hint="call them today" />
        <Stat label="Submitted this month" value={U.filter((x) => x.submitted_at && new Date(x.submitted_at) >= month).length} />
        <Stat label="Interviewing" value={U.filter((x) => x.stage === "interview").length} />
        <Stat label="Fees billed / collected" value={`${money(billed)} / ${money(collected)}`} />
        <Stat label="Handled's share" value={money(ours)} />
      </div>
      <section>
        <h2 className="mb-2 text-lg font-bold">Searches</h2>
        {S.length ? (
          <div className="card overflow-x-auto p-0"><table className="w-full text-sm">
            <thead className="bg-paper text-left text-xs uppercase tracking-wide text-ink-soft"><tr><th className="p-3">Search</th><th className="p-3">Type</th><th className="p-3">Status</th><th className="p-3">In pipeline</th><th className="p-3">With client</th><th className="p-3">Interviewing</th></tr></thead>
            <tbody>{S.map((s) => (
              <tr key={s.id} className="border-t border-line">
                <td className="p-3"><Link href={`/hub/talent/${s.id}`} className="font-semibold text-brand hover:underline">{s.title}</Link><div className="text-xs text-ink-soft">{(s.talent_clients as unknown as { company: string } | null)?.company}{s.salary_max ? ` · up to ${money(Number(s.salary_max))}` : ""}</div></td>
                <td className="p-3 text-xs capitalize">{s.type}</td>
                <td className="p-3 text-xs">{SEARCH_STATUS_LABEL[s.status as SearchStatus]}</td>
                <td className="p-3 text-xs">{count(s.id, ["sourced", "screened"])}</td>
                <td className="p-3 text-xs">{count(s.id, ["submitted", "client_review"])}</td>
                <td className="p-3 text-xs">{count(s.id, ["interview", "offer"])}</td>
              </tr>
            ))}</tbody>
          </table></div>
        ) : <p className="text-sm text-ink-soft">No searches yet. Requests from /talent land here as “New request”.</p>}
      </section>
      {P.length > 0 && (
        <section>
          <h2 className="mb-2 text-lg font-bold">Hires</h2>
          <div className="card overflow-x-auto p-0"><table className="w-full text-sm">
            <thead className="bg-paper text-left text-xs uppercase tracking-wide text-ink-soft"><tr><th className="p-3">Hire</th><th className="p-3">Start</th><th className="p-3">Fee</th><th className="p-3">Recruiter / Handled</th><th className="p-3">Invoice</th><th className="p-3">Status</th></tr></thead>
            <tbody>{P.map((p) => (
              <tr key={p.id} className="border-t border-line">
                <td className="p-3">{(p.talent_candidates as unknown as { full_name: string }).full_name}<div className="text-xs text-ink-soft">{(p.talent_searches as unknown as { title: string }).title} · {(p.talent_clients as unknown as { company: string }).company}</div></td>
                <td className="p-3 text-xs">{p.start_date}</td>
                <td className="p-3 text-xs">{money(Number(p.fee))}</td>
                <td className="p-3 text-xs">{money(Number(p.recruiter_pay))} / {money(Number(p.platform))}</td>
                <td className="p-3 text-xs">{p.invoice_number ?? "on start date"}{p.invoice_due ? ` · due ${p.invoice_due}` : ""}</td>
                <td className="p-3 text-xs">{p.status.replace("_", " ")}</td>
              </tr>
            ))}</tbody>
          </table></div>
        </section>
      )}
      <section className="card"><h2 className="mb-3 text-lg font-bold">New search</h2><NewSearchForm clients={(clients ?? []).map((c) => ({ id: c.id, company: c.company }))} /></section>
      <section className="card">
        <h2 className="mb-3 text-lg font-bold">Clients</h2>
        {(clients ?? []).length > 0 && <ul className="mb-3 divide-y divide-line text-sm">{(clients ?? []).map((c) => <li key={c.id} className="py-1">{c.company} · {c.contact_name} · {c.email} <span className="text-xs text-ink-soft">· {c.status}{c.agreement_signed_at ? " · agreement signed" : " · agreement not signed"}</span></li>)}</ul>}
        <NewClientForm />
      </section>
    </div>
  );
}
