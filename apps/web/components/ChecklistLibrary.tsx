/*
 * FILE    : apps/web/components/ChecklistLibrary.tsx
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-05_0221 UTC
 * PURPOSE : The checklist library (Hub → Checklists, and the pro portal): every service's checklist, with which
 *           items appear for which booking (standard / deep / move-out, pets, inside fridge & oven…). Printable.
 *           Server component; English or Spanish.
 * UPDATED : 2026-10-11_0548 UTC — organized as dropdowns: one per service category, and each service's checklist is its own
 *           dropdown inside it (summary shows version and item counts). "Jump to a service" menu, Expand / Collapse all,
 *           and Print opens everything first (components/ChecklistControls).
 */
import { CATEGORIES, SERVICES, categoryText, checklistOutline, serviceText } from "@handled/core";
import { ChecklistControls, type ChecklistGroup } from "./ChecklistControls";

export function ChecklistLibrary({ es, audience }: { es: boolean; audience: "staff" | "pro" }) {
  const lang = es ? "es" : "en";
  const label = (s: (typeof SERVICES)[number]) => (es ? serviceText("es", s.slug, s).name : s.name);
  const groups = CATEGORIES.map((c) => ({
    c,
    name: categoryText(lang, c.id, c).name,
    items: SERVICES.filter((s) => s.category === c.id).map((s) => ({ s, o: checklistOutline(s.slug, lang) })),
  })).filter((g) => g.items.length);
  const menu: ChecklistGroup[] = groups.map((g) => ({ id: g.c.id, label: `${g.c.icon} ${g.name}`, services: g.items.map(({ s }) => ({ slug: s.slug, label: `${s.icon} ${label(s)}` })) }));
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{es ? "Listas de trabajo" : "Job checklists"}</h1>
        <p className="max-w-3xl text-sm text-ink-soft">{es
          ? "Cada trabajo llega con su lista: lo que el cliente reservó, punto por punto, y arriba las instrucciones especiales. Describe el resultado, no cómo trabajar: usted elige sus métodos y herramientas. Los puntos con * son obligatorios (o N/A con el motivo); 📷 = foto."
          : "Every job comes with its checklist: what the customer booked, item by item, with any special instructions on top. It describes the result, not how to work — pros choose their own methods and tools. Items marked * are required (or N/A with a reason); 📷 = photo."}</p>
        {audience === "staff" && <p className="mt-1 text-xs text-ink-soft">Templates live in packages/core/src/checklists.ts (versioned; a job keeps the version it was accepted with). For one job, add special instructions on the Hub job page.</p>}
      </div>
      <ChecklistControls groups={menu} es={es} />
      <div className="space-y-3">
        {groups.map((g) => (
          <details key={g.c.id} data-checklist className="group/cat card p-0">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4 [&::-webkit-details-marker]:hidden">
              <span className="text-lg font-bold">{g.c.icon} {g.name}</span>
              <span className="flex items-center gap-2 text-xs text-ink-soft">{g.items.length} {es ? (g.items.length === 1 ? "servicio" : "servicios") : g.items.length === 1 ? "service" : "services"}<span aria-hidden className="transition group-open/cat:rotate-180">▾</span></span>
            </summary>
            <div className="space-y-2 border-t border-line p-3">
              {g.items.map(({ s, o }) => {
                const items = o.sections.flatMap((sec) => sec.items);
                const required = items.filter((x) => x.required).length;
                return (
                  <details key={s.slug} id={s.slug} data-checklist className="group/svc scroll-mt-4 break-inside-avoid rounded-xl border border-line">
                    <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-2 px-3 py-2 hover:bg-paper [&::-webkit-details-marker]:hidden">
                      <span className="font-semibold">{s.icon} {o.title}</span>
                      <span className="flex items-center gap-2 text-xs text-ink-soft">v{o.version}{o.custom ? "" : " · general"} · {items.length} {es ? "puntos" : "items"} · {required} {es ? "obligatorios" : "required"}<span aria-hidden className="transition group-open/svc:rotate-180">▾</span></span>
                    </summary>
                    <div className="border-t border-line p-3">
                      {o.variants.length > 0 && <p className="text-xs text-ink-soft">{es ? "Versiones: " : "Versions: "}{o.variants.join(" · ")}</p>}
                      <div className="mt-2 grid gap-4 md:grid-cols-2">
                        {o.sections.map((sec) => (
                          <div key={sec.id}>
                            <div className="text-xs font-semibold uppercase tracking-wide text-ink-soft">{sec.title}{sec.when && <span className="ml-1 normal-case text-brand">({es ? "solo" : "only"}: {sec.when})</span>}</div>
                            <ul className="mt-1 space-y-0.5 text-sm">{sec.items.map((x) => (
                              <li key={x.id}>☐ {x.text}{x.required && <span className="text-rose-700"> *</span>}{x.photo && " 📷"}{x.when && <span className="ml-1 text-xs text-brand">({es ? "solo" : "only"}: {x.when})</span>}</li>
                            ))}</ul>
                          </div>
                        ))}
                      </div>
                    </div>
                  </details>
                );
              })}
            </div>
          </details>
        ))}
      </div>
    </div>
  );
}
