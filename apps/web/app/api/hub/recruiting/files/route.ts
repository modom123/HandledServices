/*
 * FILE    : apps/web/app/api/hub/recruiting/files/route.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-27_1800 UTC
 * PURPOSE : Hub → Recruiting → Pro files actions.
 *             POST { action: "remind_missing" } — every pro in setup whose file is missing something gets one email/push
 *             listing exactly what's left (nudgePro). Anyone reminded in the last 2 days is skipped. Up to 300 at a time.
 */
import { z } from "zod";
import { onboardingChecklist, proFileStatus } from "@handled/core";
import { deny, getViewer, isStaff } from "@/lib/auth";
import { adminClient } from "@/lib/supabase/server";
import { nudgePro } from "@/lib/recruiting";

const Body = z.object({ action: z.literal("remind_missing") });

export async function POST(req: Request) {
  const v = await getViewer(req);
  if (!isStaff(v)) return deny();
  if (!Body.safeParse(await req.json().catch(() => null)).success) return deny(400, "Unknown action");
  const { data } = await adminClient().from("contractors").select("*").eq("status", "vetting").is("dropped_at", null).limit(300);
  const cutoff = Date.now() - 2 * 86400000;
  let sent = 0, skipped = 0;
  for (const c of data ?? []) {
    if (!proFileStatus(onboardingChecklist(c as never).steps).missing.length) continue;
    if (c.last_reminder_at && new Date(c.last_reminder_at).getTime() > cutoff) { skipped++; continue; }
    await nudgePro(c.id, null, v!.fullName ?? v!.email ?? "staff").then(() => sent++).catch(() => skipped++);
  }
  return Response.json({ ok: true, sent, skipped });
}
