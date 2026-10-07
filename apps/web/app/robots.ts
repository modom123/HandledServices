/*
 * FILE    : apps/web/app/robots.ts
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-02_1329 UTC
 * PURPOSE : robots.txt — public pages crawlable; staff, pro, account, invoices and APIs are not.
 * UPDATED : 2026-10-07_1640 UTC — base URL from lib/site-url (Vercel production URL when NEXT_PUBLIC_SITE_URL is unset, not localhost).
 */
import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site-url";

export default function robots(): MetadataRoute.Robots {
  const base = siteUrl();
  return { rules: [{ userAgent: "*", allow: "/", disallow: ["/hub", "/pro/", "/account", "/invoice", "/api", "/pay", "/auth"] }], sitemap: `${base}/sitemap.xml` };
}
