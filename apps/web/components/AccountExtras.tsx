/*
 * FILE    : apps/web/components/AccountExtras.tsx
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-02_0316 UTC
 * UPDATED : 2026-10-02_1329 UTC — TrackPro (live ETA + map) and Reschedule.
 * UPDATED : 2026-10-02_1412 UTC — English / Spanish (locale prop) and LanguageToggle (saved on the account).
 * PURPOSE : Account page client pieces: copy-my-referral-link, manage Handled Plus (Stripe
 *           portal), add a tip, and delete my account (type DELETE to confirm).
 */
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { TIP_PRESETS, money, t as tr, type Locale, type TimeWindow } from "@handled/core";
import { BookingCalendar } from "./BookingCalendar";

async function post(url: string, body: unknown = {}) {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return { ok: res.ok, data: await res.json().catch(() => ({})) };
}

export function CopyLink({ url, locale = "en" }: { url: string; locale?: Locale }) {
  const t = (s: string) => tr(locale, s);
  const [done, setDone] = useState(false);
  return <button className="btn-primary" onClick={async () => { await navigator.clipboard.writeText(url).catch(() => {}); setDone(true); }}>{done ? t("Copied ✓") : t("Copy my link")}</button>;
}

export function PlusButton({ member, locale = "en" }: { member: boolean; locale?: Locale }) {
  const t = (s: string) => tr(locale, s);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  return (
    <div>
      <button className={member ? "btn-ghost" : "btn-primary"} disabled={busy} onClick={async () => {
        setBusy(true); setErr("");
        const r = await post(member ? "/api/plus/portal" : "/api/plus");
        setBusy(false);
        if (r.data.url) window.location.href = r.data.url; else setErr(r.data.error ?? t("Try again"));
      }}>{busy ? t("One moment…") : member ? t("Manage or cancel") : t("Join Plus")}</button>
      {err && <p className="mt-1 text-sm text-rose-700">{err}</p>}
    </div>
  );
}

export function TipBox({ jobId, tipped, locale = "en" }: { jobId: string; tipped: number; locale?: Locale }) {
  const t = (s: string) => tr(locale, s);
  const es = locale === "es";
  const router = useRouter();
  const [custom, setCustom] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  async function tip(amount: number) {
    setBusy(true); setMsg("");
    const r = await post(`/api/account/jobs/${jobId}/tip`, { amount });
    setBusy(false);
    if (r.data.url) { window.location.href = r.data.url; return; }
    if (!r.ok) return setMsg(r.data.error ?? t("Try again"));
    setMsg(es ? `¡Gracias! ${money(amount)} va en camino a su profesional.` : `Thank you! ${money(amount)} is on its way to your pro.`);
    router.refresh();
  }
  return (
    <div className="card">
      <div className="font-semibold">💚 {t("Tip your pro")}</div>
      <p className="text-sm text-ink-soft">{t("100% goes to your pro.")}{tipped ? (es ? ` Ha dado ${money(tipped)} de propina.` : ` You've tipped ${money(tipped)} so far.`) : ""}</p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {TIP_PRESETS.map((t) => <button key={t} className="btn-ghost" disabled={busy} onClick={() => tip(t)}>{money(t)}</button>)}
        <input className="input w-28" inputMode="decimal" placeholder={t("Other $")} value={custom} onChange={(e) => setCustom(e.target.value.replace(/[^\d.]/g, ""))} />
        <button className="btn-primary" disabled={busy || !(Number(custom) >= 1)} onClick={() => tip(Number(custom))}>{t("Tip")}</button>
      </div>
      {msg && <p className="mt-2 text-sm">{msg}</p>}
    </div>
  );
}

export function DeleteAccount({ locale = "en" }: { locale?: Locale }) {
  const t = (s: string) => tr(locale, s);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  if (!open) return <button className="text-sm text-rose-700 underline" onClick={() => setOpen(true)}>{t("Delete my account")}</button>;
  return (
    <div className="card border-rose-200 bg-rose-50">
      <div className="font-semibold">{t("Delete your account?")}</div>
      <p className="mt-1 text-sm text-ink-soft">{t("This removes your login, profile, phone, saved devices and photos, and cancels any membership. We keep invoices and payment records (name and email only) because tax law requires it. This can’t be undone.")}</p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input className="input w-40" placeholder={t("Type DELETE")} value={text} onChange={(e) => setText(e.target.value)} />
        <button className="btn bg-rose-700 text-white hover:bg-rose-800" disabled={busy || text !== "DELETE"} onClick={async () => {
          setBusy(true); setErr("");
          const r = await post("/api/account/delete", { confirm: "DELETE" });
          setBusy(false);
          if (!r.ok) return setErr(r.data.error ?? t("Couldn't delete — contact support"));
          window.location.href = "/home?deleted=1";
        }}>{busy ? t("Deleting…") : t("Delete permanently")}</button>
        <button className="btn-ghost" onClick={() => setOpen(false)}>{t("Keep my account")}</button>
      </div>
      {err && <p className="mt-2 text-sm text-rose-700">{err}</p>}
    </div>
  );
}

type Track = { tracking: boolean; arrived?: boolean; name?: string | null; eta?: number | null; miles?: number; updatedMinAgo?: number; pro?: { lat: number; lng: number }; home?: { lat: number; lng: number } };

/** "Your pro is ~12 minutes away" with a small map — refreshes every 30 seconds while on the way. */
export function TrackPro({ jobId, locale = "en" }: { jobId: string; locale?: Locale }) {
  const tt = (s: string) => tr(locale, s);
  const es = locale === "es";
  const [t, setT] = useState<Track | null>(null);
  useEffect(() => {
    let live = true;
    const load = () => fetch(`/api/account/jobs/${jobId}/track`).then((r) => r.json()).then((d: Track) => { if (live) setT(d); }).catch(() => {});
    load();
    const id = setInterval(load, 30000);
    return () => { live = false; clearInterval(id); };
  }, [jobId]);
  if (!t?.tracking) return null;
  if (t.arrived) return <div className="card border-brand bg-brand-tint font-semibold text-brand-dark">✅ {tt("Your pro has arrived and started work.")}</div>;
  const box = t.pro && t.home ? [Math.min(t.pro.lng, t.home.lng) - 0.01, Math.min(t.pro.lat, t.home.lat) - 0.01, Math.max(t.pro.lng, t.home.lng) + 0.01, Math.max(t.pro.lat, t.home.lat) + 0.01] : null;
  return (
    <div className="card border-brand">
      <div className="text-lg font-bold">🚗 {t.name ?? tt("Your pro")} {es ? "va en camino" : "is on the way"}{t.eta ? (es ? ` — unos ${t.eta} min` : ` — about ${t.eta} min`) : ""}</div>
      <p className="text-sm text-ink-soft">{t.miles != null ? (es ? `a ${t.miles} millas · actualizado ${t.updatedMinAgo ? `hace ${t.updatedMinAgo} min` : "ahora"}` : `${t.miles} miles away · updated ${t.updatedMinAgo ? `${t.updatedMinAgo} min ago` : "just now"}`) : tt("Live location appears when their phone shares it.")}</p>
      {box && t.pro && (
        <iframe title={tt("Your pro's location")} className="mt-3 h-56 w-full rounded-xl border border-line" loading="lazy"
          src={`https://www.openstreetmap.org/export/embed.html?bbox=${box.join("%2C")}&layer=mapnik&marker=${t.pro.lat}%2C${t.pro.lng}`} />
      )}
    </div>
  );
}

/** Move the booking to another open day / window (free until 24 hours before). */
export function Reschedule({ jobId, service, zip, date, window: win, locale = "en" }: { jobId: string; service: string; zip: string; date: string; window: TimeWindow; locale?: Locale }) {
  const t = (s: string) => tr(locale, s);
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [d, setD] = useState(date);
  const [w, setW] = useState<TimeWindow>(win);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  if (!open) return <button className="btn-ghost" onClick={() => setOpen(true)}>📅 {t("Reschedule")}</button>;
  return (
    <div className="card space-y-3">
      <div className="font-semibold">{t("Pick a new day and time")}</div>
      <BookingCalendar service={service} zip={zip} date={d} window={w} onChange={(nd, nw) => { setD(nd); setW(nw); }} locale={locale} />
      <div className="flex flex-wrap gap-2">
        <button className="btn-primary" disabled={busy || (d === date && w === win)} onClick={async () => {
          setBusy(true); setMsg("");
          const r = await post(`/api/account/jobs/${jobId}/reschedule`, { date: d, window: w });
          setBusy(false);
          if (!r.ok) return setMsg(r.data.error ?? t("Couldn't move it"));
          setOpen(false); router.refresh();
        }}>{busy ? t("Moving…") : t("Move my booking")}</button>
        <button className="btn-ghost" onClick={() => setOpen(false)}>{t("Keep current time")}</button>
      </div>
      {msg && <p className="text-sm text-rose-700">{msg}</p>}
      <p className="text-xs text-ink-soft">{t("Free until 24 hours before. If your pro isn’t free at the new time, we’ll match another vetted pro.")}</p>
    </div>
  );
}

/** English / Spanish for this person — saved on their account, so texts and emails follow it too. */
export function LanguageToggle({ locale }: { locale: Locale }) {
  const [busy, setBusy] = useState(false);
  const set = async (l: Locale) => {
    if (l === locale) return;
    setBusy(true);
    await post("/api/account/locale", { locale: l });
    window.location.reload();
  };
  return (
    <div className="card">
      <div className="font-semibold">🌐 {locale === "es" ? "Idioma" : "Language"}</div>
      <p className="mt-1 text-sm text-ink-soft">{locale === "es" ? "El sitio, la app, los mensajes de texto y los correos le llegan en este idioma." : "The website, app, text messages and emails all come to you in this language."}</p>
      <div className="mt-3 flex gap-2">
        {(["en", "es"] as const).map((l) => (
          <button key={l} type="button" disabled={busy} onClick={() => set(l)} className={`rounded-full border px-4 py-1.5 text-sm ${locale === l ? "border-brand bg-brand-tint font-semibold text-brand-dark" : "border-line bg-white"}`}>{l === "en" ? "English" : "Español"}</button>
        ))}
      </div>
    </div>
  );
}
