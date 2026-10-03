/*
 * FILE    : apps/web/components/SaveQuote.tsx
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-03_0027 UTC
 * PURPOSE : "Not ready to book? Email me this price." Under the price on the booking page.
 *           We email the price with a link that reopens the booking with these answers, and
 *           follow up twice (day 1 and 4) unless they book. Unsubscribe link in every email.
 */
"use client";

import { useState } from "react";
import { t as tr, type Answers, type Frequency, type Locale } from "@handled/core";

export function SaveQuote({ slug, answers, frequency, locale = "en" }: { slug: string; answers: Answers; frequency: Frequency; locale?: Locale }) {
  const t = (s: string) => tr(locale, s);
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");
  const [msg, setMsg] = useState("");
  if (state === "done") return <p className="mt-3 rounded-xl bg-emerald-50 p-3 text-sm">✓ {t("Sent — check your inbox. Your answers are saved in the link.")}</p>;
  if (!open) return <button type="button" className="mt-3 text-sm text-brand underline" onClick={() => setOpen(true)}>{t("Not ready? Email me this price")}</button>;
  return (
    <form className="mt-3 space-y-2 text-sm" onSubmit={async (e) => {
      e.preventDefault();
      setState("busy"); setMsg("");
      const clean = Object.fromEntries(Object.entries(answers).filter(([, v]) => v !== undefined));
      const r = await fetch("/api/quote/save", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, service_slug: slug, answers: clean, frequency, locale }) });
      const j = await r.json().catch(() => ({}));
      if (r.ok) setState("done"); else { setState("idle"); setMsg(t(j.error ?? "Try again")); }
    }}>
      <div className="flex gap-2">
        <input className="input" type="email" required placeholder={t("Email")} value={email} onChange={(e) => setEmail(e.target.value)} />
        <button className="btn-ghost" disabled={state === "busy"}>{t("Send")}</button>
      </div>
      <p className="text-xs text-ink-soft">{t("We’ll email the price and a reminder or two. Unsubscribe anytime.")}</p>
      {msg && <p className="text-rose-700">{msg}</p>}
    </form>
  );
}
