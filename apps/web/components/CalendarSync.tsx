/*
 * FILE    : apps/web/components/CalendarSync.tsx
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-12_0005 UTC
 * PURPOSE : "Sync to my phone's calendar" on the pro's My calendar page (client): add to Google, Apple / Outlook (webcal),
 *           copy the link, or make a new link (the old one stops). English / Spanish.
 */
"use client";

import { useState } from "react";

type Links = { https: string; webcal: string; google: string };

export function CalendarSync({ initial, es }: { initial: Links | null; es: boolean }) {
  const [links, setLinks] = useState(initial), [msg, setMsg] = useState("");
  const L = (en: string, sp: string) => (es ? sp : en);
  if (!links) return null;
  const rotate = async () => {
    if (!confirm(L("Make a new link? Calendars using the old link stop updating until you add the new one.", "¿Crear un enlace nuevo? Los calendarios con el enlace anterior dejarán de actualizarse."))) return;
    const r = await fetch("/api/pro/calendar", { method: "POST" });
    if (r.ok) { setLinks(await r.json()); setMsg(L("New link made — add it again in your calendar.", "Enlace nuevo creado: agréguelo otra vez en su calendario.")); }
  };
  const copy = async () => { await navigator.clipboard.writeText(links.https).catch(() => {}); setMsg(L("Link copied", "Enlace copiado")); };
  return (
    <div className="card space-y-2">
      <div className="font-semibold">📅 {L("Sync jobs to your phone's calendar", "Sincronice sus trabajos con el calendario de su teléfono")}</div>
      <p className="text-sm text-ink-soft">{L("Your Handled jobs show up in Google, Apple or Outlook Calendar and update on their own (calendar apps check every few hours). Lockbox codes and entry details stay in the app.", "Sus trabajos aparecen en Google, Apple u Outlook y se actualizan solos (las apps revisan cada pocas horas). Los códigos y detalles de entrada se quedan en la app.")}</p>
      <div className="flex flex-wrap gap-2">
        <a className="btn-primary px-3 text-sm" href={links.google} target="_blank" rel="noreferrer">Google Calendar</a>
        <a className="btn-ghost px-3 text-sm" href={links.webcal}>{L("Apple / Outlook", "Apple / Outlook")}</a>
        <button className="btn-ghost px-3 text-sm" onClick={copy}>{L("Copy link", "Copiar enlace")}</button>
        <button className="text-xs text-ink-soft underline" onClick={rotate}>{L("Make a new link", "Crear enlace nuevo")}</button>
      </div>
      <p className="text-xs text-ink-soft">{L("Keep this link private — anyone with it can see your job times and addresses.", "Mantenga este enlace privado: quien lo tenga puede ver horarios y direcciones.")}</p>
      {msg && <p className="text-xs">{msg}</p>}
    </div>
  );
}
