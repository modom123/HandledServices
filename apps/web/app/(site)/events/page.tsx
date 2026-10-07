/*
 * FILE    : apps/web/app/(site)/events/page.tsx
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-01_2145 UTC
 * PURPOSE : Parties & Events landing page — planning, catering, food trucks, DJs, rentals
 *           and venues, booked separately or coordinated as one event.
 * UPDATED : 2026-10-04_1950 UTC — lists show a typical job price ("typically $X"), not the minimum (every order is different).
 */
import Link from "next/link";
import { BRAND, SERVICES, defaultAnswers, estimate, money, moneyRange, priceHint } from "@handled/core";
import { ThemedIcon } from "@/components/Glyph";

export const metadata = { title: "Parties & Events", description: "Event planning, catering, food trucks, DJs, seating rentals and venues — one team, one invoice." };

const STEPS = [
  ["Tell us about your event", "Date, guest count and the vibe. Get instant prices for each piece, or book a free planning call."],
  ["We line up every vendor", "Licensed caterers and food trucks, DJs and bands, rentals and the venue — vetted, insured and coordinated by your planner."],
  ["One invoice, one point of contact", `Everything is on one invoice and service agreement. ${BRAND.promise}`],
];

export default function Events() {
  const list = SERVICES.filter((s) => s.category === "events");
  return (
    <>
      <section className="border-b border-line bg-brand-deep text-white">
        <div className="wrap grid items-center gap-10 py-16 md:grid-cols-[1.3fr_1fr]">
          <div>
            <span className="inline-flex rounded-full bg-white/10 px-3 py-1 text-xs font-semibold">🎉 Parties & Events</span>
            <h1 className="mt-4 text-4xl font-extrabold leading-tight sm:text-5xl">Your event, <span className="text-gold-light">handled.</span></h1>
            <p className="mt-4 max-w-xl text-lg text-white/75">Birthdays, weddings, corporate dinners, company BBQs, Taco Tuesday office lunches, day parties and pool parties. Catering, food trucks, music, seating and the space — planned and coordinated by one team, on one invoice.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/book?service=event-package" className="btn bg-white px-6 py-3 text-base text-brand-dark hover:bg-brand-tint">Plan by budget</Link>
              <a href="#services" className="btn border border-white/30 px-6 py-3 text-base text-white hover:border-white">Book à la carte</a>
            </div>
            <p className="mt-4 text-sm text-white/60">Tell us “$5,000, 50 guests, birthday” — we’ll show exactly how we’d spend it, then plan and book everything.</p>

          </div>
          <div className="grid grid-cols-2 gap-3">
            {list.filter((s) => !["event-package", "event-planning"].includes(s.slug)).slice(0, 4).map((s) => (
              <Link key={s.slug} href={`/book?service=${s.slug}`} className="rounded-2xl bg-white/10 p-4 transition hover:bg-white/15">
                <div><ThemedIcon icon={s.icon} size="md" emojiClass="text-2xl" /></div><div className="mt-2 text-sm font-semibold">{s.name}</div><div className="text-xs text-white/60">{priceHint(s.slug)}</div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section id="services" className="wrap py-14">
        <div className="card mb-10 grid items-center gap-6 border-brand/30 bg-brand-tint md:grid-cols-[1.4fr_1fr]">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-brand-dark">Easiest way</div>
            <h2 className="mt-1 text-2xl font-bold">Plan by budget</h2>
            <p className="mt-2 text-ink-soft">Enter your total budget, guest count and type of event. We split it across food, venue, music, rentals and coordination — you see exactly what it buys before you book a free planning call. Your plan never goes over budget.</p>
          </div>
          <div className="space-y-2 text-sm">
            {([["$5,000", "50 guests · birthday", "budget=5000&guests=50&event_type=birthday"], ["$10,000", "120 guests · corporate party", "budget=10000&guests=120&event_type=corporate"], ["$25,000", "150 guests · wedding", "budget=25000&guests=150&event_type=wedding"], ["$1,500", "40 people · Taco Tuesday lunch", "budget=1500&guests=40&event_type=lunch_party&venue=have"], ["$6,000", "150 people · company BBQ", "budget=6000&guests=150&event_type=company_bbq"], ["$4,000", "60 guests · pool party", "budget=4000&guests=60&event_type=pool_party&venue=have"]] as const).map(([b, d, q]) => (
              <Link key={b} href={`/book?service=event-package&${q}`} className="flex justify-between rounded-xl border border-line bg-white px-4 py-2 hover:border-brand"><b>{b}</b><span className="text-ink-soft">{d} →</span></Link>
            ))}
          </div>
        </div>
        <h2 className="text-3xl font-bold tracking-tight">À la carte</h2>
        <p className="mt-1 text-ink-soft">Book just the pieces you need.</p>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {list.filter((s) => s.slug !== "event-package").map((s) => {
            const e = estimate({ slug: s.slug, answers: defaultAnswers(s) });
            return (
              <div key={s.slug} className="card flex flex-col">
                <div><ThemedIcon icon={s.icon} size="lg" emojiClass="text-3xl" /></div>
                <div className="mt-3 font-semibold">{s.name}</div>
                <p className="mt-1 flex-1 text-sm text-ink-soft">{s.tagline}</p>
                <div className="mt-3 text-sm"><span className="text-ink-soft">Typical:</span> <b>{s.siteVisit ? moneyRange(e.low, e.high) : money(e.point)}</b></div>
                <div className="mt-4 flex gap-2"><Link href={`/book?service=${s.slug}`} className="btn-primary px-4 py-2">{s.siteVisit ? "Free consultation" : "Get my price"}</Link><Link href={`/services/${s.slug}`} className="btn-ghost px-4 py-2">Details</Link></div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="wrap pb-10">
        <div className="grid gap-6 md:grid-cols-3">
          {STEPS.map(([t, b], i) => (
            <div key={t} className="card"><div className="grid h-9 w-9 place-items-center rounded-full bg-brand-deep text-sm font-bold text-white">{i + 1}</div><div className="mt-4 font-semibold">{t}</div><p className="mt-2 text-sm text-ink-soft">{b}</p></div>
          ))}
        </div>
      </section>
    </>
  );
}
