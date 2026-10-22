/*
 * FILE    : apps/web/app/api/ticket-invite/route.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-22_0700 UTC
 * PURPOSE : The phone-call invite page (/ticket/<token>) submits here — no sign-in needed, the token is the key.
 *           POST { token, me: { name, email, phone?, company?, kind }, agree: true, ticket: <Standard Referral Ticket> | null }
 *           → they join as a referral partner (account via the welcome email) and, with a ticket, send us the job.
 *           Rate-limited. Rules: lib/ticket-invites.ts.
 */
import { z } from "zod";
import { PARTNER_KINDS, getService, type PartnerKind } from "@handled/core";
import { clientIp, rateLimit } from "@/lib/ratelimit";
import { completeInvite } from "@/lib/ticket-invites";
import { TicketFields, ticketError } from "@/lib/ticket-schema";

export const maxDuration = 60; // the AI files the ticket before we answer

const Body = z.object({
  token: z.string().regex(/^[a-z0-9]{16,40}$/),
  me: z.object({
    name: z.string().trim().min(2).max(120), email: z.string().trim().email().max(254), phone: z.string().trim().max(30).optional().nullable(),
    company: z.string().trim().max(160).optional().nullable(), kind: z.string().refine((k) => k in PARTNER_KINDS),
  }),
  agree: z.literal(true),
  ticket: TicketFields.nullable(),
});

export async function POST(req: Request) {
  const limited = await rateLimit(req, "form");
  if (limited) return limited;
  const b = Body.safeParse(await req.json().catch(() => null));
  if (!b.success) {
    const at = String(b.error.issues[0]?.path[0] ?? "");
    return Response.json({ error: at === "agree" ? "Agree to the partner terms to join." : at === "me" ? "Fill in your name and email." : at === "ticket" ? ticketError(new z.ZodError(b.error.issues.map((i) => ({ ...i, path: i.path.slice(1) })))) : "Check the form" }, { status: 400 });
  }
  const { token, me, ticket } = b.data;
  const t = ticket ? { ...ticket, service_slug: ticket.service_slug && getService(ticket.service_slug) ? ticket.service_slug : null, i_will_do_it: false } : null;
  const r = await completeInvite(token, { ...me, kind: me.kind as PartnerKind }, t, clientIp(req)).catch((e) => ({ ok: false as const, error: e instanceof Error ? e.message : "Something went wrong" }));
  return r.ok ? Response.json(r) : Response.json({ error: r.error }, { status: 400 });
}
