/*
 * FILE    : apps/web/app/(site)/pros/page.tsx
 * PROJECT : Handled — AI-run home & business services
 * CREATED : 2026-10-01_1723 UTC
 * UPDATED : 2026-10-01_2109 UTC — The Handled Pro Program: promises, real payouts from the
 *           pricing engine, tiers, how we compare, the vetting process and requirements
 *           by trade (license, insurance, skills check).
 * PURPOSE : Subcontractor recruiting page + application.
 */
import { ApplyForm } from "@/components/forms";
import { getPolicy } from "@/lib/pro-benefits";
import { BRAND, COVERAGES, PRO_PROMISES, benefitLines, ruleText, PRO_REFERRAL, PRO_TIERS, TRADES, TRADE_PROFILES, VETTING_STEPS, money, samplePayouts } from "@handled/core";

export const metadata = { title: "Become a Pro", description: "Prepaid, pre-priced jobs in your area. No lead fees, weekly pay, and we run the office." };

const SAMPLES = ["house-cleaning", "lawn-care", "junk-removal", "handyman", "gutter-cleaning", "carpet-cleaning", "dog-walking", "water-heater", "snow-removal", "tree-removal"];

const COMPARE: [string, string, string, string][] = [
  ["What it costs you", "Nothing to join. We keep a share of each finished job.", "You pay for leads, whether you win the job or not.", "A monthly software subscription."],
  ["Who finds the customer", "We do, and the job is already sold.", "You compete with other pros for each lead.", "You do: your own marketing."],
  ["Price", "Set upfront. You see your payout before you accept.", "You quote, chase and negotiate.", "You quote."],
  ["Getting paid", "The customer prepays us; you're paid weekly.", "You invoice and collect.", "You invoice and collect."],
  ["Office work", "Scheduling, reminders, support and reviews handled.", "Yours.", "Yours, with better tools."],
  ["Unhappy customer", "Our team handles it with you.", "Yours.", "Yours."],
];

export const revalidate = 300;

export default async function ProsPage() {
  const pays = samplePayouts(SAMPLES);
  const policy = await getPolicy().catch(() => null);
  return (
    <div className="wrap space-y-16 py-14">
      <section className="grid gap-10 lg:grid-cols-2 lg:items-center">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-brand">The {BRAND.name} Pro Program</p>
          <h1 className="mt-2 text-4xl font-extrabold tracking-tight">Do the work you’re great at. We fill your calendar and you never chase a payment.</h1>
          <p className="mt-4 text-lg text-ink-soft">Prepaid, pre-priced jobs in your area and your specialties. No lead fees, no bidding, no invoices. Accept a job like you’d accept a ride.</p>
          <a href="#apply" className="btn-primary mt-6 inline-block px-6">Apply in 5 minutes</a>
        </div>
        <div className="card">
          <div className="text-sm font-semibold">What pros earn per job</div>
          <p className="text-xs text-ink-soft">Typical job size, from our live pricing. Higher tiers earn up to the higher number.</p>
          <table className="mt-3 w-full text-sm">
            <tbody>
              {pays.map((p) => (
                <tr key={p.slug} className="border-t border-line"><td className="py-2">{p.icon} {p.name}</td><td className="py-2 text-right font-semibold text-brand">{p.label}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="text-2xl font-bold">Our promises to pros</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {PRO_PROMISES.map((p) => (
            <div key={p.t} className="card"><div className="font-semibold">✓ {p.t}</div><p className="mt-1 text-sm text-ink-soft">{p.b}</p></div>
          ))}
        </div>
      </section>

      {policy && (
        <section>
          <h2 className="text-2xl font-bold">Benefits that protect your pay</h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {benefitLines(policy).filter((b) => b.rule.enabled).map((b) => (
              <div key={b.key} className="card"><div className="font-semibold">🛡️ {b.title}</div><p className="mt-1 text-sm text-ink-soft">{b.body}</p><p className="mt-2 text-xs text-brand-dark">{ruleText(b.rule)}</p></div>
            ))}
          </div>
          {policy.insurance.partners.some((x) => x.url || x.phone) && (
            <p className="mt-4 text-sm text-ink-soft">Need insurance? {policy.insurance.partners.filter((x) => x.url || x.phone).map((x) => `${x.name}${x.phone ? ` (${x.phone})` : ""}${x.code ? `, code ${x.code}` : ""}`).join(" · ")}</p>
          )}
        </section>
      )}

      <section>
        <h2 className="text-2xl font-bold">Grow with us: Pro, Pro+ and Elite</h2>
        <p className="mt-2 text-ink-soft">Tiers are earned from your real numbers (jobs, rating, on time, offers accepted) and update automatically.</p>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {PRO_TIERS.map((t) => (
            <div key={t.id} className={`card ${t.id === "elite" ? "border-brand bg-brand-tint" : ""}`}>
              <div className="text-lg font-bold">{t.badge} {t.name}</div>
              <div className="text-xs text-ink-soft">{t.min.jobs ? `${t.min.jobs}+ jobs · ${t.min.rating}★+ · ${Math.round(t.min.onTime * 100)}% on time · ${Math.round(t.min.acceptance * 100)}% accepted` : "Once you’re activated"}</div>
              <ul className="mt-3 space-y-1 text-sm">{t.perks.map((p) => <li key={p}>✓ {p}</li>)}</ul>
            </div>
          ))}
        </div>
        <p className="mt-4 text-sm text-ink-soft">Refer a great pro and earn {money(PRO_REFERRAL.bonus)} when they finish their {PRO_REFERRAL.afterJobs}th job.</p>
      </section>

      <section>
        <h2 className="text-2xl font-bold">How we’re different</h2>
        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead><tr className="text-left"><th className="p-3"></th><th className="p-3 text-brand">{BRAND.name}</th><th className="p-3">Lead sites (Angi, Thumbtack)</th><th className="p-3">Field-service software (ServiceTitan)</th></tr></thead>
            <tbody>
              {COMPARE.map(([row, us, leads, soft]) => (
                <tr key={row} className="border-t border-line align-top"><td className="p-3 font-semibold">{row}</td><td className="bg-brand-tint p-3">{us}</td><td className="p-3 text-ink-soft">{leads}</td><td className="p-3 text-ink-soft">{soft}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid gap-10 lg:grid-cols-2">
        <div>
          <h2 className="text-2xl font-bold">How we vet, and why it matters to you</h2>
          <p className="mt-2 text-ink-soft">Customers book us because every pro is checked. That’s what keeps the work coming.</p>
          <ol className="mt-6 space-y-4">
            {VETTING_STEPS.map((s, i) => (
              <li key={s.t} className="flex gap-3"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand text-sm font-bold text-white">{i + 1}</span><div><div className="font-semibold">{s.t}</div><div className="text-sm text-ink-soft">{s.b}</div></div></li>
            ))}
          </ol>
        </div>
        <div>
          <h2 className="text-2xl font-bold">Requirements by trade</h2>
          <p className="mt-2 text-sm text-ink-soft">Everyone needs a background check, a W-9, a smartphone and general liability insurance naming {BRAND.name} as additional insured. Workers’ comp is required if you have employees; solo owners sign a no-employees statement.</p>
          <div className="mt-4 space-y-2">
            {TRADES.map((t) => {
              const p = TRADE_PROFILES[t.id];
              if (!p) return null;
              return (
                <details key={t.id} className="card py-3">
                  <summary className="cursor-pointer font-semibold">{t.label}</summary>
                  <p className="mt-2 text-sm text-ink-soft">{p.does}</p>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                    <li>General liability: {money(p.glMin)} per occurrence{p.requires.length ? `, plus ${p.requires.map((k) => COVERAGES[k].label.toLowerCase()).join(" and ")}` : ""}</li>
                    {p.conditional.map((c) => <li key={c.key}>{COVERAGES[c.key].label} when {c.when}</li>)}
                    <li>License: {p.license ?? "none required by the state"}</li>
                    {p.preferred.length > 0 && <li>Preferred: {p.preferred.join("; ")}</li>}
                    <li>Skills check: {p.skillsCheck}</li>
                    <li>Specialties: {p.specialties.map((s) => s.label).join(", ")}</li>
                  </ul>
                </details>
              );
            })}
          </div>
        </div>
      </section>

      <section id="apply" className="grid gap-10 lg:grid-cols-2">
        <div>
          <h2 className="text-2xl font-bold">Apply</h2>
          <p className="mt-2 text-ink-soft">We review every application within 2 business days. Don’t have every policy yet? Apply anyway; we’ll tell you exactly what you need and point you to brokers.</p>
          <div className="mt-6 space-y-3 text-sm">
            <div><b>Am I an employee?</b> <span className="text-ink-soft">No. You’re an independent business (1099). You choose which jobs to accept, use your own tools and keep your other clients.</span></div>
            <div><b>When do I get paid?</b> <span className="text-ink-soft">Weekly, for every job that passed photo review. Each job has its own statement.</span></div>
            <div><b>Can I turn down offers?</b> <span className="text-ink-soft">Yes, anytime. Accepting more often helps you move up a tier.</span></div>
            <div><b>What if a customer isn’t happy?</b> <span className="text-ink-soft">Our team handles the customer. You get the first chance to fix it, and the rules are spelled out in your contractor agreement.</span></div>
          </div>
        </div>
        <ApplyForm />
      </section>
    </div>
  );
}
