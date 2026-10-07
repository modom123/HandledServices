/*
 * FILE    : apps/web/components/SiteSettingsUI.tsx
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-07_0250 UTC
 * PURPOSE : Hub → Website controls: pick the default website look.
 */
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

async function post(body: unknown) {
  const r = await fetch("/api/hub/site", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  return r.ok ? null : String(j.error ?? "Failed");
}

export function ThemePicker({ themes, current, admin }: { themes: { id: string; name: string; note: string }[]; current: string; admin: boolean }) {
  const router = useRouter();
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <div className="space-y-2">
      <div className="grid gap-3 md:grid-cols-3">{themes.map((t) => (
        <div key={t.id} className={`rounded-xl border p-4 ${t.id === current ? "border-brand bg-brand-tint" : "border-line"}`}>
          <div className="font-semibold">{t.name}{t.id === current && <span className="ml-2 text-xs font-normal text-brand">default</span>}</div>
          <p className="mt-1 text-xs text-ink-soft">{t.note}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <a className="btn-ghost px-3 py-1 text-xs" href={`/home?theme=${t.id}`} target="_blank" rel="noreferrer">Preview</a>
            {admin && t.id !== current && <button className="btn-primary px-3 py-1 text-xs" onClick={async () => { const e = await post({ action: "theme", theme: t.id }); setMsg(e ?? `Default look is now ${t.name}.`); router.refresh(); }}>Make default</button>}
          </div>
        </div>
      ))}</div>
      {msg && <p className="text-sm">{msg}</p>}
    </div>
  );
}
