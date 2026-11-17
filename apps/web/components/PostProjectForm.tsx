/*
 * FILE    : apps/web/components/PostProjectForm.tsx
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-11-07_1614 UTC
 * PURPOSE : "Post your project" form (/post). The customer says what they need (pick a service or describe it), when,
 *           a rough budget, the ZIP and how to reach them. It goes to the Lead inbox (/api/leads/web, campaign
 *           "post-project") with the visitor's source (utm / ref links), so Handled gets the lead, replies in seconds
 *           and calls within minutes. Leads are never sold or shared. After sending, a known service links straight to
 *           its instant price. English / Spanish.
 * UPDATED : 2026-11-07_1500 UTC — Post & earn: a tick-box (checked by default) joins the Partner Program and pays 10%
 *           back, up to $250, on the poster's own first project (needs an email). The done state shows their code.
 * UPDATED : 2026-11-09_1600 UTC — Professional look: line icons instead of emoji (ThemedIcon / Ico switch by look; Original unchanged).
 * UPDATED : 2026-11-17_1446 UTC — Estimate first. 1) Describe the project (photos optional) → 2) an instant estimate
 *           right away, no contact details needed (/api/post/estimate: the AI reads the project, the rules engine
 *           prices it) → 3) the customer picks what's next: book now at that price, work it through with their AI
 *           project manager (chat that knows the project, re-prices as the scope changes and hands off to a person),
 *           or have a person call (the Lead inbox, now with the estimate attached for whoever calls).
 * UPDATED : 2026-11-17_1530 UTC — appointment calendar: "Have a person call me" now offers "As soon as possible" or
 *           "Pick a time" (CallScheduler: our open call times, in the visitor's time zone). A booked time needs a phone;
 *           if it was just taken, the calendar reloads. The done screen shows the time with Add-to-calendar links.
 */
"use client";

import { useRef, useState } from "react";
import { Ico, ThemedIcon } from "@/components/Glyph";
import { BRAND, callCalendarLinks, firstProjectLine, moneyRange } from "@handled/core";
import { readAttribution, trackConversion } from "@/lib/track";
import { PhotoPicker } from "./PhotoPicker";
import { CallScheduler, browserTz } from "./CallScheduler";

type Opt = { slug: string; name: string };
type Est = {
  service_slug: string | null; service_name: string | null; alternatives: Opt[]; summary: string | null;
  assumptions: { label: string; value: string }[]; answers: Record<string, string | number | boolean>; notes: string | null;
  price: { low: number; high: number; items: { label: string; amount: number }[] } | null;
  site_visit: boolean; consult_only: boolean; ai: boolean; tailored: boolean;
};
type Turn = { role: "user" | "assistant"; content: string };

const BUDGET_MAX: Record<string, number> = { u500: 500, "500-2000": 2000, "2000-10000": 10000 };
const WHEN: Record<string, string> = { asap: "asap", week: "this_week", month: "month", flexible: "flexible" };

export function PostProjectForm({ es, services, preset }: { es: boolean; services: Opt[]; preset?: string | null }) {
  const [f, setF] = useState({ service: preset ?? "", details: "", timing: "", budget: "", zip: "", name: "", email: "", phone: "", website: "" });
  const [photos, setPhotos] = useState<string[]>([]);
  const [showPhotos, setShowPhotos] = useState(false);
  const [sms, setSms] = useState(false);
  const [earn, setEarn] = useState(true);
  const [partner, setPartner] = useState<{ code: string; reward: boolean } | null>(null);
  const [est, setEst] = useState<Est | null>(null);
  const [next, setNext] = useState<"pm" | "call" | null>(null);
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");
  const [callMode, setCallMode] = useState<"asap" | "schedule">("asap");
  const [callAt, setCallAt] = useState<string | null>(null);
  const [reloadSlots, setReloadSlots] = useState(0);
  const [booked, setBooked] = useState<string | null>(null);
  const [err, setErr] = useState("");
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
  const L = (en: string, sp: string) => (es ? sp : en);
  const timings = [["asap", L("As soon as possible", "Lo antes posible")], ["week", L("Within a week", "En una semana")], ["month", L("Within a month", "En un mes")], ["flexible", L("I'm flexible", "Tengo flexibilidad")]];
  const budgets = [["u500", L("Under $500", "Menos de $500")], ["500-2000", "$500 – $2,000"], ["2000-10000", "$2,000 – $10,000"], ["10000+", L("Over $10,000", "Más de $10,000")], ["unsure", L("Not sure yet", "Aún no sé")]];
  const label = (list: string[][], v: string) => list.find(([k]) => k === v)?.[1] ?? "";
  const priceText = est?.price ? moneyRange(est.price.low, est.price.high) : null;

  async function getEstimate(service = f.service) {
    if (!service && f.details.trim().length < 10 && !photos.length) { setErr(L("Tell us what you need — pick a service or describe the project.", "Díganos qué necesita: elija un servicio o describa el proyecto.")); return; }
    setState("busy"); setErr("");
    const r = await fetch("/api/post/estimate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ service: service || null, details: f.details || null, zip: f.zip || null, photos, locale: es ? "es" : "en" }) }).catch(() => null);
    const j = r ? await r.json().catch(() => ({})) : {};
    setState("idle");
    if (!r?.ok || !j.ok) { setErr(String(j.error ?? L("Couldn't get an estimate — try again", "No se pudo calcular; intente de nuevo"))); return; }
    setEst(j as Est); setNext(null);
    if (j.service_slug && j.service_slug !== f.service) setF((x) => ({ ...x, service: j.service_slug }));
  }

  function bookHref() {
    if (!est?.service_slug) return "/book";
    const q = new URLSearchParams({ service: est.service_slug, src: "post", utm_source: "post_project" });
    if (f.timing && WHEN[f.timing]) q.set("when", WHEN[f.timing]);
    if (photos.length) q.set("photos", photos.join(","));
    const notes = [f.details.trim(), est.notes ?? ""].filter(Boolean).join("\n");
    if (notes) q.set("notes", notes.slice(0, 1500));
    for (const [k, v] of Object.entries(est.answers)) q.set(k, String(v));
    return `/book?${q}`;
  }

  async function sendLead(e: React.FormEvent) {
    e.preventDefault();
    const at = callMode === "schedule" ? callAt : null;
    if (callMode === "schedule" && !at) { setErr(L("Pick a day and time for your call.", "Elija el día y la hora de su llamada.")); return; }
    if (at && !f.phone.trim()) { setErr(L("Add your phone number so we can call you.", "Agregue su teléfono para poder llamarle.")); return; }
    setState("busy"); setErr("");
    const message = [
      "Posted project",
      f.details.trim() && `Details: ${f.details.trim()}`,
      f.timing && `Timing: ${label(timings, f.timing)}`,
      f.budget && `Budget: ${label(budgets, f.budget)}`,
      est?.service_name && `Matched service: ${est.service_name}`,
      priceText ? `Online estimate shown: ${priceText}${est?.site_visit ? " (firm price after free site visit)" : ""}` : est?.consult_only ? "Online estimate: consultation-only (no price shown)" : null,
      est?.assumptions.length ? `Estimate assumed: ${est.assumptions.map((a) => `${a.label}: ${a.value}`).join("; ")}` : null,
      photos.length ? `Photos: ${photos.length} uploaded` : null,
    ].filter(Boolean).join("\n");
    const r = await fetch("/api/leads/web", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
      name: f.name, email: f.email || null, phone: f.phone || null, zip: f.zip || null, service: est?.service_slug || f.service || null, message,
      campaign: "post-project", sms_consent: sms && Boolean(f.phone), partner_optin: earn && Boolean(f.email), attribution: readAttribution(), website: f.website,
      call_at: at, call_tz: at ? browserTz() : null,
    }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      setState("idle");
      if (j.slot_taken) { setCallAt(null); setReloadSlots((n) => n + 1); setErr(L("Sorry — someone just booked that time. Please pick another.", "Lo sentimos: alguien acaba de reservar esa hora. Elija otra.")); return; }
      setErr(String(j.error ?? L("Couldn't send — try again", "No se pudo enviar; intente de nuevo"))); return;
    }
    setBooked(at);
    trackConversion("Lead", { id: `post-${Date.now()}` });
    if (j.partner) setPartner(j.partner);
    setState("done");
  }

  if (state === "done") {
    return (
      <div className="min-w-0 space-y-4">
        <div className="card text-center">
          <div className="text-2xl"><ThemedIcon icon="✅" size="md" /></div>
          <div className="mt-2 text-lg font-bold">{booked ? L("Your call is booked.", "Su llamada está reservada.") : L("Your project is posted. We're on it.", "Su proyecto está publicado. Nos encargamos.")}</div>
          {booked ? (
            <>
              <div className="mt-2 text-xl font-extrabold text-brand">{new Date(booked).toLocaleString(es ? "es-US" : "en-US", { weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit" })}</div>
              <p className="mt-1 text-sm text-ink-soft">{L("A real Handled person will call you then", "Una persona real de Handled le llamará a esa hora")}{BRAND.supportPhone ? ` ${L("from", "desde el")} ${BRAND.supportPhone}` : ""}{priceText ? L(`, with your ${priceText} estimate in hand.`, `, con su estimado de ${priceText} a mano.`) : "."} {L("We emailed you a confirmation.", "Le enviamos una confirmación por correo.")}</p>
              <div className="mt-3 flex flex-wrap justify-center gap-2 text-sm">
                <a className="btn-ghost" target="_blank" rel="noopener" href={callCalendarLinks({ at: booked, minutes: 30 }).google}>{L("Add to Google Calendar", "Agregar a Google Calendar")}</a>
                <a className="btn-ghost" href={`/api/call-slots/ics?${new URLSearchParams({ at: booked, m: "30" })}`}>{L("Apple / Outlook (.ics)", "Apple / Outlook (.ics)")}</a>
              </div>
            </>
          ) : (
            <p className="mt-1 text-sm text-ink-soft">{L("Check your email for our reply. A real person will call you shortly", "Revise su correo: ya le respondimos. Una persona real le llamará pronto")}{BRAND.supportPhone ? ` ${L("from", "desde el")} ${BRAND.supportPhone}` : ""}{priceText ? L(` — they'll have your ${priceText} estimate in hand.`, `; tendrá a mano su estimado de ${priceText}.`) : "."}</p>
          )}
          {partner && (
            <div className="mt-4 rounded-xl border border-line bg-paper p-3 text-left text-sm">
              <div className="font-semibold"><Ico i="🎉" />{L("You're a Handled partner", "Ya es socio de Handled")} · {L("code", "código")} <span className="font-mono">{partner.code}</span></div>
              <p className="mt-1 text-ink-soft">{partner.reward
                ? L(`When we complete this project, you get ${firstProjectLine()} — paid to you in our weekly payout after the ${BRAND.guaranteeDays}-day make-it-right window. We emailed you a link to your partner page to set up payouts and share your link with friends.`, `Cuando terminemos este proyecto, recibe ${firstProjectLine(true)}, pagado en nuestro pago semanal después de la garantía de ${BRAND.guaranteeDays} días. Le enviamos por correo el enlace a su página de socio para configurar pagos y compartir su enlace.`)
                : L("We emailed you your partner page. Share your link and earn on every job from people you send us.", "Le enviamos su página de socio por correo. Comparta su enlace y gane en cada trabajo de las personas que nos envíe.")}</p>
            </div>
          )}
          {est?.service_slug && !est.consult_only && <a href={bookHref()} className="btn-primary mt-4 inline-block">{L("Skip the wait — book at this price", "No espere: reserve a este precio")} →</a>}
        </div>
        {est && <ProjectManager es={es} f={f} est={est} intro={L("While you wait, I'm your AI project manager. Ask me anything about the project — scope, timing, what's included — and I'll keep the estimate up to date.", "Mientras espera, soy su gerente de proyecto con IA. Pregúnteme lo que quiera sobre el proyecto y mantendré el estimado al día.")} />}
      </div>
    );
  }

  return (
    <div className="min-w-0 space-y-4">
      {/* 1 — describe it */}
      <form className="card space-y-4" onSubmit={(e) => { e.preventDefault(); void getEstimate(); }}>
        <div className="flex items-center justify-between">
          <div className="text-sm font-bold uppercase tracking-wide text-ink-soft">1 · {L("Your project", "Su proyecto")}</div>
          {est && <span className="text-xs text-ink-soft">{L("Change anything and re-price", "Cambie algo y recalcule")}</span>}
        </div>
        <div>
          <label className="text-sm font-semibold">{L("What do you need?", "¿Qué necesita?")}</label>
          <select className="input mt-1" value={f.service} onChange={set("service")}>
            <option value="">{L("Not sure — I'll describe it below", "No estoy seguro: lo describo abajo")}</option>
            {services.map((s) => <option key={s.slug} value={s.slug}>{s.name}</option>)}
          </select>
        </div>
        <div>
          <label className="text-sm font-semibold">{L("Describe the project", "Describa el proyecto")}</label>
          <textarea className="input mt-1 min-h-28" maxLength={2500} placeholder={L("What needs to be done, how big it is (rooms, sq ft, items…), anything we should know. The more detail, the sharper your estimate.", "Qué hay que hacer, de qué tamaño es (cuartos, pies², artículos…), cualquier cosa que debamos saber. Más detalle = estimado más preciso.")} value={f.details} onChange={set("details")} />
        </div>
        {showPhotos || photos.length ? (
          <div>
            <label className="text-sm font-semibold">{L("Photos (optional)", "Fotos (opcional)")}</label>
            <p className="mb-2 text-xs text-ink-soft">{L("Photos let the AI size the job — usually a tighter estimate.", "Las fotos permiten a la IA medir el trabajo: normalmente un estimado más preciso.")}</p>
            <PhotoPicker value={photos} onChange={setPhotos} onError={setErr} locale={es ? "es" : "en"} />
          </div>
        ) : (
          <button type="button" className="text-sm font-semibold text-brand" onClick={() => setShowPhotos(true)}><Ico i="📸" />{L("Add photos for a sharper estimate", "Agregue fotos para un estimado más preciso")}</button>
        )}
        <div className="grid gap-3 sm:grid-cols-3">
          <select className="input" value={f.timing} onChange={set("timing")} aria-label={L("When", "Cuándo")}>
            <option value="">{L("When?", "¿Cuándo?")}</option>
            {timings.map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <select className="input" value={f.budget} onChange={set("budget")} aria-label={L("Budget", "Presupuesto")}>
            <option value="">{L("Budget?", "¿Presupuesto?")}</option>
            {budgets.map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <input className="input" inputMode="numeric" maxLength={5} placeholder={L("ZIP code", "Código postal")} value={f.zip} onChange={set("zip")} aria-label={L("ZIP code", "Código postal")} />
        </div>
        <button className="btn-primary w-full py-3 text-base" disabled={state === "busy"}>{state === "busy" ? L("Pricing your project…", "Calculando su proyecto…") : est ? L("Update my estimate", "Actualizar mi estimado") : L("Get my free estimate", "Obtener mi estimado gratis")}</button>
        <p className="text-center text-xs text-ink-soft">{L("Instant, free, no contact details needed to see your price.", "Al instante, gratis y sin datos de contacto para ver su precio.")}</p>
        {err && !est && <p className="text-sm text-rose-700">{err}</p>}
      </form>

      {/* 2 — the estimate */}
      {est && (
        <div className="card space-y-3" aria-live="polite">
          <div className="text-sm font-bold uppercase tracking-wide text-ink-soft">2 · {L("Your estimate", "Su estimado")}</div>
          {!est.service_slug ? (
            <div className="space-y-2 text-sm">
              <p>{est.summary ?? L("We couldn't match that to a service on our own yet.", "Aún no pudimos asociarlo a un servicio.")} {L("Pick the closest service above and re-price, or have a person call — we take custom projects too.", "Elija el servicio más cercano arriba y recalcule, o pida que le llamemos: también hacemos proyectos a medida.")}</p>
              {est.alternatives.length > 0 && <div className="flex flex-wrap gap-2">{est.alternatives.map((a) => <button key={a.slug} type="button" className="rounded-full border border-line px-3 py-1 text-xs hover:border-brand" onClick={() => { setF({ ...f, service: a.slug }); void getEstimate(a.slug); }}>{a.name}</button>)}</div>}
            </div>
          ) : (
            <>
              <div>
                <div className="text-sm text-ink-soft">{est.service_name}</div>
                {est.consult_only
                  ? <div className="text-xl font-bold">{L("Custom quote after a free video consultation", "Precio a medida tras una consulta gratis por video")}</div>
                  : <div className="text-3xl font-extrabold tracking-tight">{priceText}</div>}
                {est.price && est.site_visit && <p className="mt-1 text-xs text-ink-soft">{L("Ballpark range. Big jobs get a free site visit for a firm, fixed price before you pay anything.", "Rango aproximado. Los trabajos grandes reciben una visita gratis para un precio fijo antes de pagar.")}</p>}
                {est.price && !est.site_visit && <p className="mt-1 text-xs text-ink-soft">{L("You'll see the exact price before you pay — the price shown at checkout is the price charged.", "Verá el precio exacto antes de pagar: el precio al pagar es el precio cobrado.")}</p>}
                {est.price && f.budget && BUDGET_MAX[f.budget] && est.price.low > BUDGET_MAX[f.budget] && <p className="mt-2 rounded-lg bg-gold-light/30 p-2 text-xs">{L("That's above the budget you gave. Your AI project manager can help find a smaller first phase or a flexible date that fits.", "Está por encima de su presupuesto. Su gerente de proyecto con IA puede ayudarle a encontrar una primera fase más pequeña o una fecha flexible.")}</p>}
              </div>
              {est.summary && <p className="text-sm">{est.summary}</p>}
              {(est.assumptions.length > 0 || (est.price?.items.length ?? 0) > 0) && (
                <details className="rounded-xl border border-line bg-paper p-3 text-sm">
                  <summary className="cursor-pointer font-semibold">{est.tailored ? L("What this estimate is based on", "En qué se basa este estimado") : L("Based on a typical job — add details or photos to tailor it", "Basado en un trabajo típico: agregue detalles o fotos para ajustarlo")}</summary>
                  {est.assumptions.length > 0 && <ul className="mt-2 space-y-1">{est.assumptions.map((a) => <li key={a.label} className="flex justify-between gap-3"><span className="text-ink-soft">{a.label}</span><span className="text-right font-medium">{a.value}</span></li>)}</ul>}
                  {est.price && est.price.items.length > 0 && <ul className="mt-3 space-y-1 border-t border-line pt-2">{est.price.items.map((i, n) => <li key={`${i.label}-${n}`} className="flex justify-between gap-3"><span className="text-ink-soft">{i.label}</span><span>${Math.round(i.amount).toLocaleString()}</span></li>)}</ul>}
                  <p className="mt-2 text-xs text-ink-soft">{L("Wrong? Tell your project manager, or fix the description above and re-price.", "¿Algo mal? Dígaselo a su gerente de proyecto o corrija la descripción y recalcule.")}</p>
                </details>
              )}
            </>
          )}
        </div>
      )}

      {/* 3 — what's next */}
      {est && (
        <div className="card space-y-3">
          <div className="text-sm font-bold uppercase tracking-wide text-ink-soft">3 · {L("How do you want to move forward?", "¿Cómo quiere continuar?")}</div>
          <div className="grid gap-2 sm:grid-cols-3">
            {est.service_slug && (
              <a href={bookHref()} className="rounded-xl border border-line p-3 text-left text-sm hover:border-brand">
                <div className="font-semibold"><Ico i="⚡" />{est.consult_only ? L("Book the free consult", "Reservar la consulta gratis") : est.site_visit ? L("Book a free site visit", "Reservar visita gratis") : L("Book at this price", "Reservar a este precio")}</div>
                <div className="text-xs text-ink-soft">{L("Pick a time, see the exact price, done in 2 minutes.", "Elija la hora y vea el precio exacto en 2 minutos.")}</div>
              </a>
            )}
            <button type="button" onClick={() => setNext("pm")} className={`rounded-xl border p-3 text-left text-sm ${next === "pm" ? "border-brand bg-brand-tint" : "border-line hover:border-brand"}`}>
              <div className="font-semibold"><Ico i="🤖" />{L("AI project manager", "Gerente de proyecto IA")}</div>
              <div className="text-xs text-ink-soft">{L("Plan the scope, tune the price and timing — 24/7, right here.", "Planee el alcance, ajuste precio y fechas, 24/7, aquí mismo.")}</div>
            </button>
            <button type="button" onClick={() => setNext("call")} className={`rounded-xl border p-3 text-left text-sm ${next === "call" ? "border-brand bg-brand-tint" : "border-line hover:border-brand"}`}>
              <div className="font-semibold"><Ico i="📱" />{L("Have a person call me", "Que me llame una persona")}</div>
              <div className="text-xs text-ink-soft">{L("A real Handled person calls within minutes with your estimate.", "Una persona de Handled le llama en minutos con su estimado.")}</div>
            </button>
          </div>

          {next === "pm" && <ProjectManager es={es} f={f} est={est} intro={est.service_slug
            ? L(`Hi! I'm your AI project manager. I've got your ${est.service_name} project${priceText ? `, estimated at ${priceText}` : ""}. What would you like to sort out first — the scope, timing, or what's included?`, `¡Hola! Soy su gerente de proyecto con IA. Tengo su proyecto de ${est.service_name}${priceText ? `, estimado en ${priceText}` : ""}. ¿Qué quiere aclarar primero: el alcance, las fechas o qué incluye?`)
            : L("Hi! I'm your AI project manager. Tell me a bit more about the project and I'll find the right service and price it for you.", "¡Hola! Soy su gerente de proyecto con IA. Cuénteme más del proyecto y le encuentro el servicio y el precio.")} />}

          {next === "call" && (
            <form className="space-y-3 border-t border-line pt-3" onSubmit={sendLead}>
              <div>
                <div className="text-sm font-semibold">{L("When should we call?", "¿Cuándo le llamamos?")}</div>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {([["asap", L("As soon as possible", "Lo antes posible"), L("Within minutes during business hours", "En minutos, en horario laboral")], ["schedule", L("Pick a time", "Elegir una hora"), L("Book a call on our calendar", "Reserve una llamada en el calendario")]] as const).map(([k, t, d]) => (
                    <button key={k} type="button" onClick={() => { setCallMode(k); setErr(""); }} className={`rounded-xl border p-3 text-left text-sm ${callMode === k ? "border-brand bg-brand-tint" : "border-line hover:border-brand"}`}>
                      <div className="font-semibold"><Ico i={k === "asap" ? "⚡" : "📅"} />{t}</div><div className="text-xs text-ink-soft">{d}</div>
                    </button>
                  ))}
                </div>
              </div>
              {callMode === "schedule" && <CallScheduler es={es} value={callAt} onChange={setCallAt} reload={reloadSlots} />}
              <div className="grid gap-3 sm:grid-cols-3">
                <input className="input" required placeholder={L("Your name", "Su nombre")} value={f.name} onChange={set("name")} aria-label={L("Your name", "Su nombre")} />
                <input className="input" type="email" placeholder={L("Email", "Correo")} value={f.email} onChange={set("email")} aria-label={L("Email", "Correo")} />
                <input className="input" type="tel" required={callMode === "schedule"} placeholder={L("Phone", "Teléfono")} value={f.phone} onChange={set("phone")} aria-label={L("Phone", "Teléfono")} />
              </div>
              <input className="hidden" tabIndex={-1} autoComplete="off" aria-hidden value={f.website} onChange={set("website")} />
              <label className="flex items-start gap-2 rounded-xl border border-line bg-paper p-3 text-sm">
                <input type="checkbox" className="mt-1" checked={earn} onChange={(e) => setEarn(e.target.checked)} />
                <span><b>{L(`Get ${firstProjectLine()} on this project`, `Reciba ${firstProjectLine(true)} en este proyecto`)}</b> — {L("make me a Handled partner. When we complete your first project, we pay you 10% of the price (up to $250) in cash, and you earn on every job from people you send us. Needs your email.", "hágame socio de Handled. Cuando terminemos su primer proyecto, le pagamos el 10% del precio (hasta $250) en efectivo, y gana en cada trabajo de las personas que nos envíe. Requiere su correo.")}{" "}
                  <span className="text-xs text-ink-soft">{L("By ticking this you agree to the", "Al marcar esto acepta los")} <a href="/partners#join" target="_blank" className="underline">{L("partner terms", "términos de socio")}</a>.</span>
                </span>
              </label>
              <label className="flex items-start gap-2 text-xs text-ink-soft">
                <input type="checkbox" className="mt-0.5" checked={sms} onChange={(e) => setSms(e.target.checked)} />
                <span>{L(`Text me about my project. By checking this, you agree to receive text messages from ${BRAND.name} at the number above about your request. Message and data rates may apply; reply STOP to opt out. Consent isn't required to buy.`, `Envíenme mensajes de texto sobre mi proyecto. Al marcar esto, acepta recibir mensajes de ${BRAND.name} al número indicado sobre su solicitud. Pueden aplicar tarifas de mensajes y datos; responda STOP para cancelar. No es necesario para comprar.`)}</span>
              </label>
              <button className="btn-primary w-full py-3 text-base" disabled={state === "busy"}>{state === "busy" ? L("Posting…", "Publicando…") : callMode === "schedule" ? L("Book my call", "Reservar mi llamada") : L("Post my project & call me", "Publicar y llamarme")}</button>
              <p className="text-center text-xs text-ink-soft">{L("Free, no obligation. Your details go only to Handled — we never sell or share them.", "Gratis y sin compromiso. Sus datos solo los recibe Handled: nunca los vendemos ni compartimos.")}</p>
            </form>
          )}
          {err && <p className="text-sm text-rose-700">{err}</p>}
        </div>
      )}
    </div>
  );
}

/** The AI project manager: the site's AI chat, run with this posted project as context (/api/concierge + project). */
function ProjectManager({ es, f, est, intro }: { es: boolean; f: { service: string; details: string; zip: string; timing: string; budget: string }; est: Est; intro: string }) {
  const [turns, setTurns] = useState<Turn[]>([{ role: "assistant", content: intro }]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const project = { service_slug: est.service_slug, details: f.details || null, zip: f.zip || null, when: f.timing || null, budget: f.budget || null, answers: est.answers };

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim() || busy) return;
    const next = [...turns, { role: "user" as const, content: text.trim() }];
    setTurns(next); setText(""); setBusy(true);
    const res = await fetch("/api/concierge", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages: next.slice(1).slice(-30), project }) }).catch(() => null);
    const json = res ? await res.json().catch(() => ({})) : {};
    setTurns([...next, { role: "assistant", content: json.reply ?? (es ? "No pude conectarme. Intente de nuevo." : "Sorry, I couldn't reach the server. Try again.") }]);
    setBusy(false);
    setTimeout(() => box.current?.scrollTo({ top: box.current.scrollHeight, behavior: "smooth" }), 50);
  }

  return (
    <div className="overflow-hidden rounded-xl border border-line">
      <div className="flex items-center justify-between bg-brand-deep px-4 py-2.5 text-white">
        <div><div className="text-sm font-semibold">{es ? "Su gerente de proyecto" : "Your project manager"}</div><div className="text-xs text-white/60">{es ? "IA · conoce su proyecto · le pasa con una persona cuando quiera" : "AI · knows your project · hands you to a person anytime"}</div></div>
      </div>
      <div ref={box} className="max-h-80 min-h-40 space-y-3 overflow-y-auto p-4 text-sm">
        {turns.map((m, i) => (
          <div key={i} className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2 ${m.role === "user" ? "ml-auto bg-brand text-white" : "bg-paper"}`}>
            {m.content.split(/(\/book\S*)/g).map((part, j) => (part.startsWith("/book") ? <a key={j} href={part} className="font-semibold underline">{part}</a> : part))}
          </div>
        ))}
        {busy && <div className="w-16 rounded-2xl bg-paper px-3.5 py-2 text-ink-soft">…</div>}
      </div>
      <form onSubmit={send} className="flex gap-2 border-t border-line p-3">
        <input className="input" placeholder={es ? "p. ej. ¿Puedo hacerlo en dos fases?" : "e.g. Can we do it in two phases?"} value={text} onChange={(e) => setText(e.target.value)} maxLength={1000} aria-label={es ? "Mensaje" : "Message"} />
        <button className="btn-primary px-4" disabled={busy}>{es ? "Enviar" : "Send"}</button>
      </form>
    </div>
  );
}
