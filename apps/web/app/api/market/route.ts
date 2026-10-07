/*
 * FILE    : apps/web/app/api/market/route.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-03_0149 UTC
 * PURPOSE : The learned local market factor for a service (booking page + app use it so the
 *           suggested price matches what the server charges). GET ?service=&zip=
 * UPDATED : 2026-10-07_1830 UTC — also returns region (the area price level) so the booking page and app price exactly like the server.
 */
import { getService } from "@handled/core";
import { getMarketFactor } from "@/lib/market";
import { regionFactor } from "@/lib/launch";

export async function GET(req: Request) {
  const u = new URL(req.url);
  const slug = u.searchParams.get("service") ?? "";
  if (!getService(slug)) return Response.json({ factor: 1, region: 1 });
  const zip = u.searchParams.get("zip");
  const [factor, region] = await Promise.all([getMarketFactor(slug, zip), regionFactor(zip)]);
  return Response.json({ factor, region }, { headers: { "Cache-Control": "public, max-age=300" } });
}
