/*
 * FILE    : apps/web/app/(splash)/page.tsx
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-02_0244 UTC
 * UPDATED : 2026-10-02_1329 UTC — English / Spanish.
 * PURPOSE : Splash page at / — introduces the company before the home page (/home):
 *           the original message ("Your home & business to-do list. Handled."), who we are,
 *           every category at a glance, and three reasons to trust us. One click to enter.
 * UPDATED : 2026-10-07_0215 UTC — own top bar removed; the site header (dropdown menus, language, sign in) is above it.
 * UPDATED : 2026-10-07_2045 UTC — new splash: the official logo front and center on a light page (logo teal and green),
 *           the tagline "Home & business services. Handled.", Michigan & Washington, then the categories and trust pillars.
 * UPDATED : 2026-10-07_2115 UTC — uses the site background (light blue).
 * UPDATED : 2026-10-07_2100 UTC — simplified to the logo and the tagline (plus Enter / Get my price); categories and trust
 *           points live on the home page.
 */
import Link from "next/link";
import { BRAND, t as tr } from "@handled/core";
import { getLocale } from "@/lib/locale";

export const metadata = { title: { absolute: `${BRAND.name} — ${BRAND.tagline}` }, description: BRAND.pitch };

export default async function Splash() {
  const l = await getLocale();
  const es = l === "es";
  const t = (s: string) => tr(l, s);
  return (
    <div className="relative flex min-h-[calc(100svh-4rem)] flex-col overflow-hidden bg-page text-ink">
      {/* soft brand-colored light behind the logo (teal + green from the logo) */}
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(42rem_26rem_at_50%_18%,rgba(15,107,102,0.10),transparent_70%),radial-gradient(30rem_20rem_at_78%_70%,rgba(74,154,70,0.10),transparent_70%)]" />

      <section className="wrap relative flex flex-1 flex-col items-center justify-center py-12 text-center">
        {/* the official logo, front and center */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/handled-logo.png" alt={`${BRAND.name} — Home & Business Services`} width={526} height={455} className="splash-logo h-auto w-64 sm:w-96" />
        <p className="splash-in mt-10 text-3xl font-bold tracking-tight text-[#0f6b66] sm:text-4xl" style={{ animationDelay: "0.35s" }}>
          {es ? "Servicios para hogar y negocio." : "Home & business services."} <span className="text-[#4a9a46]">{t("Handled.")}</span>
        </p>
        <span className="splash-in mt-5 inline-flex items-center gap-2 rounded-full bg-[#0f6b66]/10 px-3 py-1 text-xs font-semibold text-[#0f6b66]" style={{ animationDelay: "0.6s" }}>
          ● {es ? "Ahora en Michigan y Washington" : "Now serving Michigan & Washington"}
        </span>
        <div className="splash-in mt-9 flex flex-wrap justify-center gap-3" style={{ animationDelay: "0.7s" }}>
          <Link href="/home" className="btn bg-[#0f6b66] px-8 py-3.5 text-base text-white hover:bg-[#0c5753]">{t("Enter")} {BRAND.name} →</Link>
          <Link href="/book" className="btn border border-[#0f6b66]/40 px-8 py-3.5 text-base text-[#0f6b66] hover:border-[#0f6b66] hover:bg-[#0f6b66]/5">{t("Get my price")}</Link>
        </div>
      </section>

      <div className="wrap relative flex flex-wrap items-center justify-between gap-3 border-t border-line py-4 text-xs text-ink-soft">
        <span>© {new Date().getFullYear()} {BRAND.legalName}</span>
        <span className="flex gap-4"><Link href="/business" className="hover:text-ink">{t("For businesses")}</Link><Link href="/pros" className="hover:text-ink">{t("Become a Pro")}</Link><Link href="/home" className="hover:text-ink">{t("Skip intro")}</Link></span>
      </div>
    </div>
  );
}
