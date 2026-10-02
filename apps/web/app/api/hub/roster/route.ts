/*
 * FILE    : apps/web/app/api/hub/roster/route.ts
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-02_0255 UTC
 * PURPOSE : Staff: live roster — every active pro's status, location and week ahead (JSON,
 *           refreshed by the Hub's Live roster page).
 */
import { deny, getViewer, isStaff } from "@/lib/auth";
import { liveRoster } from "@/lib/roster";

export async function GET(req: Request) {
  const v = await getViewer(req);
  if (!isStaff(v)) return deny(403, "Staff only");
  return Response.json({ at: new Date().toISOString(), pros: await liveRoster() });
}
