/*
 * FILE    : apps/web/app/(site)/business/page.tsx
 * PROJECT : Handled — AI-run home & business services
 * CREATED : 2026-10-01_1723 UTC
 * UPDATED : 2026-10-02_0244 UTC — reorganized around business services: hero with proof points,
 *           industries we serve (each pre-fills the proposal form), services grouped by facility
 *           need, how a business account works, account features, then the proposal form.
 * PURPOSE : Commercial accounts landing page.
 * UPDATED : 2026-10-04_1934 UTC — ?lead= from the business sales email (pilot offer applied on sign-up).
 */
import Link from "next/link";
import { BUSINESS_GROUPS, INDUSTRIES, businessServices, money } from "@handled/core";
import { BusinessForm } from "@/components/forms";

export const metadata = { title: "For Business", description: "Cleaning, grounds, repairs, courier, transportation and corporate events for offices, retail, restaurants, clinics and property managers — one vendor, one prepaid monthly invoice." };

const PROOF = ["One vendor, every site", "Prepaid monthly invoice", "Photo proof on every visit", "Backup crews built in"];

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
        <div className="wrap grid items-center gap-10 py-14 md:grid-cols-[1.3fr_1fr] md:py-20">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-mint">Handled for Business</p>
            <h1 className="mt-3 text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">Facilities services without the vendor juggling.</h1>
            <p className="mt-5 max-w-xl text-lg text-white/80">Offices, retail, restaurants, clinics, property managers and HOAs use one account for cleaning, grounds, repairs, courier runs, corporate transportation and events.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a href="#quote" className="btn bg-white px-6 py-3 text-base text-brand-deep hover:bg-mint">Request a proposal</a>
              <a href="#services" className="btn border border-white/40 px-6 py-3 text-base text-white hover:bg-white/10">See business services</a>
            </div>
          </div>
          <ul className="grid grid-cols-2 gap-3">
            {PROOF.map((p) => <li key={p} className="rounded-2xl bg-white/10 p-4 text-sm font-semibold ring-1 ring-white/15"><span className="text-mint">✓</span> {p}</li>)}
          </ul>
        </div>
      </section>

      {/* industries */}
      <section className="wrap py-14">
        <h2 className="text-3xl font-bold tracking-tight">Who we serve</h2>
        <p className="mt-2 text-ink-soft">Pick your industry and we’ll pre-fill the services businesses like yours book most.</p>
        <div className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-4">
          {INDUSTRIES.map((i) => (
            <Link key={i.id} href={`/business?for=${i.id}#quote`} scroll={false} className={`card flex flex-col p-4 transition hover:border-brand ${industry === i.id ? "border-brand bg-brand-tint" : ""}`}>
              <span className="text-3xl">{i.icon}</span>
              <span className="mt-2 font-semibold leading-tight">{i.name}</span>
              <span className="mt-1 hidden text-sm text-ink-soft sm:block">{businessServices(i.slugs).slice(0, 3).map((s) => s.name).join(" · ")}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* services by need */}
      <section id="services" className="scroll-mt-20 border-y border-line bg-paper-deep py-14">
        <div className="wrap">
          <h2 className="text-3xl font-bold tracking-tight">Business services</h2>
          <p className="mt-2 text-ink-soft">Recurring contracts or one-off projects. Every service runs on the same account and invoice.</p>
          <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {BUSINESS_GROUPS.map((g) => (
              <div key={g.id} className="card flex flex-col">
                <div className="flex items-center gap-2"><span className="text-2xl">{g.icon}</span><h3 className="text-lg font-bold leading-tight">{g.title}</h3></div>
                <p className="mt-2 text-sm text-ink-soft">{g.blurb}</p>
                <ul className="mt-4 flex-1 divide-y divide-line border-t border-line text-sm">
                  {businessServices(g.slugs).map((s) => (
                    <li key={s.slug}>
                      <Link href={`/services/${s.slug}`} className="flex items-center justify-between gap-3 py-2 hover:text-brand">
                        <span>{s.icon} {s.name}</span>
                        <span className="shrink-0 text-xs text-ink-soft">{s.category === "events" ? "by quote" : `from ${money(s.minimum)}`}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* how it works */}
      <section className="wrap py-14">
        <h2 className="text-3xl font-bold tracking-tight">How a business account works</h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s) => (
            <div key={s.n} className="card">
              <div className="grid h-9 w-9 place-items-center rounded-full bg-brand-deep text-sm font-bold text-white">{s.n}</div>
              <div className="mt-4 font-semibold">{s.t}</div>
              <p className="mt-2 text-sm text-ink-soft">{s.b}</p>
            </div>
          ))}
        </div>
      </section>

      {/* features + form */}
      <section id="quote" className="scroll-mt-20 border-t border-line bg-paper-deep py-14">
        <div className="wrap grid gap-10 lg:grid-cols-[1fr_1.15fr]">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Built for facilities teams</h2>
            <div className="mt-6 space-y-4">
              {FEATURES.map(([t, b]) => (
                <div key={t} className="flex gap-3"><span className="mt-0.5 text-brand">✓</span><div><div className="font-semibold">{t}</div><p className="text-sm text-ink-soft">{b}</p></div></div>
              ))}
            </div>
          </div>
          <BusinessForm key={industry ?? ""} industry={industry ?? ""} lead={lead && /^[a-z0-9]{8,40}$/.test(lead) ? lead : null} />
        </div>
      </section>
    </div>
  );
}
