/*
 * FILE    : apps/web/app/b/[token]/route.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-04_1934 UTC
 * PURPOSE : The link in a business sales email: records the click, then opens the For Business page with
 *           the lead token (so the account is credited and gets the pilot offer) and utm_source=biz_email.
 * UPDATED : 2026-10-28_1935 UTC — lands on the business page's Order section (the proposal form is gone).
 * UPDATED : 2026-11-17_2350 UTC — lands on the landing page for the lead's kind of business (/business/<slug>: one offer, book a free
 *           walkthrough); the general business page when there's no matching page.
 */
import { recordBizLeadClick } from "@/lib/biz-leads";
import { siteUrl } from "@/lib/notify";

export async function GET(_req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const r = await recordBizLeadClick(token).catch(() => false);
  if (typeof r === "string") return Response.redirect(`${siteUrl()}/business/${r}?lead=${token}&utm_source=biz_email`, 302);
  return Response.redirect(`${siteUrl()}/business?${r ? `lead=${token}&` : ""}utm_source=biz_email#order`, 302);
}
