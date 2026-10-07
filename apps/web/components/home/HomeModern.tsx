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
 */
import Link from "next/link";
import { BadgeCheck, Camera, CircleDollarSign, RotateCcw, ShieldCheck, Clock3, MapPin, Check } from "lucide-react";
import { Glyph } from "@/components/Glyph";
import { BRAND, CATEGORIES, RECURRING_DISCOUNT, SERVICES, categoryText, serviceText, t as tr } from "@handled/core";
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

const TRUST = [
  { icon: ShieldCheck, text: "Insured & background-checked pros" },
  { icon: CircleDollarSign, text: "Upfront, all-in price" },
  { icon: Camera, text: "Photo-checked work" },
  { icon: RotateCcw, text: `${BRAND.guaranteeDays}-day make-it-right guarantee` },
];

const MORE = [
  { href: "/events", icon: "🎉", title: "Parties & events", body: "Planning, catering, food trucks, DJs, rentals and the venue — or plan by budget.", cta: "Plan my event" },
  { href: "/services?cat=transport", icon: "🚘", title: "Rides", body: "Black cars, airport rides, game day & concert rides, limos, party buses and shuttles.", cta: "Book a ride" },
  { href: "/business", icon: "🏢", title: "For businesses", body: "Every location, one vendor, one prepaid monthly invoice.", cta: "Commercial accounts" },
  { href: "/pros", icon: "🧰", title: "Own a crew?", body: "Prepaid jobs on your phone, weekly pay, no lead fees.", cta: "Become a pro" },
];

export async function HomeModern() {
  const l = await getLocale();
  const t = (s: string) => tr(l, s);
  const cats = CATEGORIES.map((c) => {
    const list = SERVICES.filter((s) => s.category === c.id);
    return { ...c, list };
  }).filter((c) => c.list.length);
  return (
    <>
      {/* hero — cleaning first (MARKETING_FOCUS) */}
      <section className="relative overflow-hidden">
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(60rem_30rem_at_85%_-10%,rgba(15,107,80,0.10),transparent),radial-gradient(40rem_24rem_at_-10%_10%,rgba(196,153,58,0.10),transparent)]" />
        <div className="wrap relative grid items-center gap-12 pb-14 pt-12 md:grid-cols-[1.1fr_1fr] md:pb-20 md:pt-20">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-gold/40 bg-white px-3 py-1 text-xs font-semibold text-brand-dark shadow-sm"><MapPin size={14} className="text-gold" /> {t("Launching in Metro Detroit · expanding nationwide")}</span>
            <h1 className="mt-6 text-[2.6rem] font-extrabold leading-[1.05] sm:text-6xl">
              {t("Home & office cleaning, done right.")}{" "}
              <span className="relative inline-block text-brand">{t("Handled.")}<span aria-hidden className="absolute -bottom-1 left-0 h-1.5 w-full rounded-full bg-gold/70" /></span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-ink-soft">{t("Standard, deep and move-out cleaning, carpets and windows, by insured, background-checked local cleaners. An upfront price in 60 seconds, a photo check-out after every clean, and a free redo if anything's missed.")}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/book?service=house-cleaning" className="btn-primary px-7 py-3.5 text-base shadow-lg shadow-brand/20">{t("Book a cleaning")} →</Link>
              <Link href="/business" className="btn-ghost px-6 py-3.5 text-base">{t("Office & property cleaning")}</Link>
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
                <div><div className="text-xs text-white/60">{l === "es" ? "Su trabajo" : "Your job"}</div><div className="font-display text-lg font-bold">{t("Deep clean")}</div></div>
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

      {/* cleaning services */}
      <section className="wrap -mt-2 pb-14">
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-6">
          {CLEANING.map((c) => (
            <Link key={c.href} href={c.href} className="card lift flex flex-col p-4 hover:border-gold">
              <Glyph icon={c.icon} />
              <span className="mt-3 text-sm font-semibold leading-tight sm:text-base">{t(c.title)}</span>
              <span className="mt-1 text-xs text-ink-soft">{l === "es" && c.title === "Recurring plan" ? `Misma persona, ahorre hasta ${PLAN_SAVE}%` : t(c.body)}</span>
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

      {/* browse by category */}
      <section className="wrap reveal py-16">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div><div className="eyebrow">{SERVICES.length} {l === "es" ? "servicios" : "services"}</div><h2 className="mt-2 text-3xl font-bold sm:text-4xl">{t("Everything else, handled too")}</h2></div>
          <Link href="/services" className="text-sm font-semibold text-brand">All {SERVICES.length} services →</Link>
        </div>
        {/* phones: swipe sideways; tablets and up: grid */}
        <div className="-mx-4 mt-8 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 lg:grid-cols-4">
          {cats.map((c) => (
            <div key={c.id} className="card lift flex w-[78%] shrink-0 snap-start flex-col sm:w-auto">
              <div className="flex items-center gap-3"><Glyph icon={c.icon} /><span className="font-display font-bold leading-tight">{categoryText(l, c.id, c).name}</span></div>
              <ul className="mt-3 flex-1 space-y-1.5 text-sm">
                {c.list.slice(0, 3).map((s) => (
                  <li key={s.slug}><Link href={`/services/${s.slug}`} className="flex items-center gap-2 text-ink-soft hover:text-brand"><Glyph icon={s.icon} size="sm" tone="plain" />{serviceText(l, s.slug, s).name}</Link></li>
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

      {/* why us */}
      <section className="wrap reveal py-16">
        <div className="card overflow-hidden p-0">
          <div className="grid md:grid-cols-[1fr_1.4fr]">
            <div className="bg-brand-deep p-8 text-white">
              <h2 className="text-2xl font-bold">Not a lead list. A finished job.</h2>
              <p className="mt-3 text-sm text-white/75">
                Lead sites sell your phone number to several contractors and leave the rest to you. {BRAND.name} owns the outcome: we price it, send the pro, check the work and stand behind it.
              </p>
              <Link href="/book" className="btn mt-6 bg-white text-brand-dark hover:bg-gold-light">Get my price</Link>
            </div>
            <table className="w-full text-sm">
              <thead><tr className="border-b border-line text-left text-xs uppercase tracking-wide text-ink-soft"><th className="p-4"></th><th className="p-4">Typical lead site</th><th className="p-4 text-brand">{BRAND.name}</th></tr></thead>
              <tbody>
                {COMPARE.map(([a, b]) => (
                  <tr key={a} className="border-b border-line last:border-0"><td className="p-4 font-medium">{a}</td><td className="p-4 text-ink-soft">{b}</td><td className="p-4 text-brand"><Check size={18} strokeWidth={2.5} /></td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* more from Handled */}
      <section className="wrap reveal pb-14">
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {MORE.map((m) => (
            <Link key={m.href} href={m.href} className="card lift flex flex-col p-4 hover:border-gold sm:p-5">
              <Glyph icon={m.icon} size="lg" />
              <span className="mt-3 text-base font-bold sm:text-lg">{m.title}</span>
              <span className="mt-1 hidden flex-1 text-sm text-ink-soft sm:block">{m.body}</span>
              <span className="mt-4 text-sm font-semibold text-brand">{m.cta} →</span>
            </Link>
          ))}
        </div>
      </section>

      {/* closing call to action */}
      <section className="wrap reveal pb-6">
        <div className="relative overflow-hidden rounded-3xl bg-brand-deep px-6 py-12 text-center text-white sm:px-12">
          <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(30rem_16rem_at_50%_120%,rgba(232,204,122,0.25),transparent)]" />
          <h2 className="relative text-3xl font-bold sm:text-4xl">{l === "es" ? "Su precio en 60 segundos." : "Your price in 60 seconds."} <span className="text-gold-light">{t("Handled.")}</span></h2>
          <p className="relative mx-auto mt-3 max-w-xl text-white/75">{l === "es" ? "Sin llamadas, sin visitas para cotizar, sin sorpresas." : "No calls, no estimate visits, no surprises."}</p>
          <div className="relative mt-7 flex flex-wrap justify-center gap-3">
            <Link href="/book?service=house-cleaning" className="btn bg-white px-7 py-3.5 text-base text-brand-deep hover:bg-gold-light">{t("Book a cleaning")} →</Link>
            <Link href="/services" className="btn border border-white/30 px-6 py-3.5 text-base text-white hover:border-gold-light">{t("See all")} {SERVICES.length} {l === "es" ? "servicios" : "services"}</Link>
          </div>
        </div>
      </section>
    </>
  );
}
