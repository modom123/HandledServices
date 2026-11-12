/*
 * FILE    : apps/web/app/sitemap.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-02_1329 UTC
 * PURPOSE : sitemap.xml for search engines: main pages, every service, every service × city.
 * UPDATED : 2026-10-06_0606 UTC — cleaning push: focus services (MARKETING_FOCUS) and their city pages get higher priority.
 * UPDATED : 2026-10-07_1640 UTC — base URL from lib/site-url (Vercel production URL when NEXT_PUBLIC_SITE_URL is unset, not localhost).
 * UPDATED : 2026-11-04_2230 UTC — SEO: city pages only for the focus services (Michigan + Washington cities); "/" left out
 *           (its canonical is /home); lastModified is the deploy time instead of every request.
 * UPDATED : 2026-11-06_0500 UTC — market pages (/areas, /areas/<market>); city pages for each market's featured services.
 * UPDATED : 2026-11-12_2000 UTC — /job-board and /post.
 */
import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site-url";
import { CITY_PAGE_CITIES, SERVICES, SITE_MARKETS, isFocusService, isIndexedCityPage } from "@handled/core";

const BUILT_AT = new Date();

export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl();
  const now = BUILT_AT; // a real "last changed" date (the deploy), not "now" on every request, so Google can trust it
  const pages = ["/home", "/services", "/book", "/business", "/technology", "/events", "/pros", "/plus", "/gift-cards", "/reviews", "/job-board", "/post"].map((p) => ({ url: `${base}${p}`, lastModified: now, changeFrequency: "weekly" as const, priority: p === "" || p === "/home" ? 1 : 0.8 }));
  const services = SERVICES.map((s) => ({ url: `${base}/services/${s.slug}`, lastModified: now, changeFrequency: "weekly" as const, priority: isFocusService(s.slug) ? 0.9 : 0.7 }));
  // city pages only where they're indexed: focus services + each market's featured services (see services/[slug]/in/[city])
  const cities = SERVICES.flatMap((s) => CITY_PAGE_CITIES.filter((c) => isIndexedCityPage(s.slug, c.slug)).map((c) => ({ url: `${base}/services/${s.slug}/in/${c.slug}`, lastModified: now, changeFrequency: "weekly" as const, priority: 0.8 })));
  const markets = [{ url: `${base}/areas`, lastModified: now, changeFrequency: "weekly" as const, priority: 0.8 }, ...SITE_MARKETS.map((m) => ({ url: `${base}/areas/${m.slug}`, lastModified: now, changeFrequency: "weekly" as const, priority: 0.9 }))];
  return [...pages, ...markets, ...services, ...cities];
}
