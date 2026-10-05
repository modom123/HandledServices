/*
 * FILE    : apps/web/app/(site)/snap/page.tsx
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-05_0449 UTC
 * PURPOSE : /snap — "Snap & post a job": photo → AI picks the service and fills in the details → timeframe → booking.
 */
import { SnapJob } from "@/components/SnapJob";
import { getLocale } from "@/lib/locale";

export const metadata = { title: "Snap a photo, post a job", description: "Take a photo of what needs doing, choose when, and get vetted local pros — exact price before you pay." };

export default async function SnapPage() {
  return <div className="wrap py-10"><SnapJob locale={await getLocale()} /></div>;
}
