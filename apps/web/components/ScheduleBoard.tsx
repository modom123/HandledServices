/*
 * FILE    : apps/web/components/ScheduleBoard.tsx
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-12_0005 UTC
 * PURPOSE : The drag-and-drop day grid on Hub → Schedule (client). Rows = "Unassigned" + pros, columns = time windows.
 *           Drag (mouse) or tap-then-tap (touch / keyboard) to move a job; the move is shown at once and undone if the
 *           server refuses it (e.g. unpaid). A "Next day" drop zone pushes a job to tomorrow, same pro and window.
 *           Calls POST /api/hub/schedule.
 */
"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export type BoardPro = { id: string; name: string; trades: string[]; capacity: number; off: string | null };
export type BoardCard = { id: string; ref: string; icon: string; service: string; trades: string[]; city: string; customer: string; window: string; contractorId: string | null; status: string; payment: string };

const WINDOWS: [string, string][] = [["morning", "Morning 8–11"], ["midday", "Midday 11–2"], ["afternoon", "Afternoon 2–5"], ["flexible", "Any time"]];
const LOCKED = ["in_progress", "qa_review", "completed", "cancelled"];
const UNASSIGNED = "__none";

export function ScheduleBoard({ date, pros, cards: initial, nextDay }: { date: string; pros: BoardPro[]; cards: BoardCard[]; nextDay: string }) {
  const router = useRouter();
  const [cards, setCards] = useState(initial);
  const [picked, setPicked] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ text: string; bad?: boolean } | null>(null);
  const known = new Set(pros.map((p) => p.id));
  const rowOf = (c: BoardCard) => (c.contractorId && known.has(c.contractorId) ? c.contractorId : c.contractorId ? `x:${c.contractorId}` : UNASSIGNED);

  async function move(id: string, row: string, win: string, toDate?: string) {
    const card = cards.find((c) => c.id === id);
    setPicked(null); setOver(null);
    if (!card || LOCKED.includes(card.status)) return;
    const contractorId = row === UNASSIGNED ? null : row.startsWith("x:") ? row.slice(2) : row;
    if (!toDate && card.contractorId === contractorId && card.window === win) return;
    const pro = pros.find((p) => p.id === contractorId);
    if (pro && card.contractorId !== contractorId && !card.trades.some((t) => pro.trades.includes(t)) && !confirm(`${pro.name} isn't listed for ${card.service}. Assign anyway?`)) return;
    if (pro?.off && card.contractorId !== contractorId && !confirm(`${pro.name}: ${pro.off}. Assign anyway?`)) return;
    const before = cards;
    setCards((cs) => toDate ? cs.filter((c) => c.id !== id) : cs.map((c) => (c.id === id ? { ...c, contractorId, window: win, status: contractorId ? (c.status === "site_visit" ? c.status : "assigned") : c.status === "site_visit" ? c.status : "dispatched" } : c)));
    setMsg({ text: `Moving ${card.ref}…` });
    const r = await fetch("/api/hub/schedule", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ job_id: id, contractor_id: contractorId, time_window: win, scheduled_date: toDate }) }).catch(() => null);
    const j = (await r?.json().catch(() => ({}))) as { error?: string } | undefined;
    if (!r?.ok) { setCards(before); setMsg({ text: j?.error ?? "Couldn't move it — try again", bad: true }); return; }
    setMsg({ text: toDate ? `${card.ref} moved to ${toDate}` : `${card.ref} → ${pro?.name ?? "Unassigned"} · ${WINDOWS.find(([k]) => k === win)?.[1]}${contractorId && contractorId !== card.contractorId ? " · pro notified" : ""}` });
    router.refresh();
  }

  // plain render functions (not components) so cards aren't remounted mid-drag when the hover state changes
  const card = (c: BoardCard) => {
    const locked = LOCKED.includes(c.status);
    return (
      <div key={c.id} draggable={!locked} onDragStart={(e) => { e.dataTransfer.setData("text/plain", c.id); e.dataTransfer.effectAllowed = "move"; }}
        onClick={(e) => { if (picked && picked !== c.id) return; /* the cell moves the picked job here */ e.stopPropagation(); if (!locked) setPicked(picked === c.id ? null : c.id); }} role="button" tabIndex={0} aria-pressed={picked === c.id}
        onKeyDown={(e) => { if ((e.key === "Enter" || e.key === " ") && !locked) { e.preventDefault(); setPicked(picked === c.id ? null : c.id); } }}
        className={`rounded-lg border bg-white px-2 py-1 text-xs shadow-sm ${locked ? "cursor-default opacity-70" : "cursor-grab active:cursor-grabbing"} ${picked === c.id ? "ring-2 ring-brand" : ""} ${c.payment === "unpaid" ? "border-rose-300" : c.payment === "balance" ? "border-amber-300" : "border-line"}`}>
        <div className="flex items-center justify-between gap-1"><Link href={`/hub/jobs/${c.id}`} onClick={(e) => e.stopPropagation()} className="font-semibold text-brand underline">{c.ref}</Link><span>{c.icon}</span></div>
        <div className="truncate">{c.service}</div>
        <div className="truncate text-ink-soft">{c.customer} · {c.city}</div>
        {(c.payment === "unpaid" || locked) && <div className={c.payment === "unpaid" ? "text-rose-700" : "text-ink-soft"}>{c.payment === "unpaid" ? "unpaid" : c.status.replace("_", " ")}</div>}
      </div>
    );
  };

  const cell = (row: string, win: string, off?: string | null) => {
    const key = `${row}|${win}`;
    const here = cards.filter((c) => rowOf(c) === row && c.window === win);
    return (
      <td key={win} onDragOver={(e) => { e.preventDefault(); setOver(key); }} onDragLeave={() => setOver((o) => (o === key ? null : o))}
        onDrop={(e) => { e.preventDefault(); const id = e.dataTransfer.getData("text/plain"); if (id) move(id, row, win); }}
        onClick={() => picked && move(picked, row, win)}
        className={`min-w-[150px] border border-line p-1 align-top ${over === key ? "bg-brand-tint" : off ? "bg-paper-deep" : picked ? "cursor-pointer hover:bg-brand-tint" : ""}`}>
        <div className="space-y-1">{here.map(card)}</div>
      </td>
    );
  };

  const orphans = [...new Set(cards.filter((c) => c.contractorId && !known.has(c.contractorId)).map((c) => c.contractorId!))];
  const rows: { id: string; name: string; sub: string; off?: string | null }[] = [
    { id: UNASSIGNED, name: "Unassigned", sub: `${cards.filter((c) => !c.contractorId).length} job(s)` },
    ...pros.map((p) => { const n = cards.filter((c) => c.contractorId === p.id).length; return { id: p.id, name: p.name, sub: p.off ?? `${n}/${p.capacity} jobs`, off: p.off }; }),
    ...orphans.map((id) => ({ id: `x:${id}`, name: "Pro (not approved now)", sub: "" })),
  ];

  return (
    <div className="space-y-2">
      {msg && <p className={`text-sm ${msg.bad ? "font-semibold text-rose-700" : "text-ink-soft"}`}>{msg.text}</p>}
      {picked && <p className="text-sm text-brand">Tap where {cards.find((c) => c.id === picked)?.ref} should go (or tap it again to cancel).</p>}
      <div className="overflow-x-auto rounded-xl border border-line bg-white">
        <table className="w-full border-collapse text-sm">
          <thead><tr className="bg-paper text-left text-xs uppercase tracking-wide text-ink-soft"><th className="sticky left-0 z-10 min-w-[160px] border border-line bg-paper p-2">Pro</th>{WINDOWS.map(([k, l]) => <th key={k} className="border border-line p-2">{l}</th>)}</tr></thead>
          <tbody>{rows.map((r) => (
            <tr key={r.id}>
              <th className={`sticky left-0 z-10 border border-line p-2 text-left align-top ${r.id === UNASSIGNED ? "bg-amber-50" : "bg-white"}`}><div className="font-semibold">{r.name}</div><div className={`text-xs ${r.off ? "text-rose-700" : "text-ink-soft"}`}>{r.sub}</div></th>
              {WINDOWS.map(([k]) => cell(r.id, k, r.off))}
            </tr>
          ))}</tbody>
        </table>
      </div>
      <div onDragOver={(e) => { e.preventDefault(); setOver("next"); }} onDragLeave={() => setOver(null)}
        onDrop={(e) => { e.preventDefault(); const id = e.dataTransfer.getData("text/plain"); const c = cards.find((x) => x.id === id); if (c) move(id, rowOf(c), c.window, nextDay); }}
        onClick={() => { const c = cards.find((x) => x.id === picked); if (c) move(c.id, rowOf(c), c.window, nextDay); }}
        className={`rounded-xl border-2 border-dashed p-3 text-center text-sm ${over === "next" ? "border-brand bg-brand-tint" : "border-line text-ink-soft"}`}>
        Drop here to move to the next day ({nextDay}) — same pro and window
      </div>
      <p className="text-xs text-ink-soft">Card border: red = unpaid, amber = balance due. Day {date}.</p>
    </div>
  );
}
