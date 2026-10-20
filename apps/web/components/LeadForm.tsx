/*
 * FILE    : apps/web/components/LeadForm.tsx
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-20_0100 UTC
 * PURPOSE : "Get a quote — we'll call you" form → /api/leads/web → Lead inbox with the visitor's channel; the instant
 *           reply goes out by email (and text only if they tick the box). Fires the ad platforms' Lead conversion.
 */
"use client";

import { useState } from "react";
import { BRAND } from "@handled/core";
import { readAttribution, trackConversion } from "@/lib/track";

export function LeadForm({ title = "Get a quote — we’ll call you", business = false }: { title?: string; business?: boolean }) {
  const [f, setF] = useState({ name: "", email: "", phone: "", company: "", zip: "", message: "", website: "" });
  const [sms, setSms] = useState(false);
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");
  const [err, setErr] = useState("");
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });
  if (state === "done") return <div className="card text-center"><div className="text-lg font-bold">Thanks — we got it.</div><p className="mt-1 text-sm text-ink-soft">Check your email for our reply. A real person will call you shortly{BRAND.supportPhone ? ` from ${BRAND.supportPhone}` : ""}.</p></div>;
  return (
    <form className="card space-y-3" onSubmit={async (e) => {
      e.preventDefault();
      setState("busy"); setErr("");
      const r = await fetch("/api/leads/web", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...f, email: f.email || null, phone: f.phone || null, company: f.company || null, zip: f.zip || null, message: f.message || null, sms_consent: sms && Boolean(f.phone), attribution: readAttribution() }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { setState("idle"); setErr(String(j.error ?? "Couldn't send — try again")); return; }
      trackConversion("Lead", { id: `lead-${Date.now()}` });
      setState("done");
    }}>
      <div className="text-lg font-bold">{title}</div>
      <div className="grid gap-3 sm:grid-cols-2">
        <input className="input" required placeholder="Your name" value={f.name} onChange={set("name")} />
        {business && <input className="input" placeholder="Company" value={f.company} onChange={set("company")} />}
        <input className="input" type="email" placeholder="Email" value={f.email} onChange={set("email")} />
        <input className="input" type="tel" placeholder="Phone" value={f.phone} onChange={set("phone")} />
        <input className="input" inputMode="numeric" placeholder="ZIP" maxLength={5} value={f.zip} onChange={set("zip")} />
      </div>
      <textarea className="input min-h-20" placeholder="What do you need done?" value={f.message} onChange={set("message")} />
      <input className="hidden" tabIndex={-1} autoComplete="off" aria-hidden value={f.website} onChange={set("website")} />
      <label className="flex items-start gap-2 text-xs text-ink-soft">
        <input type="checkbox" className="mt-0.5" checked={sms} onChange={(e) => setSms(e.target.checked)} />
        <span>Text me about my request. By checking this, you agree to receive text messages from {BRAND.name} at the number above about your request. Message and data rates may apply; reply STOP to opt out. Consent isn’t required to buy.</span>
      </label>
      <button className="btn-primary w-full" disabled={state === "busy"}>{state === "busy" ? "Sending…" : "Send — we’ll call you"}</button>
      {err && <p className="text-sm text-rose-700">{err}</p>}
    </form>
  );
}
