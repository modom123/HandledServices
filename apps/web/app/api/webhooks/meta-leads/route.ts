/*
 * FILE    : apps/web/app/api/webhooks/meta-leads/route.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-20_0100 UTC
 * PURPOSE : Facebook & Instagram Lead Ads → Lead inbox, directly from Meta (no Zapier needed).
 *           Meta App → Webhooks → Page → subscribe to "leadgen" with callback https://<site>/api/webhooks/meta-leads
 *           and verify token META_VERIFY_TOKEN. Each event is signed (X-Hub-Signature-256, META_APP_SECRET); we fetch
 *           the lead's answers with the Page token (META_PAGE_ACCESS_TOKEN, leads_retrieval permission) and run speed
 *           to lead. Instagram leads (platform "ig") are tagged Instagram; the rest Meta ads.
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import { intakeLead } from "@/lib/lead-intake";
import { secretMatches } from "@/lib/secret-match";

const GRAPH = "https://graph.facebook.com/v21.0";

export async function GET(req: Request) {
  const p = new URL(req.url).searchParams;
  if (p.get("hub.mode") === "subscribe" && secretMatches(p.get("hub.verify_token"), process.env.META_VERIFY_TOKEN)) return new Response(p.get("hub.challenge") ?? "", { status: 200 });
  return new Response("Forbidden", { status: 403 });
}

function signed(raw: string, header: string | null): boolean {
  const secret = process.env.META_APP_SECRET;
  if (!secret || !header?.startsWith("sha256=")) return false;
  const want = Buffer.from(createHmac("sha256", secret).update(raw).digest("hex"));
  const got = Buffer.from(header.slice(7));
  return want.length === got.length && timingSafeEqual(want, got);
}

export async function POST(req: Request) {
  const raw = await req.text();
  if (!signed(raw, req.headers.get("x-hub-signature-256"))) return new Response("Unauthorized", { status: 401 });
  const token = process.env.META_PAGE_ACCESS_TOKEN;
  const body = JSON.parse(raw || "{}") as { entry?: { changes?: { field?: string; value?: { leadgen_id?: string } }[] }[] };
  let n = 0;
  for (const e of body.entry ?? []) for (const c of e.changes ?? []) {
    const id = c.field === "leadgen" ? c.value?.leadgen_id : null;
    if (!id || !token) continue;
    const res = await fetch(`${GRAPH}/${encodeURIComponent(id)}?fields=field_data,created_time,ad_name,campaign_name,form_id,platform&access_token=${encodeURIComponent(token)}`, { signal: AbortSignal.timeout(10000) }).catch(() => null);
    const lead = (await res?.json().catch(() => null)) as Record<string, unknown> | null;
    if (!res?.ok || !lead) { console.error("[meta-leads] fetch failed", id, res?.status); continue; }
    await intakeLead({ ...lead, lead_id: id, campaign: lead.campaign_name ?? lead.ad_name ?? null }, { channel: lead.platform === "ig" ? "instagram" : "meta_ads" });
    n++;
  }
  return Response.json({ ok: true, leads: n }); // always 200 once signed, so Meta doesn't retry forever
}
