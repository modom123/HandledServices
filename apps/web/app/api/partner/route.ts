/*
 * FILE    : apps/web/app/api/partner/route.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-07_0120 UTC
 * PURPOSE : The signed-in partner's actions (/partner). POST JSON:
 *             { action: "refer", name, email, phone?, service_slug?, note? }  — send us a customer (we email them a booking link)
 *             { action: "connect" }                                          — Stripe payout setup link
 *             { action: "ticket", photos[0–4], service_slug, answers, frequency, urgency, preferred_date?, time_window,
 *               customer_type, company_name?, budget?, access_notes?, close_notes?, decision_maker, customer_*, address…,
 *               notes?, consent: true }  — Field Sales ticket, close-ready (lib/sales-tickets). Returns the pay link + price.
 * UPDATED : 2026-11-06_1638 UTC — Field Sales tickets.
 */
import { z } from "zod";
import { SALES_TICKET, getService, isPhotoPath } from "@handled/core";
import { deny, getViewer } from "@/lib/auth";
import { rateLimit } from "@/lib/ratelimit";
import { partnerConnectUrl, partnerFor, referCustomer } from "@/lib/partners";
import { createTicket } from "@/lib/sales-tickets";

const opt = (n: number) => z.string().trim().max(n).optional().nullable().transform((v) => v || null);

const Body = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("refer"), name: z.string().trim().min(2).max(120), email: z.string().trim().email().max(254),
    phone: z.string().trim().max(30).optional().nullable(), service_slug: z.string().max(80).optional().nullable(), note: z.string().trim().max(1000).optional().nullable(),
  }),
  z.object({ action: z.literal("connect") }),
  z.object({
    action: z.literal("ticket"),
    photos: z.array(z.string().refine(isPhotoPath, "Bad photo")).max(SALES_TICKET.maxPhotos, `Up to ${SALES_TICKET.maxPhotos} photos`).default([]),
    service_slug: opt(80), notes: opt(2000),
    answers: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).default({}),
    frequency: z.enum(["once", "weekly", "biweekly", "monthly", "quarterly"]).default("once"),
    urgency: z.enum(["asap", "this_week", "two_weeks", "month", "flexible"]).nullable().optional().transform((v) => v ?? null),
    preferred_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional().or(z.literal("")).transform((v) => v || null),
    time_window: z.enum(["morning", "midday", "afternoon", "flexible"]).default("flexible"),
    customer_type: z.enum(["residential", "commercial"]).default("residential"),
    company_name: opt(160), access_notes: opt(1000), close_notes: opt(1000),
    budget: z.coerce.number().min(0).max(10_000_000).nullable().optional().transform((v) => (v && v > 0 ? v : null)),
    decision_maker: z.boolean().default(false),
    customer_name: z.string().trim().min(2).max(120), customer_email: z.string().trim().email().max(254), customer_phone: opt(30),
    address: opt(200), city: opt(80), state: z.string().trim().length(2).optional().nullable().transform((v) => v || null),
    zip: z.string().trim().regex(/^\d{5}$/, "5-digit ZIP").optional().nullable().or(z.literal("")).transform((v) => v || null),
    consent: z.literal(true, { message: "Confirm the customer asked us to contact them" }),
  }),
]);

export async function POST(req: Request) {
  const v = await getViewer(req);
  if (!v) return deny(401, "Sign in first");
  const partner = await partnerFor(v);
  if (!partner) return deny(403, "This email isn't a partner yet — sign up at /partners");
  const b = Body.safeParse(await req.json().catch(() => null));
  if (!b.success) return deny(400, b.error.issues[0]?.message ?? "Check the form");
  if (b.data.action === "connect") {
    const url = await partnerConnectUrl(partner).catch(() => null);
    return url ? Response.json({ url }) : deny(503, "Payouts aren't available yet — we'll email you");
  }
  const limited = await rateLimit(req, "form", `partner:${partner.id}`);
  if (limited) return limited;
  if (b.data.action === "ticket") {
    const t = await createTicket(partner, { ...b.data, service_slug: b.data.service_slug && getService(b.data.service_slug) ? b.data.service_slug : null });
    return t.ok ? Response.json({ ok: true, id: t.ticket.id, link: t.link, price: t.price }) : deny(400, t.error);
  }
  const svc = b.data.service_slug && getService(b.data.service_slug) ? b.data.service_slug : null;
  const r = await referCustomer(partner, { ...b.data, service_slug: svc });
  return r.ok ? Response.json({ ok: true }) : deny(400, r.error);
}
