/*
 * FILE    : apps/web/app/(site)/page.tsx
 * PROJECT : Handled — AI-run home & business services
 * CREATED : 2026-10-01_1723 UTC
 * PURPOSE : Home page — positioning, services, how it works, why we beat lead-gen
 *           marketplaces, commercial + pro recruiting CTAs.
 */
import Link from "next/link";
import { BRAND, CATEGORIES, SERVICES, money } from "@handled/core";

const STEPS = [
  { n: "1", title: "Get a real price in 60 seconds", body: "Answer a few questions or snap photos. Our AI checks the details and gives you an upfront price — not a callback." },
  { n: "2", title: "We send one vetted pro", body: "Insured, background-checked, rated. AI dispatch picks the best available pro for your job, date and neighborhood." },
  { n: "3", title: "Track it like a delivery", body: "Live status, messages and before/after photos in the app. Every job is photo-checked by AI, and if it isn’t right we come back free or refund you." },
];

const COMPARE = [
  ["Upfront, guaranteed price", "Quotes after calls", "✓"],
  ["One pro, not 5 sales calls", "Your number is sold as a lead", "✓"],
  ["Pros vetted, insured & rated by us", "Varies", "✓"],
  ["Free redo or money back", "Varies", "✓"],
  ["One app for every home & business service", "Per-trade", "✓"],
  [`${BRAND.guaranteeDays}-day make-it-right guarantee`, "Varies", "✓"],
];

export default function Home() {
  const popular = ["house-cleaning", "lawn-care", "junk-removal", "handyman", "gutter-cleaning", "pet-waste-removal"].map((s) => SERVICES.find((x) => x.slug === s)!);
  return (
    <>
      <section className="wrap grid items-center gap-12 pb-16 pt-14 md:grid-cols-2 md:pt-20">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full bg-brand-tint px-3 py-1 text-xs font-semibold text-brand-dark">
            ● AI-run operations · real local pros
          </span>
          <h1 className="mt-5 text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">
            Your home & business to-do list. <span className="text-brand">Handled.</span>
          </h1>
          <p className="mt-5 max-w-lg text-lg text-ink-soft">{BRAND.pitch}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/book" className="btn-primary px-6 py-3 text-base">Get my price</Link>
            <Link href="/business" className="btn-ghost px-6 py-3 text-base">Commercial accounts</Link>
          </div>
          <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-ink-soft">
            <span>✓ Insured & background-checked</span><span>✓ Upfront, all-in price</span><span>✓ {BRAND.guaranteeDays}-day guarantee</span>
          </div>
        </div>
        <div className="card grid grid-cols-2 gap-3 p-4 shadow-sm">
          {popular.map((s) => (
            <Link key={s.slug} href={`/book?service=${s.slug}`} className="rounded-xl border border-line p-4 transition hover:border-brand hover:bg-brand-tint">
              <div className="text-2xl">{s.icon}</div>
              <div className="mt-2 text-sm font-semibold">{s.name}</div>
              <div className="text-xs text-ink-soft">from {money(s.minimum)}</div>
            </Link>
          ))}
        </div>
      </section>

      <section className="border-y border-line bg-white py-16">
        <div className="wrap">
          <h2 className="text-3xl font-bold tracking-tight">Every service, one account</h2>
          <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {CATEGORIES.map((c) => (
              <div key={c.id}>
                <div className="font-semibold">{c.name}</div>
                <p className="mt-1 text-sm text-ink-soft">{c.blurb}</p>
                <ul className="mt-4 space-y-2">
                  {SERVICES.filter((s) => s.category === c.id).map((s) => (
                    <li key={s.slug}>
                      <Link href={`/services/${s.slug}`} className="flex items-center gap-2 text-sm hover:text-brand">
                        <span>{s.icon}</span>{s.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="wrap py-16">
        <h2 className="text-3xl font-bold tracking-tight">How it works</h2>
        <div className="mt-8 grid gap-6 md:grid-cols-3">
          {STEPS.map((s) => (
            <div key={s.n} className="card">
              <div className="grid h-9 w-9 place-items-center rounded-full bg-ink text-sm font-bold text-white">{s.n}</div>
              <div className="mt-4 font-semibold">{s.title}</div>
              <p className="mt-2 text-sm text-ink-soft">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="wrap pb-16">
        <div className="card overflow-hidden p-0">
          <div className="grid md:grid-cols-[1fr_1.4fr]">
            <div className="bg-ink p-8 text-white">
              <h2 className="text-2xl font-bold">Not a lead list. A finished job.</h2>
              <p className="mt-3 text-sm text-white/70">
                Lead marketplaces sell your phone number to several contractors and leave the rest to you. Contractor software helps the pro, not you.
                {" "}{BRAND.name} owns the outcome: we price it, send the pro, check the work and stand behind it.
              </p>
            </div>
            <table className="w-full text-sm">
              <thead><tr className="border-b border-line text-left text-xs uppercase tracking-wide text-ink-soft"><th className="p-4"></th><th className="p-4">Typical lead site</th><th className="p-4 text-brand">{BRAND.name}</th></tr></thead>
              <tbody>
                {COMPARE.map(([a, b, c]) => (
                  <tr key={a} className="border-b border-line last:border-0"><td className="p-4 font-medium">{a}</td><td className="p-4 text-ink-soft">{b}</td><td className="p-4 font-bold text-brand">{c}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="wrap grid gap-6 pb-8 md:grid-cols-2">
        <div className="card bg-brand-tint">
          <h3 className="text-xl font-bold">For businesses & property managers</h3>
          <p className="mt-2 text-sm text-ink-soft">Janitorial, windows, grounds, junk-outs and repairs across every location — one vendor, one prepaid monthly invoice, and an SLA dashboard.</p>
          <Link href="/business" className="btn-dark mt-5">Set up a commercial account</Link>
        </div>
        <div className="card">
          <h3 className="text-xl font-bold">Own a crew? Get steady work.</h3>
          <p className="mt-2 text-sm text-ink-soft">No lead fees. Pre-priced jobs sent to your phone, fast payouts, and we handle sales, scheduling and collections.</p>
          <Link href="/pros" className="btn-ghost mt-5">Apply as a pro</Link>
        </div>
      </section>
    </>
  );
}
