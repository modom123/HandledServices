/*
 * FILE    : apps/web/app/api/partners/route.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-07_0120 UTC
 * PURPOSE : Public sign-up for the Referral Partner Program (/partners). POST { name, email, phone?, company?, kind, how?, agree }
 *           → partner code + link, welcome email with a sign-in link to the partner page. Rate-limited.
 * UPDATED : 2026-11-17_2100 UTC — signing up e-signs the Referral Partner Agreement (recorded with name, time, IP and the exact text).
 * UPDATED : 2026-11-18_0105 UTC — leader? (a Sales Force leader's code from their recruit link) puts the new rep on that team.
 */
import { z } from "zod";
import { PARTNER_KINDS } from "@handled/core";
import { clientIp, rateLimit } from "@/lib/ratelimit";
import { partnerLink, signUp } from "@/lib/partners";

const Body = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(254),
  phone: z.string().trim().max(30).optional().nullable(),
  company: z.string().trim().max(160).optional().nullable(),
  kind: z.string().refine((k) => k in PARTNER_KINDS),
  how: z.string().trim().max(1000).optional().nullable(),
  agree: z.literal(true),
  /** a Sales Force leader's code (their recruit link): the new rep joins that team */
  leader: z.string().trim().max(20).optional().nullable(),
});

export async function POST(req: Request) {
  const limited = await rateLimit(req, "form");
  if (limited) return limited;
  const b = Body.safeParse(await req.json().catch(() => null));
  if (!b.success) return Response.json({ error: "Fill in your name and email, and sign the Referral Partner Agreement." }, { status: 400 });
  try {
    const { partner, existing } = await signUp({ ...b.data, kind: b.data.kind as keyof typeof PARTNER_KINDS, ip: clientIp(req), userAgent: req.headers.get("user-agent") });
    // an existing partner gets the same answer without their code (no account probing); their welcome email has it
    return Response.json(existing ? { ok: true, existing: true } : { ok: true, code: partner.code, link: partnerLink(partner.code) });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Couldn't sign you up" }, { status: 500 });
  }
}
