/*
 * FILE    : apps/web/app/hub/site/page.tsx
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-07_0320 UTC
 * PURPOSE : Handled Hub → Website & promotions: the default website look (three looks, one link each for market-by-market
 *           campaigns) and the grand opening promotion (start date, days, discount, live status).
 */
import { launchState, money } from "@handled/core";
import { getViewer } from "@/lib/auth";
import { siteUrl } from "@/lib/notify";
import { THEMES, defaultTheme } from "@/lib/theme";
import { getLaunchPromo } from "@/lib/promo";
import { adminClient } from "@/lib/supabase/server";
import { Badge, Stat } from "@/components/ui";
import { PromoEditor, ThemePicker } from "@/components/SiteSettingsUI";
import { CopyButton } from "@/components/PartnerUI";

export const dynamic = "force-dynamic";

const PHASE = { off: ["Off", "slate"], upcoming: ["Scheduled", "amber"], active: ["Live", "green"], grand_opening: ["Ended · Grand Opening banner showing", "brand"], done: ["Finished", "slate"] } as const;

export default async function SiteSettings() {
  const v = await getViewer();
  const admin = v?.role === "admin";
  const { error } = await adminClient().from("site_settings").select("key").limit(1);
  const [theme, promo] = await Promise.all([defaultTheme(), getLaunchPromo()]);
  const st = launchState(promo);
  const since = st.startsAt?.toISOString();
  const { data: jobs } = since ? await adminClient().from("jobs").select("discount, price_final").gte("created_at", since).gt("discount", 0) : { data: [] };
  const given = (jobs ?? []).reduce((t: number, j: { discount: number }) => t + Number(j.discount), 0);
  const today = new Date().toISOString().slice(0, 10);
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Website &amp; promotions</h1>
      {error && <div className="card border-rose-300 bg-rose-50 text-sm">Run <code>supabase/setup/ADD_SITE_SETTINGS_GRAND_OPENING_2026-10-07_0230.sql</code> once in Supabase → SQL Editor to save these settings (it also fixes discounted bookings).</div>}

      <section className="card space-y-3">
        <h2 className="font-bold">Website look</h2>
        <p className="text-sm text-ink-soft">The default look every visitor sees. To try a different look in one market, use that look&apos;s link in that market&apos;s ads, flyers, QR codes and emails. Visitors who arrive through it keep that look for 90 days.</p>
        <ThemePicker admin={admin} current={theme} themes={Object.entries(THEMES).map(([id, t]) => ({ id, ...t }))} />
        <div className="space-y-1 text-sm">{Object.keys(THEMES).map((id) => { const link = `${siteUrl()}/home?theme=${id}`; return (
          <div key={id} className="flex flex-wrap items-center gap-2"><span className="w-40 font-medium">{THEMES[id as keyof typeof THEMES].name}</span><span className="select-all font-mono text-xs">{link}</span><CopyButton text={link} label="Copy" /></div>
        ); })}
          <p className="text-xs text-ink-soft">Add <code>?theme=default</code> to any page to go back to the default look.</p>
        </div>
      </section>

      <section className="card space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-bold">Grand opening promotion</h2><Badge tone={PHASE[st.phase][1]}>{PHASE[st.phase][0]}</Badge></div>
        <p className="text-sm text-ink-soft">Every booking during the window gets the discount automatically (shown on the booking screen; promo codes don&apos;t stack — the customer gets whichever saves more). A banner with a live countdown runs across the site; when it ends the banner switches to &quot;Grand Opening — we&apos;re officially open&quot; for 30 days. Pros are always paid in full: the discount comes out of our share.</p>
        <div className="grid gap-3 sm:grid-cols-3">
          <Stat label="Window" value={st.startsAt ? `${promo.start} → ${st.endsAt!.toISOString().slice(0, 10)}` : "Not set"} hint={`${promo.days} days · ${Math.round(promo.pct * 100)}% ${promo.fullDiscount ? "on everything" : "(up to)"}`} />
          <Stat label="Discounted bookings" value={(jobs ?? []).length} hint="since the start" />
          <Stat label="Discounts given" value={money(given)} hint="all discounts on those jobs" />
        </div>
        <PromoEditor admin={admin} value={{ enabled: promo.enabled, start: promo.start || today, days: promo.days, pct: promo.pct, fullDiscount: Boolean(promo.fullDiscount) }} />
      </section>
    </div>
  );
}
