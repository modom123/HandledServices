/*
 * FILE    : apps/web/components/home/WhyItWorks.tsx
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-27_1500 UTC
 * PURPOSE : "Why it works" — side by side: what customers get, what pros get, and the model that makes both true (the
 *           flywheel: prepaid jobs → the best pros → jobs done right → repeat customers → more work). Words come from
 *           BRAND_STORY.why in @handled/core. Used on both home layouts and the About page. English / Spanish.
 */
import Link from "next/link";
import { BRAND_STORY } from "@handled/core";

export function WhyItWorks({ es }: { es: boolean }) {
  const L = es ? "es" : "en";
  const { customers, pros, model } = BRAND_STORY.why;
  const sides = [
    { ...customers[L], icon: "🏠", cta: { href: "/book", label: es ? "Ver mi precio" : "Get my price" } },
    { ...pros[L], icon: "🧰", cta: { href: "/pros#apply", label: es ? "Postularme como profesional" : "Apply as a pro" } },
  ];
  return (
    <section id="why" className="wrap scroll-mt-24 py-14">
      <div className="grid gap-4 lg:grid-cols-[1fr_1fr_1.1fr]">
        {sides.map((x) => (
          <div key={x.t} className="card flex flex-col">
            <div className="flex items-center gap-3"><span className="text-3xl">{x.icon}</span><h2 className="text-2xl font-bold">{x.t}</h2></div>
            <p className="mt-2 text-ink-soft">{x.d}</p>
            <ul className="mt-4 flex-1 space-y-2.5">
              {x.points.map((p) => <li key={p} className="flex gap-2"><span className="mt-0.5 font-bold text-brand">✓</span><span>{p}</span></li>)}
            </ul>
            <Link href={x.cta.href} className="btn-primary mt-6 self-start">{x.cta.label} →</Link>
          </div>
        ))}
        <div className="flex flex-col rounded-2xl bg-brand-deep p-6 text-white sm:p-8">
          <div className="text-xs font-bold uppercase tracking-widest text-gold-light">{es ? "El modelo" : "The model"}</div>
          <h2 className="mt-2 text-2xl font-bold">{model[L].t}</h2>
          <p className="mt-3 flex-1 leading-relaxed text-white/85">{model[L].d}</p>
          <div className="mt-5 grid grid-cols-2 gap-2 text-xs font-semibold sm:text-sm">
            {(es ? ["Pago por adelantado", "Los mejores profesionales", "Trabajo bien hecho", "Clientes que regresan"] : ["Prepaid jobs", "The best pros", "Jobs done right", "Customers come back"]).map((s, i) => (
              <span key={s} className="rounded-lg bg-white/10 px-3 py-2 ring-1 ring-white/15"><span className="text-gold-light">{i + 1}.</span> {s}{i === 3 ? " ↺" : " →"}</span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
