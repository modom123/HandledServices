/*
 * FILE    : apps/web/app/(site)/business/page.tsx
 * PROJECT : Handled — AI-run home & business services
 * CREATED : 2026-10-01_1723 UTC
 * UPDATED : 2026-10-02_0244 UTC — reorganized around business services: hero with proof points,
 *           industries we serve (each pre-fills the proposal form), services grouped by facility
 *           need, how a business account works, account features, then the proposal form.
 * PURPOSE : Commercial accounts landing page.
 * UPDATED : 2026-10-04_1934 UTC — ?lead= from the business sales email (pilot offer applied on sign-up).
 * UPDATED : 2026-10-04_1950 UTC — lists show a typical job price ("typically $X"), not the minimum (every order is different).
 * UPDATED : 2026-10-05_2034 UTC — Handled Talent (recruiting) call-out.
 * UPDATED : 2026-10-06_0802 UTC — tightened: hero leads with commercial cleaning (marketing focus; national copy since 0841), sticky
 *           jump bar (Who we serve · Services · How it works · Get a proposal), each service group shows its top 3 with
 *           "All N services" folding out (was 54 rows), compact steps, Talent call-out moved to the end.
 * UPDATED : 2026-10-06_0841 UTC — Request a proposal is a 3-step form (company → scope of work → timing) with a review
 *           screen (ProposalForm); "How it works" and the form share one 4-step process (RFP_NEXT_STEPS); beside the
 *           form, "Have these handy" so the scope is right the first time.
 * UPDATED : 2026-10-28_1800 UTC — order, don't call: businesses order online with a 25% deposit like everyone else (hero,
 *           industry cards and the closing section all lead to /book?for=business); the Request-a-proposal form, the
 *           "we call you / walk the site" steps and "Have these handy" are gone. Sales-email leads (?lead=) are carried
 *           by Attribution and marked converted when they book. Business services trimmed to 8 facility groups (top 3 each);
 *           events, websites/automation and the full list are one link away.
 * UPDATED : 2026-10-28_1746 UTC — removed the sticky "Who we serve · Services · How it works · Order now" bar (it covered the page
 *           while scrolling; the hero buttons already go to Services and Order).
 */
import Link from "next/link";
import { BUSINESS_GROUPS, INDUSTRIES, businessServices, priceHint } from "@handled/core";
import { ThemedIcon } from "@/components/Glyph";

export const metadata = { title: "For Business", description: "Cleaning, grounds, repairs, courier, transportation and corporate events for offices, retail, restaurants, clinics and property managers — one vendor, ordered online with a 25% deposit." };

const PROOF = ["One vendor, every site", "Order online, 25% to start", "Photo proof on every visit", "Backup crews built in"];
const ORDER = "/book?for=business";
// the facility needs businesses order most; events, websites/automation and everything else have their own pages
const SHOW = ["janitorial", "exterior", "maintenance", "turnovers", "cleanouts", "courier", "transport", "security"];

const STEPS = [
  { t: "Pick a service", b: "Choose it from the list below, or search. Several sites or services? Order each one — they all land on one account." },
  { t: "See your price, pay 25%", b: "Answer a few questions and get an exact price. A 25% deposit books it; the rest is charged when the work is done." },
  { t: "We do the work", b: "A vetted, insured crew on the day you chose, with before-and-after photos in your account." },
  { t: "Make it recurring", b: "Set it weekly, every 2 weeks or monthly and it books itself. Accounts with a track record can move to monthly invoicing." },
];

const FEATURES = [
  ["Every visit on record", "Each visit is time-stamped with before and after photos in your account, and your account manager sends a monthly report by location."],
  ["Insured, licensed pros", "Every pro carries general liability for their trade and is licensed where the trade requires it. Certificates of insurance on request."],
  ["Backup crews built in", "If a pro can’t make it, dispatch re-routes to the next qualified crew automatically."],
  ["After-hours & weekends", "Cleaning and maintenance scheduled around your open hours — nights, early mornings and weekends."],
  ["PO numbers & cost centers", "Invoices split by location, department or project so accounting can close the month in minutes."],
  ["One account for everything", "Every service, site and invoice in one login — no vendor juggling."],
];

export default function BusinessPage() {
  return (
    <div>
      {/* hero */}
      <section className="bg-brand-deep text-white">
        <div className="wrap grid items-center gap-8 py-10 md:grid-cols-[1.3fr_1fr] md:py-16">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-gold-light">Handled for Business</p>
            <h1 className="mt-3 text-3xl font-extrabold leading-tight tracking-tight sm:text-5xl">Commercial cleaning and facilities, one vendor.</h1>
            <p className="mt-4 max-w-xl text-lg text-white/80">Offices, property managers, clinics, retail and restaurants use one account for janitorial, move-out and turnover cleans — plus grounds, repairs, courier, transportation and events.</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href={ORDER} className="btn bg-white px-6 py-3 text-base text-brand-deep hover:bg-gold-light">Order now</Link>
              <a href="#services" className="btn border border-white/40 px-6 py-3 text-base text-white hover:bg-white/10">See business services</a>
            </div>
          </div>
          <ul className="grid grid-cols-2 gap-3">
            {PROOF.map((p) => <li key={p} className="rounded-2xl bg-white/10 p-3 text-sm font-semibold ring-1 ring-white/15 sm:p-4"><span className="text-gold-light">✓</span> {p}</li>)}
          </ul>
        </div>
      </section>

      {/* industries */}
      <section id="industries" className="wrap scroll-mt-24 py-10 sm:py-14">
        <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Who we serve</h2>
        <p className="mt-2 text-ink-soft">What businesses like yours order most — tap one to get your price and order it.</p>
        <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
          {INDUSTRIES.map((i) => (
            <div key={i.id} className="card p-3 sm:p-4">
              <div className="flex items-center gap-2 sm:block"><ThemedIcon icon={i.icon} size="md" emojiClass="text-2xl sm:text-3xl" /><span className="text-sm font-semibold leading-tight sm:mt-2 sm:block sm:text-base">{i.name}</span></div>
              <ul className="mt-2 space-y-1 text-sm">{businessServices(i.slugs).slice(0, 3).map((x) => (
                <li key={x.slug}><Link href={`/book?service=${x.slug}&for=business`} className="text-brand hover:underline">{x.name} →</Link></li>
              ))}</ul>
            </div>
          ))}
        </div>
      </section>

      {/* services by need */}
      <section id="services" className="scroll-mt-24 border-y border-line bg-paper-deep py-10 sm:py-14">
        <div className="wrap">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Business services</h2>
          <p className="mt-2 text-ink-soft">What facilities order most, as recurring visits or one-off jobs. Open any service to see what's included and order it.</p>
          <div className="mt-6 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {BUSINESS_GROUPS.filter((g) => SHOW.includes(g.id)).map((g) => {
              const list = businessServices(g.slugs);
              const row = (x: (typeof list)[number]) => (
                <li key={x.slug}>
                  <Link href={`/services/${x.slug}`} className="flex items-center justify-between gap-3 py-2 hover:text-brand">
                    <span className="inline-flex items-center gap-1.5"><ThemedIcon icon={x.icon} emojiClass="" />{x.name}</span>
                    <span className="shrink-0 text-xs text-ink-soft">{priceHint(x.slug)}</span>
                  </Link>
                </li>
              );
              return (
                <div key={g.id} className="card flex flex-col py-4">
                  <div className="flex items-center gap-2"><ThemedIcon icon={g.icon} size="md" emojiClass="text-2xl" /><h3 className="text-lg font-bold leading-tight">{g.title}</h3></div>
                  <p className="mt-1 text-sm text-ink-soft">{g.blurb}</p>
                  <ul className="mt-3 divide-y divide-line border-t border-line text-sm">{list.slice(0, 3).map(row)}</ul>
                </div>
              );
            })}
          </div>
          <p className="mt-5 text-sm text-ink-soft">Also: <Link href="/events" className="font-semibold text-brand">corporate events & catering</Link> · <Link href="/technology" className="font-semibold text-brand">websites & automation</Link> · <Link href="/services" className="font-semibold text-brand">every service</Link></p>
        </div>
      </section>

      {/* how it works */}
      <section id="how" className="wrap scroll-mt-24 py-10 sm:py-14">
        <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">How it works</h2>
        <p className="mt-2 text-ink-soft">Ordered online in a few minutes, on the schedule you pick.</p>
        <ol className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s, i) => (
            <li key={s.t} className="card flex gap-3 py-4 lg:block">
              <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand-deep text-sm font-bold text-white">{i + 1}</div>
              <div><div className="font-semibold lg:mt-3">{s.t}</div><p className="mt-1 text-sm text-ink-soft">{s.b}</p></div>
            </li>
          ))}
        </ol>
      </section>

      {/* order */}
      <section id="order" className="scroll-mt-24 border-t border-line bg-paper-deep py-10 sm:py-14">
        <div className="wrap grid gap-10 lg:grid-cols-[1.15fr_1fr]">
          <div>
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Order for your business</h2>
            <p className="mt-2 text-ink-soft">Pick the service, get your exact price in about a minute and pay a 25% deposit to book it. Your order starts as a business order — just add your company name.</p>
            <Link href={ORDER} className="btn-primary mt-5 inline-block px-8 py-3 text-base">Order now</Link>
          </div>
          <div>
            <div className="font-semibold">Built for facilities teams</div>
            <div className="mt-3 space-y-2">
              {FEATURES.map(([t, b]) => (
                <div key={t} className="flex gap-3"><span className="mt-0.5 text-brand">✓</span><div><div className="font-semibold">{t}</div><p className="hidden text-sm text-ink-soft sm:block">{b}</p></div></div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="wrap py-8">
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
          <div><b>🤝 Hiring? Handled Talent recruits for you.</b> <span className="text-ink-soft">Contingency search: 25% of first-year base salary, only if you hire. 90-day guarantee.</span></div>
          <Link href="/talent" className="btn-ghost">Start a search</Link>
        </div>
      </section>
    </div>
  );
}
