/*
 * FILE    : apps/web/components/home/HomeModern.tsx
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
 * UPDATED : 2026-10-07_0225 UTC — modern look: line icons instead of emoji (Glyph), bigger display headline with a gold
 *           underline, a live-job "tracker" card in the hero (shows how it works instead of a stock photo), icon trust strip,
 *           connected how-it-works steps, soft shadows and hover lift, closing call-to-action band. Same content and links.
 * UPDATED : 2026-10-07_0235 UTC — moved here: the home layout for the Modern look (lib/theme.ts).
 * UPDATED : 2026-10-11_2307 UTC — "We build" band: intelligent websites, business operating systems, automated businesses.
 * UPDATED : 2026-10-23_0430 UTC — the hero no longer leads with cleaning: it offers our 4 most popular services as big
 *           buttons (lib/popular.ts: approved pros who cover them + what people order), then "Everything else we offer",
 *           which now lists every other service in each category (none hidden), and a "Become a partner" band.
 * UPDATED : 2026-10-23_1430 UTC — four big doors under the hero (components/home/HomeDoors): Services, Become a Pro (application),
 *           Become a Partner (sign-up) and Handled Network (/network); each opens its page.
 * UPDATED : 2026-10-23_1030 UTC — category cards show 3 services each (uniform cards); "+ N more" opens the rest of that
 *           group in a dropdown over the page, so the cards keep their size; on
 *           phones (swipe row) it opens inside the card (native <details>, no script).
 * UPDATED : 2026-10-27_1500 UTC — cleanup: "Why it works" for customers and pros (replaces the comparison table), a "Who we
 *           are" strip (slogan + mission → /about); the "More from Handled" tiles are gone (the side menu has them).
 */
import Link from "next/link";
import { BadgeCheck, Camera, CircleDollarSign, RotateCcw, ShieldCheck, Clock3, MapPin, Check } from "lucide-react";
import { Glyph } from "@/components/Glyph";
import { BRAND, CATEGORIES, SERVICES, categoryText, serviceText, t as tr } from "@handled/core";
import { getLocale } from "@/lib/locale";
import { popularServices } from "@/lib/popular";
import { WeBuild } from "@/components/home/WeBuild";
import { PartnerBand } from "@/components/home/PartnerBand";
import { HomeDoors } from "@/components/home/HomeDoors";
import { WhyItWorks } from "@/components/home/WhyItWorks";
import { WhoWeAre } from "@/components/home/WhoWeAre";

const STEPS = [
  { n: "1", title: "Get a real price in 60 seconds", body: "Answer a few questions or snap photos. Our AI checks the details and gives you an upfront price — not a callback." },
  { n: "2", title: "We send one vetted pro", body: "Insured, background-checked and rated. We pick the best available pro for your job, date and neighborhood." },
  { n: "3", title: "Track it like a delivery", body: "Live status, messages and before/after photos in the app. If it isn’t right, we come back free or refund you." },
];



const TRUST = [
  { icon: ShieldCheck, text: "Insured & background-checked pros" },
  { icon: CircleDollarSign, text: "Upfront, all-in price" },
  { icon: Camera, text: "Photo-checked work" },
  { icon: RotateCcw, text: `${BRAND.guaranteeDays}-day make-it-right guarantee` },
];


export async function HomeModern() {
  const l = await getLocale();
  const t = (s: string) => tr(l, s);
  const es = l === "es";
  const top = await popularServices(4);
  const topSlugs = new Set(top.map((s) => s.slug));
  const cats = CATEGORIES.map((c) => {
    const all = SERVICES.filter((s) => s.category === c.id);
    return { ...c, all, list: all.filter((s) => !topSlugs.has(s.slug)) }; // every service not already in Most popular
  }).filter((c) => c.list.length);
  return (
    <>
      {/* hero — every service; the 4 most popular sit right under it (lib/popular.ts) */}
      <section className="relative overflow-hidden">
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(60rem_30rem_at_85%_-10%,rgba(15,107,80,0.10),transparent),radial-gradient(40rem_24rem_at_-10%_10%,rgba(196,153,58,0.10),transparent)]" />
        <div className="wrap relative grid items-center gap-12 pb-14 pt-12 md:grid-cols-[1.1fr_1fr] md:pb-20 md:pt-20">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-gold/40 bg-white px-3 py-1 text-xs font-semibold text-brand-dark shadow-sm"><MapPin size={14} className="text-gold" /> {t("Launching in Metro Detroit · expanding nationwide")}</span>
            <h1 className="mt-6 text-[2.6rem] font-extrabold leading-[1.05] sm:text-6xl">
              {es ? "Servicios para hogar y negocio." : "Home & business services."}{" "}
              <span className="relative inline-block text-brand">{t("Handled.")}<span aria-hidden className="absolute -bottom-1 left-0 h-1.5 w-full rounded-full bg-gold/70" /></span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-ink-soft">{es ? "Profesionales asegurados y verificados, un precio fijo en 60 segundos, fotos al terminar y lo rehacemos gratis si algo falta. Empiece con lo más pedido o vea todo lo que ofrecemos." : "Insured, background-checked local pros, an upfront price in 60 seconds, a photo check-out after every job, and a free redo if anything's missed. Start with what's most popular, or see everything we offer."}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/book" className="btn-primary px-7 py-3.5 text-base shadow-lg shadow-brand/20">{t("Get my price")} →</Link>
              <Link href="/services" className="btn-ghost px-6 py-3.5 text-base">{t("See all")} {SERVICES.length} {es ? "servicios" : "services"}</Link>
            </div>
            <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-ink-soft">
              {TRUST.slice(0, 3).map((x) => <span key={x.text} className="inline-flex items-center gap-1.5"><x.icon size={16} className="text-brand" />{t(x.text)}</span>)}
            </div>
          </div>
          {/* live job tracker: shows the product instead of a stock photo */}
          <div className="relative mx-auto w-full max-w-md">
            <div aria-hidden className="absolute -inset-4 -z-10 rounded-[2rem] bg-gradient-to-br from-brand/15 via-transparent to-gold/20 blur-2xl" />
            <div className="card p-0">
              <div className="flex items-center justify-between rounded-t-2xl bg-brand-deep px-5 py-4 text-white">
                <div><div className="text-xs text-white/60">{l === "es" ? "Su trabajo" : "Your job"}</div><div className="font-display text-lg font-bold">{top[0] ? serviceText(l, top[0].slug, top[0]).name : t("Deep clean")}</div></div>
                <span className="rounded-full bg-gold/20 px-3 py-1 text-xs font-semibold text-gold-light ring-1 ring-gold/40">{l === "es" ? "Precio fijo" : "Upfront price"}</span>
              </div>
              <ol className="space-y-4 p-5">
                {[
                  { icon: CircleDollarSign, t: l === "es" ? "Precio al instante" : "Instant price", d: l === "es" ? "Sin llamadas ni visitas" : "No calls, no visits", done: true },
                  { icon: BadgeCheck, t: l === "es" ? "Profesional asignado" : "Pro assigned", d: l === "es" ? "Asegurado y verificado" : "Insured & background-checked", done: true },
                  { icon: Clock3, t: l === "es" ? "En camino" : "On the way", d: l === "es" ? "Siga el estado en vivo" : "Live status & messages", done: true },
                  { icon: Camera, t: l === "es" ? "Fotos al terminar" : "Photo check-out", d: l === "es" ? "Revisamos el trabajo" : "We check the work", done: false },
                ].map((x, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${x.done ? "bg-brand text-white" : "border-2 border-dashed border-gold text-gold-dark"}`}>{x.done ? <Check size={18} strokeWidth={2.5} /> : <x.icon size={17} />}</span>
                    <div><div className="font-semibold">{x.t}</div><div className="text-sm text-ink-soft">{x.d}</div></div>
                  </li>
                ))}
              </ol>
              <div className="flex items-center justify-between border-t border-line px-5 py-3 text-sm"><span className="text-ink-soft">{l === "es" ? "Garantía" : "Guarantee"}</span><span className="font-semibold text-brand">{BRAND.guaranteeDays}-{l === "es" ? "días, rehacemos gratis" : "day free redo"}</span></div>
            </div>
          </div>
        </div>
      </section>

      {/* four doors: services, become a pro, become a partner, Handled Network */}
      <HomeDoors es={es} servicesCount={SERVICES.length} />

      {/* most popular services: approved pros who cover them + what people order (lib/popular.ts) */}
      <section className="wrap -mt-2 pb-14">
        <div className="eyebrow">{es ? "Lo más popular" : "Most popular"}</div>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {top.map((s) => (
            <Link key={s.slug} href={`/book?service=${s.slug}`} className="card lift flex flex-col p-5 hover:border-gold">
              <Glyph icon={s.icon} size="lg" />
              <span className="mt-3 text-base font-bold leading-tight sm:text-lg">{serviceText(l, s.slug, s).name}</span>
              <span className="mt-1 flex-1 text-xs text-ink-soft sm:text-sm">{serviceText(l, s.slug, s).tagline}</span>
              <span className="mt-3 text-sm font-semibold text-brand">{es ? "Reservar" : "Book now"} →</span>
            </Link>
          ))}
        </div>
      </section>

      {/* trust strip */}
      <section className="border-y border-line bg-paper">
        <div className="wrap grid grid-cols-2 gap-4 py-6 text-sm font-medium md:grid-cols-4">
          {TRUST.map((x) => <div key={x.text} className="flex items-center gap-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white text-gold-dark ring-1 ring-gold/30"><x.icon size={18} /></span>{t(x.text)}</div>)}
        </div>
      </section>

      {/* why it works: what customers get, what pros get, and the model */}
      <WhyItWorks es={es} />

      {/* browse by category */}
      <section id="services" className="wrap reveal scroll-mt-24 py-16">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div><div className="eyebrow">{SERVICES.length} {l === "es" ? "servicios" : "services"}</div><h2 className="mt-2 text-3xl font-bold sm:text-4xl">{es ? "Todo lo demás que ofrecemos" : "Everything else we offer"}</h2></div>
          <Link href="/services" className="text-sm font-semibold text-brand">{es ? `Los ${SERVICES.length} servicios` : `All ${SERVICES.length} services`} →</Link>
        </div>
        {/* phones: swipe sideways; tablets and up: grid */}
        <div className="-mx-4 mt-8 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 lg:grid-cols-4">
          {cats.map((c) => (
            <div key={c.id} className="card lift flex w-[78%] shrink-0 snap-start flex-col sm:w-auto">
              <div className="flex items-center gap-3"><Glyph icon={c.icon} /><span className="font-display font-bold leading-tight">{categoryText(l, c.id, c).name}</span></div>
              {/* 3 services per card so every card matches; "+ N more" opens the rest of the group */}
              <div className="mt-3 flex-1 text-sm">
                <ul className="space-y-1.5">
                  {c.list.slice(0, 3).map((s) => (
                    <li key={s.slug}><Link href={`/services/${s.slug}`} className="flex items-center gap-2 text-ink-soft hover:text-brand"><Glyph icon={s.icon} size="sm" tone="plain" />{serviceText(l, s.slug, s).name}</Link></li>
                  ))}
                </ul>
                {c.list.length > 3 && (
                  <details className="group relative mt-1.5">
                    <summary className="cursor-pointer list-none font-semibold text-brand marker:hidden [&::-webkit-details-marker]:hidden"><span className="group-open:hidden">+ {c.list.length - 3} {es ? "más" : "more"}</span><span className="hidden group-open:inline">{es ? "Mostrar menos" : "Show less"}</span></summary>
                    <ul className="mt-1.5 space-y-1.5 sm:absolute sm:inset-x-0 sm:top-full sm:z-20 sm:mt-2 sm:max-h-80 sm:overflow-y-auto sm:rounded-xl sm:border sm:border-line sm:bg-white sm:p-3 sm:shadow-xl">
                      {c.list.slice(3).map((s) => (
                        <li key={s.slug}><Link href={`/services/${s.slug}`} className="flex items-center gap-2 text-ink-soft hover:text-brand"><Glyph icon={s.icon} size="sm" tone="plain" />{serviceText(l, s.slug, s).name}</Link></li>
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

      {/* how it works */}
      <WeBuild es={l === "es"} compact />

      <section className="reveal border-y border-line bg-paper py-16">
        <div className="wrap">
          <div className="eyebrow">{l === "es" ? "Simple" : "Simple"}</div>
          <h2 className="mt-2 text-3xl font-bold sm:text-4xl">{t("How it works")}</h2>
          <div className="relative mt-10 grid gap-6 md:grid-cols-3">
            <div aria-hidden className="absolute left-0 right-0 top-[2.1rem] hidden h-px bg-gradient-to-r from-transparent via-gold/60 to-transparent md:block" />
            {STEPS.map((s) => (
              <div key={s.n} className="card relative">
                <div className="grid h-11 w-11 place-items-center rounded-full bg-brand-deep font-display text-base font-bold text-gold-light ring-4 ring-paper">{s.n}</div>
                <div className="mt-4 font-semibold">{t(s.title)}</div>
                <p className="mt-2 text-sm text-ink-soft">{t(s.body)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* who we are: slogan, mission, link to About */}
      <WhoWeAre es={es} />

      {/* become a partner — Referral Partner Program */}
      <PartnerBand es={es} />

      {/* closing call to action */}
      <section className="wrap reveal pb-6">
        <div className="relative overflow-hidden rounded-3xl bg-brand-deep px-6 py-12 text-center text-white sm:px-12">
          <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(30rem_16rem_at_50%_120%,rgba(232,204,122,0.25),transparent)]" />
          <h2 className="relative text-3xl font-bold sm:text-4xl">{l === "es" ? "Su precio en 60 segundos." : "Your price in 60 seconds."} <span className="text-gold-light">{t("Handled.")}</span></h2>
          <p className="relative mx-auto mt-3 max-w-xl text-white/75">{l === "es" ? "Sin llamadas, sin visitas para cotizar, sin sorpresas." : "No calls, no estimate visits, no surprises."}</p>
          <div className="relative mt-7 flex flex-wrap justify-center gap-3">
            <Link href="/book" className="btn bg-white px-7 py-3.5 text-base text-brand-deep hover:bg-gold-light">{t("Get my price")} →</Link>
            <Link href="/services" className="btn border border-white/30 px-6 py-3.5 text-base text-white hover:border-gold-light">{t("See all")} {SERVICES.length} {l === "es" ? "servicios" : "services"}</Link>
          </div>
        </div>
      </section>
    </>
  );
}
