/*
 * FILE    : apps/web/app/pro/layout.tsx
 * PROJECT : Handled — AI-run home & business services
 * CREATED : 2026-10-01_1723 UTC
 * UPDATED : 2026-10-02_1412 UTC — EN | ES switch (saved on the pro's account: texts and emails follow it).
 * UPDATED : 2026-10-02_1440 UTC — Spanish (pro portal)
 * UPDATED : 2026-10-03_0042 UTC — My contracts in the header.
 * UPDATED : 2026-10-03_1311 UTC — My crew in the header.
 * UPDATED : 2026-10-05_0221 UTC — Checklists (what each kind of job includes) in the header.
 * UPDATED : 2026-10-05_0418 UTC — Rewards in the header.
 * PURPOSE : Pro portal shell. Pros mostly use the mobile app; this is the web twin.
 * UPDATED : 2026-10-05_2034 UTC — 🤝 Talent (recruiters: Handled Talent searches).
 * UPDATED : 2026-10-07_0205 UTC — menu as dropdowns (Work · Money · Account, same component as the website); ☰ on phones.
 */
import Link from "next/link";
import { redirect } from "next/navigation";
import { Logo } from "@/components/site";
import { NotConfigured } from "@/components/ui";
import { getViewer } from "@/lib/auth";
import { supabaseConfigured } from "@/lib/supabase/env";
import { LangSwitch } from "@/components/LangSwitch";
import { DesktopNav, MobileNav, type NavGroup } from "@/components/SiteNav";
import { getLocale } from "@/lib/locale";
import { t as tr } from "@handled/core";

export const dynamic = "force-dynamic";

export default async function ProLayout({ children }: { children: React.ReactNode }) {
  if (!supabaseConfigured) return <NotConfigured />;
  const l = await getLocale();
  const t = (s: string) => tr(l, s);
  const v = await getViewer();
  if (!v) redirect("/login?next=/pro");
  if (!v.contractorId)
    return (
      <div className="wrap py-20"><div className="card max-w-lg"><h1 className="text-xl font-bold">{l === "es" ? `No hay cuenta de profesional para ${v.email}` : `No pro account for ${v.email}`}</h1><p className="mt-2 text-sm text-ink-soft">{t("Sign in with the email on your approved application, or")} <Link href="/pros" className="text-brand underline">{t("apply to become a pro")}</Link>.</p></div></div>
    );
  const es = l === "es";
  // the pro portal's menus (same dropdowns as the website; ☰ on phones)
  const groups: NavGroup[] = [
    { id: "work", label: es ? "Trabajo" : "Work", items: [
      { href: "/pro", label: t("Jobs"), icon: "🧰", hint: es ? "Ofertas y trabajos de hoy" : "Offers and today's jobs" },
      { href: "/pro/schedule", label: t("Calendar"), icon: "📅" },
      { href: "/pro/checklists", label: es ? "Listas" : "Checklists", icon: "✅" },
      { href: "/pro/crew", label: es ? "Mi equipo" : "My crew", icon: "👥" },
    ] },
    { id: "money", label: es ? "Dinero" : "Money", items: [
      { href: "/pro/earnings", label: t("Earnings"), icon: "💵", hint: es ? "Pagos, pago instantáneo, 1099" : "Payouts, instant pay, 1099" },
      { href: "/pro/rewards", label: es ? "Recompensas" : "Rewards", icon: "🎁" },
    ] },
    { id: "account", label: es ? "Cuenta" : "Account", items: [
      { href: "/pro/onboarding", label: t("Setup & documents"), icon: "📋" },
      { href: "/pro/contracts", label: t("My contracts"), icon: "📜" },
      { href: "/pro/talent", label: es ? "Talento" : "Talent", icon: "🤝" },
    ] },
  ];
  return (
    <>
      <header className="sticky top-0 z-30 border-b border-line bg-paper-deep/95 backdrop-blur">
        <div className="wrap flex h-16 items-center justify-between gap-3">
          <Logo />
          <DesktopNav groups={groups} />
          <div className="flex items-center gap-2 text-sm">
            <span className="hidden sm:inline-flex"><LangSwitch locale={l} /></span>
            <form action="/auth/signout" method="post" className="hidden md:block"><button className="text-ink-soft hover:text-ink">{t("Sign out")}</button></form>
            <MobileNav groups={groups} lang={<LangSwitch locale={l} />} cta={{ href: "/pro", label: t("Jobs") }} />
          </div>
        </div>
      </header>
      <main className="wrap py-8">{children}</main>
    </>
  );
}
