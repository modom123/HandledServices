/*
 * FILE    : apps/web/app/(site)/quote-request/page.tsx
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-20_0200 UTC
 * PURPOSE : Request-a-quote for big jobs: describe it (photos help), and up to 3 vetted local pros send firm, all-in
 *           quotes within 24 hours. ?service= preselects the service.
 */
import { QuoteRequestForm } from "@/components/QuoteForms";

export const metadata = { title: "Get quotes for a big job" };

export default async function QuoteRequestPage({ searchParams }: { searchParams: Promise<{ service?: string }> }) {
  const { service } = await searchParams;
  return (
    <div className="wrap max-w-3xl py-12">
      <h1 className="text-3xl font-extrabold tracking-tight">Get firm quotes for a big job</h1>
      <p className="mt-2 text-ink-soft">Remodels, painting a whole house, construction, big cleanouts, commercial cleaning… Tell us about it and up to 3 vetted, insured local pros send a firm, all-in price. Compare them side by side and book the one you like — still one upfront price, paid when you book.</p>
      <div className="mt-8"><QuoteRequestForm initialService={service} /></div>
    </div>
  );
}
