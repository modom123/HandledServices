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
 * UPDATED : 2026-10-27_1800 UTC — pro application: utm_source becomes the source (Indeed applicants counted as Indeed), and
 *           ?opening=pro:<trade> / ?trade= pre-selects that trade.
 */
"use client";

import { SmsConsent } from "./SmsConsent";
import { useEffect, useState } from "react";
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
 * Where they came from (?ref= referral, ?src=, utm_*) is captured automatically; utm_source (e.g. indeed) is also the
 * application's source, and ?opening=pro:<trade> / ?trade= pre-selects the trade (Indeed posts, the careers page).
 */
export function ApplyForm({ locale = "en" }: { locale?: Locale }) {
  const es = locale === "es";
  const t = (s: string) => tr(locale, s);
  const { state, error, submit } = useSubmit("/api/applications");
  const [trades, setTrades] = useState<string[]>([]);
  // came from an Indeed post or the careers page (?opening=pro:<trade> or ?trade=<trade>): start with that trade picked
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const want = q.get("opening")?.match(/^pro:([a-z_]+)$/)?.[1] ?? q.get("trade");
    if (want && TRADES.some((x) => x.id === want)) setTrades((cur) => (cur.length ? cur : [want]));
  }, []);
  const [insured, setInsured] = useState(false);
  const [specialties, setSpecialties] = useState<string[]>([]);
  const specialtyOptions = specialtiesFor(trades).map((s) => ({ id: s.id, label: t(s.label) }));
  const tradeOptions = TRADES.map((x) => ({ id: x.id, label: t(x.label) }));
  const needs = [...new Set(trades.flatMap((t) => TRADE_PROFILES[t] ? [...TRADE_PROFILES[t].requires, ...(TRADE_PROFILES[t].license ? ["license"] : [])] : []))];
  if (state === "done") return (
    <div className="card text-center"><div className="text-3xl">🎉</div><h2 className="mt-2 text-xl font-bold">{t("You’re signed up")}</h2>
      <p className="mt-2 text-sm text-ink-soft">{t("Check your email in a few minutes: one click opens your account. Add your photo ID, consent to the background check, sign the W-9 and agreement and set up payout (about 10 minutes on your phone). You’ll see jobs near you while the check runs.")}</p></div>
  );
  return (
    <form className="card space-y-4" onSubmit={(e) => {
      e.preventDefault();
      const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
      const q = new URLSearchParams(window.location.search);
      const utm = Object.fromEntries([...q.entries()].filter(([k]) => k.startsWith("utm_")));
      submit({
        ...f, trades, insured, specialties: specialties.filter((s) => specialtyOptions.some((o) => o.id === s)),
        source: f.source || q.get("src") || q.get("utm_source") || undefined, // utm_source=indeed counts as Indeed in Recruiting ref: q.get("ref") || undefined, utm: Object.keys(utm).length ? utm : undefined, lead: q.get("lead") || undefined,
      });
    }}>
      <p className="text-sm text-ink-soft">{t("Takes 2 minutes. Your account opens right away: no interview, no references.")}</p>
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
      {needs.includes("license") && <div><label className="label">{t("License # (if your trade needs one)")} <span className="font-normal normal-case text-ink-soft">{t("(optional now — add it in setup)")}</span></label><input name="license_number" className="input" /></div>}
      {state === "error" && <p className="text-sm text-rose-700">{t(error)}</p>}
      <button className="btn-primary w-full" disabled={state === "busy" || !trades.length}>{state === "busy" ? t("Sending…") : trades.length ? (es ? "Registrarme" : "Sign up") : t("Pick at least one trade to apply")}</button>
    </form>
  );
}
