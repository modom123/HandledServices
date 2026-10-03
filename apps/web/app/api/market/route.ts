/*
 * FILE    : apps/web/app/api/market/route.ts
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-03_0149 UTC
 * PURPOSE : The learned local market factor for a service (booking page + app use it so the
 *           suggested price matches what the server charges). GET ?service=&zip=
 */
import { getService } from "@handled/core";
import { getMarketFactor } from "@/lib/market";

export async function GET(req: Request) {
  const u = new URL(req.url);
  const slug = u.searchParams.get("service") ?? "";
  if (!getService(slug)) return Response.json({ factor: 1 });
  const factor = await getMarketFactor(slug, u.searchParams.get("zip"));
  return Response.json({ factor }, { headers: { "Cache-Control": "public, max-age=300" } });
}
