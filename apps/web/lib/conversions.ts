/*
 * FILE    : apps/web/lib/conversions.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-20_0100 UTC
 * PURPOSE : Server-side conversion events, so the ad platforms see bookings even when a browser blocks the pixel:
 *             Meta Conversions API — META_PIXEL_ID (or NEXT_PUBLIC_META_PIXEL_ID) + META_CAPI_TOKEN
 *             TikTok Events API    — TIKTOK_PIXEL_ID (or NEXT_PUBLIC_TIKTOK_PIXEL_ID) + TIKTOK_EVENTS_TOKEN
 *           Email and phone are SHA-256 hashed before they leave (the platforms' rule); the event id is the booking ref,
 *           matching the pixel event on the confirmation page. Google Ads uses the gclid export (Hub → Lead inbox).
 *           Never throws: a failed event is logged, never blocks a booking.
 */
import "server-only";
import { createHash } from "node:crypto";
import { siteUrl } from "./notify";

const sha = (v: string | null | undefined) => (v ? createHash("sha256").update(v.trim().toLowerCase()).digest("hex") : undefined);
const phoneE164 = (p: string | null | undefined) => { const d = (p ?? "").replace(/\D/g, ""); return d.length === 10 ? `1${d}` : d.length === 11 ? d : null; };

export interface ConversionEvent { name: "Purchase" | "Lead"; id: string; value?: number | null; email?: string | null; phone?: string | null; zip?: string | null; attribution?: Record<string, string> | null; ip?: string | null; userAgent?: string | null; path?: string }

export async function sendServerConversion(e: ConversionEvent): Promise<void> {
  await Promise.all([meta(e), tiktok(e)]).catch((err) => console.error("[conversions]", err));
}

async function meta(e: ConversionEvent) {
  const pixel = process.env.META_PIXEL_ID || process.env.NEXT_PUBLIC_META_PIXEL_ID, token = process.env.META_CAPI_TOKEN;
  if (!pixel || !token) return;
  const fbclid = e.attribution?.fbclid;
  const first = e.attribution?.first_seen ? Date.parse(e.attribution.first_seen) : Date.now();
  const body = { data: [{
    event_name: e.name, event_time: Math.floor(Date.now() / 1000), event_id: e.id, action_source: "website", event_source_url: `${siteUrl()}${e.path ?? "/book"}`,
    user_data: { em: sha(e.email) ? [sha(e.email)] : undefined, ph: phoneE164(e.phone) ? [sha(phoneE164(e.phone))] : undefined, zp: e.zip ? [sha(e.zip)] : undefined, country: [sha("us")],
      client_ip_address: e.ip ?? undefined, client_user_agent: e.userAgent ?? undefined, fbc: fbclid ? `fb.1.${Number.isFinite(first) ? first : Date.now()}.${fbclid}` : undefined },
    custom_data: e.value != null ? { value: Math.round(e.value * 100) / 100, currency: "USD" } : undefined,
  }] };
  const r = await fetch(`https://graph.facebook.com/v21.0/${encodeURIComponent(pixel)}/events?access_token=${encodeURIComponent(token)}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(6000) });
  if (!r.ok) console.error("[conversions meta]", r.status, (await r.text().catch(() => "")).slice(0, 300));
}

async function tiktok(e: ConversionEvent) {
  const pixel = process.env.TIKTOK_PIXEL_ID || process.env.NEXT_PUBLIC_TIKTOK_PIXEL_ID, token = process.env.TIKTOK_EVENTS_TOKEN;
  if (!pixel || !token) return;
  const body = {
    event_source: "web", event_source_id: pixel,
    data: [{
      event: e.name === "Purchase" ? "CompletePayment" : "SubmitForm", event_time: Math.floor(Date.now() / 1000), event_id: e.id,
      user: { email: sha(e.email), phone: phoneE164(e.phone) ? sha(`+${phoneE164(e.phone)}`) : undefined, ttclid: e.attribution?.ttclid, ip: e.ip ?? undefined, user_agent: e.userAgent ?? undefined },
      properties: e.value != null ? { value: Math.round(e.value * 100) / 100, currency: "USD" } : undefined,
      page: { url: `${siteUrl()}${e.path ?? "/book"}` },
    }],
  };
  const r = await fetch("https://business-api.tiktok.com/open_api/v1.3/event/track/", { method: "POST", headers: { "Content-Type": "application/json", "Access-Token": token }, body: JSON.stringify(body), signal: AbortSignal.timeout(6000) });
  if (!r.ok) console.error("[conversions tiktok]", r.status, (await r.text().catch(() => "")).slice(0, 300));
}
