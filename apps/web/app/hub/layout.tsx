/*
 * FILE    : apps/web/app/hub/layout.tsx
 * PROJECT : Handled — AI-run home & business services
 * CREATED : 2026-10-01_1723 UTC
 * UPDATED : 2026-10-02_0255 UTC — Live roster in the nav.
 * UPDATED : 2026-10-02_1329 UTC — Growth page in the nav.
 * PURPOSE : Handled Hub shell — staff only (role dispatcher or admin).
 */
import Link from "next/link";
import { redirect } from "next/navigation";
import { BRAND } from "@handled/core";
import { getViewer, isStaff } from "@/lib/auth";
import { supabaseConfigured } from "@/lib/supabase/env";
import { NotConfigured } from "@/components/ui";

export const metadata = { title: "Handled Hub" };

const NAV = [
  ["/hub", "📊", "Dashboard"],
  ["/hub/jobs", "🗂️", "Jobs board"],
  ["/hub/network", "💎", "Pro Network"],
  ["/hub/roster", "📍", "Live roster"],
  ["/hub/pros", "🧰", "Hiring & pros"],
  ["/hub/recruiting", "🧲", "Recruiting"],
  ["/hub/customers", "👥", "Customers & B2B"],
  ["/hub/finance", "💵", "Finance"],
  ["/hub/growth", "📈", "Growth"],
  ["/hub/charges", "💳", "Quick Charge"],
  ["/hub/pro-program", "🏅", "Pro Program"],
  ["/hub/workforce", "🏢", "IEBC Workforce"],
  ["/hub/assistant", "✨", "AI assistant"],
  ["/hub/setup", "🚀", "Go-live setup"],
] as const;

export const dynamic = "force-dynamic";

export default async function HubLayout({ children }: { children: React.ReactNode }) {
  if (!supabaseConfigured) return <NotConfigured />;
  const v = await getViewer();
  if (!v) redirect("/login?next=/hub");
  if (!isStaff(v))
    return <div className="wrap py-20"><div className="card max-w-lg"><h1 className="text-xl font-bold">Staff only</h1><p className="mt-2 text-sm text-ink-soft">{v.email} isn’t on the ops team. An admin can set your role to <code>dispatcher</code> or <code>admin</code> in the profiles table.</p></div></div>;
  return (
    <div className="min-h-screen md:grid md:grid-cols-[220px_1fr]">
      <aside className="bg-brand-deep p-4 text-white md:min-h-screen">
        <Link href="/home" className="flex items-center gap-2 px-2 font-extrabold"><span className="grid h-7 w-7 place-items-center rounded-md bg-brand">✓</span>{BRAND.name} <span className="text-xs font-normal text-white/50">Hub</span></Link>
        <nav className="mt-6 flex gap-1 overflow-x-auto md:flex-col">
          {NAV.map(([href, icon, label]) => (
            <Link key={href} href={href} className="whitespace-nowrap rounded-lg px-3 py-2 text-sm text-white/80 hover:bg-white/10 hover:text-white">{icon} {label}</Link>
          ))}
        </nav>
        <div className="mt-8 hidden px-2 text-xs text-white/40 md:block">{v.fullName ?? v.email}<br />{v.role}<form action="/auth/signout" method="post"><button className="mt-2 underline">Sign out</button></form></div>
      </aside>
      <main className="min-w-0 bg-paper p-4 md:p-8">{children}</main>
    </div>
  );
}
