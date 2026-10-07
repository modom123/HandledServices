/*
 * FILE    : apps/web/components/LoginForm.tsx
 * PROJECT : Handled — AI-run home & business services
 * CREATED : 2026-10-01_1723 UTC
 * PURPOSE : Passwordless sign-in: email a one-click link or a 6-digit code (Supabase OTP).
 * UPDATED : 2026-10-05_0434 UTC — "Who are you?" first (sign in or create an account): booking services, a business account,
 *           a pro, or the Handled team. Customers and businesses choose for themselves; pros must be approved (new ones
 *           are sent to apply) and team access is added by an admin (Hub → Team) — the choice only picks where you land,
 *           it never grants access. The last choice is remembered on this device. English / Spanish.
 * UPDATED : 2026-10-06_2100 UTC — sign-in never crashes on a Supabase failure; common errors explained in plain words.
 * UPDATED : 2026-10-06_2305 UTC — Handled sends the sign-in email itself (/api/auth/email-code → lib/signin): it always has the code,
 *           and its link works in any browser or phone. Supabase's own email is only the fallback. The code box takes 6–10
 *           digits (whatever the project sends), ignores spaces and dashes, fills from the keyboard's one-time-code
 *           suggestion; "Send a new code" (after 30s) and "Use a different email".
 */
"use client";

import { useEffect, useState } from "react";
import { browserClient } from "@/lib/supabase/browser";

type Who = "customer" | "business" | "pro" | "partner" | "team";
const DEST: Record<Who, string> = { customer: "/account", business: "/account/business", pro: "/pro", partner: "/partner", team: "/hub" };
const KEY = "handled_who";

/** Supabase's sign-in errors in plain words, with the fix (the raw message stays at the end for support). */
function friendly(raw: string, es: boolean): string {
  const m = raw.toLowerCase();
  const say = (en: string, sp: string) => `${es ? sp : en} (${raw})`;
  if (m.includes("rate limit")) return say("Too many sign-in emails right now. Wait a few minutes and try again.", "Demasiados correos de acceso. Espere unos minutos e intente de nuevo.");
  if (m.includes("not authorized") || m.includes("error sending")) return say("We couldn't send the sign-in email. Please try again shortly — our team has been notified.", "No pudimos enviar el correo de acceso. Intente de nuevo en un momento.");
  if (m.includes("invalid api key") || m.includes("invalid jwt") || m.includes("no api key")) return say("Sign-in is temporarily unavailable (server settings). Please try again later.", "El acceso no está disponible por ahora (configuración). Intente más tarde.");
  if (m.includes("signups not allowed") || m.includes("signup is disabled")) return say("New accounts are turned off right now.", "Las cuentas nuevas están desactivadas por ahora.");
  if (m.includes("expired") || (m.includes("invalid") && m.includes("otp")) || m.includes("token has expired")) return say("That code expired or is wrong — ask for a new one.", "Ese código venció o es incorrecto: pida uno nuevo.");
  if (m.includes("fetch") || m.includes("network")) return say("No connection to the sign-in service. Check your internet and try again.", "Sin conexión con el servicio de acceso. Revise su internet e intente de nuevo.");
  return raw;
}

export function LoginForm({ next, initialEmail = "", expired = false, es = false }: { next: string; initialEmail?: string; expired?: boolean; es?: boolean }) {
  const explicit = next !== "/auth/home";
  const [who, setWho] = useState<Who | null>(null);
  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [wait, setWait] = useState(0);
  const [len, setLen] = useState(6);
  const [backup, setBackup] = useState<string | null>(null); // why our own email couldn't go out (Supabase sent a backup) // digits in the code (the server says; Supabase projects send 6–10)
  useEffect(() => { if (!wait) return; const t = setTimeout(() => setWait((w) => Math.max(0, w - 1)), 1000); return () => clearTimeout(t); }, [wait]);
  const [msg, setMsg] = useState(expired ? (es ? "Ese enlace venció o ya se usó: escriba su correo para recibir un código nuevo." : "That sign-in link expired or was already used — enter your email for a fresh code.") : "");
  useEffect(() => { try { const w = localStorage.getItem(KEY) as Who | null; if (w && w in DEST && !explicit) setWho(w); } catch { /* private mode */ } }, [explicit]);
  const dest = explicit ? next : who ? DEST[who] : "/auth/home";

  async function sendLink(e?: React.FormEvent) {
    e?.preventDefault();
    try { if (who) localStorage.setItem(KEY, who); } catch { /* private mode */ }
    setBusy(true); setMsg("");
    try {
      // Handled's own email: code + a link that works on any device
      const r = await fetch("/api/auth/email-code", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, next: dest, lang: es ? "es" : "en" }) });
      const j = await r.json().catch(() => ({}));
      if (r.status === 429 || r.status === 400) { setBusy(false); return setMsg(String(j.error ?? (es ? "Intente de nuevo." : "Try again."))); }
      if (r.ok && j.codeLength) setLen(Number(j.codeLength));
      setBackup(r.ok && j.fallback ? String(j.reason ?? "unknown") : null);
      if (!r.ok || j.fallback) {
        const { error } = await browserClient().auth.signInWithOtp({ email, options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(dest)}` } });
        if (error) { setBusy(false); return setMsg(friendly(error.message, es)); }
      }
    } catch (err) { setBusy(false); return setMsg(friendly(err instanceof Error ? err.message : String(err), es)); }
    setBusy(false);
    setSent(true);
    setCode("");
    setWait(30);
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setMsg("");
    try {
      const { error } = await browserClient().auth.verifyOtp({ email: email.trim().toLowerCase(), token: code, type: "email" });
      if (error) { setBusy(false); return setMsg(friendly(error.message, es)); }
    } catch (err) { setBusy(false); return setMsg(friendly(err instanceof Error ? err.message : String(err), es)); }
    window.location.href = `/auth/callback?next=${encodeURIComponent(dest)}`;
  }

  const CHOICES: { id: Who; icon: string; t: string; d: string }[] = [
    { id: "customer", icon: "🏠", t: es ? "Reservo servicios" : "I book services", d: es ? "Su hogar: reservas, pagos, fotos, mensajes" : "For your home: bookings, payments, photos, messages" },
    { id: "business", icon: "🏢", t: es ? "Tengo una cuenta empresarial" : "I have a business account", d: es ? "Propiedades, reservas del equipo, facturas" : "Properties, team bookings, invoices" },
    { id: "pro", icon: "🧰", t: es ? "Soy profesional" : "I'm a pro", d: es ? "Ofertas, trabajos, pagos, recompensas" : "Offers, jobs, pay, rewards" },
    { id: "partner", icon: "🤝", t: es ? "Soy socio de referidos" : "I'm a referral partner", d: es ? "Su enlace, clientes referidos y comisiones" : "Your link, referred customers and commissions" },
    { id: "team", icon: "🛠️", t: es ? "Equipo de Handled" : "Handled team", d: es ? "Personal autorizado (Hub)" : "Authorized staff (Hub)" },
  ];

  return (
    <div className="card mx-auto max-w-md">
      <h1 className="text-xl font-bold">{es ? "Inicie sesión o cree su cuenta" : "Sign in or create your account"}</h1>
      <p className="mt-1 text-sm text-ink-soft">{es ? "Sin contraseña: le enviamos un código (y un enlace) a su correo." : "No password — we email you a code (and a one-tap link)."}</p>
      {!explicit && !sent && (
        <div className="mt-5">
          <div className="mb-2 text-sm font-semibold">{es ? "¿Quién es usted?" : "Who are you?"}</div>
          <div className="grid gap-2">
            {CHOICES.map((c) => (
              <button key={c.id} type="button" onClick={() => setWho(c.id)} className={`flex items-start gap-3 rounded-xl border p-3 text-left ${who === c.id ? "border-brand bg-brand-tint" : "border-line hover:border-brand"}`}>
                <span className="text-xl">{c.icon}</span><span><span className="block text-sm font-semibold">{c.t}</span><span className="block text-xs text-ink-soft">{c.d}</span></span>
              </button>
            ))}
          </div>
          {who === "pro" && <p className="mt-2 rounded-lg bg-paper p-2 text-xs">{es ? "¿Aún no es profesional de Handled? " : "Not a Handled pro yet? "}<a href="/pros#apply" className="font-semibold text-brand underline">{es ? "Postúlese aquí" : "Apply here"}</a>{es ? ": su cuenta de profesional se abre cuando lo aprobamos. Use el correo de su solicitud." : " — your pro account opens once you're approved. Use the email from your application."}</p>}
          {who === "business" && <p className="mt-2 rounded-lg bg-paper p-2 text-xs">{es ? "¿Aún no tiene cuenta empresarial? Inicie sesión y créela en dos minutos." : "No business account yet? Sign in and set one up in two minutes."}</p>}
          {who === "partner" && <p className="mt-2 rounded-lg bg-paper p-2 text-xs">{es ? "¿Aún no es socio? " : "Not a partner yet? "}<a href="/partners#join" className="font-semibold text-brand underline">{es ? "Únase aquí" : "Join here"}</a>{es ? ": use el mismo correo con el que se registró." : " — use the email you signed up with."}</p>}
          {who === "team" && <p className="mt-2 rounded-lg bg-paper p-2 text-xs">{es ? "Solo para personal: un administrador debe agregar su correo en Hub → Equipo." : "Staff only: an admin must add your email in Hub → Team first."}</p>}
        </div>
      )}
      {!sent ? (
        <form onSubmit={sendLink} className="mt-5 space-y-3">
          <input className="input" type="email" required placeholder={es ? "su@correo.com" : "you@email.com"} value={email} onChange={(e) => setEmail(e.target.value)} />
          <button className="btn-primary w-full" disabled={busy || (!explicit && !who)}>{busy ? (es ? "Enviando…" : "Sending…") : es ? "Enviarme un código" : "Email me a sign-in code"}</button>
          {!explicit && !who && <p className="text-center text-xs text-ink-soft">{es ? "Elija una opción arriba." : "Pick one above."}</p>}
        </form>
      ) : (
        <form onSubmit={verify} className="mt-5 space-y-3">
          <p className="text-sm">{es ? <>Enviamos un código a <b>{email}</b>. Escríbalo aquí, o toque el enlace del correo (funciona en cualquier teléfono o navegador).</> : <>We sent a code to <b>{email}</b>. Type it here, or tap the link in the email (it works on any phone or browser).</>}</p>
          <input className="input text-center text-lg tracking-[0.4em]" inputMode="numeric" autoComplete="one-time-code" autoFocus placeholder={"•".repeat(len)} maxLength={12}
            value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 10))} />
          <button className="btn-primary w-full" disabled={busy || code.length < Math.min(len, 6)}>{busy ? (es ? "Verificando…" : "Checking…") : es ? "Entrar" : "Sign in"}</button>
          {backup ? (
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900">
              {es ? "Nuestro correo de acceso no se pudo enviar, así que enviamos uno de respaldo. Si no trae código, abra su enlace en este mismo navegador." : "Our sign-in email couldn't be sent, so a backup email went out instead. If it has no code, open its link in this same browser on this device."}
              <div className="mt-1 font-mono text-[11px] opacity-80">{backup}</div>
              <a href="/auth/check" className="mt-1 inline-block underline">{es ? "Ver qué falta" : "See what's not set up"}</a>
            </div>
          ) : <p className="text-xs text-ink-soft">{es ? "¿No llegó? Revise spam o promociones." : "Not there? Check spam or promotions."}</p>}
          <div className="flex flex-wrap justify-between gap-2 text-sm">
            <button type="button" className="text-brand underline disabled:text-ink-soft disabled:no-underline" disabled={busy || wait > 0} onClick={() => sendLink()}>{wait > 0 ? (es ? `Enviar otro código (${wait}s)` : `Send a new code (${wait}s)`) : es ? "Enviar otro código" : "Send a new code"}</button>
            <button type="button" className="text-brand underline" onClick={() => { setSent(false); setCode(""); setMsg(""); }}>{es ? "Usar otro correo" : "Use a different email"}</button>
          </div>
        </form>
      )}
      {msg && <p className="mt-3 text-sm text-rose-700">{msg}</p>}
      <p className="mt-4 text-xs text-ink-soft">{es ? "Si es su primera vez, creamos su cuenta con este correo. Las reservas que ya hizo con él aparecerán en su cuenta." : "First time? We create your account with this email. Bookings you already made with it show up in your account."}</p>
    </div>
  );
}
