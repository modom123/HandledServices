/*
 * FILE    : apps/web/app/api/talent/request/route.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-05_2034 UTC
 * PURPOSE : Public intake for Handled Talent (/talent): a company asks us to fill a role. Creates the client and a search
 *           in "New request"; accepting the client agreement here is a click-to-sign (version, time, IP recorded).
 */
import { z } from "zod";
import { deny } from "@/lib/auth";
import { clientIp, rateLimit } from "@/lib/ratelimit";
import { requestSearch } from "@/lib/talent";

const n = z.number().min(0).max(10_000_000).nullable();
const Body = z.object({
  company: z.string().trim().min(2).max(160), contact_name: z.string().trim().min(2).max(120), email: z.string().trim().email(), phone: z.string().trim().max(30).nullable(),
  website: z.string().trim().max(200).nullable(), city: z.string().trim().max(80).nullable(),
  title: z.string().trim().min(2).max(160), location: z.string().trim().max(160).nullable(), workplace: z.enum(["onsite", "hybrid", "remote"]),
  salary_min: n, salary_max: n, openings: z.number().int().min(1).max(100), description: z.string().trim().max(8000).nullable(), must_haves: z.string().trim().max(4000).nullable(),
  type: z.enum(["contingency", "retained"]), agree: z.boolean(), website_url_hp: z.string().max(0).optional(),
});

export async function POST(req: Request) {
  const limited = await rateLimit(req, "form");
  if (limited) return limited;
  const b = Body.safeParse(await req.json().catch(() => null));
  if (!b.success) return deny(400, "Check the form");
  if (!b.data.agree) return deny(400, "Please accept the client agreement");
  const { website_url_hp: _hp, ...d } = b.data;
  const r = await requestSearch({ ...d, ip: clientIp(req) });
  return Response.json(r, { status: r.ok ? 200 : 400 });
}
