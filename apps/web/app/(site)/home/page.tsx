/*
 * FILE    : apps/web/app/(site)/home/page.tsx
 * PROJECT : Handled — AI-run home & business services
 * CREATED : 2026-10-01_1723 UTC
 * UPDATED : 2026-10-02_0218 UTC — new layout chosen by the owner: hero with the 8 category
 *           tiles, trust strip, compact "browse by category" cards (3 examples + see all),
 *           how it works, why us, and one row of tiles for events, rides, business and pros.
 *           Categories and counts come from the catalog, so new services appear automatically.
 * UPDATED : 2026-10-02_0244 UTC — moved to /home; the splash page at / introduces the company first.
 * UPDATED : 2026-10-02_1329 UTC — English / Spanish.
 * PURPOSE : Home page (the first page after the splash).
 * UPDATED : 2026-10-05_0419 UTC — category cards say "Instant upfront price" instead of "from $X".
 * UPDATED : 2026-10-05_0448 UTC — hero: "Snap a photo, post a job" next to Get my price.
 * UPDATED : 2026-10-06_0606 UTC — cleaning push (MARKETING_FOCUS): the hero leads with home & office cleaning in Metro
 *           Detroit (standard, deep, move-out, recurring, carpets, windows), then a "cleaners in your city" row
 *           linking each city's house-cleaning page. Every other category stays below.
 * UPDATED : 2026-10-06_0841 UTC — national brand: the hero no longer says the site is Detroit-only ("Home & office cleaning.
 *           Handled."); the badge says we're launching in Metro Detroit and expanding nationwide; the city row reads
 *           "Cleaners in your city" with a link for cities we don't cover yet. Sales and marketing still start in Detroit.
 */
import Link from "next/link";
import { BRAND, CATEGORIES, RECURRING_DISCOUNT, SEO_CITIES, SERVICES, categoryText, serviceText, t as tr } from "@handled/core";
import { getLocale } from "@/lib/locale";

const STEPS = [
  { n: "1", title: "Get a real price in 60 seconds", body: "Answer a few questions or snap photos. Our AI checks the details and gives you an upfront price — not a callback." },
  { n: "2", title: "We send one vetted pro", body: "Insured, background-checked and rated. We pick the best available pro for your job, date and neighborhood." },
  { n: "3", title: "Track it like a delivery", body: "Live status, messages and before/after photos in the app. If it isn’t right, we come back free or refund you." },
];

const COMPARE = [
  ["Upfront, guaranteed price", "Quotes after calls"],
  ["One pro, not 5 sales calls", "Your number is sold as a lead"],
  ["Pros vetted, insured & rated by us", "Varies"],
  ["Free redo or money back", "Varies"],
  ["One app for every home & business service", "One trade per site"],
];


// Cleaning push: what the hero offers first (MARKETING_FOCUS in @handled/core).
const PLAN_SAVE = Math.round(RECURRING_DISCOUNT.weekly * 100);
const CLEANING = [
  { href: "/book?service=house-cleaning&level=standard", icon: "🧽", title: "Standard clean", body: "Kitchen, baths, dusting, floors" },
  { href: "/book?service=house-cleaning&level=deep", icon: "✨", title: "Deep clean", body: "Baseboards, buildup, every corner" },
  { href: "/book?service=house-cleaning&level=move", icon: "📦", title: "Move-in / move-out", body: "Empty home, deposit-ready" },
  { href: "/book?service=house-cleaning&frequency=biweekly", icon: "🔁", title: "Recurring plan", body: `Same cleaner, save up to ${PLAN_SAVE}%` },
  { href: "/book?service=carpet-cleaning", icon: "🧼", title: "Carpet cleaning", body: "Rooms, stairs, rugs, upholstery" },
  { href: "/book?service=window-cleaning", icon: "🪟", title: "Window cleaning", body: "Inside, outside, screens & tracks" },
];

const TRUST = ["Insured & background-checked pros", "Upfront, all-in price", "Photo-checked work", `${BRAND.guaranteeDays}-day make-it-right guarantee`];

const MORE = [
  { href: "/events", icon: "🎉", title: "Parties & events", body: "Planning, catering, food trucks, DJs, rentals and the venue — or plan by budget.", cta: "Plan my event" },
  { href: "/services?cat=transport", icon: "🚘", title: "Rides", body: "Black cars, airport rides, game day & concert rides, limos, party buses and shuttles.", cta: "Book a ride" },
  { href: "/business", icon: "🏢", title: "For businesses", body: "Every location, one vendor, one prepaid monthly invoice.", cta: "Commercial accounts" },
  { href: "/pros", icon: "🧰", title: "Own a crew?", body: "Prepaid jobs on your phone, weekly pay, no lead fees.", cta: "Become a pro" },
];

export default async function Home() {
  const l = await getLocale();
  const t = (s: string) => tr(l, s);
  const cats = CATEGORIES.map((c) => {
    const list = SERVICES.filter((s) => s.category === c.id);
    return { ...c, list };
  }).filter((c) => c.list.length);
  return (
    <>
      {/* hero — cleaning first (MARKETING_FOCUS) */}
      <section className="wrap grid items-center gap-10 pb-12 pt-12 md:grid-cols-[1.05fr_1fr] md:pt-16">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full bg-brand-tint px-3 py-1 text-xs font-semibold text-brand-dark">● {t("Launching in Metro Detroit · expanding nationwide")}</span>
          <h1 className="mt-5 text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">
            {t("Home & office cleaning, done right.")} <span className="text-brand">{t("Handled.")}</span>
          </h1>
          <p className="mt-5 max-w-lg text-lg text-ink-soft">{t("Standard, deep and move-out cleaning, carpets and windows, by insured, background-checked local cleaners. An upfront price in 60 seconds, a photo check-out after every clean, and a free redo if anything's missed.")}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/book?service=house-cleaning" className="btn-primary px-6 py-3 text-base">{t("Book a cleaning")}</Link>
            <Link href="/business" className="btn-ghost px-6 py-3 text-base">🏢 {t("Office & property cleaning")}</Link>
            <Link href="/services" className="btn-ghost px-6 py-3 text-base">{t("See all")} {SERVICES.length} {l === "es" ? "servicios" : "services"}</Link>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {CLEANING.map((c) => (
            <Link key={c.href} href={c.href} className="card flex flex-col p-4 transition hover:border-brand hover:bg-brand-tint">
              <span className="text-2xl sm:text-3xl">{c.icon}</span>
              <span className="mt-2 text-sm font-semibold leading-tight sm:text-base">{t(c.title)}</span>
              <span className="mt-1 text-xs text-ink-soft">{l === "es" && c.title === "Recurring plan" ? `Misma persona, ahorre hasta ${PLAN_SAVE}%` : t(c.body)}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* trust strip */}
      <section className="border-y border-line bg-paper-deep">
        <div className="wrap grid grid-cols-2 gap-3 py-5 text-sm font-medium md:grid-cols-4">
          {TRUST.map((t) => <div key={t} className="flex items-center gap-2"><span className="text-brand">✓</span>{t}</div>)}
        </div>
      </section>

      {/* cleaners in your city — each links to that city's house-cleaning page */}
      <section className="wrap pt-14">
        <h2 className="text-2xl font-bold tracking-tight">{t("Cleaners in your city")}</h2>
        <p className="mt-2 text-sm text-ink-soft">{t("Pick your city to see house cleaning near you.")}</p>
        <div className="mt-5 flex flex-wrap gap-2 text-sm">
          {SEO_CITIES.map((c) => <Link key={c.slug} href={`/services/house-cleaning/in/${c.slug}`} className="rounded-full border border-line bg-white px-3 py-1 hover:border-brand hover:text-brand">{c.name}</Link>)}
        </div>
        <p className="mt-3 text-sm text-ink-soft">{t("Don’t see your city? We’re adding new cities all the time.")} <Link href="/book?service=house-cleaning" className="font-semibold text-brand underline">{t("Check your ZIP")}</Link></p>
      </section>

      {/* browse by category */}
      <section className="wrap py-14">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="text-3xl font-bold tracking-tight">{t("Everything else, handled too")}</h2>
          <Link href="/services" className="text-sm font-semibold text-brand">All {SERVICES.length} services →</Link>
        </div>
        {/* phones: swipe sideways; tablets and up: grid */}
        <div className="-mx-4 mt-8 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 lg:grid-cols-4">
          {cats.map((c) => (
            <div key={c.id} className="card flex w-[78%] shrink-0 snap-start flex-col sm:w-auto">
              <div className="flex items-center gap-2"><span className="text-2xl">{c.icon}</span><span className="font-semibold leading-tight">{categoryText(l, c.id, c).name}</span></div>
              <ul className="mt-3 flex-1 space-y-1.5 text-sm">
                {c.list.slice(0, 3).map((s) => (
                  <li key={s.slug}><Link href={`/services/${s.slug}`} className="text-ink-soft hover:text-brand">{s.icon} {serviceText(l, s.slug, s).name}</Link></li>
                ))}
              </ul>
              <div className="mt-4 flex items-center justify-between border-t border-line pt-3 text-sm">
                <span className="text-ink-soft">{c.id === "events" ? t("By budget") : l === "es" ? "Precio al instante" : "Instant upfront price"}</span>
                <Link href={`/services?cat=${c.id}`} className="font-semibold text-brand">{t("See all")} {c.list.length} →</Link>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* how it works */}
      <section className="border-y border-line bg-paper-deep py-14">
        <div className="wrap">
          <h2 className="text-3xl font-bold tracking-tight">{t("How it works")}</h2>
          <div className="mt-8 grid gap-6 md:grid-cols-3">
            {STEPS.map((s) => (
              <div key={s.n} className="card">
                <div className="grid h-9 w-9 place-items-center rounded-full bg-brand-deep text-sm font-bold text-white">{s.n}</div>
                <div className="mt-4 font-semibold">{t(s.title)}</div>
                <p className="mt-2 text-sm text-ink-soft">{t(s.body)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* why us */}
      <section className="wrap py-14">
        <div className="card overflow-hidden p-0">
          <div className="grid md:grid-cols-[1fr_1.4fr]">
            <div className="bg-brand-deep p-8 text-white">
              <h2 className="text-2xl font-bold">Not a lead list. A finished job.</h2>
              <p className="mt-3 text-sm text-white/75">
                Lead sites sell your phone number to several contractors and leave the rest to you. {BRAND.name} owns the outcome: we price it, send the pro, check the work and stand behind it.
              </p>
              <Link href="/book" className="btn mt-6 bg-white text-brand-dark">Get my price</Link>
            </div>
            <table className="w-full text-sm">
              <thead><tr className="border-b border-line text-left text-xs uppercase tracking-wide text-ink-soft"><th className="p-4"></th><th className="p-4">Typical lead site</th><th className="p-4 text-brand">{BRAND.name}</th></tr></thead>
              <tbody>
                {COMPARE.map(([a, b]) => (
                  <tr key={a} className="border-b border-line last:border-0"><td className="p-4 font-medium">{a}</td><td className="p-4 text-ink-soft">{b}</td><td className="p-4 font-bold text-brand">✓</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* more from Handled */}
      <section className="wrap pb-8">
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {MORE.map((m) => (
            <Link key={m.href} href={m.href} className="card flex flex-col p-4 transition hover:border-brand sm:p-5">
              <span className="text-3xl">{m.icon}</span>
              <span className="mt-3 text-base font-bold sm:text-lg">{m.title}</span>
              <span className="mt-1 hidden flex-1 text-sm text-ink-soft sm:block">{m.body}</span>
              <span className="mt-4 text-sm font-semibold text-brand">{m.cta} →</span>
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}
