/*
 * FILE    : apps/web/components/CareersApply.tsx
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-27_1700 UTC
 * PURPOSE : The apply form on /careers/[id] (team and client roles) → api/careers/apply. Keeps where they came from
 *           (utm_source, e.g. indeed) as the candidate's source.
 */
"use client";

import { useState } from "react";

export function CareersApply({ searchId, title, source }: { searchId: string; title: string; source: string }) {
  const [f, setF] = useState({ full_name: "", email: "", phone: "", location: "", linkedin: "", summary: "" });
  const [state, setState] = useState<{ busy?: boolean; done?: boolean; error?: string }>({});
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });
  if (state.done) return <div className="card"><div className="text-3xl">✅</div><h2 className="mt-2 text-xl font-bold">Application sent</h2><p className="mt-2 text-ink-soft">Thanks for applying for {title}. Check your email for a confirmation. A recruiter reviews every application, usually within two business days.</p></div>;
  return (
    <form className="card space-y-3 lg:sticky lg:top-24" onSubmit={async (e) => {
      e.preventDefault(); setState({ busy: true });
      const r = await fetch("/api/careers/apply", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ search_id: searchId, ...f, source: source || undefined }) });
      const j = (await r.json().catch(() => ({}))) as { error?: string };
      setState(r.ok ? { done: true } : { error: j.error ?? "Couldn't send — please try again" });
    }}>
      <h2 className="text-xl font-bold">Apply</h2>
      <label className="block"><span className="label">Full name *</span><input className="input" required value={f.full_name} onChange={set("full_name")} autoComplete="name" /></label>
      <label className="block"><span className="label">Email *</span><input className="input" type="email" required value={f.email} onChange={set("email")} autoComplete="email" /></label>
      <div className="grid grid-cols-2 gap-3">
        <label className="block"><span className="label">Phone</span><input className="input" inputMode="tel" value={f.phone} onChange={set("phone")} autoComplete="tel" /></label>
        <label className="block"><span className="label">City</span><input className="input" value={f.location} onChange={set("location")} /></label>
      </div>
      <label className="block"><span className="label">LinkedIn or résumé link</span><input className="input" value={f.linkedin} onChange={set("linkedin")} placeholder="https://" /></label>
      <label className="block"><span className="label">Your experience for this role *</span><textarea className="input min-h-32" required minLength={20} value={f.summary} onChange={set("summary")} placeholder="Where you've worked, what you did, and why this role fits you" /></label>
      {state.error && <p className="text-sm text-rose-700">{state.error}</p>}
      <button className="btn-primary w-full justify-center" disabled={state.busy}>{state.busy ? "Sending…" : "Send application"}</button>
    </form>
  );
}
