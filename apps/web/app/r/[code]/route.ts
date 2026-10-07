/*
 * FILE    : apps/web/app/r/[code]/route.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-07_0115 UTC
 * PURPOSE : Short partner links for cards, texts and QR codes: /r/JANE7K2Q → the home page, partner remembered
 *           (same cookie and rules as ?partner=, 90 days, first click wins).
 */
import { NextResponse } from "next/server";
import { cleanPartnerCode, PARTNER_PROGRAM } from "@handled/core";

export async function GET(req: Request, { params }: { params: Promise<{ code: string }> }) {
  const code = cleanPartnerCode((await params).code);
  const res = NextResponse.redirect(new URL("/home", req.url));
  if (code && !req.headers.get("cookie")?.includes("handled_partner=")) res.cookies.set("handled_partner", code, { path: "/", maxAge: 60 * 60 * 24 * PARTNER_PROGRAM.cookieDays, sameSite: "lax", httpOnly: true, secure: true });
  return res;
}
