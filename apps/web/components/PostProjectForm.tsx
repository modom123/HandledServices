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
 * UPDATED : 2026-11-12_1700 UTC — checks for an email or a full phone number before sending (the server said no only
 *           after the click), a dropped connection no longer leaves the button stuck on "Posting…", the description
 *           shows how much room is left, and the partner box says when it's skipped for lack of an email.
 * UPDATED : 2026-11-12_1800 UTC — photos (optional, up to 6): taken or chosen on a phone, dragged in on a desktop; saved
 *           with the lead so staff see the job before they call. Posting waits until uploads finish.
 * UPDATED : 2026-11-17_1446 UTC — Estimate first. 1) Describe the project (photos optional) → 2) an instant estimate
 *           right away, no contact details needed (/api/post/estimate: the AI reads the project, the rules engine
 *           prices it) → 3) the customer picks what's next: book now at that price, work it through with their AI
 *           project manager (chat that knows the project, re-prices as the scope changes and hands off to a person),
 *           or have a person call (the Lead inbox, now with the estimate attached for whoever calls).
 * UPDATED : 2026-11-17_1530 UTC — appointment calendar: "Have a person call me" now offers "As soon as possible" or
 *           "Pick a time" (CallScheduler: our open call times, in the visitor's time zone). A booked time needs a phone;
 *           if it was just taken, the calendar reloads. The done screen shows the time with Add-to-calendar links.
 * UPDATED : 2026-11-27_1500 UTC — "Get it Handled" (owner: tighten it up, brand it; categories then click for the specific
 *           service instead of all 105; automate it: 3 photos and 3–4 inputs → estimate). Step 1 is now: pick a category
 *           tile (or search, or skip and let the photos tell us) → the service (Repairs in sub-groups) → 3 photos with the
 *           service's shot list → ZIP, when, an optional note. The price comes automatically once 3 photos and a ZIP are in.
 *           The budget question is gone (the AI project manager handles budget).
 *           It starts with Home or Business, then walks a logical path: Home → category → service; Business → what kind of
 *           business → its usual work (or something else → business categories) → service, and asks how often (price per
 *           visit and about-a-month) and the business name. ?for=business starts on the Business path. Right after Home /
 *           Business: the 5 services most people choose on that path (lib/popular-services, from real bookings).
 * UPDATED : 2026-11-27_1700 UTC — owner's order: Home or Business → popular services → other services → quick description →
 *           3 pictures → the AI quote → send the job at Handled's price, or name your price (job board: /book?offer=,
 *           same rules as the booking page: offerCheck bounds, posting fee, pros decide). Project manager and a call stay
 *           as links under the two buttons.
 * UPDATED : 2026-11-17_1600 UTC — up to $2,500: the estimate is the exact price to book now, no call or site visit needed
 *           (headline price + typical range); over that, or for events / safety cases, the range and why a visit comes first.
 */
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Ico, ThemedIcon } from "@/components/Glyph";
import { BIZ_FREQUENCIES, BOARD_POST_FEE, OFFER_BOUNDS, offerCheck, BRAND, GET_IT_HANDLED, INDUSTRIES, INSTANT_PRICE_UP_TO, callCalendarLinks, categoryText, firstProjectLine, monthlyEstimate, money, moneyRange, photoShots, pickerCategories, pickerGroups, type CategoryId, type Frequency, type PickerAudience } from "@handled/core";
import { readAttribution, trackConversion } from "@/lib/track";
import { PhotoPicker } from "@/components/PhotoPicker";
import { CallScheduler, browserTz } from "./CallScheduler";

type Opt = { slug: string; name: string; category?: string };
type Est = {
  service_slug: string | null; service_name: string | null; alternatives: Opt[]; summary: string | null;
  assumptions: { label: string; value: string }[]; answers: Record<string, string | number | boolean>; notes: string | null;
  price: { point: number; low: number; high: number; items: { label: string; amount: number }[] } | null;
  site_visit: boolean; visit_reason: string | null; consult_only: boolean; ai: boolean; tailored: boolean;
};
type Turn = { role: "user" | "assistant"; content: string };

const WHEN: Record<string, string> = { asap: "asap", week: "this_week", month: "month", flexible: "flexible" };

export function PostProjectForm({ es, services, preset, audience: startAudience = null, popular = { home: [], business: [] } }: { es: boolean; services: Opt[]; preset?: string | null; audience?: PickerAudience | null; popular?: Record<PickerAudience, string[]> }) {
  const [f, setF] = useState({ service: preset ?? "", details: "", timing: "", budget: "", zip: "", name: "", email: "", phone: "", website: "" });
  const [cat, setCat] = useState<CategoryId | null>(null);
  // the path starts with Home or Business, then walks to the right service (business: kind of business → its usual work)
  const [audience, setAudience] = useState<PickerAudience | null>(startAudience ?? (preset ? "home" : null));
  const [industry, setIndustry] = useState<string | null>(null);
  const [allCats, setAllCats] = useState(false);
  const [freq, setFreq] = useState<Frequency>("once");
  const [company, setCompany] = useState("");
  const biz = audience === "business";
  const ind = INDUSTRIES.find((x) => x.id === industry) ?? null;
  const [q, setQ] = useState("");
  const [skip, setSkip] = useState(false);
  const byslug = useMemo(() => new Map(services.map((x) => [x.slug, x])), [services]);
  const picked = f.service ? byslug.get(f.service) ?? null : null;
  const cats = useMemo(() => pickerCategories(audience ?? undefined).map((c) => ({ id: c.id, icon: c.icon, label: categoryText(es ? "es" : "en", c.id, c).short })), [es, audience]);
  const allCatInfo = useMemo(() => pickerCategories().map((c) => ({ id: c.id, icon: c.icon })), []);
  const catOf = (slug: string) => allCatInfo.find((c) => c.id === services.find((x) => x.slug === slug)?.category);
  const matches = useMemo(() => { const t = q.trim().toLowerCase(); const ok = new Set(cats.flatMap((c) => pickerGroups(c.id, audience ?? undefined).flatMap((g) => g.slugs))); return t ? services.filter((x) => ok.has(x.slug) && `${x.name} ${x.slug.replace(/-/g, " ")}`.toLowerCase().includes(t)).slice(0, 12) : []; }, [q, services, cats, audience]);
  const pick = (slug: string) => { setF((x) => ({ ...x, service: slug })); setQ(""); setEst(null); };
  const [photos, setPhotos] = useState<string[]>([]);
  const [showPhotos, setShowPhotos] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [sms, setSms] = useState(false);
  const [earn, setEarn] = useState(true);
  const [partner, setPartner] = useState<{ code: string; reward: boolean } | null>(null);
  const [est, setEst] = useState<Est | null>(null);
  const [next, setNext] = useState<"pm" | "call" | "offer" | null>(null);
  const [offer, setOffer] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");
  const [callMode, setCallMode] = useState<"asap" | "schedule">("asap");
  const [callAt, setCallAt] = useState<string | null>(null);
  const [reloadSlots, setReloadSlots] = useState(0);
  const [booked, setBooked] = useState<string | null>(null);
  const [err, setErr] = useState("");
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
  const L = (en: string, sp: string) => (es ? sp : en);
  const timings = [["asap", L("As soon as possible", "Lo antes posible")], ["week", L("Within a week", "En una semana")], ["month", L("Within a month", "En un mes")], ["flexible", L("I'm flexible", "Tengo flexibilidad")]];
  const label = (list: string[][], v: string) => list.find(([k]) => k === v)?.[1] ?? "";
  // up to $2,500 the estimate is the price to book now (no call); bigger jobs show a range until the free site visit
  const instant = Boolean(est?.price && !est.site_visit);
  const recurring = biz && freq !== "once";
  const priceText = est?.price ? `${instant ? money(est.price.point) : moneyRange(est.price.low, est.price.high)}${recurring ? L(" per visit", " por visita") : ""}` : null;
  const monthly = est?.price && recurring && instant ? monthlyEstimate(est.price.point, freq) : null;
  // name your price: one-time jobs with an instant price (the job board); pros decide
  const canName = Boolean(est?.service_slug && est.price && instant && !est.consult_only && !recurring);
  const offerNum = Number(offer) || 0;
  const offerChk = canName && offerNum && est?.price ? offerCheck(offerNum, est.price.point) : null;
  const limit = `$${INSTANT_PRICE_UP_TO.toLocaleString("en-US")}`;

  async function getEstimate(service = f.service) {
    if (!service && f.details.trim().length < 10 && !photos.length) { setErr(L("Tell us what you need — pick a service or describe the project.", "Díganos qué necesita: elija un servicio o describa el proyecto.")); return; }
    if (uploading) { setErr(L("Wait for your photos to finish uploading.", "Espere a que terminen de subir sus fotos.")); return; }
    if (f.zip && !/^\d{5}$/.test(f.zip.trim())) { setErr(L("ZIP code should be 5 digits.", "El código postal debe tener 5 dígitos.")); return; }
    setState("busy"); setErr("");
    const r = await fetch("/api/post/estimate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ service: service || null, details: f.details || null, zip: f.zip || null, photos, locale: es ? "es" : "en", frequency: biz ? freq : "once" }) }).catch(() => null);
    const j = r ? await r.json().catch(() => ({})) : {};
    setState("idle");
    if (!r?.ok || !j.ok) { setErr(String(j.error ?? L("Couldn't get an estimate — try again", "No se pudo calcular; intente de nuevo"))); return; }
    setEst(j as Est); setNext(null);
    if (j.service_slug && j.service_slug !== f.service) setF((x) => ({ ...x, service: j.service_slug }));
  }

  // automatic: once the 3 photos and a ZIP are in, price it without waiting for the button (once; the button re-prices)
  const auto = useRef(false);
  useEffect(() => {
    if (auto.current || est || uploading || state !== "idle" || !(picked || skip) || photos.length < GET_IT_HANDLED.photos || !/^\d{5}$/.test(f.zip.trim())) return;
    auto.current = true;
    void getEstimate();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photos.length, f.zip, uploading, picked, skip, est, state, freq]);

  function bookHref(named?: number) {
    if (!est?.service_slug) return "/book";
    const q = new URLSearchParams({ service: est.service_slug, src: "post", utm_source: "post_project" });
    if (f.timing && WHEN[f.timing]) q.set("when", WHEN[f.timing]);
    if (photos.length) q.set("photos", photos.join(","));
    const notes = [f.details.trim(), est.notes ?? ""].filter(Boolean).join("\n");
    if (notes) q.set("notes", notes.slice(0, 1500));
    for (const [k, v] of Object.entries(est.answers)) q.set(k, String(v));
    if (named) q.set("offer", String(Math.round(named)));
    if (biz) { q.set("for", "business"); if (freq !== "once") q.set("frequency", freq); }
    return `/book?${q}`;
  }

  async function sendLead(e: React.FormEvent) {
    e.preventDefault();
    const at = callMode === "schedule" ? callAt : null;
    if (callMode === "schedule" && !at) { setErr(L("Pick a day and time for your call.", "Elija el día y la hora de su llamada.")); return; }
    if (!f.name.trim()) { setErr(L("Add your name.", "Agregue su nombre.")); return; }
    const phoneOk = f.phone.replace(/\D/g, "").length >= 10;
    if (at && !phoneOk) { setErr(L("Add your full phone number with area code so we can call you.", "Agregue su teléfono completo con código de área para poder llamarle.")); return; }
    if (!f.email.trim() && !phoneOk) { setErr(f.phone.trim() ? L("Enter your full phone number with area code, or add an email.", "Escriba su teléfono completo con código de área, o agregue un correo.") : L("Add an email or phone number so we can reach you.", "Agregue un correo o teléfono para poder contactarle.")); return; }
    if (uploading) { setErr(L("Wait for your photos to finish uploading.", "Espere a que terminen de subir sus fotos.")); return; }
    if (f.zip && !/^\d{5}$/.test(f.zip.trim())) { setErr(L("ZIP code should be 5 digits.", "El código postal debe tener 5 dígitos.")); return; }
    setState("busy"); setErr("");
    const message = [
      "Posted project (Get it Handled)",
      biz ? `For: business${ind ? ` (${ind.name})` : ""}${company.trim() ? ` · ${company.trim()}` : ""}${freq !== "once" ? ` · ${BIZ_FREQUENCIES.find((x) => x.value === freq)?.label.toLowerCase()}` : " · one time"}` : "For: home",
      f.details.trim() && `Details: ${f.details.trim()}`,
      f.timing && `Timing: ${label(timings, f.timing)}`,
      est?.service_name && `Matched service: ${est.service_name}`,
      priceText ? `Online estimate shown: ${priceText}${est?.site_visit ? ` (firm price after free site visit${est.visit_reason ? `: ${est.visit_reason}` : ""})` : " (instant price, bookable now)"}` : est?.consult_only ? "Online estimate: consultation-only (no price shown)" : null,
      est?.assumptions.length ? `Estimate assumed: ${est.assumptions.map((a) => `${a.label}: ${a.value}`).join("; ")}` : null,
      photos.length ? `Photos: ${photos.length} (see below)` : null,
    ].filter(Boolean).join("\n");
    let r: Response;
    try {
      r = await fetch("/api/leads/web", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
        name: f.name.trim(), email: f.email.trim() || null, phone: phoneOk ? f.phone.trim() : null, zip: f.zip.trim() || null, service: est?.service_slug || f.service || null, message, photos,
        campaign: "post-project", sms_consent: sms && phoneOk, partner_optin: earn && Boolean(f.email.trim()), attribution: readAttribution(), website: f.website,
        call_at: at, call_tz: at ? browserTz() : null,
      }) });
    } catch {
      setState("idle"); setErr(L("Couldn't reach us — check your connection and try again.", "No pudimos conectar: revise su conexión e intente de nuevo.")); return;
    }
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
          <div className="mt-2 text-lg font-bold">{booked ? L("Your call is booked.", "Su llamada está reservada.") : L("Got it. We'll get it Handled.", "Listo. Nosotros nos encargamos.")}</div>
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
      {/* 1 — what needs Handled: category → service, then 3 photos and 3 quick questions */}
      <form className="card space-y-4" onSubmit={(e) => { e.preventDefault(); void getEstimate(); }}>
        <div className="flex items-center justify-between">
          <div className="text-sm font-bold uppercase tracking-wide text-ink-soft">1 · {L("What needs Handled?", "¿Qué necesita que resolvamos?")}</div>
          {est && <span className="text-xs text-ink-soft">{L("Change anything and re-price", "Cambie algo y recalcule")}</span>}
        </div>
        {!audience ? (
          <div className="grid grid-cols-2 gap-3">
            {([["home", "🏠", L("My home", "Mi hogar"), L("House, apartment, yard, family", "Casa, apartamento, jardín, familia")], ["business", "🏢", L("My business", "Mi negocio"), L("Office, store, property, building", "Oficina, tienda, propiedad, edificio")]] as const).map(([k, icon, t, d]) => (
              <button key={k} type="button" onClick={() => { setAudience(k); setCat(null); setIndustry(null); setAllCats(false); }} className="rounded-xl border border-line p-4 text-left hover:border-brand hover:bg-brand-tint">
                <div className="text-3xl" aria-hidden>{icon}</div><div className="mt-1 font-bold">{t}</div><div className="text-xs text-ink-soft">{d}</div>
              </button>
            ))}
          </div>
        ) : picked || skip ? (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-brand bg-brand-tint px-3 py-2 text-sm">
            <span className="font-semibold">{biz ? "🏢 " : "🏠 "}{picked ? `${catOf(picked.slug)?.icon ?? ""} ${picked.name}` : L("Not sure: our AI will read your photos", "No estoy seguro: la IA leerá sus fotos")}{ind ? <span className="font-normal text-ink-soft"> · {ind.name}</span> : null}</span>
            <button type="button" className="text-xs text-brand underline" onClick={() => { setF({ ...f, service: "" }); setSkip(false); setEst(null); auto.current = false; }}>{L("Change", "Cambiar")}</button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="rounded-full bg-paper px-3 py-1 font-semibold">{biz ? `🏢 ${L("Business", "Negocio")}` : `🏠 ${L("Home", "Hogar")}`}{ind ? ` · ${ind.icon} ${ind.name}` : ""}</span>
              <button type="button" className="text-xs text-brand underline" onClick={() => { setAudience(null); setIndustry(null); setCat(null); setAllCats(false); setQ(""); }}>{L("Change", "Cambiar")}</button>
            </div>
            {!q.trim() && !cat && !(biz && ind) && (popular[audience] ?? []).length > 0 && (
              <div>
                <div className="mb-1 text-sm font-semibold">⭐ {L("Most popular", "Lo más pedido")}</div>
                <div className="flex flex-wrap gap-2">{popular[audience].map((slug) => byslug.get(slug)).filter(Boolean).map((x) => (
                  <button key={x!.slug} type="button" onClick={() => pick(x!.slug)} className="rounded-full border border-brand/40 bg-brand-tint px-3 py-1.5 text-sm font-semibold hover:border-brand">{catOf(x!.slug)?.icon} {x!.name}</button>
                ))}</div>
                <div className="mt-3 text-xs text-ink-soft">{biz ? L("Or tell us your kind of business:", "O díganos su tipo de negocio:") : L("Other services:", "Otros servicios:")}</div>
              </div>
            )}
            {biz && !industry ? (
              <>
                <div className="text-sm font-semibold">{L("What kind of business?", "¿Qué tipo de negocio?")}</div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {INDUSTRIES.map((x) => (
                    <button key={x.id} type="button" onClick={() => setIndustry(x.id)} className="rounded-xl border border-line p-2.5 text-left text-sm hover:border-brand hover:bg-brand-tint"><span aria-hidden>{x.icon}</span> {x.name}</button>
                  ))}
                  <button type="button" onClick={() => { setIndustry("other"); setAllCats(true); }} className="rounded-xl border border-dashed border-line p-2.5 text-left text-sm hover:border-brand">➕ {L("Another kind", "Otro tipo")}</button>
                </div>
              </>
            ) : biz && ind && !allCats ? (
              <>
                <div className="text-sm font-semibold">{L(`What ${ind.name.toLowerCase()} usually need`, `Lo que suelen necesitar: ${ind.name}`)}</div>
                <div className="flex flex-wrap gap-2">
                  {ind.slugs.map((slug) => byslug.get(slug)).filter(Boolean).map((x) => (
                    <button key={x!.slug} type="button" onClick={() => pick(x!.slug)} className="rounded-full border border-line px-3 py-1.5 text-sm hover:border-brand hover:bg-brand-tint">{x!.name}</button>
                  ))}
                  <button type="button" onClick={() => setAllCats(true)} className="rounded-full border border-dashed border-line px-3 py-1.5 text-sm hover:border-brand">{L("Something else →", "Otra cosa →")}</button>
                </div>
              </>
            ) : (
              <>
                <input className="input" placeholder={L("Search, e.g. gutters, move, deep clean", "Buscar, p. ej. canaletas, mudanza, limpieza")} value={q} onChange={(e) => setQ(e.target.value)} aria-label={L("Search services", "Buscar servicios")} />
                {q.trim() ? (
                  <div className="flex flex-wrap gap-2">
                    {matches.map((x) => <button key={x.slug} type="button" onClick={() => pick(x.slug)} className="rounded-full border border-line px-3 py-1.5 text-sm hover:border-brand">{x.name}</button>)}
                    {!matches.length && <p className="text-sm text-ink-soft">{L("No match. Pick a category, or skip and let your photos tell us.", "Sin resultados. Elija una categoría, u omita y deje que sus fotos nos digan.")}</p>}
                  </div>
                ) : cat ? (
                  <div className="space-y-3">
                    <button type="button" className="text-sm text-brand" onClick={() => setCat(null)}>← {L("All categories", "Todas las categorías")}</button>
                    {pickerGroups(cat, audience).map((g) => (
                      <div key={g.label ?? "all"}>
                        {g.label && <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-soft">{es ? g.labelEs : g.label}</div>}
                        <div className="flex flex-wrap gap-2">{g.slugs.map((slug) => byslug.get(slug)).filter(Boolean).map((x) => (
                          <button key={x!.slug} type="button" onClick={() => pick(x!.slug)} className="rounded-full border border-line px-3 py-1.5 text-sm hover:border-brand hover:bg-brand-tint">{x!.name}</button>
                        ))}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {cats.map((c) => (
                      <button key={c.id} type="button" onClick={() => setCat(c.id)} className="rounded-xl border border-line p-3 text-left hover:border-brand hover:bg-brand-tint">
                        <div className="text-2xl" aria-hidden>{c.icon}</div>
                        <div className="mt-1 text-sm font-semibold">{c.label}</div>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
            <button type="button" className="text-sm text-ink-soft underline" onClick={() => setSkip(true)}>{L("Not sure what it's called? Skip, your photos will tell us", "¿No sabe cómo se llama? Omita: sus fotos nos lo dirán")}</button>
          </div>
        )}

        {(picked || skip) && (
          <>
            <div>
              <div className="text-sm font-bold uppercase tracking-wide text-ink-soft">2 · {L("Quick description", "Descripción rápida")}</div>
              <textarea className="input mt-1 min-h-16" maxLength={2500} placeholder={skip ? L("What needs doing? A sentence is plenty.", "¿Qué hay que hacer? Una frase basta.") : L("e.g. 3 bedrooms and 2 baths, or a leaking kitchen faucet, or 2 couches and a fridge", "p. ej. 3 cuartos y 2 baños, o una llave de cocina que gotea, o 2 sofás y un refrigerador")} value={f.details} onChange={set("details")} aria-label={L("Quick description", "Descripción rápida")} />
            </div>
            <div>
              <div className="text-sm font-bold uppercase tracking-wide text-ink-soft">3 · {L(`${GET_IT_HANDLED.photos} pictures`, `${GET_IT_HANDLED.photos} fotos`)}</div>
              <ol className="mb-2 mt-1 list-decimal space-y-0.5 pl-5 text-sm text-ink-soft">{photoShots(picked?.slug).slice(0, GET_IT_HANDLED.photos).map((t) => <li key={t}>{t}</li>)}</ol>
              <PhotoPicker value={photos} onChange={setPhotos} max={GET_IT_HANDLED.maxPhotos} onError={setErr} onBusy={setUploading} locale={es ? "es" : "en"} />
              <p className="mt-1 text-xs text-ink-soft">{photos.length >= GET_IT_HANDLED.photos ? L("Great, that's enough for an exact price.", "Perfecto, con eso basta para un precio exacto.") : L(`${GET_IT_HANDLED.photos - photos.length} more for the most accurate price (you can skip photos, but the price is a typical one).`, `${GET_IT_HANDLED.photos - photos.length} más para el precio más preciso (puede omitirlas, pero el precio será el típico).`)}</p>
            </div>
            <div className={`grid gap-3 ${biz ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
              <input className="input" inputMode="numeric" maxLength={5} placeholder={L("ZIP code", "Código postal")} value={f.zip} onChange={set("zip")} aria-label={L("ZIP code", "Código postal")} />
              {biz ? (
                <>
                  <select className="input" value={freq} onChange={(e) => { setFreq(e.target.value as Frequency); setEst(null); auto.current = false; }} aria-label={L("How often", "Con qué frecuencia")}>
                    {BIZ_FREQUENCIES.map((x) => <option key={x.value} value={x.value}>{x.label}</option>)}
                  </select>
                  <input className="input" placeholder={L("Business name", "Nombre del negocio")} value={company} onChange={(e) => setCompany(e.target.value)} maxLength={120} aria-label={L("Business name", "Nombre del negocio")} />
                </>
              ) : (
                <select className="input" value={f.timing} onChange={set("timing")} aria-label={L("When", "Cuándo")}>
                  <option value="">{L("When do you need it?", "¿Para cuándo?")}</option>
                  {timings.map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              )}
            </div>
            <button className="btn-primary w-full py-3 text-base" disabled={state === "busy" || uploading}>{uploading ? L("Uploading photos…", "Subiendo fotos…") : state === "busy" ? L("AI is pricing your job…", "La IA calcula su trabajo…") : est ? L("Update my quote", "Actualizar mi cotización") : L("Get my AI quote", "Obtener mi cotización con IA")}</button>
            <p className="text-center text-xs text-ink-soft">{L("Free and instant. No contact details needed to see your quote.", "Gratis y al instante. Sin datos de contacto para ver su cotización.")}</p>
          </>
        )}
        {err && !est && <p className="text-sm text-rose-700">{err}</p>}
      </form>

      {/* 2 — the estimate */}
      {est && (
        <div className="card space-y-3" aria-live="polite">
          <div className="text-sm font-bold uppercase tracking-wide text-ink-soft">4 · {L("Your AI quote", "Su cotización con IA")}</div>
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
                {monthly && <div className="font-semibold">{L(`About ${money(monthly)} a month`, `Unos ${money(monthly)} al mes`)} ({BIZ_FREQUENCIES.find((x) => x.value === freq)?.label.toLowerCase()})</div>}
                {est.price && est.site_visit && <p className="mt-1 text-xs text-ink-soft">{L(`Ballpark range${est.visit_reason ? ` (${est.visit_reason})` : ""}. A free site visit sets the firm, fixed price before you pay anything.`, `Rango aproximado${est.visit_reason ? ` (${est.visit_reason})` : ""}. Una visita gratis fija el precio antes de pagar.`)}</p>}
                {est.price && instant && <p className="mt-1 text-sm"><span className="rounded-full bg-brand-tint px-2 py-0.5 text-xs font-semibold text-brand-dark">{L("Book now — no call or site visit needed", "Reserve ya: sin llamada ni visita")}</span> <span className="text-xs text-ink-soft">{L(`Typical range ${moneyRange(est.price.low, est.price.high)}. Projects up to ${limit} are priced instantly; photos at checkout let us confirm it, and the price you approve is the price charged.`, `Rango típico ${moneyRange(est.price.low, est.price.high)}. Los proyectos hasta ${limit} tienen precio al instante; con fotos lo confirmamos, y el precio que aprueba es el que se cobra.`)}</span></p>}
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

      {/* 5 — send the job: at Handled's price, or name your price (pros on the job board decide) */}
      {est && (
        <div className="card space-y-3">
          <div className="text-sm font-bold uppercase tracking-wide text-ink-soft">5 · {L("Send your job", "Envíe su trabajo")}</div>
          {est.service_slug && (
            <div className="grid gap-2 sm:grid-cols-2">
              <a href={bookHref()} className="rounded-xl border-2 border-brand bg-brand p-4 text-left text-white hover:bg-brand-dark">
                <div className="text-base font-bold">{est.consult_only ? L("Book the free consult", "Reservar la consulta gratis") : est.site_visit ? L("Book a free site visit", "Reservar visita gratis") : L(`Send it at Handled's price${est.price ? `: ${money(est.price.point)}` : ""}`, `Enviar al precio de Handled${est.price ? `: ${money(est.price.point)}` : ""}`)}</div>
                <div className="text-xs text-white/80">{L("A vetted pro, guaranteed. Pick the day, done in 2 minutes.", "Un profesional verificado, garantizado. Elija el día en 2 minutos.")}</div>
              </a>
              {canName ? (
                <button type="button" onClick={() => { setNext(next === "offer" ? null : "offer"); if (!offer && est.price) setOffer(String(est.price.point)); }} className={`rounded-xl border-2 p-4 text-left ${next === "offer" ? "border-brand bg-brand-tint" : "border-line hover:border-brand"}`}>
                  <div className="text-base font-bold">💬 {L("Name your price", "Ponga su precio")}</div>
                  <div className="text-xs text-ink-soft">{L("Offer what you want to pay. Pros on our job board decide.", "Ofrezca lo que quiere pagar. Los profesionales deciden.")}</div>
                </button>
              ) : (
                <button type="button" onClick={() => setNext("call")} className={`rounded-xl border-2 p-4 text-left ${next === "call" ? "border-brand bg-brand-tint" : "border-line hover:border-brand"}`}>
                  <div className="text-base font-bold">📱 {L("Have a person call me", "Que me llame una persona")}</div>
                  <div className="text-xs text-ink-soft">{L("A real Handled person calls with your quote.", "Una persona de Handled le llama con su cotización.")}</div>
                </button>
              )}
            </div>
          )}
          {next === "offer" && canName && est.price && (
            <div className="space-y-2 rounded-xl border border-line p-3 text-sm">
              <div className="flex items-center gap-2">
                <button type="button" className="btn-ghost px-3 py-1" onClick={() => setOffer(String(Math.max(offerChk?.floor ?? 1, Math.round((offerNum || est.price!.point) * 0.95))))}>−5%</button>
                <div className="flex flex-1 items-center gap-1"><span className="text-ink-soft">$</span><input className="input text-right text-lg font-bold" inputMode="decimal" value={offer} onChange={(e) => setOffer(e.target.value.replace(/[^\d.]/g, "").slice(0, 9))} aria-label={L("Your price", "Su precio")} /></div>
                <button type="button" className="btn-ghost px-3 py-1" onClick={() => setOffer(String(Math.round((offerNum || est.price!.point) * 1.05)))}>+5%</button>
              </div>
              <p className="text-xs text-ink-soft">{L(`Handled's price is ${money(est.price.point)}. Offer less or more: pros on our job board decide. You pay ${money(BOARD_POST_FEE)} to post it; your price is charged only when a pro takes it. If no one takes it in ${OFFER_BOUNDS.boardDays} days, you pay nothing more.`, `El precio de Handled es ${money(est.price.point)}. Ofrezca menos o más: los profesionales deciden. Paga ${money(BOARD_POST_FEE)} para publicarlo; su precio se cobra solo cuando un profesional lo toma. Si nadie lo toma en ${OFFER_BOUNDS.boardDays} días, no paga nada más.`)}</p>
              {offerChk && !offerChk.ok && <p className="text-xs text-rose-700">{offerChk.level === "too_low" ? L(`Offers start at ${money(offerChk.floor)} for this job.`, `Las ofertas empiezan en ${money(offerChk.floor)} para este trabajo.`) : L(`Up to ${money(offerChk.max)}. Call us for bigger jobs.`, `Hasta ${money(offerChk.max)}. Llámenos para trabajos más grandes.`)}</p>}
              {offerChk?.ok && offerNum < est.price.point && <p className="text-xs text-amber-800">{L("Lower offers can take longer to get a pro.", "Las ofertas más bajas pueden tardar más.")}</p>}
              {offerChk?.ok && offerNum > est.price.point && <p className="text-xs text-brand-dark">✓ {L("A higher offer usually gets a pro faster.", "Una oferta más alta suele conseguir un profesional antes.")}</p>}
              <a href={offerChk?.ok ? bookHref(offerNum) : undefined} aria-disabled={!offerChk?.ok} className={`btn-primary block w-full py-3 text-center text-base ${offerChk?.ok ? "" : "pointer-events-none opacity-50"}`}>{L(`Send my job at ${offerNum ? money(offerNum) : "my price"}`, `Enviar mi trabajo a ${offerNum ? money(offerNum) : "mi precio"}`)}</a>
            </div>
          )}
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
            <button type="button" onClick={() => setNext(next === "pm" ? null : "pm")} className="text-brand underline">🤖 {L("Questions? Ask your AI project manager", "¿Preguntas? Su gerente de proyecto con IA")}</button>
            {canName && <button type="button" onClick={() => setNext(next === "call" ? null : "call")} className="text-brand underline">📱 {L("Have a person call me", "Que me llame una persona")}</button>}
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
                  {earn && !f.email.trim() && <span className="mt-1 block text-xs font-semibold text-amber-700">{L("Add your email above to get this.", "Agregue su correo arriba para recibir esto.")}</span>}
                </span>
              </label>
              <label className="flex items-start gap-2 text-xs text-ink-soft">
                <input type="checkbox" className="mt-0.5" checked={sms} onChange={(e) => setSms(e.target.checked)} />
                <span>{L(`Text me about my project. By checking this, you agree to receive text messages from ${BRAND.name} at the number above about your request. Message and data rates may apply; reply STOP to opt out. Consent isn't required to buy.`, `Envíenme mensajes de texto sobre mi proyecto. Al marcar esto, acepta recibir mensajes de ${BRAND.name} al número indicado sobre su solicitud. Pueden aplicar tarifas de mensajes y datos; responda STOP para cancelar. No es necesario para comprar.`)}</span>
              </label>
              <button className="btn-primary w-full py-3 text-base" disabled={state === "busy" || uploading}>{state === "busy" ? L("Posting…", "Publicando…") : callMode === "schedule" ? L("Book my call", "Reservar mi llamada") : L("Get it Handled: call me", "Resuélvalo: llámeme")}</button>
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
