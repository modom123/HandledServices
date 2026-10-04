/*
 * FILE    : apps/web/components/VerifyId.tsx
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-04_1934 UTC
 * PURPOSE : Pro onboarding: start the photo ID check (opens Stripe Identity, or requests a video call),
 *           and the Hub button that marks an ID verified after a video call.
 */
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function VerifyId({ label }: { label: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button className="btn-primary" disabled={busy} onClick={async () => {
      setBusy(true);
      const r = await fetch("/api/pro/identity", { method: "POST" });
      const j = await r.json().catch(() => ({}));
      setBusy(false);
      if (j.url) window.location.href = j.url; else router.refresh();
    }}>{busy ? "…" : label}</button>
  );
}

export function MarkIdVerified({ contractorId }: { contractorId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return <button className="btn-ghost px-3 py-1 text-xs" disabled={busy} onClick={async () => { if (!confirm("Mark this pro's photo ID verified? Only after seeing the ID next to their face on a video call, with the name matching the W-9.")) return; setBusy(true); await fetch("/api/hub/identity", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contractor_id: contractorId }) }); setBusy(false); router.refresh(); }}>Mark ID verified (video call)</button>;
}
