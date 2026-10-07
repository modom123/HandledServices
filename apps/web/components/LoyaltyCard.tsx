/*
 * FILE    : apps/web/components/LoyaltyCard.tsx
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-07_0530 UTC
 * PURPOSE : Handled Points card for the account pages: balance, tier and progress, pending points, unused credit
 *           codes, redeem button, recent activity and the rules. Server component (reads lib/loyalty).
 */
import { BRAND, LOYALTY_RULES_EN, LOYALTY_RULES_ES, loyaltyDollars, money, redeemable } from "@handled/core";
import { loyaltyFor, type LoyaltyAccount } from "@/lib/loyalty";
import { LoyaltyRedeem } from "./LoyaltyRedeem";
import { fmtDate } from "./ui";

const KIND: Record<string, { en: string; es: string }> = {
  earn: { en: "Earned", es: "Ganados" }, bonus: { en: "Bonus", es: "Extra" }, redeem: { en: "Turned into credit", es: "Convertidos en crédito" },
  adjust: { en: "Adjustment", es: "Ajuste" }, expire: { en: "Expired", es: "Vencidos" },
};

export async function LoyaltyCard({ account, es = false, canRedeem = true, title }: { account: LoyaltyAccount; es?: boolean; canRedeem?: boolean; title?: string }) {
  const p = await loyaltyFor(account).catch(() => null);
  if (!p || !p.settings.enabled) return null;
  const s = p.settings;
  const n = (x: number) => x.toLocaleString("en-US");
  const tierName = es ? p.tier.es : p.tier.en;
  const pct = p.tier.next ? Math.min(100, Math.round((p.earned12m / p.tier.next.min) * 100)) : 100;
  return (
    <div className="card md:col-span-2">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="font-semibold">🏅 {title ?? `${BRAND.name} Points`} · <span className="text-brand">{tierName}</span></div>
          <div className="mt-1 text-3xl font-extrabold tracking-tight">{n(p.available)} <span className="text-base font-semibold text-ink-soft">{es ? "puntos" : "points"} ≈ {money(p.worth)}</span></div>
          <div className="text-sm text-ink-soft">
            {p.pending > 0 && <>{es ? `${n(p.pending)} pendientes (listos ${s.pendingDays} días después del trabajo)` : `${n(p.pending)} pending (ready ${s.pendingDays} days after the job)`} · </>}
            {es ? `${n(p.lifetime)} ganados en total` : `${n(p.lifetime)} earned all-time`}
          </div>
        </div>
        <div className="min-w-[14rem] text-sm">
          {p.tier.next ? (
            <>
              <div className="text-ink-soft">{es ? `${n(p.tier.toNext)} puntos más para ${p.tier.next.es} (×${p.tier.next.multiplier})` : `${n(p.tier.toNext)} more points to ${p.tier.next.en} (×${p.tier.next.multiplier})`}</div>
              <div className="mt-1 h-2 rounded-full bg-brand-tint"><div className="h-2 rounded-full bg-brand" style={{ width: `${pct}%` }} /></div>
            </>
          ) : <div className="text-ink-soft">{es ? `Nivel más alto: gana ×${p.tier.multiplier}` : `Top tier: earning ×${p.tier.multiplier}`}</div>}
        </div>
      </div>
      {canRedeem
        ? <LoyaltyRedeem redeemable={redeemable(p.available, s)} step={s.redeemStep} perStep={loyaltyDollars(s.redeemStep, s)} businessId={account.businessId ?? null} es={es} />
        : p.available >= s.redeemStep && <p className="mt-2 text-sm text-ink-soft">{es ? "Un administrador de la cuenta puede convertir los puntos en crédito." : "An account admin can turn these points into credit."}</p>}
      {p.available < s.redeemStep && <p className="mt-2 text-sm text-ink-soft">{es ? `Con ${n(s.redeemStep)} puntos obtiene un crédito de ${money(loyaltyDollars(s.redeemStep, s))}.` : `At ${n(s.redeemStep)} points you get a ${money(loyaltyDollars(s.redeemStep, s))} credit.`}</p>}
      {p.credits.length > 0 && (
        <div className="mt-3 text-sm">
          <div className="font-semibold">{es ? "Créditos sin usar" : "Unused credits"}</div>
          <ul className="mt-1 space-y-1">{p.credits.map((c) => <li key={c.code}><b className="font-mono">{c.code}</b> · {money(Number(c.balance))} {es ? "disponible: ingréselo al pagar" : "left — enter it at checkout"}</li>)}</ul>
        </div>
      )}
      {p.history.length > 0 && (
        <details className="mt-3 text-sm">
          <summary className="cursor-pointer font-semibold">{es ? "Actividad" : "Activity"}</summary>
          <ul className="mt-2 divide-y divide-line">
            {p.history.map((h) => (
              <li key={h.id} className="flex justify-between gap-3 py-1.5">
                <span>{fmtDate(h.created_at)} · {es ? KIND[h.kind]?.es : KIND[h.kind]?.en}{h.note ? ` · ${h.note}` : ""}{h.status === "pending" ? (es ? " · pendiente" : " · pending") : ""}</span>
                <span className={h.points < 0 ? "text-ink-soft" : "font-semibold text-brand"}>{h.points > 0 ? "+" : ""}{n(h.points)}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
      <details className="mt-2 text-sm">
        <summary className="cursor-pointer text-ink-soft">{es ? "Cómo funcionan los puntos" : "How points work"}</summary>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-ink-soft">{(es ? LOYALTY_RULES_ES(s) : LOYALTY_RULES_EN(s)).map((r) => <li key={r}>{r}</li>)}</ul>
      </details>
    </div>
  );
}
