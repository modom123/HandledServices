/*
 * FILE    : apps/web/components/PostProjectForm.tsx
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-11-07_1614 UTC
 * PURPOSE : "Post your project" form (/post). The customer says what they need (pick a service or describe it), when,
 *           a rough budget, the ZIP and how to reach them. It goes to the Lead inbox (/api/leads/web, campaign
 *           "post-project") with the visitor's source (utm / ref links), so Handled gets the lead, replies in seconds
 *           and calls within minutes. Leads are never sold or shared. After sending, a known service links straight to
 *           its instant price. English / Spanish.
 */
"use client";

import { useState } from "react";
import { BRAND } from "@handled/core";
import { readAttribution, trackConversion } from "@/lib/track";

type Opt = { slug: string; name: string };

export function PostProjectForm({ es, services, preset }: { es: boolean; services: Opt[]; preset?: string | null }) {
  const [f, setF] = useState({ service: preset ?? "", details: "", timing: "", budget: "", zip: "", name: "", email: "", phone: "", website: "" });
  const [sms, setSms] = useState(false);
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");
  const [err, setErr] = useState("");
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
  const L = (en: string, sp: string) => (es ? sp : en);
  const timings = [["asap", L("As soon as possible", "Lo antes posible")], ["week", L("Within a week", "En una semana")], ["month", L("Within a month", "En un mes")], ["flexible", L("I'm flexible", "Tengo flexibilidad")]];
  const budgets = [["u500", L("Under $500", "Menos de $500")], ["500-2000", "$500 – $2,000"], ["2000-10000", "$2,000 – $10,000"], ["10000+", L("Over $10,000", "Más de $10,000")], ["unsure", L("Not sure yet", "Aún no sé")]];
  const label = (list: string[][], v: string) => list.find(([k]) => k === v)?.[1] ?? "";

  if (state === "done") {
    const svc = services.find((s) => s.slug === f.service);
    return (
      <div className="card text-center">
        <div className="text-2xl">✅</div>
        <div className="mt-2 text-lg font-bold">{L("Your project is posted. We're on it.", "Su proyecto está publicado. Nos encargamos.")}</div>
        <p className="mt-1 text-sm text-ink-soft">{L("Check your email for our reply. A real person will call you shortly", "Revise su correo: ya le respondimos. Una persona real le llamará pronto")}{BRAND.supportPhone ? ` ${L("from", "desde el")} ${BRAND.supportPhone}` : ""}.</p>
        {svc && <a href={`/book?service=${svc.slug}&utm_source=post_project`} className="btn-primary mt-4 inline-block">{L(`See your instant price for ${svc.name}`, `Vea su precio al instante: ${svc.name}`)} →</a>}
      </div>
    );
  }

  return (
    <form className="card space-y-4" onSubmit={async (e) => {
      e.preventDefault();
      if (!f.service && f.details.trim().length < 10) { setErr(L("Tell us what you need — pick a service or describe the project.", "Díganos qué necesita: elija un servicio o describa el proyecto.")); return; }
      setState("busy"); setErr("");
      const message = [
        "Posted project",
        f.details.trim() && `Details: ${f.details.trim()}`,
        f.timing && `Timing: ${label(timings, f.timing)}`,
        f.budget && `Budget: ${label(budgets, f.budget)}`,
      ].filter(Boolean).join("\n");
      const r = await fetch("/api/leads/web", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
        name: f.name, email: f.email || null, phone: f.phone || null, zip: f.zip || null, service: f.service || null, message,
        campaign: "post-project", sms_consent: sms && Boolean(f.phone), attribution: readAttribution(), website: f.website,
      }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { setState("idle"); setErr(String(j.error ?? L("Couldn't send — try again", "No se pudo enviar; intente de nuevo"))); return; }
      trackConversion("Lead", { id: `post-${Date.now()}` });
      setState("done");
    }}>
      <div>
        <label className="text-sm font-semibold">{L("What do you need?", "¿Qué necesita?")}</label>
        <select className="input mt-1" value={f.service} onChange={set("service")}>
          <option value="">{L("Not sure — I'll describe it below", "No estoy seguro: lo describo abajo")}</option>
          {services.map((s) => <option key={s.slug} value={s.slug}>{s.name}</option>)}
        </select>
      </div>
      <div>
        <label className="text-sm font-semibold">{L("Describe the project", "Describa el proyecto")}</label>
        <textarea className="input mt-1 min-h-28" maxLength={2500} placeholder={L("What needs to be done, how big it is, anything we should know…", "Qué hay que hacer, de qué tamaño es, cualquier cosa que debamos saber…")} value={f.details} onChange={set("details")} />
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <select className="input" value={f.timing} onChange={set("timing")} aria-label={L("When", "Cuándo")}>
          <option value="">{L("When?", "¿Cuándo?")}</option>
          {timings.map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select className="input" value={f.budget} onChange={set("budget")} aria-label={L("Budget", "Presupuesto")}>
          <option value="">{L("Budget?", "¿Presupuesto?")}</option>
          {budgets.map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <input className="input" inputMode="numeric" maxLength={5} placeholder={L("ZIP code", "Código postal")} value={f.zip} onChange={set("zip")} />
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <input className="input" required placeholder={L("Your name", "Su nombre")} value={f.name} onChange={set("name")} />
        <input className="input" type="email" placeholder={L("Email", "Correo")} value={f.email} onChange={set("email")} />
        <input className="input" type="tel" placeholder={L("Phone", "Teléfono")} value={f.phone} onChange={set("phone")} />
      </div>
      <input className="hidden" tabIndex={-1} autoComplete="off" aria-hidden value={f.website} onChange={set("website")} />
      <label className="flex items-start gap-2 text-xs text-ink-soft">
        <input type="checkbox" className="mt-0.5" checked={sms} onChange={(e) => setSms(e.target.checked)} />
        <span>{L(`Text me about my project. By checking this, you agree to receive text messages from ${BRAND.name} at the number above about your request. Message and data rates may apply; reply STOP to opt out. Consent isn't required to buy.`, `Envíenme mensajes de texto sobre mi proyecto. Al marcar esto, acepta recibir mensajes de ${BRAND.name} al número indicado sobre su solicitud. Pueden aplicar tarifas de mensajes y datos; responda STOP para cancelar. No es necesario para comprar.`)}</span>
      </label>
      <button className="btn-primary w-full py-3 text-base" disabled={state === "busy"}>{state === "busy" ? L("Posting…", "Publicando…") : L("Post my project", "Publicar mi proyecto")}</button>
      <p className="text-center text-xs text-ink-soft">{L("Free, no obligation. Your details go only to Handled — we never sell or share them.", "Gratis y sin compromiso. Sus datos solo los recibe Handled: nunca los vendemos ni compartimos.")}</p>
      {err && <p className="text-sm text-rose-700">{err}</p>}
    </form>
  );
}
