/*
 * FILE    : apps/web/components/SiteNav.tsx
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-06_0802 UTC
 * PURPOSE : Header menus. Desktop: Services · For Business · Become a Pro · More, each a dropdown (opens on hover or
 *           click, closes on Escape / outside click / navigation; keyboard and screen-reader friendly). Phones: a ☰
 *           button opens one panel with the same sections as accordions plus the language switch (before, phones had
 *           no menu at all). Menu text arrives already translated from the server header. The phone panel is portaled
 *           to <body> so the header's backdrop blur can't clip it.
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
