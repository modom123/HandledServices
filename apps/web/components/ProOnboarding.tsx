/*
 * FILE    : apps/web/components/ProOnboarding.tsx
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-01_2000 UTC
 * PURPOSE : Pro self-onboarding forms — W-9, insurance, license, agreement, payout.
 */
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

function useStep() {
  const router = useRouter();
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(step: string, form: HTMLFormElement) {
    setBusy(true);
    const fd = new FormData(form);
    fd.set("step", step);
    const res = await fetch("/api/pro/onboarding", { method: "POST", body: fd });
    const j = await res.json().catch(() => ({}));
    setBusy(false);
    setMsg(res.ok ? "Saved ✓" : j.error ?? "Failed");
    if (res.ok) router.refresh();
  }
  return { msg, busy, submit };
}

export function StepForm({ step, children, cta }: { step: string; children: React.ReactNode; cta: string }) {
  const { msg, busy, submit } = useStep();
  return (
    <form className="mt-3 space-y-3" onSubmit={(e) => { e.preventDefault(); submit(step, e.currentTarget); }}>
      {children}
      <div className="flex items-center gap-3"><button className="btn-primary" disabled={busy}>{busy ? "Saving…" : cta}</button>{msg && <span className="text-sm text-ink-soft">{msg}</span>}</div>
    </form>
  );
}

export const Field = ({ label, ...p }: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) => (
  <div><label className="label">{label}</label><input className="input" {...p} /></div>
);
