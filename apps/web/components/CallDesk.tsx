/*
 * FILE    : apps/web/components/CallDesk.tsx
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-20_0015 UTC
 * PURPOSE : Hub → Business leads → Call desk: one card per call — tap to call, the script (or the Deal hunter's), a note,
 *           and one tap for the outcome (a callback date when they ask for one). Calls are made by a person.
 * UPDATED : 2026-10-22_0700 UTC — 🎫 send them a referral ticket from the card (they join the referral network).
 */
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SendTicketInvite } from "./PartnerUI";
import { CALL_OUTCOMES, PARTNER_KINDS, QUEUE_REASON_LABEL, type CallOutcome, type CallScript, type QueueReason } from "@handled/core";

export interface CallCard {
  id: string; business_name: string; contact_name: string | null; phone: string; city: string | null; segment_label: string;
  reason: QueueReason; attempts: number; last_outcome: string | null; notes: string | null; script: CallScript; ai_script: string | null;
}

const telHref = (p: string) => `tel:${p.replace(/[^\d+]/g, "")}`;

export function CallDesk({ cards }: { cards: CallCard[] }) {
  const router = useRouter();
  const [done, setDone] = useState<Record<string, string>>({});
  if (!cards.length) return <p className="text-sm text-ink-soft">Nobody to call right now. Leads land here when the engine finds a business with no email, when someone clicks our email but doesn’t reply, when a federal prime is added as a teaming partner, and on every callback date.</p>;
  return (
    <div className="space-y-3">
      {cards.map((c) => <Card key={c.id} c={c} done={done[c.id]} onDone={(msg) => { setDone((d) => ({ ...d, [c.id]: msg })); router.refresh(); }} />)}
    </div>
  );
}

function Card({ c, done, onDone }: { c: CallCard; done?: string; onDone: (msg: string) => void }) {
  const [note, setNote] = useState("");
  const [callback, setCallback] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const log = async (outcome: CallOutcome) => {
    if (outcome === "callback" && !callback) { setErr("Pick the callback date first"); return; }
    if (outcome === "do_not_call" && !confirm(`Never call or email ${c.business_name} again?`)) return;
    setBusy(true); setErr("");
    const r = await fetch("/api/hub/biz-leads", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "call", id: c.id, outcome, note: note || null, callback_at: callback ? new Date(`${callback}T14:00:00Z`).toISOString() : null }) });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) { setErr(String(j.error ?? "Failed")); return; }
    onDone(`${CALL_OUTCOMES[outcome].emoji} ${CALL_OUTCOMES[outcome].label}${j.next_call_at ? ` · next call ${new Date(j.next_call_at).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}` : ""}`);
  };
  if (done) return <div className="card flex items-center justify-between py-3 text-sm opacity-70"><span><b>{c.business_name}</b> — {done}</span></div>;
  return (
    <div className="card space-y-3 text-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-brand">{QUEUE_REASON_LABEL[c.reason]}</div>
          <div className="text-base font-bold">{c.business_name}</div>
          <div className="text-xs text-ink-soft">{c.contact_name ? `${c.contact_name} · ` : ""}{c.segment_label}{c.city ? ` · ${c.city}` : ""} · {c.attempts ? `${c.attempts} call${c.attempts === 1 ? "" : "s"} before${c.last_outcome ? ` (last: ${CALL_OUTCOMES[c.last_outcome as CallOutcome]?.label ?? c.last_outcome})` : ""}` : "first call"}</div>
          {c.notes && <div className="mt-1 text-xs text-ink-soft">📝 {c.notes.slice(0, 220)}</div>}
        </div>
        <a href={telHref(c.phone)} className="btn-primary whitespace-nowrap">📞 {c.phone}</a>
      </div>
      <details>
        <summary className="cursor-pointer text-xs font-semibold">🎫 Send them a referral ticket (they earn on jobs they send us, and join the network)</summary>
        <div className="mt-2"><SendTicketInvite compact bizLeadId={c.id} kinds={Object.entries(PARTNER_KINDS) as [string, string][]} initial={{ name: c.contact_name ?? c.business_name, phone: c.phone, company: c.business_name, kind: "business" }} /></div>
      </details>
      <details open={!c.attempts}>
        <summary className="cursor-pointer text-xs font-semibold">Script</summary>
        <div className="mt-2 space-y-2 rounded-lg bg-paper p-3">
          {c.ai_script && <div><div className="text-xs font-semibold">Deal hunter’s script for today</div><p className="whitespace-pre-wrap">{c.ai_script}</p></div>}
          <div><div className="text-xs font-semibold">Opener</div><p>{c.script.opener}</p></div>
          <div><div className="text-xs font-semibold">Ask</div><ul className="list-disc pl-5">{c.script.questions.map((q) => <li key={q}>{q}</li>)}</ul></div>
          <div><div className="text-xs font-semibold">Close</div><p>{c.script.close}</p></div>
          <div><div className="text-xs font-semibold">Voicemail (under 30 seconds)</div><p>{c.script.voicemail}</p></div>
          <p className="text-xs text-ink-soft">No prices or discounts on the phone: book the free walkthrough and send a quote. If they say don’t call, tap “Do not contact”.</p>
        </div>
      </details>
      <textarea className="input min-h-16" placeholder="Note: who you spoke with, what they need, the right contact's name…" value={note} onChange={(e) => setNote(e.target.value)} />
      <div className="flex flex-wrap items-center gap-2">
        {(Object.keys(CALL_OUTCOMES) as CallOutcome[]).filter((o) => o !== "callback").map((o) => (
          <button key={o} disabled={busy} title={CALL_OUTCOMES[o].hint} onClick={() => log(o)} className={`rounded-full border px-3 py-1 text-xs ${o === "interested" ? "border-green-600 bg-green-50 font-semibold" : o === "do_not_call" ? "border-rose-300" : "border-line"}`}>{CALL_OUTCOMES[o].emoji} {CALL_OUTCOMES[o].label}</button>
        ))}
        <span className="flex items-center gap-1">
          <input type="date" className="input w-auto py-1 text-xs" value={callback} min={new Date().toISOString().slice(0, 10)} onChange={(e) => setCallback(e.target.value)} />
          <button disabled={busy} onClick={() => log("callback")} className="rounded-full border border-line px-3 py-1 text-xs">📅 Call back then</button>
        </span>
      </div>
      {err && <p className="text-xs text-rose-700">{err}</p>}
    </div>
  );
}

/** The day's dial goal (admins change it). */
export function CallGoal({ goal }: { goal: number }) {
  const router = useRouter();
  const [g, setG] = useState(goal);
  const [msg, setMsg] = useState("");
  return (
    <span className="flex items-center gap-2 text-xs">
      Daily goal <input className="input w-20 py-1 text-xs" type="number" min={0} max={500} value={g} onChange={(e) => setG(Number(e.target.value) || 0)} />
      <button className="btn-ghost text-xs" onClick={async () => { const r = await fetch("/api/hub/biz-leads", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "call_goal", call_goal: g }) }); setMsg(r.ok ? "Saved" : "Admins only"); router.refresh(); }}>Save</button>
      {msg && <span className="text-ink-soft">{msg}</span>}
    </span>
  );
}
