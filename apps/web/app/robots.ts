/*
 * FILE    : apps/web/app/robots.ts
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-02_1329 UTC
 * PURPOSE : robots.txt — public pages crawlable; staff, pro, account, invoices and APIs are not.
 */
import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const base = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
  return { rules: [{ userAgent: "*", allow: "/", disallow: ["/hub", "/pro/", "/account", "/invoice", "/api", "/pay", "/auth"] }], sitemap: `${base}/sitemap.xml` };
}
