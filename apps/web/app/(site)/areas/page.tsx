/*
 * FILE    : apps/web/app/(site)/areas/page.tsx
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-11-06_0500 UTC
 * PURPOSE : Areas we serve: every market (SITE_MARKETS) with its cities and the services it leads with, linking to each
 *           market page.
 * UPDATED : 2026-11-09_1600 UTC — Professional look: line icons instead of emoji (ThemedIcon / Ico switch by look; Original unchanged).
 */
import Link from "next/link";
import { Ico } from "@/components/Glyph";
import { SITE_MARKETS, getService } from "@handled/core";
import { getLocale } from "@/lib/locale";

export const metadata = { title: "Areas we serve", description: "Handled serves Michigan, New York, New Jersey, Las Vegas and Washington with vetted, insured local pros and upfront prices.", alternates: { canonical: "/areas" } };

export default async function AreasPage() {
  const es = (await getLocale()) === "es";
  return (
    <div className="wrap py-12">
      <h1 className="text-4xl font-extrabold tracking-tight">{es ? "Dónde trabajamos" : "Areas we serve"}</h1>
      <p className="mt-3 max-w-2xl text-lg text-ink-soft">{es ? "Profesionales locales verificados y con seguro, con su precio exacto antes de reservar." : "Vetted, insured local pros, with your exact price before you book."}</p>
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {SITE_MARKETS.map((m) => (
          <Link key={m.slug} href={`/areas/${m.slug}`} className="card block hover:border-brand">
            <h2 className="text-xl font-bold"><Ico i="📍" />{m.name}</h2>
            <p className="mt-1 text-sm text-ink-soft">{m.region}</p>
            <p className="mt-3 text-sm">{m.featured.map((x) => getService(x)?.name).filter(Boolean).slice(0, 3).join(" · ")}</p>
            <p className="mt-2 text-xs text-ink-soft">{m.cities.slice(0, 5).map((c) => c.name).join(", ")}{m.cities.length > 5 ? "…" : ""}</p>
            <span className="mt-3 inline-block text-sm font-semibold text-brand">{es ? "Ver" : "See"} {m.name} →</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
