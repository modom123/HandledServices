/*
 * FILE    : apps/web/app/(site)/walkthrough/page.tsx
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-11-17_2350 UTC
 * PURPOSE : Book a free walkthrough (businesses pick their own time; no back-and-forth).
 *           ?for=<landing slug> (from /business/<slug>), ?lead=<token> (sales emails: pre-fills what we know and credits
 *           the lead), ?kind=onsite|call.
 */
import Link from "next/link";
import { bizLanding, type WalkthroughKind } from "@handled/core";
import { WalkthroughBooker } from "@/components/Walkthrough";
import { leadPrefill } from "@/lib/walkthroughs";

export const dynamic = "force-dynamic";
export const metadata = { title: "Book a free walkthrough", description: "Pick a time for a free on-site walkthrough or a 10-minute call. Exact price the same day, no obligation." };

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
      <p className="mt-2 text-ink-soft">{prefill ? `Hi${prefill.name ? ` ${prefill.name.split(" ")[0]}` : ""} — pick a time that works for ${prefill.company}.` : "Pick a time that works for you."} We see the work, answer your questions and send an exact price the same day. No charge, no obligation.</p>
      <div className="mt-6"><WalkthroughBooker initialKind={kind} landing={landing?.slug ?? null} lead={lead} prefill={prefill} /></div>
      <p className="mt-8 text-sm text-ink-soft">Already know what you need? <Link href={`/book?for=business${lead ? `&lead=${lead}` : ""}`} className="font-semibold text-brand">Order online</Link> and see your price in about a minute.</p>
    </div>
  );
}
