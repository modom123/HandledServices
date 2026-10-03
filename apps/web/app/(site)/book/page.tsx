/*
 * FILE    : apps/web/app/(site)/book/page.tsx
 * PROJECT : Handled — AI-run home & business services
 * CREATED : 2026-10-01_1723 UTC
 * UPDATED : 2026-10-02_0302 UTC — ?when= and ?budget= prefill (from the AI concierge).
 * UPDATED : 2026-10-03_0040 UTC — ?frequency= and yes/no answers (true/false) for links in saved-price and
 *           seasonal emails; utm_* params are tracking only, never answers.
 */
import { BookingWizard } from "@/components/BookingWizard";
import { t } from "@handled/core";
import { getLocale } from "@/lib/locale";

export const metadata = { title: "Book a service" };

export default async function BookPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { service, when, budget, promo, frequency, ...rest } = await searchParams;
  const locale = await getLocale();
  // ?budget=5000&guests=50&event_type=birthday → pre-filled answers (only keys the service asks about)
  const prefill = Object.fromEntries(Object.entries(rest).filter(([k, v]) => v !== undefined && !k.startsWith("utm_")).map(([k, v]) => [k, /^\d+(\.\d+)?$/.test(v!) ? Number(v) : v === "true" ? true : v === "false" ? false : v!]));
  return (
    <div className="wrap py-12">
      <h1 className="mb-8 text-3xl font-extrabold tracking-tight">{t(locale, "Get your price & book")}</h1>
      <BookingWizard initialService={service} prefill={prefill} initialUrgency={when} initialBudget={budget} initialPromo={promo} initialFrequency={frequency} locale={locale} />
    </div>
  );
}
