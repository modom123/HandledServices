"use client";
/*
 * FILE    : apps/web/components/BizPhotoQuote.tsx
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-11-25_0200 UTC
 * PURPOSE : Price from photos (businesses, instead of a walkthrough): pick what you need and how often, follow the shot
 *           list, add 2–8 photos, and see the price per visit (and about-a-month for recurring work) right away, with a
 *           button to book it at that price. Too big or unclear for an instant price: the team sends a firm price from
 *           the same photos within a few business hours. POST /api/photo-quote.
 */
import { useState } from "react";
import { BIZ_FREQUENCIES, PHOTO_QUOTE, photoShots } from "@handled/core";
import { PhotoPicker } from "@/components/PhotoPicker";

type Opt = { slug: string; name: string };
type Result = { service: string; frequency: string; per_visit: number | null; monthly: number | null; low: number | null; high: number | null; instant: boolean; reason: string | null;
  assumptions: { label: string; value: string }[]; tailored: boolean; book_url: string | null; review_hours: number };
const $ = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;

export function BizPhotoQuote({ services, preset, lead, landing, prefill }: { services: Opt[]; preset?: string | null; lead?: string | null; landing?: string | null; prefill?: { company?: string | null; name?: string | null; email?: string | null; phone?: string | null; zip?: string | null } | null }) {
  const [f, setF] = useState({ service: preset ?? services[0]?.slug ?? "", frequency: "once", sqft: "", details: "", zip: prefill?.zip ?? "",
    company: prefill?.company ?? "", name: prefill?.name ?? "", email: prefill?.email ?? "", phone: prefill?.phone ?? "" });
  const [photos, setPhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [res, setRes] = useState<Result | null>(null);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });

  if (res) return (
    <div className="card space-y-3 border-brand">
      {res.per_visit && res.instant ? (
        <>
          <div className="text-xs font-semibold uppercase tracking-wide text-brand">Your price, from your photos</div>
          <div className="text-4xl font-extrabold text-brand-deep">{$(res.per_visit)}{res.frequency !== "once" && <span className="text-base font-semibold text-ink-soft"> per visit</span>}</div>
          {res.monthly && <div className="font-semibold">About {$(res.monthly)} a month ({BIZ_FREQUENCIES.find((x) => x.value === res.frequency)?.label.toLowerCase()})</div>}
          <p className="text-sm text-ink-soft">{res.service}. No walkthrough needed: book it at this price, 25% to book and the rest when the work is done. If the pro finds more work on site than the photos showed, you approve any change before it&apos;s done.</p>
          {res.assumptions.length > 0 && <details className="text-sm"><summary className="cursor-pointer font-semibold">What the price is based on</summary><ul className="mt-1 list-disc pl-5">{res.assumptions.map((a) => <li key={a.label}>{a.label}: {a.value}</li>)}</ul></details>}
          {res.book_url && <a href={res.book_url} className="btn-primary inline-block px-6 py-3 text-base">Book it at {$(res.per_visit)}</a>}
          <p className="text-xs text-ink-soft">We sent this to our team too: someone will follow up today in case you have questions.</p>
        </>
      ) : (
        <>
          <div className="text-xs font-semibold uppercase tracking-wide text-brand">Got it: no walkthrough needed</div>
          <h3 className="text-xl font-bold">We&apos;ll send your firm price within {res.review_hours} business hours.</h3>
          <p className="text-sm text-ink-soft">{res.reason ? `${res.reason}, so a person on our team prices it from your photos` : "A person on our team prices this one from your photos"}{res.low && res.high ? ` (typically ${$(res.low)}–${$(res.high)})` : ""}. Watch your inbox at {f.email}. If we need one more photo, we&apos;ll ask.</p>
        </>
      )}
      <button type="button" className="text-sm text-brand underline" onClick={() => { setRes(null); setPhotos([]); }}>Price another job</button>
    </div>
  );

  return (
    <form className="card space-y-4" onSubmit={async (e) => {
      e.preventDefault(); setErr("");
      if (uploading) return setErr("Wait for your photos to finish uploading.");
      if (photos.length < PHOTO_QUOTE.minPhotos) return setErr(`Add at least ${PHOTO_QUOTE.minPhotos} photos (the shot list shows which).`);
      setBusy(true);
      const r = await fetch("/api/photo-quote", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
        service: f.service, frequency: f.frequency, details: f.details || null, sqft: f.sqft ? Number(f.sqft.replace(/\D/g, "")) || null : null, zip: f.zip.trim(), photos,
        company: f.company, name: f.name, email: f.email, phone: f.phone || null, lead: lead ?? null, landing: landing ?? null }) }).catch(() => null);
      const j = r ? await r.json().catch(() => ({})) : {};
      setBusy(false);
      if (!r?.ok || !j.ok) return setErr(String((j as { error?: string }).error ?? "Couldn't price it. Try again, or call us."));
      setRes(j as Result);
    }}>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm">What do you need?<select className="input mt-1" value={f.service} onChange={set("service")}>{services.map((s) => <option key={s.slug} value={s.slug}>{s.name}</option>)}</select></label>
        <label className="text-sm">How often?<select className="input mt-1" value={f.frequency} onChange={set("frequency")}>{BIZ_FREQUENCIES.map((x) => <option key={x.value} value={x.value}>{x.label}</option>)}</select></label>
        <label className="text-sm">Square feet (if you know)<input className="input mt-1" inputMode="numeric" placeholder="e.g. 3,000" value={f.sqft} onChange={set("sqft")} /></label>
        <label className="text-sm">ZIP code<input className="input mt-1" inputMode="numeric" maxLength={5} required value={f.zip} onChange={set("zip")} /></label>
      </div>
      <div className="rounded-lg bg-paper p-3 text-sm">
        <div className="font-semibold">📸 Photos for an exact price ({PHOTO_QUOTE.minPhotos}–{PHOTO_QUOTE.maxPhotos})</div>
        <ul className="mt-1 list-disc pl-5 text-ink-soft">{photoShots(f.service).map((s) => <li key={s}>{s}</li>)}</ul>
        <div className="mt-2"><PhotoPicker value={photos} onChange={setPhotos} max={PHOTO_QUOTE.maxPhotos} onError={setErr} onBusy={setUploading} /></div>
      </div>
      <label className="block text-sm">Anything else? (optional)<textarea className="input mt-1" rows={2} placeholder="e.g. 2 restrooms, after 6pm, 12 units in the building" value={f.details} onChange={set("details")} /></label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm">Company<input className="input mt-1" required value={f.company} onChange={set("company")} /></label>
        <label className="text-sm">Your name<input className="input mt-1" required value={f.name} onChange={set("name")} /></label>
        <label className="text-sm">Email<input className="input mt-1" type="email" required value={f.email} onChange={set("email")} /></label>
        <label className="text-sm">Phone (optional)<input className="input mt-1" type="tel" value={f.phone} onChange={set("phone")} /></label>
      </div>
      <button className="btn-primary w-full py-3 text-base" disabled={busy || uploading}>{uploading ? "Uploading photos…" : busy ? "Reading your photos…" : "Get my price"}</button>
      {err && <p className="text-sm text-rose-700">{err}</p>}
      <p className="text-xs text-ink-soft">Free, no obligation, no walkthrough. Your photos are only used to price and do your job.</p>
    </form>
  );
}
