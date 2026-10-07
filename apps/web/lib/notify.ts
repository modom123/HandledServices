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
 * UPDATED : 2026-10-06_2300 UTC — sendEmail() returns whether the email was handed off (sign-in codes fall back to Supabase when it wasn't);
 *           emailConfigured().
 * UPDATED : 2026-10-07_0010 UTC — siteUrl() never hands out a localhost link on Vercel (falls back to the production domain).
 */
import "server-only";

export async function sendEmail(to: string | string[], subject: string, text: string, opts: { headers?: Record<string, string> } = {}): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  if (!key && process.env.SMTP_USER && process.env.SMTP_PASSWORD) {
    const { sendMail } = await import("./mailbox");
    const name = (process.env.EMAIL_FROM ?? "").match(/^\s*"?([^"<]+?)"?\s*</)?.[1] ?? "Handled";
    let ok = true;
    for (const addr of Array.isArray(to) ? to : [to])
      await sendMail({ to: addr, subject, text, fromName: name, headers: opts.headers }).catch((e) => { ok = false; console.error("[email] smtp send failed", e instanceof Error ? e.message : e); });
    return ok;
  }
  if (!key) {
    console.info(`[email:dev] to=${to} subject="${subject}"\n${text}`);
    return false;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: process.env.EMAIL_FROM || "Handled <info@handledsvc.com>", to, subject, text, ...(opts.headers ? { headers: opts.headers } : {}) }),
  }).catch((e) => { console.error("[email] send failed", e instanceof Error ? e.message : e); return null; });
  if (!res?.ok) { if (res) console.error("[email] send failed", res.status, await res.text()); return false; }
  return true;
}

/** Can we actually deliver email (Resend or the company mailbox)? */
export const emailConfigured = () => Boolean(process.env.RESEND_API_KEY || (process.env.SMTP_USER && process.env.SMTP_PASSWORD));

export const opsEmail = () => process.env.OPS_EMAIL || "info@handledsvc.com";
/**
 * The public web address for links in emails. NEXT_PUBLIC_SITE_URL wins — unless it's missing or still the localhost example
 * while running on Vercel (that sent members to "localhost refused to connect"); then Vercel's own production domain is used.
 */
export const siteUrl = () => {
  const set = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "");
  const local = !set || /localhost|127\.0\.0\.1/.test(set);
  if (!local || !process.env.VERCEL) return set || "http://localhost:3000";
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL;
  return vercel ? `https://${vercel}` : set || "http://localhost:3000";
};
