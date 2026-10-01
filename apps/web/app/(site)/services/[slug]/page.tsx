/*
 * FILE    : apps/web/app/(site)/services/[slug]/page.tsx
 * PROJECT : Handled — AI-run home & business services
 * CREATED : 2026-10-01_1723 UTC
 * PURPOSE : Service detail page (SEO landing page per service).
 */
import Link from "next/link";
import { notFound } from "next/navigation";
import { BRAND, SERVICES, defaultAnswers, estimate, getService, money, moneyRange } from "@handled/core";

export function generateStaticParams() {
  return SERVICES.map((s) => ({ slug: s.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const s = getService((await params).slug);
  return s ? { title: s.name, description: s.description } : {};
}

export default async function ServicePage({ params }: { params: Promise<{ slug: string }> }) {
  const s = getService((await params).slug);
  if (!s) notFound();
  const typical = estimate({ slug: s.slug, answers: defaultAnswers(s) });
  return (
    <div className="wrap grid gap-10 py-14 md:grid-cols-[1.4fr_1fr]">
      <div>
        <div className="text-5xl">{s.icon}</div>
        <h1 className="mt-4 text-4xl font-extrabold tracking-tight">{s.name}</h1>
        <p className="mt-2 text-lg text-brand">{s.tagline}</p>
        <p className="mt-5 text-ink-soft">{s.description}</p>
        <h2 className="mt-10 font-bold">What’s included</h2>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {s.includes.map((i) => <li key={i} className="flex gap-2 text-sm"><span className="text-brand">✓</span>{i}</li>)}
        </ul>
        <h2 className="mt-10 font-bold">Questions we’ll ask for your price</h2>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-ink-soft">
          {s.questions.map((q) => <li key={q.id}>{q.label}{q.help ? <span className="block text-xs">{q.help}</span> : null}</li>)}
        </ul>
      </div>
      <aside className="card h-fit md:sticky md:top-24">
        <div className="text-xs font-semibold uppercase tracking-wide text-ink-soft">Typical price</div>
        <div className="mt-1 text-3xl font-bold">{moneyRange(typical.low, typical.high)}</div>
        <div className="mt-1 text-sm text-ink-soft">Minimum {money(s.minimum)}{s.frequencies.length > 1 ? " · save up to 20% on a plan" : ""}</div>
        {(s.slug === "junk-removal" || s.slug === "large-item-removal") && (
          <Link href="/services/junk-container" className="mt-3 block rounded-xl border border-line p-3 text-sm hover:border-brand">🗑️ <b>Rather load it yourself over a week?</b> We drop off a container and pick it up — from {money(getService("junk-container")?.minimum ?? 349)}.</Link>
        )}
        {s.slug === "junk-container" && (
          <Link href="/services/junk-removal" className="mt-3 block rounded-xl border border-line p-3 text-sm hover:border-brand">🚛 <b>Want us to do the lifting?</b> Book full-service Junk Removal instead.</Link>
        )}
        {s.siteVisit && <p className="mt-3 rounded-xl bg-brand-tint p-3 text-sm text-brand-dark">Free on-site estimate — a pro confirms the firm price before any work.</p>}
        <Link href={`/book?service=${s.slug}`} className="btn-primary mt-5 w-full py-3">Get my exact price</Link>
        <p className="mt-4 text-xs text-ink-soft">{BRAND.promise}</p>
      </aside>
    </div>
  );
}
