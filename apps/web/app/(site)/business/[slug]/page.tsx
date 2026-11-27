/*
 * FILE    : apps/web/app/(site)/business/[slug]/page.tsx
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-11-17_2350 UTC
 * PURPOSE : One landing page per kind of business (core BIZ_LANDINGS): property managers, offices & facilities, real
 *           estate, self-storage, stagers, furniture stores, and employers hiring for cleaning or maintenance.
 *           One offer (their first job) and one main button: book a free walkthrough. "Order online" for those
 *           ready now. Sales-email links land here (/b/<token> picks the page from the lead's segment) and ?lead= is
 *           carried to the walkthrough and the order, so the lead is credited.
 * UPDATED : 2026-11-19_1540 UTC — "or post a project and get an estimate" (/post, our own lead) next to the walkthrough and order buttons.
 * UPDATED : 2026-11-25_0200 UTC — the main button is "Get a price from photos" (no walkthrough); the walkthrough is the backup.
 * UPDATED : 2026-11-27_1800 UTC — "Post your project" is now "Get it Handled" (/post): quick description, 3 photos, AI quote, then book at
 *           Handled's price or name your price.
 */
import Link from "next/link";
import { notFound } from "next/navigation";
import { BIZ_LANDINGS, WALKTHROUGH_KINDS, bizLanding, businessServices, priceHint } from "@handled/core";
import { ThemedIcon } from "@/components/Glyph";
import { LeadLink } from "@/components/LeadLink";

export const dynamicParams = false;
export function generateStaticParams() { return BIZ_LANDINGS.map((l) => ({ slug: l.slug })); }

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const l = bizLanding((await params).slug);
  return l ? { title: l.seoTitle, description: l.seoDescription, alternates: { canonical: `/business/${l.slug}` } } : {};
}

const STEPS = [
  ["Send a few photos", "Snap the space on your phone. No walkthrough needed (you can still book one if you'd rather meet)."],
  ["Get an exact price", "Right away for most jobs, or within a few hours for bigger ones. No obligation."],
  ["We do the first job", "A vetted crew, before-and-after photos in your account."],
  ["Keep what works", "Make it recurring, add properties, move to monthly invoicing."],
];

export default async function BizLandingPage({ params }: { params: Promise<{ slug: string }> }) {
  const l = bizLanding((await params).slug);
  if (!l) notFound();
  // ?lead= is read on the client by Attribution; the buttons carry it too (server pages can't read it while static)
  const walk = `/walkthrough?for=${l.slug}`;
  const photo = `/business/photo-quote?for=${l.slug}`;
  const order = `/book?for=business${l.services[0] ? `&service=${l.services[0]}` : ""}`;
  const services = businessServices(l.services);
  return (
    <div>
      <section className="bg-brand-deep text-white">
        <div className="wrap grid items-center gap-8 py-10 md:grid-cols-[1.3fr_1fr] md:py-16 pro:md:py-10">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-gold-light">{l.eyebrow}</p>
            <h1 className="mt-3 text-3xl font-extrabold leading-tight tracking-tight sm:text-5xl">{l.h1}</h1>
            <p className="mt-4 max-w-xl text-lg text-white/80">{l.sub}</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <LeadLink href={photo} className="btn bg-white px-6 py-3 text-base text-brand-deep hover:bg-gold-light">📸 Get a price from photos</LeadLink>
              <LeadLink href={order} className="btn border border-white/40 px-6 py-3 text-base text-white hover:bg-white/10">Order online</LeadLink>
            </div>
            <p className="mt-3 text-sm text-white/70">No walkthrough needed: send a few photos, see your price. Rather meet? <LeadLink href={walk} className="font-semibold text-white underline">Book a free walkthrough</LeadLink>.</p>
          </div>
          <div className="rounded-2xl bg-white/10 p-5 ring-1 ring-white/15">
            <div className="text-xs font-semibold uppercase tracking-wide text-gold-light">Start with one job</div>
            <div className="mt-1 text-2xl font-bold">{l.firstJob}</div>
            <p className="mt-2 text-white/80">{l.firstJobWhy}</p>
            <ul className="mt-4 space-y-1 text-sm">{["Price from photos, no walkthrough", "Exact price before you book", "25% to book, the rest when it’s done", "If it isn’t right, we redo it free or refund it"].map((x) => <li key={x}><span className="text-gold-light">✓</span> {x}</li>)}</ul>
          </div>
        </div>
      </section>

      <section className="wrap py-10 sm:py-14 pro:sm:py-10">
        <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Why {l.name.toLowerCase()} use Handled</h2>
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {l.bullets.map(([t, b]) => <div key={t} className="card"><div className="font-semibold">{t}</div><p className="mt-1 text-sm text-ink-soft">{b}</p></div>)}
        </div>
      </section>

      <section className="border-y border-line bg-paper-deep py-10 sm:py-14 pro:sm:py-10">
        <div className="wrap">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">How it works</h2>
          <ol className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map(([t, b], i) => (
              <li key={t} className="card flex gap-3 py-4 lg:block">
                <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand-deep text-sm font-bold text-white">{i + 1}</div>
                <div><div className="font-semibold lg:mt-3">{t}</div><p className="mt-1 text-sm text-ink-soft">{b}</p></div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="wrap py-10 sm:py-14 pro:sm:py-10">
        <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">What we do for you</h2>
        <ul className="mt-4 divide-y divide-line border-y border-line">
          {services.map((x) => (
            <li key={x.slug}>
              <Link href={`/services/${x.slug}`} className="flex items-center justify-between gap-3 py-3 hover:text-brand">
                <span className="inline-flex items-center gap-2"><ThemedIcon icon={x.icon} emojiClass="" />{x.name}</span>
                <span className="shrink-0 text-sm text-ink-soft">{priceHint(x.slug)}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="border-t border-line bg-paper-deep py-10 sm:py-14 pro:sm:py-10">
        <div className="wrap grid gap-8 lg:grid-cols-2">
          <div>
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Questions</h2>
            <div className="mt-4 space-y-2">
              {l.faq.map(([q, a]) => <details key={q} className="card"><summary className="cursor-pointer font-semibold">{q}</summary><p className="mt-2 text-sm text-ink-soft">{a}</p></details>)}
            </div>
          </div>
          <div className="card self-start text-center">
            <h2 className="text-xl font-bold">{l.firstJob}</h2>
            <p className="mt-2 text-sm text-ink-soft">Send a few photos and see your price right away. Bigger jobs get a firm price within a few hours, still with no visit.</p>
            <LeadLink href={photo} className="btn-primary mt-4 inline-block px-8 py-3 text-base">📸 Get a price from photos</LeadLink>
            <p className="mt-3 text-sm"><LeadLink href={walk} className="font-semibold text-brand">or book a free walkthrough →</LeadLink></p>
            <p className="mt-3 text-sm"><LeadLink href={order} className="font-semibold text-brand">or order online now →</LeadLink></p>
            <p className="mt-1 text-sm"><LeadLink href={`/post?utm_source=business_page&utm_campaign=${l.slug}`} className="font-semibold text-brand">or Get it Handled: 3 photos, your price →</LeadLink></p>
          </div>
        </div>
      </section>
    </div>
  );
}

