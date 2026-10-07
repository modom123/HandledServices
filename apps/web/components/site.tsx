/*
 * FILE    : apps/web/components/site.tsx
 * PROJECT : Handled — AI-run home & business services
 * CREATED : 2026-10-01_1723 UTC
 * UPDATED : 2026-10-02_1329 UTC — footer: Handled Plus, gift cards, reviews; English / Spanish.
 * UPDATED : 2026-10-06_0748 UTC — footer: Pro Rewards & tiers (/pros#rewards).
 * PURPOSE : Public website header and footer.
 * UPDATED : 2026-10-05_0434 UTC — one account button (Sign in → My account / Pro portal / Hub, with Sign out), visible on phones.
 * UPDATED : 2026-10-05_0448 UTC — 📸 Snap & post a job button in the header (phones too).
 * UPDATED : 2026-10-05_2034 UTC — footer link to Handled Talent (recruiting).
 * UPDATED : 2026-10-06_0623 UTC — header menu (Services, Events, For Business, Become a Pro) easier to read: semibold, dark ink, 15px.
 * UPDATED : 2026-10-06_0802 UTC — dropdown menus (Services · For Business · Become a Pro · More) and a ☰ phone menu (phones
 *           had none); the header no longer runs off the side of a phone screen (it caused a sideways scroll on
 *           every page).
 * UPDATED : 2026-10-07_0030 UTC — green, white and gold: white header with a gold top rule, gold-on-deep-green logo mark,
 *           gold rule above the footer.
 */
import { AccountButton } from "./AccountButton";
import Link from "next/link";
import { BRAND, CATEGORIES, SERVICES, categoryText, t as tr } from "@handled/core";
import { getLocale } from "@/lib/locale";
import { LangSwitch } from "./LangSwitch";
import { DesktopNav, MobileNav, type NavGroup } from "./SiteNav";

export function Logo({ className = "" }: { className?: string }) {
  return (
    <Link href="/home" className={`flex items-center gap-2 font-extrabold tracking-tight ${className}`}>
      <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-deep text-gold-light ring-1 ring-gold/50">✓</span>
      <span className="text-lg">{BRAND.name}</span>
    </Link>
  );
}

export async function SiteHeader() {
  const l = await getLocale();
  const es = l === "es";
  const t = (s: string) => tr(l, s);
  const groups: NavGroup[] = [
    {
      id: "services", label: t("Services"), wide: true,
      items: CATEGORIES.map((c) => ({ href: `/services?cat=${c.id}`, label: categoryText(l, c.id, c).name, icon: c.icon })),
      footer: { href: "/services", label: es ? `Ver los ${SERVICES.length} servicios →` : `See all ${SERVICES.length} services →` },
    },
    {
      id: "business", label: t("For Business"),
      items: [
        { href: "/business", label: t("Commercial accounts"), icon: "🏢", hint: es ? "Limpieza y mantenimiento, un proveedor" : "Cleaning and facilities, one vendor" },
        { href: "/business#industries", label: es ? "Industrias que atendemos" : "Who we serve", icon: "🏬" },
        { href: "/events", label: t("Parties & events"), icon: "🎉", hint: es ? "Eventos corporativos, una factura" : "Corporate events, one invoice" },
        { href: "/talent", label: t("Recruiting (Handled Talent)"), icon: "🤝" },
      ],
      footer: { href: "/business#quote", label: es ? "Pida una propuesta →" : "Request a proposal →" },
    },
    {
      id: "pros", label: t("Become a Pro"),
      items: [
        { href: "/pros", label: es ? "Cómo funciona" : "How it works", icon: "🧰", hint: es ? "Trabajos pagados, no clientes potenciales" : "Paid jobs, not leads" },
        { href: "/pros#pay", label: es ? "Cuánto puede ganar" : "What you’d make", icon: "💵" },
        { href: "/pros#grow", label: t("Pro Rewards & tiers"), icon: "🏆" },
        { href: "/pros#requirements", label: es ? "Requisitos por oficio" : "Requirements by trade", icon: "📋" },
        { href: "/login?next=/pro", label: es ? "Portal para profesionales" : "Pro sign in", icon: "🔑" },
      ],
      footer: { href: "/pros#apply", label: es ? "Postúlese en 5 minutos →" : "Apply in 5 minutes →" },
    },
    {
      id: "more", label: es ? "Más" : "More",
      items: [
        { href: "/plus", label: "Handled Plus", icon: "⭐", hint: es ? "10% de descuento en cada trabajo" : "10% off every job" },
        { href: "/gift-cards", label: t("Gift cards"), icon: "🎁" },
        { href: "/reviews", label: t("Customer reviews"), icon: "💬" },
        { href: "/snap", label: es ? "Tome una foto, reciba un precio" : "Snap a photo, get a price", icon: "📸" },
      ],
    },
  ];
  const snap = es ? "Tome una foto y publique su trabajo" : "Snap a photo, post a job";
  return (
    <header className="sticky top-0 z-30 border-b border-t-[3px] border-line border-t-gold bg-white/95 backdrop-blur">
      <div className="wrap flex h-16 items-center justify-between gap-2 sm:gap-4">
        <Logo />
        <DesktopNav groups={groups} />
        <div className="flex items-center gap-1.5 sm:gap-2">
          <AccountButton es={es} />
          <span className="hidden sm:inline-flex"><LangSwitch locale={l} /></span>
          <Link href="/snap" title={snap} aria-label={snap} className="grid h-9 w-9 place-items-center rounded-full border border-line bg-white text-base hover:border-brand sm:h-10 sm:w-10 sm:text-lg">📸</Link>
          <Link href="/book" className="btn-primary whitespace-nowrap px-3.5 text-sm sm:px-5 sm:text-base">{t("Book now")}</Link>
          <MobileNav groups={groups} lang={<LangSwitch locale={l} />} cta={{ href: "/book", label: t("Book now") }} />
        </div>
      </div>
    </header>
  );
}

export async function SiteFooter() {
  const l = await getLocale();
  const t = (s: string) => tr(l, s);
  return (
    <footer className="mt-24 border-t-2 border-gold/60 bg-paper-deep">
      <div className="wrap grid gap-10 py-12 md:grid-cols-4">
        <div className="md:col-span-2">
          <Logo />
          <p className="mt-3 max-w-sm text-sm text-ink-soft">{BRAND.pitch}</p>
          <p className="mt-4 text-xs text-ink-soft">{BRAND.partner}</p>
        </div>
        <div>
          <div className="text-sm font-semibold">{t("Services")}</div>
          <ul className="mt-3 space-y-2 text-sm text-ink-soft">
            {CATEGORIES.map((c) => (
              <li key={c.id}><Link href={`/services?cat=${c.id}`} className="hover:text-ink">{c.icon} {categoryText(l, c.id, c).name}</Link></li>
            ))}
          </ul>
        </div>
        <div>
          <div className="text-sm font-semibold">{t("Company")}</div>
          <ul className="mt-3 space-y-2 text-sm text-ink-soft">
            <li><Link href="/events" className="hover:text-ink">{t("Parties & events")}</Link></li>
            <li><Link href="/business" className="hover:text-ink">{t("Commercial accounts")}</Link></li>
            <li><Link href="/talent" className="hover:text-ink">{t("Recruiting (Handled Talent)")}</Link></li>
            <li><Link href="/plus" className="hover:text-ink">⭐ Handled Plus</Link></li>
            <li><Link href="/gift-cards" className="hover:text-ink">🎁 {t("Gift cards")}</Link></li>
            <li><Link href="/reviews" className="hover:text-ink">{t("Customer reviews")}</Link></li>
            <li><Link href="/pros" className="hover:text-ink">{t("Join as a pro")}</Link></li>
            <li><Link href="/pros#rewards" className="hover:text-ink">🏆 {t("Pro Rewards & tiers")}</Link></li>
            <li><Link href="/hub" className="hover:text-ink">Handled Hub</Link></li>
            <li>{BRAND.supportPhone}</li>
            <li>{BRAND.supportEmail}</li>
          </ul>
        </div>
      </div>
      <div className="border-t border-line py-4 text-center text-xs text-ink-soft">© {new Date().getFullYear()} {BRAND.legalName} · <Link href="/terms/service-agreement" className="hover:text-ink">Service Agreement</Link> · <Link href="/privacy" className="hover:text-ink">Privacy</Link></div>
    </footer>
  );
}
