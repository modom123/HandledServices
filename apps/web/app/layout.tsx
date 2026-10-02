/*
 * FILE    : apps/web/app/layout.tsx
 * PROJECT : Handled — AI-run home & business services
 * CREATED : 2026-10-01_1723 UTC
 * UPDATED : 2026-10-02_0316 UTC — Vercel Analytics (page views) and first-touch attribution.
 */
import type { Metadata } from "next";
import { BRAND } from "@handled/core";
import "./globals.css";
import { Analytics } from "@vercel/analytics/next";
import { Attribution } from "@/components/Attribution";

export const metadata: Metadata = {
  title: { default: `${BRAND.name} — ${BRAND.tagline}`, template: `%s · ${BRAND.name}` },
  description: BRAND.pitch,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}<Attribution /><Analytics /></body>
    </html>
  );
}
