/*
 * FILE    : apps/web/app/api/indeed/apply/route.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-23_1100 UTC
 * PURPOSE : Indeed Apply → the pro recruiting pipeline. Indeed POSTs each application (JSON) to this postUrl when a job
 *           seeker applies on Indeed. The X-Indeed-Signature header (HMAC-SHA1 of the raw body with INDEED_API_SECRET,
 *           base64) is checked before anything is read. The candidate is added like a /pros application (lib/recruiting-
 *           intake.ts: dedupe, résumé to the private bucket, confirmation email) and then screened (onApplication).
 *           Responses: 200 saved (or already saved / already a pro), 400 bad payload, 401 bad signature, 503 not set up.
 *           Job → trades: put "trades=cleaning" (trade ids) in the job's jobMeta, or the job title is read ("House Cleaner").
 */
import { after } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import { parseIndeedApply } from "@handled/core";
import { addCandidate } from "@/lib/recruiting-intake";
import { onApplication } from "@/lib/recruiting";

function signed(raw: string, header: string | null, secret: string): boolean {
  if (!header) return false;
  const mac = createHmac("sha1", secret).update(raw, "utf8").digest();
  const given = header.trim();
  for (const expected of [mac.toString("base64"), mac.toString("hex")]) {
    const a = Buffer.from(expected), b = Buffer.from(given);
    if (a.length === b.length && timingSafeEqual(a, b)) return true;
  }
  return false;
}

export async function POST(req: Request) {
  const secret = process.env.INDEED_API_SECRET;
  if (!secret) return Response.json({ error: "Indeed Apply is not set up (INDEED_API_SECRET)" }, { status: 503 });
  const raw = await req.text();
  if (!signed(raw, req.headers.get("x-indeed-signature"), secret)) return Response.json({ error: "Invalid signature" }, { status: 401 });
  let body: unknown;
  try { body = JSON.parse(raw); } catch { return Response.json({ error: "Invalid JSON" }, { status: 400 }); }
  const parsed = parseIndeedApply(body);
  if (!parsed.ok) return Response.json({ error: parsed.error }, { status: 400 });
  const r = await addCandidate(parsed.candidate, { actor: "indeed", confirm: true });
  if (r.error) return Response.json({ error: "Couldn't save the application" }, { status: 500 }); // Indeed retries
  if (r.status === "added" && r.id) { const id = r.id; after(() => onApplication(id).catch((e) => console.error("[indeed]", e))); }
  return Response.json({ ok: true, status: r.status });
}
