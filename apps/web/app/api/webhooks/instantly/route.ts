/*
 * FILE    : apps/web/app/api/webhooks/instantly/route.ts
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-03_0324 UTC
 * PURPOSE : Instantly.ai webhook → pro lead status. Set it up in Instantly → Settings → Webhooks with
 *           URL https://<site>/api/webhooks/instantly?secret=<INSTANTLY_WEBHOOK_SECRET> and the events:
 *           email sent, link clicked, reply received, lead unsubscribed, email bounced.
 *           Tolerant of payload shape: reads event_type / lead_email / custom variables.
 */
import { onInstantlyEvent } from "@/lib/leads";
import { validWebhookSecret } from "@/lib/instantly";

export async function POST(req: Request) {
  if (!validWebhookSecret(new URL(req.url).searchParams.get("secret") ?? req.headers.get("x-webhook-secret"))) return new Response("Unauthorized", { status: 401 });
  const b = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!b) return new Response("Bad request", { status: 400 });
  const vars = (b.lead_data ?? b.payload ?? b.custom_variables ?? {}) as Record<string, unknown>;
  const type = String(b.event_type ?? b.event ?? b.type ?? "");
  const email = String(b.lead_email ?? b.email ?? b.lead ?? vars.email ?? "");
  if (!type || !email.includes("@")) return Response.json({ ok: true, ignored: true });
  const step = Number(b.step ?? b.sequence_step ?? NaN);
  const handled = await onInstantlyEvent({
    type, email,
    leadId: String(vars.handled_lead_id ?? b.handled_lead_id ?? "") || null,
    step: Number.isFinite(step) ? step : null,
    text: (b.reply_text ?? b.reply_text_snippet ?? b.text ?? null) as string | null,
  });
  return Response.json({ ok: true, handled });
}
