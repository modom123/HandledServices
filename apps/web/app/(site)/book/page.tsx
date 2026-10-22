/*
 * FILE    : apps/web/app/(site)/book/page.tsx
 * PROJECT : Handled — AI-run home & business services
 * CREATED : 2026-10-01_1723 UTC
 * UPDATED : 2026-10-02_0302 UTC — ?when= and ?budget= prefill (from the AI concierge).
 * UPDATED : 2026-10-03_0027 UTC — ?frequency= and yes/no answers (true/false) for links in saved-price and
 *           seasonal emails; utm_* params are tracking only, never answers.
 * UPDATED : 2026-10-04_1934 UTC — ?property=<id>: book for a business account's property.
 * UPDATED : 2026-10-04_2204 UTC — ?pro=<id>&crew=<id>: "Book again with …" (only a favorite or past pro of the signed-in customer).
 * UPDATED : 2026-10-05_0447 UTC — ?photos=&notes= from Snap & post a job (photos limited to our upload folder).
 * UPDATED : 2026-10-12_0005 UTC — signed-in customers pick one of My homes (?home=<id> preselects it).
 * UPDATED : 2026-10-20_0200 UTC — ?quote=&bid=: book a request-a-quote at the pro's locked price.
 * UPDATED : 2026-10-22_0400 UTC — ?ticket=<token>: a referral ticket's link — everything the referrer entered and the AI filed
 *           (customer, address, service, pricing answers, how often, when, notes) is filled in; the booking credits the referrer.
 */
import { BookingWizard } from "@/components/BookingWizard";
import { t } from "@handled/core";
import { getLocale } from "@/lib/locale";
import { getViewer } from "@/lib/auth";
import { memberOf, openBalance, type Property } from "@/lib/business";
import { adminClient } from "@/lib/supabase/server";
import { termsDecision } from "@handled/core";
import { bookingPreference } from "@/lib/favorites";
import type { BookedQuote, HomeChoice, PreferredPro, TicketPrefill } from "@/components/BookingWizard";
import { ticketByToken } from "@/lib/partners";
import { requestByToken } from "@/lib/quotes";

/** ?pro=&crew=: the signed-in customer's favorite or past pro (anything else is ignored). */
async function preferredPro(pro: string, crew?: string): Promise<PreferredPro | undefined> {
  const v = await getViewer();
  const uuid = /^[0-9a-f-]{36}$/;
  if (!v || !uuid.test(pro)) return undefined;
  const pref = await bookingPreference(v.userId, v.email, pro, crew && uuid.test(crew) ? crew : null);
  if (!pref.preferred_contractor_id) return undefined;
  const db = adminClient();
  const [{ data: c }, { data: m }] = await Promise.all([
    db.from("contractors").select("business_name, contact_name, status").eq("id", pro).maybeSingle(),
    pref.requested_crew_member_id ? db.from("crew_members").select("full_name").eq("id", pref.requested_crew_member_id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  if (!c || c.status !== "approved") return undefined;
  const first = String(c.contact_name ?? "").split(" ")[0];
  return { proId: pro, crewId: pref.requested_crew_member_id, label: first ? `${first} (${c.business_name})` : c.business_name, crewName: m ? String(m.full_name).split(" ")[0] : null };
}

/** ?property=<id>: a business account member booking for one of the account's properties. */
async function businessBooking(propertyId: string) {
  const v = await getViewer();
  if (!v || !/^[0-9a-f-]{36}$/.test(propertyId)) return undefined;
  const { data } = await adminClient().from("business_properties").select("*").eq("id", propertyId).maybeSingle();
  const p = data as Property | null;
  if (!p || !p.active) return undefined;
  const mine = await memberOf(v, p.account_id);
  if (!mine) return undefined;
  const { data: prof } = await adminClient().from("profiles").select("full_name, phone").eq("id", v.userId).maybeSingle();
  const a = mine.account;
  const billing = a.billing_mode === "terms" ? (termsDecision(a, await openBalance(a.id), 0).onTerms ? `Invoiced (Net ${a.terms_days})` : "Pay at booking (invoicing on hold or at the credit limit)") : "Pay at booking";
  return { propertyId: p.id, propertyName: p.name, company: a.company, address: p.address, city: p.city, state: p.state, zip: p.zip, billing: `${billing}${a.pilot_jobs_left > 0 && a.pilot_discount_pct > 0 ? ` · pilot ${a.pilot_discount_pct}% off (${a.pilot_jobs_left} left)` : ""}`,
    contact: { name: prof?.full_name ?? a.contact_name, email: v.email, phone: prof?.phone ?? a.phone ?? "" } };
}

/** The signed-in customer's saved homes, without the entry details (those stay on the server). */
async function savedHomes(): Promise<{ signedIn: boolean; homes: HomeChoice[] }> {
  const v = await getViewer();
  if (!v) return { signedIn: false, homes: [] };
  const { data } = await adminClient().from("customer_homes").select("id, label, address, city, state, zip, entry_instructions, key_info, key_holder").eq("customer_id", v.userId).order("created_at");
  return { signedIn: true, homes: ((data ?? []) as { id: string; label: string; address: string; city: string; state: string; zip: string; entry_instructions: string | null; key_info: string | null; key_holder: string | null }[])
    .map((h) => ({ id: h.id, label: h.label, address: h.address, city: h.city, state: h.state, zip: h.zip, hasAccess: Boolean(h.entry_instructions || h.key_info || h.key_holder) })) };
}

/** ?quote=<request token>&bid=<id>: booking a request-a-quote at the pro's locked price (checked again at booking). */
async function bookedQuote(token?: string, bid?: string): Promise<{ quote: BookedQuote; service: string } | undefined> {
  if (!token || !bid) return undefined;
  const r = await requestByToken(token).catch(() => null);
  const q = r?.quotes.find((x) => x.id === bid && x.status === "quoted");
  if (!r || !q?.price || !["open", "quoted"].includes(r.request.status)) return undefined;
  return { quote: { request: token, bid, price: Number(q.price), pro: q.contractors?.business_name ?? "Your pro" }, service: r.request.service_slug };
}

/** ?ticket=<token>: an open referral ticket, as booking prefill (the token itself is the customer's private link). */
async function ticketBooking(token?: string) {
  const t = token ? await ticketByToken(token).catch(() => null) : null;
  if (!t) return undefined;
  const { data: p } = await adminClient().from("referral_partners").select("name, company").eq("id", t.partner_id).maybeSingle();
  const prefill: TicketPrefill = {
    token: t.token, from: p?.company || p?.name || "Someone you know",
    contact: { name: t.customer_name, email: t.customer_email, phone: t.customer_phone ?? "", address: t.address ?? "", city: t.city ?? "", state: t.state ?? "", zip: t.zip ?? "", company: t.company_name ?? "" },
  };
  const notes = [t.ai_summary ?? t.description, t.missing_info.length ? `Still to confirm: ${t.missing_info.join(" ")}` : null].filter(Boolean).join("\n\n");
  return { prefill, service: t.service_slug ?? undefined, answers: t.answers as Record<string, string | number | boolean>, frequency: t.frequency, urgency: t.urgency ?? undefined, budget: t.budget ? String(t.budget) : undefined, notes };
}

export const metadata = { title: "Book a service" };

export default async function BookPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { service: svcParam, when, budget, promo, frequency, property, pro, crew, photos, notes, home, src: _src, partner: _partner, quote: quoteToken, bid, ticket: ticketToken, ...rest } = await searchParams;
  const quoted = await bookedQuote(quoteToken, bid);
  const fromTicket = !quoted ? await ticketBooking(ticketToken) : undefined;
  const service = quoted?.service ?? fromTicket?.service ?? svcParam;
  // from "Snap & post a job": the uploaded photos and the note come along
  const initialPhotos = (photos ?? "").split(",").filter((p) => /^booking\/[\w\-./]+$/.test(p) && !p.includes("..")).slice(0, 8);
  const business = property ? await businessBooking(property) : undefined;
  const preferred = pro ? await preferredPro(pro, crew) : undefined;
  const locale = await getLocale();
  const saved = property ? { signedIn: true, homes: [] } : await savedHomes();
  // ?budget=5000&guests=50&event_type=birthday → pre-filled answers (only keys the service asks about)
  const prefill = fromTicket ? fromTicket.answers : Object.fromEntries(Object.entries(rest).filter(([k, v]) => v !== undefined && !k.startsWith("utm_")).map(([k, v]) => [k, /^\d+(\.\d+)?$/.test(v!) ? Number(v) : v === "true" ? true : v === "false" ? false : v!]));
  return (
    <div className="wrap py-12">
      <h1 className="mb-8 text-3xl font-extrabold tracking-tight">{t(locale, "Get your price & book")}</h1>
      <BookingWizard quote={quoted?.quote ?? null} ticket={fromTicket?.prefill ?? null} business={business} initialService={service} prefill={prefill} initialUrgency={fromTicket?.urgency ?? when} initialBudget={fromTicket?.budget ?? budget} initialPromo={promo} initialFrequency={fromTicket?.frequency ?? frequency} locale={locale} preferred={preferred} initialPhotos={initialPhotos} initialNotes={(fromTicket?.notes ?? notes)?.slice(0, 1500)} homes={saved.homes} initialHome={home} signedIn={saved.signedIn} />
    </div>
  );
}
