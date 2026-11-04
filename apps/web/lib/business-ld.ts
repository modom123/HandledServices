/*
 * FILE    : apps/web/lib/business-ld.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-11-04_2230 UTC
 * PURPOSE : The business itself as schema.org structured data (LocalBusiness), for the home pages, and the shared
 *           reference service pages point at (@id), so Google and AI assistants read one consistent set of facts:
 *           name, legal name, phone, email, logo, and the states served (Michigan, Washington). A street address is
 *           included only when BUSINESS_POSTAL_ADDRESS is set — never a made-up one.
 *           "405 W. Greenlawn Ave. #G11 #4194, Lansing, MI 48910" is split into street / city / state / ZIP; anything
 *           that doesn't fit that shape is passed through as the street line.
 * UPDATED : 2026-11-04_2300 UTC — hours: open 24/7 (the owner's published hours), as openingHoursSpecification.
 */
import "server-only";
import { BRAND, SERVICE_AREA } from "@handled/core";
import { siteUrl } from "./site-url";

export const businessId = () => `${siteUrl()}/#business`;

/** "(313) 639-9373" → "+1-313-639-9373" (schema.org prefers international format). */
const intl = (phone: string) => { const d = phone.replace(/\D/g, "").replace(/^1(?=\d{10}$)/, ""); return d.length === 10 ? `+1-${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}` : phone; };

/** "street, city, ST 12345" → schema.org PostalAddress parts. */
export function postalAddress(raw: string) {
  const m = raw.trim().match(/^(.+?),\s*([^,]+?),\s*([A-Za-z]{2})\s+(\d{5}(?:-\d{4})?)\s*$/);
  return m
    ? { "@type": "PostalAddress", streetAddress: m[1].trim(), addressLocality: m[2].trim(), addressRegion: m[3].toUpperCase(), postalCode: m[4], addressCountry: "US" }
    : { "@type": "PostalAddress", streetAddress: raw.trim(), addressCountry: "US" };
}

export function businessLd() {
  const site = siteUrl();
  const address = process.env.BUSINESS_POSTAL_ADDRESS?.trim();
  return {
    "@context": "https://schema.org",
    "@type": "HomeAndConstructionBusiness",
    "@id": businessId(),
    name: BRAND.name,
    legalName: BRAND.legalName,
    url: `${site}/home`,
    logo: `${site}/brand/handled-logo.png`,
    image: `${site}/brand/handled-logo.png`,
    description: BRAND.pitch,
    slogan: BRAND.tagline,
    telephone: intl(BRAND.supportPhone),
    email: BRAND.supportEmail,
    areaServed: SERVICE_AREA.map((s) => ({ "@type": "State", name: s.name })),
    ...(address ? { address: postalAddress(address) } : {}),
    // open 24 hours, 7 days (schema.org's way to say it: 00:00–23:59 every day)
    openingHoursSpecification: [{ "@type": "OpeningHoursSpecification", dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"], opens: "00:00", closes: "23:59" }],
    contactPoint: { "@type": "ContactPoint", contactType: "customer service", telephone: intl(BRAND.supportPhone), email: BRAND.supportEmail, availableLanguage: ["English", "Spanish"], hoursAvailable: { "@type": "OpeningHoursSpecification", dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"], opens: "00:00", closes: "23:59" } },
  };
}

/** The <script> tag (escaped so text can't close it early). */
export function ldScript(data: object) {
  return { __html: JSON.stringify(data).replace(/</g, "\\u003c") };
}
