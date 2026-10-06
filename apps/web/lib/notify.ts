/*
 * FILE    : apps/web/lib/notify.ts
 * PROJECT : Handled — AI-run home & business services
 * CREATED : 2026-10-01_1723 UTC
 * UPDATED : 2026-10-03_0027 UTC — optional email headers (List-Unsubscribe for reminder emails).
 * PURPOSE : Outbound email (Resend). Without RESEND_API_KEY messages are logged, so
 *           every flow still works in development.
 * UPDATED : 2026-10-05_0148 UTC — no Resend key but the company mailbox is connected (Hostinger SMTP, mailbox.ts) → booking
 *           and system emails go out from that mailbox.
 * UPDATED : 2026-10-06_2105 UTC — defaults: sender and ops alerts go to info@handledsvc.com (EMAIL_FROM / OPS_EMAIL override).
 */
import "server-only";

export async function sendEmail(to: string | string[], subject: string, text: string, opts: { headers?: Record<string, string> } = {}) {
  const key = process.env.RESEND_API_KEY;
  if (!key && process.env.SMTP_USER && process.env.SMTP_PASSWORD) {
    const { sendMail } = await import("./mailbox");
    const name = (process.env.EMAIL_FROM ?? "").match(/^\s*"?([^"<]+?)"?\s*</)?.[1] ?? "Handled";
    for (const addr of Array.isArray(to) ? to : [to])
      await sendMail({ to: addr, subject, text, fromName: name, headers: opts.headers }).catch((e) => console.error("[email] smtp send failed", e instanceof Error ? e.message : e));
    return;
  }
  if (!key) {
    console.info(`[email:dev] to=${to} subject="${subject}"\n${text}`);
    return;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: process.env.EMAIL_FROM || "Handled <info@handledsvc.com>", to, subject, text, ...(opts.headers ? { headers: opts.headers } : {}) }),
  });
  if (!res.ok) console.error("[email] send failed", res.status, await res.text());
}

export const opsEmail = () => process.env.OPS_EMAIL || "info@handledsvc.com";
export const siteUrl = () => process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
