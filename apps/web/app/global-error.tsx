/*
 * FILE    : apps/web/app/global-error.tsx
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-02_1329 UTC
 * PURPOSE : Last-resort crash screen when the root layout itself fails (reports to the Hub).
 */
"use client";

import "./globals.css";
import { ErrorScreen } from "@/components/ErrorScreen";

export default function GlobalError(props: { error: Error & { digest?: string }; reset: () => void }) {
  return <html lang="en"><body><ErrorScreen {...props} /></body></html>;
}
