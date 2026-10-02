/*
 * FILE    : apps/web/components/WaitlistForm.tsx
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-02_2245 UTC
 * PURPOSE : "No pros here yet" → join the waitlist. Shown on the booking calendar when no pro
 *           covers the ZIP. We email (and text, if given) the day a pro starts covering it.
 */
"use client";

import { useState } from "react";
import { t as tr, type Locale } from "@handled/core";

export function WaitlistForm({ service, zip, locale = "en", source = "booking" }: { service: string; zip: string; locale?: Locale; source?: string }) {
  const t = (s: string) => tr(locale, s);
  const es = locale === "es";
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");
  const [msg, setMsg] = useState("");
  if (state === "done") return <p className="rounded-xl bg-emerald-50 p-3 text-sm">✓ {es ? `Listo. Le avisaremos en cuanto tengamos un profesional en ${zip}.` : `You’re on the list. We’ll tell you the day a pro covers ${zip}.`}</p>;
  return (
    <form className="rounded-xl border border-line bg-white p-3 text-sm" onSubmit={async (e) => {
      e.preventDefault();
      setState("busy"); setMsg("");
      const r = await fetch("/api/waitlist", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, phone: phone || null, zip, service, locale, source }) });
      const j = await r.json().catch(() => ({}));
      if (r.ok) setState("done"); else { setState("idle"); setMsg(t(j.error ?? "Try again")); }
    }}>
      <div className="font-semibold">{t("Rather wait for a confirmed pro?")}</div>
      <p className="mt-1 text-ink-soft">{es ? `Únase a la lista de espera y le avisaremos en cuanto un profesional cubra ${zip}.` : `Join the waitlist and we’ll tell you the day a pro covers ${zip}.`}</p>
      <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
        <input className="input" type="email" required placeholder={t("Email")} value={email} onChange={(e) => setEmail(e.target.value)} />
        <input className="input" type="tel" placeholder={t("Mobile (optional, for a text)")} value={phone} onChange={(e) => setPhone(e.target.value)} />
        <button className="btn-ghost" disabled={state === "busy"}>{t("Notify me")}</button>
      </div>
      {msg && <p className="mt-1 text-rose-700">{msg}</p>}
    </form>
  );
}
