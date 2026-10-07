/*
 * FILE    : apps/web/app/(site)/layout.tsx
 * PROJECT : Handled — AI-run home & business services
 * CREATED : 2026-10-01_1723 UTC
 * UPDATED : 2026-10-07_0315 UTC — grand opening banner (countdown) above the header.
 * UPDATED : 2026-10-07_0345 UTC — grand opening discount and banner removed (owner decision).
 * PURPOSE : Public website shell (header, footer, AI concierge bubble).
 */
import { SiteFooter, SiteHeader } from "@/components/site";
import { Concierge } from "@/components/Concierge";
import { getLocale } from "@/lib/locale";

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteHeader />
      <main>{children}</main>
      <SiteFooter />
      <Concierge locale={await getLocale()} />
    </>
  );
}
