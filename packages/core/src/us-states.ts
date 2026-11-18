/*
 * FILE    : packages/core/src/us-states.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-11-17_2045 UTC
 * PURPOSE : Pros in all 50 states (owner, 2026-11-17). The states, a ZIP → state lookup (by 3-digit ZIP prefix), and the
 *           license line a pro sees for their own state: the Michigan wording where it applies, otherwise a plain
 *           "your state's license for this work where it's required" line (we don't keep every state's licensing rules).
 *             US_STATES, stateName, stateForZip, licenseFor
 */

export const US_STATES: { code: string; name: string }[] = [
  ["AL", "Alabama"], ["AK", "Alaska"], ["AZ", "Arizona"], ["AR", "Arkansas"], ["CA", "California"], ["CO", "Colorado"], ["CT", "Connecticut"],
  ["DE", "Delaware"], ["DC", "District of Columbia"], ["FL", "Florida"], ["GA", "Georgia"], ["HI", "Hawaii"], ["ID", "Idaho"], ["IL", "Illinois"],
  ["IN", "Indiana"], ["IA", "Iowa"], ["KS", "Kansas"], ["KY", "Kentucky"], ["LA", "Louisiana"], ["ME", "Maine"], ["MD", "Maryland"],
  ["MA", "Massachusetts"], ["MI", "Michigan"], ["MN", "Minnesota"], ["MS", "Mississippi"], ["MO", "Missouri"], ["MT", "Montana"], ["NE", "Nebraska"],
  ["NV", "Nevada"], ["NH", "New Hampshire"], ["NJ", "New Jersey"], ["NM", "New Mexico"], ["NY", "New York"], ["NC", "North Carolina"],
  ["ND", "North Dakota"], ["OH", "Ohio"], ["OK", "Oklahoma"], ["OR", "Oregon"], ["PA", "Pennsylvania"], ["RI", "Rhode Island"],
  ["SC", "South Carolina"], ["SD", "South Dakota"], ["TN", "Tennessee"], ["TX", "Texas"], ["UT", "Utah"], ["VT", "Vermont"], ["VA", "Virginia"],
  ["WA", "Washington"], ["WV", "West Virginia"], ["WI", "Wisconsin"], ["WY", "Wyoming"],
].map(([code, name]) => ({ code, name }));

const NAME: Record<string, string> = Object.fromEntries(US_STATES.map((s) => [s.code, s.name]));
export const stateName = (code: string | null | undefined) => (code ? NAME[code.toUpperCase()] ?? null : null);

// 3-digit ZIP prefix ranges → state (USPS). Special cases first.
const SPECIAL: Record<number, string> = { 55: "MA", 201: "VA", 569: "DC", 733: "TX", 885: "TX" };
const RANGES: [number, number, string][] = [
  [5, 5, "NY"], [10, 27, "MA"], [28, 29, "RI"], [30, 38, "NH"], [39, 49, "ME"], [50, 59, "VT"], [60, 69, "CT"], [70, 89, "NJ"],
  [100, 149, "NY"], [150, 196, "PA"], [197, 199, "DE"], [200, 205, "DC"], [206, 219, "MD"], [220, 246, "VA"], [247, 268, "WV"],
  [270, 289, "NC"], [290, 299, "SC"], [300, 319, "GA"], [320, 349, "FL"], [350, 369, "AL"], [370, 385, "TN"], [386, 397, "MS"],
  [398, 399, "GA"], [400, 427, "KY"], [430, 459, "OH"], [460, 479, "IN"], [480, 499, "MI"], [500, 528, "IA"], [530, 549, "WI"],
  [550, 567, "MN"], [570, 577, "SD"], [580, 588, "ND"], [590, 599, "MT"], [600, 629, "IL"], [630, 658, "MO"], [660, 679, "KS"],
  [680, 693, "NE"], [700, 714, "LA"], [716, 729, "AR"], [730, 749, "OK"], [750, 799, "TX"], [800, 816, "CO"], [820, 831, "WY"],
  [832, 838, "ID"], [840, 847, "UT"], [850, 865, "AZ"], [870, 884, "NM"], [889, 898, "NV"], [900, 961, "CA"], [967, 968, "HI"],
  [970, 979, "OR"], [980, 994, "WA"], [995, 999, "AK"],
];

/** The state a 5-digit ZIP is in (null for territories, military mail and malformed ZIPs). */
export function stateForZip(zip: string | null | undefined): string | null {
  const z = String(zip ?? "").trim();
  if (!/^\d{5}$/.test(z)) return null;
  const p = Number(z.slice(0, 3));
  if (SPECIAL[p]) return SPECIAL[p];
  return RANGES.find(([a, b]) => p >= a && p <= b)?.[2] ?? null;
}

/**
 * The license line for a trade, for a pro's state. Our trade profiles are written for Michigan (and name Washington's
 * L&I where it differs); everywhere else the pro is told to hold their own state's license for the work where it's
 * required — Handled verifies it before licensed jobs.
 */
export function licenseFor(license: string | null | undefined, state: string | null | undefined): string | null {
  if (!license) return null;
  const st = (state ?? "").toUpperCase();
  if (!st || st === "MI" || !/Michigan|LARA|MDOT|EGLE|MDARD|DNR/.test(license)) return license;
  const name = stateName(st) ?? "your state";
  return `The ${name} license or registration this work needs, where ${name} or your city requires one (for example a contractor, trade or business license — check ${name}'s licensing board). Handled verifies it before you take licensed jobs.`;
}
