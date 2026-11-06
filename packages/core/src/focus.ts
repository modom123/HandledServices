/*
 * FILE    : packages/core/src/focus.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-06_0606 UTC
 * PURPOSE : Where sales and marketing push first: cleaning, in Detroit and the surrounding cities. The brand and website
 *           are national (any city can book or join the waitlist); this is only where outbound effort starts.
 *           Every channel reads this one place: the home page hero, the business sales engine (segments
 *           and cities it searches), the pro lead engine (which trades it recruits when staff haven't
 *           picked), the Email Center cleaning templates and the sitemap. Every other service stays
 *           bookable; it just isn't what we advertise first. Change the focus here.
 */
import type { BizSegment } from "./biz-lead-engine.ts";
import { SEO_CITIES, SEO_CITY_BY_SLUG, marketForCity } from "./seo.ts";

export const MARKETING_FOCUS = {
  label: "Cleaning in Metro Detroit",
  /** Services every channel leads with, most important first. */
  services: ["house-cleaning", "carpet-cleaning", "window-cleaning", "unit-turnover"],
  /** Pro trades the lead engine recruits when staff haven't picked any (cleaners first). */
  trades: ["cleaning", "carpet", "windows"],
  /** Business segments the sales engine works by default: who buys cleaning. */
  segments: ["facilities", "property_manager", "real_estate"] as BizSegment[],
};

/** Detroit and the surrounding cities, for lead searches (same list as the city pages). */
export const FOCUS_CITIES: string[] = SEO_CITIES.map((c) => c.name);

export const isFocusService = (slug: string) => MARKETING_FOCUS.services.includes(slug);

/**
 * Is a "<service> in <city>" page indexed? The marketing focus services everywhere, plus the services the city's market
 * leads with (SITE_MARKETS.featured — e.g. handyman in Las Vegas). The rest stay noindex,follow (no doorway pages).
 */
export const isIndexedCityPage = (slug: string, citySlug: string) => {
  if (isFocusService(slug)) return true;
  const c = SEO_CITY_BY_SLUG[citySlug];
  return Boolean(c && marketForCity(c)?.featured.includes(slug));
};
