/*
 * FILE    : apps/web/app/join/route.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-22_0530 UTC
 * PURPOSE : The permanent address printed on the recruiting flyer's QR code (handledsvc.com/join). A printed QR can't
 *           change, so it points here and this decides where to go: the partner sign-up (/partners#join), tagged with
 *           where they came from (?src=, default "flyer") and, on a personal flyer, who handed it out (?by=<partner code>).
 *           Signed-in pros and clients land on the same form, which links to one-tap join.
 */
import { NextResponse } from "next/server";
import { cleanPartnerCode } from "@handled/core";

export function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const src = (q.get("src") ?? "flyer").toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 30) || "flyer";
  const by = cleanPartnerCode(q.get("by"));
  return NextResponse.redirect(new URL(`/partners?src=${src}${by ? `&by=${by}` : ""}#join`, req.url));
}
