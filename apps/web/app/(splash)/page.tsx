/*
 * FILE    : apps/web/app/(splash)/page.tsx
 * PROJECT : Handled — AI-run home & business services
 * CREATED : 2026-10-02_0244 UTC
 * UPDATED : 2026-10-02_1329 UTC — English / Spanish.
 * PURPOSE : Splash page at / — introduces the company before the home page (/home):
 *           the original message ("Your home & business to-do list. Handled."), who we are,
 *           every category at a glance, and three reasons to trust us. One click to enter.
 * UPDATED : 2026-10-07_0215 UTC — own top bar removed; the site header (dropdown menus, language, sign in) is above it.
 */
import Link from "next/link";
import { BRAND, CATEGORIES, SERVICES, categoryText, t as tr } from "@handled/core";
import { getLocale } from "@/lib/locale";
import { ThemedIcon } from "@/components/Glyph";

export const metadata = { title: { absolute: `${BRAND.name} — ${BRAND.tagline}` }, description: BRAND.pitch };

const PILLARS = [
  { icon: "🛡️", title: "Vetted, insured pros", body: "Background-checked, licensed where required, and rated on every job." },
  { icon: "💵", title: "Upfront, all-in price", body: "Your real price in about a minute. No callbacks, no surprise invoices." },
  { icon: "✓", title: "Make-it-right guarantee", body: "Not right? A free redo or your money back within", tail: true },
];

const PITCH_ES = "Una sola app para todo lo que su hogar o negocio necesita: limpieza, reparaciones, pintura, retiro de cosas, jardín y nieve, mascotas, lavado de autos, mudanzas y entregas, mensajería y entregas médicas, eventos y transporte. Precios por adelantado, profesionales verificados y un equipo de operaciones con IA que se asegura de que quede bien.";

export default async function Splash() {
  const l = await getLocale();
  const t = (s: string) => tr(l, s);
  return (
    <div className="relative flex min-h-svh flex-col overflow-hidden bg-brand-deep text-white">
      {/* soft light behind the headline */}
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(60rem_30rem_at_50%_-10%,rgba(159,230,204,0.22),transparent_70%)]" />

      {/* the site header with the dropdown menus sits above (splash layout) */}

      <section className="wrap relative flex flex-1 flex-col items-center justify-center py-12 text-center splash-in">
        <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-gold-light ring-1 ring-white/15">● {t("AI-run operations · real local pros")}</span>
        <h1 className="mt-6 max-w-4xl text-4xl font-extrabold leading-[1.1] tracking-tight sm:text-6xl">
          {t("Your home & business to-do list.")} <span className="text-gold-light">{t("Handled.")}</span>
        </h1>
        <p className="mt-6 max-w-2xl text-lg text-white/80">{l === "es" ? PITCH_ES : BRAND.pitch}</p>
        <div className="mt-10 flex flex-wrap justify-center gap-3">
          <Link href="/home" className="btn bg-white px-8 py-3.5 text-base text-brand-deep hover:bg-gold-light">{t("Enter")} {BRAND.name} →</Link>
          <Link href="/book" className="btn border border-white/40 px-8 py-3.5 text-base text-white hover:border-white hover:bg-white/10">{t("Get my price")}</Link>
        </div>

        <div className="mt-14 w-full max-w-4xl">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/55">{SERVICES.length} {t("services · one account")}</p>
          <div className="mt-4 grid grid-cols-4 gap-2 sm:grid-cols-8">
            {CATEGORIES.map((c) => (
              <Link key={c.id} href={`/services?cat=${c.id}`} className="flex flex-col items-center rounded-xl bg-white/5 px-1 py-3 ring-1 ring-white/10 transition hover:bg-white/15">
                <ThemedIcon icon={c.icon} size="md" emojiClass="text-2xl" />
                <span className="mt-1 text-xs font-medium leading-tight text-white/85">{categoryText(l, c.id, c).short}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="relative border-t border-white/10 bg-black/10">
        <div className="wrap grid gap-6 py-8 sm:grid-cols-3">
          {PILLARS.map((p) => (
            <div key={p.title} className="flex gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/10 text-lg">{p.icon}</span>
              <div><div className="font-semibold">{t(p.title)}</div><p className="mt-0.5 text-sm text-white/70">{t(p.body)}{p.tail ? ` ${BRAND.guaranteeDays} ${t("days.")}` : ""}</p></div>
            </div>
          ))}
        </div>
        <div className="wrap flex flex-wrap items-center justify-between gap-3 border-t border-white/10 py-4 text-xs text-white/55">
          <span>{BRAND.partner}</span>
          <span className="flex gap-4"><Link href="/business" className="hover:text-white">{t("For businesses")}</Link><Link href="/pros" className="hover:text-white">{t("Become a Pro")}</Link><Link href="/home" className="hover:text-white">{t("Skip intro")}</Link></span>
        </div>
      </section>
    </div>
  );
}
