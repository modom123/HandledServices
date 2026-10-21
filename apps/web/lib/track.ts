/*
 * FILE    : apps/web/lib/track.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-20_0100 UTC
 * PURPOSE : Browser-side conversion tracking for the ad platforms (pixels loaded by <AdPixels />):
 *             trackConversion("Lead" | "Purchase", { id, value }) — Meta Pixel, Google Ads and TikTok pixel, each only
 *             if loaded. `id` is shared with the server events (lib/conversions.ts) so each platform counts it once.
 *             readAttribution — the visitor's first-touch record saved by <Attribution />.
 */
"use client";

type W = Window & { fbq?: (...a: unknown[]) => void; gtag?: (...a: unknown[]) => void; ttq?: { track: (e: string, d?: Record<string, unknown>, o?: Record<string, unknown>) => void } };

export function readAttribution(): Record<string, string> | null {
  try { const raw = localStorage.getItem("handled_attr"); return raw ? JSON.parse(raw) : null; } catch { return null; }
}

export function trackConversion(event: "Lead" | "Purchase", o: { id: string; value?: number | null; currency?: string }) {
  const w = window as W;
  const value = o.value != null && Number.isFinite(o.value) ? Math.round(o.value * 100) / 100 : undefined;
  const currency = o.currency ?? "USD";
  try { w.fbq?.("track", event, value != null ? { value, currency } : {}, { eventID: o.id }); } catch { /* blocked */ }
  try {
    const ads = process.env.NEXT_PUBLIC_GOOGLE_ADS_ID;
    const label = event === "Purchase" ? process.env.NEXT_PUBLIC_GOOGLE_ADS_BOOKING_LABEL : process.env.NEXT_PUBLIC_GOOGLE_ADS_LEAD_LABEL;
    if (ads && label) w.gtag?.("event", "conversion", { send_to: `${ads}/${label}`, value, currency, transaction_id: o.id });
  } catch { /* blocked */ }
  try { w.ttq?.track(event === "Purchase" ? "CompletePayment" : "SubmitForm", value != null ? { value, currency } : {}, { event_id: o.id }); } catch { /* blocked */ }
}
