/*
 * FILE    : apps/web/lib/signin.ts
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-06_2300 UTC
 * PURPOSE : Sign-in that works for everyone (customers, businesses, pros, staff) on any device.
 *           Supabase's own magic link only works in the browser that asked for it (PKCE: the secret is kept there),
 *           so opening it in the Gmail/Outlook app or on a phone failed, and its default email has no code. Instead the
 *           server makes the login itself (auth.admin.generateLink) and Handled sends ONE email with both:
 *             • the code (type it on the sign-in page or in the app), and
 *             • a link to /auth/confirm → "Finish signing in" button. The link carries a token hash that works in any
 *               browser, and the extra tap stops email security scanners from using the one-time link up first.
 *           New emails get an account created on the spot (confirmed — they proved the address by receiving the code).
 *           When the server can't do this (no service role key or no way to send email), callers fall back to
 *           Supabase's own email.
 */
import "server-only";
import { BRAND } from "@handled/core";
import { adminClient } from "./supabase/server";
import { supabaseConfigured } from "./supabase/env";
import { emailConfigured, sendEmail, siteUrl } from "./notify";
import { safeNext } from "./safe-redirect";

export const normalizeEmail = (e: string) => e.trim().toLowerCase();

type Login = { code: string | null; hash: string };

/** A one-time login for this email (creating the account if it's new). null if the auth admin API isn't available. */
async function makeLogin(email: string): Promise<Login | null> {
  if (!supabaseConfigured || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  const db = adminClient();
  const gen = async () => {
    const { data, error } = await db.auth.admin.generateLink({ type: "magiclink", email });
    const hash = data?.properties?.hashed_token;
    return !error && hash ? { code: data.properties.email_otp ?? null, hash } : null;
  };
  try {
    const first = await gen();
    if (first) return first;
    // new email → create the account, then try again
    await db.auth.admin.createUser({ email, email_confirm: true }).catch(() => null);
    return await gen();
  } catch (e) {
    console.error("[signin] generateLink failed", e instanceof Error ? e.message : e);
    return null;
  }
}

/** The link that lands on the "Finish signing in" page (works in any browser, survives link scanners). */
export const confirmUrl = (hash: string, next: string) =>
  `${siteUrl()}/auth/confirm?token_hash=${encodeURIComponent(hash)}&type=magiclink&next=${encodeURIComponent(safeNext(next, siteUrl()))}`;

/**
 * Email a sign-in code + link. Returns "sent" (with the code's length — Supabase projects send 6 to 10 digits), or
 * "fallback" when the caller should use Supabase's own email (no service role key, no email provider, or the send failed).
 */
export async function sendSignInEmail(rawEmail: string, next: string, es = false): Promise<{ status: "sent" | "fallback"; codeLength?: number }> {
  const email = normalizeEmail(rawEmail);
  if (!emailConfigured()) return { status: "fallback" };
  const login = await makeLogin(email);
  if (!login) return { status: "fallback" };
  const link = confirmUrl(login.hash, next);
  const code = login.code;
  const subject = es
    ? (code ? `Su código de ${BRAND.name}: ${code}` : `Su enlace para entrar a ${BRAND.name}`)
    : (code ? `Your ${BRAND.name} sign-in code: ${code}` : `Your ${BRAND.name} sign-in link`);
  const text = es
    ? `${code ? `Su código para entrar: ${code}\n\nEscríbalo en la página de acceso o en la app.\n\n` : ""}O toque este enlace para entrar (funciona en cualquier navegador o teléfono):\n${link}\n\nEl código y el enlace vencen en 1 hora y sirven una sola vez. Si usted no lo pidió, ignore este correo.\n\n— ${BRAND.name}`
    : `${code ? `Your sign-in code: ${code}\n\nType it on the sign-in page or in the app.\n\n` : ""}Or tap this link to sign in (works in any browser or phone):\n${link}\n\nThe code and link expire in 1 hour and work once. If you didn't ask for this, ignore this email.\n\n— ${BRAND.name}`;
  return (await sendEmail(email, subject, text)) ? { status: "sent", codeLength: code?.length } : { status: "fallback" };
}

/** A one-click sign-in link to put in our own emails (team invites, pro onboarding). Falls back to the login page. */
export async function signInLink(rawEmail: string, next: string): Promise<string> {
  const email = normalizeEmail(rawEmail);
  const login = await makeLogin(email);
  if (login) return confirmUrl(login.hash, next);
  return `${siteUrl()}/login?next=${encodeURIComponent(next)}&email=${encodeURIComponent(email)}`;
}
