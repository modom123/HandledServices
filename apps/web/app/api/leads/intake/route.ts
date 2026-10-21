/*
 * FILE    : apps/web/app/api/leads/intake/route.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-20_0100 UTC
 * PURPOSE : Universal lead intake for automations (Zapier, Make, n8n): TikTok Lead Gen, LinkedIn Lead Gen Forms, Yelp
 *           Request-a-Quote, Google Local Services, Facebook / Instagram (if not using the direct webhook), Angi,
 *           Thumbtack… POST JSON or form fields to
 *             https://<site>/api/leads/intake?key=<LEAD_INTAKE_SECRET>&channel=tiktok_ads
 *           Field names are flexible (name / full_name / first_name + last_name, email, phone / phone_number, company,
 *           zip, service, message, campaign, lead_id, sms_consent). Speed to lead runs right away.
 */
import { intakeLead } from "@/lib/lead-intake";
import { secretMatches } from "@/lib/secret-match";

export async function POST(req: Request) {
  const url = new URL(req.url);
  if (!secretMatches(url.searchParams.get("key") ?? req.headers.get("x-intake-key"), process.env.LEAD_INTAKE_SECRET)) return new Response("Unauthorized", { status: 401 });
  const type = req.headers.get("content-type") ?? "";
  const body = type.includes("application/json")
    ? ((await req.json().catch(() => null)) as Record<string, unknown> | null)
    : Object.fromEntries((await req.formData().catch(() => new FormData())).entries());
  if (!body || typeof body !== "object") return Response.json({ error: "Send the lead as JSON or form fields" }, { status: 400 });
  const leads = Array.isArray(body) ? (body as Record<string, unknown>[]).slice(0, 50) : [body];
  const results = [];
  for (const l of leads) results.push(await intakeLead(l, { channel: url.searchParams.get("channel") }));
  const bad = results.filter((r) => !r.ok);
  return Response.json({ ok: !bad.length, results }, { status: bad.length === results.length ? 400 : 200 });
}
