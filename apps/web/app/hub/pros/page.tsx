/*
 * FILE    : apps/web/app/hub/pros/page.tsx
 * PROJECT : Handled — AI-run home & business services
 * CREATED : 2026-10-01_1723 UTC
 * PURPOSE : Subcontractor network — applications with AI screening, vetting queue,
 *           active pros with performance and compliance (insurance expiry).
 * UPDATED : 2026-10-06_0748 UTC — Tier & progress column (current tier, what's left for the next one) and Pro Rewards
 *           points (available / pending) for every pro, so progress can be tracked at a glance.
 * UPDATED : 2026-10-12_0121 UTC — pro ID (P-…) next to each pro.
 * UPDATED : 2026-10-15_0100 UTC — "Pro roster" (Mastermind → Pros tab). The applications queue moved out — it duplicated
 *           Recruiting, which reviews, interviews, invites and declines; this page links there with the count.
 */
import Link from "next/link";
import { TRADES, nextTierProgress, proTier, type Contractor } from "@handled/core";
import { adminClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/auth";
import { Badge } from "@/components/ui";

type Rec = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const tradeLabel = (id: string) => TRADES.find((t) => t.id === id)?.label ?? id;

export default async function Pros() {
  const v = await getViewer();
  if (!v) return null;
  const [{ data: apps }, { data: pros }] = await Promise.all([
    v.db.from("contractor_applications").select("id").in("status", ["new", "reviewing"]).order("created_at", { ascending: false }),
    v.db.from("contractors").select("*").order("status").order("rating", { ascending: false }),
  ]);
  const { data: bals } = await adminClient().from("reward_balances").select("contractor_id, available, pending");
  const points = new Map(((bals ?? []) as Rec[]).map((b) => [b.contractor_id as string, b]));
  const soon = new Date(Date.now() + 30 * 86400000);
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="text-2xl font-bold">Pro roster</h1><p className="text-sm text-ink-soft">Every pro on file — performance, tier, points, insurance and status.</p></div>
        <Link href="/hub/recruiting" className="btn-ghost">🧲 {(apps ?? []).length} application{(apps ?? []).length === 1 ? "" : "s"} to review in Recruiting →</Link>
      </div>
      <section>
        <div className="card overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="bg-paper text-left text-xs uppercase tracking-wide text-ink-soft"><tr><th className="p-3">Pro</th><th className="p-3">Trades</th><th className="p-3">Rating</th><th className="p-3">Jobs</th><th className="p-3">Accept / on-time</th><th className="p-3">Tier & progress</th><th className="p-3">Reward points</th><th className="p-3">Insurance</th><th className="p-3">Status</th></tr></thead>
            <tbody>
              {(pros ?? []).map((p: Rec) => {
                const ins = p.insured_until ? new Date(p.insured_until) : null;
                return (
                  <tr key={p.id} className="border-t border-line align-top">
                    <td className="p-3"><a href={`/hub/pros/${p.id}`} className="font-semibold underline">{p.business_name}</a>{p.pro_no && <span className="ml-2 font-mono text-xs text-ink-soft">{p.pro_no}</span>}<div className="text-xs text-ink-soft">{p.contact_name} · {p.phone}</div></td>
                    <td className="p-3 text-xs">{(p.trades as string[]).map(tradeLabel).join(", ")}</td>
                    <td className="p-3">{p.rating} ★</td>
                    <td className="p-3">{p.jobs_completed}</td>
                    <td className="p-3">{Math.round(p.acceptance_rate * 100)}% / {Math.round(p.on_time_rate * 100)}%</td>
                    <td className="p-3 text-xs">{(() => { const t = proTier(p as Contractor), n = nextTierProgress(p as Contractor); return <><b>{t.badge} {t.name}</b><div className="text-ink-soft">{n.next ? `→ ${n.next.name}: ${n.todo.join(", ") || "on next refresh"}` : "top tier"}</div></>; })()}</td>
                    <td className="p-3 text-xs">{points.has(p.id) ? <><b>{Number(points.get(p.id)!.available).toLocaleString("en-US")}</b><div className="text-ink-soft">+{Number(points.get(p.id)!.pending).toLocaleString("en-US")} pending</div></> : "—"}</td>
                    <td className="p-3">{ins ? <Badge tone={ins < new Date() ? "red" : ins < soon ? "amber" : "green"}>{p.insured_until}</Badge> : <Badge tone="red">missing</Badge>}</td>
                    <td className="p-3"><div className="mb-1"><Badge tone={p.status === "approved" ? "green" : p.status === "suspended" ? "red" : "amber"}>{p.status}</Badge></div><a href={`/hub/pros/${p.id}`} className="text-xs underline">Onboarding & profile →</a></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
