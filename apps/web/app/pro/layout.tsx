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
 */
import Link from "next/link";
import { redirect } from "next/navigation";
import { Logo } from "@/components/site";
import { NotConfigured } from "@/components/ui";
import { getViewer } from "@/lib/auth";
import { supabaseConfigured } from "@/lib/supabase/env";
import { LangSwitch } from "@/components/LangSwitch";
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
  return (
    <>
      <header className="border-b border-line bg-paper-deep"><div className="wrap flex h-14 items-center justify-between"><Logo /><div className="flex items-center gap-4 text-sm"><Link href="/pro" className="font-semibold">{t("Jobs")}</Link><Link href="/pro/schedule">{t("Calendar")}</Link><Link href="/pro/earnings">{t("Earnings")}</Link><Link href="/pro/onboarding">{t("Setup & documents")}</Link><Link href="/pro/crew">{l === "es" ? "Mi equipo" : "My crew"}</Link><Link href="/pro/rewards">{l === "es" ? "🎁 Recompensas" : "🎁 Rewards"}</Link><Link href="/pro/checklists">{l === "es" ? "Listas" : "Checklists"}</Link><Link href="/pro/contracts">{t("My contracts")}</Link><LangSwitch locale={l} /><form action="/auth/signout" method="post"><button className="text-ink-soft">{t("Sign out")}</button></form></div></div></header>
      <main className="wrap py-8">{children}</main>
    </>
  );
}
