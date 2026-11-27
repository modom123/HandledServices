/*
 * FILE    : apps/web/app/(site)/snap/page.tsx
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-05_0449 UTC
 * UPDATED : 2026-11-27_1900 UTC — redirects to Get it Handled (/post), which does the same with 3 photos and an AI quote.
 * PURPOSE : /snap — "Snap & post a job": photo → AI picks the service and fills in the details → timeframe → booking.
 */
import { redirect } from "next/navigation";

export default async function SnapPage() {
  // one front door (owner, 2026-11-27): Snap a photo is part of Get it Handled now (3 photos, AI quote)
  redirect("/post");
}
