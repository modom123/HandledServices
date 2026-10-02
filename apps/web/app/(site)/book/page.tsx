/*
 * FILE    : apps/web/app/(site)/book/page.tsx
 * PROJECT : Handled — AI-run home & business services
 * CREATED : 2026-10-01_1723 UTC
 * UPDATED : 2026-10-02_0302 UTC — ?when= and ?budget= prefill (from the AI concierge).
 */
import { BookingWizard } from "@/components/BookingWizard";
import { t } from "@handled/core";
import { getLocale } from "@/lib/locale";

export const metadata = { title: "Book a service" };

export default async function BookPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { service, when, budget, promo, ...rest } = await searchParams;
  const locale = await getLocale();
  // ?budget=5000&guests=50&event_type=birthday → pre-filled answers (only keys the service asks about)
  const prefill = Object.fromEntries(Object.entries(rest).filter(([, v]) => v !== undefined).map(([k, v]) => [k, /^\d+$/.test(v!) ? Number(v) : v!]));
  return (
    <div className="wrap py-12">
      <h1 className="mb-8 text-3xl font-extrabold tracking-tight">{t(locale, "Get your price & book")}</h1>
      <BookingWizard initialService={service} prefill={prefill} initialUrgency={when} initialBudget={budget} initialPromo={promo} locale={locale} />
    </div>
  );
}
