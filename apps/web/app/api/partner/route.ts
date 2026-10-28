/*
 * FILE    : apps/web/app/api/partner/route.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-07_0120 UTC
 * PURPOSE : The signed-in partner's actions (/partner). POST JSON:
 *             { action: "ticket", …the standard referral ticket (lib/partners Ticket) }  — send us a customer; returns the ticket number
 *             { action: "connect" }                                                       — Stripe payout setup link
 * UPDATED : 2026-10-28_2300 UTC — tickets can carry up to 8 photos of the job (uploaded through /api/uploads).
 * UPDATED : 2026-10-28_0122 UTC — "refer" replaced by the standard referral ticket (ticket number, address, timing, job type, consent).
 */
import { z } from "zod";
import { TICKET_CONTACT, TICKET_JOB_TYPES, TICKET_RELATIONSHIPS, TICKET_TIMING, getService, isPhotoPath } from "@handled/core";
import { deny, getViewer } from "@/lib/auth";
import { rateLimit } from "@/lib/ratelimit";
import { partnerConnectUrl, partnerFor, submitTicket } from "@/lib/partners";

const keys = <T extends Record<string, unknown>>(o: T) => Object.keys(o) as [keyof T & string, ...(keyof T & string)[]];
const opt = (n: number) => z.string().trim().max(n).optional().nullable();

const Body = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("ticket"), name: z.string().trim().min(2).max(120), email: z.string().trim().email().max(254), phone: opt(30), company: opt(160),
    contact_pref: z.enum(keys(TICKET_CONTACT)), best_time: opt(120), address: opt(200), city: opt(80), zip: z.string().trim().regex(/^\d{5}$/),
    service_slug: opt(80), job_type: z.enum(keys(TICKET_JOB_TYPES)), timing: z.enum(keys(TICKET_TIMING)), preferred_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable().or(z.literal("")),
    details: opt(2000), relationship: z.enum(keys(TICKET_RELATIONSHIPS)), note: opt(1000), consent: z.literal(true),
    photos: z.array(z.string().refine(isPhotoPath, "Bad photo")).max(8).default([]),
  }),
  z.object({ action: z.literal("connect") }),
]);

export async function POST(req: Request) {
  const v = await getViewer(req);
  if (!v) return deny(401, "Sign in first");
  const partner = await partnerFor(v);
  if (!partner) return deny(403, "This email isn't a partner yet — sign up at /partners");
  const b = Body.safeParse(await req.json().catch(() => null));
  if (!b.success) return deny(400, b.error.issues.some((i) => i.path[0] === "consent") ? "Confirm the customer agreed to be contacted" : b.error.issues.some((i) => i.path[0] === "zip") ? "Enter the 5-digit ZIP code" : "Check the form");
  if (b.data.action === "connect") {
    const url = await partnerConnectUrl(partner).catch(() => null);
    return url ? Response.json({ url }) : deny(503, "Payouts aren't available yet — we'll email you");
  }
  const limited = await rateLimit(req, "form", `partner:${partner.id}`);
  if (limited) return limited;
  const svc = b.data.service_slug && getService(b.data.service_slug) ? b.data.service_slug : null;
  if (b.data.contact_pref !== "email" && !b.data.phone) return deny(400, "Add their phone number so we can call or text them");
  if (b.data.timing === "date" && !b.data.preferred_date) return deny(400, "Pick the date they need it");
  const r = await submitTicket(partner, { ...b.data, service_slug: svc, preferred_date: b.data.preferred_date || null });
  return r.ok ? Response.json({ ok: true, ticket_no: r.ticket_no }) : deny(400, r.error);
}
