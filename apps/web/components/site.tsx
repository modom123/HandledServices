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
 * UPDATED : 2026-10-07_0140 UTC — Partner Program in the For Business menu and the footer.
 * UPDATED : 2026-10-07_1640 UTC — footer links Terms of Use, all terms, privacy & cookies, accessibility and contact, plus the mailing address.
 * UPDATED : 2026-10-07_1945 UTC — the official logo (public/brand/handled-lockup.png) replaces the ✓ badge.
 * UPDATED : 2026-10-11_2307 UTC — For Business menu: Intelligent websites & automation (/technology).
 * UPDATED : 2026-10-27_1500 UTC — the menu moved to a side menu (SideNav): Services, For Business, For Pros, Partners, More,
 *           About us and Handled Network; SiteShell lays out every public page (side menu + content + footer).
 * UPDATED : 2026-10-23_1500 UTC — the header's Become a partner button opens the sign-up form (/partners#join).
 * UPDATED : 2026-10-23_1430 UTC — More menu: Handled Network (/network, every portal including the Hub).
 * UPDATED : 2026-10-23_0430 UTC — "Become a partner" button in the header on wide screens (Referral Partner Program, /partners).
 * UPDATED : 2026-10-27_1800 UTC — Careers (/careers) in the For Pros menu and the footer.
 * UPDATED : 2026-10-28_1630 UTC — Business & Technology opens its own page (/technology) from the menu and footer.
 * UPDATED : 2026-10-28_1810 UTC — About page removed (its story is on the home page): no About links in the menu or footer.
 */
import { AccountButton } from "./AccountButton";
import Link from "next/link";
import { BRAND, BRAND_STORY, CATEGORIES, SERVICES, categoryText, t as tr } from "@handled/core";
import { getLocale } from "@/lib/locale";
import { LangSwitch } from "./LangSwitch";
import { SideNav, type NavGroup } from "./SiteNav";

export function Logo({ className = "" }: { className?: string }) {
  return (
    <Link href="/home" className={`flex items-center ${className}`}>
      {/* official logo (public/brand): the H mark with the check-arrow + HANDLED / Home & Business Services */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/handled-lockup.png" alt={`${BRAND.name} — Home & Business Services`} width={891} height={240} className="h-9 w-auto sm:h-10" />
    </Link>
  );
}

/** Business & Technology has its own page (/technology); every other category opens on the Services page. */
export const categoryHref = (id: string) => (id === "business" ? "/technology" : `/services?cat=${id}`);

export async function SiteHeader() {
  const l = await getLocale();
  const es = l === "es";
  const t = (s: string) => tr(l, s);
  const groups: NavGroup[] = [
    {
      id: "services", label: t("Services"),
      items: CATEGORIES.map((c) => ({ href: categoryHref(c.id), label: categoryText(l, c.id, c).name, icon: c.icon })),
      footer: { href: "/services", label: es ? `Ver los ${SERVICES.length} servicios →` : `See all ${SERVICES.length} services →` },
    },
    {
      id: "business", label: t("For Business"),
      items: [
        { href: "/business", label: t("Commercial accounts"), icon: "🏢" },
        { href: "/business#industries", label: es ? "Industrias que atendemos" : "Who we serve", icon: "🏬" },
        { href: "/technology", label: es ? "Sitios inteligentes y automatización" : "Websites & automation", icon: "🧠" },
        { href: "/events", label: t("Parties & events"), icon: "🎉" },
        { href: "/talent", label: t("Recruiting (Handled Talent)"), icon: "🤝" },
      ],
      footer: { href: "/book?for=business", label: es ? "Ordenar para su negocio →" : "Order for your business →" },
    },
    {
      id: "pros", label: es ? "Para profesionales" : "For Pros",
      items: [
        { href: "/pros", label: es ? "Cómo funciona" : "How it works", icon: "🧰" },
        { href: "/pros#pay", label: es ? "Cuánto puede ganar" : "What you’d make", icon: "💵" },
        { href: "/pros#grow", label: t("Pro Rewards & tiers"), icon: "🏆" },
        { href: "/pros#requirements", label: es ? "Requisitos por oficio" : "Requirements by trade", icon: "📋" },
        { href: "/careers", label: es ? "Empleos y puestos abiertos" : "Careers & open roles", icon: "💼" },
        { href: "/login?next=/pro", label: es ? "Portal para profesionales" : "Pro sign in", icon: "🔑" },
      ],
      footer: { href: "/pros#apply", label: es ? "Postúlese en 5 minutos →" : "Apply in 5 minutes →" },
    },
    {
      id: "partners", label: es ? "Socios" : "Partners",
      items: [
        { href: "/partners", label: es ? "Cómo funciona: 10% por 12 meses" : "How it works: 10% for 12 months", icon: "💸" },
        { href: "/partner", label: es ? "Panel de socio" : "Partner dashboard", icon: "📊" },
      ],
      footer: { href: "/partners#join", label: es ? "Hacerme socio →" : "Become a partner →" },
    },
    {
      id: "more", label: es ? "Más" : "More",
      items: [
        { href: "/plus", label: "Handled Plus", icon: "⭐" },
        { href: "/gift-cards", label: t("Gift cards"), icon: "🎁" },
        { href: "/reviews", label: t("Customer reviews"), icon: "💬" },
        { href: "/contact", label: es ? "Contacto" : "Contact", icon: "✉️" },
      ],
    },
  ];
  const links = [
    { href: "/network", label: es ? "Red Handled" : "Handled Network", icon: "🌐" },
  ];
  return (
    <SideNav
      groups={groups}
      links={links}
      primary={{ href: "/book", label: t("Book now") }}
      secondary={{ href: "/snap", label: es ? "Foto y precio" : "Snap a photo", icon: "📸" }}
      logo={<Logo />}
      account={<AccountButton es={es} up block />}
      accountBar={<span className="hidden sm:block"><AccountButton es={es} /></span>}
      lang={<LangSwitch locale={l} />}
      contact={BRAND.supportPhone}
      slogan={BRAND_STORY.slogan[es ? "es" : "en"]}
      menuLabel={es ? "Abrir menú" : "Open menu"}
    />
  );
}

/** Every public page: the side menu, then the page offset to its right on computers. */
export async function SiteShell({ children, footer = true }: { children: React.ReactNode; footer?: boolean }) {
  return (
    <>
      <SiteHeader />
      <div className="lg:pl-64">
        <main>{children}</main>
        {footer && <SiteFooter />}
      </div>
    </>
  );
}

export async function SiteFooter() {
  const l = await getLocale();
  const es = l === "es";
  const L = es ? "es" : "en";
  const t = (s: string) => tr(l, s);
  const col = (title: string, items: { href: string; label: string }[]) => (
    <div>
      <div className="text-sm font-semibold">{title}</div>
      <ul className="mt-3 space-y-2 text-sm text-ink-soft">{items.map((x) => <li key={x.href}><Link href={x.href} className="hover:text-ink">{x.label}</Link></li>)}</ul>
    </div>
  );
  return (
    <footer className="mt-24 border-t-2 border-gold/60 bg-paper-deep">
      <div className="wrap grid gap-10 py-12 md:grid-cols-5">
        <div className="md:col-span-2">
          <Logo />
          <p className="mt-3 text-lg font-bold text-brand">{BRAND_STORY.slogan[L]}</p>
          <p className="mt-2 max-w-sm text-sm text-ink-soft">{BRAND_STORY.short[L]}</p>
          <p className="mt-4 text-sm">{BRAND.supportPhone} · <a href={`mailto:${BRAND.supportEmail}`} className="hover:text-brand">{BRAND.supportEmail}</a></p>
          <p className="mt-3 text-xs text-ink-soft">{BRAND.partner}</p>
        </div>
        {col(t("Services"), [
          ...CATEGORIES.slice(0, 6).map((c) => ({ href: categoryHref(c.id), label: categoryText(l, c.id, c).name })),
          { href: "/technology", label: es ? "Negocios y tecnología" : "Business & Technology" },
          { href: "/services", label: es ? `Los ${SERVICES.length} servicios →` : `All ${SERVICES.length} services →` },
        ])}
        {col(t("Company"), [
          { href: "/network", label: es ? "Red Handled" : "Handled Network" },
          { href: "/business", label: t("Commercial accounts") },
          { href: "/events", label: t("Parties & events") },
          { href: "/talent", label: t("Recruiting (Handled Talent)") },
          { href: "/reviews", label: t("Customer reviews") },
          { href: "/contact", label: es ? "Contacto" : "Contact" },
        ])}
        {col(es ? "Trabaje con nosotros" : "Work with us", [
          { href: "/pros#apply", label: es ? "Hágase profesional" : "Become a pro" },
          { href: "/careers", label: es ? "Empleos" : "Careers" },
          { href: "/pros#rewards", label: t("Pro Rewards & tiers") },
          { href: "/partners#join", label: es ? "Hágase socio" : "Become a partner" },
          { href: "/plus", label: "Handled Plus" },
          { href: "/gift-cards", label: t("Gift cards") },
        ])}
      </div>
      <div className="border-t border-line py-4 text-center text-xs text-ink-soft">
        © {new Date().getFullYear()} {BRAND.legalName}{process.env.BUSINESS_POSTAL_ADDRESS ? ` · ${process.env.BUSINESS_POSTAL_ADDRESS}` : ""}
        <span className="mx-1">·</span><Link href="/terms/terms-of-use" className="hover:text-ink">{l === "es" ? "Términos de uso" : "Terms of Use"}</Link>
        <span className="mx-1">·</span><Link href="/terms/service-agreement" className="hover:text-ink">{l === "es" ? "Contrato de servicio" : "Service Agreement"}</Link>
        <span className="mx-1">·</span><Link href="/terms" className="hover:text-ink">{l === "es" ? "Todos los términos" : "All terms"}</Link>
        <span className="mx-1">·</span><Link href="/privacy" className="hover:text-ink">{l === "es" ? "Privacidad y cookies" : "Privacy & cookies"}</Link>
        <span className="mx-1">·</span><Link href="/accessibility" className="hover:text-ink">{l === "es" ? "Accesibilidad" : "Accessibility"}</Link>
        <span className="mx-1">·</span><Link href="/contact" className="hover:text-ink">{l === "es" ? "Contacto" : "Contact"}</Link>
      </div>
    </footer>
  );
}
