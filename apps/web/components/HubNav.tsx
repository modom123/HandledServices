/*
 * FILE    : apps/web/components/HubNav.tsx
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-07_0200 UTC
 * PURPOSE : Handled Hub menu as dropdown sections (Operations, Pros, Sales, Money, Growth & website, Settings) instead of one
 *           long list. The section holding the current page opens itself and the page is highlighted. Phones get a ☰ Menu
 *           button that opens the same sections.
 * UPDATED : 2026-10-15_0100 UTC — Mastermind declutter: the sidebar is Daily Briefing, Dashboard and one link per section
 *           (Pros, Jobs, Clients, Money, Growth, AI team, Settings) — 9 links instead of 41. The pages inside the current
 *           section show as tabs across the top of the page (SectionTabs). The map lives in lib/hub-sections.
 * UPDATED : 2026-10-27_1700 UTC — the section's tab lights up by the most specific match or an alias (activeTab).
 */
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { HUB_TOP, activeTab, sectionOf, topActive, type HubSection } from "@/lib/hub-sections";

const item = (on: boolean) => `flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${on ? "bg-white/15 font-semibold text-white" : "text-white/80 hover:bg-white/10 hover:text-white"}`;

function Links({ sections, path }: { sections: HubSection[]; path: string }) {
  const current = sectionOf(sections, path)?.id;
  return (
    <div className="space-y-0.5">
      {HUB_TOP.map(([href, icon, label]) => (
        <Link key={href} href={href} aria-current={topActive(path, href) ? "page" : undefined} className={item(topActive(path, href))}><span aria-hidden>{icon}</span>{label}</Link>
      ))}
      <div className="my-3 border-t border-white/10" />
      {sections.map((s) => (
        <Link key={s.id} href={s.links[0][0]} aria-current={current === s.id ? "true" : undefined} className={item(current === s.id)}>
          <span aria-hidden>{s.icon}</span><span className="flex-1">{s.label}</span><span className="text-xs text-white/40">{s.links.length}</span>
        </Link>
      ))}
    </div>
  );
}

export function HubNav({ sections }: { sections: HubSection[] }) {
  const path = usePathname();
  const [mobile, setMobile] = useState(false);
  useEffect(() => setMobile(false), [path]);
  return (
    <>
      <nav className="mt-6 hidden md:block" aria-label="Mastermind"><Links sections={sections} path={path} /></nav>
      <div className="mt-3 md:hidden">
        <button type="button" aria-expanded={mobile} onClick={() => setMobile(!mobile)} className="w-full rounded-lg bg-white/10 px-3 py-2 text-left text-sm font-semibold">{mobile ? "✕ Close menu" : "☰ Menu"}</button>
        {mobile && <nav className="mt-2" aria-label="Mastermind"><Links sections={sections} path={path} /></nav>}
      </div>
    </>
  );
}

/** Tabs for the pages in the current section, across the top of the page. Nothing on pages outside a section. */
export function SectionTabs({ sections }: { sections: HubSection[] }) {
  const path = usePathname();
  const s = sectionOf(sections, path);
  if (!s) return null;
  const tab = activeTab(s, path);
  return (
    <div className="mb-6 -mt-1 border-b border-line">
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-soft">{s.icon} {s.label}</div>
      <nav className="-mb-px flex gap-1 overflow-x-auto" aria-label={s.label}>
        {s.links.map(([href, label]) => {
          const on = href === tab;
          return (
            <Link key={href} href={href} aria-current={on ? "page" : undefined}
              className={`whitespace-nowrap border-b-2 px-3 py-2 text-sm ${on ? "border-brand font-semibold text-ink" : "border-transparent text-ink-soft hover:border-line hover:text-ink"}`}>{label}</Link>
          );
        })}
      </nav>
    </div>
  );
}
