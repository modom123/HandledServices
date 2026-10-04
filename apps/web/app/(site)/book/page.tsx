/*
 * FILE    : apps/web/app/(site)/book/page.tsx
 * PROJECT : Handled — AI-run home & business services
 * CREATED : 2026-10-01_1723 UTC
 * UPDATED : 2026-10-02_0302 UTC — ?when= and ?budget= prefill (from the AI concierge).
 * UPDATED : 2026-10-03_0027 UTC — ?frequency= and yes/no answers (true/false) for links in saved-price and
 *           seasonal emails; utm_* params are tracking only, never answers.
 * UPDATED : TSTAMP UTC — ?property=<id>: book for a business account's property.
 */
import { BookingWizard } from "@/components/BookingWizard";
import { t } from "@handled/core";
import { getLocale } from "@/lib/locale";
import { getViewer } from "@/lib/auth";
import { memberOf, openBalance, type Property } from "@/lib/business";
import { adminClient } from "@/lib/supabase/server";
import { termsDecision } from "@handled/core";

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
  const { service, when, budget, promo, frequency, property, ...rest } = await searchParams;
  const business = property ? await businessBooking(property) : undefined;
  const locale = await getLocale();
  // ?budget=5000&guests=50&event_type=birthday → pre-filled answers (only keys the service asks about)
  const prefill = Object.fromEntries(Object.entries(rest).filter(([k, v]) => v !== undefined && !k.startsWith("utm_")).map(([k, v]) => [k, /^\d+(\.\d+)?$/.test(v!) ? Number(v) : v === "true" ? true : v === "false" ? false : v!]));
  return (
    <div className="wrap py-12">
      <h1 className="mb-8 text-3xl font-extrabold tracking-tight">{t(locale, "Get your price & book")}</h1>
      <BookingWizard business={business} initialService={service} prefill={prefill} initialUrgency={when} initialBudget={budget} initialPromo={promo} initialFrequency={frequency} locale={locale} />
    </div>
  );
}
