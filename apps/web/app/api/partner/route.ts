/*
 * FILE    : apps/web/app/api/partner/route.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-07_0120 UTC
 * PURPOSE : The signed-in partner's actions (/partner). POST JSON:
 *             { action: "refer", name, email, phone?, service_slug?, note? }  — send us a customer (we email them a booking link)
 *             { action: "connect" }                                          — Stripe payout setup link
 *             { action: "join", agree: true }                                — a signed-in pro or client joins in one tap
 *             { action: "ticket", customer_*, address…, description, service_slug?, frequency?, urgency?, budget?,
 *               access_notes?, photos?, customer_consent: true, i_will_do_it? } — a referral ticket (AI files it, customer gets a link)
 * UPDATED : 2026-10-22_0400 UTC — one-tap join for pros and clients; referral tickets.
 * UPDATED : 2026-10-22_0500 UTC — referral ticket photos (paths from /api/uploads, up to 8).
 * UPDATED : 2026-10-22_0500 UTC — GET ?customer=<email>: autofill a ticket from the referrer's OWN earlier tickets or referrals
 *           for that customer (never anyone else's data; no entry details).
 */
import { z } from "zod";
import { getService, isPhotoPath } from "@handled/core";
import { deny, getViewer } from "@/lib/auth";
import { clientIp, rateLimit } from "@/lib/ratelimit";
import { adminClient } from "@/lib/supabase/server";
import { joinPartner, partnerConnectUrl, partnerFor, referCustomer, submitTicket } from "@/lib/partners";

export const maxDuration = 60; // the AI files a ticket before we answer

const Body = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("refer"), name: z.string().trim().min(2).max(120), email: z.string().trim().email().max(254),
    phone: z.string().trim().max(30).optional().nullable(), service_slug: z.string().max(80).optional().nullable(), note: z.string().trim().max(1000).optional().nullable(),
  }),
  z.object({ action: z.literal("connect") }),
  z.object({ action: z.literal("join"), agree: z.literal(true) }),
  z.object({
    action: z.literal("ticket"),
    customer_name: z.string().trim().min(2).max(120), customer_email: z.string().trim().email().max(254), customer_phone: z.string().trim().max(30).optional().nullable(),
    company_name: z.string().trim().max(160).optional().nullable(),
    address: z.string().trim().max(200).optional().nullable(), city: z.string().trim().max(80).optional().nullable(),
    state: z.string().trim().max(2).optional().nullable(), zip: z.string().trim().regex(/^\d{5}$/, "5-digit ZIP"),
    description: z.string().trim().min(10).max(3000), service_slug: z.string().max(80).optional().nullable(),
    frequency: z.enum(["once", "weekly", "biweekly", "monthly", "quarterly"]).optional().nullable(),
    urgency: z.enum(["asap", "this_week", "two_weeks", "month", "flexible"]).optional().nullable(),
    budget: z.coerce.number().min(0).max(10_000_000).optional().nullable(), access_notes: z.string().trim().max(1000).optional().nullable(),
    customer_consent: z.literal(true), i_will_do_it: z.boolean().optional(),
    photos: z.array(z.string().refine(isPhotoPath, "Bad photo")).max(8).default([]),
  }),
]);

export async function GET(req: Request) {
  const v = await getViewer(req);
  if (!v) return deny(401, "Sign in first");
  const partner = await partnerFor(v);
  if (!partner) return deny(403, "Not a partner");
  const email = z.string().trim().toLowerCase().email().safeParse(new URL(req.url).searchParams.get("customer"));
  if (!email.success) return Response.json({ customer: null });
  const db = adminClient();
  const { data: t } = await db.from("referral_tickets").select("customer_name, customer_phone, company_name, address, city, state, zip").eq("partner_id", partner.id).eq("customer_email", email.data).order("created_at", { ascending: false }).limit(1).then((r) => r, () => ({ data: null }));
  if (t?.length) return Response.json({ customer: t[0] });
  const { data: c } = await db.from("referral_customers").select("customer_name, customer_phone").eq("partner_id", partner.id).eq("customer_email", email.data).maybeSingle();
  return Response.json({ customer: c ?? null });
}

export async function POST(req: Request) {
  const v = await getViewer(req);
  if (!v) return deny(401, "Sign in first");
  const b = Body.safeParse(await req.json().catch(() => null));
  if (!b.success) return deny(400, b.error.issues[0]?.path[0] === "customer_consent" ? "Only send a ticket the customer asked you to send." : "Check the form");
  if (b.data.action === "join") {
    const p = await joinPartner(v, clientIp(req)).catch((e) => { console.error("[partners]", e); return null; });
    return p ? Response.json({ ok: true, code: p.code }) : deny(500, "Couldn't join — try again");
  }
  const partner = await partnerFor(v);
  if (!partner) return deny(403, "This email isn't a partner yet — sign up at /partners");
  if (b.data.action === "connect") {
    const url = await partnerConnectUrl(partner).catch(() => null);
    return url ? Response.json({ url }) : deny(503, "Payouts aren't available yet — we'll email you");
  }
  const limited = await rateLimit(req, "form", `partner:${partner.id}`);
  if (limited) return limited;
  if (b.data.action === "ticket") {
    const { action: _a, ...t } = b.data;
    const r = await submitTicket(partner, { ...t, service_slug: t.service_slug && getService(t.service_slug) ? t.service_slug : null });
    return r.ok
      ? Response.json({ ok: true, status: r.ticket.status, service: r.ticket.service_slug ? getService(r.ticket.service_slug)?.name : null, summary: r.ticket.ai_summary, missing: r.ticket.missing_info })
      : deny(400, r.error);
  }
  const svc = b.data.service_slug && getService(b.data.service_slug) ? b.data.service_slug : null;
  const r = await referCustomer(partner, { ...b.data, service_slug: svc });
  return r.ok ? Response.json({ ok: true }) : deny(400, r.error);
}
