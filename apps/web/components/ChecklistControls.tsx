/*
 * FILE    : apps/web/components/ChecklistControls.tsx
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-11_0548 UTC
 * PURPOSE : Controls for the checklist library's dropdowns (components/ChecklistLibrary): a "Jump to a service" menu grouped
 *           by category, Expand all / Collapse all, and Print (opens every dropdown first so the PDF has every checklist).
 *           A link to #service-slug opens that service and its category.
 */
"use client";

import { useEffect } from "react";

export type ChecklistGroup = { id: string; label: string; services: { slug: string; label: string }[] };

const all = () => Array.from(document.querySelectorAll<HTMLDetailsElement>("details[data-checklist]"));

/** Open a service's dropdown (and its category's), then scroll to it. */
function reveal(slug: string) {
  const el = document.getElementById(slug);
  if (!(el instanceof HTMLDetailsElement)) return;
  el.open = true;
  const cat = el.parentElement?.closest("details");
  if (cat) cat.open = true;
  el.scrollIntoView({ behavior: "smooth", block: "start" });
}

export function ChecklistControls({ groups, es }: { groups: ChecklistGroup[]; es: boolean }) {
  useEffect(() => {
    const go = () => { const slug = decodeURIComponent(window.location.hash.slice(1)); if (slug) reveal(slug); };
    go();
    window.addEventListener("hashchange", go);
    return () => window.removeEventListener("hashchange", go);
  }, []);

  const setAll = (open: boolean) => all().forEach((d) => { d.open = open; });
  const print = () => {
    const before = all().map((d) => d.open);
    setAll(true);
    window.addEventListener("afterprint", () => all().forEach((d, i) => { d.open = before[i] ?? false; }), { once: true });
    window.print();
  };

  return (
    <div className="flex flex-wrap items-center gap-2 print:hidden">
      <select className="input w-auto min-w-56" defaultValue="" aria-label={es ? "Ir a un servicio" : "Jump to a service"}
        onChange={(e) => { const slug = e.target.value; if (!slug) return; history.replaceState(null, "", `#${slug}`); reveal(slug); e.target.value = ""; }}>
        <option value="">{es ? "Ir a un servicio…" : "Jump to a service…"}</option>
        {groups.map((g) => (
          <optgroup key={g.id} label={g.label}>
            {g.services.map((s) => <option key={s.slug} value={s.slug}>{s.label}</option>)}
          </optgroup>
        ))}
      </select>
      <button type="button" className="btn-ghost" onClick={() => setAll(true)}>{es ? "Abrir todo" : "Expand all"}</button>
      <button type="button" className="btn-ghost" onClick={() => setAll(false)}>{es ? "Cerrar todo" : "Collapse all"}</button>
      <button type="button" className="btn-ghost" onClick={print}>{es ? "Imprimir / PDF" : "Print / save PDF"}</button>
    </div>
  );
}
