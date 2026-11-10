/*
 * FILE    : apps/web/app/llms.txt/route.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-11-04_2230 UTC
 * PURPOSE : /llms.txt — a plain-language summary of the business for AI assistants and other machine readers (the
 *           llms.txt convention): what Handled does, every service by category, where it works, how ordering works and
 *           how to reach it (and hours: orders 24/7). Built from the same facts the site uses (BRAND, BRAND_STORY, SERVICES, the city pages),
 *           so it never drifts from the site. Facts only — no instructions to assistants.
 * UPDATED : 2026-11-10_0430 UTC — "insured pros" → "background-checked, vetted pros" (insurance is only required for services that need it).
 */
import { BRAND, BRAND_STORY, CATEGORIES, CITY_PAGE_CITIES, SERVICES, isFocusService } from "@handled/core";
import { siteUrl } from "@/lib/site-url";

export const revalidate = 86400;

export function GET() {
  const site = siteUrl();
  const city = (st: string) => CITY_PAGE_CITIES.filter((c) => c.state === st).map((c) => c.name).join(", ");
  const address = process.env.BUSINESS_POSTAL_ADDRESS?.trim();
  const lines = [
    `# ${BRAND.name} (${BRAND.legalName})`,
    "",
    `> ${BRAND_STORY.short.en}`,
    "",
    BRAND.pitch,
    "",
    "## Where we work",
    "- Michigan: Metro Detroit and the rest of the state, including " + city("MI") + ".",
    "- Washington: " + city("WA") + ".",
    "",
    "## How ordering works",
    "- Answer a few questions online and see the price up front, in about a minute.",
    `- ${BRAND.promise}`,
    "- Larger jobs get a free site visit (or an online scope review) to set a firm price before any payment.",
    `- Work is done by background-checked, vetted local pros and checked with photos. Guarantee: ${BRAND.guaranteeDays} days.`,
    "",
    "## Services",
    ...CATEGORIES.flatMap((c) => {
      const list = SERVICES.filter((s) => s.category === c.id);
      return list.length ? ["", `### ${c.name}`, ...list.map((s) => `- [${s.name}](${site}/services/${s.slug}): ${s.tagline}`)] : [];
    }),
    "",
    "## Main focus",
    ...SERVICES.filter((s) => isFocusService(s.slug)).map((s) => `- ${s.name} — ${site}/services/${s.slug}`),
    "",
    "## Hours",
    "- Orders are taken online 24 hours a day, 7 days a week. The work itself is scheduled for a day and arrival time you pick when you order.",
    "",
    "## Contact",
    `- Phone: ${BRAND.supportPhone}`,
    `- Email: ${BRAND.supportEmail}`,
    ...(address ? [`- Mailing address: ${address}`] : []),
    `- Website: ${site}/home`,
    "- Languages: English, Spanish",
    "",
    "## Key pages",
    `- Home: ${site}/home`,
    `- All services: ${site}/services`,
    `- Order / get a price: ${site}/book`,
    `- For businesses: ${site}/business`,
    `- Become a pro: ${site}/pros`,
    `- Reviews: ${site}/reviews`,
    `- Contact: ${site}/contact`,
    `- Terms: ${site}/terms · Privacy: ${site}/privacy`,
    "",
  ];
  return new Response(lines.join("\n"), { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=3600" } });
}
