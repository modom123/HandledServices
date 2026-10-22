/*
 * FILE    : apps/web/lib/partners.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-07_0105 UTC
 * PURPOSE : Referral Partner Program (rules in packages/core/src/partners.ts).
 *             signUp()            — anyone becomes a partner: code, link, welcome email with a sign-in link
 *             referCustomer()     — a partner sends us a customer: we email them a booking link, the customer is theirs
 *             attributeJob()      — at booking: credit the job to the customer's partner (existing referral, or a
 *                                   partner link clicked in the last 90 days for a NEW customer)
 *             accrueCommission()  — at completion: 10% of our take, payable after the 30-day window
 *             runPartnerPayouts() — Mondays: every eligible commission, re-checked for refunds, sent via Stripe Connect
 *           Guards: one partner per customer (first wins), no self-referrals, existing customers don't count,
 *           suspended partners earn nothing, refunds reduce or void the commission before it's paid.
 * UPDATED : 2026-10-22_0400 UTC — REFERRAL TICKETS (pros, clients, anyone): submitTicket() takes the whole job, the AI files
 *           it (service, frequency, pricing answers, summary, what's missing) against the referrer and the customer's
 *           account, and the customer gets a pre-filled booking link. At booking attributeJob() credits the ticket; once
 *           paid, the job is broadcast and assigned like any other (a referring pro can ask for first look). Commissions:
 *           20% of our take on a one-time job, 15% on every visit of a recurring plan for 12 months; each row records
 *           its basis and rate. The referrer hears at every step (ticketEvent). joinPartner(): one-tap join for pros
 *           and clients (pros reuse their Stripe payout account).
 * UPDATED : 2026-10-22_0500 UTC — ticket photos: stored on the ticket, shown to the AI when it files it, carried into the
 *           customer's pre-filled booking (no re-upload) and mentioned in their email.
 * UPDATED : 2026-10-22_0600 UTC — the Standard Referral Ticket (RT-1): submitTicket() refuses a ticket missing what the
 *           standard requires (ticketCheck), keeps the referrer's own size answers over the AI's, stores the details,
 *           version and completeness score, and builds the job notes from the standard fields (ticketNotes).
 * UPDATED : 2026-10-22_0900 UTC — SHARED referral bonus: half from Handled's take, half from the pro on the job. At
 *           completion the pro's half (when proSharesReferral: accepted from the effective date under agreement v10+) becomes
 *           a "Your half of the referral bonus" line on their payout statement; syncProShare() moves it down with refunds
 *           and voids. The bonus is still worked out on the pro's full pay. jobs.referral_pct is set at attribution so the
 *           offer and work order show the pro their half before they accept.
 * UPDATED : 2026-10-22_1000 UTC — ONE HANDLED ACCOUNT: signUp() (sign-up page, flyer QR, ticket invites) creates or finds the
 *           person's Handled account right away and links it (lib/accounts ensureAccount); the welcome email says it's
 *           one account to book, refer and get paid. Payouts go only to partners with a linked account.
 * UPDATED : 2026-10-22_1100 UTC — security (commission fraud): tickets for existing customers go to staff review and earn only
 *           through the ticket's own link; the no-link email match credits new customers only (core ticketCredit); a pro
 *           can't ticket a customer they did the same service for in the last 12 months (core ticketIntake). Existing-
 *           customer lookups escape "_" / "%" (ilike wildcards).
 * UPDATED : 2026-10-07_1610 UTC — partner payouts: only the transfer decides success (no double pay after a later error); checks the Stripe balance first; per-attempt idempotency keys.
 */
import "server-only";
import { cookies } from "next/headers";
import {
  BRAND, COMMISSION_BASIS, PRO_OWN_CUSTOMER_DAYS, ticketCredit, ticketIntake, proSharesReferral, referralCostShares, PARTNER_PROGRAM, cleanPartnerCode, cleanTicketToken, getService, jobReferralBasis, makePartnerCode, makeTicketToken,
  TICKET_STANDARD_VERSION, ticketCheck, ticketNotes, type TicketDetails, money, moneySplit, partnerCommission, partnerExpiry, partnerTake, pctLabel, ticketExpiry, type Answers, type CommissionBasis, type Job, type PartnerKind,
} from "@handled/core";
import { adminClient } from "./supabase/server";
import { opsEmail, sendEmail, siteUrl } from "./notify";
import { raiseAlert } from "./jobs";
import { availableBalance, getStripe } from "./stripe";

const db = () => adminClient();
export const PARTNER_COOKIE = "handled_partner";
const lower = (e: string) => e.trim().toLowerCase();

export type Partner = {
  id: string; code: string; name: string; email: string; phone: string | null; company: string | null; kind: PartnerKind; how: string | null;
  status: "active" | "suspended"; profile_id: string | null; stripe_account_id: string | null; xero_contact_id: string | null; created_at: string;
  contractor_id?: string | null;
};

const P = PARTNER_PROGRAM;
/** What partners earn, in one line, for emails and pages. */
export const earnLine = () =>
  `Refer a person: ${pctLabel(P.pctOfTake)}% of our fee on every job they book for ${P.months} months. Send a referral ticket for a job: ${pctLabel(P.jobOncePct)}% of our fee on a one-time job, or ${pctLabel(P.jobRecurringPct)}% on every visit of a recurring job for ${P.months} months.`;

export const partnerLink = (code: string, path = "/home") => `${siteUrl()}${path}?partner=${code}`;

// ─── Sign-up ─────────────────────────────────────────────────────────────────

export async function signUp(o: {
  name: string; email: string; phone?: string | null; company?: string | null; kind: PartnerKind; how?: string | null; ip: string | null;
  profile_id?: string | null; contractor_id?: string | null; stripe_account_id?: string | null;
}): Promise<{ partner: Partner; existing: boolean }> {
  const email = lower(o.email);
  const { data: found } = await db().from("referral_partners").select("*").eq("email", email).maybeSingle();
  if (found) { await linkAccount(found as Partner); await sendWelcome(found as Partner, true); return { partner: found as Partner, existing: true }; }
  let partner: Partner | null = null;
  for (let i = 0; i < 5 && !partner; i++) {
    const { data, error } = await db().from("referral_partners").insert({
      code: makePartnerCode(o.company || o.name), name: o.name.trim(), email, phone: o.phone || null, company: o.company || null, kind: o.kind, how: o.how || null,
      terms_version: PARTNER_PROGRAM.termsVersion, terms_accepted_at: new Date().toISOString(), terms_ip: o.ip,
      // joining from a signed-in account: link it, and a pro's existing Stripe payout account pays commissions too
      ...(o.profile_id ? { profile_id: o.profile_id } : {}), ...(o.contractor_id ? { contractor_id: o.contractor_id } : {}), ...(o.stripe_account_id ? { stripe_account_id: o.stripe_account_id } : {}),
    }).select("*").single();
    if (data) partner = data as Partner;
    else if (error && !/duplicate|unique/i.test(error.message)) throw new Error(error.message);
  }
  if (!partner) throw new Error("Couldn't create a partner code — try again");
  await linkAccount(partner); // one Handled account: made now, not at first sign-in
  await sendWelcome(partner, false);
  if (opsEmail()) await sendEmail(opsEmail(), `New referral partner: ${partner.name}${partner.company ? ` (${partner.company})` : ""}`, `${partner.kind} · ${email} · code ${partner.code}\n${partner.how ?? ""}\n\nHub → Partners: ${siteUrl()}/hub/partners`).catch(() => {});
  return { partner, existing: false };
}

/** Make sure the partner has a Handled account and that it's linked (the same account books, refers and gets paid). */
async function linkAccount(partner: Partner) {
  if (partner.profile_id) return;
  const { ensureAccount } = await import("./accounts");
  const id = await ensureAccount({ email: partner.email, name: partner.name, phone: partner.phone });
  if (id) { await db().from("referral_partners").update({ profile_id: id }).eq("id", partner.id).is("profile_id", null); partner.profile_id = id; }
}

/** The partner's code, link and a one-tap sign-in to their partner page (sent at sign-up, and again if they sign up twice). */
async function sendWelcome(partner: Partner, again: boolean) {
  const { signInLink } = await import("./signin");
  const portal = await signInLink(partner.email, "/partner");
  await sendEmail(partner.email, again ? `Your ${BRAND.name} partner link` : `Welcome to the ${BRAND.name} Partner Program`, `Hi ${partner.name.split(" ")[0]},\n\n${again ? "Here's your partner info again." : `You're in — welcome to the ${BRAND.name} network. Your free ${BRAND.name} account is ready: one account to book services, send referrals and get paid.`} Your partner code is ${partner.code}.\n\nShare this link: ${partnerLink(partner.code)}\nShort link for cards and texts: ${siteUrl()}/r/${partner.code}\n\n${earnLine()} Paid weekly once each job is past our ${PARTNER_PROGRAM.holdDays}-day make-it-right window.\n\nSign in to your ${BRAND.name} account (one tap, no password) — your partner page is where you send people, fill out referral tickets, track earnings and set up payouts: ${portal}\n\n— ${BRAND.name}`);
}

/** The signed-in person's partner record (by account, else by email — and link the account on first visit). */
export async function partnerFor(viewer: { userId: string; email: string }): Promise<Partner | null> {
  const { data: byProfile } = await db().from("referral_partners").select("*").eq("profile_id", viewer.userId).maybeSingle();
  if (byProfile) return byProfile as Partner;
  const { data: byEmail } = await db().from("referral_partners").select("*").eq("email", lower(viewer.email)).maybeSingle();
  if (byEmail && !byEmail.profile_id) await db().from("referral_partners").update({ profile_id: viewer.userId }).eq("id", byEmail.id);
  return (byEmail as Partner) ?? null;
}

/**
 * One-tap join for a signed-in pro or client (the page shows the terms and they tick to agree). Name and phone come from
 * their account; a pro's Stripe payout account is reused, so pros can be paid with no extra setup.
 */
export async function joinPartner(viewer: { userId: string; email: string; fullName: string | null; contractorId: string | null }, ip: string | null): Promise<Partner> {
  const have = await partnerFor(viewer);
  if (have) return have;
  const [{ data: profile }, { data: pro }] = await Promise.all([
    db().from("profiles").select("full_name, phone, company").eq("id", viewer.userId).maybeSingle(),
    viewer.contractorId ? db().from("contractors").select("id, contact_name, business_name, phone, stripe_account_id").eq("id", viewer.contractorId).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const { partner } = await signUp({
    name: pro?.contact_name || profile?.full_name || viewer.fullName || viewer.email.split("@")[0], email: viewer.email,
    phone: pro?.phone ?? profile?.phone ?? null, company: pro?.business_name ?? profile?.company ?? null,
    kind: pro ? "pro" : "customer", how: pro ? "Handled pro (joined from the pro portal)" : "Handled client (joined from their account)", ip,
    profile_id: viewer.userId, contractor_id: pro?.id ?? null, stripe_account_id: pro?.stripe_account_id ?? null,
  });
  return partner;
}

// ─── Who a customer belongs to ───────────────────────────────────────────────

/** Has this email already paid for a job with us (other than `exceptJob`)? Existing customers can't be referred. */
const likeEmail = (e: string) => e.replace(/[\\%_]/g, (c) => `\\${c}`); // "_" and "%" in an email are ilike wildcards

async function isExistingCustomer(email: string, exceptJob?: string, before?: string) {
  let q = db().from("jobs").select("id", { count: "exact", head: true }).ilike("contact_email", likeEmail(email)).not("paid_at", "is", null);
  if (exceptJob) q = q.neq("id", exceptJob);
  if (before) q = q.lt("paid_at", before); // paid before this moment (e.g. before a ticket was created)
  const { count } = await q;
  return (count ?? 0) > 0;
}

/** A partner sends us a customer directly. They get an email with a booking link; the customer is the partner's. */
export async function referCustomer(partner: Partner, c: { name: string; email: string; phone?: string | null; service_slug?: string | null; note?: string | null }): Promise<{ ok: true } | { ok: false; error: string }> {
  if (partner.status !== "active") return { ok: false, error: "Your partner account is paused — contact us." };
  const email = lower(c.email);
  if (email === partner.email) return { ok: false, error: "You can't refer yourself." };
  const { data: taken } = await db().from("referral_customers").select("partner_id").eq("customer_email", email).maybeSingle();
  if (taken) return { ok: false, error: taken.partner_id === partner.id ? "You already referred this customer." : "This customer was already referred by someone else." };
  if (await isExistingCustomer(email)) return { ok: false, error: `This customer already uses ${BRAND.name}, so they can't be referred.` };
  const { error } = await db().from("referral_customers").insert({
    partner_id: partner.id, customer_email: email, customer_name: c.name, customer_phone: c.phone || null, service_slug: c.service_slug || null, note: c.note || null,
    source: "direct", expires_at: partnerExpiry(new Date()).toISOString(),
  });
  if (error) return { ok: false, error: /duplicate|unique/i.test(error.message) ? "This customer was already referred." : error.message };
  const svc = c.service_slug ? getService(c.service_slug) : null;
  const book = `${siteUrl()}/book?${svc ? `service=${svc.slug}&` : ""}partner=${partner.code}`;
  await sendEmail(email, `${partner.name} recommended ${BRAND.name}${svc ? ` for ${svc.name.toLowerCase()}` : ""}`,
    `Hi ${c.name.split(" ")[0]},\n\n${partner.name}${partner.company ? ` (${partner.company})` : ""} thought you'd like ${BRAND.name}${svc ? ` for your ${svc.name.toLowerCase()}` : ""}: insured, background-checked local pros, an upfront price in 60 seconds, photo proof when it's done, and a free redo if anything's missed.\n\nSee your price and book: ${book}\n${c.note ? `\nNote from ${partner.name.split(" ")[0]}: ${c.note}\n` : ""}\nQuestions? Just reply.\n\n— ${BRAND.name}`);
  return { ok: true };
}

/** An active "refer a person" claim on this customer (inside its 12 months), if any. */
async function personClaim(email: string) {
  const { data } = await db().from("referral_customers").select("partner_id, expires_at, created_at").eq("customer_email", email).maybeSingle();
  return data && new Date(data.expires_at) > new Date() ? (data as { partner_id: string; expires_at: string; created_at: string }) : null;
}

// ─── Referral tickets ────────────────────────────────────────────────────────

export type Ticket = {
  id: string; token: string; partner_id: string; customer_email: string; customer_name: string; customer_phone: string | null; customer_id: string | null;
  company_name: string | null; address: string | null; city: string | null; state: string | null; zip: string | null;
  description: string; service_slug: string | null; frequency: string; urgency: string | null; budget: number | null; access_notes: string | null;
  photos: string[]; details: Partial<TicketDetails>; standard_version: string | null; completeness: number | null; customer_consent: boolean; preferred_contractor_id: string | null; answers: Answers; ai_summary: string | null; missing_info: string[];
  ai_confidence: "high" | "medium" | "low" | null; status: "open" | "needs_review" | "booked" | "expired" | "cancelled"; basis: "job_once" | "job_recurring" | null;
  job_id: string | null; pays_until: string | null; expires_at: string; events: { at: string; text: string }[]; created_at: string;
};

export type TicketInput = {
  customer_name: string; customer_email: string; customer_phone?: string | null; company_name?: string | null;
  address?: string | null; city?: string | null; state?: string | null; zip?: string | null;
  description: string; service_slug?: string | null; frequency?: string | null; urgency?: string | null; budget?: number | null; access_notes?: string | null;
  photos?: string[]; answers?: Answers; details?: Partial<TicketDetails>; customer_consent: boolean; customer_expects_contact?: boolean; i_will_do_it?: boolean;
};

/** The customer's personal booking link: the booking page opens with everything on the ticket filled in. */
export const ticketLink = (t: Pick<Ticket, "token">) => `${siteUrl()}/book?ticket=${t.token}`;

/** Add a line to the ticket's timeline, and tell the referrer when it matters. */
export async function ticketEvent(ticketId: string, text: string, tell?: { subject: string; body: string }) {
  const { data } = await db().from("referral_tickets").select("events, partner_id, customer_name, referral_partners(name, email)").eq("id", ticketId).maybeSingle();
  if (!data) return;
  const events = [...((data.events as Ticket["events"]) ?? []), { at: new Date().toISOString(), text }].slice(-50);
  await db().from("referral_tickets").update({ events, updated_at: new Date().toISOString() }).eq("id", ticketId);
  const p = data.referral_partners as unknown as { name: string; email: string } | null;
  if (tell && p) await sendEmail(p.email, tell.subject, `Hi ${p.name.split(" ")[0]},\n\n${tell.body}\n\nYour tickets and earnings: ${siteUrl()}/partner\n\n— ${BRAND.name}`).catch(() => {});
}

/**
 * A referrer (pro, client, anyone) submits a ticket. The AI files it — service, frequency, pricing answers, a summary
 * and what's missing — under the referrer and the customer's account. A clear ticket emails the customer a pre-filled
 * booking link; an unclear one goes to staff review first. Existing customers can be sent new work; a customer another
 * partner referred can't. Pros can ask to do the job themselves (first look at dispatch, never guaranteed).
 */
export async function submitTicket(partner: Partner, input: TicketInput): Promise<{ ok: true; ticket: Ticket } | { ok: false; error: string }> {
  if (partner.status !== "active") return { ok: false, error: "Your partner account is paused — contact us." };
  if (!input.customer_consent) return { ok: false, error: "Only send a ticket the customer asked you to send." };
  const email = lower(input.customer_email);
  if (email === partner.email) return { ok: false, error: "You can't send a ticket for yourself — book it at /book." };
  const claim = await personClaim(email);
  if (claim && claim.partner_id !== partner.id) return { ok: false, error: "This customer was referred by another partner, so their jobs are already credited." };
  const chosen = input.service_slug && getService(input.service_slug) ? input.service_slug : null;
  // the Standard Referral Ticket: nothing it requires may be missing (the form shows the same list as you type)
  const std = ticketCheck({ ...input, service_slug: chosen });
  if (std.required.length) return { ok: false, error: `The ticket still needs: ${std.required.join("; ")}.` };
  if (chosen) {
    const { data: open, error } = await db().from("referral_tickets").select("partner_id").eq("customer_email", email).eq("service_slug", chosen).in("status", ["open", "needs_review"]).gt("expires_at", new Date().toISOString()).limit(1);
    if (error) return { ok: false, error: "Referral tickets aren't switched on yet — we're on it." };
    if (open?.length) return { ok: false, error: open[0].partner_id === partner.id ? "You already sent us this job." : "Someone already sent us this job for this customer." };
  }
  // the AI files it: the right service, how often, the pricing answers, a summary and what's still missing
  const { fileTicket } = await import("./ai/referral-ticket");
  const photos = (input.photos ?? []).slice(0, 8);
  const f = await fileTicket({ details: input.details ?? {}, answers: input.answers ?? {}, photoUrls: photos.length ? await (await import("./photos")).signedUrls(photos, 600) : [], description: input.description, service_slug: chosen, frequency: input.frequency ?? null, urgency: input.urgency ?? null, budget: input.budget ?? null, zip: input.zip ?? null, customer_type: input.company_name ? "commercial" : "residential" });
  // the right person: the customer's Handled account (if they have one) and, for a pro who wants it, first look
  const [{ data: profile }, proId] = await Promise.all([
    db().from("profiles").select("id").ilike("email", email.replace(/[\\%_]/g, (c) => `\\${c}`)).limit(1).maybeSingle(), // escaped: "_" in an email is a wildcard to ilike
    Promise.resolve(input.i_will_do_it && partner.contractor_id ? partner.contractor_id : null),
  ]);
  const clear = Boolean(f.service_slug) && f.confidence !== "low" && Boolean(input.zip);
  // security: a ticket must bring us NEW work. A pro's own recent customer (same service) can't be ticketed; any existing
  // customer goes to staff review and can only earn through the ticket's own link (see attributeTicket)
  const since = new Date(Date.now() - PRO_OWN_CUSTOMER_DAYS * 86400000).toISOString();
  const [existingCustomer, served] = await Promise.all([
    isExistingCustomer(email),
    partner.contractor_id
      ? db().from("jobs").select("service_slug").eq("contractor_id", partner.contractor_id).ilike("contact_email", likeEmail(email)).gte("created_at", since).neq("status", "cancelled").limit(200).then((r) => (r.data ?? []) as { service_slug: string }[])
      : Promise.resolve([] as { service_slug: string }[]),
  ]);
  const intake = ticketIntake({ existingCustomer, clear, proServedSameService: Boolean(f.service_slug) && served.some((j) => j.service_slug === f.service_slug), proServedOtherService: served.length > 0 });
  if (!intake.ok) return { ok: false, error: intake.error };
  const open = intake.status === "open";
  // the referrer's own size answers win over the AI's reading (they were there); the AI fills the rest
  const answers: Answers = f.service_slug === chosen ? { ...f.answers, ...(input.answers ?? {}) } : f.answers;
  const scored = ticketCheck({ ...input, service_slug: f.service_slug, answers });
  const now = new Date();
  let ticket: Ticket | null = null;
  for (let i = 0; i < 3 && !ticket; i++) {
    const { data, error } = await db().from("referral_tickets").insert({
      token: makeTicketToken(), partner_id: partner.id,
      customer_email: email, customer_name: input.customer_name.trim(), customer_phone: input.customer_phone || null, customer_id: profile?.id ?? null, company_name: input.company_name || null,
      address: input.address || null, city: input.city || null, state: input.state?.toUpperCase() || null, zip: input.zip || null,
      description: input.description.trim(), service_slug: f.service_slug, frequency: f.frequency, urgency: f.urgency ?? input.urgency ?? null, budget: input.budget ?? null,
      access_notes: input.access_notes || null, photos, customer_consent: true, preferred_contractor_id: proId,
      answers, ai_summary: f.summary, details: input.details ?? {}, standard_version: TICKET_STANDARD_VERSION, completeness: scored.score, missing_info: f.missing_info, ai_confidence: f.confidence,
      status: intake.status, expires_at: ticketExpiry(now).toISOString(),
      events: [{ at: now.toISOString(), text: `Ticket from ${partner.name}. ${f.service_slug ? `Filed as ${getService(f.service_slug)!.name}${f.frequency !== "once" ? ` (${f.frequency})` : ""}.` : "Service unclear."}${photos.length ? ` ${photos.length} photo(s).` : ""}${intake.reason ? ` ${intake.reason}` : ""}` }],
    }).select("*").single();
    if (data) ticket = data as Ticket;
    else if (error && !/duplicate|unique/i.test(error.message)) return { ok: false, error: /referral_tickets/.test(error.message) ? "Referral tickets aren't switched on yet — we're on it." : error.message };
  }
  if (!ticket) return { ok: false, error: "Couldn't save the ticket — try again." };
  if (open) await sendTicketToCustomer(ticket, partner);
  await raiseAlert("referral_ticket", open ? "info" : "warn", `Referral ticket from ${partner.name}: ${f.service_slug ? getService(f.service_slug)!.name : "service unclear"} for ${ticket.customer_name}${existingCustomer ? " (existing customer)" : ""}`,
    `${f.summary ?? input.description.slice(0, 500)}${f.missing_info.length ? `\n\nStill need: ${f.missing_info.join(" · ")}` : ""}\n\n${open ? "Booking link sent to the customer." : `${intake.reason} Review it in Hub → Referrals & tickets, then send the customer their link (or cancel it).`}`).catch(() => {});
  return { ok: true, ticket };
}

/** Email (and text) the customer their pre-filled booking link, from the referrer. */
export async function sendTicketToCustomer(t: Ticket, partner?: Partner) {
  const p = partner ?? ((await db().from("referral_partners").select("*").eq("id", t.partner_id).single()).data as Partner);
  const svc = t.service_slug ? getService(t.service_slug) : null;
  const what = svc ? svc.name.toLowerCase() : "job";
  await sendEmail(t.customer_email, `${p.name} sent us your ${what} — your price is ready to confirm`,
    `Hi ${t.customer_name.split(" ")[0]},\n\n${p.name}${p.company ? ` (${p.company})` : ""} asked ${BRAND.name} to take care of your ${what}. Here's what we have:\n\n${ticketNotes({ ...t, details: t.details ?? {} })}\n\nWe've filled in everything ${p.name.split(" ")[0]} told us${t.photos?.length ? `, including the ${t.photos.length} photo${t.photos.length === 1 ? "" : "s"} they took` : ""}. Open your link to check the details, see your upfront price and pick a time:\n${ticketLink(t)}\n${t.missing_info.length ? `\nA few things only you can tell us: ${t.missing_info.join(" ")}\n` : ""}\nInsured, background-checked local pros, photo proof when it's done, and a free redo if anything's missed. Questions? Just reply.\n\n— ${BRAND.name}`);
  await ticketEvent(t.id, "Booking link sent to the customer.");
}

/** The booking page: an open ticket's details for the pre-filled booking. */
export async function ticketByToken(token: string | null | undefined): Promise<Ticket | null> {
  const tok = cleanTicketToken(token);
  if (!tok) return null;
  const { data } = await db().from("referral_tickets").select("*").eq("token", tok).maybeSingle();
  const t = data as Ticket | null;
  return t && ["open", "needs_review"].includes(t.status) && new Date(t.expires_at) > new Date() ? t : null;
}

/** At booking: claim the ticket this job came from (its link, else the same email + service) for this job. */
async function attributeTicket(job: Job, token: string | null): Promise<string | null> {
  const email = lower(job.contact_email);
  const live = () => db().from("referral_tickets").select("id, partner_id, created_at, referral_partners(email, status)").in("status", ["open", "needs_review"]).gt("expires_at", new Date().toISOString());
  const tok = cleanTicketToken(token);
  let { data, error } = tok ? await live().eq("token", tok).limit(1) : { data: null, error: null };
  const viaLink = Boolean(!error && data?.length);
  if (!error && !data?.length) ({ data, error } = await live().eq("customer_email", email).eq("service_slug", job.service_slug).order("created_at", { ascending: true }).limit(1));
  if (error || !data?.length) return null; // none (or the tickets migration hasn't been run yet)
  const t = data[0] as unknown as { id: string; partner_id: string; created_at: string; referral_partners: { email: string; status: string } | null };
  // security: without the ticket's own link, only a NEW customer is credited — an existing customer's own rebooking never is
  if (!ticketCredit({ viaLink, customerHadPaidJobBefore: viaLink ? false : await isExistingCustomer(email, job.id, t.created_at) })) return null;
  if (t.referral_partners?.status !== "active" || t.referral_partners.email === email) return null;
  // a person referral made before this ticket keeps the customer: one commission per job, first claim wins
  const claim = await personClaim(email);
  if (claim && claim.partner_id !== t.partner_id && new Date(claim.created_at) < new Date(t.created_at)) return null;
  const basis = jobReferralBasis(job.frequency);
  const { data: won } = await db().from("referral_tickets").update({
    status: "booked", job_id: job.id, basis, pays_until: basis === "job_recurring" ? partnerExpiry(new Date()).toISOString() : null, updated_at: new Date().toISOString(),
  }).eq("id", t.id).in("status", ["open", "needs_review"]).select("id");
  if (!won?.length) return null; // claimed a moment ago by another booking
  // later visits of a recurring plan copy partner_id and referral_ticket_id from this job (scheduleNextVisit)
  await db().from("jobs").update({ partner_id: t.partner_id, referral_ticket_id: t.id }).eq("id", job.id);
  await setReferralPct(job.id, COMMISSION_BASIS[basis].pct);
  const svc = getService(job.service_slug);
  const pct = COMMISSION_BASIS[basis].pct;
  await ticketEvent(t.id, `Booked: ${job.ref} — ${svc?.name}${job.frequency !== "once" ? ` (${job.frequency})` : ""}, ${money(Number(job.price_final ?? 0))}.`, {
    subject: `Your referral booked: ${svc?.name} for ${job.contact_name.split(" ")[0]}`,
    body: `${job.contact_name} booked the ${svc?.name.toLowerCase()} you sent us (${job.ref}).${basis === "job_recurring" ? ` It's ${job.frequency}, so you earn ${pctLabel(pct)}% of our fee on every visit for ${P.months} months.` : ` You earn ${pctLabel(pct)}% of our fee when it's done.`} We'll tell you when a pro is assigned and when it's complete.`,
  });
  return t.partner_id;
}

/** Daily sweep: tickets the customer didn't book in time expire, and the referrer is told. */
export async function expireTickets(now = new Date()): Promise<number> {
  const { data } = await db().from("referral_tickets").update({ status: "expired", updated_at: now.toISOString() })
    .in("status", ["open", "needs_review"]).lte("expires_at", now.toISOString()).select("id, customer_name, service_slug");
  for (const t of (data ?? []) as { id: string; customer_name: string; service_slug: string | null }[])
    await ticketEvent(t.id, "Expired: not booked within the window.", {
      subject: `Your referral for ${t.customer_name.split(" ")[0]} expired`,
      body: `${t.customer_name} didn't book the ${t.service_slug ? getService(t.service_slug)?.name.toLowerCase() : "job"} you sent us within ${P.ticketDays} days, so the ticket closed. If they still need it, send a new ticket from your partner page.`,
    }).catch(() => {});
  return data?.length ?? 0;
}

/** Offer accepted: the referrer hears their job is covered (first visit only; recurring visits aren't news). */
export async function ticketAssigned(job: Job, proName: string | null) {
  if (!job.referral_ticket_id) return;
  const { data: t } = await db().from("referral_tickets").select("job_id").eq("id", job.referral_ticket_id).maybeSingle();
  if (!t || t.job_id !== job.id) return;
  await ticketEvent(job.referral_ticket_id, `Assigned to ${proName ?? "a pro"}${job.scheduled_date ? ` for ${job.scheduled_date}` : ""}.`, {
    subject: `A pro is assigned to the job you sent us (${job.ref})`,
    body: `${proName ?? "One of our vetted pros"} is confirmed for ${job.contact_name.split(" ")[0]}'s ${getService(job.service_slug)?.name.toLowerCase()}${job.scheduled_date ? ` on ${job.scheduled_date}` : ""}.`,
  });
}

/**
 * At booking: credit the job to a partner. A referral ticket (its link, or the same email + service) wins first; then an
 * existing referral for this email (still inside its 12 months); otherwise a partner link clicked in this browser counts —
 * only for a NEW customer, never the partner themselves.
 */
export async function attributeJob(job: Job, ticketToken: string | null = null): Promise<string | null> {
  const viaTicket = await attributeTicket(job, ticketToken).catch((e) => { console.error("[tickets]", e); return null; });
  if (viaTicket) return viaTicket;
  const email = lower(job.contact_email);
  const { data: ref } = await db().from("referral_customers").select("id, partner_id, first_job_id, expires_at, referral_partners(status)").eq("customer_email", email).maybeSingle();
  let partnerId: string | null = null;
  if (ref) {
    const active = (ref.referral_partners as unknown as { status: string } | null)?.status === "active";
    if (active && new Date(ref.expires_at) > new Date()) partnerId = ref.partner_id;
    if (partnerId && !ref.first_job_id) await db().from("referral_customers").update({ first_job_id: job.id }).eq("id", ref.id);
  } else {
    let code: string | null = null;
    try { code = cleanPartnerCode((await cookies()).get(PARTNER_COOKIE)?.value); } catch { /* not in a request (cron, app) */ }
    if (!code) return null;
    const { data: p } = await db().from("referral_partners").select("id, email, status").eq("code", code).maybeSingle();
    if (!p || p.status !== "active" || p.email === email) return null;
    if (await isExistingCustomer(email, job.id)) return null;
    const { error } = await db().from("referral_customers").insert({ partner_id: p.id, customer_email: email, customer_name: job.contact_name, customer_phone: job.contact_phone, service_slug: job.service_slug, source: "link", first_job_id: job.id, expires_at: partnerExpiry(new Date()).toISOString() });
    if (error) return null; // someone else claimed this customer a moment ago
    partnerId = p.id;
  }
  if (partnerId) {
    await db().from("jobs").update({ partner_id: partnerId }).eq("id", job.id);
    await setReferralPct(job.id, COMMISSION_BASIS.person.pct);
  }
  return partnerId;
}

// ─── Commissions ─────────────────────────────────────────────────────────────

/** The referral rate on a credited job, so the offer and work order can show the pro their half (own update: never blocks the credit). */
async function setReferralPct(jobId: string, pct: number) {
  await db().from("jobs").update({ referral_pct: pct }).eq("id", jobId).then(() => null, () => null);
}

/**
 * Does the pro on this job carry half the bonus? Only with a pro on the job who accepted its offer from the effective date
 * (the offer and work order showed them their half) under contractor agreement v10 or later.
 */
async function proPaysHalf(job: Job): Promise<boolean> {
  if (!job.contractor_id) return false;
  const [{ data: offer }, { data: pro }] = await Promise.all([
    db().from("job_offers").select("responded_at").eq("job_id", job.id).eq("contractor_id", job.contractor_id).eq("status", "accepted").order("responded_at", { ascending: false }).limit(1).maybeSingle(),
    db().from("contractors").select("agreement_version").eq("id", job.contractor_id).maybeSingle(),
  ]);
  return proSharesReferral({ acceptedAt: offer?.responded_at ?? null, agreementVersion: (pro as { agreement_version?: string | null } | null)?.agreement_version ?? null });
}

/**
 * Keep the pro's half in step with the bonus (a refund shrank it, staff voided it). Not yet netted into a payout → the
 * line is changed (or removed); already netted → the difference goes back to the pro as a positive line. Never raises it.
 */
export async function syncProShare(commissionId: string, bonusNow: number) {
  const { data: c } = await db().from("partner_commissions").select("id, job_id, contractor_id, pro_share, pro_share_payout_id, jobs(ref)").eq("id", commissionId).maybeSingle().then((r) => r, () => ({ data: null }));
  if (!c || !c.contractor_id || !(Number(c.pro_share) > 0)) return;
  const was = Number(c.pro_share);
  const want = Math.min(was, referralCostShares(bonusNow).pro);
  if (want === was) return;
  const ref = (c.jobs as unknown as { ref: string } | null)?.ref ?? "";
  const { data: line } = c.pro_share_payout_id ? await db().from("payouts").select("id, status, paid_at").eq("id", c.pro_share_payout_id).maybeSingle() : { data: null };
  if (line && line.status === "clawback" && !line.paid_at) {
    if (want > 0) await db().from("payouts").update({ amount: -want, reason: `Your half of the referral bonus — ${ref} (reduced by a refund)` }).eq("id", line.id);
    else await db().from("payouts").delete().eq("id", line.id);
  } else {
    await db().from("payouts").insert({ contractor_id: c.contractor_id, job_id: c.job_id, amount: Math.round((was - want) * 100) / 100, status: "approved", kind: "referral_share", reason: `Referral bonus on ${ref} ${want ? "reduced" : "cancelled"} — your half returned` });
  }
  await db().from("partner_commissions").update({ pro_share: want, handled_share: Math.round((bonusNow - want) * 100) / 100 }).eq("id", c.id);
}

/** Which rule pays on this job, or null when nothing does (outside its window, or not the ticket's job or plan). */
async function commissionBasisFor(job: Job): Promise<CommissionBasis | null> {
  if (job.referral_ticket_id) {
    const { data: t } = await db().from("referral_tickets").select("partner_id, basis, job_id, pays_until").eq("id", job.referral_ticket_id).maybeSingle();
    if (!t || t.partner_id !== job.partner_id || !t.basis) return null;
    if (t.basis === "job_once") return t.job_id === job.id ? "job_once" : null; // a one-time ticket pays on that one job
    return t.pays_until && new Date(job.created_at) <= new Date(t.pays_until) ? "job_recurring" : null; // every visit for 12 months
  }
  const { data: ref } = await db().from("referral_customers").select("expires_at").eq("customer_email", lower(job.contact_email)).eq("partner_id", job.partner_id).maybeSingle();
  return ref && new Date(job.created_at) <= new Date(ref.expires_at) ? "person" : null; // booked inside the 12 months
}

/** At completion: record the partner's commission at its rate (paid after the make-it-right window). */
export async function accrueCommission(job: Job) {
  if (!job.partner_id || job.remedy || !(Number(job.price_final) > 0)) return;
  const basis = await commissionBasisFor(job);
  if (!basis) return;
  const pct = COMMISSION_BASIS[basis].pct;
  const o = { price: Number(job.price_final), payout: Number(job.contractor_payout ?? 0), refunded: Number(job.amount_refunded ?? 0) };
  // the bonus is worked out on the pro's FULL pay (contractor_payout is never reduced); who carries it is decided below
  const amount = partnerCommission(o, pct);
  if (amount <= 0) return;
  const proPays = await proPaysHalf(job);
  const share = referralCostShares(amount, proPays);
  const done = job.completed_at ? new Date(job.completed_at) : new Date();
  const eligible = new Date(done.getTime() + PARTNER_PROGRAM.holdDays * 86400000);
  const { data: added } = await db().from("partner_commissions").upsert({
    partner_id: job.partner_id, job_id: job.id, take: partnerTake(o), amount, status: "pending", eligible_at: eligible.toISOString(),
    // person rows keep the column defaults, so they still record before the tickets migration is run
    ...(basis === "person" ? {} : { basis, pct }),
    // the shared-bonus columns only when the pro carries half (so commissions still record before that migration is run)
    ...(share.pro > 0 ? { pro_share: share.pro, handled_share: share.handled, contractor_id: job.contractor_id } : {}),
  }, { onConflict: "job_id", ignoreDuplicates: true }).select("id");
  if (!added?.length) return; // already recorded (completion ran twice)
  if (share.pro > 0 && job.contractor_id) {
    // the pro's half: its own line on their statement, netted in the weekly payout like a clawback
    const { data: line, error } = await db().from("payouts").insert({
      contractor_id: job.contractor_id, job_id: job.id, amount: -share.pro, status: "clawback", kind: "referral_share",
      reason: `Your half of the referral bonus — ${job.ref} (${pctLabel(pct)}% of our fee = ${money(amount)}; ${BRAND.name} pays the other ${money(share.handled)})`,
    }).select("id").single();
    if (line) await db().from("partner_commissions").update({ pro_share_payout_id: line.id }).eq("id", added[0].id);
    else await raiseAlert("partners", "critical", `${job.ref}: the pro's half of the referral bonus wasn't recorded`, `${error?.message ?? "insert failed"} — run ADD_SHARED_REFERRAL_BONUS_2026-10-22_0900.sql. Until then ${BRAND.name} is carrying the whole ${money(amount)}.`, job.id).catch(() => {});
  }
  if (job.referral_ticket_id) {
    const m = moneySplit(o, pct, share.pro > 0);
    await ticketEvent(job.referral_ticket_id, `Done: ${job.ref}. Customer paid ${money(m.customer)} · pro ${money(m.pro)} · you ${money(m.referrer)} · ${BRAND.name} ${money(m.handled)}.`, {
      subject: `You earned ${money(amount)} — ${job.ref} is done`,
      body: `The ${getService(job.service_slug)?.name.toLowerCase()} you sent us is complete (${job.ref}).\n\nWhere the money went: the customer paid ${money(m.customer)}, the pro is paid ${money(m.pro)}, your commission is ${money(m.referrer)} (${pctLabel(pct)}% of our fee${m.proShare ? `, shared: ${money(m.handledShare)} from ${BRAND.name} and ${money(m.proShare)} from the pro` : ""}), and ${BRAND.name} keeps ${money(m.handled)}.\n\nYour ${money(amount)} is paid in the Monday payout after ${eligible.toISOString().slice(0, 10)} (our ${PARTNER_PROGRAM.holdDays}-day make-it-right window).`,
    }).catch(() => {});
  }
}

const mondayOf = (d: Date) => { const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())); x.setUTCDate(x.getUTCDate() - ((x.getUTCDay() + 6) % 7)); return x.toISOString().slice(0, 10); };

/** Mondays: pay every eligible commission (re-checked against refunds) to partners whose Stripe payouts are ready. */
export async function runPartnerPayouts(now = new Date()) {
  const s = getStripe();
  const week = mondayOf(now);
  const cols = "id, partner_id, job_id, amount, jobs(price_final, contractor_payout, amount_refunded, remedy, status)";
  const pending = (c: string) => db().from("partner_commissions").select(c).eq("status", "pending").lte("eligible_at", now.toISOString()).limit(5000);
  let { data: due, error: dueErr } = await pending(`${cols}, pct`);
  if (dueErr) ({ data: due } = await pending(cols)); // tickets migration not run yet: every row is a 10% person row
  type Row = { id: string; partner_id: string; job_id: string; amount: number; pct?: number | null; jobs: { price_final: number; contractor_payout: number; amount_refunded: number; remedy: string | null; status: string } | null };
  const byPartner = new Map<string, Row[]>();
  let voided = 0;
  for (const r of (due ?? []) as unknown as Row[]) {
    // refunds after completion come out of our take first → the commission follows it down (never up)
    const j = r.jobs;
    const now$ = j && j.status === "completed" && !j.remedy ? Math.min(Number(r.amount), partnerCommission({ price: Number(j.price_final), payout: Number(j.contractor_payout), refunded: Number(j.amount_refunded) }, r.pct != null ? Number(r.pct) : PARTNER_PROGRAM.pctOfTake)) : 0;
    if (now$ <= 0) { await syncProShare(r.id, 0).catch(() => {}); await db().from("partner_commissions").update({ status: "void", amount: 0, note: "job refunded or cancelled" }).eq("id", r.id); voided++; continue; }
    if (now$ !== Number(r.amount)) { await syncProShare(r.id, now$).catch(() => {}); await db().from("partner_commissions").update({ amount: now$, note: "reduced by a refund" }).eq("id", r.id); r.amount = now$; }
    byPartner.set(r.partner_id, [...(byPartner.get(r.partner_id) ?? []), r]);
  }
  let paid = 0, total = 0, waiting = 0;
  const failed: string[] = [];
  let funds = await availableBalance(); // card money takes ~2 days to become available in Stripe
  for (const [pid, rows] of byPartner) {
    const amount = Math.round(rows.reduce((t, r) => t + Number(r.amount), 0) * 100) / 100;
    if (amount < PARTNER_PROGRAM.minPayout) continue; // rolls to next week
    const { data: p } = await db().from("referral_partners").select("*").eq("id", pid).single();
    const partner = p as Partner;
    if (partner.status !== "active") continue;
    // paid only through a Handled account: link it if we can, otherwise remind them to activate it
    if (!partner.profile_id) await linkAccount(partner);
    if (!partner.profile_id) {
      waiting++;
      const { signInLink } = await import("./signin");
      await sendEmail(partner.email, `${money(amount)} is waiting — activate your ${BRAND.name} account`, `Hi ${partner.name.split(" ")[0]},\n\nYou have ${money(amount)} in ${BRAND.name} referral commissions. Referral earnings are paid to your ${BRAND.name} account — activate it with one tap, then set up payouts: ${await signInLink(partner.email, "/partner")}\n\n— ${BRAND.name}`).catch(() => {});
      continue;
    }
    const ready = s && partner.stripe_account_id ? Boolean((await s.accounts.retrieve(partner.stripe_account_id).catch(() => null))?.payouts_enabled) : false;
    if (!s || !ready) {
      waiting++;
      await sendEmail(partner.email, `${money(amount)} in referral commissions is ready for you`, `Hi ${partner.name.split(" ")[0]},\n\nYou have ${money(amount)} in ${BRAND.name} referral commissions ready to send. Set up payouts (2 minutes, through Stripe) on your partner page: ${siteUrl()}/partner\n\n— ${BRAND.name}`).catch(() => {});
      continue;
    }
    if (funds !== null && funds < amount) { failed.push(`${partner.name}: not enough available in Stripe yet — waits for next week`); continue; }
    const ids = rows.map((r) => r.id);
    const stamp = new Date().toISOString();
    const { data: claimed } = await db().from("partner_commissions").update({ status: "paid", paid_at: stamp, week_of: week }).in("id", ids).eq("status", "pending").select("id");
    if ((claimed ?? []).length !== ids.length) {
      if (claimed?.length) await db().from("partner_commissions").update({ status: "pending", paid_at: null, week_of: null }).in("id", claimed.map((x: { id: string }) => x.id));
      failed.push(`${partner.name} (changed while paying)`);
      continue;
    }
    let t: { id: string };
    try {
      t = await s.transfers.create({ amount: Math.round(amount * 100), currency: "usd", destination: partner.stripe_account_id!, description: `${BRAND.name} referral commissions — week of ${week}`, metadata: { partner_id: pid, kind: "partner_commission", week_of: week } }, { idempotencyKey: `partner-${pid}-${week}-${stamp}` });
    } catch (e) {
      await db().from("partner_commissions").update({ status: "pending", paid_at: null, week_of: null }).in("id", ids);
      failed.push(`${partner.name}: ${e instanceof Error ? e.message : "transfer failed"}`);
      continue;
    }
    // money has moved: problems after this are reported, never undone (undoing would pay twice next week)
    paid++; total = Math.round((total + amount) * 100) / 100;
    if (funds !== null) funds = Math.round((funds - amount) * 100) / 100;
    try {
      await db().from("partner_commissions").update({ stripe_transfer_id: t.id }).in("id", ids);
      await sendEmail(partner.email, `Paid: ${money(amount)} in ${BRAND.name} referral commissions`, `Hi ${partner.name.split(" ")[0]},\n\nWe sent ${money(amount)} for ${rows.length} completed job${rows.length === 1 ? "" : "s"} you referred. It reaches your bank on Stripe's normal schedule (usually 2 business days).\n\nEvery job and payment: ${siteUrl()}/partner\n\nThank you for sending people our way.\n\n— ${BRAND.name}`).catch(() => {});
    } catch (e) {
      await raiseAlert("partners", "warn", `Partner payout sent but not fully recorded — ${partner.name}`, `Transfer ${t.id}: ${e instanceof Error ? e.message : String(e)}`).catch(() => {});
    }
  }
  if (failed.length) await raiseAlert("partners", "critical", `Partner payouts: ${failed.length} failed`, failed.join("\n"));
  if (paid || waiting) await raiseAlert("partners", "info", `Partner payouts sent: ${paid} partner(s), ${money(total)}`, waiting ? `${waiting} partner(s) still need to set up Stripe payouts — reminded.` : null);
  return { paid, total, waiting, voided, failed: failed.length };
}

/** Stripe Connect (Express) onboarding so a partner can be paid. Tax details for 1099s are collected by Stripe. */
export async function partnerConnectUrl(partner: Partner): Promise<string | null> {
  const s = getStripe();
  if (!s) return null;
  let acct = partner.stripe_account_id;
  if (!acct) {
    acct = (await s.accounts.create({
      type: "express", email: partner.email, business_profile: { name: partner.company || partner.name },
      capabilities: { transfers: { requested: true } }, metadata: { partner_id: partner.id },
    })).id;
    await db().from("referral_partners").update({ stripe_account_id: acct }).eq("id", partner.id);
  }
  const link = await s.accountLinks.create({ account: acct, type: "account_onboarding", refresh_url: `${siteUrl()}/partner?connect=retry`, return_url: `${siteUrl()}/partner?connect=done` });
  return link.url;
}

export async function payoutsReady(partner: Partner) {
  const s = getStripe();
  if (!s || !partner.stripe_account_id) return false;
  return Boolean((await s.accounts.retrieve(partner.stripe_account_id).catch(() => null))?.payouts_enabled);
}

/** Totals for the partner page and the Hub. */
export async function partnerStats(partnerId: string) {
  const [{ count: customers }, { count: tickets }, { data: comms }] = await Promise.all([
    db().from("referral_customers").select("id", { count: "exact", head: true }).eq("partner_id", partnerId),
    db().from("referral_tickets").select("id", { count: "exact", head: true }).eq("partner_id", partnerId).then((r) => r, () => ({ count: 0 })),
    db().from("partner_commissions").select("amount, status, eligible_at").eq("partner_id", partnerId),
  ]);
  const now = Date.now();
  const sum = (f: (r: { amount: number; status: string; eligible_at: string }) => boolean) => Math.round(((comms ?? []) as { amount: number; status: string; eligible_at: string }[]).filter(f).reduce((t, r) => t + Number(r.amount), 0) * 100) / 100;
  return {
    customers: customers ?? 0,
    tickets: tickets ?? 0,
    paid: sum((r) => r.status === "paid"),
    ready: sum((r) => r.status === "pending" && new Date(r.eligible_at).getTime() <= now),
    upcoming: sum((r) => r.status === "pending" && new Date(r.eligible_at).getTime() > now),
    jobs: (comms ?? []).filter((r: { status: string }) => r.status !== "void").length,
  };
}
