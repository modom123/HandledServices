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
 * UPDATED : 2026-10-07_0140 UTC — deliverEmail(): says why a send failed (shown on sign-in); Resend refusal → company mailbox.
 * UPDATED : 2026-10-07_0010 UTC — siteUrl() never hands out a localhost link on Vercel (falls back to the production domain).
 */
import "server-only";

export async function sendEmail(to: string | string[], subject: string, text: string, opts: { headers?: Record<string, string> } = {}): Promise<boolean> {
  return (await deliverEmail(to, subject, text, opts)).ok;
}

/** The sender address Resend uses (must be on a domain verified in Resend). */
export const emailFrom = () => process.env.EMAIL_FROM || "Handled <info@handledsvc.com>";

/**
 * Send an email and say why it failed. Resend first; if Resend refuses (e.g. the sender's domain isn't verified) and the
 * company mailbox is connected, the mailbox sends it instead.
 */
export async function deliverEmail(to: string | string[], subject: string, text: string, opts: { headers?: Record<string, string> } = {}): Promise<{ ok: boolean; via?: "resend" | "smtp"; error?: string }> {
  const key = process.env.RESEND_API_KEY;
  const smtpReady = Boolean(process.env.SMTP_USER && process.env.SMTP_PASSWORD);
  const viaSmtp = async (): Promise<{ ok: boolean; via?: "smtp"; error?: string }> => {
    const { sendMail } = await import("./mailbox");
    const name = (process.env.EMAIL_FROM ?? "").match(/^\s*"?([^"<]+?)"?\s*</)?.[1] ?? "Handled";
    let error: string | undefined;
    for (const addr of Array.isArray(to) ? to : [to])
      await sendMail({ to: addr, subject, text, fromName: name, headers: opts.headers }).catch((e) => { error = e instanceof Error ? e.message : String(e); console.error("[email] smtp send failed", error); });
    return error ? { ok: false, error: `mailbox: ${error}` } : { ok: true, via: "smtp" };
  };
  if (!key && smtpReady) return viaSmtp();
  if (!key) {
    console.info(`[email:dev] to=${to} subject="${subject}"\n${text}`);
    return { ok: false, error: "no email provider (RESEND_API_KEY or SMTP_USER/SMTP_PASSWORD)" };
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: emailFrom(), to, subject, text, ...(opts.headers ? { headers: opts.headers } : {}) }),
  }).catch((e) => { console.error("[email] send failed", e instanceof Error ? e.message : e); return null; });
  if (res?.ok) return { ok: true, via: "resend" };
  const body = res ? await res.text().catch(() => "") : "";
  const reason = res ? `Resend ${res.status}: ${(body.match(/"message"\s*:\s*"([^"]+)"/)?.[1] ?? body).slice(0, 200)}` : "Resend unreachable";
  console.error("[email] send failed", reason);
  if (smtpReady) { const r = await viaSmtp(); return r.ok ? r : { ok: false, error: `${reason}; ${r.error}` }; }
  return { ok: false, error: reason };
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
