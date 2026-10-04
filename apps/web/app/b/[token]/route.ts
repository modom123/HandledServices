/*
 * FILE    : apps/web/app/b/[token]/route.ts
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-04_1934 UTC
 * PURPOSE : The link in a business sales email: records the click, then opens the For Business page with
 *           the lead token (so the account is credited and gets the pilot offer) and utm_source=biz_email.
 */
import { recordBizLeadClick } from "@/lib/biz-leads";
import { siteUrl } from "@/lib/notify";

export async function GET(_req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const ok = await recordBizLeadClick(token).catch(() => false);
  return Response.redirect(`${siteUrl()}/business?${ok ? `lead=${token}&` : ""}utm_source=biz_email#proposal`, 302);
}
