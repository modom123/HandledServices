/*
 * FILE    : apps/web/app/l/[token]/route.ts
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-03_0209 UTC
 * PURPOSE : The link in a pro lead invitation: records the click, then opens the pro sign-up page
 *           with the lead token (so the application is credited) and utm_source=lead_email.
 */
import { recordLeadClick } from "@/lib/leads";
import { siteUrl } from "@/lib/notify";

export async function GET(req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const ok = await recordLeadClick(token).catch(() => false);
  const lang = new URL(req.url).searchParams.get("lang") === "es" ? "&lang=es" : "";
  return Response.redirect(`${siteUrl()}/pros?${ok ? `lead=${token}&` : ""}utm_source=lead_email${lang}#apply`, 302);
}
