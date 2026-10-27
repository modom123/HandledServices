/*
 * FILE    : apps/web/components/SiteNav.tsx
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-06_0802 UTC
 * PURPOSE : Header menus. Desktop: Services · For Business · Become a Pro · More, each a dropdown (opens on hover or
 *           click, closes on Escape / outside click / navigation; keyboard and screen-reader friendly). Phones: a ☰
 *           button opens one panel with the same sections as accordions plus the language switch (before, phones had
 *           no menu at all). Menu text arrives already translated from the server header. The phone panel is portaled
 *           to <body> so the header's backdrop blur can't clip it.
 * UPDATED : 2026-10-27_1500 UTC — SideNav: the public website's menu moved from the header to a side menu. Computers: a fixed
 *           menu down the left (Book now and Snap a photo at the top, each section an accordion that opens on the page you're
 *           on, account / language / contact at the bottom). Phones and tablets: a slim top bar (logo, Book now, ☰) whose ☰
 *           slides the same menu in from the left. DesktopNav / MobileNav stay for the pro portal's header.
 */
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ThemedIcon } from "./Glyph";

export type NavItem = { href: string; label: string; icon?: string; hint?: string };
export type NavGroup = { id: string; label: string; items: NavItem[]; footer?: NavItem; wide?: boolean };

export function DesktopNav({ groups }: { groups: NavGroup[] }) {
  const [open, setOpen] = useState<string | null>(null);
  const box = useRef<HTMLElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const path = usePathname();
  useEffect(() => setOpen(null), [path]);
  useEffect(() => {
    const away = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(null); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(null); };
    document.addEventListener("click", away);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("click", away); document.removeEventListener("keydown", esc); };
  }, []);
  const hover = (id: string | null) => { if (timer.current) clearTimeout(timer.current); timer.current = setTimeout(() => setOpen(id), id ? 60 : 180); };
  return (
    <nav ref={box} className="hidden items-center gap-1 text-[15px] font-semibold text-ink md:flex" aria-label="Main">
      {groups.map((g) => (
        <div key={g.id} className="relative" onMouseEnter={() => hover(g.id)} onMouseLeave={() => hover(null)}>
          <button type="button" aria-expanded={open === g.id} aria-haspopup="true" onClick={() => setOpen(open === g.id ? null : g.id)} className={`flex items-center gap-1 rounded-lg px-3 py-2 hover:text-brand ${open === g.id ? "text-brand" : ""}`}>
            {g.label}<span aria-hidden className={`text-xs transition ${open === g.id ? "rotate-180" : ""}`}>▾</span>
          </button>
          {open === g.id && (
            <div className={`absolute left-0 top-full z-40 pt-2 ${g.wide ? "w-[34rem]" : "w-72"}`}>
              <div className="rounded-2xl border border-line bg-white p-2 shadow-xl">
                <ul className={g.wide ? "grid grid-cols-2 gap-0.5" : "space-y-0.5"}>
                  {g.items.map((it) => <li key={it.href}><MenuLink it={it} /></li>)}
                </ul>
                {g.footer && <div className="mt-1 border-t border-line pt-1"><MenuLink it={g.footer} strong /></div>}
              </div>
            </div>
          )}
        </div>
      ))}
    </nav>
  );
}

function MenuLink({ it, strong }: { it: NavItem; strong?: boolean }) {
  return (
    <Link href={it.href} className="flex items-start gap-2 rounded-xl px-3 py-2 hover:bg-paper">
      {it.icon && <ThemedIcon icon={it.icon} emojiClass="text-lg leading-6" />}
      <span><span className={`block leading-6 ${strong ? "text-brand" : "text-ink"}`}>{it.label}</span>{it.hint && <span className="block text-xs font-normal text-ink-soft">{it.hint}</span>}</span>
    </Link>
  );
}

export function MobileNav({ groups, lang, cta }: { groups: NavGroup[]; lang: ReactNode; cta: NavItem }) {
  const [open, setOpen] = useState(false);
  const [section, setSection] = useState<string | null>(groups[0]?.id ?? null);
  const path = usePathname();
  useEffect(() => setOpen(false), [path]);
  useEffect(() => {
    if (!open) return;
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", esc);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", esc); document.body.style.overflow = prev; };
  }, [open]);
  return (
    <div className="md:hidden">
      <button type="button" aria-expanded={open} aria-controls="mobile-menu" aria-label={open ? "Close menu" : "Open menu"} onClick={() => setOpen(!open)} className="grid h-9 w-9 place-items-center rounded-full border border-line bg-white text-lg">
        {open ? "✕" : "☰"}
      </button>
      {/* portal: the header's backdrop blur would otherwise trap this fixed panel inside the 64px header */}
      {open && createPortal(
        <div id="mobile-menu" className="fixed inset-x-0 bottom-0 top-16 z-40 overflow-y-auto border-t border-line bg-paper px-4 pb-10 pt-2">
          {groups.map((g) => (
            <div key={g.id} className="border-b border-line">
              <button type="button" aria-expanded={section === g.id} onClick={() => setSection(section === g.id ? null : g.id)} className="flex w-full items-center justify-between py-4 text-left text-lg font-bold text-ink">
                {g.label}<span aria-hidden className={`text-sm transition ${section === g.id ? "rotate-180" : ""}`}>▾</span>
              </button>
              {section === g.id && (
                <ul className={`pb-3 ${g.wide ? "grid grid-cols-2 gap-1" : "space-y-1"}`}>
                  {[...g.items, ...(g.footer ? [g.footer] : [])].map((it) => (
                    <li key={it.href}><Link href={it.href} className="flex items-center gap-2 rounded-xl bg-white px-3 py-3 text-[15px] font-semibold text-ink ring-1 ring-line">{it.icon && <span>{it.icon}</span>}{it.label}</Link></li>
                  ))}
                </ul>
              )}
            </div>
          ))}
          <div className="mt-5 flex items-center justify-between">
            {lang}
            <Link href={cta.href} className="btn-primary px-6">{cta.label}</Link>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}

/** The website's side menu (see the file header). Logo, account and language arrive rendered from the server. */
export function SideNav({ groups, links, primary, secondary, logo, account, accountBar, lang, contact, slogan, menuLabel }: {
  groups: NavGroup[]; links: NavItem[]; primary: NavItem; secondary: NavItem; logo: ReactNode; account: ReactNode; accountBar: ReactNode;
  lang: ReactNode; contact: string; slogan: string; menuLabel: string;
}) {
  const path = usePathname() || "/";
  // links with ?query or #anchor (e.g. /services?cat=…) never light up: the path alone would match all of them
  const here = (href: string) => !/[?#]/.test(href) && href !== "/" && (path === href || path.startsWith(href + "/"));
  const start = groups.find((g) => [...g.items, ...(g.footer ? [g.footer] : [])].some((it) => here(it.href.split(/[?#]/)[0])))?.id ?? null; // all closed except the section you're in
  const [open, setOpen] = useState(false);
  const [section, setSection] = useState<string | null>(start);
  useEffect(() => setOpen(false), [path]);
  useEffect(() => {
    if (!open) return;
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", esc);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", esc); document.body.style.overflow = prev; };
  }, [open]);
  return (
    <>
      {/* phones & tablets: slim top bar */}
      <header className="site-header sticky top-0 z-30 border-b border-t-[3px] border-line border-t-gold bg-page/95 backdrop-blur lg:hidden">
        <div className="flex h-16 items-center justify-between gap-2 px-4">
          {logo}
          <div className="flex items-center gap-2">
            {accountBar}
            <Link href={primary.href} className="btn-primary whitespace-nowrap px-3.5 text-sm">{primary.label}</Link>
            <button type="button" aria-expanded={open} aria-controls="side-menu" aria-label={menuLabel} onClick={() => setOpen(true)} className="grid h-9 w-9 place-items-center rounded-full border border-line bg-white text-lg">☰</button>
          </div>
        </div>
      </header>
      {open && <button type="button" aria-label="Close menu" onClick={() => setOpen(false)} className="fixed inset-0 z-40 bg-ink/40 lg:hidden" />}
      <aside id="side-menu" aria-label="Main" className={`site-sidebar fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-line bg-white shadow-xl transition-transform duration-200 lg:z-30 lg:w-64 lg:translate-x-0 lg:shadow-none ${open ? "visible translate-x-0" : "invisible -translate-x-full lg:visible"}`}>
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-t-[3px] border-line border-t-gold px-4">
          {logo}
          <button type="button" onClick={() => setOpen(false)} aria-label="Close menu" className="grid h-8 w-8 place-items-center rounded-full text-lg text-ink-soft hover:bg-paper lg:hidden">✕</button>
        </div>
        <div className="shrink-0 space-y-2 px-4 pt-4">
          <Link href={primary.href} className="btn-primary w-full justify-center">{primary.label}</Link>
          <Link href={secondary.href} className="btn-ghost w-full justify-center text-sm">{secondary.icon} {secondary.label}</Link>
        </div>
        <nav className="mt-3 flex-1 overflow-y-auto px-3 pb-4 text-[15px]">
          {groups.map((g) => (
            <div key={g.id} className="border-b border-line/70 last:border-0">
              <button type="button" aria-expanded={section === g.id} onClick={() => setSection(section === g.id ? null : g.id)} className="flex w-full items-center justify-between rounded-lg px-2 py-2.5 text-left font-bold text-ink hover:text-brand">
                {g.label}<span aria-hidden className={`text-xs text-ink-soft transition ${section === g.id ? "rotate-180" : ""}`}>▾</span>
              </button>
              {section === g.id && (
                <ul className="space-y-0.5 pb-2">
                  {[...g.items, ...(g.footer ? [g.footer] : [])].map((it, i) => (
                    <li key={it.href + i}>
                      <Link href={it.href} aria-current={here(it.href) ? "page" : undefined} className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm ${here(it.href) ? "bg-brand-tint font-semibold text-brand-dark" : it === g.footer ? "font-semibold text-brand hover:bg-paper" : "text-ink-soft hover:bg-paper hover:text-ink"}`}>
                        {it.icon && <span className="w-5 text-center">{it.icon}</span>}<span className="leading-snug">{it.label}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
          <ul className="mt-2 space-y-0.5 border-t border-line pt-2">
            {links.map((it) => (
              <li key={it.href}><Link href={it.href} aria-current={here(it.href) ? "page" : undefined} className={`flex items-center gap-2 rounded-lg px-2 py-2 font-semibold ${here(it.href) ? "bg-brand-tint text-brand-dark" : "text-ink hover:bg-paper hover:text-brand"}`}>{it.icon && <span className="w-5 text-center">{it.icon}</span>}{it.label}</Link></li>
            ))}
          </ul>
        </nav>
        <div className="shrink-0 space-y-3 border-t border-line p-4">
          {account}
          <div className="flex items-center justify-between text-xs text-ink-soft">{lang}<span>{contact}</span></div>
          <p className="text-xs font-semibold text-brand">{slogan}</p>
        </div>
      </aside>
    </>
  );
}
