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
 */
import { BookingWizard } from "@/components/BookingWizard";
import { t } from "@handled/core";
import { getLocale } from "@/lib/locale";
import { getViewer } from "@/lib/auth";
import { memberOf, openBalance, type Property } from "@/lib/business";
import { adminClient } from "@/lib/supabase/server";
import { termsDecision } from "@handled/core";
import { bookingPreference } from "@/lib/favorites";
import type { PreferredPro } from "@/components/BookingWizard";

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

export const metadata = { title: "Book a service" };

export default async function BookPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { service, when, budget, promo, frequency, property, pro, crew, photos, notes, src: _src, ...rest } = await searchParams;
  // from "Snap & post a job": the uploaded photos and the note come along
  const initialPhotos = (photos ?? "").split(",").filter((p) => /^booking\/[\w\-./]+$/.test(p) && !p.includes("..")).slice(0, 8);
  const business = property ? await businessBooking(property) : undefined;
  const preferred = pro ? await preferredPro(pro, crew) : undefined;
  const locale = await getLocale();
  // ?budget=5000&guests=50&event_type=birthday → pre-filled answers (only keys the service asks about)
  const prefill = Object.fromEntries(Object.entries(rest).filter(([k, v]) => v !== undefined && !k.startsWith("utm_")).map(([k, v]) => [k, /^\d+(\.\d+)?$/.test(v!) ? Number(v) : v === "true" ? true : v === "false" ? false : v!]));
  return (
    <div className="wrap py-12">
      <h1 className="mb-8 text-3xl font-extrabold tracking-tight">{t(locale, "Get your price & book")}</h1>
      <BookingWizard business={business} initialService={service} prefill={prefill} initialUrgency={when} initialBudget={budget} initialPromo={promo} initialFrequency={frequency} locale={locale} preferred={preferred} initialPhotos={initialPhotos} initialNotes={notes?.slice(0, 1500)} />
    </div>
  );
}
