/*
 * FILE    : apps/web/app/(site)/layout.tsx
 * PROJECT : Handled — AI-run home & business services
 * CREATED : 2026-10-01_1723 UTC
 * UPDATED : 2026-10-07_0315 UTC — grand opening banner (countdown) above the header.
 * PURPOSE : Public website shell (header, footer, AI concierge bubble).
 */
import { SiteFooter, SiteHeader } from "@/components/site";
import { Concierge } from "@/components/Concierge";
import { getLocale } from "@/lib/locale";
import { launchNow } from "@/lib/promo";
import { LaunchBanner } from "@/components/LaunchBanner";

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const promo = await launchNow();
  const es = (await getLocale()) === "es";
  return (
    <>
      <LaunchBanner phase={promo.phase} startsAt={promo.startsAt?.toISOString() ?? null} endsAt={promo.endsAt?.toISOString() ?? null} pct={promo.pct} full={promo.full} es={es} />
      <SiteHeader />
      <main>{children}</main>
      <SiteFooter />
      <Concierge locale={await getLocale()} />
    </>
  );
}
