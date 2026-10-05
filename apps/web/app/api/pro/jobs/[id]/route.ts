/*
 * FILE    : apps/web/app/api/pro/jobs/[id]/route.ts
 * PROJECT : Handled — AI-run home & business services
 * CREATED : 2026-10-01_1723 UTC
 * UPDATED : 2026-10-01_2124 UTC — lockout: the pro reports they can't get access.
 * UPDATED : 2026-10-01_2334 UTC — scope_change: more work on site → priced change order.
 * UPDATED : 2026-10-02_1329 UTC — on_my_way: customer gets a text with a live tracking link.
 * UPDATED : 2026-10-03_0123 UTC — "release": a pro hands back an upcoming job (late cancel inside 24h).
 * UPDATED : 2026-10-03_1311 UTC — "crew": who the pro company is sending (crew accounts).
 * UPDATED : 2026-10-05_0221 UTC — completion is blocked while required checklist items are open.
 * PURPOSE : Pro: start a job, or complete it with photos (triggers AI QA).
 */
import { after } from "next/server";
import { z } from "zod";
import { deny, getViewer } from "@/lib/auth";
import { addEvent, completeJob, getJob, raiseAlert, runQa, startJob } from "@/lib/jobs";
import { requestScopeChange } from "@/lib/scope";
import { onMyWay } from "@/lib/visit";
import { proReleaseJob } from "@/lib/standing";
import { assignCrew } from "@/lib/crew";

const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("start") }),
  z.object({ action: z.literal("crew"), crew_member_id: z.string().uuid().nullable() }),
  z.object({ action: z.literal("on_my_way") }),
  z.object({ action: z.literal("release"), reason: z.string().trim().min(3).max(500) }),
  z.object({ action: z.literal("lockout"), note: z.string().min(3).max(1000) }),
  z.object({ action: z.literal("scope_change"), answers: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])), note: z.string().max(1000).default("") }),
  z.object({ action: z.literal("complete"), photos: z.array(z.string()).min(1).max(12), note: z.string().max(2000).nullable().optional() }),
]);

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const v = await getViewer(req);
  if (!v?.contractorId) return deny(403, "Pro account required");
  const { id } = await ctx.params;
  const body = Body.safeParse(await req.json().catch(() => null));
  if (!body.success) return deny(400, "Check the request (completion needs at least one photo)");
  if (body.data.action === "scope_change") {
    const r = await requestScopeChange(id, v.contractorId, body.data.answers, body.data.note);
    return Response.json(r, { status: r.ok ? 200 : 409 });
  }
  if (body.data.action === "lockout") {
    const job = await getJob(id);
    if (!job || job.contractor_id !== v.contractorId || !["assigned", "in_progress"].includes(job.status)) return deny(409, "Not an active job of yours");
    await addEvent(id, "lockout", `Pro reports no access: ${body.data.note}`, "pro", false);
    await raiseAlert("lockout", "warn", `${job.ref}: pro can't get in`, `${body.data.note}. Call the customer now. If there's still no access, cancel the job as "lockout" (the fee is kept and the pro gets show-up pay).`, id);
    return Response.json({ ok: true });
  }
  if (body.data.action === "crew") { const r = await assignCrew(id, v.contractorId, body.data.crew_member_id); return Response.json(r, { status: r.ok ? 200 : 409 }); }
  if (body.data.action === "release") { const r = await proReleaseJob(id, v.contractorId, body.data.reason); return Response.json(r, { status: r.ok ? 200 : 409 }); }
  if (body.data.action === "on_my_way") { const r = await onMyWay(id, v.contractorId); return Response.json(r, { status: r.ok ? 200 : 409 }); }
  if (body.data.action === "start") { const r = await startJob(id, v.contractorId); return Response.json(r, { status: r.ok ? 200 : 409 }); }
  const photos = body.data.photos.filter((p) => p.startsWith(`pro/${v.contractorId}/`));
  if (!photos.length) return deny(400, "Upload completion photos first");
  { const job = await getJob(id);
    if (job && job.contractor_id === v.contractorId) {
      const open = await (await import("@/lib/checklists")).openRequired(job);
      if (open.length) return Response.json({ ok: false, error: `Finish the checklist first (or mark items N/A with a reason): ${open.slice(0, 5).map((x) => x.text).join("; ")}${open.length > 5 ? ` and ${open.length - 5} more` : ""}`, open: open.map((x) => x.id) }, { status: 409 });
    } }
  const ok = await completeJob(id, v.contractorId, photos, body.data.note ?? null);
  if (ok) after(() => runQa(id, body.data.action === "complete" ? body.data.note ?? null : null).catch((e) => console.error("[qa]", e)));
  return Response.json({ ok });
}
