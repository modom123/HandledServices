/*
 * FILE    : apps/web/components/Standby.tsx
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-06_1950 UTC
 * PURPOSE : Pro home → Standby requests: confirm you can cover as backup #1–#3, or pass (free).
 */
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function StandbyAnswer({ id, status, es }: { id: string; status: "asked" | "standby"; es: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const send = async (answer: "yes" | "no") => {
    setBusy(true); setMsg("");
    const r = await fetch("/api/pro/backups", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, answer }) });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) return setMsg(j.error ?? (es ? "Intente de nuevo" : "Try again"));
    router.refresh();
  };
  return (
    <div className="flex flex-wrap items-center gap-2">
      {status === "asked"
        ? <button className="btn-primary px-4" disabled={busy} onClick={() => send("yes")}>{es ? "Sí, puedo cubrir" : "Yes, I can cover"}</button>
        : <span className="rounded-full bg-brand-tint px-3 py-1 text-sm font-semibold text-brand-dark">✓ {es ? "Confirmado" : "You're on standby"}</span>}
      <button className="btn-ghost px-4" disabled={busy} onClick={() => send("no")}>{status === "asked" ? (es ? "Paso" : "Pass") : (es ? "Ya no puedo" : "Can't anymore")}</button>
      {msg && <span className="text-sm text-rose-700">{msg}</span>}
    </div>
  );
}
