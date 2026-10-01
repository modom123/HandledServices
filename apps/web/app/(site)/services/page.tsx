/*
 * FILE    : apps/web/app/(site)/services/page.tsx
 * PROJECT : Handled — AI-run home & business services
 * CREATED : 2026-10-01_1723 UTC
 * UPDATED : 2026-10-01_2334 UTC — organized: jump-to category bar, most-booked row, category
 *           sections with icon, blurb and count, and cards that say how each service is priced.
 */
import Link from "next/link";
import { CATEGORIES, SERVICES, money, photoRule, type Service } from "@handled/core";

export const metadata = { title: "Services", description: "Every service we offer, organized by category, with upfront prices." };

const POPULAR = ["house-cleaning", "junk-removal", "handyman", "lawn-care", "power-washing", "errands"];

function Card({ s }: { s: Service }) {
  const photos = photoRule(s.slug).need === "required";
  return (
    <Link href={`/services/${s.slug}`} className="card flex flex-col transition hover:border-brand">
      <div className="flex items-start justify-between gap-2"><div className="text-3xl">{s.icon}</div>
        <div className="flex flex-wrap justify-end gap-1 text-[11px]">
          {s.frequencies.length > 1 && <span className="rounded-full bg-brand-tint px-2 py-0.5 text-brand-dark">Recurring plans</span>}
          {s.licensed && <span className="rounded-full bg-paper px-2 py-0.5 text-ink-soft">Licensed pros</span>}
        </div>
      </div>
      <div className="mt-3 font-semibold">{s.name}</div>
      <p className="mt-1 flex-1 text-sm text-ink-soft">{s.tagline}</p>
      <div className="mt-3 text-sm font-semibold text-brand">
        {s.slug === "event-package" ? "Plan by budget" : `from ${money(s.minimum)}`}{s.siteVisit ? " · free site visit" : photos ? " · price checked from your photos" : " · instant price"}
      </div>
    </Link>
  );
}

export default function ServicesPage() {
  const cats = CATEGORIES.map((c) => ({ ...c, list: SERVICES.filter((s) => s.category === c.id) })).filter((c) => c.list.length);
  return (
    <div className="wrap py-14">
      <h1 className="text-4xl font-extrabold tracking-tight">Services</h1>
      <p className="mt-2 max-w-2xl text-ink-soft">{SERVICES.length} services, one account. Upfront prices, vetted and insured pros, and a free redo or your money back if anything isn’t right.</p>

      <nav aria-label="Categories" className="sticky top-16 z-10 -mx-4 mt-8 overflow-x-auto bg-paper/95 px-4 py-3 backdrop-blur">
        <div className="flex gap-2">
          {cats.map((c) => (
            <a key={c.id} href={`#${c.id}`} className="whitespace-nowrap rounded-full border border-line bg-white px-3.5 py-1.5 text-sm hover:border-brand">
              {c.icon} {c.name} <span className="text-ink-soft">({c.list.length})</span>
            </a>
          ))}
        </div>
      </nav>

      <section className="mt-8">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-soft">Most booked</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {POPULAR.map((slug) => SERVICES.find((s) => s.slug === slug)).filter(Boolean).map((s) => (
            <Link key={s!.slug} href={`/book?service=${s!.slug}`} className="rounded-full border border-brand bg-brand-tint px-3.5 py-1.5 text-sm font-semibold text-brand-dark hover:bg-white">{s!.icon} {s!.name}</Link>
          ))}
        </div>
      </section>

      {cats.map((c) => (
        <section key={c.id} id={c.id} className="mt-14 scroll-mt-32">
          <div className="flex flex-wrap items-end justify-between gap-2 border-b border-line pb-3">
            <div>
              <h2 className="text-2xl font-bold">{c.icon} {c.name}</h2>
              <p className="mt-1 text-sm text-ink-soft">{c.blurb}</p>
            </div>
            {c.id === "events" && <Link href="/events" className="text-sm font-semibold text-brand">Plan an event by budget →</Link>}
          </div>
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {c.list.map((s) => <Card key={s.slug} s={s} />)}
          </div>
        </section>
      ))}
    </div>
  );
}
