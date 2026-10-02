/*
 * FILE    : apps/web/app/(site)/layout.tsx
 * PROJECT : Handled — AI-run home & business services
 * CREATED : 2026-10-01_1723 UTC
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
