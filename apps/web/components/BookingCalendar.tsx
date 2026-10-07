/*
 * FILE    : apps/web/components/BookingCalendar.tsx
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-01_2115 UTC
 * PURPOSE : Booking calendar — pick a day (open / limited / full from real pro capacity in
 *           the customer's ZIP) and an arrival window with spots left.
 * UPDATED : 2026-10-02_1405 UTC — English / Spanish (locale prop).
 * UPDATED : 2026-10-02_2245 UTC — no pros in the ZIP yet → waitlist sign-up next to the request option.
 * UPDATED : 2026-10-02_0302 UTC — today (same-day slots from on-call pros), until (only days up to
 *           the customer's deadline), earliest (ASAP: pick the first open slot, priority or not).
 * UPDATED : 2026-10-04_1934 UTC — "coming soon" + waitlist when the service isn't open yet in the customer's city.
 * UPDATED : 2026-10-07_1700 UTC — outside Michigan and Washington: says so, with the waitlist.
 * UPDATED : 2026-10-07_1610 UTC — no pros in the ZIP yet → waitlist only (booking would take payment with nobody to send).
 */
"use client";

import { useEffect, useState } from "react";
import { WaitlistForm } from "./WaitlistForm";
import { RUSH_SURCHARGE, TIME_WINDOW_LABEL, t as tr, type DaySlots, type Locale, type TimeWindow } from "@handled/core";

type Avail = { mode: "live" | "request" | "closed"; pros: number; days: DaySlots[]; market?: string | null };
const WEEKDAYS = { en: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"], es: ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"] };
const ES: Record<string, string> = {
  "Enter your ZIP code to see open dates and times.": "Ingrese su código postal para ver fechas y horarios disponibles.", "Checking pro availability…": "Revisando disponibilidad…",
  "Couldn’t load the calendar — try again.": "No se pudo cargar el calendario — intente de nuevo.", open: "disponible", "few spots left": "quedan pocos", full: "lleno", closed: "cerrado",
  "within 48 hours (priority)": "dentro de 48 horas (prioridad)", "Arrival window": "Horario de llegada", "on request": "a solicitud", available: "disponible", "fastest to confirm": "se confirma más rápido", left: "disponibles",
};

export function BookingCalendar({ service, zip, date, window: win, onChange, today = false, until, earliest = false, locale = "en" }: {
  service: string; zip: string; date: string; window: TimeWindow; onChange: (date: string, window: TimeWindow) => void;
  today?: boolean; until?: string; earliest?: boolean; locale?: Locale;
}) {
  const t = (s: string) => (locale === "es" ? ES[s] ?? tr("es", s) : s);
  const dl = locale === "es" ? "es-US" : "en-US";
  const [data, setData] = useState<Avail | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!/^\d{5}$/.test(zip)) { setData(null); return; }
    let live = true;
    setLoading(true);
    fetch(`/api/availability?service=${service}&zip=${zip}${today ? "&today=1" : ""}`).then((r) => r.json()).then((d: Avail) => {
      if (!live || !d.days) return;
      if (d.mode === "closed") { setData(d); setLoading(false); return; }
      if (until) d = { ...d, days: d.days.filter((x) => x.date <= until) };
      setData(d);
      setLoading(false);
      // keep the current pick if it's bookable, else move to the first open non-rush day
      const cur = d.days.find((x) => x.date === date);
      const ok = (x?: DaySlots) => x && !x.closed && x.level !== "full";
      if (!ok(cur) || earliest) {
        const first = (earliest ? null : d.days.find((x) => ok(x) && !x.rush)) ?? d.days.find(ok);
        if (first) onChange(first.date, pickWindow(first, win));
      }
    }).catch(() => setLoading(false));
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [service, zip, today, until]);

  if (!/^\d{5}$/.test(zip)) return <p className="rounded-xl bg-paper p-4 text-sm text-ink-soft">{t("Enter your ZIP code to see open dates and times.")}</p>;
  if (!data) return <p className="rounded-xl bg-paper p-4 text-sm text-ink-soft">{loading ? t("Checking pro availability…") : t("Couldn’t load the calendar — try again.")}</p>;

  if (data.mode === "closed") return (
    <div className="space-y-3">
      <p className="rounded-xl bg-amber-50 p-3 text-sm">{data.market
        ? (locale === "es" ? `Este servicio llegará pronto a ${data.market}. Déjenos su correo y le avisamos en cuanto abra, con un descuento de lanzamiento.` : `This service is coming soon to ${data.market}. Leave your email and we’ll tell you the day it opens, with a launch discount.`)
        : (locale === "es" ? `Por ahora atendemos Michigan y Washington. Déjenos su correo y le avisamos cuando lleguemos a ${zip}.` : `We serve Michigan and Washington right now. Leave your email and we’ll tell you when we reach ${zip}.`)}</p>
      <WaitlistForm service={service} zip={zip} locale={locale} />
    </div>
  );
  // no vetted pro covers this ZIP yet: no booking (and no payment) until one does — waitlist instead
  if (data.mode === "request") return (
    <div className="space-y-3">
      <p className="rounded-xl bg-amber-50 p-3 text-sm">{locale === "es" ? `Todavía no tenemos profesionales para este servicio en ${zip}. Déjenos su correo y le avisamos en cuanto haya uno: no se le cobra nada hasta entonces.` : `We don’t have a pro for this service in ${zip} yet. Leave your email and we’ll tell you as soon as one is available — nothing is charged until then.`}</p>
      <WaitlistForm service={service} zip={zip} locale={locale} />
    </div>
  );
  const lead = data.days[0] ? data.days[0].weekday : 0;
  const day = data.days.find((x) => x.date === date);
  return (
    <div className="space-y-4">
      {data.mode === "live" && !data.days.some((x) => !x.closed && x.level !== "full") && <p className="rounded-xl bg-amber-50 p-3 text-sm">{locale === "es" ? "No hay horarios disponibles antes de su fecha. Elija una opción más adelante en “¿Para cuándo lo necesita?”, o llámenos y trataremos de acomodarlo." : "No open slots before your date. Choose a later “When do you need it?” option, or call us and we’ll try to fit you in."}</p>}
      <div>
        <div className="grid grid-cols-7 gap-1 text-center text-[13px] font-semibold uppercase tracking-wide text-ink-soft">{WEEKDAYS[locale === "es" ? "es" : "en"].map((w) => <div key={w}>{w}</div>)}</div>
        <div className="mt-1 grid grid-cols-7 gap-1">
          {Array.from({ length: lead }).map((_, i) => <div key={`pad${i}`} />)}
          {data.days.map((d) => {
            const dt = new Date(`${d.date}T12:00:00`);
            const disabled = d.closed || d.level === "full";
            const sel = d.date === date;
            const dot = { open: "bg-emerald-500", limited: "bg-amber-400", full: "bg-rose-400", closed: "bg-transparent", request: "bg-slate-300" }[d.level];
            return (
              <button key={d.date} type="button" disabled={disabled} onClick={() => onChange(d.date, pickWindow(d, win))}
                className={`relative rounded-xl border p-1.5 text-left transition ${sel ? "border-brand bg-brand text-white" : disabled ? "border-transparent bg-paper text-ink-soft/50" : "border-line bg-white hover:border-brand"}`}>
                <div className="text-[12px] uppercase opacity-70">{dt.getDate() === 1 || d === data.days[0] ? dt.toLocaleDateString(dl, { month: "short" }) : " "}</div>
                <div className="text-base font-bold leading-none">{dt.getDate()}</div>
                <div className="mt-1 flex items-center gap-1">
                  <span className={`h-1.5 w-1.5 rounded-full ${sel ? "bg-white" : dot}`} />
                  <span className="text-[11px]">{d.closed ? t("closed") : d.level === "full" ? t("full") : d.rush ? `+${RUSH_SURCHARGE * 100}%` : ""}</span>
                </div>
              </button>
            );
          })}
        </div>
        <div className="mt-2 flex flex-wrap gap-3 text-[13px] text-ink-soft">
          <span><span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />{t("open")}</span>
          <span><span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-amber-400" />{t("few spots left")}</span>
          <span><span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-rose-400" />{t("full")}</span>
          <span>+{RUSH_SURCHARGE * 100}% = {t("within 48 hours (priority)")}</span>
        </div>
      </div>
      {day && !day.closed && (
        <div>
          <div className="label">{t("Arrival window")} — {new Date(`${day.date}T12:00:00`).toLocaleDateString(dl, { weekday: "long", month: "long", day: "numeric" })}</div>
          <div className="flex flex-wrap gap-2">
            {(["morning", "midday", "afternoon"] as const).map((w) => {
              const left = day.windows[w];
              const off = data.mode === "live" && left === 0;
              return (
                <button key={w} type="button" disabled={off} onClick={() => onChange(day.date, w)}
                  className={`rounded-xl border px-3 py-2 text-left text-sm ${win === w ? "border-brand bg-brand-tint font-semibold text-brand-dark" : off ? "border-line bg-paper text-ink-soft/50" : "border-line bg-white hover:border-brand"}`}>
                  {t(TIME_WINDOW_LABEL[w])}<div className="text-[13px] font-normal text-ink-soft">{data.mode === "request" ? t("on request") : off ? t("full") : left <= 2 ? `${left} ${t("left")}` : t("available")}</div>
                </button>
              );
            })}
            <button type="button" onClick={() => onChange(day.date, "flexible")}
              className={`rounded-xl border px-3 py-2 text-left text-sm ${win === "flexible" ? "border-brand bg-brand-tint font-semibold text-brand-dark" : "border-line bg-white hover:border-brand"}`}>
              {t(TIME_WINDOW_LABEL.flexible)}<div className="text-[13px] font-normal text-ink-soft">{t("fastest to confirm")}</div>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function pickWindow(d: DaySlots, current: TimeWindow): TimeWindow {
  if (current === "flexible" || d.level === "request") return current;
  if (d.windows[current] > 0) return current;
  return (["morning", "midday", "afternoon"] as const).find((w) => d.windows[w] > 0) ?? "flexible";
}
