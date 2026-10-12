/*
 * FILE    : apps/web/app/api/webhooks/twilio/route.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-12_0005 UTC
 * PURPOSE : Incoming texts from Twilio (two-way texting). Set it in Twilio → Phone Numbers → your number (or the Messaging
 *           Service → Integration) → "A message comes in": Webhook, HTTP POST, https://<site>/api/webhooks/twilio.
 *           Requests are verified with the X-Twilio-Signature header (TWILIO_AUTH_TOKEN). Replies with empty TwiML —
 *           staff answer from Hub → Texts; Twilio answers STOP / HELP itself.
 */
import { receiveText, validTwilioSignature } from "@/lib/texts";

const twiml = () => new Response('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', { headers: { "Content-Type": "text/xml" } });

export async function POST(req: Request) {
  const form = await req.formData().catch(() => null);
  if (!form) return new Response("Bad request", { status: 400 });
  const params: Record<string, string> = {};
  form.forEach((v, k) => { if (typeof v === "string") params[k] = v; });
  if (!validTwilioSignature(req.headers.get("x-twilio-signature"), req.url, params)) return new Response("Forbidden", { status: 403 });
  if (!params.From) return twiml();
  await receiveText({ from: params.From, to: params.To ?? null, body: params.Body ?? "", sid: params.MessageSid ?? params.SmsSid ?? null, media: Number(params.NumMedia ?? 0) || 0 });
  return twiml();
}
