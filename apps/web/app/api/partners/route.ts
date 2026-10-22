/*
 * FILE    : apps/web/app/api/partners/route.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-07_0120 UTC
 * PURPOSE : Public sign-up for the Referral Partner Program (/partners). POST { name, email, phone?, company?, kind, how?, agree }
 *           → partner code + link, welcome email with a sign-in link to the partner page. Rate-limited.
 * UPDATED : 2026-10-22_0530 UTC — src (where they came from, e.g. the flyer QR) and by (a personal flyer's partner code:
 *           they're credited in the partner record and emailed when someone joins).
 */
import { z } from "zod";
import { BRAND, PARTNER_KINDS, cleanPartnerCode } from "@handled/core";
import { adminClient } from "@/lib/supabase/server";
import { sendEmail, siteUrl } from "@/lib/notify";
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
  src: z.string().regex(/^[a-z0-9_-]{1,30}$/).optional(),   // where they came from (flyer QR, etc.)
  by: z.string().max(20).optional(),                       // a personal flyer: the partner who handed it out
});

export async function POST(req: Request) {
  const limited = await rateLimit(req, "form");
  if (limited) return limited;
  const b = Body.safeParse(await req.json().catch(() => null));
  if (!b.success) return Response.json({ error: "Fill in your name and email, and agree to the partner terms." }, { status: 400 });
  try {
    const { src, by, ...form } = b.data;
    // recruited from a personal flyer: credit the partner who handed it out (never yourself)
    const code = cleanPartnerCode(by);
    const { data: recruiter } = code ? await adminClient().from("referral_partners").select("id, name, email, status").eq("code", code).maybeSingle() : { data: null };
    const tag = [src && `came from: ${src}`, recruiter && recruiter.email !== form.email.trim().toLowerCase() ? `recruited by ${recruiter.name} (${code})` : null].filter(Boolean).join(" · ");
    const { partner, existing } = await signUp({ ...form, how: [form.how, tag && `[${tag}]`].filter(Boolean).join(" ") || null, kind: form.kind as keyof typeof PARTNER_KINDS, ip: clientIp(req) });
    if (!existing && recruiter && recruiter.status === "active" && recruiter.email !== partner.email)
      await sendEmail(recruiter.email, `${partner.name} joined from your flyer`, `Hi ${recruiter.name.split(" ")[0]},\n\n${partner.name} just joined the ${BRAND.name} network from the flyer you shared. Thanks for growing the network.\n\nYour partner page: ${siteUrl()}/partner\n\n— ${BRAND.name}`).catch(() => {});
    // an existing partner gets the same answer without their code (no account probing); their welcome email has it
    return Response.json(existing ? { ok: true, existing: true } : { ok: true, code: partner.code, link: partnerLink(partner.code) });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Couldn't sign you up" }, { status: 500 });
  }
}
