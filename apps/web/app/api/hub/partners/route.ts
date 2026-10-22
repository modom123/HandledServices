/*
 * FILE    : apps/web/app/api/hub/partners/route.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-07_0120 UTC
 * PURPOSE : Hub → Partners controls (staff). POST JSON:
 *             { action: "status", id, status: "active" | "suspended" }
 *             { action: "assign", partner_id, email }   — credit a customer to a partner by hand (12 months from today)
 *             { action: "unassign", email }             — remove a customer's partner (future jobs stop paying)
 *             { action: "void", commission_id, note }   — cancel an unpaid commission
 *             { action: "ticket_send", ticket_id, service_slug } — approve a referral ticket (service set) and email the customer their link
 *             { action: "ticket_cancel", ticket_id }    — cancel a referral ticket (its link stops working)
 * UPDATED : 2026-10-11_0451 UTC — voiding a commission is admins only.
 * UPDATED : 2026-10-22_0400 UTC — referral tickets: approve & send, re-send, cancel.
 *             { action: "invite", name, email?, phone?, company?, kind?, job_hint?, via_email, via_sms, sms_consent, biz_lead_id? }
 *                                                       — send someone on the phone their referral ticket (they join the network)
 * UPDATED : 2026-10-22_0700 UTC — ticket invites (Hub → Referrals & tickets and the Call desk).
 */
import { z } from "zod";
import { PARTNER_KINDS, getService, partnerExpiry, type PartnerKind } from "@handled/core";
import { ADMINS_ONLY, deny, getViewer, isAdmin, isStaff } from "@/lib/auth";
import { adminClient } from "@/lib/supabase/server";

const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("status"), id: z.string().uuid(), status: z.enum(["active", "suspended"]) }),
  z.object({ action: z.literal("assign"), partner_id: z.string().uuid(), email: z.string().trim().email() }),
  z.object({ action: z.literal("unassign"), email: z.string().trim().email() }),
  z.object({ action: z.literal("void"), commission_id: z.string().uuid(), note: z.string().trim().max(300) }),
  z.object({ action: z.literal("ticket_send"), ticket_id: z.string().uuid(), service_slug: z.string().refine((s) => Boolean(getService(s)), "Pick a service") }),
  z.object({ action: z.literal("ticket_cancel"), ticket_id: z.string().uuid() }),
  z.object({
    action: z.literal("invite"), name: z.string().trim().min(2).max(120), email: z.string().trim().email().max(254).optional().nullable().or(z.literal("")),
    phone: z.string().trim().max(30).optional().nullable(), company: z.string().trim().max(160).optional().nullable(), kind: z.string().refine((k) => k in PARTNER_KINDS).optional().nullable(),
    job_hint: z.string().trim().max(500).optional().nullable(), via_email: z.boolean(), via_sms: z.boolean(), sms_consent: z.boolean(), biz_lead_id: z.string().uuid().optional().nullable(),
  }),
]);

export async function POST(req: Request) {
  const v = await getViewer(req);
  if (!isStaff(v)) return deny();
  const b = Body.safeParse(await req.json().catch(() => null));
  if (!b.success) return deny(400, "Check the request");
  const d = b.data;
  if (d.action === "void" && !isAdmin(v)) return deny(403, ADMINS_ONLY);
  const db = adminClient();
  let error: { message: string } | null = null;
  if (d.action === "status") ({ error } = await db.from("referral_partners").update({ status: d.status }).eq("id", d.id));
  if (d.action === "assign") ({ error } = await db.from("referral_customers").upsert({ partner_id: d.partner_id, customer_email: d.email.toLowerCase(), source: "staff", note: `assigned by ${v!.email}`, expires_at: partnerExpiry(new Date()).toISOString() }, { onConflict: "customer_email" }));
  if (d.action === "unassign") ({ error } = await db.from("referral_customers").delete().eq("customer_email", d.email.toLowerCase()));
  if (d.action === "void") ({ error } = await db.from("partner_commissions").update({ status: "void", amount: 0, note: `${d.note} (${v!.email})` }).eq("id", d.commission_id).eq("status", "pending"));
  if (d.action === "invite") {
    const { action: _a, ...o } = d;
    const r = await (await import("@/lib/ticket-invites")).sendInvite({ ...o, kind: (o.kind ?? null) as PartnerKind | null, sent_by: v!.email });
    return r.ok ? Response.json({ ok: true, link: (await import("@/lib/ticket-invites")).inviteLink(r.invite), sent: r.sent }) : deny(400, r.error);
  }
  if (d.action === "ticket_cancel") {
    ({ error } = await db.from("referral_tickets").update({ status: "cancelled", updated_at: new Date().toISOString() }).eq("id", d.ticket_id).in("status", ["open", "needs_review"]));
    if (!error) await (await import("@/lib/partners")).ticketEvent(d.ticket_id, `Cancelled by ${v!.email}.`);
  }
  if (d.action === "ticket_send") {
    const { data: t } = await db.from("referral_tickets").update({ status: "open", service_slug: d.service_slug, updated_at: new Date().toISOString() }).eq("id", d.ticket_id).in("status", ["open", "needs_review"]).select("*").maybeSingle();
    if (!t) return deny(409, "This ticket is already booked, expired or cancelled");
    if (!t.zip) return deny(400, "The ticket has no ZIP — ask the referrer");
    await (await import("@/lib/partners")).sendTicketToCustomer(t as never);
  }
  return error ? deny(500, error.message) : Response.json({ ok: true });
}
