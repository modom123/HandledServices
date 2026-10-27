/*
 * FILE    : apps/web/components/ProTeam.tsx
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-27_2300 UTC
 * PURPOSE : Pro portal → Office team: invite an office manager (they get a one-click sign-in link) and remove access.
 *           English and Spanish.
 */
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

async function post(body: unknown) {
  const r = await fetch("/api/pro/team", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  return r.ok && j.ok !== false ? null : String(j.error ?? "Try again");
}

export function TeamInvite({ es }: { es: boolean }) {
  const router = useRouter();
  const blank = { full_name: "", email: "", phone: "", locale: es ? "es" : "en" };
  const [f, setF] = useState(blank);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-2">
        <input className="input" placeholder={es ? "Nombre completo" : "Full name"} value={f.full_name} onChange={(e) => setF({ ...f, full_name: e.target.value })} />
        <input className="input" type="email" placeholder={es ? "Correo (con el que inicia sesión)" : "Email (they sign in with it)"} value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
        <input className="input" type="tel" placeholder={es ? "Teléfono (opcional)" : "Phone (optional)"} value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
        <select className="input" value={f.locale} onChange={(e) => setF({ ...f, locale: e.target.value })}><option value="en">English</option><option value="es">Español</option></select>
      </div>
      <button className="btn-primary" disabled={busy || f.full_name.trim().length < 2 || !f.email.includes("@")} onClick={async () => {
        setBusy(true); setMsg("");
        const e = await post({ action: "invite", ...f, phone: f.phone || null });
        setBusy(false);
        if (e) return setMsg(e);
        setF(blank); router.refresh();
      }}>{busy ? "…" : es ? "Dar acceso y enviar enlace" : "Give access and send link"}</button>
      {msg && <p className="text-sm text-rose-700">{msg}</p>}
    </div>
  );
}

export function TeamRemove({ id, es }: { id: string; es: boolean }) {
  const router = useRouter();
  const [sure, setSure] = useState(false);
  return sure
    ? <button className="text-xs font-semibold text-rose-700" onClick={async () => { await post({ action: "remove", id }); router.refresh(); }}>{es ? "Confirmar: quitar acceso" : "Confirm: remove access"}</button>
    : <button className="text-xs text-ink-soft underline" onClick={() => setSure(true)}>{es ? "Quitar" : "Remove"}</button>;
}
