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
 */
"use client";

import { useState } from "react";
import { Ico, ThemedIcon } from "@/components/Glyph";
import { BRAND, firstProjectLine } from "@handled/core";
import { readAttribution, trackConversion } from "@/lib/track";
import { PhotoPicker } from "@/components/PhotoPicker";

type Opt = { slug: string; name: string };

export function PostProjectForm({ es, services, preset }: { es: boolean; services: Opt[]; preset?: string | null }) {
  const [f, setF] = useState({ service: preset ?? "", details: "", timing: "", budget: "", zip: "", name: "", email: "", phone: "", website: "" });
  const [photos, setPhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [sms, setSms] = useState(false);
  const [earn, setEarn] = useState(true);
  const [partner, setPartner] = useState<{ code: string; reward: boolean } | null>(null);
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
        <div className="text-2xl"><ThemedIcon icon="✅" size="md" /></div>
        <div className="mt-2 text-lg font-bold">{L("Your project is posted. We're on it.", "Su proyecto está publicado. Nos encargamos.")}</div>
        <p className="mt-1 text-sm text-ink-soft">{L("Check your email for our reply. A real person will call you shortly", "Revise su correo: ya le respondimos. Una persona real le llamará pronto")}{BRAND.supportPhone ? ` ${L("from", "desde el")} ${BRAND.supportPhone}` : ""}.</p>
        {partner && (
          <div className="mt-4 rounded-xl border border-line bg-paper p-3 text-left text-sm">
            <div className="font-semibold"><Ico i="🎉" />{L("You're a Handled partner", "Ya es socio de Handled")} · {L("code", "código")} <span className="font-mono">{partner.code}</span></div>
            <p className="mt-1 text-ink-soft">{partner.reward
              ? L(`When we complete this project, you get ${firstProjectLine()} — paid to you in our weekly payout after the ${BRAND.guaranteeDays}-day make-it-right window. We emailed you a link to your partner page to set up payouts and share your link with friends.`, `Cuando terminemos este proyecto, recibe ${firstProjectLine(true)}, pagado en nuestro pago semanal después de la garantía de ${BRAND.guaranteeDays} días. Le enviamos por correo el enlace a su página de socio para configurar pagos y compartir su enlace.`)
              : L("We emailed you your partner page. Share your link and earn on every job from people you send us.", "Le enviamos su página de socio por correo. Comparta su enlace y gane en cada trabajo de las personas que nos envíe.")}</p>
          </div>
        )}
        {svc && <a href={`/book?service=${svc.slug}&utm_source=post_project`} className="btn-primary mt-4 inline-block">{L(`See your instant price for ${svc.name}`, `Vea su precio al instante: ${svc.name}`)} →</a>}
      </div>
    );
  }

  return (
    <form className="card space-y-4" onSubmit={async (e) => {
      e.preventDefault();
      if (!f.service && f.details.trim().length < 10) { setErr(L("Tell us what you need — pick a service or describe the project.", "Díganos qué necesita: elija un servicio o describa el proyecto.")); return; }
      if (!f.name.trim()) { setErr(L("Add your name.", "Agregue su nombre.")); return; }
      const phoneOk = f.phone.replace(/\D/g, "").length >= 10;
      if (!f.email.trim() && !phoneOk) { setErr(f.phone.trim() ? L("Enter your full phone number with area code, or add an email.", "Escriba su teléfono completo con código de área, o agregue un correo.") : L("Add an email or phone number so we can reach you.", "Agregue un correo o teléfono para poder contactarle.")); return; }
      if (uploading) { setErr(L("Wait for your photos to finish uploading.", "Espere a que terminen de subir sus fotos.")); return; }
      if (f.zip && !/^\d{5}$/.test(f.zip.trim())) { setErr(L("ZIP code should be 5 digits.", "El código postal debe tener 5 dígitos.")); return; }
      setState("busy"); setErr("");
      const message = [
        "Posted project",
        f.details.trim() && `Details: ${f.details.trim()}`,
        f.timing && `Timing: ${label(timings, f.timing)}`,
        f.budget && `Budget: ${label(budgets, f.budget)}`,
      ].filter(Boolean).join("\n");
      let r: Response;
      try {
        r = await fetch("/api/leads/web", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
          name: f.name.trim(), email: f.email.trim() || null, phone: phoneOk ? f.phone.trim() : null, zip: f.zip.trim() || null, service: f.service || null, message, photos,
          campaign: "post-project", sms_consent: sms && phoneOk, partner_optin: earn && Boolean(f.email.trim()), attribution: readAttribution(), website: f.website,
        }) });
      } catch {
        setState("idle"); setErr(L("Couldn't reach us — check your connection and try again.", "No pudimos conectar: revise su conexión e intente de nuevo.")); return;
      }
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { setState("idle"); setErr(String(j.error ?? L("Couldn't send — try again", "No se pudo enviar; intente de nuevo"))); return; }
      trackConversion("Lead", { id: `post-${Date.now()}` });
      if (j.partner) setPartner(j.partner);
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
        {f.details.length > 2000 && <p className="mt-1 text-right text-xs text-ink-soft">{2500 - f.details.length} {L("characters left", "caracteres restantes")}</p>}
      </div>
      <div>
        <label className="text-sm font-semibold">{L("Photos", "Fotos")} <span className="font-normal text-ink-soft">({L("optional — helps us price it on the first call", "opcional: nos ayuda a darle precio en la primera llamada")})</span></label>
        <div className="mt-1"><PhotoPicker value={photos} onChange={setPhotos} max={6} onError={setErr} onBusy={setUploading} locale={es ? "es" : "en"} /></div>
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
      <button className="btn-primary w-full py-3 text-base" disabled={state === "busy" || uploading}>{uploading ? L("Uploading photos…", "Subiendo fotos…") : state === "busy" ? L("Posting…", "Publicando…") : L("Post my project", "Publicar mi proyecto")}</button>
      <p className="text-center text-xs text-ink-soft">{L("Free, no obligation. Your details go only to Handled — we never sell or share them.", "Gratis y sin compromiso. Sus datos solo los recibe Handled: nunca los vendemos ni compartimos.")}</p>
      {err && <p className="text-sm text-rose-700">{err}</p>}
    </form>
  );
}
