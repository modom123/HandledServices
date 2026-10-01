/*
 * FILE    : apps/web/app/api/me/push-token/route.ts
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-01_2043 UTC
 * PURPOSE : The mobile app registers (POST) or removes (DELETE, on sign-out) this phone's
 *           Expo push token for the signed-in user.
 */
import { z } from "zod";
import { deny, getViewer } from "@/lib/auth";
import { adminClient } from "@/lib/supabase/server";

const Body = z.object({ token: z.string().regex(/^(Expo|Exponent)PushToken\[.+\]$/), platform: z.enum(["ios", "android", "web"]).optional() });

export async function POST(req: Request) {
  const v = await getViewer(req);
  if (!v) return deny(401, "Sign in first");
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return deny(400, "Invalid push token");
  // a phone belongs to whoever signed in last on it
  const { error } = await adminClient().from("push_tokens").upsert({ profile_id: v.userId, token: parsed.data.token, platform: parsed.data.platform ?? null, last_seen_at: new Date().toISOString() }, { onConflict: "token" });
  return error ? Response.json({ error: error.message }, { status: 500 }) : Response.json({ ok: true });
}

export async function DELETE(req: Request) {
  const v = await getViewer(req);
  if (!v) return deny(401, "Sign in first");
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (parsed.success) await adminClient().from("push_tokens").delete().eq("token", parsed.data.token).eq("profile_id", v.userId);
  return Response.json({ ok: true });
}
