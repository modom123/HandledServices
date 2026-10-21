/*
 * FILE    : apps/web/app/api/hub/social/route.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-20_0100 UTC
 * PURPOSE : Staff controls for Hub → Social media. POST JSON:
 *             { action: "settings", enabled, auto_publish, per_week: { facebook, instagram, tiktok }, themes }  (admins)
 *             { action: "generate", week?: "next" }    — the AI writes this (or next) week's posts now
 *             { action: "update", id, caption?, hashtags?, media_url?, scheduled_for? }
 *             { action: "status", id, status: draft|approved|skipped|posted }
 *             { action: "publish_now" }                 — post everything approved and due now
 */
import { z } from "zod";
import { ADMINS_ONLY, deny, getViewer, isAdmin, isStaff } from "@/lib/auth";
import { adminClient } from "@/lib/supabase/server";
import { generateWeek, publishDue, setPostStatus, updatePost, weekStart } from "@/lib/social";

const n = z.number().int().min(0).max(7);
const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("settings"), enabled: z.boolean(), auto_publish: z.boolean(), per_week: z.object({ facebook: n, instagram: n, tiktok: n }), themes: z.string().max(3000).nullable() }),
  z.object({ action: z.literal("generate"), week: z.enum(["this", "next"]).optional() }),
  z.object({ action: z.literal("update"), id: z.string().uuid(), caption: z.string().min(1).max(5000).optional(), hashtags: z.array(z.string().max(60)).max(30).optional(),
    media_url: z.string().url().refine((u) => u.startsWith("https://"), "Use an https link").nullable().optional(), scheduled_for: z.string().datetime().optional() }),
  z.object({ action: z.literal("status"), id: z.string().uuid(), status: z.enum(["draft", "approved", "skipped", "posted"]) }),
  z.object({ action: z.literal("publish_now") }),
]);

export async function POST(req: Request) {
  const v = await getViewer(req);
  if (!isStaff(v)) return deny();
  const b = Body.safeParse(await req.json().catch(() => null));
  if (!b.success) return deny(400, b.error.issues[0]?.message ?? "Check the request");
  const d = b.data;
  const actor = v!.email ?? "staff";
  switch (d.action) {
    case "settings": {
      if (!isAdmin(v)) return deny(403, ADMINS_ONLY);
      const { action: _a, ...row } = d;
      const { error } = await adminClient().from("social_settings").upsert({ id: 1, ...row, themes: row.themes?.trim() || null, updated_by: actor, updated_at: new Date().toISOString() });
      return error ? deny(500, error.message) : Response.json({ ok: true });
    }
    case "generate": {
      const start = weekStart(new Date(Date.now() + (d.week === "next" ? 7 * 86400000 : 0)));
      const r = await generateWeek(start, actor).catch((e) => ({ added: 0, skipped: [], error: String(e) }));
      return Response.json({ ok: true, result: r });
    }
    case "update": { const { action: _a, id, ...patch } = d; await updatePost(id, patch); return Response.json({ ok: true }); }
    case "status": await setPostStatus(d.id, d.status, actor); return Response.json({ ok: true });
    case "publish_now": return Response.json({ ok: true, result: await publishDue() });
  }
}
