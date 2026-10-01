/*
 * FILE    : apps/web/components/LoginForm.tsx
 * PROJECT : Handled — AI-run home & business services
 * CREATED : 2026-10-01_1723 UTC
 * PURPOSE : Passwordless sign-in (magic link or 6-digit code) for customers, pros and staff.
 */
"use client";

import { useState } from "react";
import { browserClient } from "@/lib/supabase/browser";

export function LoginForm({ next }: { next: string }) {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [msg, setMsg] = useState("");

  async function sendLink(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await browserClient().auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
    });
    if (error) return setMsg(error.message);
    setSent(true);
    setMsg("");
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await browserClient().auth.verifyOtp({ email, token: code, type: "email" });
    if (error) return setMsg(error.message);
    window.location.href = `/auth/callback?next=${encodeURIComponent(next)}`;
  }

  return (
    <div className="card mx-auto max-w-sm">
      <h1 className="text-xl font-bold">Sign in</h1>
      <p className="mt-1 text-sm text-ink-soft">Customers, pros and staff — no password needed.</p>
      {!sent ? (
        <form onSubmit={sendLink} className="mt-5 space-y-3">
          <input className="input" type="email" required placeholder="you@email.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          <button className="btn-primary w-full">Email me a sign-in link</button>
        </form>
      ) : (
        <form onSubmit={verify} className="mt-5 space-y-3">
          <p className="text-sm">Check <b>{email}</b>. Click the link, or enter the 6-digit code:</p>
          <input className="input tracking-[0.4em]" inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value)} />
          <button className="btn-primary w-full" disabled={code.length < 6}>Verify</button>
        </form>
      )}
      {msg && <p className="mt-3 text-sm text-rose-700">{msg}</p>}
    </div>
  );
}
