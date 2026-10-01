/*
 * FILE    : apps/web/components/BookingWizard.tsx
 * PROJECT : Handled — AI-run home & business services
 * CREATED : 2026-10-01_1723 UTC
 * PURPOSE : 4-step booking flow: service → details & photos → when/where → review.
 *           Price updates live from the shared pricing engine; the optional AI check
 *           reads notes + photos and tightens the price before booking.
 */
"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BRAND, CATEGORIES, SERVICES, TIME_WINDOW_LABEL, defaultAnswers, estimate, getService, isRush, money, moneyRange,
  type Answers, type Frequency, type TimeWindow,
} from "@handled/core";

const FREQ_LABEL: Record<Frequency, string> = { once: "One time", weekly: "Weekly (save 20%)", biweekly: "Every 2 weeks (save 15%)", monthly: "Monthly (save 10%)", quarterly: "Quarterly (save 5%)" };
const tomorrow = () => new Date(Date.now() + 86400000).toISOString().slice(0, 10);
// default 3 days out so the within-48h priority surcharge is opt-in, not a surprise
const defaultDate = () => new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);

type AiResult = { final_price: number; low: number; high: number; customer_summary: string; needs_site_visit: boolean } | null;

export function BookingWizard({ initialService }: { initialService?: string }) {
  const router = useRouter();
  const [slug, setSlug] = useState(getService(initialService ?? "") ? initialService! : "");
  const [step, setStep] = useState(slug ? 1 : 0);
  const svc = getService(slug);
  const [answers, setAnswers] = useState<Answers>(svc ? defaultAnswers(svc) : {});
  const [frequency, setFrequency] = useState<Frequency>("once");
  const [notes, setNotes] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [date, setDate] = useState(defaultDate());
  const [win, setWin] = useState<TimeWindow>("morning");
  const [form, setForm] = useState({ contact_name: "", contact_email: "", contact_phone: "", address: "", city: "", state: "MI", zip: "", customer_type: "residential", company_name: "" });
  const [ai, setAi] = useState<AiResult>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [agreed, setAgreed] = useState(false);

  const est = useMemo(() => (svc ? estimate({ slug: svc.slug, answers, frequency, rush: isRush(date) }) : null), [svc, answers, frequency, date]);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm({ ...form, [k]: e.target.value });

  function pick(s: string) {
    const next = getService(s)!;
    setSlug(s);
    setAnswers(defaultAnswers(next));
    setFrequency("once");
    setAi(null);
    setStep(1);
  }

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    const fd = new FormData();
    Array.from(files).slice(0, 8 - photos.length).forEach((f) => fd.append("photos", f));
    const res = await fetch("/api/uploads", { method: "POST", body: fd });
    const json = await res.json();
    setUploading(false);
    if (!res.ok) return setError(json.error ?? "Upload failed");
    setPhotos([...photos, ...json.paths]);
    setAi(null);
  }

  async function runAi() {
    setAiBusy(true);
    const res = await fetch("/api/quote", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ service_slug: slug, answers, frequency, scheduled_date: date, notes, photos, ai: true }) });
    const json = await res.json();
    setAiBusy(false);
    setAi(json.ai ?? null);
    if (!json.ai) setError("AI check unavailable right now — your instant price still stands.");
  }

  async function book() {
    setBusy(true);
    setError("");
    const res = await fetch("/api/bookings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, company_name: form.company_name || null, service_slug: slug, answers, frequency, scheduled_date: date, time_window: win, notes: notes || null, photos, source: "web", accept_terms: agreed }),
    });
    const json = await res.json();
    setBusy(false);
    if (!res.ok) return setError(json.error ?? "Booking failed");
    if (json.checkout) window.location.href = json.checkout;
    else router.push(`/book/confirmed?ref=${json.ref}`);
  }

  const price = ai ? { low: ai.low, high: ai.high } : est ? { low: est.low, high: est.high } : null;
  const contactOk = form.contact_name.length > 1 && /\S+@\S+\.\S+/.test(form.contact_email) && form.contact_phone.length >= 7;
  const placeOk = form.address.length > 2 && form.city.length > 1 && /^\d{5}$/.test(form.zip) && form.state.length === 2;

  return (
    <div className="grid gap-8 lg:grid-cols-[1.5fr_1fr]">
      <div>
        <ol className="mb-6 flex gap-2 text-xs font-semibold">
          {["Service", "Details", "When & where", "Review"].map((l, i) => (
            <li key={l} className={`rounded-full px-3 py-1 ${i === step ? "bg-ink text-white" : i < step ? "bg-brand-tint text-brand-dark" : "bg-white text-ink-soft border border-line"}`}>{i + 1}. {l}</li>
          ))}
        </ol>

        {step === 0 && (
          <div className="space-y-8">
            {CATEGORIES.map((c) => (
              <div key={c.id}>
                <div className="mb-3 font-semibold">{c.name}</div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {SERVICES.filter((s) => s.category === c.id).map((s) => (
                    <button key={s.slug} onClick={() => pick(s.slug)} className="card flex items-center gap-3 text-left transition hover:border-brand">
                      <span className="text-2xl">{s.icon}</span>
                      <span><span className="block text-sm font-semibold">{s.name}</span><span className="text-xs text-ink-soft">from {money(s.minimum)}</span></span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {step === 1 && svc && (
          <div className="card space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold">{svc.icon} {svc.name}</h2>
              <button className="text-sm text-brand" onClick={() => setStep(0)}>Change</button>
            </div>
            {svc.questions.map((q) => (
              <div key={q.id}>
                <label className="label">{q.label}</label>
                {q.type === "number" && (
                  <NumberField min={q.min} max={q.max} unit={q.unit} value={Number(answers[q.id] ?? q.default)}
                    onChange={(v) => { setAnswers((cur) => ({ ...cur, [q.id]: v })); setAi(null); }} />
                )}
                {q.type === "select" && (
                  <div className="flex flex-wrap gap-2">
                    {q.options.map((o) => (
                      <button key={o.value} onClick={() => { setAnswers({ ...answers, [q.id]: o.value }); setAi(null); }} className={`rounded-full border px-3.5 py-1.5 text-sm ${answers[q.id] === o.value ? "border-brand bg-brand-tint font-semibold text-brand-dark" : "border-line bg-white"}`}>{o.label}</button>
                    ))}
                  </div>
                )}
                {q.type === "toggle" && (
                  <button onClick={() => { setAnswers({ ...answers, [q.id]: !answers[q.id] }); setAi(null); }} className={`rounded-full border px-3.5 py-1.5 text-sm ${answers[q.id] ? "border-brand bg-brand-tint font-semibold text-brand-dark" : "border-line bg-white"}`}>{answers[q.id] ? "Yes" : "No"}</button>
                )}
                {q.help && <p className="mt-1 text-xs text-ink-soft">{q.help}</p>}
              </div>
            ))}
            {svc.frequencies.length > 1 && (
              <div>
                <label className="label">How often</label>
                <div className="flex flex-wrap gap-2">
                  {svc.frequencies.map((f) => (
                    <button key={f} onClick={() => setFrequency(f)} className={`rounded-full border px-3.5 py-1.5 text-sm ${frequency === f ? "border-brand bg-brand-tint font-semibold text-brand-dark" : "border-line bg-white"}`}>{FREQ_LABEL[f]}</button>
                  ))}
                </div>
              </div>
            )}
            <div>
              <label className="label">Anything we should know?</label>
              <textarea className="input min-h-24" placeholder="Gate code, pets, parking, what's in the garage, the tree is leaning toward the house…" value={notes} onChange={(e) => { setNotes(e.target.value); setAi(null); }} />
            </div>
            <div>
              <label className="label">Photos (optional, up to 8) — the AI uses them to tighten your price</label>
              <input type="file" accept="image/*" multiple onChange={(e) => upload(e.target.files)} disabled={uploading || photos.length >= 8} className="text-sm" />
              <p className="mt-1 text-xs text-ink-soft">{uploading ? "Uploading…" : photos.length ? `${photos.length} photo(s) attached` : ""}</p>
            </div>
            <button className="btn-primary" onClick={() => setStep(2)}>Continue</button>
          </div>
        )}

        {step === 2 && (
          <div className="card space-y-5">
            <h2 className="text-xl font-bold">When & where</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div><label className="label">{svc?.siteVisit ? "Site visit date" : "Date"}</label><input type="date" className="input" min={tomorrow()} value={date} onChange={(e) => setDate(e.target.value)} /></div>
              <div><label className="label">Arrival window</label>
                <select className="input" value={win} onChange={(e) => setWin(e.target.value as TimeWindow)}>
                  {Object.entries(TIME_WINDOW_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-2">
              {(["residential", "commercial"] as const).map((t) => (
                <button key={t} onClick={() => setForm({ ...form, customer_type: t })} className={`rounded-full border px-3.5 py-1.5 text-sm capitalize ${form.customer_type === t ? "border-brand bg-brand-tint font-semibold text-brand-dark" : "border-line bg-white"}`}>{t === "residential" ? "Home" : "Business"}</button>
              ))}
            </div>
            {form.customer_type === "commercial" && <div><label className="label">Company</label><input className="input" value={form.company_name} onChange={set("company_name")} /></div>}
            <div><label className="label">Street address</label><input className="input" autoComplete="street-address" value={form.address} onChange={set("address")} /></div>
            <div className="grid grid-cols-[1fr_80px_110px] gap-3">
              <div><label className="label">City</label><input className="input" value={form.city} onChange={set("city")} /></div>
              <div><label className="label">State</label><input className="input uppercase" maxLength={2} value={form.state} onChange={set("state")} /></div>
              <div><label className="label">ZIP</label><input className="input" inputMode="numeric" maxLength={5} value={form.zip} onChange={set("zip")} /></div>
            </div>
            <div className="flex gap-2"><button className="btn-ghost" onClick={() => setStep(1)}>Back</button><button className="btn-primary" disabled={!placeOk} onClick={() => setStep(3)}>Continue</button></div>
          </div>
        )}

        {step === 3 && (
          <div className="card space-y-5">
            <h2 className="text-xl font-bold">Your contact info</h2>
            <div><label className="label">Full name</label><input className="input" autoComplete="name" value={form.contact_name} onChange={set("contact_name")} /></div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div><label className="label">Email</label><input className="input" type="email" autoComplete="email" value={form.contact_email} onChange={set("contact_email")} /></div>
              <div><label className="label">Mobile</label><input className="input" type="tel" autoComplete="tel" value={form.contact_phone} onChange={set("contact_phone")} /></div>
            </div>
            <p className="text-xs text-ink-soft">We text updates about this job only. We never sell your info to other contractors.</p>
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" className="mt-1" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
              <span>I agree to the <a href="/terms/service-agreement" target="_blank" className="font-semibold text-brand underline">Service Agreement</a>: {svc?.siteVisit ? "the site visit is free; I pay upfront once I approve the firm quote." : "I pay upfront; you pay the pro after the job is done and checked; free redo or refund if it’s not right."}</span>
            </label>
            {error && <p className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
            <div className="flex flex-wrap gap-2">
              <button className="btn-ghost" onClick={() => setStep(2)}>Back</button>
              <button className="btn-primary" disabled={!contactOk || !agreed || busy} onClick={book}>{busy ? (svc?.siteVisit ? "Booking…" : "Finalizing your price…") : svc?.siteVisit ? "Book free site visit" : `Pay ${est ? money(ai?.final_price ?? est.point) : ""} & book`}</button>
            </div>
          </div>
        )}
      </div>

      {svc && est && price && (
        <aside className="card h-fit lg:sticky lg:top-24">
          <div className="text-xs font-semibold uppercase tracking-wide text-ink-soft">{svc.siteVisit ? "Estimated range" : frequency === "once" ? "Your price" : "Per visit"}</div>
          <div className="mt-1 text-3xl font-bold">{svc.siteVisit ? moneyRange(price.low, price.high) : money(ai?.final_price ?? est.point)}</div>
          {ai && <p className="mt-2 rounded-xl bg-brand-tint p-3 text-sm text-brand-dark">✨ {ai.customer_summary}</p>}
          <ul className="mt-4 space-y-1.5 border-t border-line pt-4 text-sm">
            {est.items.map((i) => (
              <li key={i.label} className="flex justify-between gap-3"><span className="text-ink-soft">{i.label}</span><span className={i.amount < 0 ? "text-brand" : ""}>{money(i.amount)}</span></li>
            ))}
          </ul>
          {(notes.trim() || photos.length > 0) && !ai && (
            <button className="btn-ghost mt-4 w-full" onClick={runAi} disabled={aiBusy}>{aiBusy ? "AI is reviewing…" : "✨ Let AI check my notes & photos"}</button>
          )}
          <p className="mt-4 text-xs text-ink-soft">
            {svc.siteVisit ? "Free site visit — a pro confirms the firm price, then you pay to lock in the work." : BRAND.promise}
          </p>
        </aside>
      )}
    </div>
  );
}

/**
 * Number input + slider. Typing is free-form (no clamping per keystroke — that turned
 * "2500" into 10000); the value is applied live while in range and clamped on blur.
 * Big ranges (square feet) step by 50 on the slider.
 */
function NumberField({ value, min, max, unit, onChange }: { value: number; min: number; max: number; unit?: string; onChange: (v: number) => void }) {
  const [text, setText] = useState(String(value));
  const [editing, setEditing] = useState(false);
  const step = max >= 2000 ? 50 : max >= 200 ? 5 : 1;
  const shown = editing ? text : value.toLocaleString("en-US");
  return (
    <div className="flex items-center gap-3">
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => { onChange(Number(e.target.value)); setText(e.target.value); }}
        className="flex-1 accent-[var(--color-brand)]" aria-label={unit ?? "amount"} />
      <input type="text" inputMode="numeric" className="input w-28 text-right" value={shown}
        onFocus={() => { setEditing(true); setText(String(value)); }}
        onChange={(e) => {
          const raw = e.target.value.replace(/[^0-9]/g, "");
          setText(raw);
          const n = Number(raw);
          if (raw && n >= min && n <= max) onChange(n);
        }}
        onBlur={() => { setEditing(false); const n = Number(text); onChange(Math.min(max, Math.max(min, Number.isFinite(n) && text ? n : value))); }}
        onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }} />
      {unit && <span className="w-12 text-sm text-ink-soft">{unit}</span>}
    </div>
  );
}
