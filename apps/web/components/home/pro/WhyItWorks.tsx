/*
 * FILE    : apps/web/components/home/pro/WhyItWorks.tsx
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-27_1500 UTC
 * PURPOSE : "Why it works" — side by side: what customers get, what pros get, and the model that makes both true (the
 *           flywheel: prepaid jobs → the best pros → jobs done right → repeat customers → more work). Words come from
 *           BRAND_STORY.why in @handled/core. Used on both home layouts and the About page. English / Spanish.
 * UPDATED : 2026-11-09_0130 UTC — tighter: the two cards sit side by side and the model is a short band beneath them, so no card stretches to match a taller neighbor.
 * UPDATED : 2026-11-09_0200 UTC — line icons instead of emoji.
 * UPDATED : 2026-11-09_0330 UTC — part of the Professional look (lib/theme.ts "pro"); the original look keeps components/home/*.
 */
import Link from "next/link";
import { Glyph } from "@/components/Glyph";
import { BRAND_STORY } from "@handled/core";

export function WhyItWorks({ es }: { es: boolean }) {
  const L = es ? "es" : "en";
  const { customers, pros, model } = BRAND_STORY.why;
  const sides = [
    { ...customers[L], icon: "🏠", cta: { href: "/book", label: es ? "Ver mi precio" : "Get my price" } },
    { ...pros[L], icon: "🧰", cta: { href: "/pros#apply", label: es ? "Postularme como profesional" : "Apply as a pro" } },
  ];
  return (
    <section id="why" className="wrap scroll-mt-24 py-10">
      <div className="grid gap-4 md:grid-cols-2">
        {sides.map((x) => (
          <div key={x.t} className="card flex flex-col">
            <div className="flex items-center gap-3"><Glyph icon={x.icon} size="sm" /><h2 className="text-xl font-bold">{x.t}</h2></div>
            <p className="mt-1.5 text-sm text-ink-soft">{x.d}</p>
            <ul className="mt-3 flex-1 space-y-1.5 text-sm">
              {x.points.map((p) => <li key={p} className="flex gap-2"><span className="mt-0.5 font-bold text-brand">✓</span><span>{p}</span></li>)}
            </ul>
            <Link href={x.cta.href} className="btn-primary mt-4 self-start">{x.cta.label} →</Link>
          </div>
        ))}
        <div className="grid items-center gap-5 rounded-xl bg-brand-deep p-5 text-white sm:p-6 md:col-span-2 lg:grid-cols-[1.6fr_1fr]">
          <div>
          <div className="text-xs font-bold uppercase tracking-widest text-gold-light">{es ? "El modelo" : "The model"}</div>
          <h2 className="mt-1 text-xl font-bold">{model[L].t}</h2>
          <p className="mt-2 text-sm leading-relaxed text-white/85">{model[L].d}</p>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs font-semibold sm:text-sm">
            {(es ? ["Pago por adelantado", "Los mejores profesionales", "Trabajo bien hecho", "Clientes que regresan"] : ["Prepaid jobs", "The best pros", "Jobs done right", "Customers come back"]).map((s, i) => (
              <span key={s} className="rounded-lg bg-white/10 px-3 py-2 ring-1 ring-white/15"><span className="text-gold-light">{i + 1}.</span> {s}{i === 3 ? " ↺" : " →"}</span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
