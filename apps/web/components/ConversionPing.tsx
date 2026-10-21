/*
 * FILE    : apps/web/components/ConversionPing.tsx
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-20_0100 UTC
 * PURPOSE : On the booking confirmation page, tell the ad pixels a booking happened (once per booking; the event id is
 *           the booking ref, the same id the server sends, so each platform counts it once).
 */
"use client";

import { useEffect } from "react";
import { trackConversion } from "@/lib/track";

export function ConversionPing({ id, value }: { id: string; value: number | null }) {
  useEffect(() => {
    try {
      const k = `handled_conv_${id}`;
      if (sessionStorage.getItem(k)) return;
      sessionStorage.setItem(k, "1");
    } catch { /* storage blocked: still send once per page load */ }
    trackConversion("Purchase", { id, value });
  }, [id, value]);
  return null;
}
