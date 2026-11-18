/*
 * FILE    : apps/web/app/hub/sales-force/page.tsx
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-11-18_0105 UTC
 * PURPOSE : Handled Hub → Sales Force (admins): every rep with rank, team, totals since day one (profit made for Handled,
 *           deals, clients, team profit), what's left to the next rank, and the 90-day revenue leaderboard. Set ranks
 *           (approve VP), teams, add partners, run the promotion check. Rules: core sales-force.ts. 1099 contractors.
 */
import Link from "next/link";
import { LEADERBOARD, SALES_RANKS, leaderboard, money, nextRanks, promotionGaps } from "@handled/core";
import { adminOnly } from "@/components/AdminOnly";
import { adminClient } from "@/lib/supabase/server";
import { repTotals, salesForceReady } from "@/lib/sales-force";
import { Stat } from "@/components/ui";
import { JoinSalesForce, RepControls } from "@/components/SalesForceAdmin";

export const dynamic = "force-dynamic";

export default async function SalesForceHub() {
  const gate = await adminOnly(); if (gate) return gate;
  if (!(await salesForceReady())) return <div className="card max-w-2xl text-sm"><h1 className="text-xl font-bold">The Sales Force isn&apos;t switched on yet</h1><p className="mt-2 text-ink-soft">Run <code>supabase/setup/ADD_SALES_FORCE_2026-11-18_0105.sql</code> in Supabase → SQL Editor (after the walkthroughs SQL), then reload.</p></div>;
  const [{ all, totals }, { data: others }, { data: pay }] = await Promise.all([
    repTotals(),
    adminClient().from("referral_partners").select("id, name").is("sales_rank", null).eq("status", "active").order("name").limit(2000),
    adminClient().from("sales_pay").select("amount, status").neq("status", "void").limit(100000),
  ]);
  const board = leaderboard(all.filter((m) => m.status === "active").map((m) => ({ id: m.id, name: m.name, rank: m.sales_rank, revenue90: totals.get(m.id)!.revenue90 })));
  const nameOf = new Map(all.map((m) => [m.id, m.name]));
  const leaders = all.filter((m) => m.status === "active").map((m) => [m.id, m.name] as [string, string]);
  const sum = (s: string) => (pay ?? []).filter((p: { status: string }) => p.status === s).reduce((t: number, p: { amount: number }) => t + Number(p.amount), 0);
  const sorted = [...all].sort((a, b) => (totals.get(b.id)!.teamProfit - totals.get(a.id)!.teamProfit));
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Sales Force</h1>
        <p className="max-w-3xl text-sm text-ink-soft">Independent contractors (1099) from Associate AE to VP of Sales. Ranks come from totals since each rep&apos;s first day and never go down; promotions run every night (VP waits for you). The leaderboard is revenue in the last {LEADERBOARD.windowDays} days. Pay goes out Mondays with partner commissions. <Link href="/careers/sales" className="underline">Careers page</Link></p>
      </div>
      <div className="grid gap-3 sm:grid-cols-4">
        <Stat label="Reps" value={all.length} />
        <Stat label="Leaders" value={all.filter((m) => SALES_RANKS[m.sales_rank].path === "leader").length} />
        <Stat label="Team pay & bonuses owed" value={money(sum("pending"))} />
        <Stat label="Paid so far" value={money(sum("paid"))} />
      </div>
      <div className="card"><JoinSalesForce partners={(others ?? []).map((p: { id: string; name: string }) => [p.id, p.name] as [string, string])} /></div>
      <section className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <div className="card overflow-x-auto p-0">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-paper text-left text-xs uppercase tracking-wide text-ink-soft"><tr><th className="p-3">Rep</th><th className="p-3 text-right">Profit made</th><th className="p-3 text-right">Deals / clients</th><th className="p-3 text-right">Team profit</th><th className="p-3">Next</th><th className="p-3">Rank & team</th></tr></thead>
            <tbody>{sorted.map((m) => {
              const n = totals.get(m.id)!;
              const next = nextRanks(m.sales_rank).map((r) => ({ r, gaps: promotionGaps(n, r) }));
              return (
                <tr key={m.id} className="border-t border-line align-top">
                  <td className="p-3"><div className="font-semibold">{m.name}</div><div className="text-xs text-ink-soft">{SALES_RANKS[m.sales_rank].title}{m.sales_leader_id ? ` · ${nameOf.get(m.sales_leader_id) ?? "?"}'s team` : ""}{m.status !== "active" ? " · paused" : ""}{n.team.length ? ` · team of ${n.team.length}` : ""}</div></td>
                  <td className="p-3 text-right tabular-nums">{money(n.profit)}</td>
                  <td className="p-3 text-right tabular-nums">{n.deals} / {n.clients}</td>
                  <td className="p-3 text-right tabular-nums">{n.team.length ? money(n.teamProfit) : "—"}</td>
                  <td className="p-3 text-xs">{next.map(({ r, gaps }) => <div key={r}><b>{SALES_RANKS[r].short}:</b> {gaps.length ? gaps.slice(0, 2).join(" · ") : "qualifies"}</div>)}</td>
                  <td className="p-3"><RepControls id={m.id} rank={m.sales_rank} leaderId={m.sales_leader_id} leaders={leaders} /></td>
                </tr>
              );
            })}</tbody>
          </table>
          {!all.length && <p className="p-4 text-sm text-ink-soft">No reps yet. Field Sales sign-ups join automatically; add any partner above.</p>}
        </div>
        <div className="card">
          <h2 className="font-bold">Leaderboard · last {LEADERBOARD.windowDays} days</h2>
          {board.length ? <ol className="mt-2 space-y-1 text-sm">{board.slice(0, 20).map((b) => <li key={b.id} className="flex justify-between gap-2"><span>#{b.place} {b.name} <span className="text-xs text-ink-soft">{SALES_RANKS[b.rank].short}</span></span><span className="tabular-nums">{money(b.revenue90)}</span></li>)}</ol> : <p className="mt-2 text-sm text-ink-soft">No sales in the window yet.</p>}
          <ul className="mt-3 space-y-0.5 text-xs text-ink-soft">{LEADERBOARD.rewards.map((r) => <li key={r.top}>{r.reward}</li>)}</ul>
        </div>
      </section>
    </div>
  );
}
