/*
 * FILE    : apps/web/app/(site)/services/page.tsx
 * PROJECT : Handled — AI-run home & business services
 * CREATED : 2026-10-01_1723 UTC
 */
import Link from "next/link";
import { CATEGORIES, SERVICES, money } from "@handled/core";

export const metadata = { title: "Services" };

export default function ServicesPage() {
  return (
    <div className="wrap py-14">
      <h1 className="text-4xl font-extrabold tracking-tight">Services</h1>
      <p className="mt-2 text-ink-soft">Upfront prices. Vetted pros. One account for all of it.</p>
      {CATEGORIES.map((c) => (
        <section key={c.id} className="mt-12">
          <h2 className="text-xl font-bold">{c.name}</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {SERVICES.filter((s) => s.category === c.id).map((s) => (
              <Link key={s.slug} href={`/services/${s.slug}`} className="card transition hover:border-brand">
                <div className="text-3xl">{s.icon}</div>
                <div className="mt-3 font-semibold">{s.name}</div>
                <p className="mt-1 text-sm text-ink-soft">{s.tagline}</p>
                <div className="mt-3 text-sm font-semibold text-brand">from {money(s.minimum)}{s.siteVisit ? " · free site visit" : ""}</div>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
