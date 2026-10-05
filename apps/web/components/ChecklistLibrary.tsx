/*
 * FILE    : apps/web/components/ChecklistLibrary.tsx
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-05_0221 UTC
 * PURPOSE : The checklist library (Hub → Checklists, and the pro portal): every service's checklist, with which
 *           items appear for which booking (standard / deep / move-out, pets, inside fridge & oven…). Printable.
 *           Server component; English or Spanish.
 */
import { SERVICES, checklistOutline, serviceText } from "@handled/core";
import { PrintButton } from "./PrintButton";

export function ChecklistLibrary({ es, audience }: { es: boolean; audience: "staff" | "pro" }) {
  const all = SERVICES.map((s) => ({ s, o: checklistOutline(s.slug, es ? "es" : "en") }));
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{es ? "Listas de trabajo" : "Job checklists"}</h1>
          <p className="max-w-3xl text-sm text-ink-soft">{es
            ? "Cada trabajo llega con su lista: lo que el cliente reservó, punto por punto, y arriba las instrucciones especiales. Describe el resultado, no cómo trabajar: usted elige sus métodos y herramientas. Los puntos con * son obligatorios (o N/A con el motivo); 📷 = foto."
            : "Every job comes with its checklist: what the customer booked, item by item, with any special instructions on top. It describes the result, not how to work — pros choose their own methods and tools. Items marked * are required (or N/A with a reason); 📷 = photo."}</p>
          {audience === "staff" && <p className="mt-1 text-xs text-ink-soft">Templates live in packages/core/src/checklists.ts (versioned; a job keeps the version it was accepted with). For one job, add special instructions on the Hub job page.</p>}
        </div>
        <PrintButton />
      </div>
      <nav className="flex flex-wrap gap-2 text-xs print:hidden">{all.map(({ s }) => <a key={s.slug} href={`#${s.slug}`} className="rounded-full border border-line px-2 py-1 hover:border-brand">{s.icon} {es ? serviceText("es", s.slug, s).name : s.name}</a>)}</nav>
      {all.map(({ s, o }) => (
        <section key={s.slug} id={s.slug} className="card break-inside-avoid">
          <div className="flex flex-wrap items-baseline justify-between gap-2"><h2 className="text-lg font-bold">{s.icon} {o.title}</h2><span className="text-xs text-ink-soft">v{o.version}{o.custom ? "" : es ? " · general" : " · general"}</span></div>
          {o.variants.length > 0 && <p className="text-xs text-ink-soft">{es ? "Versiones: " : "Versions: "}{o.variants.join(" · ")}</p>}
          <div className="mt-3 grid gap-4 md:grid-cols-2">
            {o.sections.map((sec) => (
              <div key={sec.id}>
                <div className="text-xs font-semibold uppercase tracking-wide text-ink-soft">{sec.title}{sec.when && <span className="ml-1 normal-case text-brand">({es ? "solo" : "only"}: {sec.when})</span>}</div>
                <ul className="mt-1 space-y-0.5 text-sm">{sec.items.map((x) => (
                  <li key={x.id}>☐ {x.text}{x.required && <span className="text-rose-700"> *</span>}{x.photo && " 📷"}{x.when && <span className="ml-1 text-xs text-brand">({es ? "solo" : "only"}: {x.when})</span>}</li>
                ))}</ul>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
