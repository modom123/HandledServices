/*
 * FILE    : apps/web/app/(site)/business/photo-quote/page.tsx
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-11-25_0200 UTC
 * PURPOSE : Price from photos for businesses, instead of a walkthrough (owner, 2026-11-25). ?for=<landing slug> picks that
 *           kind of business's services; ?lead=<token> (sales emails) pre-fills what we know and credits the lead;
 *           ?service= preselects one. The walkthrough stays available for anyone who'd rather meet.
 */
import Link from "next/link";
import { SERVICES, bizLanding } from "@handled/core";
import { BizPhotoQuote } from "@/components/BizPhotoQuote";
import { leadPrefill } from "@/lib/walkthroughs";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Get a price from photos",
  description: "Send a few photos and get your exact price for business cleaning, turnovers, repairs and more. No walkthrough needed.",
  alternates: { canonical: "/business/photo-quote" },
};

const DEFAULT = ["house-cleaning", "unit-turnover", "carpet-cleaning", "window-cleaning", "power-washing", "handyman", "junk-removal", "lawn-care"];

export default async function PhotoQuotePage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const q = await searchParams;
  const lead = q.lead && /^[a-z0-9]{8,40}$/.test(q.lead) ? q.lead : null;
  const prefill = await leadPrefill(lead).catch(() => null);
  const landing = bizLanding(q.for ?? "") ?? null;
  const slugs = [...new Set([...(landing?.services ?? []), ...DEFAULT])].filter((s) => SERVICES.some((x) => x.slug === s));
  const services = slugs.map((s) => ({ slug: s, name: SERVICES.find((x) => x.slug === s)!.name }));
  const preset = q.service && slugs.includes(q.service) ? q.service : null;
  const back = `${lead ? `lead=${lead}&` : ""}${landing ? `for=${landing.slug}` : ""}`.replace(/&$/, "");
  return (
    <div className="wrap max-w-3xl py-8 sm:py-12">
      {landing && <Link href={`/business/${landing.slug}${lead ? `?lead=${lead}` : ""}`} className="text-sm text-brand">← {landing.name}</Link>}
      <h1 className="mt-2 text-3xl font-extrabold tracking-tight">Get your price from photos</h1>
      <p className="mt-2 text-ink-soft">{prefill?.name ? `Hi ${prefill.name.split(" ")[0]}, skip` : "Skip"} the walkthrough. Snap a few photos of the space, tell us how often, and see your price right away. Bigger or unusual jobs get a firm price from our team within a few hours, from the same photos.</p>
      <div className="mt-6"><BizPhotoQuote services={services} preset={preset} lead={lead} landing={landing?.slug ?? null} prefill={prefill ? { company: prefill.company, name: prefill.name, email: prefill.email, phone: prefill.phone } : null} /></div>
      <p className="mt-6 text-sm text-ink-soft">Rather meet in person or talk it through? <Link href={`/walkthrough${back ? `?${back}` : ""}`} className="font-semibold text-brand">Book a free walkthrough or call</Link>.</p>
    </div>
  );
}
