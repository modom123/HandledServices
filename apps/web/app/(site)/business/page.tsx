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
 * UPDATED : 2026-10-06_0802 UTC — tightened: hero leads with commercial cleaning in Metro Detroit (marketing focus), sticky
 *           jump bar (Who we serve · Services · How it works · Get a proposal), each service group shows its top 3 with
 *           "All N services" folding out (was 54 rows), compact steps, Talent call-out moved to the end.
 */
import Link from "next/link";
import { BUSINESS_GROUPS, INDUSTRIES, businessServices, priceHint } from "@handled/core";
import { BusinessForm } from "@/components/forms";

export const metadata = { title: "For Business", description: "Cleaning, grounds, repairs, courier, transportation and corporate events for offices, retail, restaurants, clinics and property managers — one vendor, one prepaid monthly invoice." };

const PROOF = ["One vendor, every site", "Prepaid monthly invoice", "Photo proof on every visit", "Backup crews built in"];
const JUMP: [string, string][] = [["industries", "Who we serve"], ["services", "Services"], ["how", "How it works"], ["quote", "Get a proposal"]];

const STEPS = [
  { n: "1", t: "Free walkthrough", b: "Tell us your sites and needs, or we walk them with you. We map every recurring task and one-off project." },
  { n: "2", t: "One plan, one price per site", b: "A clear proposal by location and service — no hourly surprises. Approve it once." },
  { n: "3", t: "We run the schedule", b: "Vetted, insured crews show up on schedule. Every visit is time-stamped with photos." },
  { n: "4", t: "One monthly invoice", b: "Prepaid by card or ACH, with PO numbers and cost centers per location." },
];

const FEATURES = [
  ["Every visit on record", "Each visit is time-stamped with before and after photos in your account, and your account manager sends a monthly report by location."],
  ["Insured, licensed pros", "Every pro carries general liability for their trade and is licensed where the trade requires it. Certificates of insurance on request."],
  ["Backup crews built in", "If a pro can’t make it, dispatch re-routes to the next qualified crew automatically."],
  ["After-hours & weekends", "Cleaning and maintenance scheduled around your open hours — nights, early mornings and weekends."],
  ["PO numbers & cost centers", "Invoices split by location, department or project so accounting can close the month in minutes."],
  ["One point of contact", "One account team and one number for every service — no vendor juggling."],
];

export default async function BusinessPage({ searchParams }: { searchParams: Promise<{ for?: string; lead?: string }> }) {
  const { for: industry, lead } = await searchParams;
  return (
    <div>
      {/* hero */}
      <section className="bg-brand-deep text-white">
        <div className="wrap grid items-center gap-8 py-10 md:grid-cols-[1.3fr_1fr] md:py-16">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-mint">Handled for Business</p>
            <h1 className="mt-3 text-3xl font-extrabold leading-tight tracking-tight sm:text-5xl">Commercial cleaning and facilities, one vendor.</h1>
            <p className="mt-4 max-w-xl text-lg text-white/80">Offices, property managers, clinics, retail and restaurants across Metro Detroit use one account for janitorial, move-out and turnover cleans — plus grounds, repairs, courier, transportation and events.</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <a href="#quote" className="btn bg-white px-6 py-3 text-base text-brand-deep hover:bg-mint">Request a proposal</a>
              <a href="#services" className="btn border border-white/40 px-6 py-3 text-base text-white hover:bg-white/10">See business services</a>
            </div>
          </div>
          <ul className="grid grid-cols-2 gap-3">
            {PROOF.map((p) => <li key={p} className="rounded-2xl bg-white/10 p-3 text-sm font-semibold ring-1 ring-white/15 sm:p-4"><span className="text-mint">✓</span> {p}</li>)}
          </ul>
        </div>
      </section>

      <nav aria-label="On this page" className="sticky top-16 z-20 overflow-x-auto border-b border-line bg-paper/95 backdrop-blur">
        <div className="wrap flex min-w-max items-center gap-1 py-2 text-sm font-semibold">
          {JUMP.map(([id, label]) => <a key={id} href={`#${id}`} className={id === "quote" ? "ml-1 rounded-full bg-brand px-4 py-1.5 text-white" : "rounded-full px-3 py-1.5 text-ink hover:bg-white"}>{label}</a>)}
        </div>
      </nav>

      {/* industries */}
      <section id="industries" className="wrap scroll-mt-32 py-10 sm:py-14">
        <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Who we serve</h2>
        <p className="mt-2 text-ink-soft">Pick your industry and we’ll pre-fill the services businesses like yours book most.</p>
        <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
          {INDUSTRIES.map((i) => (
            <Link key={i.id} href={`/business?for=${i.id}#quote`} scroll={false} className={`card flex items-center gap-2 p-3 transition sm:flex-col sm:items-start sm:gap-0 sm:p-4 hover:border-brand ${industry === i.id ? "border-brand bg-brand-tint" : ""}`}>
              <span className="text-2xl sm:text-3xl">{i.icon}</span>
              <span className="text-sm font-semibold leading-tight sm:mt-2 sm:text-base">{i.name}</span>
              <span className="mt-1 hidden text-sm text-ink-soft sm:block">{businessServices(i.slugs).slice(0, 3).map((s) => s.name).join(" · ")}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* services by need */}
      <section id="services" className="scroll-mt-32 border-y border-line bg-paper-deep py-10 sm:py-14">
        <div className="wrap">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Business services</h2>
          <p className="mt-2 text-ink-soft">Recurring contracts or one-off projects, all on one account and one invoice.</p>
          <div className="mt-6 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {BUSINESS_GROUPS.map((g) => {
              const list = businessServices(g.slugs);
              const row = (x: (typeof list)[number]) => (
                <li key={x.slug}>
                  <Link href={`/services/${x.slug}`} className="flex items-center justify-between gap-3 py-2 hover:text-brand">
                    <span>{x.icon} {x.name}</span>
                    <span className="shrink-0 text-xs text-ink-soft">{x.category === "events" ? "by quote" : priceHint(x.slug)}</span>
                  </Link>
                </li>
              );
              return (
                <div key={g.id} className="card flex flex-col py-4">
                  <div className="flex items-center gap-2"><span className="text-2xl">{g.icon}</span><h3 className="text-lg font-bold leading-tight">{g.title}</h3></div>
                  <p className="mt-1 text-sm text-ink-soft">{g.blurb}</p>
                  <ul className="mt-3 divide-y divide-line border-t border-line text-sm">{list.slice(0, 3).map(row)}</ul>
                  {list.length > 3 && (
                    <details className="text-sm">
                      <summary className="cursor-pointer border-t border-line py-2 font-semibold text-brand">All {list.length} services</summary>
                      <ul className="divide-y divide-line border-t border-line">{list.slice(3).map(row)}</ul>
                    </details>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* how it works */}
      <section id="how" className="wrap scroll-mt-32 py-10 sm:py-14">
        <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">How a business account works</h2>
        <ol className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s) => (
            <li key={s.n} className="card flex gap-3 py-4 lg:block">
              <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand-deep text-sm font-bold text-white">{s.n}</div>
              <div><div className="font-semibold lg:mt-3">{s.t}</div><p className="mt-1 text-sm text-ink-soft">{s.b}</p></div>
            </li>
          ))}
        </ol>
      </section>

      {/* features + form */}
      <section id="quote" className="scroll-mt-32 border-t border-line bg-paper-deep py-10 sm:py-14">
        <div className="wrap grid gap-10 lg:grid-cols-[1fr_1.15fr]">
          <div>
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Built for facilities teams</h2>
            <div className="mt-5 space-y-2 sm:space-y-4">
              {FEATURES.map(([t, b]) => (
                <div key={t} className="flex gap-3"><span className="mt-0.5 text-brand">✓</span><div><div className="font-semibold">{t}</div><p className="hidden text-sm text-ink-soft sm:block">{b}</p></div></div>
              ))}
            </div>
          </div>
          <BusinessForm key={industry ?? ""} industry={industry ?? ""} lead={lead && /^[a-z0-9]{8,40}$/.test(lead) ? lead : null} />
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
