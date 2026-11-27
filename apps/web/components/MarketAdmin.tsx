/*
 * FILE    : apps/web/components/MarketAdmin.tsx
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-03_0152 UTC
 * PURPOSE : Hub → Market pricing controls: override a service's factor (or hand it back to
 *           learning), and re-learn from offers now.
 * UPDATED : 2026-11-27_1800 UTC — ResearchForm / ResearchDelete: market research the AI quote learns from (what other
 *           companies charge for a typical job). "Re-learn now" also counts finished jobs and research.
 * UPDATED : 2026-10-03_1255 UTC — ApplyFactor: one-click apply of a factor suggested by Hub → Pricing accuracy.
 */
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

async function post(body: unknown) {
  const r = await fetch("/api/hub/market", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  return r.ok ? null : j.error ?? "Failed";
}

export function FactorOverride({ slug, manual }: { slug: string; manual: number | null }) {
  const router = useRouter();
  const [v, setV] = useState(manual != null ? String(manual) : "");
  const [msg, setMsg] = useState("");
  return (
    <span className="inline-flex items-center gap-1">
      <input className="input w-20 px-2 py-1 text-xs" placeholder="auto" value={v} onChange={(e) => setV(e.target.value.replace(/[^\d.]/g, ""))} />
      <button className="btn-ghost px-2 py-1 text-xs" onClick={async () => { const e = await post({ service_slug: slug, manual_factor: v ? Number(v) : null }); if (e) setMsg(e); else { setMsg(""); router.refresh(); } }}>Set</button>
      {msg && <span className="text-xs text-rose-700">{msg}</span>}
    </span>
  );
}

/** Pricing accuracy → set the suggested factor as the manual override. */
export function ApplyFactor({ slug, factor }: { slug: string; factor: number }) {
  const router = useRouter();
  const [state, setState] = useState<"" | "busy" | "done" | string>("");
  return (
    <span className="inline-flex items-center gap-1">
      <button className="btn-primary px-3 py-1 text-xs" disabled={state === "busy" || state === "done"} onClick={async () => { setState("busy"); const e = await post({ service_slug: slug, manual_factor: factor }); setState(e ?? "done"); if (!e) router.refresh(); }}>{state === "done" ? "Applied" : state === "busy" ? "Applying…" : `Apply ${factor.toFixed(2)}×`}</button>
      {state && !["busy", "done"].includes(state) && <span className="text-xs text-rose-700">{state}</span>}
    </span>
  );
}

export function RelearnButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return <button className="btn-ghost text-sm" disabled={busy} onClick={async () => { setBusy(true); await post({ action: "relearn" }); setBusy(false); router.refresh(); }}>{busy ? "Learning…" : "Re-learn now"}</button>;
}

/** Add one market research entry: what another company charges for a typical job of this service. */
export function ResearchForm({ services }: { services: { slug: string; name: string; typical: number }[] }) {
  const router = useRouter();
  const [f, setF] = useState({ service_slug: services[0]?.slug ?? "", area: "", low: "", typical: "", high: "", source: "", note: "" });
  const [msg, setMsg] = useState("");
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
  const ours = services.find((x) => x.slug === f.service_slug)?.typical ?? 0;
  const num = (v: string) => (v.trim() ? Number(v.replace(/[^\d.]/g, "")) : null);
  return (
    <form className="grid gap-2 text-sm sm:grid-cols-6" onSubmit={async (e) => {
      e.preventDefault(); setMsg("");
      const err = await post({ action: "research_add", service_slug: f.service_slug, area: f.area.trim() || "all", low: num(f.low), typical: num(f.typical), high: num(f.high), source: f.source.trim() || null, note: f.note.trim() || null });
      if (err) return setMsg(err);
      setMsg("Saved. It counts in the next learning run (daily, or press Re-learn now)."); setF({ ...f, low: "", typical: "", high: "", source: "", note: "" }); router.refresh();
    }}>
      <select className="input sm:col-span-2" value={f.service_slug} onChange={set("service_slug")}>{services.map((x) => <option key={x.slug} value={x.slug}>{x.name}</option>)}</select>
      <input className="input" placeholder="ZIP area (481) or blank = all" value={f.area} onChange={set("area")} maxLength={3} />
      <input className="input" placeholder="Low $" inputMode="decimal" value={f.low} onChange={set("low")} />
      <input className="input" placeholder="Typical $ *" inputMode="decimal" required value={f.typical} onChange={set("typical")} />
      <input className="input" placeholder="High $" inputMode="decimal" value={f.high} onChange={set("high")} />
      <input className="input sm:col-span-3" placeholder="Source (company, Angi, HomeAdvisor, a quote you got…)" value={f.source} onChange={set("source")} maxLength={200} />
      <input className="input sm:col-span-2" placeholder="Note (optional)" value={f.note} onChange={set("note")} maxLength={500} />
      <button className="btn-primary">Add</button>
      <p className="text-xs text-ink-soft sm:col-span-6">Our typical price for this job today: <b>${Math.round(ours)}</b>. Enter what others charge for the same typical job. Entries under half or over double ours are ignored as typos.{msg && <span className="ml-2 font-semibold text-ink">{msg}</span>}</p>
    </form>
  );
}

export function ResearchDelete({ id }: { id: string }) {
  const router = useRouter();
  return <button className="text-xs text-rose-700 underline" onClick={async () => { if (confirm("Remove this research entry?")) { await post({ action: "research_delete", id }); router.refresh(); } }}>Remove</button>;
}
