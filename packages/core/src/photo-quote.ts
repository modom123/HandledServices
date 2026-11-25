/*
 * FILE    : packages/core/src/photo-quote.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-11-25_0200 UTC
 * PURPOSE : Price from photos instead of a walkthrough (owner, 2026-11-25: "use AI and pictures to give people estimates
 *           so we don't have to do walkthroughs, especially for new business leads"). Pure rules:
 *             PHOTO_QUOTE          — limits (photos, how fast the team answers when a firm price needs a person)
 *             photoShots(slug)     — the shot list for a service: which photos give an exact price
 *             BIZ_FREQUENCIES      — one time, weekly, every 2 weeks, monthly
 *             monthlyEstimate()    — a per-visit price as a monthly figure for recurring work
 *           The price itself always comes from the rules engine (estimate), with the AI reading the photos to fill in the
 *           job's details; anything too big or unclear for an instant price gets a firm price from a person who reviews
 *           the same photos: still no visit.
 */
import type { Frequency } from "./types.ts";

export const PHOTO_QUOTE = {
  /** photos per quote (the booking and lead forms take up to 8) */
  maxPhotos: 8,
  /** fewer than this and we ask for more before pricing */
  minPhotos: 2,
  /** a firm price from the team, when it needs a person, within this many business hours */
  reviewHours: 4,
} as const;

/** What to photograph for an exact price, by service (wide shots first, then the details that change the price). */
const SHOTS: Record<string, string[]> = {
  "house-cleaning": ["Each room or area, from the doorway", "Restrooms", "Kitchen or break room", "Floors (carpet, tile, hard floor)", "Anything extra dirty or cluttered"],
  "unit-turnover": ["Every room, from the doorway", "Kitchen: counters, inside the oven and fridge", "Each bathroom", "Walls with marks or holes", "Anything left behind"],
  "carpet-cleaning": ["Each carpeted room or hallway, wide", "Stairs, if any", "Stains or heavy traffic areas, close up"],
  "window-cleaning": ["Each side of the building", "A close-up of a typical window", "Hard-to-reach or upper-floor windows"],
  "power-washing": ["Each surface, wide (driveway, walls, deck, sidewalk)", "The dirtiest part, close up", "How high the walls go"],
  handyman: ["Each item to fix, wide (so we see where it is)", "Each item, close up", "The materials or parts, if you have them"],
  "junk-removal": ["Everything that goes, wide", "The biggest or heaviest items", "The path out (stairs, doors, elevator)"],
  "junk-container": ["Where the container would go (driveway, lot)", "The debris, wide"],
  "large-item-removal": ["Each item, with something for scale", "The path out (stairs, doors)"],
  "small-moves": ["Each room's furniture and boxes, wide", "Stairs and the path to the truck"],
  "lawn-care": ["Front, back and side areas", "Edges, beds and anything overgrown"],
  "staging-transport": ["Each piece, with something for scale", "Pickup and drop-off access"],
  "retail-delivery": ["Each item, with something for scale", "The loading area"],
};
const GENERIC = ["The whole area, wide", "The work itself, close up", "Anything that makes the job harder (stairs, tight spaces, damage)"];

export const photoShots = (slug: string | null | undefined): string[] => (slug && SHOTS[slug]) || GENERIC;

export const BIZ_FREQUENCIES: { value: Frequency; label: string; perMonth: number }[] = [
  { value: "once", label: "One time", perMonth: 0 },
  { value: "weekly", label: "Weekly", perMonth: 52 / 12 },
  { value: "biweekly", label: "Every 2 weeks", perMonth: 26 / 12 },
  { value: "monthly", label: "Monthly", perMonth: 1 },
];

/** A recurring per-visit price as about-a-month; null for one-time work. Rounded to the dollar. */
export function monthlyEstimate(perVisit: number, frequency: Frequency): number | null {
  const f = BIZ_FREQUENCIES.find((x) => x.value === frequency);
  return f && f.perMonth > 0 ? Math.round(perVisit * f.perMonth) : null;
}
