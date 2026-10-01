/*
 * FILE    : apps/web/app/auth/signout/route.ts
 * PROJECT : Handled — AI-run home & business services
 * CREATED : 2026-10-01_1723 UTC
 */
import { NextResponse } from "next/server";
import { serverClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  await (await serverClient()).auth.signOut();
  return NextResponse.redirect(new URL("/", req.url), { status: 303 });
}
