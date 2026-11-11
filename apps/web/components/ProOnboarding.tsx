/*
 * FILE    : apps/web/components/ProOnboarding.tsx
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-01_2000 UTC
 * PURPOSE : Pro self-onboarding forms — W-9, insurance, license, agreement, payout.
 * UPDATED : 2026-10-02_1440 UTC — Spanish (pro onboarding & recruiting)
 * UPDATED : 2026-11-04_2345 UTC — uploads that save every time:
 *             • the file goes straight from the browser to storage (a one-time link from /api/pro/onboarding/upload);
 *               the form then saves the step with file_path. Before, files rode along with the form, and Vercel
 *               refuses anything over 4.5 MB — most phone photos and scanned PDFs — so they never arrived.
 *             • photos (profile photo, photos of documents) are resized in the browser first: faster, and far under
 *               the limits; PDFs and Word files go as they are (up to 10 MB).
 *             • a clear message for every outcome (saved with the file name, the server's reason, or no connection),
 *               and "Saving…" can no longer get stuck.
 */
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { t as tr, type Locale } from "@handled/core";
import { browserClient } from "@/lib/supabase/browser";
import { shrinkPhoto } from "@/lib/upload-photos";

function useStep(locale: Locale) {
  const router = useRouter();
  const [msg, setMsg] = useState("");
  const [ok, setOk] = useState(false);
  const [busy, setBusy] = useState(false);
  const say = (text: string, good = false) => { setMsg(text); setOk(good); };

  async function submit(step: string, form: HTMLFormElement) {
    setBusy(true); say("");
    try {
      const fd = new FormData(form);
      fd.set("step", step);
      const input = form.querySelector<HTMLInputElement>('input[type="file"][name="file"]');
      const picked = input?.files?.[0];
      fd.delete("file");
      if (picked) {
        // profile photos: 1600px is plenty; photos of documents keep more detail so they stay readable
        const file = await shrinkPhoto(picked, step === "photo" ? 1600 : 2400);
        say(tr(locale, "Uploading…"));
        const t = await fetch("/api/pro/onboarding/upload", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ step, name: file.name, type: file.type, size: file.size }) });
        const ticket = await t.json().catch(() => ({}));
        if (!t.ok) return say(tr(locale, ticket.error ?? "Upload failed"));
        const { error } = await browserClient().storage.from("pro-docs").uploadToSignedUrl(String(ticket.path), String(ticket.token), file, { contentType: String(ticket.type || file.type) });
        if (error) return say(`${tr(locale, "Upload failed")}: ${error.message}`);
        fd.set("file_path", String(ticket.path));
      }
      const res = await fetch("/api/pro/onboarding", { method: "POST", body: fd });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) return say(j.error ? tr(locale, j.error) : `${tr(locale, "Couldn't save")} (${res.status})`);
      say(`${tr(locale, "Saved ✓")}${picked ? ` · ${picked.name}` : ""}`, true);
      if (input) input.value = "";
      router.refresh();
    } catch {
      say(tr(locale, "Couldn't reach Handled — check your connection and try again"));
    } finally {
      setBusy(false);
    }
  }
  return { msg, ok, busy, submit };
}

export function StepForm({ step, children, cta, locale = "en" }: { step: string; children: React.ReactNode; cta: string; locale?: Locale }) {
  const { msg, ok, busy, submit } = useStep(locale);
  return (
    <form className="mt-3 space-y-3" onSubmit={(e) => { e.preventDefault(); submit(step, e.currentTarget); }}>
      {children}
      <div className="flex flex-wrap items-center gap-3"><button className="btn-primary" disabled={busy}>{busy ? tr(locale, "Saving…") : cta}</button>{msg && <span role="status" className={`text-sm ${ok ? "text-brand-dark" : busy ? "text-ink-soft" : "text-red-700"}`}>{msg}</span>}</div>
    </form>
  );
}

export const Field = ({ label, ...p }: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) => (
  <div><label className="label">{label}</label><input className="input" {...p} /></div>
);
