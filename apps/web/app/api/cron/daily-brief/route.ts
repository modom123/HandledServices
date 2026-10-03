/*
 * FILE    : apps/web/app/api/cron/daily-brief/route.ts
 * PROJECT : Handled — AI-run home & business services
 * CREATED : 2026-10-01_1723 UTC
 * UPDATED : 2026-10-03_0027 UTC — also sends seasonal reminders to past customers (once a day).
 * UPDATED : 2026-10-03_0123 UTC — pro standing sweep (written warnings, reviews, yearly background re-checks).
 * PURPOSE : Vercel cron 12:00 UTC — AI morning brief to the ops dashboard + email.
 */
import { buildDailyBrief } from "@/lib/ai/brief";
import { sendDayBeforeReminders } from "@/lib/jobs";
import { sendSeasonalReminders } from "@/lib/reminders";
import { standingSweep } from "@/lib/standing";
import { adminClient } from "@/lib/supabase/server";
import { opsEmail, sendEmail } from "@/lib/notify";
import { BRAND } from "@handled/core";

export const maxDuration = 120;

export async function GET(req: Request) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) return new Response("Unauthorized", { status: 401 });
  const reminders = await sendDayBeforeReminders().catch((e) => { console.error("[reminders]", e); return 0; });
  const seasonal = await sendSeasonalReminders().catch((e) => { console.error("[seasonal]", e); return 0; }); // once a day
  const standing = await standingSweep().catch((e) => { console.error("[standing]", e); return null; }); // warnings, reviews, yearly re-checks
  const brief = await buildDailyBrief();
  if (!brief) return Response.json({ ok: false, reason: "AI unavailable", reminders, seasonal, standing });
  const body = [`Yesterday:\n- ${brief.yesterday.join("\n- ")}`, `Today:\n- ${brief.today.join("\n- ")}`, `Risks:\n- ${brief.risks.join("\n- ")}`, `Actions:\n1. ${brief.actions.join("\n1. ")}`].join("\n\n");
  await adminClient().from("ops_alerts").insert({ kind: "daily_brief", severity: "info", title: brief.headline, body });
  if (opsEmail()) await sendEmail(opsEmail(), `${BRAND.name} brief: ${brief.headline}`, body);
  return Response.json({ ok: true, brief, reminders, seasonal, standing });
}
