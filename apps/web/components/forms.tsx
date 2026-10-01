/*
 * FILE    : apps/web/components/forms.tsx
 * PROJECT : Handled — AI-run home & business services
 * CREATED : 2026-10-01_1723 UTC
 * PURPOSE : Pro application form and commercial account form.
 */
"use client";

import { useState } from "react";
import { COVERAGES, SERVICES, TRADES, TRADE_PROFILES, specialtiesFor, type CoverageKey } from "@handled/core";

function useSubmit(url: string) {
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");
  const [error, setError] = useState("");
  async function submit(body: unknown) {
    setState("busy");
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (res.ok) return setState("done");
    setError((await res.json().catch(() => ({}))).error ?? "Something went wrong");
    setState("error");
  }
  return { state, error, submit };
}

function Chips({ options, value, onChange }: { options: { id: string; label: string }[]; value: string[]; onChange: (v: string[]) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const on = value.includes(o.id);
        return (
          <button type="button" key={o.id} onClick={() => onChange(on ? value.filter((v) => v !== o.id) : [...value, o.id])}
            className={`rounded-full border px-3 py-1.5 text-sm ${on ? "border-brand bg-brand-tint font-semibold text-brand-dark" : "border-line bg-white"}`}>{o.label}</button>
        );
      })}
    </div>
  );
}

export function ApplyForm() {
  const { state, error, submit } = useSubmit("/api/applications");
  const [trades, setTrades] = useState<string[]>([]);
  const [insured, setInsured] = useState(false);
  const [specialties, setSpecialties] = useState<string[]>([]);
  const [coverages, setCoverages] = useState<string[]>([]);
  const specialtyOptions = specialtiesFor(trades).map((s) => ({ id: s.id, label: s.label }));
  const needs = [...new Set(trades.flatMap((t) => TRADE_PROFILES[t] ? [...TRADE_PROFILES[t].requires, ...(TRADE_PROFILES[t].license ? ["license"] : [])] : []))];
  if (state === "done") return <div className="card text-center"><div className="text-3xl">🎉</div><h2 className="mt-2 text-xl font-bold">Application received</h2><p className="mt-2 text-sm text-ink-soft">We review applications within 2 business days. Watch your email for next steps (insurance + background check).</p></div>;
  return (
    <form className="card space-y-4" onSubmit={(e) => {
      e.preventDefault();
      const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
      submit({ ...f, trades, insured, specialties: specialties.filter((s) => specialtyOptions.some((o) => o.id === s)), coverages_held: coverages, years_experience: f.years_experience || undefined, crew_size: f.crew_size || undefined });
    }}>
      <div className="grid gap-4 sm:grid-cols-2">
        <div><label className="label">Business name</label><input name="business_name" required className="input" /></div>
        <div><label className="label">Your name</label><input name="contact_name" required className="input" /></div>
        <div><label className="label">Email</label><input name="email" type="email" required className="input" /></div>
        <div><label className="label">Mobile</label><input name="phone" type="tel" required className="input" /></div>
      </div>
      <div><label className="label">Trades</label><Chips options={TRADES} value={trades} onChange={setTrades} /></div>
      {specialtyOptions.length > 0 && <div><label className="label">Your specialties (what you do best)</label><Chips options={specialtyOptions} value={specialties} onChange={setSpecialties} /></div>}
      {needs.length > 0 && (
        <p className="rounded-xl bg-brand-tint p-3 text-xs text-ink-soft">
          For these trades you’ll also need: {needs.map((k) => (k === "license" ? "a state license" : COVERAGES[k as CoverageKey].label.toLowerCase())).join(", ")}, on top of general liability. Don’t have it yet? Apply anyway — we’ll point you to brokers.
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-3">
        <div><label className="label">ZIP codes you serve</label><input name="zips" className="input" placeholder="48201, 48202" /></div>
        <div><label className="label">Years in business</label><input name="years_experience" type="number" min={0} className="input" /></div>
        <div><label className="label">Crew size</label><input name="crew_size" type="number" min={1} className="input" /></div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div><label className="label">License # (if your trade needs one)</label><input name="license_number" className="input" /></div>
        <label className="flex items-center gap-2 self-end text-sm"><input type="checkbox" checked={insured} onChange={(e) => setInsured(e.target.checked)} /> I carry general liability insurance</label>
      </div>
      <div><label className="label">Other coverage you carry</label><Chips options={(Object.keys(COVERAGES) as CoverageKey[]).filter((k) => k !== "gl").map((k) => ({ id: k, label: COVERAGES[k].label }))} value={coverages} onChange={setCoverages} /></div>
      <div><label className="label">Equipment &amp; vehicle</label><input name="equipment" className="input" placeholder="e.g. 16 ft box truck, truck-mount carpet unit, 52&quot; zero-turn" /></div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div><label className="label">Two references (name + phone)</label><textarea name="references_text" className="input min-h-20" placeholder="Past clients or contractors you’ve worked for" /></div>
        <div><label className="label">Photos of your work / website / Google reviews</label><textarea name="work_links" className="input min-h-20" placeholder="Links" /></div>
      </div>
      <div><label className="label">Tell us about your crew</label><textarea name="message" className="input min-h-24" /></div>
      {state === "error" && <p className="text-sm text-rose-700">{error}</p>}
      <button className="btn-primary" disabled={state === "busy" || !trades.length}>{state === "busy" ? "Sending…" : "Apply"}</button>
    </form>
  );
}

export function BusinessForm() {
  const { state, error, submit } = useSubmit("/api/business");
  const [services, setServices] = useState<string[]>([]);
  if (state === "done") return <div className="card text-center"><div className="text-3xl">🤝</div><h2 className="mt-2 text-xl font-bold">Thanks — we’ll be in touch today</h2><p className="mt-2 text-sm text-ink-soft">An account manager will send a site-by-site proposal within one business day.</p></div>;
  return (
    <form className="card space-y-4" onSubmit={(e) => { e.preventDefault(); submit({ ...Object.fromEntries(new FormData(e.currentTarget)), services_needed: services }); }}>
      <div className="grid gap-4 sm:grid-cols-2">
        <div><label className="label">Company</label><input name="company" required className="input" /></div>
        <div><label className="label">Your name</label><input name="contact_name" required className="input" /></div>
        <div><label className="label">Work email</label><input name="email" type="email" required className="input" /></div>
        <div><label className="label">Phone</label><input name="phone" type="tel" className="input" /></div>
      </div>
      <div><label className="label">Number of locations</label><input name="locations" type="number" min={1} defaultValue={1} className="input w-32" /></div>
      <div><label className="label">Services needed</label><Chips options={SERVICES.map((s) => ({ id: s.slug, label: s.name }))} value={services} onChange={setServices} /></div>
      <div><label className="label">Anything else</label><textarea name="notes" className="input min-h-24" placeholder="Square footage, schedules, current vendor pain points…" /></div>
      {state === "error" && <p className="text-sm text-rose-700">{error}</p>}
      <button className="btn-primary" disabled={state === "busy"}>{state === "busy" ? "Sending…" : "Request a proposal"}</button>
    </form>
  );
}
