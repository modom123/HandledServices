/*
 * FILE    : apps/web/components/site.tsx
 * PROJECT : Handled — AI-run home & business services
 * CREATED : 2026-10-01_1723 UTC
 * UPDATED : 2026-10-02_1329 UTC — footer: Handled Plus, gift cards, reviews.
 * PURPOSE : Public website header and footer.
 */
import Link from "next/link";
import { BRAND, CATEGORIES } from "@handled/core";

export function Logo({ className = "" }: { className?: string }) {
  return (
    <Link href="/home" className={`flex items-center gap-2 font-extrabold tracking-tight ${className}`}>
      <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand text-white">✓</span>
      <span className="text-lg">{BRAND.name}</span>
    </Link>
  );
}

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-paper/90 backdrop-blur">
      <div className="wrap flex h-16 items-center justify-between gap-4">
        <Logo />
        <nav className="hidden items-center gap-6 text-sm font-medium text-ink-soft md:flex">
          <Link href="/services" className="hover:text-ink">Services</Link>
          <Link href="/events" className="hover:text-ink">Events</Link>
          <Link href="/business" className="hover:text-ink">For Business</Link>
          <Link href="/pros" className="hover:text-ink">Become a Pro</Link>
          <Link href="/account" className="hover:text-ink">My Bookings</Link>
        </nav>
        <div className="flex items-center gap-2">
          <Link href="/login" className="hidden text-sm font-medium text-ink-soft hover:text-ink sm:block">Sign in</Link>
          <Link href="/book" className="btn-primary">Book now</Link>
        </div>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-line bg-paper-deep">
      <div className="wrap grid gap-10 py-12 md:grid-cols-4">
        <div className="md:col-span-2">
          <Logo />
          <p className="mt-3 max-w-sm text-sm text-ink-soft">{BRAND.pitch}</p>
          <p className="mt-4 text-xs text-ink-soft">{BRAND.partner}</p>
        </div>
        <div>
          <div className="text-sm font-semibold">Services</div>
          <ul className="mt-3 space-y-2 text-sm text-ink-soft">
            {CATEGORIES.map((c) => (
              <li key={c.id}><Link href={`/services?cat=${c.id}`} className="hover:text-ink">{c.icon} {c.name}</Link></li>
            ))}
          </ul>
        </div>
        <div>
          <div className="text-sm font-semibold">Company</div>
          <ul className="mt-3 space-y-2 text-sm text-ink-soft">
            <li><Link href="/events" className="hover:text-ink">Parties & events</Link></li>
            <li><Link href="/business" className="hover:text-ink">Commercial accounts</Link></li>
            <li><Link href="/plus" className="hover:text-ink">⭐ Handled Plus</Link></li>
            <li><Link href="/gift-cards" className="hover:text-ink">🎁 Gift cards</Link></li>
            <li><Link href="/reviews" className="hover:text-ink">Customer reviews</Link></li>
            <li><Link href="/pros" className="hover:text-ink">Join as a pro</Link></li>
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
