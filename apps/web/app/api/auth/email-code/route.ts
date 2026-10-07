/*
 * FILE    : apps/web/app/api/auth/email-code/route.ts
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-06_2300 UTC
 * PURPOSE : Sign-in step 1 for the website and the app: POST { email, next?, lang? } → Handled emails a sign-in code and a
 *           link that works on any device (lib/signin). Answers { ok: true } whether or not the email has an account
 *           (no account probing), plus codeLength (6–10, the project's setting). { fallback: true } = this server can't send it; the client asks Supabase instead.
 *           Rate-limited: 40 an hour per connection, 8 per 15 minutes per email (owners exempt). { wait: N } = a code
 *           went out less than a minute ago; the client shows the code box and a countdown instead of an error.
 * UPDATED : 2026-10-07_1640 UTC — owner emails have their own limit (30/hour) instead of none.
 */
import { z } from "zod";
import { rateLimit } from "@/lib/ratelimit";
import { normalizeEmail, sendSignInEmail } from "@/lib/signin";
import { getLocale } from "@/lib/locale";

const Body = z.object({ email: z.string().trim().email().max(254), next: z.string().max(500).optional(), lang: z.enum(["en", "es"]).optional() });

export async function POST(req: Request) {
  const b = Body.safeParse(await req.json().catch(() => null));
  if (!b.success) return Response.json({ error: "Enter a valid email" }, { status: 400 });
  const email = normalizeEmail(b.data.email);
  const es = (b.data.lang ?? (await getLocale())) === "es";
  // owners are never locked out of their own site
  const owner = (process.env.OWNER_EMAILS ?? "").toLowerCase().split(/[,\s]+/).includes(email);
  // owners skip the shared limits (never locked out by an office's traffic) but have their own, so nobody can flood their inbox
  const limited = owner ? await rateLimit(req, "signin_owner", `owner:${email}`) : (await rateLimit(req, "signin_ip")) || (await rateLimit(req, "signin_email", `email:${email}`));
  if (limited)
    return Response.json({ error: es ? "Pidió varios códigos en pocos minutos. Use el código más reciente de su correo, o intente de nuevo en 15 minutos." : "You've asked for several codes in a few minutes. Use the newest code in your email, or try again in 15 minutes.", limited: true }, { status: 429, headers: { "Retry-After": "900" } });
  const r = await sendSignInEmail(email, b.data.next || "/auth/home", es, new URL(req.url).origin);
  if (r.status === "wait") return Response.json({ wait: r.wait ?? 60 });
  return Response.json(r.status === "sent" ? { ok: true, codeLength: r.codeLength ?? 6 } : { fallback: true, reason: r.reason ?? null });
}
