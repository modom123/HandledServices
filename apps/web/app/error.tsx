/*
 * FILE    : apps/web/app/error.tsx
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-02_1329 UTC
 * PURPOSE : Page-level crash screen (reports to the Hub).
 */
"use client";

import { ErrorScreen } from "@/components/ErrorScreen";

export default function Error(props: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorScreen {...props} />;
}
