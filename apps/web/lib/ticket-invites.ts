/*
 * FILE    : apps/web/lib/ticket-invites.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-22_0700 UTC
 * PURPOSE : Referral ticket invites — for someone we speak with on the phone.
 *             sendInvite()     — staff (Hub, Call desk) or an IEBC worker sends a personal link by text and/or email
 *                                (text only with their consent on the call). Their name, email and phone come along.
 *             inviteByToken()  — the /ticket/<token> page: the invite, marked opened the first time
 *             completeInvite() — they submit: they become a referral partner (terms accepted, welcome email with a
 *                                one-click sign-in that creates their Handled account) and, if they sent a job, the
 *                                Standard Referral Ticket goes through submitTicket() like any other. Or they just join.
 *           The sender hears when they join or send a job. Invites expire after 30 days (daily sweep).
 * UPDATED : 2026-10-22_0800 UTC — pros and partners send invites too (from their partner page): the message says who asked
 *           us to send it, they're told when the person joins, and they see who they brought into the network.
 *           Guards: active partners only, 15 invites a day, no inviting yourself or someone already in the network.
 */
import "server-only";
import { BRAND, PARTNER_KINDS, PARTNER_PROGRAM, makeTicketToken, pctLabel, type PartnerKind } from "@handled/core";
import { adminClient } from "./supabase/server";
import { opsEmail, sendEmail, siteUrl } from "./notify";
import { raiseAlert } from "./jobs";
import { signUp, submitTicket, type Partner, type TicketInput } from "./partners";

const db = () => adminClient();
const P = PARTNER_PROGRAM;

export type Invite = {
  id: string; token: string; name: string; email: string | null; phone: string | null; company: string | null; kind: PartnerKind; job_hint: string | null;
  sent_by: string; via_email: boolean; via_sms: boolean; sms_consent: boolean; status: "sent" | "opened" | "completed" | "expired" | "cancelled";
  opened_at: string | null; completed_at: string | null; partner_id: string | null; ticket_id: string | null; biz_lead_id: string | null; expires_at: string; created_at: string;
  invited_by_partner_id?: string | null;
};

/** A pro or partner sending an invite (rather than Handled staff or an IEBC worker). */
export type InvitingPartner = { id: string; name: string; email: string; company: string | null; status: string };
export const PARTNER_INVITES_PER_DAY = 15;

export const inviteLink = (i: Pick<Invite, "token">) => `${siteUrl()}/ticket/${i.token}`;

/** Send the person on the phone their referral ticket. Email and/or text (text only when they agreed on the call). */
export async function sendInvite(o: {
  name: string; email?: string | null; phone?: string | null; company?: string | null; kind?: PartnerKind | null; job_hint?: string | null;
  via_email: boolean; via_sms: boolean; sms_consent: boolean; sent_by: string; biz_lead_id?: string | null; from?: InvitingPartner | null;
}): Promise<{ ok: true; invite: Invite; sent: string[] } | { ok: false; error: string }> {
  const email = o.email?.trim().toLowerCase() || null;
  const phone = o.phone?.trim() || null;
  if (o.via_email && !email) return { ok: false, error: "Add their email to send it by email." };
  if (o.via_sms && !phone) return { ok: false, error: "Add their mobile number to send it by text." };
  if (o.via_sms && !o.sms_consent) return { ok: false, error: "Only text them if they agreed on the call." };
  if (!o.via_email && !o.via_sms) return { ok: false, error: "Send it by email, text, or both." };
  if (o.from) {
    if (o.from.status !== "active") return { ok: false, error: "Your partner account is paused — contact us." };
    if (email && email === o.from.email.toLowerCase()) return { ok: false, error: "That's you — share your own link instead." };
    if (email) {
      const { data: already } = await db().from("referral_partners").select("id").eq("email", email).maybeSingle();
      if (already) return { ok: false, error: "They're already in the Handled network — they can send jobs from their own partner page." };
    }
    const since = new Date(Date.now() - 86400000).toISOString();
    const { count } = await db().from("ticket_invites").select("id", { count: "exact", head: true }).eq("invited_by_partner_id", o.from.id).gte("created_at", since);
    if ((count ?? 0) >= PARTNER_INVITES_PER_DAY) return { ok: false, error: `You can send ${PARTNER_INVITES_PER_DAY} invites a day — try again tomorrow.` };
  }
  const kind: PartnerKind = o.kind && o.kind in PARTNER_KINDS ? o.kind : "other";
  let invite: Invite | null = null;
  for (let i = 0; i < 3 && !invite; i++) {
    const { data, error } = await db().from("ticket_invites").insert({
      token: makeTicketToken(), name: o.name.trim(), email, phone, company: o.company?.trim() || null, kind, job_hint: o.job_hint?.trim() || null,
      sent_by: o.sent_by, via_email: o.via_email, via_sms: o.via_sms, sms_consent: o.sms_consent, biz_lead_id: o.biz_lead_id ?? null,
      ...(o.from ? { invited_by_partner_id: o.from.id } : {}),
      expires_at: new Date(Date.now() + P.inviteDays * 86400000).toISOString(),
    }).select("*").single();
    if (data) invite = data as Invite;
    else if (error && !/duplicate|unique/i.test(error.message)) return { ok: false, error: /ticket_invites/.test(error.message) ? "Ticket invites aren't switched on yet — run ADD_TICKET_INVITES_2026-10-22_0700.sql." : error.message };
  }
  if (!invite) return { ok: false, error: "Couldn't create the link — try again." };
  const first = invite.name.split(" ")[0];
  const link = inviteLink(invite);
  const sender = o.sent_by.replace(/@.*$/, "").replace(/[._]/g, " ").split(" ")[0];
  const senderName = sender ? sender[0].toUpperCase() + sender.slice(1) : BRAND.name;
  // from a pro or partner: say who asked us to send it (and that they're in the network themselves)
  const fromWho = o.from ? `${o.from.name}${o.from.company ? ` (${o.from.company})` : ""}` : null;
  const opener = fromWho ? `${fromWho} asked us to send you this — they're part of the ${BRAND.name} network and thought you'd be a great fit.` : `Thanks for talking with ${senderName} at ${BRAND.name}.`;
  const sent: string[] = [];
  if (o.via_email && email) {
    const ok = await sendEmail(email, `Your ${BRAND.name} referral ticket${invite.job_hint ? " — for the job we talked about" : ""}`,
      `Hi ${first},\n\n${opener} Here's your personal referral ticket:\n${link}\n\n${invite.job_hint ? `Fill it out for the job you mentioned (${invite.job_hint.slice(0, 160)}) — it takes about 3 minutes, and your details are already filled in.` : "Fill it out for any job you'd like to send us — it takes about 3 minutes, and your details are already filled in."}\n\nSending it also signs you up for the ${BRAND.name} network (free). You earn ${pctLabel(P.jobOncePct)}% of our fee on a one-time job, ${pctLabel(P.jobRecurringPct)}% on every visit of a recurring job for ${P.months} months, and ${pctLabel(P.pctOfTake)}% of everything from people you refer — paid to your bank every week. No job right now? The same link lets you just join. Do this kind of work yourself? You can apply to be a ${BRAND.name} pro from there too.\n\nThe link works for ${P.inviteDays} days.\n\n— ${BRAND.name}`).catch(() => false);
    if (ok) sent.push("email");
  }
  if (o.via_sms && phone && o.sms_consent) {
    const { sendSms } = await import("./sms");
    const ok = await sendSms(phone, `${BRAND.name}: hi ${first}, ${fromWho ? `${o.from!.name.split(" ")[0]} asked us to send you this.` : "thanks for the call!"} Your referral ticket (about 3 min, earn ${pctLabel(P.jobOncePct)}% per job you send us): ${link} Reply STOP to opt out.`);
    if (ok) sent.push("text");
  }
  return { ok: true, invite, sent };
}

/** The invite page: an invite that still works (marked opened the first time). */
export async function inviteByToken(token: string): Promise<Invite | null> {
  if (!/^[a-z0-9]{16,40}$/.test(token)) return null;
  const { data } = await db().from("ticket_invites").select("*").eq("token", token).maybeSingle();
  const inv = data as Invite | null;
  if (!inv || !["sent", "opened"].includes(inv.status) || new Date(inv.expires_at) < new Date()) return null;
  if (inv.status === "sent") await db().from("ticket_invites").update({ status: "opened", opened_at: new Date().toISOString() }).eq("id", inv.id).eq("status", "sent");
  return inv;
}

/**
 * They submit from their link: join as a referral partner (their account comes with the welcome email) and, when they
 * filled in a job, send the Standard Referral Ticket. Joining works even if the ticket is refused, so they're never lost.
 */
export async function completeInvite(token: string, me: { name: string; email: string; phone?: string | null; company?: string | null; kind: PartnerKind }, ticket: TicketInput | null, ip: string | null):
  Promise<{ ok: true; joined: true; ticket: { status: string; service: string | null; summary: string | null; missing: string[] } | null; ticketError: string | null } | { ok: false; error: string }> {
  const inv = await inviteByToken(token);
  if (!inv) return { ok: false, error: "This link has expired or was already used — ask us for a new one, or sign up at /partners." };
  // a second try from the same link (their first ticket needed fixing) reuses the partner it already made — no second welcome
  const { data: again } = inv.partner_id ? await db().from("referral_partners").select("*").eq("id", inv.partner_id).maybeSingle() : { data: null };
  const { partner, existing } = again ? { partner: again as Partner, existing: true } : await signUp({
    name: me.name, email: me.email, phone: me.phone ?? inv.phone, company: me.company ?? inv.company, kind: me.kind in PARTNER_KINDS ? me.kind : inv.kind,
    how: `Invited by ${inv.sent_by}${inv.job_hint ? ` — ${inv.job_hint.slice(0, 200)}` : ""}`, ip,
  });
  let result: { status: string; service: string | null; summary: string | null; missing: string[] } | null = null;
  let ticketError: string | null = null;
  let ticketId: string | null = null;
  if (ticket) {
    const r = await submitTicket(partner, ticket);
    if (r.ok) {
      ticketId = r.ticket.id;
      const { getService } = await import("@handled/core");
      result = { status: r.ticket.status, service: r.ticket.service_slug ? getService(r.ticket.service_slug)?.name ?? null : null, summary: r.ticket.ai_summary, missing: r.ticket.missing_info };
    } else ticketError = r.error;
  }
  // a ticket that was refused leaves the link open so they can fix it and send again; joining alone completes it
  const done = !ticket || Boolean(ticketId);
  await db().from("ticket_invites").update({ partner_id: partner.id, ...(done ? { status: "completed", completed_at: new Date().toISOString() } : {}), ...(ticketId ? { ticket_id: ticketId } : {}) }).eq("id", inv.id);
  const what = `${me.name}${existing ? " (already a partner)" : " joined the referral network"}${ticketId ? " and sent a referral ticket" : ""}`;
  await raiseAlert("referral_invite", "info", `Ticket invite: ${what}`, `Invited by ${inv.sent_by}. Partner code ${partner.code}.${ticketId ? " The ticket is in Hub → Referrals & tickets." : ""}`).catch(() => {});
  // tell whoever sent it: a pro or partner on their partner page; staff in the Hub (an IEBC worker's invites go to ops)
  const { data: byPartner } = inv.invited_by_partner_id ? await db().from("referral_partners").select("name, email").eq("id", inv.invited_by_partner_id).maybeSingle() : { data: null };
  const to = byPartner?.email ?? (/@/.test(inv.sent_by) ? inv.sent_by : opsEmail());
  if (to && done) await sendEmail(to, `${what} — thanks to you`, byPartner
    ? `Hi ${byPartner.name.split(" ")[0]},\n\n${what} from the referral ticket you sent them. Thanks for growing the ${BRAND.name} network.\n\nYour partner page: ${siteUrl()}/partner\n\n— ${BRAND.name}`
    : `${what} from the referral ticket link you sent.\n\nHub → Referrals & tickets: ${siteUrl()}/hub/partners\n\n— ${BRAND.name}`).catch(() => {});
  return { ok: true, joined: true, ticket: result, ticketError };
}

/** The pro application opened from an invite (also after they joined): their name, email, phone and company. */
export async function invitePrefill(token: string | undefined): Promise<{ name: string; email: string; phone: string; company: string } | null> {
  if (!token || !/^[a-z0-9]{16,40}$/.test(token)) return null;
  const { data } = await db().from("ticket_invites").select("name, email, phone, company, status, expires_at").eq("token", token).maybeSingle();
  if (!data || data.status === "cancelled" || new Date(data.expires_at) < new Date()) return null;
  return { name: data.name, email: data.email ?? "", phone: data.phone ?? "", company: data.company ?? "" };
}

/** Daily sweep: invites nobody used in time. */
export async function expireInvites(now = new Date()): Promise<number> {
  const { data } = await db().from("ticket_invites").update({ status: "expired" }).in("status", ["sent", "opened"]).lte("expires_at", now.toISOString()).select("id");
  return data?.length ?? 0;
}
