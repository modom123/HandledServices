/*
 * FILE    : apps/web/app/api/xero/connect/route.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-06_2210 UTC
 * PURPOSE : Hub → Accounting → "Connect Xero" (admins only). Sends the admin to Xero to sign in and pick the
 *           organisation; a random state in an httpOnly cookie is checked on the way back (CSRF).
 * UPDATED : 2026-10-28_2210 UTC — also asks for read-only report access (profit and loss); ?basic=1 connects without it.
 * UPDATED : 2026-11-05_1600 UTC — ?mode=classic for Xero apps created before 2 March 2026 (broad permissions).
 */
import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { getViewer } from "@/lib/auth";
import { authorizeUrl, xeroConfigured } from "@/lib/xero";
import { siteUrl } from "@/lib/notify";

export async function GET(req: Request) {
  const v = await getViewer(req);
  if (v?.role !== "admin") return NextResponse.redirect(`${siteUrl()}/hub/accounting?xero=admin_only`);
  if (!xeroConfigured()) return NextResponse.redirect(`${siteUrl()}/hub/accounting?xero=not_configured`);
  const state = randomBytes(24).toString("base64url");
  const sp = new URL(req.url).searchParams;
  // full = granular + reports (apps created after 2 March 2026) · basic = without reports · classic = older Xero apps
  const mode = sp.get("mode") === "classic" ? "classic" : sp.get("basic") === "1" || sp.get("mode") === "basic" ? "basic" : "full";
  const res = NextResponse.redirect(authorizeUrl(state, mode));
  res.cookies.set("xero_oauth_state", state, { httpOnly: true, secure: true, sameSite: "lax", path: "/api/xero", maxAge: 600 });
  return res;
}
