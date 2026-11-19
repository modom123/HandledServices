/*
 * FILE    : apps/web/app/hub/scorecard/page.tsx
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-11-18_0215 UTC
 * PURPOSE : Handled Hub → Sales scorecard (admins): Handled's AI sales & marketing team against the outside sales force
 *           (Sales Force reps and referral partners), on the same numbers — new clients, revenue, Handled's profit, sales
 *           cost, profit after sales cost, cost per new client and return on sales cost — over 30 / 90 / 365 days, plus
 *           the pipeline (sales emails, replies, walkthroughs booked and held). Rules: core sales-scorecard.ts.
 */
import Link from "next/link";
import { SALES_TEAMS, money } from "@handled/core";
import { adminOnly } from "@/components/AdminOnly";
import { salesScorecard } from "@/lib/sales-scorecard";

export const dynamic = "force-dynamic";
const WINDOWS = [30, 90, 365];
const x = (n: number | null) => (n == null ? "—" : `${n.toFixed(1)}×`);
const m = (n: number | null) => (n == null ? "—" : money(n));

export default async function Scorecard({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  const gate = await adminOnly(); if (gate) return gate;
  const days = WINDOWS.includes(Number((await searchParams).days)) ? Number((await searchParams).days) : 90;
  const s = await salesScorecard(days);
  const g = s.totals;
  const Side = ({ title, sub, t }: { title: string; sub: string; t: typeof g.ai }) => (
    <div className="card">
      <div className="text-xs font-semibold uppercase tracking-wide text-brand">{title}</div>
      <p className="text-xs text-ink-soft">{sub}</p>
      <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
        {[["New clients", String(t.newClients)], ["Revenue", money(t.revenue)], ["Profit after sales cost", money(t.profitAfterCost)], ["Sales cost", money(t.cost)], ["Cost per new client", m(t.costPerClient)], ["Return on sales cost", x(t.roi)]].map(([k, v]) => (
          <div key={k} className="rounded-lg bg-paper p-2"><div className="text-[11px] text-ink-soft">{k}</div><div className="text-lg font-bold">{v}</div></div>
        ))}
      </div>
    </div>
  );
  const winner = g.ai.profitAfterCost === g.outside.profitAfterCost ? null : g.ai.profitAfterCost > g.outside.profitAfterCost ? "AI team" : "Outside sales force";
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Sales scorecard: AI team vs outside sales force</h1>
          <p className="max-w-3xl text-sm text-ink-soft">Every paid job counts for exactly one team. Profit is what Handled keeps after the pro (completed jobs). Sales cost is AI usage for the AI teams, and commissions plus Sales Force pay (team shares, walkthroughs, bonuses) for partners. Ad spend isn&apos;t tracked here.</p>
        </div>
        <div className="flex gap-1 text-sm">{WINDOWS.map((d) => <Link key={d} href={`/hub/scorecard?days=${d}`} className={`rounded-lg px-3 py-1 ${d === days ? "bg-brand text-white" : "border border-line"}`}>{d} days</Link>)}</div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Side title="Handled AI sales & marketing team" sub="AI sales emails, AI replies, deal hunter; website, ads and social answered by the AI" t={g.ai} />
        <Side title="Outside sales force" sub={`Sales Force reps${s.activeReps != null ? ` (${s.activeReps} active)` : ""} and referral partners`} t={g.outside} />
      </div>
      {winner && <p className="text-sm"><b>{winner}</b> brought in more profit after sales cost over the last {days} days ({money(Math.abs(g.ai.profitAfterCost - g.outside.profitAfterCost))} more).</p>}

      <div className="card overflow-x-auto p-0">
        <table className="w-full min-w-[820px] text-sm">
          <thead className="bg-paper text-left text-xs uppercase tracking-wide text-ink-soft"><tr><th className="p-3">Team</th><th className="p-3 text-right">New clients</th><th className="p-3 text-right">Jobs</th><th className="p-3 text-right">Revenue</th><th className="p-3 text-right">Profit</th><th className="p-3 text-right">Sales cost</th><th className="p-3 text-right">Profit after cost</th><th className="p-3 text-right">Cost / new client</th><th className="p-3 text-right">Avg job</th><th className="p-3 text-right">Return</th></tr></thead>
          <tbody>{s.teams.map((t) => (
            <tr key={t.team} className="border-t border-line">
              <td className="p-3"><div className="font-semibold">{SALES_TEAMS[t.team].label}</div><div className="text-xs text-ink-soft">{SALES_TEAMS[t.team].who}</div></td>
              <td className="p-3 text-right tabular-nums">{t.newClients}</td>
              <td className="p-3 text-right tabular-nums">{t.jobs}</td>
              <td className="p-3 text-right tabular-nums">{money(t.revenue)}</td>
              <td className="p-3 text-right tabular-nums">{money(t.profit)}</td>
              <td className="p-3 text-right tabular-nums">{money(t.cost)}</td>
              <td className="p-3 text-right font-semibold tabular-nums">{money(t.profitAfterCost)}</td>
              <td className="p-3 text-right tabular-nums">{m(t.costPerClient)}</td>
              <td className="p-3 text-right tabular-nums">{m(t.avgJob)}</td>
              <td className="p-3 text-right tabular-nums">{x(t.roi)}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="card text-sm">
          <h2 className="font-bold">AI sales pipeline</h2>
          <ul className="mt-2 space-y-1">
            <li>Sales emails sent: <b>{s.pipeline.emailsSent}</b></li>
            <li>Replies: <b>{s.pipeline.replies}</b>{s.pipeline.emailsSent ? ` (${((s.pipeline.replies / s.pipeline.emailsSent) * 100).toFixed(1)}%)` : ""}</li>
            <li>Walkthroughs booked / held: <b>{s.pipeline.ai.booked} / {s.pipeline.ai.held}</b></li>
            <li>AI calls (sales & marketing agents): <b>{Object.values(s.aiCalls).reduce((a, b) => a + b, 0)}</b>{Object.keys(s.aiCalls).length ? ` · ${Object.entries(s.aiCalls).map(([k, v]) => `${k.replace(/_/g, " ")} ${v}`).join(", ")}` : ""}</li>
          </ul>
        </div>
        <div className="card text-sm">
          <h2 className="font-bold">Sales Force pipeline</h2>
          <ul className="mt-2 space-y-1">
            <li>Active reps: <b>{s.activeReps ?? "—"}</b></li>
            <li>Walkthroughs booked / held from reps&apos; links: <b>{s.pipeline.reps.booked} / {s.pipeline.reps.held}</b></li>
            <li>New clients from direct sales: <b>{s.teams.find((t) => t.team === "sales_force")?.newClients ?? 0}</b></li>
          </ul>
          <p className="mt-2 text-xs text-ink-soft"><Link href="/hub/sales-force" className="underline">Hub → Sales Force</Link> for ranks and the leaderboard.</p>
        </div>
      </section>
    </div>
  );
}
