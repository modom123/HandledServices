/*
 * FILE    : apps/web/lib/site-url.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-07_1640 UTC
 * PURPOSE : The site's public address (NEXT_PUBLIC_SITE_URL, else the Vercel production URL on Vercel, else localhost).
 *           Its own small module so the root layout, robots and sitemap can use it without loading email code.
 */
export const siteUrl = () => {
  const set = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "");
  const local = !set || /localhost|127\.0\.0\.1/.test(set);
  if (!local || !process.env.VERCEL) return set || "http://localhost:3000";
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL;
  return vercel ? `https://${vercel}` : set || "http://localhost:3000";
};
