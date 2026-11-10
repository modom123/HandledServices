/*
 * FILE    : apps/web/components/NewProsChain.tsx
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-11-10_2000 UTC
 * PURPOSE : "New pros in the Handled Network": a chain of the newest featured pros (lib/showcase.ts, refreshed every
 *           6 hours), each card linked to the next: headshot (or initials), public name, area, up to 5 services they're
 *           cleared for, when they joined and their rating once they have one. Swipes sideways on phones. Renders
 *           nothing when nobody has opted in yet. Server component; works in every website look.
 */
import Link from "next/link";
import type { ShowcaseEntry } from "@/lib/showcase";

const initials = (n: string) => n.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("");

export function NewProsChain({ pros, es = false, title, area }: { pros: ShowcaseEntry[]; es?: boolean; title?: string; area?: string }) {
  if (!pros.length) return null;
  return (
    <section className="wrap py-10" aria-labelledby="new-pros">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-xs font-bold uppercase tracking-widest text-brand">{es ? "Red Handled" : "Handled Network"}</div>
          <h2 id="new-pros" className="mt-1 text-3xl font-bold tracking-tight">{title ?? (es ? `Nuevos profesionales${area ? ` en ${area}` : ""}` : `New pros${area ? ` in ${area}` : " in the Handled Network"}`)}</h2>
          <p className="mt-1 text-sm text-ink-soft">{es ? "Verificados, con antecedentes revisados y listos para trabajar. Se actualiza cada 6 horas." : "Background-checked, vetted and ready to work. Updated every 6 hours."}</p>
        </div>
        <Link href="/pros" className="text-sm font-semibold text-brand">{es ? "¿Es profesional? Únase →" : "Are you a pro? Join →"}</Link>
      </div>
      <ol className="-mx-4 mt-6 flex snap-x snap-mandatory items-stretch overflow-x-auto px-4 pb-3">
        {pros.map((p, i) => (
          <li key={p.id} className="flex shrink-0 snap-start items-stretch">
            {/* the link between two pros in the chain */}
            {i > 0 && <span aria-hidden className="flex w-6 items-center"><span className="h-0.5 w-full bg-brand/40" /></span>}
            <div className="card flex w-64 flex-col">
              <div className="flex items-center gap-3">
                {p.photo
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={p.photo} alt={p.name} width={56} height={56} loading="lazy" className="h-14 w-14 shrink-0 rounded-full object-cover ring-2 ring-brand/20" />
                  : <span aria-hidden className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-brand-deep text-lg font-bold text-white">{initials(p.name)}</span>}
                <div className="min-w-0">
                  <div className="line-clamp-2 font-bold leading-tight">{p.name}</div>
                  <div className="truncate text-xs text-ink-soft">{p.area}</div>
                  <div className="text-xs text-ink-soft">{p.rating ? `★ ${p.rating} · ${p.jobs} ${es ? "trabajos" : "jobs"}` : p.joined ? `${es ? "Se unió" : "Joined"} ${p.joined}` : ""}</div>
                </div>
              </div>
              <ul className="mt-3 flex flex-1 flex-wrap content-start gap-1.5">
                {p.services.map((s) => <li key={s.slug}><Link href={`/book?service=${s.slug}`} className="inline-block rounded-full border border-line bg-paper px-2.5 py-0.5 text-xs hover:border-brand">{s.name}</Link></li>)}
                {p.more > 0 && <li className="px-1 py-0.5 text-xs text-ink-soft">+{p.more} {es ? "más" : "more"}</li>}
              </ul>
              <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-emerald-800"><span aria-hidden>✓</span> {es ? "Verificado" : "Vetted"}{p.joined && p.rating ? ` · ${es ? "desde" : "since"} ${p.joined}` : ""}</span>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
