/*
 * FILE    : apps/web/app/api/auth/email-code/route.ts
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-06_2300 UTC
 * PURPOSE : Sign-in step 1 for the website and the app: POST { email, next?, lang? } → Handled emails a sign-in code and a
 *           link that works on any device (lib/signin). Answers { ok: true } whether or not the email has an account
 *           (no account probing), plus codeLength (6–10, the project's setting). { fallback: true } = this server can't send it; the client asks Supabase instead.
 *           Rate-limited per IP and per email address.
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
  const limited = (await rateLimit(req, "signin")) ?? (await rateLimit(req, "signin", `email:${email}`));
  if (limited) return limited;
  const es = (b.data.lang ?? (await getLocale())) === "es";
  const r = await sendSignInEmail(email, b.data.next || "/auth/home", es, new URL(req.url).origin);
  return Response.json(r.status === "sent" ? { ok: true, codeLength: r.codeLength ?? 6 } : { fallback: true });
}
