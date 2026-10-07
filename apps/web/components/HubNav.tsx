/*
 * FILE    : apps/web/components/HubNav.tsx
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-07_0200 UTC
 * PURPOSE : Handled Hub menu as dropdown sections (Operations, Pros, Sales, Money, Growth & website, Settings) instead of one
 *           long list. The section holding the current page opens itself and the page is highlighted. Phones get a ☰ Menu
 *           button that opens the same sections.
 */
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

export type HubLink = readonly [href: string, icon: string, label: string];
export type HubGroup = { id: string; label: string; links: readonly HubLink[] };

const active = (path: string, href: string) => (href === "/hub" ? path === "/hub" : path === href || path.startsWith(`${href}/`));

function Sections({ groups, path }: { groups: HubGroup[]; path: string }) {
  const current = groups.find((g) => g.links.some(([h]) => active(path, h)))?.id ?? groups[0]?.id;
  const [open, setOpen] = useState<Set<string>>(new Set([current]));
  useEffect(() => { setOpen((s) => new Set([...s, current])); }, [current]);
  return (
    <div className="space-y-1">
      {groups.map((g) => {
        const isOpen = open.has(g.id);
        return (
          <div key={g.id}>
            <button type="button" aria-expanded={isOpen} onClick={() => setOpen((s) => { const n = new Set(s); if (n.has(g.id)) n.delete(g.id); else n.add(g.id); return n; })}
              className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-xs font-bold uppercase tracking-wider text-white/60 hover:bg-white/5 hover:text-white">
              {g.label}<span aria-hidden className={`transition ${isOpen ? "rotate-180" : ""}`}>▾</span>
            </button>
            {isOpen && (
              <div className="mb-2 space-y-0.5">
                {g.links.map(([href, icon, label]) => (
                  <Link key={href} href={href} aria-current={active(path, href) ? "page" : undefined}
                    className={`block rounded-lg px-3 py-1.5 text-sm ${active(path, href) ? "bg-white/15 font-semibold text-white" : "text-white/80 hover:bg-white/10 hover:text-white"}`}>{icon} {label}</Link>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function HubNav({ groups }: { groups: HubGroup[] }) {
  const path = usePathname();
  const [mobile, setMobile] = useState(false);
  useEffect(() => setMobile(false), [path]);
  return (
    <>
      <nav className="mt-6 hidden md:block" aria-label="Hub"><Sections groups={groups} path={path} /></nav>
      <div className="mt-3 md:hidden">
        <button type="button" aria-expanded={mobile} onClick={() => setMobile(!mobile)} className="w-full rounded-lg bg-white/10 px-3 py-2 text-left text-sm font-semibold">{mobile ? "✕ Close menu" : "☰ Menu"}</button>
        {mobile && <nav className="mt-2" aria-label="Hub"><Sections groups={groups} path={path} /></nav>}
      </div>
    </>
  );
}
