/*
 * FILE    : apps/web/app/hub/layout.tsx
 * PROJECT : Handled — AI-run home & business services
 * CREATED : 2026-10-01_1723 UTC
 * UPDATED : 2026-10-02_0255 UTC — Live roster in the nav.
 * UPDATED : 2026-10-02_1329 UTC — Growth page in the nav.
 * UPDATED : 2026-10-02_2250 UTC — Supply gaps in the nav.
 * UPDATED : 2026-10-03_0043 UTC — Contract library in the nav.
 * UPDATED : 2026-10-03_0152 UTC — Market pricing in the nav.
 * UPDATED : 2026-10-03_0210 UTC — Pro leads in the nav.
 * UPDATED : 2026-10-03_1255 UTC — Pricing accuracy in the nav.
 * UPDATED : 2026-10-03_1513 UTC — City scorecard in the nav.
 * UPDATED : 2026-10-04_1934 UTC — Business leads (sales engine) in the nav.
 * UPDATED : 2026-10-05_0148 UTC — Email Center in the nav.
 * UPDATED : 2026-10-05_0221 UTC — Checklists (library) in the nav.
 * UPDATED : 2026-10-05_0418 UTC — Pro Rewards in the nav.
 * UPDATED : 2026-10-05_0434 UTC — Team (who has Hub access) in the nav; clearer "staff only" message.
 * PURPOSE : Handled Hub shell — staff only (role dispatcher or admin).
 * UPDATED : 2026-10-05_1441 UTC — 🏛️ Gov contracts (SAM.gov).
 * UPDATED : 2026-10-05_1954 UTC — 📝 Bids (bid engine).
 * UPDATED : 2026-10-05_2034 UTC — 🤝 Talent (Handled Talent recruiting agency).
 * UPDATED : 2026-10-06_0324 UTC — 🏦 Factoring (invoice factoring partners for net-30+ clients).
 * UPDATED : 2026-10-06_0752 UTC — 🤖 AI agents (mission, daily growth plan, agent health, assign tasks).
 * UPDATED : 2026-10-06_2120 UTC — 🛟 Cancellations & coverage.
 * UPDATED : 2026-10-06_2230 UTC — 📒 Accounting (Xero + Stripe).
 * UPDATED : 2026-10-07_0145 UTC — 💸 Referral partners.
 * UPDATED : 2026-10-07_0200 UTC — menu grouped into dropdown sections (components/HubNav), phones get a ☰ Menu.
 * UPDATED : 2026-10-07_0320 UTC — 🎨 Website & promotions (website look, grand opening promotion).
 * UPDATED : 2026-10-07_0530 UTC — 🏅 Handled Points (customer and business loyalty).
 */
import Link from "next/link";
import { redirect } from "next/navigation";
import { BRAND } from "@handled/core";
import { getViewer, isStaff } from "@/lib/auth";
import { supabaseConfigured } from "@/lib/supabase/env";
import { NotConfigured } from "@/components/ui";
import { HubNav, type HubGroup } from "@/components/HubNav";

export const metadata = { title: "Handled Hub" };

const NAV: HubGroup[] = [
  { id: "ops", label: "Operations", links: [
    ["/hub", "📊", "Dashboard"],
    ["/hub/jobs", "🗂️", "Jobs board"],
    ["/hub/roster", "📍", "Live roster"],
    ["/hub/coverage", "🛟", "Cancellations & coverage"],
    ["/hub/checklists", "✅", "Checklists"],
    ["/hub/gaps", "🕳️", "Supply gaps"],
  ] },
  { id: "pros", label: "Pros", links: [
    ["/hub/network", "💎", "Pro Network"],
    ["/hub/pros", "🧰", "Hiring & pros"],
    ["/hub/recruiting", "🧲", "Recruiting"],
    ["/hub/leads", "🎯", "Pro leads"],
    ["/hub/pro-program", "🏅", "Pro Program"],
    ["/hub/rewards", "🎁", "Pro Rewards"],
  ] },
  { id: "sales", label: "Customers & sales", links: [
    ["/hub/customers", "👥", "Customers & B2B"],
    ["/hub/biz-leads", "🤝", "Business leads"],
    ["/hub/partners", "💸", "Referral partners"],
    ["/hub/loyalty", "🏅", "Handled Points"],
    ["/hub/gov", "🏛️", "Gov contracts"],
    ["/hub/bids", "📝", "Bids"],
    ["/hub/talent", "🤝", "Talent (recruiting)"],
    ["/hub/email", "✉️", "Email Center"],
  ] },
  { id: "money", label: "Money", links: [
    ["/hub/finance", "💵", "Finance"],
    ["/hub/accounting", "📒", "Accounting (Xero)"],
    ["/hub/charges", "💳", "Quick Charge"],
    ["/hub/factoring", "🏦", "Factoring"],
  ] },
  { id: "growth", label: "Growth & pricing", links: [
    ["/hub/growth", "📈", "Growth"],
    ["/hub/site", "🎨", "Website look"],
    ["/hub/cities", "🏙️", "City scorecard"],
    ["/hub/market", "⚖️", "Market pricing"],
    ["/hub/pricing-accuracy", "📐", "Pricing accuracy"],
  ] },
  { id: "ai", label: "AI & IEBC", links: [
    ["/hub/agents", "🤖", "AI agents"],
    ["/hub/assistant", "✨", "AI assistant"],
    ["/hub/workforce", "🏢", "IEBC Workforce"],
  ] },
  { id: "settings", label: "Settings", links: [
    ["/hub/team", "👥", "Team"],
    ["/hub/contracts", "📜", "Contract library"],
    ["/hub/setup", "🚀", "Go-live setup"],
  ] },
];

export const dynamic = "force-dynamic";

export default async function HubLayout({ children }: { children: React.ReactNode }) {
  if (!supabaseConfigured) return <NotConfigured />;
  const v = await getViewer();
  if (!v) redirect("/login?next=/hub");
  if (!isStaff(v))
    return <div className="wrap py-20"><div className="card max-w-lg"><h1 className="text-xl font-bold">Staff only</h1><p className="mt-2 text-sm text-ink-soft">{v.email} isn’t on the ops team. Ask an admin to add your email in Hub → Team; you'll get a sign-in link. Looking for your bookings or your pro jobs? <a className="underline" href="/account">My account</a> · <a className="underline" href="/pro">Pro portal</a></p></div></div>;
  return (
    <div className="min-h-screen md:grid md:grid-cols-[220px_1fr]">
      <aside className="bg-brand-deep p-4 text-white md:min-h-screen">
        <Link href="/home" className="flex items-center gap-2 px-2 font-extrabold"><span className="grid h-7 w-7 place-items-center rounded-md bg-brand">✓</span>{BRAND.name} <span className="text-xs font-normal text-white/50">Hub</span></Link>
        <HubNav groups={NAV} />
        <div className="mt-8 hidden px-2 text-xs text-white/40 md:block">{v.fullName ?? v.email}<br />{v.role}<form action="/auth/signout" method="post"><button className="mt-2 underline">Sign out</button></form></div>
      </aside>
      <main className="min-w-0 bg-paper p-4 md:p-8">{children}</main>
    </div>
  );
}
