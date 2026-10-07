/*
 * FILE    : apps/web/components/Favorites.tsx
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-04_2204 UTC
 * PURPOSE : Customer favorites (lib/favorites.ts): ★ Favorite a pro (or their crew member) from a job, and
 *           remove a favorite on the account page. English and Spanish.
 */
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function FavoriteButton({ jobId, name, crew, saved, es }: { jobId: string; name: string; crew?: boolean; saved: boolean; es: boolean }) {
  const router = useRouter();
  const [done, setDone] = useState(saved);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  if (done) return <span className="text-sm font-semibold text-brand">★ {es ? `${name} es favorito` : `${name} is a favorite`}</span>;
  return (
    <span>
      <button className="btn-ghost px-4 text-sm" disabled={busy} onClick={async () => {
        setBusy(true);
        const r = await fetch("/api/account/favorites", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ job_id: jobId, crew: Boolean(crew) }) });
        const j = await r.json().catch(() => ({}));
        setBusy(false);
        if (r.ok && j.ok) { setDone(true); router.refresh(); } else setMsg(String(j.error ?? (es ? "Intente de nuevo" : "Try again")));
      }}>☆ {es ? `Marcar a ${name} como favorito` : `Favorite ${name}`}</button>
      {msg && <span className="ml-2 text-xs text-red-700">{msg}</span>}
    </span>
  );
}

export function RemoveFavorite({ id, es }: { id: string; es: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button className="text-xs text-ink-soft underline" disabled={busy} onClick={async () => {
      setBusy(true);
      await fetch(`/api/account/favorites?id=${id}`, { method: "DELETE" });
      setBusy(false);
      router.refresh();
    }}>{es ? "Quitar" : "Remove"}</button>
  );
}
