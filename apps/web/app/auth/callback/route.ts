/*
 * FILE    : apps/web/app/auth/callback/route.ts
 * PROJECT : Handled — AI-run home & business services
 * CREATED : 2026-10-01_1723 UTC
 * PURPOSE : Magic-link landing. Exchanges the code for a session, then routes the
 *           user to the right home: ops hub (staff), pro portal (pros) or account.
 */
import { NextResponse } from "next/server";
import { serverClient } from "@/lib/supabase/server";
import { getViewer, isStaff } from "@/lib/auth";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") ?? "/auth/home";
  if (code) await (await serverClient()).auth.exchangeCodeForSession(code);
  let dest = next.startsWith("/") && !next.startsWith("//") ? next : "/auth/home";
  if (dest === "/auth/home") {
    const v = await getViewer();
    dest = isStaff(v) ? "/hub" : v?.contractorId ? "/pro" : "/account";
  }
  return NextResponse.redirect(new URL(dest, url.origin));
}
