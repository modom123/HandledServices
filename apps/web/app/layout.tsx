/*
 * FILE    : apps/web/app/layout.tsx
 * PROJECT : Handled — AI-run home & business services
 * CREATED : 2026-10-01_1723 UTC
 * UPDATED : 2026-10-02_0316 UTC — Vercel Analytics (page views) and first-touch attribution.
 * UPDATED : 2026-10-02_1329 UTC — <html lang> follows the visitor's language (en / es).
 * UPDATED : 2026-10-07_0220 UTC — modern look: Inter (body) and Plus Jakarta Sans (headings), self-hosted.
 * UPDATED : 2026-10-07_0240 UTC — data-theme on <html> picks one of the three looks (lib/theme.ts).
 */
import type { Metadata } from "next";
import { BRAND } from "@handled/core";
import "@fontsource-variable/inter";
import "@fontsource-variable/plus-jakarta-sans";
import "./globals.css";
import { Analytics } from "@vercel/analytics/next";
import { Attribution } from "@/components/Attribution";
import { getLocale } from "@/lib/locale";
import { getTheme } from "@/lib/theme";

export const metadata: Metadata = {
  title: { default: `${BRAND.name} — ${BRAND.tagline}`, template: `%s · ${BRAND.name}` },
  description: BRAND.pitch,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang={await getLocale()} data-theme={await getTheme()}>
      <body>{children}<Attribution /><Analytics /></body>
    </html>
  );
}
