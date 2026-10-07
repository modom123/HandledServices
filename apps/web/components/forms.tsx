/*
 * FILE    : apps/web/components/forms.tsx
 * PROJECT : Handled — AI-run home & business services
 * CREATED : 2026-10-01_1723 UTC
 * UPDATED : 2026-10-02_0244 UTC — business form: services grouped by facility need, an
 *           industry picker that pre-selects what that industry usually books, plus city/ZIP
 *           and how often.
 * UPDATED : 2026-10-02_0302 UTC — business form: monthly budget and when to start.
 * UPDATED : 2026-10-02_1440 UTC — Spanish (pro onboarding & recruiting)
 * UPDATED : 2026-10-03_0209 UTC — carries ?lead= from the pro lead invitation.
 * PURPOSE : Pro application form and commercial account form.
 * UPDATED : 2026-10-04_1934 UTC — BusinessForm passes the sales-engine lead token (pilot offer, credit).
 * UPDATED : 2026-10-06_0841 UTC — BusinessForm moved to ProposalForm.tsx (3-step Request for Proposal with scope of work).
 * UPDATED : 2026-10-07_1640 UTC — text-message consent wording under the pro application's mobile number.
 */
"use client";

import { SmsConsent } from "./SmsConsent";
import { useState } from "react";
import { COVERAGES, MAX_TRADES, TRADES, TRADE_PROFILES, specialtiesFor, t as tr, type CoverageKey, type Locale } from "@handled/core";

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

function Chips({ options, value, onChange, max }: { options: { id: string; label: string }[]; value: string[]; onChange: (v: string[]) => void; max?: number }) {
  const full = max != null && value.length >= max;
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const on = value.includes(o.id);
        return (
          <button type="button" key={o.id} disabled={!on && full} onClick={() => onChange(on ? value.filter((v) => v !== o.id) : [...value, o.id])}
            className={`rounded-full border px-3 py-1.5 text-sm ${on ? "border-brand bg-brand-tint font-semibold text-brand-dark" : "border-line bg-white"} ${!on && full ? "cursor-not-allowed opacity-40" : ""}`}>{o.label}</button>
        );
      })}
    </div>
  );
}

/**
 * Pro application. Quick by design: name, contact, trades and ZIP codes are all that's
 * required — everything else is optional ("speeds up approval") and can be added in setup.
 * Where they came from (?ref= referral, ?src=, utm_*) is captured automatically.
 */
export function ApplyForm({ locale = "en" }: { locale?: Locale }) {
  const es = locale === "es";
  const t = (s: string) => tr(locale, s);
  const { state, error, submit } = useSubmit("/api/applications");
  const [trades, setTrades] = useState<string[]>([]);
  const [insured, setInsured] = useState(false);
  const [specialties, setSpecialties] = useState<string[]>([]);
  const [coverages, setCoverages] = useState<string[]>([]);
  const [more, setMore] = useState(false);
  const specialtyOptions = specialtiesFor(trades).map((s) => ({ id: s.id, label: t(s.label) }));
  const tradeOptions = TRADES.map((x) => ({ id: x.id, label: t(x.label) }));
  const needs = [...new Set(trades.flatMap((t) => TRADE_PROFILES[t] ? [...TRADE_PROFILES[t].requires, ...(TRADE_PROFILES[t].license ? ["license"] : [])] : []))];
  if (state === "done") return (
    <div className="card text-center"><div className="text-3xl">🎉</div><h2 className="mt-2 text-xl font-bold">{t("Application received")}</h2>
      <p className="mt-2 text-sm text-ink-soft">{t("Check your email — we just sent what happens next. Most applicants hear back the same day. If you’re invited, one click opens your setup checklist (about 15 minutes on your phone).")}</p></div>
  );
  return (
    <form className="card space-y-4" onSubmit={(e) => {
      e.preventDefault();
      const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
      const q = new URLSearchParams(window.location.search);
      const utm = Object.fromEntries([...q.entries()].filter(([k]) => k.startsWith("utm_")));
      submit({
        ...f, trades, insured, specialties: specialties.filter((s) => specialtyOptions.some((o) => o.id === s)), coverages_held: coverages,
        years_experience: f.years_experience || undefined, crew_size: f.crew_size || undefined,
        source: f.source || q.get("src") || undefined, ref: q.get("ref") || undefined, utm: Object.keys(utm).length ? utm : undefined, lead: q.get("lead") || undefined,
      });
    }}>
      <p className="text-sm text-ink-soft">{t("Takes 2 minutes. Only the first part is required.")}</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <div><label className="label">{t("Business name (or your name)")}</label><input name="business_name" required className="input" autoComplete="organization" /></div>
        <div><label className="label">{t("Your name")}</label><input name="contact_name" required className="input" autoComplete="name" /></div>
        <div><label className="label">{t("Email")}</label><input name="email" type="email" required className="input" autoComplete="email" /></div>
        <div><label className="label">{t("Mobile")}</label><input name="phone" type="tel" required className="input" autoComplete="tel" /></div>
      </div>
      <SmsConsent es={es} purpose="pro" />
      <div><label className="label">{t("What do you do?")} <span className="font-normal normal-case text-ink-soft">({es ? `hasta ${MAX_TRADES}` : `up to ${MAX_TRADES}`} · {trades.length}/{MAX_TRADES})</span></label><Chips options={tradeOptions} value={trades} onChange={setTrades} max={MAX_TRADES} />
        {trades.length >= MAX_TRADES && <p className="mt-1 text-xs text-ink-soft">{es ? `Máximo ${MAX_TRADES} oficios: los profesionales enfocados reciben mejores calificaciones y más trabajos. Quite uno para cambiarlo.` : `Up to ${MAX_TRADES} trades — focused pros get better ratings and more jobs. Tap one to remove it and pick another.`}</p>}</div>
      {specialtyOptions.length > 0 && <div><label className="label">{t("Your specialties (what you do best)")}</label><Chips options={specialtyOptions} value={specialties} onChange={setSpecialties} /></div>}
      {needs.length > 0 && (
        <p className="rounded-xl bg-brand-tint p-3 text-xs text-ink-soft">
          {es
            ? `Para estos oficios también necesitará: ${needs.map((k) => (k === "license" ? "una licencia estatal" : t(COVERAGES[k as CoverageKey].label).toLowerCase())).join(", ")}, además del seguro de responsabilidad civil general. ¿Aún no lo tiene? Postúlese de todos modos; le indicaremos con qué corredores obtenerlo.`
            : `For these trades you’ll also need: ${needs.map((k) => (k === "license" ? "a state license" : COVERAGES[k as CoverageKey].label.toLowerCase())).join(", ")}, on top of general liability. Don’t have it yet? Apply anyway — we’ll point you to brokers.`}
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <div><label className="label">{t("ZIP codes you serve")}</label><input name="zips" className="input" placeholder="48201, 48202" inputMode="numeric" /></div>
        <label className="flex items-center gap-2 self-end text-sm"><input type="checkbox" checked={insured} onChange={(e) => setInsured(e.target.checked)} /> {t("I carry general liability insurance")}</label>
      </div>
      <div><label className="label">{t("How did you hear about us?")}</label>
        <select name="source" className="input" defaultValue="">
          <option value="">{t("Choose…")}</option>
          {["Another pro referred me", "Google", "Facebook / Instagram", "Indeed / job board", "Supply house or store flyer", "Trade school or association", "Nextdoor", "Other"].map((o) => <option key={o} value={o}>{t(o)}</option>)}
        </select>
      </div>
      <button type="button" className="text-sm font-semibold text-brand" onClick={() => setMore(!more)}>{more ? t("− Hide") : t("+ Add more about your business")} <span className="font-normal text-ink-soft">{t("(optional — speeds up approval)")}</span></button>
      {more && (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div><label className="label">{t("Years in business")}</label><input name="years_experience" type="number" min={0} className="input" /></div>
            <div><label className="label">{t("Crew size")}</label><input name="crew_size" type="number" min={1} className="input" /></div>
            {needs.includes("license") && <div><label className="label">{t("License # (if your trade needs one)")}</label><input name="license_number" className="input" /></div>}
          </div>
          <div><label className="label">{t("Other coverage you carry")}</label><Chips options={(Object.keys(COVERAGES) as CoverageKey[]).filter((k) => k !== "gl").map((k) => ({ id: k, label: t(COVERAGES[k].label) }))} value={coverages} onChange={setCoverages} /></div>
          <div><label className="label">{t("Equipment & vehicle")}</label><input name="equipment" className="input" placeholder={t("e.g. 16 ft box truck, truck-mount carpet unit, 52\" zero-turn")} /></div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div><label className="label">{t("Two references (name + phone)")}</label><textarea name="references_text" className="input min-h-20" placeholder={t("Past clients or contractors you’ve worked for")} /></div>
            <div><label className="label">{t("Photos of your work / website / Google reviews")}</label><textarea name="work_links" className="input min-h-20" placeholder={t("Links")} /></div>
          </div>
          <div><label className="label">{t("Tell us about your crew")}</label><textarea name="message" className="input min-h-24" /></div>
        </div>
      )}
      {state === "error" && <p className="text-sm text-rose-700">{t(error)}</p>}
      <button className="btn-primary w-full" disabled={state === "busy" || !trades.length}>{state === "busy" ? t("Sending…") : trades.length ? (es ? "Enviar solicitud" : "Apply") : t("Pick at least one trade to apply")}</button>
    </form>
  );
}
