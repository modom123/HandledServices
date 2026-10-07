/*
 * FILE    : apps/web/app/pro/rewards/page.tsx
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-05_0418 UTC
 * PURPOSE : Pro portal → Rewards: available and pending points (what they're worth), tenure tier and the next one,
 *           how points are earned, milestones, the catalog with redeem, orders, and the point history. EN / ES.
 */
import { REDEMPTION_LABEL, REWARD_CATEGORY_LABEL, REWARD_RULES_EN, REWARD_RULES_ES, type RewardCategory } from "@handled/core";
import { getViewer } from "@/lib/auth";
import { getLocale } from "@/lib/locale";
import { rewardsFor } from "@/lib/rewards";
import { adminClient } from "@/lib/supabase/server";
import { RedeemButton } from "@/components/Rewards";
import { Stat } from "@/components/ui";

export const dynamic = "force-dynamic";
const n = (x: number) => x.toLocaleString("en-US");

export default async function ProRewards() {
  const v = await getViewer();
  if (!v?.contractorId) return null;
  const es = (await getLocale()) === "es";
  const r = await rewardsFor(v.contractorId);
  const { data: me } = await adminClient().from("contractors").select("contact_name, address_line, city, state, zip, phone").eq("id", v.contractorId).single();
  const address = { name: me?.contact_name ?? "", line1: me?.address_line ?? "", city: me?.city ?? "", state: me?.state ?? "MI", zip: me?.zip ?? "", phone: me?.phone ?? "" };
  const usd = (p: number) => `$${n(Math.round(p * r.settings.pointValue))}`;
  const kindLabel = (k: string) => (es ? { earn: "Trabajo", milestone: "Meta", redeem: "Canje", return: "Devolución", adjust: "Ajuste", expire: "Vencimiento", forfeit: "Pérdida" } : { earn: "Job", milestone: "Milestone", redeem: "Redeemed", return: "Returned", adjust: "Adjustment", expire: "Expired", forfeit: "Forfeited" })[k as "earn"] ?? k;
  const cats = [...new Set(r.catalog.map((c) => c.category))] as RewardCategory[];
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">🎁 {es ? "Recompensas Handled Pro" : "Handled Pro Rewards"}</h1>
        <p className="text-sm text-ink-soft">{es ? "Gane puntos con cada trabajo y cámbielos por artículos, herramientas, electrónicos y viajes." : "Earn points on every job and redeem them for gear, tools, electronics and trips."}{!r.settings.enabled ? (es ? " (El programa está en pausa.)" : " (The program is paused right now.)") : ""}</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-4">
        <Stat label={es ? "Disponibles" : "Available"} value={n(r.balance.available)} hint={`≈ ${usd(r.balance.available)} ${es ? "en premios" : "in rewards"}`} />
        <Stat label={es ? "Pendientes" : "Pending"} value={n(r.balance.pending)} hint={es ? `se liberan a los ${r.settings.pendingDays} días` : `unlock after ${r.settings.pendingDays} days`} />
        <Stat label={es ? "Total ganado" : "Earned all-time"} value={n(r.balance.lifetime)} />
        <Stat label={es ? "Su nivel" : "Your tier"} value={`${es ? r.tier.es : r.tier.en} ×${r.tier.multiplier}`} hint={r.tier.next ? (es ? `×${r.tier.next.multiplier} a los ${r.tier.next.months} meses (lleva ${r.monthsActive})` : `×${r.tier.next.multiplier} at ${r.tier.next.months} months (you're at ${r.monthsActive})`) : (es ? "nivel máximo" : "top tier")} />
      </div>
      <section className="card">
        <h2 className="mb-2 font-bold">{es ? "Cómo funciona" : "How it works"}</h2>
        <ul className="list-disc space-y-1 pl-5 text-sm">{(es ? REWARD_RULES_ES(r.settings) : REWARD_RULES_EN(r.settings)).map((x) => <li key={x}>{x}</li>)}</ul>
        <a href={`/terms/pro-rewards-terms${es ? "?lang=es" : ""}`} className="mt-2 inline-block text-sm text-brand underline">{es ? "Términos de Recompensas" : "Rewards Terms"}</a>
      </section>
      <section>
        <h2 className="mb-2 font-bold">{es ? "Metas" : "Milestones"}</h2>
        <div className="flex flex-wrap gap-2">{r.milestones.map((m) => <span key={m.key} className={`rounded-full px-3 py-1 text-xs ${m.done ? "bg-brand text-white" : "border border-line text-ink-soft"}`}>{m.done ? "🏆 " : ""}{es ? m.es : m.en} · +{n(m.points)}</span>)}</div>
      </section>
      <section>
        <h2 className="mb-2 font-bold">{es ? "Catálogo" : "Catalog"}</h2>
        {cats.map((c) => (
          <div key={c} className="mb-4">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-soft">{es ? REWARD_CATEGORY_LABEL[c].es : REWARD_CATEGORY_LABEL[c].en}</div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {r.catalog.filter((i) => i.category === c).map((i) => (
                <div key={i.id} className="card flex flex-col justify-between">
                  {i.image_url && <img src={i.image_url} alt="" className="mb-2 aspect-video w-full rounded-lg object-cover" />}
                  <div><div className="font-semibold">{es ? i.name_es || i.name : i.name}</div><div className="text-xs text-ink-soft">{es ? i.description_es || i.description : i.description}</div></div>
                  <div className="mt-2 flex items-center justify-between gap-2"><span className="font-bold text-brand">{n(i.points)} pts</span>{i.stock === 0 ? <span className="text-xs text-ink-soft">{es ? "Agotado" : "Out of stock"}</span> : <RedeemButton itemId={i.id} name={es ? i.name_es || i.name : i.name} points={i.points} available={r.balance.available} es={es} address={address} />}</div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </section>
      {r.orders.length > 0 && (
        <section><h2 className="mb-2 font-bold">{es ? "Mis pedidos" : "My orders"}</h2>
          <div className="card divide-y divide-line p-0 text-sm">{r.orders.map((o) => <div key={o.id} className="flex flex-wrap justify-between gap-2 p-3"><span>{o.item_name} · {n(o.points)} pts</span><span className="text-ink-soft">{es ? REDEMPTION_LABEL[o.status].es : REDEMPTION_LABEL[o.status].en}{o.tracking ? ` · ${o.tracking}` : ""} · {o.created_at.slice(0, 10)}</span></div>)}</div>
        </section>
      )}
      <section><h2 className="mb-2 font-bold">{es ? "Historial de puntos" : "Point history"}</h2>
        {!r.ledger.length && <p className="text-sm text-ink-soft">{es ? "Sus puntos aparecen aquí cuando termine su primer trabajo." : "Your points show up here when you finish your first job."}</p>}
        <div className="card divide-y divide-line p-0 text-sm">{r.ledger.map((e) => (
          <div key={e.id} className="flex flex-wrap justify-between gap-2 p-3">
            <span>{kindLabel(e.kind)}{e.note ? ` · ${e.note}` : ""}{e.kind === "earn" && e.detail ? <span className="text-xs text-ink-soft"> · ${Number(e.detail.take ?? 0)} × {r.settings.earnRate}{Number(e.detail.quality) > 1 ? ` × ${e.detail.quality}` : ""}{Number(e.detail.tenure) > 1 ? ` × ${e.detail.tenure}` : ""}</span> : null}</span>
            <span className={e.points < 0 ? "text-rose-700" : "font-semibold"}>{e.points > 0 ? "+" : ""}{n(e.points)}{e.status === "pending" ? <span className="ml-1 text-xs font-normal text-ink-soft">({es ? "pendiente hasta" : "pending until"} {e.available_at?.slice(0, 10)}{es ? ", estimado" : ", estimate"})</span> : null}</span>
          </div>
        ))}</div>
      </section>
    </div>
  );
}
