/*
 * FILE    : apps/web/components/BookingCalendar.tsx
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-01_2115 UTC
 * PURPOSE : Booking calendar — pick a day (open / limited / full from real pro capacity in
 *           the customer's ZIP) and an arrival window with spots left.
 */
"use client";

import { useEffect, useState } from "react";
import { RUSH_SURCHARGE, TIME_WINDOW_LABEL, type DaySlots, type TimeWindow } from "@handled/core";

type Avail = { mode: "live" | "request"; pros: number; days: DaySlots[] };
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function BookingCalendar({ service, zip, date, window: win, onChange }: {
  service: string; zip: string; date: string; window: TimeWindow; onChange: (date: string, window: TimeWindow) => void;
}) {
  const [data, setData] = useState<Avail | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!/^\d{5}$/.test(zip)) { setData(null); return; }
    let live = true;
    setLoading(true);
    fetch(`/api/availability?service=${service}&zip=${zip}`).then((r) => r.json()).then((d: Avail) => {
      if (!live || !d.days) return;
      setData(d);
      setLoading(false);
      // keep the current pick if it's bookable, else move to the first open non-rush day
      const cur = d.days.find((x) => x.date === date);
      const ok = (x?: DaySlots) => x && !x.closed && x.level !== "full";
      if (!ok(cur)) {
        const first = d.days.find((x) => ok(x) && !x.rush) ?? d.days.find(ok);
        if (first) onChange(first.date, pickWindow(first, win));
      }
    }).catch(() => setLoading(false));
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [service, zip]);

  if (!/^\d{5}$/.test(zip)) return <p className="rounded-xl bg-paper p-4 text-sm text-ink-soft">Enter your ZIP code to see open dates and times.</p>;
  if (!data) return <p className="rounded-xl bg-paper p-4 text-sm text-ink-soft">{loading ? "Checking pro availability…" : "Couldn’t load the calendar — try again."}</p>;

  const lead = data.days[0] ? data.days[0].weekday : 0;
  const day = data.days.find((x) => x.date === date);
  return (
    <div className="space-y-4">
      {data.mode === "request" && <p className="rounded-xl bg-amber-50 p-3 text-sm">We’re still adding pros in {zip}. Pick your preferred time and we’ll confirm it within one business day.</p>}
      <div>
        <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold uppercase tracking-wide text-ink-soft">{WEEKDAYS.map((w) => <div key={w}>{w}</div>)}</div>
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
                <div className="text-[10px] uppercase opacity-70">{dt.getDate() === 1 || d === data.days[0] ? dt.toLocaleDateString("en-US", { month: "short" }) : " "}</div>
                <div className="text-base font-bold leading-none">{dt.getDate()}</div>
                <div className="mt-1 flex items-center gap-1">
                  <span className={`h-1.5 w-1.5 rounded-full ${sel ? "bg-white" : dot}`} />
                  <span className="text-[9px]">{d.closed ? "closed" : d.level === "full" ? "full" : d.rush ? `+${RUSH_SURCHARGE * 100}%` : ""}</span>
                </div>
              </button>
            );
          })}
        </div>
        <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-ink-soft">
          <span><span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />open</span>
          <span><span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-amber-400" />few spots left</span>
          <span><span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-rose-400" />full</span>
          <span>+{RUSH_SURCHARGE * 100}% = within 48 hours (priority)</span>
        </div>
      </div>
      {day && !day.closed && (
        <div>
          <div className="label">Arrival window — {new Date(`${day.date}T12:00:00`).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}</div>
          <div className="flex flex-wrap gap-2">
            {(["morning", "midday", "afternoon"] as const).map((w) => {
              const left = day.windows[w];
              const off = data.mode === "live" && left === 0;
              return (
                <button key={w} type="button" disabled={off} onClick={() => onChange(day.date, w)}
                  className={`rounded-xl border px-3 py-2 text-left text-sm ${win === w ? "border-brand bg-brand-tint font-semibold text-brand-dark" : off ? "border-line bg-paper text-ink-soft/50" : "border-line bg-white hover:border-brand"}`}>
                  {TIME_WINDOW_LABEL[w]}<div className="text-[11px] font-normal text-ink-soft">{data.mode === "request" ? "on request" : off ? "full" : left <= 2 ? `${left} left` : "available"}</div>
                </button>
              );
            })}
            <button type="button" onClick={() => onChange(day.date, "flexible")}
              className={`rounded-xl border px-3 py-2 text-left text-sm ${win === "flexible" ? "border-brand bg-brand-tint font-semibold text-brand-dark" : "border-line bg-white hover:border-brand"}`}>
              {TIME_WINDOW_LABEL.flexible}<div className="text-[11px] font-normal text-ink-soft">fastest to confirm</div>
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
