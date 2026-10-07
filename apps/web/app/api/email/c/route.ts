/*
 * FILE    : apps/web/app/api/email/c/route.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-05_0148 UTC
 * PURPOSE : Email Center click tracking: a signed link (only links we put in a campaign) counts the click and
 *           redirects to the real page. Bad or unsigned links go to the home page (never an open redirect).
 */
import { recordClick } from "@/lib/email-center";
import { siteUrl } from "@/lib/notify";

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const to = await recordClick(q.get("r") ?? "", q.get("u") ?? "", q.get("s")).catch(() => null);
  return Response.redirect(to ?? `${siteUrl()}/home`, 302);
}
