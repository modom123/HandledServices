/*
 * FILE    : apps/web/app/(site)/walkthrough/page.tsx
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-11-17_2350 UTC
 * PURPOSE : Book a free walkthrough (businesses pick their own time; no back-and-forth).
 *           ?for=<landing slug> (from /business/<slug>), ?lead=<token> (sales emails: pre-fills what we know and credits
 *           the lead), ?kind=onsite|call.
 * UPDATED : 2026-11-24_2200 UTC — canonical URL (SEO review).
 * UPDATED : 2026-11-25_0200 UTC — "Faster: skip the walkthrough" link to Get a price from photos.
 */
import Link from "next/link";
import { bizLanding, type WalkthroughKind } from "@handled/core";
import { WalkthroughBooker } from "@/components/Walkthrough";
import { leadPrefill } from "@/lib/walkthroughs";

export const dynamic = "force-dynamic";
export const metadata = { alternates: { canonical: "/walkthrough" }, title: "Book a free walkthrough", description: "Pick a time for a free on-site walkthrough or a 10-minute call. Exact price the same day, no obligation." };

export default async function WalkthroughPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const q = await searchParams;
  const lead = q.lead && /^[a-z0-9]{8,40}$/.test(q.lead) ? q.lead : null;
  const prefill = await leadPrefill(lead).catch(() => null);
  const landing = bizLanding(q.for ?? "") ?? null;
  const kind: WalkthroughKind = q.kind === "call" || q.kind === "onsite" ? q.kind : landing?.kind ?? "onsite";
  return (
    <div className="wrap max-w-3xl py-8 sm:py-12">
      {landing && <Link href={`/business/${landing.slug}${lead ? `?lead=${lead}` : ""}`} className="text-sm text-brand">← {landing.name}</Link>}
      <h1 className="mt-2 text-3xl font-extrabold tracking-tight">Book a free walkthrough</h1>
      <p className="mt-2 text-ink-soft">{prefill ? `Hi${prefill.name ? ` ${prefill.name.split(" ")[0]}` : ""}, pick` : "Pick"} a time. We send an exact price the same day. Free, no obligation.</p>
      <p className="mt-4 rounded-lg bg-brand-tint p-3 text-sm"><b>Faster: skip the walkthrough.</b> Send a few photos and see your price right away. <Link href={`/business/photo-quote${lead || landing ? `?${[lead ? `lead=${lead}` : "", landing ? `for=${landing.slug}` : ""].filter(Boolean).join("&")}` : ""}`} className="font-semibold text-brand underline">Get a price from photos →</Link></p>
      <div className="mt-6"><WalkthroughBooker initialKind={kind} landing={landing?.slug ?? null} lead={lead} prefill={prefill} /></div>
      <p className="mt-8 text-sm text-ink-soft">Already know what you need? <Link href={`/book?for=business${lead ? `&lead=${lead}` : ""}`} className="font-semibold text-brand">Order online</Link> and see your price in about a minute.</p>
    </div>
  );
}
