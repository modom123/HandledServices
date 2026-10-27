/*
 * FILE    : apps/web/components/home/WhoWeAre.tsx
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-27_1500 UTC
 * PURPOSE : Home page "Who we are" strip: the slogan, the mission statement and a short who-we-are, with a link to the
 *           About page. Words come from BRAND_STORY in @handled/core. Both home layouts. English / Spanish.
 */
import Link from "next/link";
import { BRAND_STORY } from "@handled/core";

export function WhoWeAre({ es }: { es: boolean }) {
  const L = es ? "es" : "en";
  return (
    <section className="border-y border-line bg-paper py-14">
      <div className="wrap grid items-center gap-8 lg:grid-cols-[1fr_1.3fr]">
        <div>
          <div className="text-xs font-bold uppercase tracking-widest text-brand">{es ? "Quiénes somos" : "Who we are"}</div>
          <h2 className="mt-2 text-4xl font-extrabold tracking-tight">{BRAND_STORY.slogan[L]}</h2>
          <p className="mt-4 text-ink-soft">{BRAND_STORY.short[L]}</p>
          <Link href="/about" className="mt-5 inline-block font-semibold text-brand">{es ? "Conozca nuestra historia →" : "Our story →"}</Link>
        </div>
        <blockquote className="rounded-2xl border-l-4 border-gold bg-white p-6 text-lg leading-relaxed shadow-sm sm:p-8 sm:text-xl">
          <div className="text-xs font-bold uppercase tracking-widest text-ink-soft">{es ? "Nuestra misión" : "Our mission"}</div>
          <p className="mt-2">{BRAND_STORY.mission[L]}</p>
        </blockquote>
      </div>
    </section>
  );
}
