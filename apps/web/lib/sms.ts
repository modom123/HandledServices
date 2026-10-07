/*
 * FILE    : apps/web/lib/sms.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-02_0316 UTC
 * PURPOSE : Text messages (Twilio REST — no SDK). Without TWILIO_* settings messages are logged,
 *           so every flow still works in development. Twilio handles STOP/HELP opt-outs; we also
 *           skip people who opted out in their profile. US numbers are normalized to +1.
 *           Env: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_MESSAGING_SERVICE_SID or TWILIO_FROM.
 */
import "server-only";

export function e164(phone: string | null | undefined): string | null {
  const d = (phone ?? "").replace(/\D/g, "");
  if (d.length === 10) return `+1${d}`;
  if (d.length === 11 && d.startsWith("1")) return `+${d}`;
  return (phone ?? "").startsWith("+") && d.length >= 10 ? `+${d}` : null;
}

export const smsConfigured = () => Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && (process.env.TWILIO_MESSAGING_SERVICE_SID || process.env.TWILIO_FROM));

/** Send one text. Returns true if Twilio accepted it. Never throws. */
export async function sendSms(to: string | null | undefined, body: string): Promise<boolean> {
  const num = e164(to);
  if (!num) return false;
  const text = body.length > 600 ? `${body.slice(0, 597)}…` : body;
  if (!smsConfigured()) {
    console.info(`[sms:dev] to=${num} ${text}`);
    return false;
  }
  const sid = process.env.TWILIO_ACCOUNT_SID!;
  const form = new URLSearchParams({ To: num, Body: text });
  if (process.env.TWILIO_MESSAGING_SERVICE_SID) form.set("MessagingServiceSid", process.env.TWILIO_MESSAGING_SERVICE_SID);
  else form.set("From", process.env.TWILIO_FROM!);
  try {
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: "POST",
      headers: { Authorization: `Basic ${Buffer.from(`${sid}:${process.env.TWILIO_AUTH_TOKEN}`).toString("base64")}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: form,
    });
    if (!res.ok) console.error("[sms] failed", res.status, (await res.text()).slice(0, 300));
    return res.ok;
  } catch (e) {
    console.error("[sms]", e);
    return false;
  }
}
