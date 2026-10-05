/*
 * FILE    : apps/web/components/site.tsx
 * PROJECT : Handled — AI-run home & business services
 * CREATED : 2026-10-01_1723 UTC
 * UPDATED : 2026-10-02_1329 UTC — footer: Handled Plus, gift cards, reviews; English / Spanish.
 * PURPOSE : Public website header and footer.
 * UPDATED : 2026-10-05_0434 UTC — one account button (Sign in → My account / Pro portal / Hub, with Sign out), visible on phones.
 * UPDATED : 2026-10-05_0448 UTC — 📸 Snap & post a job button in the header (phones too).
 */
import { AccountButton } from "./AccountButton";
import Link from "next/link";
import { BRAND, CATEGORIES, categoryText, t as tr } from "@handled/core";
import { getLocale } from "@/lib/locale";
import { LangSwitch } from "./LangSwitch";

export function Logo({ className = "" }: { className?: string }) {
  return (
    <Link href="/home" className={`flex items-center gap-2 font-extrabold tracking-tight ${className}`}>
      <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand text-white">✓</span>
      <span className="text-lg">{BRAND.name}</span>
    </Link>
  );
}

export async function SiteHeader() {
  const l = await getLocale();
  const t = (s: string) => tr(l, s);
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-paper/90 backdrop-blur">
      <div className="wrap flex h-16 items-center justify-between gap-4">
        <Logo />
        <nav className="hidden items-center gap-6 text-sm font-medium text-ink-soft md:flex">
          <Link href="/services" className="hover:text-ink">{t("Services")}</Link>
          <Link href="/events" className="hover:text-ink">{t("Events")}</Link>
          <Link href="/business" className="hover:text-ink">{t("For Business")}</Link>
          <Link href="/pros" className="hover:text-ink">{t("Become a Pro")}</Link>
        </nav>
        <div className="flex items-center gap-2">
          <AccountButton es={l === "es"} />
          <LangSwitch locale={l} />
          <Link href="/snap" title={l === "es" ? "Tome una foto y publique su trabajo" : "Snap a photo, post a job"} className="grid h-10 w-10 place-items-center rounded-full border border-line bg-white text-lg hover:border-brand" aria-label={l === "es" ? "Tome una foto y publique su trabajo" : "Snap a photo, post a job"}>📸</Link>
          <Link href="/book" className="btn-primary">{t("Book now")}</Link>
        </div>
      </div>
    </header>
  );
}

export async function SiteFooter() {
  const l = await getLocale();
  const t = (s: string) => tr(l, s);
  return (
    <footer className="mt-24 border-t border-line bg-paper-deep">
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
            <li><Link href="/plus" className="hover:text-ink">⭐ Handled Plus</Link></li>
            <li><Link href="/gift-cards" className="hover:text-ink">🎁 {t("Gift cards")}</Link></li>
            <li><Link href="/reviews" className="hover:text-ink">{t("Customer reviews")}</Link></li>
            <li><Link href="/pros" className="hover:text-ink">{t("Join as a pro")}</Link></li>
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
