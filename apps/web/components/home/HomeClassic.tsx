/*
 * FILE    : apps/web/components/home/HomeClassic.tsx
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
 * UPDATED : 2026-10-06_2010 UTC — removed the list of Michigan cities (customers give their address when booking).
 * UPDATED : 2026-10-06_0841 UTC — national brand: the hero no longer says the site is Detroit-only ("Home & office cleaning.
 *           Handled."); the badge says we're launching in Metro Detroit and expanding nationwide; the city row reads
 *           "Cleaners in your city" with a link for cities we don't cover yet. Sales and marketing still start in Detroit.
 * UPDATED : 2026-10-07_0040 UTC — gold accents (launch dot, trust checks, card hover borders).
 * UPDATED : 2026-10-07_0235 UTC — moved here from app/(site)/home/page.tsx: the home layout for the Original and
 *           Green-white-gold looks (lib/theme.ts). The Modern look uses HomeModern.
 * UPDATED : 2026-10-11_2307 UTC — "We build" band: intelligent websites, business operating systems, automated businesses.
 * UPDATED : 2026-10-23_0430 UTC — the hero no longer leads with cleaning: it offers our 4 most popular services as big
 *           buttons (lib/popular.ts: approved pros who cover them + what people order), then "Everything else we offer",
 *           which now lists every other service in each category (none hidden), and a "Become a partner" band.
 * UPDATED : 2026-10-23_1430 UTC — four big doors under the hero (components/home/HomeDoors): Services, Become a Pro (application),
 *           Become a Partner (sign-up) and Handled Network (/network); each opens its page.
 * UPDATED : 2026-10-23_1030 UTC — category cards show 3 services each (uniform cards); "+ N more" opens the rest of that
 *           group in a dropdown over the page, so the cards keep their size; on
 *           phones (swipe row) it opens inside the card (native <details>, no script).
 * UPDATED : 2026-10-27_1500 UTC — cleanup: "Why it works" for customers and pros (replaces the lead-site comparison table),
 *           a "Who we are" strip (slogan + mission → /about); the "More from Handled" tiles are gone (the side menu has them);
 *           order: hero → doors → trust → why it works → services → who we are → partner → we build.
 * UPDATED : 2026-10-28_1730 UTC — trimmed repeats: no separate "How it works" (the For customers card says it); Business &
 *           Technology left out of the category grid (the "We build" band and /technology cover it).
 */
import Link from "next/link";
import { BRAND, CATEGORIES, SERVICES, categoryText, serviceText, t as tr } from "@handled/core";
import { getLocale } from "@/lib/locale";
import { popularServices } from "@/lib/popular";
import { WeBuild } from "@/components/home/WeBuild";
import { PartnerBand } from "@/components/home/PartnerBand";
import { HomeDoors } from "@/components/home/HomeDoors";
import { WhyItWorks } from "@/components/home/WhyItWorks";
import { WhoWeAre } from "@/components/home/WhoWeAre";




const TRUST = ["Insured & background-checked pros", "Upfront, all-in price", "Photo-checked work", `${BRAND.guaranteeDays}-day make-it-right guarantee`];


export async function HomeClassic() {
  const l = await getLocale();
  const t = (s: string) => tr(l, s);
  const es = l === "es";
  const top = await popularServices(4);
  const topSlugs = new Set(top.map((s) => s.slug));
  const cats = CATEGORIES.filter((c) => c.id !== "business").map((c) => {
    const all = SERVICES.filter((s) => s.category === c.id);
    return { ...c, all, list: all.filter((s) => !topSlugs.has(s.slug)) }; // every service not already in Most popular
  }).filter((c) => c.list.length);
  return (
    <>
      {/* hero — our 4 most popular services (lib/popular.ts), everything else below */}
      <section className="wrap grid items-center gap-10 pb-12 pt-12 md:grid-cols-[1.05fr_1fr] md:pt-16">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full bg-brand-tint px-3 py-1 text-xs font-semibold text-brand-dark"><span className="text-gold">●</span> {t("Launching in Metro Detroit · expanding nationwide")}</span>
          <h1 className="mt-5 text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">
            {es ? "Servicios para hogar y negocio." : "Home & business services."} <span className="text-brand">{t("Handled.")}</span>
          </h1>
          <p className="mt-5 max-w-lg text-lg text-ink-soft">{es ? "Profesionales asegurados y verificados, un precio fijo en 60 segundos, fotos al terminar y lo rehacemos gratis si algo falta. Empiece con lo más pedido o vea todo lo que ofrecemos." : "Insured, background-checked local pros, an upfront price in 60 seconds, a photo check-out after every job, and a free redo if anything's missed. Start with what's most popular, or see everything we offer."}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/book" className="btn-primary px-6 py-3 text-base">{t("Get my price")}</Link>
            <Link href="/services" className="btn-ghost px-6 py-3 text-base">{t("See all")} {SERVICES.length} {es ? "servicios" : "services"}</Link>
          </div>
        </div>
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-ink-soft">{es ? "Lo más popular" : "Most popular"}</div>
          <div className="mt-3 grid grid-cols-2 gap-3">
            {top.map((s) => (
              <Link key={s.slug} href={`/book?service=${s.slug}`} className="card flex flex-col p-4 transition hover:border-gold hover:bg-brand-tint sm:p-5">
                <span className="text-3xl sm:text-4xl">{s.icon}</span>
                <span className="mt-3 text-base font-bold leading-tight sm:text-lg">{serviceText(l, s.slug, s).name}</span>
                <span className="mt-1 flex-1 text-xs text-ink-soft sm:text-sm">{serviceText(l, s.slug, s).tagline}</span>
                <span className="mt-3 text-sm font-semibold text-brand">{es ? "Reservar" : "Book now"} →</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* four doors: services, become a pro, become a partner, Handled Network */}
      <HomeDoors es={es} servicesCount={SERVICES.length} />

      {/* trust strip */}
      <section className="border-y border-line bg-paper-deep">
        <div className="wrap grid grid-cols-2 gap-3 py-5 text-sm font-medium md:grid-cols-4">
          {TRUST.map((t) => <div key={t} className="flex items-center gap-2"><span className="font-bold text-gold-dark">✓</span>{t}</div>)}
        </div>
      </section>

      {/* why it works: what customers get, what pros get, and the model */}
      <WhyItWorks es={es} />

      {/* browse by category */}
      <section id="services" className="wrap scroll-mt-24 py-14">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="text-3xl font-bold tracking-tight">{es ? "Todo lo demás que ofrecemos" : "Everything else we offer"}</h2>
          <Link href="/services" className="text-sm font-semibold text-brand">{es ? `Los ${SERVICES.length} servicios` : `All ${SERVICES.length} services`} →</Link>
        </div>
        {/* phones: swipe sideways; tablets and up: grid */}
        <div className="-mx-4 mt-8 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 lg:grid-cols-4">
          {cats.map((c) => (
            <div key={c.id} className="card flex w-[78%] shrink-0 snap-start flex-col sm:w-auto">
              <div className="flex items-center gap-2"><span className="text-2xl">{c.icon}</span><span className="font-semibold leading-tight">{categoryText(l, c.id, c).name}</span></div>
              {/* 3 services per card so every card matches; "+ N more" opens the rest of the group */}
              <div className="mt-3 flex-1 text-sm">
                <ul className="space-y-1.5">
                  {c.list.slice(0, 3).map((s) => (
                    <li key={s.slug}><Link href={`/services/${s.slug}`} className="text-ink-soft hover:text-brand">{s.icon} {serviceText(l, s.slug, s).name}</Link></li>
                  ))}
                </ul>
                {c.list.length > 3 && (
                  <details className="group relative mt-1.5">
                    <summary className="cursor-pointer list-none font-semibold text-brand marker:hidden [&::-webkit-details-marker]:hidden"><span className="group-open:hidden">+ {c.list.length - 3} {es ? "más" : "more"}</span><span className="hidden group-open:inline">{es ? "Mostrar menos" : "Show less"}</span></summary>
                    <ul className="mt-1.5 space-y-1.5 sm:absolute sm:inset-x-0 sm:top-full sm:z-20 sm:mt-2 sm:max-h-80 sm:overflow-y-auto sm:rounded-xl sm:border sm:border-line sm:bg-white sm:p-3 sm:shadow-xl">
                      {c.list.slice(3).map((s) => (
                        <li key={s.slug}><Link href={`/services/${s.slug}`} className="text-ink-soft hover:text-brand">{s.icon} {serviceText(l, s.slug, s).name}</Link></li>
                      ))}
                    </ul>
                  </details>
                )}
              </div>
              <div className="mt-4 flex items-center justify-between border-t border-line pt-3 text-sm">
                <span className="text-ink-soft">{c.id === "events" ? t("By budget") : l === "es" ? "Precio al instante" : "Instant upfront price"}</span>
                <Link href={`/services?cat=${c.id}`} className="font-semibold text-brand">{t("See all")} {c.all.length} →</Link>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* who we are: slogan, mission, link to About */}
      <WhoWeAre es={es} />

      {/* become a partner — Referral Partner Program */}
      <PartnerBand es={es} />

      {/* we build: intelligent websites, operating systems, automated businesses */}
      <WeBuild es={l === "es"} compact />
    </>
  );
}
