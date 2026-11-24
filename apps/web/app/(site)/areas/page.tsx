/*
 * FILE    : apps/web/app/(site)/areas/page.tsx
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-11-06_0500 UTC
 * PURPOSE : Areas we serve: every market (SITE_MARKETS) with its cities and the services it leads with, linking to each
 *           market page.
 * UPDATED : 2026-11-09_1600 UTC — Professional look: line icons instead of emoji (ThemedIcon / Ico switch by look; Original unchanged).
 * UPDATED : 2026-11-10_0430 UTC — "insured pros" → "background-checked, vetted pros" (insurance is only required for services that need it).
 * UPDATED : 2026-11-17_2045 UTC — "Also where our pros work": states with approved pros beyond our launched areas; pros in all 50 states.
 */
import Link from "next/link";
import { Ico } from "@/components/Glyph";
import { SITE_MARKETS, SERVICE_AREA, getService, stateForZip, stateName } from "@handled/core";
import { adminClient } from "@/lib/supabase/server";
import { supabaseConfigured } from "@/lib/supabase/env";

export const revalidate = 3600;

/** States where approved pros work beyond our launched areas (all 50 states, 2026-11-17): services are bookable there by ZIP. */
async function proStates(): Promise<string[]> {
  if (!supabaseConfigured || !process.env.SUPABASE_SERVICE_ROLE_KEY) return [];
  try {
    const { data } = await adminClient().from("contractors").select("base_state, base_zip").eq("status", "approved").limit(5000);
    const served = new Set<string>(SERVICE_AREA.map((a) => a.code));
    const st = new Set(((data ?? []) as { base_state: string | null; base_zip: string | null }[]).map((c) => c.base_state ?? stateForZip(c.base_zip)).filter((x): x is string => Boolean(x) && !served.has(x!)));
    return [...st].map((c) => stateName(c) ?? c).sort();
  } catch { return []; }
}
import { getLocale } from "@/lib/locale";

export const metadata = { title: "Areas we serve", description: "Handled serves Michigan, New York, New Jersey, Las Vegas and Washington with background-checked, vetted local pros and upfront prices.", alternates: { canonical: "/areas" } };

export default async function AreasPage() {
  const es = (await getLocale()) === "es";
  const more = await proStates();
  return (
    <div className="wrap py-12">
      <h1 className="text-4xl font-extrabold tracking-tight">{es ? "Dónde trabajamos" : "Areas we serve"}</h1>
      <p className="mt-3 max-w-2xl text-lg text-ink-soft">{es ? "Profesionales locales verificados y con seguro, con su precio exacto antes de reservar." : "Background-checked, vetted local pros, with your exact price before you book."}</p>
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
      {more.length > 0 && (
        <section className="mt-10 card">
          <h2 className="text-xl font-bold"><Ico i="🧰" />{es ? "También donde trabajan nuestros profesionales" : "Also where our pros work"}</h2>
          <p className="mt-1 text-sm text-ink-soft">{es ? "Profesionales verificados ya trabajan en estos estados. Ingrese su código postal al reservar para ver qué servicios están disponibles donde usted vive." : "Vetted pros already work in these states. Enter your ZIP when you book to see which services are available where you live."}</p>
          <p className="mt-3 text-sm font-semibold">{more.join(" · ")}</p>
        </section>
      )}
      <p className="mt-8 text-sm text-ink-soft">{es ? "¿Es profesional? Aceptamos profesionales en los 50 estados: " : "Are you a pro? We take pros in all 50 states: "}<Link href="/pros" className="font-semibold text-brand underline">{es ? "regístrese" : "sign up"}</Link>.</p>
    </div>
  );
}
