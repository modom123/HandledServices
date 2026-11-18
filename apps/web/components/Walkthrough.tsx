/*
 * FILE    : apps/web/components/Walkthrough.tsx
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-11-17_2350 UTC
 * PURPOSE : Free walkthrough booking for businesses (no back-and-forth):
 *             SlotPicker         — days across the top, open times below (in the business's time zone)
 *             WalkthroughBooker  — one short screen: pick a time, name / company / email / phone (+ address on site), Book
 * UPDATED : 2026-11-18_0005 UTC — simpler: no numbered steps or kind cards; one address line; "what do you need" optional; a small link
 *           switches between an on-site visit and a call.
 *             WalkthroughManage  — their manage link: pick a new time or cancel
 */
"use client";

import { useEffect, useState } from "react";
import { WALKTHROUGH_KINDS, type WalkthroughDay, type WalkthroughKind } from "@handled/core";
import { readAttribution, trackConversion } from "@/lib/track";

type Slots = { enabled: boolean; timeZone: string; days: WalkthroughDay[] };

function useSlots(refresh = 0) {
  const [s, setS] = useState<Slots | null>(null);
  useEffect(() => { fetch("/api/walkthrough", { cache: "no-store" }).then((r) => r.json()).then(setS).catch(() => setS({ enabled: false, timeZone: "America/Detroit", days: [] })); }, [refresh]);
  return s;
}

export function SlotPicker({ value, onChange, refresh = 0 }: { value: string; onChange: (start: string, label: string) => void; refresh?: number }) {
  const s = useSlots(refresh);
  const [day, setDay] = useState(0);
  if (!s) return <p className="text-sm text-ink-soft">Loading open times…</p>;
  if (!s.enabled || !s.days.length) return <p className="rounded-lg bg-amber-50 p-3 text-sm">No open times online right now. Email or call us and we’ll set one up.</p>;
  const d = s.days[Math.min(day, s.days.length - 1)];
  const city = s.timeZone.split("/").pop()?.replace(/_/g, " ");
  return (
    <div className="space-y-3">
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {s.days.map((x, i) => (
          <button key={x.date} type="button" onClick={() => setDay(i)} className={`shrink-0 rounded-xl border px-3 py-2 text-sm ${i === day ? "border-brand bg-brand text-white" : "border-line bg-white hover:border-brand"}`}>
            <div className="font-semibold">{x.label.split(",")[0]}</div><div className="text-xs opacity-80">{x.label.split(", ").slice(1).join(", ")}</div>
          </button>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {d.slots.map((t) => (
          <button key={t.start} type="button" onClick={() => onChange(t.start, `${d.label} at ${t.label}`)} className={`rounded-lg border px-2 py-2 text-sm font-semibold ${value === t.start ? "border-brand bg-brand text-white" : "border-line bg-white hover:border-brand"}`}>{t.label}</button>
        ))}
      </div>
      <p className="text-xs text-ink-soft">Times are {city} time.</p>
    </div>
  );
}

export interface Prefill { company: string; name: string; email: string; phone: string; city: string; state: string }

/** One short screen: pick a time, four boxes (plus the address for an on-site visit), Book. */
export function WalkthroughBooker({ initialKind, landing, lead, prefill }: { initialKind: WalkthroughKind; landing: string | null; lead: string | null; prefill: Prefill | null }) {
  const [kind, setKind] = useState<WalkthroughKind>(initialKind);
  const [start, setStart] = useState(""); const [when, setWhen] = useState("");
  const [f, setF] = useState({ name: prefill?.name ?? "", company: prefill?.company ?? "", email: prefill?.email ?? "", phone: prefill?.phone ?? "", address: "", needs: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });
  const onsite = kind === "onsite";
  const phoneOk = f.phone.replace(/\D/g, "").length >= 10;
  const ok = start && f.name.trim().length > 1 && f.company.trim().length > 1 && /\S+@\S+\.\S+/.test(f.email) && phoneOk && (!onsite || f.address.trim().length > 5);

  if (done) return (
    <div className="card space-y-3 text-center">
      <div className="text-4xl">✅</div>
      <h2 className="text-2xl font-bold">You’re booked</h2>
      <p><b>{when}</b></p>
      <p className="text-sm text-ink-soft">We emailed the details to {f.email}. Need to change it? Use the link in that email.</p>
    </div>
  );

  return (
    <div className="space-y-5">
      <SlotPicker value={start} onChange={(s, l) => { setStart(s); setWhen(l); }} refresh={refresh} />
      <div className="grid gap-2 sm:grid-cols-2">
        <input className="input" placeholder="Your name" value={f.name} onChange={set("name")} autoComplete="name" />
        <input className="input" placeholder="Company" value={f.company} onChange={set("company")} autoComplete="organization" />
        <input className="input" type="email" placeholder="Email" value={f.email} onChange={set("email")} autoComplete="email" />
        <input className="input" type="tel" placeholder="Phone" value={f.phone} onChange={set("phone")} autoComplete="tel" />
        {onsite && <input className="input sm:col-span-2" placeholder="Property address (street, city, ZIP)" value={f.address} onChange={set("address")} autoComplete="street-address" />}
        <input className="input sm:col-span-2" placeholder="What do you need done? (optional)" value={f.needs} onChange={set("needs")} />
      </div>
      {err && <p className="rounded-lg bg-rose-50 p-2 text-sm text-rose-800">{err}</p>}
      <button className="btn-primary w-full py-3 text-base" disabled={!ok || busy} onClick={async () => {
        setBusy(true); setErr("");
        const attr = Object.fromEntries(Object.entries(readAttribution() ?? {}).filter(([, v]) => typeof v === "string").map(([k, v]) => [k, String(v).slice(0, 200)]));
        const zip = onsite ? f.address.match(/\b(\d{5})(?:-\d{4})?\s*$/)?.[1] ?? null : null;
        const r = await fetch("/api/walkthrough", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
          kind, start, name: f.name, company: f.company, email: f.email, phone: f.phone, address: onsite ? f.address : null, zip,
          needs: f.needs || null, landing, lead, attribution: Object.keys(attr).length ? attr : null,
        }) }).catch(() => null);
        const j = r ? await r.json().catch(() => ({})) : {};
        setBusy(false);
        if (r?.ok && j.ok) { setDone(j.token); try { trackConversion("Lead", { id: `walkthrough-${j.token}` }); } catch { /* ads blocked */ } }
        else { setErr(String(j.error ?? "Couldn't book — check your connection and try again.")); if (r?.status === 409) { setStart(""); setRefresh((x) => x + 1); } }
      }}>{busy ? "Booking…" : !start ? "Pick a time above" : `Book ${when}`}</button>
      <p className="text-center text-sm text-ink-soft">
        {onsite ? "We come to you and walk the property." : "We call you for 10 minutes."}{" "}
        <button type="button" className="font-semibold text-brand underline" onClick={() => setKind(onsite ? "call" : "onsite")}>{onsite ? "Rather have a quick call?" : "Rather we come see it?"}</button>
      </p>
    </div>
  );
}

export function WalkthroughManage({ token, kindLabel, when, active }: { token: string; kindLabel: string; when: string; active: boolean }) {
  const [start, setStart] = useState(""); const [label, setLabel] = useState("");
  const [msg, setMsg] = useState(""); const [state, setState] = useState<"idle" | "moving" | "done">("idle");
  const [refresh, setRefresh] = useState(0);
  const post = async (body: Record<string, unknown>) => {
    const r = await fetch("/api/walkthrough/manage", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, ...body }) }).catch(() => null);
    const j = r ? await r.json().catch(() => ({})) : {};
    return { ok: Boolean(r?.ok && j.ok), error: String(j.error ?? "Something went wrong") };
  };
  if (!active || state === "done") return <div className="card"><p className="font-semibold">{msg || "This walkthrough is closed."}</p><a href="/walkthrough" className="btn-primary mt-3 inline-block">Book a new time</a></div>;
  return (
    <div className="space-y-4">
      <div className="card"><div className="text-sm text-ink-soft">{kindLabel}</div><div className="text-xl font-bold">{when}</div></div>
      {state === "moving" ? (
        <div className="card space-y-3">
          <h2 className="font-bold">Pick a new time</h2>
          <SlotPicker value={start} onChange={(s, l) => { setStart(s); setLabel(l); }} refresh={refresh} />
          <div className="flex flex-wrap gap-2">
            <button className="btn-primary" disabled={!start} onClick={async () => { const r = await post({ action: "reschedule", start }); if (r.ok) { setMsg(`Moved to ${label}. A new confirmation is on its way.`); window.location.reload(); } else { setMsg(r.error); setStart(""); setRefresh((x) => x + 1); } }}>Move it to {label || "…"}</button>
            <button className="btn-ghost" onClick={() => setState("idle")}>Back</button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <button className="btn-primary" onClick={() => setState("moving")}>Pick another time</button>
          <button className="btn-ghost" onClick={async () => { if (!confirm("Cancel this walkthrough?")) return; const r = await post({ action: "cancel", reason: null }); setMsg(r.ok ? "Cancelled. Book again whenever you're ready." : r.error); if (r.ok) setState("done"); }}>Cancel it</button>
        </div>
      )}
      {msg && <p className="text-sm">{msg}</p>}
    </div>
  );
}
