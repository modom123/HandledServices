/*
 * FILE    : apps/web/app/auth/callback/route.ts
 * PROJECT : Handled — AI-run home & business services
 * CREATED : 2026-10-01_1723 UTC
 * UPDATED : 2026-10-02_0006 UTC — also accepts token_hash links (one-click sign-in from our
 *           recruiting and reminder emails).
 * PURPOSE : Magic-link landing. Exchanges the code for a session, then routes the
 *           user to the right home: ops hub (staff), pro portal (pros) or account.
 * UPDATED : 2026-10-05_0434 UTC — OWNER_EMAILS: listed emails become admins when they sign in (bootstraps the first admin; the rest via Hub → Team).
 * UPDATED : 2026-10-06_0726 UTC — security: ?next= goes through safeNext() (no open redirect via "/\\evil.com" and similar).
 */
import { NextResponse } from "next/server";
import { serverClient } from "@/lib/supabase/server";
import { getViewer, isStaff } from "@/lib/auth";
import { safeNext } from "@/lib/safe-redirect";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") ?? "/auth/home";
  const tokenHash = url.searchParams.get("token_hash");
  if (code) await (await serverClient()).auth.exchangeCodeForSession(code);
  else if (tokenHash) {
    const { error } = await (await serverClient()).auth.verifyOtp({ token_hash: tokenHash, type: (url.searchParams.get("type") ?? "magiclink") as "magiclink" | "email" });
    if (error) return NextResponse.redirect(new URL(`/login?next=${encodeURIComponent(safeNext(next, url.origin))}&expired=1`, url.origin));
  }
  // owners (OWNER_EMAILS in Vercel) are admins from their first sign-in — no database step to get started
  const owners = (process.env.OWNER_EMAILS ?? "").split(/[,\s]+/).map((e) => e.trim().toLowerCase()).filter(Boolean);
  if (owners.length) {
    const me = await getViewer();
    if (me && owners.includes(me.email.toLowerCase()) && me.role !== "admin") {
      const { adminClient } = await import("@/lib/supabase/server");
      await adminClient().from("profiles").update({ role: "admin" }).eq("id", me.userId);
    }
  }
  let dest = safeNext(next, url.origin);
  if (dest === "/auth/home") {
    const v = await getViewer();
    dest = isStaff(v) ? "/hub" : v?.contractorId ? "/pro" : "/account";
  }
  return NextResponse.redirect(new URL(dest, url.origin));
}
