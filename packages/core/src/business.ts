/*
 * FILE    : packages/core/src/business.ts
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-02_0244 UTC
 * UPDATED : 2026-10-02_0251 UTC — game day & concert rides under corporate transportation.
 * PURPOSE : How we present services to businesses: grouped by what a facility needs (not by
 *           the home categories), plus the industries we serve and the services each one
 *           usually books. Used by the For Business page and its proposal form.
 * UPDATED : 2026-10-04_1934 UTC — unit turnovers, moves and large-item delivery groups; real estate and self-storage industries.
 * UPDATED : 2026-10-05_1433 UTC — Security guards & patrol group; guards for retail, property managers, warehouses; event security for venues.
 */
import { SERVICE_BY_SLUG } from "./services.ts";

export interface BusinessGroup { id: string; title: string; icon: string; blurb: string; slugs: string[] }

export const BUSINESS_GROUPS: BusinessGroup[] = [
  { id: "janitorial", title: "Janitorial & cleaning", icon: "🧽", blurb: "Nightly, weekly or one-time office cleaning, glass, carpets and move-outs.", slugs: ["house-cleaning", "window-cleaning", "carpet-cleaning", "organizing"] },
  { id: "exterior", title: "Exterior & grounds", icon: "🌳", blurb: "Curb appeal year-round: grounds, snow and ice, sidewalks and storefronts.", slugs: ["lawn-care", "snow-removal", "leaf-removal", "power-washing", "gutter-cleaning", "tree-removal"] },
  { id: "maintenance", title: "Repairs & maintenance", icon: "🔧", blurb: "Work orders handled by licensed trades, with photos on every ticket.", slugs: ["handyman", "plumbing", "lighting-install", "camera-install", "water-heater", "hvac-install"] },
  { id: "buildout", title: "Painting & build-outs", icon: "🎨", blurb: "Tenant turnovers, refreshes and remodels, scheduled around your hours.", slugs: ["interior-painting", "exterior-painting", "bathroom-remodel", "kitchen-remodel"] },
  { id: "turnovers", title: "Unit turnovers & make-readies", icon: "🔑", blurb: "Cleanout, deep clean, touch-ups and punch list between tenants — rent-ready in one booking, photos of every room.", slugs: ["unit-turnover", "house-cleaning", "interior-painting", "carpet-cleaning"] },
  { id: "cleanouts", title: "Clean-outs, moves & hauling", icon: "🚛", blurb: "Office and small moves, abandoned items and furniture removal — or a container for the week.", slugs: ["junk-removal", "small-moves", "large-item-removal", "junk-container"] },
  { id: "delivery", title: "Large-item delivery & staging", icon: "🚚", blurb: "Same-day delivery for your store's customers, and staging furniture moved in and out of listings.", slugs: ["retail-delivery", "staging-transport"] },
  { id: "courier", title: "Courier & delivery", icon: "📦", blurb: "Medical courier for clinics and labs, plus same-day runs and supply pickups.", slugs: ["courier", "medical-delivery", "errands"] },
  { id: "transport", title: "Corporate transportation", icon: "🚘", blurb: "Executive cars, airport runs, event shuttles, team charters and client outings to the game or a concert.", slugs: ["private-driver", "airport-transfer", "event-shuttle", "charter-bus", "game-day-rides"] },
  { id: "events", title: "Corporate events & catering", icon: "🍽️", blurb: "Team lunches, client dinners, company BBQs and holiday parties, start to finish.", slugs: ["catering", "event-planning", "food-truck", "event-venue", "event-rentals", "dj-music"] },
  { id: "security", title: "Security guards & patrol", icon: "🛡️", blurb: "Licensed guards for your building, job site or lot: a standing post, nightly patrols, fire watch, or security for your event.", slugs: ["security-guard", "event-security", "camera-install"] },
  { id: "fleet", title: "Fleet & staff perks", icon: "🚗", blurb: "On-site detailing for company vehicles — or as a perk in your lot.", slugs: ["mobile-car-detailing", "personal-assistant"] },
];

export interface Industry { id: string; name: string; icon: string; slugs: string[] }

export const INDUSTRIES: Industry[] = [
  { id: "offices", name: "Offices", icon: "🏢", slugs: ["house-cleaning", "courier", "window-cleaning", "handyman", "airport-transfer"] },
  { id: "retail", name: "Retail & storefronts", icon: "🛍️", slugs: ["retail-delivery", "window-cleaning", "power-washing", "snow-removal", "camera-install", "security-guard"] },
  { id: "real_estate", name: "Real estate agents & stagers", icon: "🏡", slugs: ["staging-transport", "house-cleaning", "junk-removal", "power-washing", "handyman"] },
  { id: "storage", name: "Self-storage facilities", icon: "🔐", slugs: ["junk-removal", "junk-container", "small-moves", "power-washing", "snow-removal"] },
  { id: "restaurants", name: "Restaurants", icon: "🍽️", slugs: ["power-washing", "plumbing", "garbage-disposal", "gutter-cleaning", "junk-removal"] },
  { id: "property", name: "Property managers & HOAs", icon: "🏘️", slugs: ["unit-turnover", "lawn-care", "snow-removal", "junk-removal", "handyman", "security-guard"] },
  { id: "medical", name: "Clinics, labs & pharmacies", icon: "🩺", slugs: ["medical-delivery", "house-cleaning", "window-cleaning", "handyman"] },
  { id: "hospitality", name: "Hotels & venues", icon: "🏨", slugs: ["event-shuttle", "carpet-cleaning", "power-washing", "event-rentals", "airport-transfer", "event-security"] },
  { id: "warehouse", name: "Warehouses & light industrial", icon: "🏭", slugs: ["junk-container", "large-item-removal", "snow-removal", "lighting-install", "security-guard"] },
  { id: "community", name: "Schools, churches & nonprofits", icon: "⛪", slugs: ["house-cleaning", "lawn-care", "snow-removal", "charter-bus", "catering"] },
];

/** Services in a group or industry that exist in the catalog (guards against renamed slugs). */
export function businessServices(slugs: string[]) {
  return slugs.map((s) => SERVICE_BY_SLUG[s]).filter(Boolean);
}
