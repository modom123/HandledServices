/*
 * FILE    : apps/web/components/ProOnboarding.tsx
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-01_2000 UTC
 * PURPOSE : Pro self-onboarding forms — W-9, insurance, license, agreement, payout.
 * UPDATED : 2026-10-02_1440 UTC — Spanish (pro onboarding & recruiting)
 */
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { t as tr, type Locale } from "@handled/core";

function useStep(locale: Locale) {
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
    setMsg(tr(locale, res.ok ? "Saved ✓" : j.error ?? "Failed"));
    if (res.ok) router.refresh();
  }
  return { msg, busy, submit };
}

export function StepForm({ step, children, cta, locale = "en" }: { step: string; children: React.ReactNode; cta: string; locale?: Locale }) {
  const { msg, busy, submit } = useStep(locale);
  return (
    <form className="mt-3 space-y-3" onSubmit={(e) => { e.preventDefault(); submit(step, e.currentTarget); }}>
      {children}
      <div className="flex items-center gap-3"><button className="btn-primary" disabled={busy}>{busy ? tr(locale, "Saving…") : cta}</button>{msg && <span className="text-sm text-ink-soft">{msg}</span>}</div>
    </form>
  );
}

export const Field = ({ label, ...p }: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) => (
  <div><label className="label">{label}</label><input className="input" {...p} /></div>
);
