/*
 * FILE    : apps/web/lib/notify.ts
 * PROJECT : Handled — AI-run home & business services
 * CREATED : 2026-10-01_1723 UTC
 * UPDATED : 2026-10-03_0027 UTC — optional email headers (List-Unsubscribe for reminder emails).
 * PURPOSE : Outbound email (Resend). Without RESEND_API_KEY messages are logged, so
 *           every flow still works in development.
 */
import "server-only";

export async function sendEmail(to: string | string[], subject: string, text: string, opts: { headers?: Record<string, string> } = {}) {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.info(`[email:dev] to=${to} subject="${subject}"\n${text}`);
    return;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: process.env.EMAIL_FROM ?? "Handled <hello@handled.example>", to, subject, text, ...(opts.headers ? { headers: opts.headers } : {}) }),
  });
  if (!res.ok) console.error("[email] send failed", res.status, await res.text());
}

export const opsEmail = () => process.env.OPS_EMAIL ?? "";
export const siteUrl = () => process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
