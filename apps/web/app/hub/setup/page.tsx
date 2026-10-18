/*
 * FILE    : apps/web/app/hub/setup/page.tsx
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-01_1940 UTC
 * UPDATED : 2026-10-02_1346 UTC — business & legal checklist (insurance, legal review, HIPAA, licensing).
 * PURPOSE : Go-live checklist — every integration, migration and account the business needs,
 *           green/amber/red, with the exact fix next to anything not ready.
 * UPDATED : 2026-10-11_0451 UTC — admins only (components/AdminOnly); hidden from dispatchers in the Hub menu.
 * UPDATED : 2026-10-18_0415 UTC — shows only what's left to do (red first, then amber); everything finished folds into
 *           one "Done" list. API keys, database migrations (by file) and webhooks are their own sections.
 */
import { readiness } from "@/lib/readiness";
import { Badge } from "@/components/ui";
import { SyncCatalogButton } from "@/components/HubActions";
import { LaunchChecklist } from "@/components/LaunchChecklist";
import { adminClient } from "@/lib/supabase/server";
import { adminOnly } from "@/components/AdminOnly";

export default async function Setup() {
  const gate = await adminOnly(); if (gate) return gate;
  const checks = await readiness();
  const ticks = process.env.SUPABASE_SERVICE_ROLE_KEY ? ((await adminClient().from("launch_checklist").select("*")).data ?? []) : [];
  const fails = checks.filter((c) => c.status === "fail").length;
  const warns = checks.filter((c) => c.status === "warn").length;
  const todo = [...checks.filter((c) => c.status === "fail"), ...checks.filter((c) => c.status === "warn")];
  const done = checks.filter((c) => c.status === "ok");
  const groupsOf = (list: typeof checks) => [...new Set(list.map((c) => c.group))];
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="text-2xl font-bold">Go-live setup</h1><p className="text-sm text-ink-soft">What's left to do, checked live — items drop off as soon as they're done. Fix red first, then amber.</p></div>
        <Badge tone={fails ? "red" : warns ? "amber" : "green"}>{fails ? `${fails} blocking · ${warns} to finish` : warns ? `${warns} to finish` : "Ready to launch"}</Badge>
      </div>
      {!todo.length && <div className="card text-sm">✅ Every integration, migration and webhook checks out.</div>}
      {groupsOf(todo).map((g) => (
        <div key={g} className="card">
          <div className="font-semibold">{g} <span className="text-sm font-normal text-ink-soft">· {todo.filter((c) => c.group === g).length} left</span></div>
          <ul className="mt-3 divide-y divide-line text-sm">
            {todo.filter((c) => c.group === g).map((c) => (
              <li key={c.label} className="py-2">
                <div className="flex flex-wrap items-center justify-between gap-2"><span>{c.status === "warn" ? "⚠️" : "❌"} {c.label}</span><span className="text-ink-soft">{c.detail}</span></div>
                {c.fix && <div className="mt-1 text-xs text-brand-dark">→ {c.fix}</div>}
              </li>
            ))}
          </ul>
        </div>
      ))}
      {done.length > 0 && (
        <details className="card text-sm">
          <summary className="cursor-pointer font-semibold">✅ Done ({done.length})</summary>
          {groupsOf(done).map((g) => (
            <div key={g} className="mt-3"><div className="text-xs font-semibold uppercase tracking-wide text-ink-soft">{g}</div>
              <ul className="mt-1 space-y-0.5">{done.filter((c) => c.group === g).map((c) => <li key={c.label} className="flex flex-wrap justify-between gap-2"><span>{c.label}</span><span className="text-ink-soft">{c.detail}</span></li>)}</ul></div>
          ))}
        </details>
      )}
      <SyncCatalogButton />
      <LaunchChecklist ticks={ticks} />
    </div>
  );
}
