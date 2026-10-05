/*
 * FILE    : apps/web/components/Team.tsx
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-05_0434 UTC
 * PURPOSE : Hub → Team controls: add a team member by email (admin or dispatcher), remove access.
 */
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

async function post(body: unknown) {
  const r = await fetch("/api/hub/team", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  return r.ok && j.ok ? null : String(j.error ?? "Failed");
}

export function TeamAdd() {
  const router = useRouter();
  const [f, setF] = useState({ email: "", name: "", role: "dispatcher" });
  const [msg, setMsg] = useState("");
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <input className="input w-60" placeholder="their@email.com" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
      <input className="input w-44" placeholder="Name (optional)" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
      <select className="input w-36" value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })}><option value="dispatcher">Dispatcher</option><option value="admin">Admin</option></select>
      <button className="btn-primary" disabled={!f.email.includes("@")} onClick={async () => { const e = await post({ action: "add", email: f.email, role: f.role, name: f.name || undefined }); setMsg(e ?? `Added — ${f.email} got a sign-in link.`); if (!e) { setF({ email: "", name: "", role: "dispatcher" }); router.refresh(); } }}>Add</button>
      {msg && <span className="text-ink-soft">{msg}</span>}
    </div>
  );
}

export function TeamRemove({ email }: { email: string }) {
  const router = useRouter();
  return <button className="text-xs text-rose-700 underline" onClick={async () => { if (!confirm(`Remove Hub access for ${email}?`)) return; const e = await post({ action: "remove", email }); if (e) alert(e); router.refresh(); }}>Remove access</button>;
}
