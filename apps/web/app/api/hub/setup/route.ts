/*
 * FILE    : apps/web/app/api/hub/setup/route.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-01_1940 UTC
 * PURPOSE : Staff: readiness report (GET) and one-click fixes (POST { action: "sync_catalog" }).
 * UPDATED : 2026-10-11_0451 UTC — Go-live setup is admins only.
 * UPDATED : 2026-11-04_1759 UTC — Go-live autopilot (lib/golive-autopilot.ts):
 *             POST { action: "autopilot", dry_run?: boolean } — fix everything the connected APIs allow (or preview it)
 *             GET  — readiness checks plus the business & legal checklist state
 *           Admins, or any caller with `Authorization: Bearer <GOLIVE_API_KEY>` (agents, Zapier, scripts).
 */
import { LAUNCH_CHECKLIST } from "@handled/core";
import { ADMINS_ONLY, deny, getViewer, isAdmin, isStaff } from "@/lib/auth";
import { readiness } from "@/lib/readiness";
import { syncCatalog } from "@/lib/catalog";
import { adminClient } from "@/lib/supabase/server";
import { autoTickChecklist, goLiveKeyOk, runAutopilot } from "@/lib/golive-autopilot";

export const maxDuration = 300;

async function allowed(req: Request) {
  if (goLiveKeyOk(req)) return null;
  const v = await getViewer(req);
  if (!isStaff(v)) return deny();
  if (!isAdmin(v)) return deny(403, ADMINS_ONLY);
  return null;
}

export async function GET(req: Request) {
  const no = await allowed(req); if (no) return no;
  await autoTickChecklist().catch(() => null);
  const [checks, ticks] = await Promise.all([readiness(), adminClient().from("launch_checklist").select("key, done_at, done_by, note")]);
  const by = new Map((ticks.data ?? []).map((t) => [t.key, t]));
  return Response.json({
    checks,
    checklist: LAUNCH_CHECKLIST.map((i) => ({ ...i, done_at: by.get(i.key)?.done_at ?? null, done_by: by.get(i.key)?.done_by ?? null, note: by.get(i.key)?.note ?? null })),
  });
}

export async function POST(req: Request) {
  const no = await allowed(req); if (no) return no;
  const body = await req.json().catch(() => ({}));
  if (body.action === "sync_catalog") return Response.json(await syncCatalog(true));
  if (body.action === "autopilot") return Response.json(await runAutopilot(await readiness(), { dryRun: Boolean(body.dry_run) }));
  return deny(400, "Unknown action");
}
