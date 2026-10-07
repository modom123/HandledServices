/*
 * FILE    : apps/web/app/api/partner/route.ts
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-07_0120 UTC
 * PURPOSE : The signed-in partner's actions (/partner). POST JSON:
 *             { action: "refer", name, email, phone?, service_slug?, note? }  — send us a customer (we email them a booking link)
 *             { action: "connect" }                                          — Stripe payout setup link
 */
import { z } from "zod";
import { getService } from "@handled/core";
import { deny, getViewer } from "@/lib/auth";
import { rateLimit } from "@/lib/ratelimit";
import { partnerConnectUrl, partnerFor, referCustomer } from "@/lib/partners";

const Body = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("refer"), name: z.string().trim().min(2).max(120), email: z.string().trim().email().max(254),
    phone: z.string().trim().max(30).optional().nullable(), service_slug: z.string().max(80).optional().nullable(), note: z.string().trim().max(1000).optional().nullable(),
  }),
  z.object({ action: z.literal("connect") }),
]);

export async function POST(req: Request) {
  const v = await getViewer(req);
  if (!v) return deny(401, "Sign in first");
  const partner = await partnerFor(v);
  if (!partner) return deny(403, "This email isn't a partner yet — sign up at /partners");
  const b = Body.safeParse(await req.json().catch(() => null));
  if (!b.success) return deny(400, "Check the form");
  if (b.data.action === "connect") {
    const url = await partnerConnectUrl(partner).catch(() => null);
    return url ? Response.json({ url }) : deny(503, "Payouts aren't available yet — we'll email you");
  }
  const limited = await rateLimit(req, "form", `partner:${partner.id}`);
  if (limited) return limited;
  const svc = b.data.service_slug && getService(b.data.service_slug) ? b.data.service_slug : null;
  const r = await referCustomer(partner, { ...b.data, service_slug: svc });
  return r.ok ? Response.json({ ok: true }) : deny(400, r.error);
}
