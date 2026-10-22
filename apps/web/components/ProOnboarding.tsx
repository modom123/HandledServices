/*
 * FILE    : apps/web/components/ProOnboarding.tsx
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-01_2000 UTC
 * PURPOSE : Pro self-onboarding forms — W-9, insurance, license, agreement, payout.
 * UPDATED : 2026-10-02_1440 UTC — Spanish (pro onboarding & recruiting)
 * UPDATED : 2026-10-22_0500 UTC — ZipAutofill: typing a ZIP fills the city and state (empty, or what it filled before).
 */
"use client";

import { useEffect, useRef, useState } from "react";
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

/** Inside a form: when the named ZIP field holds 5 digits, fill the city and state fields (/api/zip). Never overwrites what the person typed. */
export function ZipAutofill({ zip, city, state }: { zip: string; city: string; state: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const form = ref.current?.closest("form");
    const z = form?.elements.namedItem(zip) as HTMLInputElement | null;
    const c = form?.elements.namedItem(city) as HTMLInputElement | null;
    const s = form?.elements.namedItem(state) as HTMLInputElement | null;
    if (!z || !c || !s) return;
    let last: { city: string; state: string } | null = null;
    const fill = async () => {
      if (!/^\d{5}$/.test(z.value)) return;
      const j = await fetch(`/api/zip?zip=${z.value}`).then((r) => r.json()).catch(() => null) as { city: string | null; state: string | null } | null;
      if (!j?.city || !j.state) return;
      if (!c.value || c.value === last?.city) c.value = j.city;
      if (!s.value || s.value === "MI" || s.value === last?.state) s.value = j.state;
      last = { city: j.city, state: j.state };
    };
    z.addEventListener("input", fill);
    return () => z.removeEventListener("input", fill);
  }, [zip, city, state]);
  return <span ref={ref} hidden />;
}
