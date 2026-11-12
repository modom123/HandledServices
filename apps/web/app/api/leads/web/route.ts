/*
 * FILE    : apps/web/app/api/leads/web/route.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-20_0100 UTC
 * PURPOSE : The website's "Get a quote / call me" form → Lead inbox (channel from the visitor's first touch: an ad,
 *           social, Google, Yelp… or the website). Speed to lead runs right away. Rate limited; texts only with the
 *           consent box ticked.
 * UPDATED : 2026-11-07_1614 UTC — accepts a campaign (e.g. "post-project" from /post).
 * UPDATED : 2026-11-07_1500 UTC — Post & earn: partner_optin (the /post tick-box) joins the Partner Program and sets up
 *           10% back, up to $250, on the poster's own first project. Needs an email; never fails the lead.
 * UPDATED : 2026-11-12_1700 UTC — clear errors (a bad email or a missing name said "add an email or phone"), and the
 *           visitor's saved first-touch attribution is cleaned instead of failing the post (a long ad click id or a
 *           non-text value used to reject the whole form).
 * UPDATED : 2026-11-12_1800 UTC — photos: up to 8 paths from /api/uploads, saved on the lead (Hub → Lead inbox).
 */
import { z } from "zod";
import { channelOf, isPhotoPath } from "@handled/core";
import { clientIp, rateLimit } from "@/lib/ratelimit";
import { enrollFromPost } from "@/lib/partners";
import { intakeLead } from "@/lib/lead-intake";
import { supabaseConfigured } from "@/lib/supabase/env";

const s = (max: number) => z.string().trim().max(max).optional().nullable();
const Body = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.string().trim().email().max(200).optional().nullable().or(z.literal("")),
  phone: s(30),
  company: s(160),
  zip: s(10),
  service: s(80),
  campaign: s(80),
  message: s(3000),
  photos: z.array(z.string().refine(isPhotoPath)).max(8).optional(),
  sms_consent: z.boolean().optional(),
  partner_optin: z.boolean().optional(),
  attribution: z.unknown().optional(), // cleaned below: never a reason to lose a lead
  website: s(200), // honeypot: people never fill it
});

export async function POST(req: Request) {
  const limited = await rateLimit(req, "form");
  if (limited) return limited;
  const b = Body.safeParse(await req.json().catch(() => null));
  if (!b.success) {
    const field = String(b.error.issues[0]?.path[0] ?? "");
    const error = field === "name" ? "Add your name" : field === "email" ? "That email doesn't look right" : field === "message" ? "That description is too long — please shorten it" : field === "photos" ? "One of the photos didn't upload — remove it and try again" : "Check the form and try again";
    return Response.json({ error }, { status: 400 });
  }
  if (b.data.website) return Response.json({ ok: true }); // a bot filled the hidden field
  if (!b.data.email && !b.data.phone) return Response.json({ error: "Add an email or phone number so we can reach you" }, { status: 400 });
  if (!supabaseConfigured || !process.env.SUPABASE_SERVICE_ROLE_KEY) return Response.json({ error: "Not available right now — please call or email us" }, { status: 503 });
  const { attribution: rawAttr, website: _w, partner_optin, photos, ...lead } = b.data;
  const attribution = cleanAttribution(rawAttr);
  const ch = channelOf(attribution ?? null);
  const r = await intakeLead({ ...(attribution ?? {}), ...lead, email: lead.email || null }, { channel: ch === "direct" ? "website" : ch, photos: photos ?? [] });
  if (!r.ok) return Response.json({ error: r.error ?? "Couldn't send — try again" }, { status: 400 });
  const partner = partner_optin && lead.email ? await enrollFromPost({ name: lead.name, email: lead.email, phone: lead.phone, service_slug: lead.service, ip: clientIp(req) }) : null;
  return Response.json(partner ? { ok: true, partner } : { ok: true });
}

/** First-touch attribution from the browser: text values only, trimmed, at most 20 keys. */
function cleanAttribution(v: unknown): Record<string, string> | null {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  const out: Record<string, string> = {};
  for (const [k, x] of Object.entries(v as Record<string, unknown>).slice(0, 20)) {
    if ((typeof x === "string" || typeof x === "number") && /^[\w-]{1,40}$/.test(k)) { const t = String(x).trim().slice(0, 300); if (t) out[k] = t; }
  }
  return Object.keys(out).length ? out : null;
}
