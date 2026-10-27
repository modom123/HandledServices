/*
 * FILE    : apps/web/app/(site)/careers/page.tsx
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-27_1700 UTC
 * PURPOSE : Careers — every open role in one public list, the landing page for our Indeed posts: independent pro trades
 *           (apply → /pros, tagged with the trade), roles on the Handled team, and roles we're filling for clients
 *           (company kept confidential). Team and client roles open /careers/[id] to apply. English / Spanish.
 */
import Link from "next/link";
import { BRAND, BRAND_STORY, applyUrl, type Track } from "@handled/core";
import { getLocale } from "@/lib/locale";
import { siteUrl } from "@/lib/notify";
import { publicOpenings } from "@/lib/recruiting-division";

export const metadata = { title: "Careers", description: `Work with ${BRAND.name}: independent pro work, jobs on our team, and roles with our clients.` };

const pay = (a?: number | null, b?: number | null) => (a || b ? `${a ? `$${Math.round(a / 1000)}K` : ""}${a && b ? "–" : ""}${b ? `$${Math.round(b / 1000)}K` : ""} a year` : "");

export default async function Careers() {
  const es = (await getLocale()) === "es";
  const rows = await publicOpenings();
  const site = siteUrl();
  const sections: { t: Track; title: string; d: string }[] = [
    { t: "pro", title: es ? "Profesionales independientes (1099)" : "Independent pros (1099)", d: es ? "Tenga su propio negocio. Le enviamos trabajos prepagados; usted elige cuáles toma." : "Run your own business. We send you prepaid jobs; you pick the ones you want." },
    { t: "staff", title: es ? `Únase al equipo de ${BRAND.name}` : `Join the ${BRAND.name} team`, d: es ? "Empleos en nuestro propio equipo." : "Jobs on our own team." },
    { t: "client", title: es ? "Empleos con nuestros clientes" : "Jobs with our clients", d: es ? `${BRAND.name} Talent cubre estos puestos para empresas locales. Usted nunca paga una tarifa.` : `${BRAND.name} Talent is filling these roles for local companies. You never pay a fee.` },
  ];
  return (
    <div>
      <section className="bg-brand-deep text-white">
        <div className="wrap py-14">
          <div className="text-xs font-bold uppercase tracking-widest text-gold-light">{es ? "Empleos" : "Careers"}</div>
          <h1 className="mt-3 text-4xl font-extrabold tracking-tight sm:text-5xl">{es ? `Trabaje con ${BRAND.name}` : `Work with ${BRAND.name}`}</h1>
          <p className="mt-4 max-w-2xl text-lg text-white/85">{BRAND_STORY.mission[es ? "es" : "en"]}</p>
        </div>
      </section>
      <div className="wrap space-y-12 py-12">
        {sections.map(({ t, title, d }) => {
          const list = rows.filter((o) => o.track === t);
          if (!list.length) return null;
          return (
            <section key={t}>
              <h2 className="text-2xl font-bold">{title}</h2>
              <p className="mt-1 text-ink-soft">{d}</p>
              <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {list.map((o) => (
                  <Link key={o.key} href={o.track === "pro" ? applyUrl(site, o, "careers").replace(site, "") : `/careers/${o.searchId}`} className="card flex flex-col transition hover:border-brand">
                    <span className="font-bold">{o.title}</span>
                    <span className="mt-1 text-sm text-ink-soft">{o.location}{o.workplace && o.workplace !== "onsite" ? ` · ${o.workplace}` : ""}</span>
                    {o.track !== "pro" && pay(o.salaryMin, o.salaryMax) && <span className="mt-1 text-sm">{pay(o.salaryMin, o.salaryMax)}</span>}
                    <span className="mt-3 text-sm font-semibold text-brand">{es ? "Postularme →" : "Apply →"}</span>
                  </Link>
                ))}
              </div>
            </section>
          );
        })}
        {!rows.length && <p className="card text-ink-soft">{es ? "No hay puestos abiertos ahora mismo." : "No open roles right now."} <Link href="/pros" className="underline">{es ? "Profesionales independientes: postúlese aquí." : "Independent pros: apply here."}</Link></p>}
      </div>
    </div>
  );
}
