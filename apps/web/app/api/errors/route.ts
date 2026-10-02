/*
 * FILE    : apps/web/app/api/errors/route.ts
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-02_1329 UTC
 * PURPOSE : Crash reports from the website (error pages) and the mobile app → Hub alerts.
 *           Rate-limited per IP; message and stack are truncated.
 */
import { z } from "zod";
import { reportError } from "@/lib/errors";
import { rateLimit } from "@/lib/ratelimit";

const Body = z.object({ source: z.enum(["web", "app"]), message: z.string().max(500), path: z.string().max(300).optional(), stack: z.string().max(4000).optional(), digest: z.string().max(100).optional(), extra: z.string().max(500).optional() });

export async function POST(req: Request) {
  const limited = await rateLimit(req, "error_report");
  if (limited) return limited;
  const b = Body.safeParse(await req.json().catch(() => null));
  if (!b.success) return Response.json({ ok: false }, { status: 400 });
  await reportError(b.data);
  return Response.json({ ok: true });
}
