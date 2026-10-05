/*
 * FILE    : apps/web/components/ServicesBrowser.tsx
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-02_0212 UTC
 * PURPOSE : Services page layout: categories down the left (a row of tabs on phones), the
 *           chosen category's service cards on the right. Every service stays in the HTML
 *           (others are just hidden) so search engines still see all links. The category is
 *           kept in the URL (?cat=transport) so it can be linked and shared.
 * UPDATED : 2026-10-05_1433 UTC — Security category links to Event Security.
 */
"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

export type BrowserCategory = { id: string; name: string; icon: string; blurb: string; services: { slug: string; name: string; icon: string; tagline: string; from: string; siteVisit: boolean }[] };

export function ServicesBrowser({ categories, initial }: { categories: BrowserCategory[]; initial?: string }) {
  const [cat, setCat] = useState(categories.some((c) => c.id === initial) ? initial! : categories[0]?.id);
  const navRef = useRef<HTMLElement>(null);
  // keep the chosen tab in view on phones (the tab row scrolls sideways)
  useEffect(() => {
    navRef.current?.querySelector<HTMLElement>('[aria-current="true"]')?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [cat]);
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("cat");
    if (q && categories.some((c) => c.id === q)) setCat(q);
  }, [categories]);
  function pick(id: string) {
    setCat(id);
    const url = new URL(window.location.href);
    url.searchParams.set("cat", id);
    window.history.replaceState(null, "", url.toString());
  }
  return (
    <div className="mt-8 grid gap-6 lg:grid-cols-[290px_1fr] lg:gap-10">
      <nav ref={navRef} aria-label="Service categories" className="-mx-4 overflow-x-auto px-4 lg:mx-0 lg:overflow-visible lg:px-0">
        <ul className="flex gap-2 lg:sticky lg:top-24 lg:flex-col lg:gap-1">
          {categories.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => pick(c.id)}
                aria-current={cat === c.id ? "true" : undefined}
                className={`flex w-full items-center gap-2 whitespace-nowrap rounded-xl border px-3.5 py-2.5 text-left text-sm transition-colors lg:whitespace-normal ${cat === c.id ? "border-brand bg-brand-tint font-semibold text-brand-dark" : "border-line bg-white hover:border-brand lg:border-transparent lg:bg-transparent lg:hover:border-line lg:hover:bg-white"}`}
              >
                <span className="text-lg">{c.icon}</span>
                <span className="flex-1">{c.name}</span>
                <span className="text-xs text-ink-soft">{c.services.length}</span>
              </button>
            </li>
          ))}
        </ul>
      </nav>
      <div>
        {categories.map((c) => (
          <section key={c.id} hidden={cat !== c.id} aria-labelledby={`cat-${c.id}`}>
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div>
                <h2 id={`cat-${c.id}`} className="text-2xl font-bold">{c.icon} {c.name}</h2>
                <p className="mt-1 text-sm text-ink-soft">{c.blurb}</p>
              </div>
              {c.id === "events" && <Link href="/events" className="text-sm font-semibold text-brand">Plan an event by budget →</Link>}
              {c.id === "security" && <Link href="/services/event-security" className="text-sm font-semibold text-brand">Security for an event →</Link>}
            </div>
            <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {c.services.map((s) => (
                <Link key={s.slug} href={`/services/${s.slug}`} className="card flex flex-col transition hover:border-brand">
                  <div className="text-3xl">{s.icon}</div>
                  <div className="mt-3 font-semibold">{s.name}</div>
                  <p className="mt-1 flex-1 text-sm text-ink-soft">{s.tagline}</p>
                  <div className="mt-3 text-sm font-semibold text-brand">{s.from}{s.siteVisit ? " · free site visit" : ""}</div>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
