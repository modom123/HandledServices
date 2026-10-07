/*
 * FILE    : apps/web/app/api/hub/setup/route.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-01_1940 UTC
 * PURPOSE : Staff: readiness report (GET) and one-click fixes (POST { action: "sync_catalog" }).
 */
import { deny, getViewer, isStaff } from "@/lib/auth";
import { readiness } from "@/lib/readiness";
import { syncCatalog } from "@/lib/catalog";

export async function GET(req: Request) {
  if (!isStaff(await getViewer(req))) return deny();
  return Response.json({ checks: await readiness() });
}

export async function POST(req: Request) {
  if (!isStaff(await getViewer(req))) return deny();
  const body = await req.json().catch(() => ({}));
  if (body.action === "sync_catalog") return Response.json(await syncCatalog(true));
  return deny(400, "Unknown action");
}
