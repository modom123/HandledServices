/*
 * FILE    : apps/web/app/api/pro/pin/route.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-11-13_0030 UTC
 * PURPOSE : The Pro PIN (lib/pro-pin.ts) — the extra lock on accepted jobs' addresses and customer details.
 *             GET                              → { enabled, set, unlocked, lockedUntil }
 *             POST { action: "set", pin, current?, reset? }  create or change it (unlocks this device)
 *             POST { action: "unlock", pin }   unlock this device for 12 hours
 *             POST { action: "forgot" }        email a 30-minute reset link
 *           Web: an httpOnly cookie. App: the returned token, kept in secure storage, sent as x-pro-unlock.
 *           Rate limited per pro on top of the 5-try lockout.
 */
import { z } from "zod";
import { deny, getViewer } from "@/lib/auth";
import { rateLimit } from "@/lib/ratelimit";
import { pinStatus, pinUnlocked, sendPinReset, setPin, unlockWithPin } from "@/lib/pro-pin";

const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("set"), pin: z.string().max(6), current: z.string().max(6).optional(), reset: z.string().max(200).optional() }),
  z.object({ action: z.literal("unlock"), pin: z.string().max(6) }),
  z.object({ action: z.literal("forgot") }),
]);

export async function GET(req: Request) {
  const v = await getViewer(req);
  if (!v?.contractorId) return deny(403, "Pro account required");
  const st = await pinStatus(v.contractorId);
  return Response.json({ ...st, unlocked: await pinUnlocked(v.contractorId, req) }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: Request) {
  const v = await getViewer(req);
  if (!v?.contractorId) return deny(403, "Pro account required");
  const limited = await rateLimit(req, "signin_email", `pin:${v.contractorId}`);
  if (limited) return limited;
  const b = Body.safeParse(await req.json().catch(() => null));
  if (!b.success) return deny(400, "Check the request");
  if (b.data.action === "forgot") {
    const r = await sendPinReset(v.contractorId);
    return Response.json(r, { status: r.ok ? 200 : 503 });
  }
  const r = b.data.action === "set"
    ? await setPin(v.contractorId, b.data.pin, { current: b.data.current ?? null, resetToken: b.data.reset ?? null })
    : await unlockWithPin(v.contractorId, b.data.pin);
  if (!r.ok) return Response.json(r, { status: "lockedUntil" in r && r.lockedUntil ? 423 : 400 });
  return new Response(JSON.stringify({ ok: true, token: r.token }), { headers: { "Content-Type": "application/json", "Set-Cookie": r.cookie, "Cache-Control": "no-store" } });
}
