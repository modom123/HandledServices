/*
 * FILE    : apps/web/app/api/cron/daily-brief/route.ts
 * PROJECT : Handled — AI-run home & business services
 * CREATED : 2026-10-01_1723 UTC
 * PURPOSE : Vercel cron 12:00 UTC — AI morning brief to the ops dashboard + email.
 */
import { buildDailyBrief } from "@/lib/ai/brief";
import { sendDayBeforeReminders } from "@/lib/jobs";
import { adminClient } from "@/lib/supabase/server";
import { opsEmail, sendEmail } from "@/lib/notify";
import { BRAND } from "@handled/core";

export const maxDuration = 120;

export async function GET(req: Request) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) return new Response("Unauthorized", { status: 401 });
  const reminders = await sendDayBeforeReminders().catch((e) => { console.error("[reminders]", e); return 0; });
  const brief = await buildDailyBrief();
  if (!brief) return Response.json({ ok: false, reason: "AI unavailable", reminders });
  const body = [`Yesterday:\n- ${brief.yesterday.join("\n- ")}`, `Today:\n- ${brief.today.join("\n- ")}`, `Risks:\n- ${brief.risks.join("\n- ")}`, `Actions:\n1. ${brief.actions.join("\n1. ")}`].join("\n\n");
  await adminClient().from("ops_alerts").insert({ kind: "daily_brief", severity: "info", title: brief.headline, body });
  if (opsEmail()) await sendEmail(opsEmail(), `${BRAND.name} brief: ${brief.headline}`, body);
  return Response.json({ ok: true, brief });
}
