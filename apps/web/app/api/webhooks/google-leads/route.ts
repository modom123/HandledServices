/*
 * FILE    : apps/web/app/api/webhooks/google-leads/route.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-20_0100 UTC
 * PURPOSE : Google Ads lead form extensions → Lead inbox. In Google Ads → the lead form → Export leads → Webhook:
 *           URL https://<site>/api/webhooks/google-leads and key = GOOGLE_LEAD_FORM_KEY (any long random string).
 *           Google sends user_column_data (FULL_NAME, EMAIL, PHONE_NUMBER, POSTAL_CODE, COMPANY_NAME…), the gclid
 *           and google_key; test leads (is_test) are accepted but marked so.
 */
import { intakeLead } from "@/lib/lead-intake";
import { secretMatches } from "@/lib/secret-match";

export async function POST(req: Request) {
  const b = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!b || !secretMatches(typeof b.google_key === "string" ? b.google_key : null, process.env.GOOGLE_LEAD_FORM_KEY)) return new Response("Unauthorized", { status: 401 });
  const r = await intakeLead({ ...b, gclid: b.gcl_id ?? null, campaign: b.campaign_id ? `campaign ${b.campaign_id}` : null, message: b.is_test ? "(Google test lead)" : null }, { channel: "google_ads" });
  return Response.json({ ok: r.ok }, { status: r.ok ? 200 : 400 });
}
