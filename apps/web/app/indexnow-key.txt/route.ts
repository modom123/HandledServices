/*
 * FILE    : apps/web/app/indexnow-key.txt/route.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-11-24_2200 UTC
 * PURPOSE : The IndexNow key file (lib/indexnow.ts): search engines fetch it to confirm the pages we submit are ours.
 */
import { indexNowKey } from "@/lib/indexnow";

export function GET() {
  return new Response(indexNowKey(), { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=86400" } });
}
