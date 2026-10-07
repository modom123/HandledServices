/*
 * FILE    : apps/web/app/hub/loyalty/page.tsx
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-07_0530 UTC
 * PURPOSE : Hub → Handled Points: every customer and business account's points (available, pending, all-time, tier),
 *           what the points are worth (liability), credit redeemed, adjustments and the settings.
 */
import { LOYALTY_RULES_EN } from "@handled/core";
import { getViewer } from "@/lib/auth";
import { loyaltySummary } from "@/lib/loyalty";
import { Stat } from "@/components/ui";
import { LoyaltyAdjust, LoyaltyRun, LoyaltySettingsForm } from "@/components/LoyaltyHub";

export const dynamic = "force-dynamic";
const n = (x: number) => Math.round(x).toLocaleString("en-US");

export default async function HubLoyalty() {
  const v = await getViewer();
  const s = await loyaltySummary();
  const top = s.accounts.slice(0, 100);
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Handled Points</h1>
          <p className="max-w-3xl text-sm text-ink-soft">Loyalty points for every customer account and business account. Earned on completed, paid jobs; pending {s.settings.pendingDays} days; turned into credit codes used at checkout (out of our share, never the pro's pay). Pros have their own program: Pro Rewards.</p>
        </div>
        <LoyaltyRun />
      </div>
      <div className="grid gap-3 sm:grid-cols-4">
        <Stat label="Accounts with points" value={n(s.accounts.length)} hint={`${s.accounts.filter((a) => a.businessId).length} business`} />
        <Stat label="Available" value={n(s.available)} hint={`pending ${n(s.pending)}`} />
        <Stat label="Liability (avail + pending)" value={`$${s.liability.toFixed(2)}`} />
        <Stat label="Redeemed as credit" value={`$${s.redeemedDollars.toFixed(2)}`} hint={`${n(s.redeemed)} points`} />
      </div>
      <section className="card"><h2 className="mb-2 text-lg font-bold">Adjust points</h2><LoyaltyAdjust accounts={top.map((a) => ({ key: a.key, name: a.name, businessId: a.businessId ?? null, profileId: a.profileId ?? null, email: a.email ?? null }))} />
        <p className="mt-2 text-xs text-ink-soft">For goodwill (a late pro, a make-it-right) or corrections. Points can't go below zero.</p></section>
      <section><h2 className="mb-2 text-lg font-bold">Accounts</h2>
        {top.length ? (
          <div className="card overflow-x-auto p-0"><table className="w-full text-sm"><thead className="bg-paper text-left text-xs uppercase tracking-wide text-ink-soft"><tr><th className="p-3">Account</th><th className="p-3">Tier</th><th className="p-3">Available</th><th className="p-3">Pending</th><th className="p-3">Last 12 mo</th><th className="p-3">All-time</th><th className="p-3">Redeemed</th></tr></thead>
            <tbody>{top.map((a) => <tr key={a.key} className="border-t border-line"><td className="p-3">{a.businessId ? "🏢 " : ""}{a.name}</td><td className="p-3 capitalize">{a.tier}</td><td className="p-3">{n(a.available)}</td><td className="p-3">{n(a.pending)}</td><td className="p-3">{n(a.earned12m)}</td><td className="p-3">{n(a.lifetime)}</td><td className="p-3">{n(a.redeemed)}</td></tr>)}</tbody></table></div>
        ) : <p className="text-sm text-ink-soft">No points yet. They start with the first completed, paid job.</p>}
      </section>
      <section className="card"><h2 className="mb-2 text-lg font-bold">Settings</h2><LoyaltySettingsForm s={s.settings} canEdit={v?.role === "admin"} />
        <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-ink-soft">{LOYALTY_RULES_EN(s.settings).map((r) => <li key={r}>{r}</li>)}</ul></section>
    </div>
  );
}
