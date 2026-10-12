/*
 * FILE    : apps/web/app/hub/checklists/page.tsx
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-05_0221 UTC
 * PURPOSE : Hub → Checklists: the checklist library for every service (?lang=es for Spanish).
 * UPDATED : 2026-10-11_2250 UTC — now a checklist manager instead of the whole library: pick ONE checklist (saved or
 *           built-in) from a dropdown and see only that one; attach it to a job, email it to a pro, or save an edited
 *           copy. Saved checklists are stored (table saved_checklists) and can be edited or deleted. ?c=<source>,
 *           &edit=1 to edit (a built-in one opens as a copy), ?new=1 for a blank one. Pros keep their library in the portal.
 */
import Link from "next/link";
import { SERVICES, buildChecklist, defaultAnswers, getService, type ChecklistDraft, type JobChecklist } from "@handled/core";
import { adminClient } from "@/lib/supabase/server";
import { checklistOptions } from "@/lib/checklists";
import { ChecklistView } from "@/components/Checklist";
import { ChecklistEditor, ChecklistPicker, ChecklistSend } from "@/components/ChecklistManager";
import { PrintButton } from "@/components/PrintButton";

export const dynamic = "force-dynamic";
export const metadata = { title: "Checklists" };

const toDraft = (c: JobChecklist): ChecklistDraft => ({ title: c.title, title_es: c.title_es, sections: c.sections.map((s) => ({ title: s.title, title_es: s.title_es, items: s.items.map((i) => ({ text: i.text, text_es: i.text_es, required: i.required, photo: i.photo })) })) });

export default async function HubChecklists({ searchParams }: { searchParams: Promise<{ c?: string; edit?: string; new?: string; lang?: string }> }) {
  const q = await searchParams;
  const es = q.lang === "es";
  const [{ options, saved, savedReady }, { data: pros }] = await Promise.all([
    checklistOptions(),
    adminClient().from("contractors").select("id, business_name").eq("status", "approved").order("business_name").limit(500),
  ]);
  const services = SERVICES.map((s) => ({ slug: s.slug, name: s.name }));
  const source = q.c && options.some((g) => g.items.some((o) => o.value === q.c)) ? q.c : options[0]?.items[0]?.value ?? `t:${SERVICES[0].slug}`;
  const savedRow = source.startsWith("s:") ? saved.find((x) => x.id === source.slice(2)) : undefined;
  const svc = source.startsWith("t:") ? getService(source.slice(2)) : undefined;
  const checklist: JobChecklist = savedRow?.checklist ?? buildChecklist(svc!.slug, defaultAnswers(svc!));
  const label = options.flatMap((g) => g.items).find((o) => o.value === source)?.label ?? checklist.title;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3 print:hidden">
        <div><h1 className="text-2xl font-bold">Checklists</h1><p className="text-sm text-ink-soft">Pick a checklist, then attach it to a job or email it to a pro. Every job still gets its service's checklist automatically — use this to swap in a different or custom one.</p></div>
        <div className="flex gap-2"><Link href="/hub/checklists?new=1" className="btn-primary">+ New checklist</Link></div>
      </div>
      {!savedReady && <p className="rounded-xl bg-amber-50 p-3 text-sm print:hidden">To save your own checklists, run <code>supabase/setup/RUN_ONCE_LATEST_2026-10-12_0005.sql</code> in Supabase → SQL Editor once.</p>}

      {q.new ? (
        <section className="space-y-2"><h2 className="font-bold">New checklist</h2><ChecklistEditor services={services} /></section>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3 print:hidden"><ChecklistPicker options={options} value={source} /><PrintButton />
            <Link className="text-sm text-brand underline" href={`/hub/checklists?c=${encodeURIComponent(source)}&edit=1`}>{savedRow ? "Edit" : "Customize a copy"}</Link>
            <Link className="text-sm underline" href={`/hub/checklists?c=${encodeURIComponent(source)}${es ? "" : "&lang=es"}`}>{es ? "English" : "Español"}</Link></div>

          {q.edit ? (
            <section className="space-y-2"><h2 className="font-bold">{savedRow ? `Edit "${savedRow.name}"` : `Customize "${checklist.title}" — saved as your own copy; the built-in one doesn't change`}</h2>
              <ChecklistEditor services={services} initial={toDraft(checklist)} id={savedRow?.id} name={savedRow?.name} serviceSlug={savedRow ? savedRow.service_slug : svc?.slug} /></section>
          ) : (
            <section className="card">
              <div className="flex flex-wrap items-baseline justify-between gap-2"><h2 className="text-lg font-bold">{es ? checklist.title_es : checklist.title}</h2>
                <span className="text-xs text-ink-soft">{savedRow ? `Saved · edited ${savedRow.updated_at.slice(0, 10)}${savedRow.updated_by ? ` by ${savedRow.updated_by}` : ""}` : `Built-in · ${label.replace(/^\S+\s/, "")}`}</span></div>
              {svc && <p className="mt-1 text-xs text-ink-soft">Shown for a standard booking. On a job, items for what the customer booked (deep clean, pets, inside the oven…) are added automatically.</p>}
              <div className="mt-3"><ChecklistView checklist={checklist} es={es} /></div>
            </section>
          )}
          {!q.edit && <div className="print:hidden"><ChecklistSend source={source} pros={((pros ?? []) as { id: string; business_name: string }[]).map((p) => ({ id: p.id, name: p.business_name }))} /></div>}
        </>
      )}

      {savedReady && <section className="card print:hidden"><h2 className="mb-2 font-bold">Saved checklists ({saved.length})</h2>
        {saved.length ? <ul className="divide-y divide-line text-sm">{saved.map((x) => (
          <li key={x.id} className="flex flex-wrap items-center justify-between gap-2 py-2"><Link className="font-semibold text-brand underline" href={`/hub/checklists?c=s:${x.id}`}>{x.name}</Link>
            <span className="text-xs text-ink-soft">{x.service_slug ? getService(x.service_slug)?.name ?? x.service_slug : "Any service"} · {x.checklist.sections.reduce((n, s) => n + s.items.length, 0)} items · edited {x.updated_at.slice(0, 10)}</span></li>
        ))}</ul> : <p className="text-sm text-ink-soft">None yet. Customize a built-in checklist or start a new one.</p>}</section>}
    </div>
  );
}
