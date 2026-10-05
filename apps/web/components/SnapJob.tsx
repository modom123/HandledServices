/*
 * FILE    : apps/web/components/SnapJob.tsx
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-05_0449 UTC
 * PURPOSE : "Snap & post a job" on the website: 1) take or upload photos (and say what you need, optional) →
 *           2) the AI names the service and fills in the job details → 3) pick when it needs to be done →
 *           continue into the booking flow with everything filled in (address, exact price, pay) → the paid job goes
 *           out to matching pros to accept. Works on phones (camera) and desktops. English / Spanish.
 */
"use client";

import { useState } from "react";
import { SERVICES, URGENCY, getService, serviceText, t as tr, type Locale, type Urgency } from "@handled/core";
import { PhotoPicker } from "./PhotoPicker";

type Result = { service_slug: string | null; alternatives: string[]; summary: string | null; answers: Record<string, string | number | boolean>; notes: string | null; ai: boolean };

export function SnapJob({ locale = "en" }: { locale?: Locale }) {
  const es = locale === "es";
  const t = (s: string) => tr(locale, s);
  const [photos, setPhotos] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [res, setRes] = useState<Result | null>(null);
  const [slug, setSlug] = useState("");
  const [when, setWhen] = useState<Urgency | null>(null);

  async function identify() {
    setBusy(true); setErr("");
    const r = await fetch("/api/snap", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ photos, note: note || null, locale }) });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok || !j.ok) return setErr(String(j.error ?? (es ? "Intente de nuevo" : "Try again")));
    setRes(j); setSlug(j.service_slug ?? "");
  }

  function go() {
    const svc = getService(slug);
    if (!svc) return;
    const q = new URLSearchParams({ service: slug, src: "snap" });
    if (when && !svc.leadDays) q.set("when", when);
    if (photos.length) q.set("photos", photos.join(","));
    const notes = [note.trim(), res?.service_slug === slug ? res?.notes ?? "" : ""].filter(Boolean).join("\n");
    if (notes) q.set("notes", notes.slice(0, 1500));
    if (res?.service_slug === slug) for (const [k, v] of Object.entries(res.answers)) q.set(k, String(v));
    window.location.href = `/book?${q}`;
  }

  const name = (s: string) => { const x = getService(s); return x ? `${x.icon} ${serviceText(locale, x.slug, x).name}` : s; };
  const step = !res ? 1 : !slug ? 2 : 3;
  return (
    <div className="card mx-auto max-w-2xl space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold">📸 {es ? "Tome una foto y publique su trabajo" : "Snap a photo, post your job"}</h1>
        <p className="text-sm text-ink-soft">{es ? "Muéstrenos qué hay que hacer. Le decimos qué servicio es, llenamos los detalles y usted elige cuándo. Ve el precio exacto antes de pagar, y el trabajo va a profesionales verificados cerca de usted." : "Show us what needs doing. We'll tell you which service it is, fill in the details, and you choose when. You see the exact price before you pay, and the job goes to vetted pros near you."}</p>
      </div>

      <section className="space-y-2">
        <div className="text-sm font-semibold">1. {es ? "Fotos del trabajo" : "Photos of the job"}</div>
        <PhotoPicker value={photos} onChange={(p) => { setPhotos(p); setRes(null); }} onError={setErr} locale={locale} />
        <textarea className="input h-20" placeholder={es ? "¿Qué necesita? (opcional) p. ej. “Llévense todo esto del garaje”" : "What do you need? (optional) e.g. “Haul away everything in the garage”"} value={note} onChange={(e) => { setNote(e.target.value); setRes(null); }} />
        {step === 1 && <button className="btn-primary w-full" disabled={busy || (!photos.length && note.trim().length < 3)} onClick={identify}>{busy ? (es ? "Revisando sus fotos…" : "Looking at your photos…") : es ? "Continuar" : "Continue"}</button>}
      </section>

      {res && (
        <section className="space-y-2">
          <div className="text-sm font-semibold">2. {es ? "Su trabajo" : "Your job"}</div>
          {res.service_slug ? (
            <div className="rounded-xl bg-brand-tint p-3 text-sm"><div className="font-semibold">{es ? "Parece: " : "Looks like: "}{name(res.service_slug)}</div>{res.summary && <p className="mt-1">{res.summary}</p>}</div>
          ) : <p className="text-sm text-ink-soft">{res.ai ? (es ? "No estamos seguros de qué servicio es. Elíjalo:" : "We're not sure which service this is. Pick one:") : (es ? "Elija el servicio:" : "Pick the service:")}</p>}
          <select className="input" value={slug} onChange={(e) => setSlug(e.target.value)}>
            <option value="">{es ? "Elegir un servicio…" : "Choose a service…"}</option>
            {[...(res.service_slug ? [res.service_slug] : []), ...res.alternatives].map((s) => <option key={`top-${s}`} value={s}>{name(s)}</option>)}
            <option disabled>──────────</option>
            {SERVICES.filter((s) => s.slug !== res.service_slug && !res.alternatives.includes(s.slug)).map((s) => <option key={s.slug} value={s.slug}>{name(s.slug)}</option>)}
          </select>
        </section>
      )}

      {slug && (
        <section className="space-y-2">
          <div className="text-sm font-semibold">3. {es ? "¿Para cuándo lo necesita?" : "When does it need to be done?"}</div>
          {getService(slug)?.leadDays ? <p className="text-sm text-ink-soft">{es ? "Elija la fecha en el siguiente paso." : "You'll pick the date on the next step."}</p> : (
            <div className="grid gap-2 sm:grid-cols-2">
              {URGENCY.map((u) => (
                <button key={u.id} type="button" onClick={() => setWhen(u.id)} className={`rounded-xl border p-3 text-left text-sm ${when === u.id ? "border-brand bg-brand-tint" : "border-line hover:border-brand"}`}>
                  <div className="font-semibold">{u.id === "asap" ? "⚡ " : ""}{t(u.label)}</div><div className="text-xs text-ink-soft">{t(u.hint)}</div>
                </button>
              ))}
            </div>
          )}
          <button className="btn-primary w-full" disabled={!getService(slug)?.leadDays && !when} onClick={go}>{es ? "Ver mi precio y reservar →" : "See my price & book →"}</button>
          <p className="text-xs text-ink-soft">{es ? "Siguiente: su dirección, el precio exacto y el pago. En cuanto paga, el trabajo se ofrece a profesionales verificados cerca de usted; el primero que acepta lo toma, y le avisamos." : "Next: your address, the exact price and payment. As soon as you pay, the job is offered to vetted pros near you; the first to accept takes it, and we let you know."}</p>
        </section>
      )}
      {err && <p className="text-sm text-rose-700">{err}</p>}
    </div>
  );
}
