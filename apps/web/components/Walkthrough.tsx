/*
 * FILE    : apps/web/components/Walkthrough.tsx
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-11-17_2350 UTC
 * PURPOSE : Free walkthrough booking for businesses (no back-and-forth):
 *             SlotPicker         — days across the top, open times below (in the business's time zone)
 *             WalkthroughBooker  — on-site walkthrough or 10-minute call → time → details → booked (with manage link)
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

export function WalkthroughBooker({ initialKind, landing, lead, prefill }: { initialKind: WalkthroughKind; landing: string | null; lead: string | null; prefill: Prefill | null }) {
  const [kind, setKind] = useState<WalkthroughKind>(initialKind);
  const [start, setStart] = useState(""); const [when, setWhen] = useState("");
  const [f, setF] = useState({ name: prefill?.name ?? "", company: prefill?.company ?? "", email: prefill?.email ?? "", phone: prefill?.phone ?? "", address: "", city: prefill?.city ?? "", state: prefill?.state || "MI", zip: "", needs: "", properties: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
  const onsite = kind === "onsite";
  const ok = start && f.name.trim().length > 1 && f.company.trim().length > 1 && /\S+@\S+\.\S+/.test(f.email) && (onsite ? f.address.trim() && f.city.trim() && /^\d{5}$/.test(f.zip) : f.phone.replace(/\D/g, "").length >= 10);

  if (done) return (
    <div className="card space-y-3 text-center">
      <div className="text-4xl">✅</div>
      <h2 className="text-2xl font-bold">You’re booked</h2>
      <p>{WALKTHROUGH_KINDS[kind].label}: <b>{when}</b></p>
      <p className="text-sm text-ink-soft">A confirmation is on its way to {f.email}, with an “Add to calendar” link. We’ll send a reminder the day before.</p>
      <a className="btn-ghost inline-block" href={`/walkthrough/${done}`}>Change or cancel</a>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2">
        {(Object.keys(WALKTHROUGH_KINDS) as WalkthroughKind[]).map((k) => (
          <button key={k} type="button" onClick={() => setKind(k)} className={`card text-left transition ${kind === k ? "ring-2 ring-brand" : "hover:ring-1 hover:ring-line"}`}>
            <div className="font-bold">{WALKTHROUGH_KINDS[k].label}</div>
            <p className="mt-1 text-sm text-ink-soft">{WALKTHROUGH_KINDS[k].blurb}</p>
          </button>
        ))}
      </div>
      <section>
        <h2 className="mb-2 text-lg font-bold">1. Pick a time</h2>
        <SlotPicker value={start} onChange={(s, l) => { setStart(s); setWhen(l); }} refresh={refresh} />
      </section>
      <section className="space-y-2">
        <h2 className="text-lg font-bold">2. Your details</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          <input className="input" placeholder="Your name *" value={f.name} onChange={set("name")} autoComplete="name" />
          <input className="input" placeholder="Company *" value={f.company} onChange={set("company")} autoComplete="organization" />
          <input className="input" type="email" placeholder="Work email *" value={f.email} onChange={set("email")} autoComplete="email" />
          <input className="input" type="tel" placeholder={onsite ? "Phone" : "Phone (we call you) *"} value={f.phone} onChange={set("phone")} autoComplete="tel" />
        </div>
        {onsite && (
          <div className="grid gap-2 sm:grid-cols-[2fr_1fr_80px_100px]">
            <input className="input" placeholder="Property address *" value={f.address} onChange={set("address")} autoComplete="street-address" />
            <input className="input" placeholder="City *" value={f.city} onChange={set("city")} autoComplete="address-level2" />
            <input className="input" placeholder="State" maxLength={2} value={f.state} onChange={set("state")} autoComplete="address-level1" />
            <input className="input" placeholder="ZIP *" inputMode="numeric" maxLength={5} value={f.zip} onChange={set("zip")} autoComplete="postal-code" />
          </div>
        )}
        <div className="grid gap-2 sm:grid-cols-[1fr_160px]">
          <textarea className="input h-20" placeholder="What do you need done? (e.g. move-out cleans for 12 units, weekly office cleaning, 3,000 sq ft)" value={f.needs} onChange={set("needs")} />
          <input className="input h-fit" inputMode="numeric" placeholder="# of properties" value={f.properties} onChange={(e) => setF({ ...f, properties: e.target.value.replace(/\D/g, "") })} />
        </div>
      </section>
      {err && <p className="rounded-lg bg-rose-50 p-2 text-sm text-rose-800">{err}</p>}
      <button className="btn-primary w-full py-3 text-base sm:w-auto sm:px-10" disabled={!ok || busy} onClick={async () => {
        setBusy(true); setErr("");
        const attr = Object.fromEntries(Object.entries(readAttribution() ?? {}).filter(([, v]) => typeof v === "string").map(([k, v]) => [k, String(v).slice(0, 200)]));
        const r = await fetch("/api/walkthrough", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
          kind, start, ...f, phone: f.phone || null, address: onsite ? f.address : null, city: f.city || null, state: f.state || null, zip: onsite ? f.zip : null,
          needs: f.needs || null, properties: f.properties ? Number(f.properties) : null, landing, lead, attribution: Object.keys(attr).length ? attr : null,
        }) }).catch(() => null);
        const j = r ? await r.json().catch(() => ({})) : {};
        setBusy(false);
        if (r?.ok && j.ok) { setDone(j.token); try { trackConversion("Lead", { id: `walkthrough-${j.token}` }); } catch { /* ads blocked */ } }
        else { setErr(String(j.error ?? "Couldn't book — check your connection and try again.")); if (r?.status === 409) { setStart(""); setRefresh((x) => x + 1); } }
      }}>{busy ? "Booking…" : start ? `Book ${when}` : "Pick a time above"}</button>
      <p className="text-xs text-ink-soft">Free, no obligation. We use your details only to set up and follow up on this walkthrough.</p>
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
