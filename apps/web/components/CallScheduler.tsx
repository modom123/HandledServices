/*
 * FILE    : apps/web/components/CallScheduler.tsx
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-11-17_1530 UTC
 * PURPOSE : Appointment calendar for a call: pick a day, then a time, for a Handled person to call you. Open times come
 *           from /api/call-slots (our call hours minus calls already booked); times show in the visitor's own time zone.
 *           The parent sends the chosen time with the lead (call_at); the server checks it's still open. English / Spanish.
 */
"use client";

import { useEffect, useState } from "react";

type Day = { date: string; slots: { at: string; left: number }[] };

export const browserTz = () => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || null; } catch { return null; } };

export function CallScheduler({ es, value, onChange, reload = 0 }: { es: boolean; value: string | null; onChange: (at: string | null) => void; reload?: number }) {
  const [days, setDays] = useState<Day[] | null>(null);
  const [day, setDay] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const loc = es ? "es-US" : "en-US";

  useEffect(() => {
    let live = true;
    setFailed(false);
    fetch("/api/call-slots", { cache: "no-store" }).then((r) => r.json()).then((j: { days?: Day[] }) => {
      if (!live) return;
      const d = j.days ?? [];
      setDays(d);
      setDay((cur) => (cur && d.some((x) => x.date === cur) ? cur : d[0]?.date ?? null));
      if (value && !d.some((x) => x.slots.some((s) => s.at === value))) onChange(null);
    }).catch(() => live && setFailed(true));
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reload]);

  if (failed) return <p className="text-sm text-rose-700">{es ? "No pudimos cargar el calendario. Intente de nuevo." : "Couldn't load the calendar. Try again."}</p>;
  if (!days) return <p className="text-sm text-ink-soft">{es ? "Cargando horarios…" : "Loading open times…"}</p>;
  if (!days.length) return <p className="text-sm text-ink-soft">{es ? "No hay horarios libres ahora. Elija «Lo antes posible» y le llamamos." : "No open times right now — choose “As soon as possible” and we'll call you."}</p>;

  const dayLabel = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString(loc, { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
  const time = (at: string) => new Date(at).toLocaleTimeString(loc, { hour: "numeric", minute: "2-digit" });
  const slots = days.find((d) => d.date === day)?.slots ?? [];
  const tzName = new Intl.DateTimeFormat(loc, { timeZoneName: "long" }).formatToParts(new Date()).find((p) => p.type === "timeZoneName")?.value;

  return (
    <div className="min-w-0 space-y-3">
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1" role="listbox" aria-label={es ? "Día" : "Day"}>
        {days.map((d) => (
          <button key={d.date} type="button" role="option" aria-selected={d.date === day} onClick={() => setDay(d.date)}
            className={`shrink-0 rounded-xl border px-3 py-2 text-center text-sm ${d.date === day ? "border-brand bg-brand-tint font-semibold" : "border-line hover:border-brand"}`}>
            {dayLabel(d.date)}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4" role="listbox" aria-label={es ? "Hora" : "Time"}>
        {slots.map((s) => (
          <button key={s.at} type="button" role="option" aria-selected={s.at === value} onClick={() => onChange(s.at === value ? null : s.at)}
            className={`rounded-lg border px-2 py-2 text-sm ${s.at === value ? "border-brand bg-brand text-white" : "border-line hover:border-brand"}`}>
            {time(s.at)}
          </button>
        ))}
      </div>
      <p className="text-xs text-ink-soft">{es ? "Horas en su zona horaria" : "Times in your time zone"}{tzName ? ` (${tzName})` : ""}.{value ? ` ${es ? "Elegido:" : "Selected:"} ${new Date(value).toLocaleString(loc, { weekday: "long", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}.` : ""}</p>
    </div>
  );
}
