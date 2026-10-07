/*
 * FILE    : apps/web/components/LaunchChecklist.tsx
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-02_1346 UTC
 * PURPOSE : Hub → Go-live setup: the business & legal checklist with tick boxes and notes.
 */
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CHECKLIST_GROUPS, LAUNCH_CHECKLIST } from "@handled/core";

type Tick = { key: string; done_at: string | null; done_by: string | null; note: string | null };

export function LaunchChecklist({ ticks }: { ticks: Tick[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState("");
  const by = Object.fromEntries(ticks.map((t) => [t.key, t]));
  const done = LAUNCH_CHECKLIST.filter((i) => by[i.key]?.done_at).length;
  const blockingLeft = LAUNCH_CHECKLIST.filter((i) => i.blocking && !by[i.key]?.done_at).length;
  async function set(key: string, d: boolean, note?: string) {
    setBusy(key);
    await fetch("/api/hub/checklist", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key, done: d, ...(note !== undefined ? { note } : {}) }) });
    setBusy(""); router.refresh();
  }
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div><h2 className="text-xl font-bold">Business & legal</h2><p className="text-sm text-ink-soft">Things software can’t do for us. Not legal advice — each item says who to ask. Full write-up: docs/BUSINESS_LEGAL_CHECKLIST_*.md</p></div>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${blockingLeft ? "bg-amber-100 text-amber-800" : "bg-green-100 text-green-800"}`}>{done}/{LAUNCH_CHECKLIST.length} done · {blockingLeft} must-do left</span>
      </div>
      {CHECKLIST_GROUPS.map((g) => (
        <div key={g} className="card">
          <div className="font-semibold">{g}</div>
          <ul className="mt-2 divide-y divide-line text-sm">
            {LAUNCH_CHECKLIST.filter((i) => i.group === g).map((i) => {
              const t = by[i.key];
              return (
                <li key={i.key} className="py-2">
                  <label className="flex items-start gap-2">
                    <input type="checkbox" className="mt-1" disabled={busy === i.key} checked={Boolean(t?.done_at)} onChange={(e) => set(i.key, e.target.checked)} />
                    <span className="flex-1"><b className={t?.done_at ? "line-through decoration-ink-soft/50" : ""}>{i.title}</b>{i.blocking && !t?.done_at && <span className="ml-2 rounded bg-amber-100 px-1.5 text-xs text-amber-800">before launch</span>}
                      <span className="block text-xs text-ink-soft">{i.why} <i>Ask: {i.who}.</i></span>
                      {t?.done_at && <span className="block text-xs text-brand-dark">✓ {t.done_by} · {t.done_at.slice(0, 10)}{t.note ? ` · ${t.note}` : ""}</span>}
                    </span>
                    <button type="button" className="text-xs underline" onClick={() => { const n = prompt("Note (policy number, attorney, date…)", t?.note ?? ""); if (n !== null) set(i.key, Boolean(t?.done_at), n); }}>note</button>
                  </label>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}
