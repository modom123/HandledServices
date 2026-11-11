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
 */
import { z } from "zod";
import { channelOf } from "@handled/core";
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
  sms_consent: z.boolean().optional(),
  partner_optin: z.boolean().optional(),
  attribution: z.record(z.string(), z.string().max(300)).nullable().optional(),
  website: s(200), // honeypot: people never fill it
});

export async function POST(req: Request) {
  const limited = await rateLimit(req, "form");
  if (limited) return limited;
  const b = Body.safeParse(await req.json().catch(() => null));
  if (!b.success || (!b.data.email && !b.data.phone)) return Response.json({ error: "Add your name and an email or phone number" }, { status: 400 });
  if (b.data.website) return Response.json({ ok: true }); // a bot filled the hidden field
  if (!supabaseConfigured || !process.env.SUPABASE_SERVICE_ROLE_KEY) return Response.json({ error: "Not available right now" }, { status: 503 });
  const { attribution, website: _w, partner_optin, ...lead } = b.data;
  const ch = channelOf(attribution ?? null);
  const r = await intakeLead({ ...(attribution ?? {}), ...lead, email: lead.email || null }, { channel: ch === "direct" ? "website" : ch });
  if (!r.ok) return Response.json({ error: r.error ?? "Couldn't send — try again" }, { status: 400 });
  const partner = partner_optin && lead.email ? await enrollFromPost({ name: lead.name, email: lead.email, phone: lead.phone, service_slug: lead.service, ip: clientIp(req) }) : null;
  return Response.json(partner ? { ok: true, partner } : { ok: true });
}
