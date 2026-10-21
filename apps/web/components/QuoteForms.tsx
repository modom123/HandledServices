/*
 * FILE    : apps/web/components/QuoteForms.tsx
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-20_0200 UTC
 * PURPOSE : Request-a-quote forms: the customer's request (service, description, photos, ZIP, date, contact) and the
 *           pro's firm quote (their pay → the customer's all-in price shown live, earliest date, note) or decline.
 */
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { QUOTE_REQUEST, SERVICES, money, quoteCustomerPrice } from "@handled/core";
import { PhotoPicker } from "./PhotoPicker";

const BIG = ["home-remodel", "kitchen-remodel", "bathroom-remodel", "exterior-painting", "interior-painting", "junk-removal", "tree-removal", "house-cleaning", "carpet-cleaning", "window-cleaning", "lawn-care", "handyman"];

export function QuoteRequestForm({ initialService }: { initialService?: string }) {
  const router = useRouter();
  const services = [...SERVICES].sort((a, b) => Number(BIG.includes(b.slug)) - Number(BIG.includes(a.slug)) || a.name.localeCompare(b.name));
  const [f, setF] = useState({ service_slug: initialService && services.some((s) => s.slug === initialService) ? initialService : "", description: "", zip: "", city: "", preferred_date: "", contact_name: "", contact_email: "", contact_phone: "" });
  const [photos, setPhotos] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
  return (
    <form className="card space-y-4" onSubmit={async (e) => {
      e.preventDefault(); setBusy(true); setErr("");
      const r = await fetch("/api/quote-requests", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...f, contact_phone: f.contact_phone || null, city: f.city || null, preferred_date: f.preferred_date || null, photos }) });
      const j = await r.json().catch(() => ({}));
      setBusy(false);
      if (!r.ok) { setErr(String(j.error ?? "Couldn't send — try again")); return; }
      router.push(`/quote/${j.token}`);
    }}>
      <div><label className="label">What do you need?</label>
        <select className="input" required value={f.service_slug} onChange={set("service_slug")}>
          <option value="">Pick a service</option>
          {services.map((s) => <option key={s.slug} value={s.slug}>{s.name}</option>)}
        </select></div>
      <div><label className="label">Describe the job</label><textarea className="input min-h-28" required minLength={20} placeholder="Size, rooms or square feet, materials, what's there now, anything the pro should know" value={f.description} onChange={set("description")} /></div>
      <div><label className="label">Photos (recommended — better quotes)</label><PhotoPicker value={photos} onChange={setPhotos} onError={setErr} /></div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div><label className="label">ZIP</label><input className="input" required inputMode="numeric" maxLength={5} pattern="\d{5}" value={f.zip} onChange={set("zip")} /></div>
        <div><label className="label">City</label><input className="input" value={f.city} onChange={set("city")} /></div>
        <div><label className="label">Preferred date (optional)</label><input className="input" type="date" value={f.preferred_date} onChange={set("preferred_date")} /></div>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div><label className="label">Name</label><input className="input" required value={f.contact_name} onChange={set("contact_name")} /></div>
        <div><label className="label">Email</label><input className="input" type="email" required value={f.contact_email} onChange={set("contact_email")} /></div>
        <div><label className="label">Phone</label><input className="input" type="tel" value={f.contact_phone} onChange={set("contact_phone")} /></div>
      </div>
      <button className="btn-primary w-full" disabled={busy}>{busy ? "Sending…" : `Get up to ${QUOTE_REQUEST.maxPros} firm quotes`}</button>
      {err && <p className="text-sm text-rose-700">{err}</p>}
      <p className="text-xs text-ink-soft">Free, no obligation. Vetted, insured local pros send firm, all-in prices within {QUOTE_REQUEST.replyHours} hours. You pay only when you book one.</p>
    </form>
  );
}

export function BidForm({ token, slug, current }: { token: string; slug: string; current: { pay: number | null; earliest_date: string | null; note: string | null } }) {
  const [pay, setPay] = useState(current.pay ? String(current.pay) : "");
  const [date, setDate] = useState(current.earliest_date ?? "");
  const [note, setNote] = useState(current.note ?? "");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const n = Math.round(Number(pay) || 0);
  const send = async (decline: boolean) => {
    setBusy(true); setMsg("");
    const r = await fetch(`/api/quote-bids/${token}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(decline ? { decline: true } : { pay: n, earliest_date: date || null, note: note || null }) });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    setMsg(r.ok ? (decline ? "Declined — thanks for letting us know." : `Sent. The customer sees ${money(j.price)} all-in.`) : String(j.error ?? "Failed"));
  };
  return (
    <div className="card space-y-3 text-sm">
      <div><label className="label">Your price — what you want to earn for the whole job</label>
        <div className="flex items-center gap-1"><span className="text-ink-soft">$</span><input className="input" inputMode="numeric" value={pay} onChange={(e) => setPay(e.target.value.replace(/[^\d]/g, ""))} /></div>
        {n >= QUOTE_REQUEST.minPay && <p className="mt-1 text-xs text-ink-soft">The customer sees {money(quoteCustomerPrice(n, slug))} all-in (Handled's fee and booking fee included). You earn {money(n)}.</p>}</div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div><label className="label">Earliest start</label><input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
        <div><label className="label">Note to the customer (what's included)</label><input className="input" maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} /></div>
      </div>
      <p className="text-xs text-ink-soft">A firm price: if the job matches the description and photos, this is what you're paid. Real surprises go through “extra work” with photos and the customer's approval.</p>
      <div className="flex flex-wrap gap-2">
        <button className="btn-primary" disabled={busy || n < QUOTE_REQUEST.minPay} onClick={() => send(false)}>Send my quote</button>
        <button className="btn-ghost" disabled={busy} onClick={() => send(true)}>Not for me</button>
      </div>
      {msg && <p className="text-ink-soft">{msg}</p>}
    </div>
  );
}
