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
 * UPDATED : 2026-10-06_2305 UTC — POST from /auth/confirm (the "Sign in" button behind every emailed link, lib/signin). A failed
 *           code exchange or token now goes back to the sign-in page with a clear message instead of landing signed out.
 *           Visiting with a session already in place (code typed on the sign-in page) just routes to the right home.
 * UPDATED : 2026-10-07_0600 UTC — staff who sign in from the "Customer" choice (or a remembered one) land in the Hub, not
 *           the customer account; owner check moved to lib/auth (getViewer).
 */
import { NextResponse } from "next/server";
import { serverClient } from "@/lib/supabase/server";
import { getViewer, isStaff } from "@/lib/auth";
import { safeNext } from "@/lib/safe-redirect";

type OtpType = "magiclink" | "email";

async function finish(origin: string, nextRaw: string | null, verify: () => Promise<{ error: unknown } | null>, status: 302 | 303) {
  const next = safeNext(nextRaw ?? "/auth/home", origin);
  const r = await verify();
  if (r?.error) {
    // the link may have been used already (often by an email scanner) — if a session exists anyway, carry on
    if (!(await getViewer())) return NextResponse.redirect(new URL(`/login?next=${encodeURIComponent(next)}&expired=1`, origin), status);
  }
  const v = await getViewer();
  if (!v) return NextResponse.redirect(new URL(`/login?next=${encodeURIComponent(next)}`, origin), status);
  // owners (OWNER_EMAILS) are made admins inside getViewer. Staff go to the Hub unless they asked for a specific page:
  // the sign-in page's "Customer" choice (often remembered from an earlier visit) is not a reason to leave staff in /account.
  let dest = next;
  if (dest === "/auth/home" || (isStaff(v) && dest === "/account")) dest = isStaff(v) ? "/hub" : v.contractorId ? "/pro" : "/account";
  return NextResponse.redirect(new URL(dest, origin), status);
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  return finish(url.origin, url.searchParams.get("next"), async () => {
    if (code) return (await serverClient()).auth.exchangeCodeForSession(code);
    if (tokenHash) return (await serverClient()).auth.verifyOtp({ token_hash: tokenHash, type: (url.searchParams.get("type") === "email" ? "email" : "magiclink") as OtpType });
    return null;
  }, 302);
}

/** The "Sign in" button on /auth/confirm. */
export async function POST(req: Request) {
  const url = new URL(req.url);
  const f = await req.formData().catch(() => null);
  const tokenHash = String(f?.get("token_hash") ?? "");
  const type: OtpType = f?.get("type") === "email" ? "email" : "magiclink";
  return finish(url.origin, f ? String(f.get("next") ?? "") || null : null, async () => {
    if (!tokenHash) return { error: "missing token" };
    return (await serverClient()).auth.verifyOtp({ token_hash: tokenHash, type });
  }, 303);
}
