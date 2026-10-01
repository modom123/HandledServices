/*
 * FILE    : apps/web/app/hub/network/page.tsx
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-01_2000 UTC
 * PURPOSE : Pro Network — the workforce as the company's core asset: size and coverage,
 *           value generated, quality, retention, hiring funnel, compliance risk, and the
 *           year-end 1099 worksheet.
 */
import Link from "next/link";
import { TRADES, money, necThreshold, onboardingChecklist, type Contractor } from "@handled/core";
import { getViewer } from "@/lib/auth";
import { Badge, Empty, Stat } from "@/components/ui";

type Rec = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

export default async function Network() {
  const v = await getViewer();
  if (!v) return null;
  const year = new Date().getFullYear();
  const [{ data: pros }, { data: cards }, { data: apps }, { data: tax }] = await Promise.all([
    v.db.from("contractors").select("*"),
    v.db.from("contractor_scorecard").select("*"),
    v.db.from("contractor_applications").select("status, created_at").gte("created_at", new Date(Date.now() - 90 * 86400000).toISOString()),
    v.db.from("contractor_1099").select("*").eq("tax_year", year).order("paid_total", { ascending: false }),
  ]);
  const list = (pros ?? []) as Contractor[];
  const byId = new Map(((cards ?? []) as Rec[]).map((c) => [c.contractor_id, c]));
  const active = list.filter((p) => p.status === "approved");
  const working = active.filter((p) => { const c = byId.get(p.id); return c?.last_job_at && new Date(c.last_job_at).getTime() > Date.now() - 30 * 86400000; });
  const take90 = ((cards ?? []) as Rec[]).reduce((t, c) => t + Number(c.take_90d ?? 0), 0);
  const ranked = [...active].sort((a, b) => Number(byId.get(b.id)?.take_90d ?? 0) - Number(byId.get(a.id)?.take_90d ?? 0));
  const atRisk = list.filter((p) => p.status !== "suspended").map((p) => {
    const ob = onboardingChecklist(p as never);
    const c = byId.get(p.id);
    const issues = [
      ...ob.steps.filter((s) => s.expiring).map((s) => `${s.label} expiring`),
      ...(p.status === "approved" && !ob.complete ? ob.steps.filter((s) => !s.done).map((s) => `missing: ${s.label}`) : []),
      ...(p.rating < 4.5 ? [`rating ${p.rating}`] : []),
      ...(p.status === "approved" && (!c?.last_job_at || new Date(c.last_job_at).getTime() < Date.now() - 30 * 86400000) ? ["no jobs in 30 days"] : []),
      ...(Number(c?.redos ?? 0) >= 3 ? [`${c?.redos} redos`] : []),
    ];
    return { p, issues };
  }).filter((x) => x.issues.length);
  const coverage = TRADES.map((t) => ({ t, n: active.filter((p) => p.trades.includes(t.id)).length, cap: active.filter((p) => p.trades.includes(t.id)).reduce((s, p) => s + p.daily_capacity, 0) }));
  const funnel = { applied: (apps ?? []).length, approved: (apps ?? []).filter((a: Rec) => a.status === "approved").length, vetting: list.filter((p) => p.status === "vetting").length, active: active.length };
  const threshold = necThreshold(year);

  return (
    <div className="space-y-8">
      <div><h1 className="text-2xl font-bold">Pro Network</h1><p className="text-sm text-ink-soft">Our independent subcontractors are the core asset. Track their value, quality, compliance and pay here.</p></div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Stat label="Active pros" value={active.length} hint={`${working.length} worked in last 30 days (${active.length ? Math.round((working.length / active.length) * 100) : 0}% utilization)`} />
        <Stat label="Take generated (90d)" value={money(take90)} hint={`${money(active.length ? take90 / active.length : 0)} per active pro`} />
        <Stat label="Daily capacity" value={`${active.reduce((s, p) => s + p.daily_capacity, 0)} jobs`} />
        <Stat label="Hiring funnel (90d)" value={`${funnel.applied} → ${funnel.active}`} hint={`${funnel.approved} approved · ${funnel.vetting} in onboarding`} />
        <Stat label="At-risk pros" value={<span className={atRisk.length ? "text-amber-600" : ""}>{atRisk.length}</span>} hint="Compliance, quality or inactivity" />
      </div>

      <section>
        <h2 className="mb-3 font-bold">Coverage by trade</h2>
        <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-5">{coverage.map(({ t, n, cap }) => (
          <div key={t.id} className={`card p-3 text-sm ${n < 2 ? "border-amber-300" : ""}`}><div className="font-semibold">{t.label}</div><div className="text-ink-soft">{n} pros · {cap}/day{n < 2 ? " · recruit" : ""}</div></div>
        ))}</div>
      </section>

      <section>
        <h2 className="mb-3 font-bold">Most valuable pros (90 days)</h2>
        <div className="card overflow-x-auto p-0"><table className="w-full text-sm">
          <thead className="bg-paper text-left text-xs uppercase tracking-wide text-ink-soft"><tr><th className="p-3">Pro</th><th className="p-3">Take (90d)</th><th className="p-3">Jobs (90d)</th><th className="p-3">Lifetime bookings</th><th className="p-3">Rating</th><th className="p-3">QA pass</th><th className="p-3">Redos</th></tr></thead>
          <tbody>{ranked.slice(0, 25).map((p) => { const c = byId.get(p.id) ?? {}; return (
            <tr key={p.id} className="border-t border-line"><td className="p-3"><Link className="font-semibold underline" href={`/hub/pros/${p.id}`}>{p.business_name}</Link></td><td className="p-3">{money(Number(c.take_90d ?? 0))}</td><td className="p-3">{c.jobs_90d ?? 0}</td><td className="p-3">{money(Number(c.bookings_generated ?? 0))}</td><td className="p-3">{p.rating} ★</td><td className="p-3">{Number(c.qa_checked) ? `${Math.round((Number(c.qa_passed) / Number(c.qa_checked)) * 100)}%` : "—"}</td><td className="p-3">{c.redos ?? 0}</td></tr>
          ); })}</tbody>
        </table></div>
      </section>

      <section>
        <h2 className="mb-3 font-bold">At risk</h2>
        {!atRisk.length && <Empty>No compliance, quality or activity issues.</Empty>}
        <div className="space-y-2">{atRisk.map(({ p, issues }) => (
          <Link key={p.id} href={`/hub/pros/${p.id}`} className="card flex flex-wrap items-center justify-between gap-2 p-4 text-sm hover:border-brand"><b>{p.business_name}</b><span className="flex flex-wrap gap-1">{issues.map((i) => <Badge key={i} tone="amber">{i}</Badge>)}</span></Link>
        ))}</div>
      </section>

      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-bold">1099 — {year} <span className="text-sm font-normal text-ink-soft">1099-NEC required at {money(threshold)}+ (confirm with your accountant)</span></h2>
          <a className="btn-ghost" href={`/api/hub/1099?year=${year}`}>Download 1099 worksheet (CSV)</a>
        </div>
        <div className="card overflow-x-auto p-0"><table className="w-full text-sm">
          <thead className="bg-paper text-left text-xs uppercase tracking-wide text-ink-soft"><tr><th className="p-3">Pro</th><th className="p-3">Legal name / entity</th><th className="p-3">TIN</th><th className="p-3">W-9</th><th className="p-3">Paid (net)</th><th className="p-3">Owed</th><th className="p-3">1099-NEC</th></tr></thead>
          <tbody>{((tax ?? []) as Rec[]).map((r) => { const paid = Number(r.paid_total ?? 0); return (
            <tr key={r.contractor_id} className="border-t border-line"><td className="p-3 font-medium">{r.business_name}</td><td className="p-3">{r.legal_name ?? "—"} · {r.entity_type ?? "—"}</td><td className="p-3">•••{r.tin_last4 ?? "—"}</td><td className="p-3">{r.w9_received_at ? <Badge tone="green">on file</Badge> : <Badge tone="red">missing</Badge>}</td><td className="p-3">{money(paid)}</td><td className="p-3">{money(Number(r.owed_total ?? 0))}</td><td className="p-3">{paid >= threshold ? (["c_corp", "s_corp"].includes(r.entity_type) ? "corp — usually exempt" : <Badge tone="brand">required</Badge>) : "—"}</td></tr>
          ); })}{!(tax ?? []).length && <tr><td className="p-3 text-ink-soft">No payouts yet this year.</td></tr>}</tbody>
        </table></div>
      </section>
    </div>
  );
}
