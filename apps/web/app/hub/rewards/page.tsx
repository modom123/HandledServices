/*
 * FILE    : apps/web/app/hub/rewards/page.tsx
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-05_0418 UTC
 * PURPOSE : Hub → Rewards: what the program costs (points owed in dollars, % of our take this year), the order queue
 *           (approve → order → ship → deliver, or cancel and return points), top pros by points, the catalog, point
 *           adjustments / forfeits, and the settings (earn rate, point value, pending days…).
 */
import { REDEMPTION_LABEL, REWARD_CATEGORY_LABEL, type RewardCategory } from "@handled/core";
import { getViewer } from "@/lib/auth";
import { adminClient } from "@/lib/supabase/server";
import { catalog, rewardsLiability, type Redemption } from "@/lib/rewards";
import { Stat } from "@/components/ui";
import { CatalogItemForm, OrderActions, PointsAdjust, RewardSettingsForm } from "@/components/Rewards";

export const dynamic = "force-dynamic";
const n = (x: number) => Math.round(x).toLocaleString("en-US");

export default async function HubRewards() {
  const v = await getViewer();
  const db = adminClient();
  const [l, items, { data: orders }, { data: bal }, { data: pros }] = await Promise.all([
    rewardsLiability(), catalog(true),
    db.from("reward_redemptions").select("*").order("created_at", { ascending: false }).limit(200),
    db.from("reward_balances").select("*").order("lifetime", { ascending: false }).limit(25),
    db.from("contractors").select("id, business_name, contact_name, status").order("business_name"),
  ]);
  const name = new Map(((pros ?? []) as { id: string; business_name: string; contact_name: string }[]).map((p) => [p.id, `${p.business_name} (${p.contact_name})`]));
  const open = ((orders ?? []) as Redemption[]).filter((o) => !["delivered", "cancelled"].includes(o.status));
  const done = ((orders ?? []) as Redemption[]).filter((o) => ["delivered", "cancelled"].includes(o.status)).slice(0, 30);
  const Order = ({ o }: { o: Redemption }) => (
    <div className="flex flex-wrap items-start justify-between gap-2 p-3 text-sm">
      <div><div className="font-semibold">{o.item_name} <span className="font-normal text-ink-soft">· {n(o.points)} pts · FMV ${o.fmv_usd}</span></div>
        <div className="text-xs text-ink-soft">{name.get(o.contractor_id) ?? o.contractor_id} · {o.created_at.slice(0, 10)}{o.ship_to ? ` · ${[o.ship_to.name, o.ship_to.line1, o.ship_to.line2, o.ship_to.city, o.ship_to.state, o.ship_to.zip, o.ship_to.phone].filter(Boolean).join(", ")}` : ""}{o.tracking ? ` · tracking ${o.tracking}` : ""}</div></div>
      <div className="text-right"><div className="text-xs font-semibold">{REDEMPTION_LABEL[o.status].en}</div><OrderActions id={o.id} status={o.status} /></div>
    </div>
  );
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Pro Rewards</h1>
        <p className="max-w-3xl text-sm text-ink-soft">Loyalty points for independent pros, earned on Handled's take from their jobs (× quality × tenure), pending {l.settings.pendingDays} days, redeemed for gear, gift cards, tools, electronics and trips — never cash. Points never depend on accepting offers. Delivered rewards go on the pro's 1099 at fair market value (Network → 1099 worksheet).</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-5">
        <Stat label="Points owed (available)" value={n(l.available)} hint={`$${n(l.owedUsd)} liability`} />
        <Stat label="Pending" value={n(l.pending)} hint={`$${n(l.pendingUsd)} if all release`} />
        <Stat label="Earned this year" value={n(l.ytdPoints)} hint={`$${n(l.ytdCostUsd)} cost`} />
        <Stat label="Cost vs our take (YTD)" value={l.costPctOfTake != null ? `${l.costPctOfTake}%` : "—"} hint={`take $${n(l.ytdTake)}`} />
        <Stat label="Open orders" value={l.openOrders} hint={`$${n(l.openOrdersUsd)} to buy`} />
      </div>
      <section><h2 className="mb-2 text-lg font-bold">Orders to handle ({open.length})</h2>
        {open.length ? <div className="card divide-y divide-line p-0">{open.map((o) => <Order key={o.id} o={o} />)}</div> : <p className="text-sm text-ink-soft">No open orders.</p>}
      </section>
      <section className="card"><h2 className="mb-2 text-lg font-bold">Adjust points</h2><PointsAdjust contractors={((pros ?? []) as { id: string; business_name: string }[]).map((p) => ({ id: p.id, name: p.business_name }))} />
        <p className="mt-2 text-xs text-ink-soft">Use adjustments for goodwill or corrections (with a reason the pro sees). Forfeit only when a pro is deactivated for cause, per the Rewards Terms.</p></section>
      <section><h2 className="mb-2 text-lg font-bold">Top pros by points</h2>
        <div className="card overflow-x-auto p-0"><table className="w-full text-sm"><thead className="bg-paper text-left text-xs uppercase tracking-wide text-ink-soft"><tr><th className="p-3">Pro</th><th className="p-3">Available</th><th className="p-3">Pending</th><th className="p-3">All-time</th></tr></thead>
          <tbody>{((bal ?? []) as { contractor_id: string; available: number; pending: number; lifetime: number }[]).map((b) => <tr key={b.contractor_id} className="border-t border-line"><td className="p-3"><a className="underline" href={`/hub/pros/${b.contractor_id}`}>{name.get(b.contractor_id) ?? b.contractor_id}</a></td><td className="p-3">{n(b.available)}</td><td className="p-3">{n(b.pending)}</td><td className="p-3">{n(b.lifetime)}</td></tr>)}</tbody></table></div>
      </section>
      <section><h2 className="mb-2 text-lg font-bold">Catalog</h2>
        <div className="card mb-3"><div className="mb-1 text-sm font-semibold">Add a reward</div><CatalogItemForm /></div>
        <div className="card divide-y divide-line p-0">{items.map((i) => (
          <div key={i.id} className="space-y-1 p-3 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2"><span className={i.active ? "" : "text-ink-soft line-through"}><b>{i.name}</b> · {REWARD_CATEGORY_LABEL[i.category as RewardCategory]?.en} · {n(i.points)} pts · cost ${i.cost_usd}{i.stock != null ? ` · stock ${i.stock}` : ""}</span>
              <CatalogItemForm item={{ id: i.id, name: i.name, name_es: i.name_es, category: i.category as RewardCategory, points: i.points, cost_usd: Number(i.cost_usd), description: i.description, description_es: i.description_es, image_url: i.image_url, stock: i.stock, active: i.active, sort: i.sort }} /></div>
          </div>
        ))}</div>
      </section>
      <section className="card"><h2 className="mb-2 text-lg font-bold">Settings</h2><RewardSettingsForm s={l.settings} canEdit={v?.role === "admin"} /></section>
      {done.length > 0 && <section><h2 className="mb-2 text-lg font-bold">Recent delivered / cancelled</h2><div className="card divide-y divide-line p-0">{done.map((o) => <Order key={o.id} o={o} />)}</div></section>}
    </div>
  );
}
