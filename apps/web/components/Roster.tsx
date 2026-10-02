/*
 * FILE    : apps/web/components/Roster.tsx
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-02_0255 UTC
 * PURPOSE : Client pieces for pro whereabouts and schedules:
 *             AutoRefresh  — re-loads a server page every N seconds (Hub live roster)
 *             OnCallToggle — pro switches On call on/off; while on (and this page is open) the
 *                            browser shares location every few minutes
 *             DayOffButton — block or reopen a day from the pro calendar
 * UPDATED : 2026-10-02_1440 UTC — Spanish (pro portal)
 */
"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { t as tr, type Locale } from "@handled/core";

export function AutoRefresh({ seconds = 60 }: { seconds?: number }) {
  const router = useRouter();
  useEffect(() => { const t = setInterval(() => router.refresh(), seconds * 1000); return () => clearInterval(t); }, [router, seconds]);
  return null;
}

export function OnCallToggle({ onCall, until, activeJob, locale = "en" }: { onCall: boolean; until: string | null; activeJob: boolean; locale?: Locale }) {
  const es = locale === "es";
  const t = (s: string) => tr(locale, s);
  const router = useRouter();
  const [on, setOn] = useState(onCall);
  const [hours, setHours] = useState(4);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const watch = useRef<number | null>(null);
  const sharing = on || activeJob;

  useEffect(() => {
    if (!sharing || !("geolocation" in navigator)) return;
    let last = 0;
    const send = (p: GeolocationPosition) => {
      if (Date.now() - last < 3 * 60000) return; // at most every 3 minutes
      last = Date.now();
      fetch("/api/pro/location", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ lat: p.coords.latitude, lng: p.coords.longitude }) }).catch(() => {});
    };
    watch.current = navigator.geolocation.watchPosition(send, () => setMsg(t("Turn on location for this site so we can send you nearby work.")), { enableHighAccuracy: false, maximumAge: 120000 });
    return () => { if (watch.current != null) navigator.geolocation.clearWatch(watch.current); };
  }, [sharing]); // eslint-disable-line react-hooks/exhaustive-deps

  async function set(next: boolean) {
    setBusy(true); setMsg("");
    const res = await fetch("/api/pro/status", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ on_call: next, hours }) });
    setBusy(false);
    if (!res.ok) return setMsg(t((await res.json().catch(() => ({}))).error ?? "Try again"));
    setOn(next); router.refresh();
  }

  return (
    <div className={`card ${on ? "border-brand bg-brand-tint" : ""}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="font-semibold">{t(on ? "🟢 You're on call" : "⚪ Off call")}</div>
          <p className="text-sm text-ink-soft">{on
            ? es
              ? `Los trabajos para el mismo día cerca de usted le llegan primero${until ? ` hasta las ${new Date(until).toLocaleTimeString("es-US", { hour: "numeric", minute: "2-digit" })}` : ""}.`
              : `Same-day jobs near you come to you first${until ? ` until ${new Date(until).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}` : ""}.`
            : t("Go on call to get same-day jobs, even on a day you don't usually work.")}</p>
        </div>
        <div className="flex items-center gap-2">
          {!on && <select className="input w-auto" value={hours} onChange={(e) => setHours(Number(e.target.value))}>{[2, 4, 6, 8, 10, 12].map((h) => <option key={h} value={h}>{es ? `por ${h} h` : `for ${h} hrs`}</option>)}</select>}
          <button className={on ? "btn-ghost" : "btn-primary"} disabled={busy} onClick={() => set(!on)}>{t(on ? "Go off call" : "Go on call")}</button>
        </div>
      </div>
      <p className="mt-2 text-xs text-ink-soft">{t(sharing ? "📍 Sharing your location while you're on call or on a job today. It's cleared afterwards." : "We don't track your location when you're off call and not on a job.")}</p>
      {msg && <p className="mt-1 text-sm text-rose-700">{msg}</p>}
    </div>
  );
}

export function DayOffButton({ date, off, hasJobs, locale = "en" }: { date: string; off: boolean; hasJobs: boolean; locale?: Locale }) {
  const t = (s: string) => tr(locale, s);
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  if (hasJobs && !off) return null;
  return (
    <button className="text-xs text-brand underline disabled:opacity-50" disabled={busy} onClick={async () => {
      setBusy(true);
      const res = await fetch("/api/pro/schedule", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ date, off: !off }) });
      setBusy(false);
      if (!res.ok) alert(t((await res.json().catch(() => ({}))).error ?? "Couldn't update"));
      router.refresh();
    }}>{t(off ? "Reopen" : "Take off")}</button>
  );
}
