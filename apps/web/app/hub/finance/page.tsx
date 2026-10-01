/*
 * FILE    : apps/web/app/hub/finance/page.tsx
 * PROJECT : Handled — AI-run home & business services
 * CREATED : 2026-10-01_1723 UTC
 * UPDATED : 2026-10-01_1830 UTC — Uber-style reporting: bookings vs our take vs net after
 *           card fees; take-rate band check per service; payouts held until collected.
 * PURPOSE : Unit economics — revenue, payouts, gross margin by service; payout queue;
 *           AI cost tracking from ai_runs.
 */
import { CARD_FEE, TAKE_MAX, TAKE_MIN, getService, money } from "@handled/core";
import { getViewer } from "@/lib/auth";
import { Empty, Stat } from "@/components/ui";
import { PayoutButton } from "@/components/HubActions";

type Rec = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

// Claude Opus 5.5 list price per million tokens (input / output) — update if pricing changes.
const AI_PRICE = { input: 4, output: 20 };

export default async function Finance() {
  const v = await getViewer();
  if (!v) return null;
  const since = new Date(Date.now() - 30 * 86400000).toISOString();
  const [{ data: done }, { data: payouts }, { data: runs }] = await Promise.all([
    v.db.from("jobs").select("service_slug, price_final, contractor_payout").eq("status", "completed").gte("completed_at", since),
    v.db.from("payouts").select("id, amount, status, kind, reason, created_at, contractors(business_name), jobs(ref)").in("status", ["approved", "pending", "held"]).order("created_at"),
    v.db.from("ai_runs").select("kind, input_tokens, output_tokens").gte("created_at", since),
  ]);
  const rows = new Map<string, { jobs: number; revenue: number; payout: number }>();
  for (const j of (done ?? []) as Rec[]) {
    const r = rows.get(j.service_slug) ?? { jobs: 0, revenue: 0, payout: 0 };
    r.jobs++; r.revenue += Number(j.price_final ?? 0); r.payout += Number(j.contractor_payout ?? 0);
    rows.set(j.service_slug, r);
  }
  const tot = [...rows.values()].reduce((t, r) => ({ jobs: t.jobs + r.jobs, revenue: t.revenue + r.revenue, payout: t.payout + r.payout }), { jobs: 0, revenue: 0, payout: 0 });
  const aiCost = (runs ?? []).reduce((t: number, r: Rec) => t + ((r.input_tokens ?? 0) * AI_PRICE.input + (r.output_tokens ?? 0) * AI_PRICE.output) / 1e6, 0);
  const fees = (done ?? []).reduce((t: number, j: Rec) => t + (Number(j.price_final ?? 0) > 0 ? Number(j.price_final) * CARD_FEE.pct + CARD_FEE.fixed : 0), 0);
  const take = tot.revenue - tot.payout;
  const outOfBand = (done ?? []).filter((j: Rec) => { const p = Number(j.price_final ?? 0); const r = p ? 1 - Number(j.contractor_payout ?? 0) / p : 1; return p > 0 && (r < TAKE_MIN - 0.001 || r > TAKE_MAX + 0.05); }).length;
  const owed = (payouts ?? []).filter((p: Rec) => p.status === "approved").reduce((t: number, p: Rec) => t + Number(p.amount), 0);
  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">Finance <span className="text-base font-normal text-ink-soft">last 30 days</span></h1>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Stat label="Bookings (customers paid)" value={money(tot.revenue)} hint={`${tot.jobs} completed jobs`} />
        <Stat label="Our take" value={money(take)} hint={tot.revenue ? `${Math.round((take / tot.revenue) * 100)}% avg take · band ${TAKE_MIN * 100}–${TAKE_MAX * 100}%` : `band ${TAKE_MIN * 100}–${TAKE_MAX * 100}%`} />
        <Stat label="Net after card fees" value={money(take - fees)} hint={`${money(fees)} est. processing · ${outOfBand} jobs outside band`} />
        <Stat label="Payouts owed" value={money(owed)} />
        <Stat label="AI cost" value={`$${aiCost.toFixed(2)}`} hint={`${runs?.length ?? 0} AI calls · ${tot.jobs ? `$${(aiCost / tot.jobs).toFixed(2)}/job` : ""}`} />
      </div>
      <div className="card overflow-x-auto p-0"><table className="w-full text-sm">
        <thead className="bg-paper text-left text-xs uppercase tracking-wide text-ink-soft"><tr><th className="p-3">Service</th><th className="p-3">Jobs</th><th className="p-3">Bookings</th><th className="p-3">Paid to pros</th><th className="p-3">Our take</th><th className="p-3">Take %</th><th className="p-3">Avg ticket</th></tr></thead>
        <tbody>{[...rows.entries()].sort((a, b) => b[1].revenue - a[1].revenue).map(([slug, r]) => (
          <tr key={slug} className="border-t border-line"><td className="p-3 font-medium">{getService(slug)?.name}</td><td className="p-3">{r.jobs}</td><td className="p-3">{money(r.revenue)}</td><td className="p-3">{money(r.payout)}</td><td className="p-3">{money(r.revenue - r.payout)}</td><td className="p-3">{r.revenue ? Math.round(((r.revenue - r.payout) / r.revenue) * 100) : 0}%</td><td className="p-3">{money(r.revenue / r.jobs)}</td></tr>
        ))}{!rows.size && <tr><td className="p-3 text-ink-soft">No completed jobs in the last 30 days.</td></tr>}</tbody>
      </table></div>
      <section>
        <h2 className="mb-1 font-bold">Payout queue</h2>
        <p className="mb-3 text-sm text-ink-soft">Pros are paid from money already collected: <b>approved</b> = customer charged · <b>pending</b> = confirm payment received first · <b>held</b> = customer charge failed.</p>
        {!(payouts ?? []).length && <Empty>Nothing owed.</Empty>}
        <div className="space-y-2">{(payouts ?? []).map((p: Rec) => (
          <div key={p.id} className="card flex items-center justify-between p-4 text-sm"><div><span className="font-semibold">{p.contractors?.business_name}</span> · {p.jobs?.ref ?? p.reason} · {p.kind && p.kind !== "job" ? `${String(p.kind).replace("_", "-")} · ` : ""}{p.status}</div><div className="flex items-center gap-3"><b>{money(p.amount)}</b><PayoutButton id={p.id} status={p.status} /></div></div>
        ))}</div>
      </section>
    </div>
  );
}
