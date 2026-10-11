/*
 * FILE    : apps/web/lib/notification-log.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-11_2242 UTC
 * PURPOSE : Notification log: every email (deliverEmail), text (sendSms) and push (notify) is recorded with its channel,
 *           recipient, subject, a short preview, sent / failed / skipped and why, and the job it's about (the job ref
 *           "H-1234" found in the subject or text, or the push's jobId). Staff see it on the Hub job page and as "last
 *           contacted" on Hub → Dispatch. Privacy: links are replaced with [link] (sign-in, payment and invoice links
 *           carry one-time tokens) and 6–10 digit codes are masked, so no sign-in code or token is ever stored.
 *           Logging never throws and never blocks a send; without the table (setup script not run yet) it does nothing.
 *           Rows older than 180 days are pruned by the daily sweep (pruneNotificationLog).
 */
import "server-only";
import { adminClient } from "./supabase/server";

export type NoticeChannel = "email" | "sms" | "push";

const REF = /\bH-\d{3,}\b/;
const scrub = (s: string) => s.replace(/https?:\/\/\S+/g, "[link]").replace(/\b\d{6,10}\b/g, "••••••").replace(/\s+/g, " ").trim();

/** Record one message. Never throws. */
export async function logNotice(n: { channel: NoticeChannel; to: string | string[]; subject?: string | null; text?: string | null; status: "sent" | "failed" | "skipped"; error?: string | null; jobId?: string | null }) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return;
  try {
    const subject = n.subject ? scrub(n.subject).slice(0, 200) : null;
    const preview = n.text ? scrub(n.text).slice(0, 240) : null;
    const job_ref = `${n.subject ?? ""} ${n.text ?? ""}`.match(REF)?.[0] ?? null;
    const recipients = (Array.isArray(n.to) ? n.to : [n.to]).filter(Boolean).slice(0, 20);
    if (!recipients.length) return;
    await adminClient().from("notification_log").insert(recipients.map((to) => ({
      channel: n.channel, recipient: String(to).slice(0, 200), subject, preview, status: n.status, error: n.error ? n.error.slice(0, 300) : null,
      job_id: n.jobId && /^[0-9a-f-]{36}$/i.test(n.jobId) ? n.jobId : null, job_ref,
    })));
  } catch { /* logging must never break sending */ }
}

/** Delete log rows older than 180 days (daily sweep). */
export async function pruneNotificationLog() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return 0;
  const { count } = await adminClient().from("notification_log").delete({ count: "exact" }).lt("created_at", new Date(Date.now() - 180 * 86400000).toISOString());
  return count ?? 0;
}
