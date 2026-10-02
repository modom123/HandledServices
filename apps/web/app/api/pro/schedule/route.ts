/*
 * FILE    : apps/web/app/api/pro/schedule/route.ts
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-02_0255 UTC
 * PURPOSE : Pro: my calendar (GET — jobs ahead, days off, open slots, on-call status) and
 *           block or reopen a day (POST {date, off}).
 */
import { z } from "zod";
import { deny, getViewer } from "@/lib/auth";
import { proSchedule, setDayOff } from "@/lib/roster";

export async function GET(req: Request) {
  const v = await getViewer(req);
  if (!v?.contractorId) return deny(403, "Pro account required");
  const days = Math.min(90, Math.max(7, Number(new URL(req.url).searchParams.get("days") ?? 35) || 35));
  const s = await proSchedule(v.contractorId, days);
  return s ? Response.json(s) : deny(404, "Pro not found");
}

const Body = z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), off: z.boolean() });

export async function POST(req: Request) {
  const v = await getViewer(req);
  if (!v?.contractorId) return deny(403, "Pro account required");
  const b = Body.safeParse(await req.json().catch(() => ({})));
  if (!b.success) return deny(400, "Send a date (YYYY-MM-DD) and off true/false");
  const r = await setDayOff(v.contractorId, b.data.date, b.data.off);
  return r.ok ? Response.json(r) : deny(409, r.error!);
}
