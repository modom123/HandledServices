/*
 * FILE    : apps/web/lib/sales-tickets.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-11-06_1638 UTC
 * PURPOSE : Field Sales tickets (Partner Program). A partner sells any Handled service: for on-site work they take 3–4
 *           photos; remote services (websites, AI, formation, consulting) need none. The ticket holds EVERYTHING needed
 *           to close the sale — service + its measurements, how often, when, the full address, budget, access notes,
 *           the person who decides and pays, and the upfront price the rep showed (ticketCloseCheck in core).
 *             createTicket()     — close-ready check, claims the customer for the rep for 12 months, prices it, texts and
 *                                  emails the customer their pay link, and hands the rep the same link to close on the spot
 *             ticketForBooking() — /book?ticket=TOKEN: the booking opens with every answer filled in, ready to pay
 *             linkTicketJob()    — at booking: marks the ticket booked and makes sure the job is credited to the rep
 *             expireTickets()    — daily: unbooked tickets past 30 days lapse (the customer stays the rep's for 12 months)
 *           The CUSTOMER accepts the Service Agreement and pays Handled directly (on their phone, or the rep's link/QR right
 *           there). Once paid, the job goes to the job board (dispatch) like any booking; when it's completed the rep's
 *           commission accrues at their ladder rate (lib/partners.ts → accrueCommission). Reps never take money.
 */
import "server-only";
import { randomBytes } from "node:crypto";
import { BRAND, SALES_TICKET, estimate, getService, isPhotoPath, money, partnerExpiry, ticketCloseCheck, type Answers, type Job } from "@handled/core";
import { adminClient } from "./supabase/server";
import { opsEmail, sendEmail, siteUrl } from "./notify";
import { sendSms } from "./sms";
import type { Partner } from "./partners";

const db = () => adminClient();
const lower = (e: string) => e.trim().toLowerCase();

export type Frequency = "once" | "weekly" | "biweekly" | "monthly" | "quarterly";
export type TicketInput = {
  photos: string[]; service_slug: string | null; notes: string | null;
  answers: Answers; frequency: Frequency;
  urgency: "asap" | "this_week" | "two_weeks" | "month" | "flexible" | null;
  preferred_date: string | null; time_window: "morning" | "midday" | "afternoon" | "flexible";
  customer_type: "residential" | "commercial"; company_name: string | null; budget: number | null;
  access_notes: string | null; close_notes: string | null; decision_maker: boolean;
  customer_name: string; customer_email: string; customer_phone: string | null;
  address: string | null; city: string | null; state: string | null; zip: string | null;
  consent: boolean;
};

export type SalesTicket = {
  id: string; token: string; partner_id: string; service_slug: string | null; photos: string[]; notes: string | null;
  answers: Answers; frequency: Frequency; urgency: string | null; preferred_date: string | null; time_window: string;
  customer_type: string; company_name: string | null; budget: number | null; access_notes: string | null; close_notes: string | null;
  decision_maker: boolean; quoted_price: number | null;
  customer_name: string; customer_email: string; customer_phone: string | null;
  address: string | null; city: string | null; state: string | null; zip: string | null;
  status: "sent" | "booked" | "expired" | "cancelled"; job_id: string | null; expires_at: string; created_at: string;
};

export const ticketLink = (token: string) => `${siteUrl()}/book?ticket=${token}`;

async function isExistingCustomer(email: string) {
  const { count } = await db().from("jobs").select("id", { count: "exact", head: true }).ilike("contact_email", email).not("paid_at", "is", null);
  return (count ?? 0) > 0;
}

/** The upfront price for the ticket (same engine and area factors as booking; the booking re-checks it with the photos). */
async function quotePrice(i: TicketInput): Promise<number | null> {
  const svc = i.service_slug ? getService(i.service_slug) : null;
  if (!svc || svc.siteVisit) return null;
  try {
    const zip = i.zip ?? "";
    const market = /^\d{5}$/.test(zip) ? await (await import("./market")).getMarketFactor(svc.slug, zip) : 1;
    const region = /^\d{5}$/.test(zip) ? await (await import("./launch")).regionFactor(zip, svc.slug) : 1;
    const e = estimate({ slug: svc.slug, answers: i.answers, frequency: i.frequency, customerType: i.customer_type, market, region });
    return e.siteVisit ? null : e.point;
  } catch { return null; }
}

/** A rep submits a ticket. The customer becomes theirs and gets a link to pay; the rep gets the same link to close now. */
export async function createTicket(partner: Partner, i: TicketInput): Promise<{ ok: true; ticket: SalesTicket; link: string; price: number | null } | { ok: false; error: string }> {
  if (partner.status !== "active") return { ok: false, error: "Your partner account is paused — contact us." };
  if (!i.consent) return { ok: false, error: "Confirm the customer asked us to contact them." };
  const photos = i.photos.filter(isPhotoPath);
  const svc = i.service_slug ? getService(i.service_slug) : null;
  const missing = ticketCloseCheck({ ...i, photos: photos.length });
  if (missing.length) return { ok: false, error: `To close this sale the ticket still needs: ${missing.join("; ")}.` };
  const email = lower(i.customer_email);
  if (email === partner.email) return { ok: false, error: "You can't write a ticket for yourself." };

  // the customer: new to Handled, and not already another partner's
  const { data: taken } = await db().from("referral_customers").select("partner_id").eq("customer_email", email).maybeSingle();
  if (taken && taken.partner_id !== partner.id) return { ok: false, error: "This customer was already brought in by another partner." };
  if (!taken) {
    if (await isExistingCustomer(email)) return { ok: false, error: `This customer already uses ${BRAND.name}, so they can't be credited to a new partner.` };
    const { error } = await db().from("referral_customers").insert({
      partner_id: partner.id, customer_email: email, customer_name: i.customer_name, customer_phone: i.customer_phone, service_slug: svc?.slug ?? null,
      note: i.notes, source: "ticket", expires_at: partnerExpiry(new Date()).toISOString(),
    });
    if (error) return { ok: false, error: /duplicate|unique/i.test(error.message) ? "This customer was just claimed by another partner." : error.message };
  }

  const price = await quotePrice(i);
  const token = randomBytes(18).toString("base64url");
  const { data, error } = await db().from("sales_tickets").insert({
    token, partner_id: partner.id, service_slug: svc?.slug ?? null, photos, notes: i.notes,
    answers: i.answers, frequency: i.frequency, urgency: i.urgency, preferred_date: i.preferred_date, time_window: i.time_window,
    customer_type: i.customer_type, company_name: i.company_name, budget: i.budget, access_notes: i.access_notes, close_notes: i.close_notes,
    decision_maker: i.decision_maker, quoted_price: price,
    customer_name: i.customer_name.trim(), customer_email: email, customer_phone: i.customer_phone,
    address: i.address, city: i.city, state: i.state ? i.state.toUpperCase() : null, zip: i.zip,
    consent_at: new Date().toISOString(), expires_at: new Date(Date.now() + SALES_TICKET.expiresDays * 86400000).toISOString(),
  }).select("*").single();
  if (error || !data) return { ok: false, error: error?.message ?? "Couldn't save the ticket — try again." };
  const ticket = data as SalesTicket;

  const first = i.customer_name.split(" ")[0];
  const what = svc ? svc.name.toLowerCase() : "your service";
  const link = ticketLink(token);
  const priceLine = price ? ` Your upfront price: ${money(price)}${i.frequency !== "once" ? " per visit" : ""}.` : "";
  await sendEmail(email, `Your ${BRAND.name} ${what} is ready to book`,
    `Hi ${first},\n\n${partner.name} from ${BRAND.name} put together your ${what}${i.address ? ` at ${i.address}` : ""}.${priceLine} ` +
    `Everything you discussed is filled in — open your link, check it, and pay to lock in your pro.\n\n` +
    `Review and pay: ${link}\n\nYou pay ${BRAND.name} directly through our secure checkout — never your sales rep. Questions? Just reply.\n\n— ${BRAND.name}`).catch((e) => console.error("[ticket email]", e));
  if (i.customer_phone) await sendSms(i.customer_phone, `${BRAND.name}: your ${what} from ${partner.name.split(" ")[0]} is ready.${priceLine} Review & pay: ${link} Reply STOP to opt out.`).catch(() => {});
  if (opsEmail()) await sendEmail(opsEmail(), `Field Sales ticket: ${svc?.name ?? "service"} — ${i.customer_name} (${partner.name})${price ? ` · ${money(price)}` : ""}`,
    `${partner.name} (${partner.code}) wrote a ticket.\nCustomer: ${i.customer_name} · ${email} · ${i.customer_phone ?? "no phone"}\n${[i.address, i.city, i.state, i.zip].filter(Boolean).join(", ")}\n${i.notes ?? ""}${i.close_notes ? `\nTo close: ${i.close_notes}` : ""}\n\nHub → Partners: ${siteUrl()}/hub/partners`).catch(() => {});
  return { ok: true, ticket, link, price };
}

/** /book?ticket=TOKEN: what to pre-fill. Only open tickets; anything else books normally. */
export async function ticketForBooking(token: string | undefined | null) {
  if (!token || !/^[\w-]{16,40}$/.test(token)) return null;
  const { data } = await db().from("sales_tickets").select("*, referral_partners(code, name, status)").eq("token", token).maybeSingle();
  const t = data as (SalesTicket & { referral_partners: { code: string; name: string; status: string } | null }) | null;
  if (!t || t.status !== "sent" || new Date(t.expires_at) < new Date()) return null;
  return {
    token: t.token, service: t.service_slug ?? undefined, photos: (t.photos ?? []).filter(isPhotoPath),
    notes: t.notes ?? "", rep: t.referral_partners?.name ?? null, repCode: t.referral_partners?.code ?? null,
    answers: (t.answers ?? {}) as Answers, frequency: t.frequency ?? "once", urgency: t.urgency ?? undefined,
    budget: t.budget ? String(t.budget) : undefined, quoted: t.quoted_price ? Number(t.quoted_price) : null,
    date: t.preferred_date ?? null, window: t.time_window ?? "flexible", access: t.access_notes ?? "",
    contact: { name: t.customer_name, email: t.customer_email, phone: t.customer_phone ?? "", address: t.address ?? "", city: t.city ?? "", state: t.state ?? "MI", zip: t.zip ?? "", customer_type: t.customer_type ?? "residential", company_name: t.company_name ?? "" },
  };
}

/**
 * At booking (lib/jobs.ts createJob, before attributeJob): mark the ticket booked and make sure the job is credited to
 * the rep — even if the customer typed a different email on the booking form (when that email is free and new to us).
 */
export async function linkTicketJob(token: string, job: Job): Promise<void> {
  const { data } = await db().from("sales_tickets").select("id, partner_id, status, expires_at").eq("token", token).maybeSingle();
  if (!data || data.status !== "sent" || new Date(data.expires_at) < new Date()) return;
  const { data: claimed } = await db().from("sales_tickets").update({ status: "booked", job_id: job.id }).eq("id", data.id).eq("status", "sent").select("id");
  if (!claimed?.length) return;
  const email = lower(job.contact_email);
  const { data: owner } = await db().from("referral_customers").select("partner_id").eq("customer_email", email).maybeSingle();
  if (!owner) {
    const { count } = await db().from("jobs").select("id", { count: "exact", head: true }).ilike("contact_email", email).not("paid_at", "is", null).neq("id", job.id);
    if ((count ?? 0) === 0) await db().from("referral_customers").insert({
      partner_id: data.partner_id, customer_email: email, customer_name: job.contact_name, customer_phone: job.contact_phone, service_slug: job.service_slug,
      source: "ticket", first_job_id: job.id, expires_at: partnerExpiry(new Date()).toISOString(),
    }).then(() => undefined, () => undefined);
  }
}

/** Daily: tickets nobody booked within 30 days lapse. */
export async function expireTickets(): Promise<number> {
  const { data } = await db().from("sales_tickets").update({ status: "expired" }).eq("status", "sent").lt("expires_at", new Date().toISOString()).select("id");
  return data?.length ?? 0;
}

/** The rep's tickets for the partner page (with each open ticket's pay link, so they can resend it or close in person). */
export async function ticketsFor(partnerId: string) {
  const { data } = await db().from("sales_tickets").select("id, token, service_slug, customer_name, city, status, quoted_price, created_at, expires_at, jobs(ref, status, price_final)").eq("partner_id", partnerId).order("created_at", { ascending: false }).limit(200);
  return ((data ?? []) as unknown as { id: string; token: string; service_slug: string | null; customer_name: string; city: string | null; status: SalesTicket["status"]; quoted_price: number | null; created_at: string; expires_at: string; jobs: { ref: string; status: string; price_final: number | null } | null }[])
    .map(({ token, ...t }) => ({ ...t, link: t.status === "sent" ? ticketLink(token) : null }));
}
