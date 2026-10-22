/*
 * FILE    : apps/web/app/api/zip/route.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-22_0500 UTC
 * PURPOSE : Form autofill: GET /api/zip?zip=48226 → { city, state } (or { city: null }). Type a ZIP and the city and
 *           state fill themselves in (referral tickets, onboarding). Cached lookup (lib/geo zipPlace); rate-limited.
 */
import { rateLimit } from "@/lib/ratelimit";
import { zipPlace } from "@/lib/geo";

export async function GET(req: Request) {
  const limited = await rateLimit(req, "zip_lookup");
  if (limited) return limited;
  const zip = new URL(req.url).searchParams.get("zip") ?? "";
  if (!/^\d{5}$/.test(zip)) return Response.json({ city: null, state: null }, { status: 400 });
  const place = await zipPlace(zip).catch(() => null);
  return Response.json(place ?? { city: null, state: null }, { headers: { "Cache-Control": "public, max-age=86400" } });
}
