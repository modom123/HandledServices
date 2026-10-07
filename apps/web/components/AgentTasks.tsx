/*
 * FILE    : apps/web/components/AgentTasks.tsx
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-06_0752 UTC
 * PURPOSE : Hub → AI agents controls: assign a task to an agent, mark one done / cancelled, run the Growth planner now.
 */
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

async function post(body: unknown) {
  const r = await fetch("/api/hub/agents", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  return r.ok && j.ok !== false ? null : String(j.error ?? "Failed");
}

export function AssignTask({ agents, fixed }: { agents: { kind: string; name: string }[]; fixed?: string }) {
  const router = useRouter();
  const [f, setF] = useState({ agent: fixed ?? "", title: "", target: "", due_date: "" });
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      {!fixed && <select className="input w-52" value={f.agent} onChange={(e) => setF({ ...f, agent: e.target.value })}><option value="">Agent…</option><option value="all">All agents</option>{agents.map((a) => <option key={a.kind} value={a.kind}>{a.name}</option>)}</select>}
      <input className="input min-w-[16rem] flex-1" placeholder="Task, e.g. Get 10 move-out clean bookings from property managers" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
      <input className="input w-48" placeholder="Target (optional)" value={f.target} onChange={(e) => setF({ ...f, target: e.target.value })} />
      <input className="input w-40" type="date" value={f.due_date} onChange={(e) => setF({ ...f, due_date: e.target.value })} aria-label="Due date" />
      <button className="btn-primary" disabled={busy || !f.agent || f.title.trim().length < 3} onClick={async () => { setBusy(true); const e = await post({ action: "assign", ...f }); setBusy(false); setMsg(e ?? "Assigned"); if (!e) { setF({ ...f, title: "", target: "", due_date: "" }); router.refresh(); } }}>Assign</button>
      {msg && <span className="text-ink-soft">{msg}</span>}
    </div>
  );
}

export function TaskActions({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const act = async (status: "done" | "cancelled") => { setBusy(true); const e = await post({ action: "close", id, status }); setBusy(false); if (e) alert(e); router.refresh(); };
  return (
    <span className="inline-flex gap-2 text-xs">
      <button className="underline" disabled={busy} onClick={() => act("done")}>Done</button>
      <button className="text-ink-soft underline" disabled={busy} onClick={() => act("cancelled")}>Cancel</button>
    </span>
  );
}

export function RunPlanner() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  return (
    <span className="flex items-center gap-2 text-sm">
      <button className="btn-primary" disabled={busy} onClick={async () => { setBusy(true); setMsg("Planning… (up to a minute)"); const e = await post({ action: "plan" }); setBusy(false); setMsg(e ?? "Today's plan is in — tasks assigned"); router.refresh(); }}>{busy ? "Planning…" : "Run today's growth plan now"}</button>
      {msg && <span className="text-ink-soft">{msg}</span>}
    </span>
  );
}
