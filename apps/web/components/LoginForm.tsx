/*
 * FILE    : apps/web/components/LoginForm.tsx
 * PROJECT : Handled — AI-run home & business services
 * CREATED : 2026-10-01_1723 UTC
 * PURPOSE : Passwordless sign-in: email a one-click link or a 6-digit code (Supabase OTP).
 * UPDATED : 2026-10-05_0434 UTC — "Who are you?" first (sign in or create an account): booking services, a business account,
 *           a pro, or the Handled team. Customers and businesses choose for themselves; pros must be approved (new ones
 *           are sent to apply) and team access is added by an admin (Hub → Team) — the choice only picks where you land,
 *           it never grants access. The last choice is remembered on this device. English / Spanish.
 */
"use client";

import { useEffect, useState } from "react";
import { browserClient } from "@/lib/supabase/browser";

type Who = "customer" | "business" | "pro" | "team";
const DEST: Record<Who, string> = { customer: "/account", business: "/account/business", pro: "/pro", team: "/hub" };
const KEY = "handled_who";

export function LoginForm({ next, initialEmail = "", expired = false, es = false }: { next: string; initialEmail?: string; expired?: boolean; es?: boolean }) {
  const explicit = next !== "/auth/home";
  const [who, setWho] = useState<Who | null>(null);
  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [msg, setMsg] = useState(expired ? (es ? "Ese enlace venció o ya se usó: escriba su correo para recibir un código nuevo." : "That sign-in link expired or was already used — enter your email for a fresh code.") : "");
  useEffect(() => { try { const w = localStorage.getItem(KEY) as Who | null; if (w && w in DEST && !explicit) setWho(w); } catch { /* private mode */ } }, [explicit]);
  const dest = explicit ? next : who ? DEST[who] : "/auth/home";

  async function sendLink(e: React.FormEvent) {
    e.preventDefault();
    try { if (who) localStorage.setItem(KEY, who); } catch { /* private mode */ }
    const { error } = await browserClient().auth.signInWithOtp({ email, options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(dest)}` } });
    if (error) return setMsg(error.message);
    setSent(true);
    setMsg("");
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await browserClient().auth.verifyOtp({ email, token: code, type: "email" });
    if (error) return setMsg(error.message);
    window.location.href = `/auth/callback?next=${encodeURIComponent(dest)}`;
  }

  const CHOICES: { id: Who; icon: string; t: string; d: string }[] = [
    { id: "customer", icon: "🏠", t: es ? "Reservo servicios" : "I book services", d: es ? "Su hogar: reservas, pagos, fotos, mensajes" : "For your home: bookings, payments, photos, messages" },
    { id: "business", icon: "🏢", t: es ? "Tengo una cuenta empresarial" : "I have a business account", d: es ? "Propiedades, reservas del equipo, facturas" : "Properties, team bookings, invoices" },
    { id: "pro", icon: "🧰", t: es ? "Soy profesional" : "I'm a pro", d: es ? "Ofertas, trabajos, pagos, recompensas" : "Offers, jobs, pay, rewards" },
    { id: "team", icon: "🛠️", t: es ? "Equipo de Handled" : "Handled team", d: es ? "Personal autorizado (Hub)" : "Authorized staff (Hub)" },
  ];

  return (
    <div className="card mx-auto max-w-md">
      <h1 className="text-xl font-bold">{es ? "Inicie sesión o cree su cuenta" : "Sign in or create your account"}</h1>
      <p className="mt-1 text-sm text-ink-soft">{es ? "Sin contraseña: le enviamos un enlace o un código a su correo." : "No password — we email you a link or a code."}</p>
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
          {who === "team" && <p className="mt-2 rounded-lg bg-paper p-2 text-xs">{es ? "Solo para personal: un administrador debe agregar su correo en Hub → Equipo." : "Staff only: an admin must add your email in Hub → Team first."}</p>}
        </div>
      )}
      {!sent ? (
        <form onSubmit={sendLink} className="mt-5 space-y-3">
          <input className="input" type="email" required placeholder={es ? "su@correo.com" : "you@email.com"} value={email} onChange={(e) => setEmail(e.target.value)} />
          <button className="btn-primary w-full" disabled={!explicit && !who}>{es ? "Enviarme el enlace" : "Email me a sign-in link"}</button>
          {!explicit && !who && <p className="text-center text-xs text-ink-soft">{es ? "Elija una opción arriba." : "Pick one above."}</p>}
        </form>
      ) : (
        <form onSubmit={verify} className="mt-5 space-y-3">
          <p className="text-sm">{es ? <>Revise <b>{email}</b>. Haga clic en el enlace o escriba el código de 6 dígitos:</> : <>Check <b>{email}</b>. Click the link, or enter the 6-digit code:</>}</p>
          <input className="input tracking-[0.4em]" inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value)} />
          <button className="btn-primary w-full" disabled={code.length < 6}>{es ? "Verificar" : "Verify"}</button>
        </form>
      )}
      {msg && <p className="mt-3 text-sm text-rose-700">{msg}</p>}
      <p className="mt-4 text-xs text-ink-soft">{es ? "Si es su primera vez, creamos su cuenta con este correo. Las reservas que ya hizo con él aparecerán en su cuenta." : "First time? We create your account with this email. Bookings you already made with it show up in your account."}</p>
    </div>
  );
}
