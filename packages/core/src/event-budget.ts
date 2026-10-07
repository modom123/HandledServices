/*
 * FILE    : packages/core/src/event-budget.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-01_2145 UTC
 * PURPOSE : "Plan by budget" for parties & events. Splits a customer's total budget across
 *           food, venue, music, rentals and coordination by event type, says what each
 *           share buys at our à-la-carte prices, and flags budgets that are tight for the
 *           guest count. The lines always add up to exactly the budget.
 * UPDATED : 2026-10-05_1433 UTC — security: securityAdvice() (1 licensed guard per 50 guests with alcohol, per 75 without; at
 *           least 2 for 100+) and, when alcohol is served with 50+ guests or the event is 150+, a Security line taken out
 *           of the budget before the split (or a warning when the budget can't cover it).
 */

export interface BudgetLine {
  key: "food" | "venue" | "music" | "rentals" | "coordination" | "contingency" | "security";
  label: string;
  amount: number;
  /** What this share buys, in plain words. */
  buys: string;
}

const SPLITS: Record<string, Record<Exclude<BudgetLine["key"], "security">, number>> = {
  birthday: { food: 0.4, venue: 0.15, music: 0.12, rentals: 0.15, coordination: 0.12, contingency: 0.06 },
  wedding: { food: 0.35, venue: 0.25, music: 0.12, rentals: 0.12, coordination: 0.1, contingency: 0.06 },
  corporate: { food: 0.42, venue: 0.22, music: 0.1, rentals: 0.1, coordination: 0.1, contingency: 0.06 },
  corporate_dinner: { food: 0.5, venue: 0.2, music: 0.06, rentals: 0.1, coordination: 0.08, contingency: 0.06 },
  company_bbq: { food: 0.5, venue: 0.05, music: 0.1, rentals: 0.17, coordination: 0.1, contingency: 0.08 },
  lunch_party: { food: 0.65, venue: 0, music: 0.05, rentals: 0.12, coordination: 0.1, contingency: 0.08 },
  day_party: { food: 0.35, venue: 0.15, music: 0.2, rentals: 0.15, coordination: 0.09, contingency: 0.06 },
  pool_party: { food: 0.4, venue: 0.1, music: 0.15, rentals: 0.17, coordination: 0.1, contingency: 0.08 },
};

/** What the food share looks like for this kind of event, and where it usually happens. */
const STYLE: Record<string, { food?: string; venue?: string; rentals?: string }> = {
  corporate_dinner: { food: "plated or family-style dinner", venue: "restaurant private room or banquet space" },
  company_bbq: { food: "BBQ / grill-out catering or a BBQ food truck", venue: "your office lot, a park pavilion or a picnic grove", rentals: "picnic tables, tents & yard games" },
  lunch_party: { food: "taco bar, food truck or boxed lunches", venue: "your office", rentals: "serving tables, linens & disposable tableware" },
  day_party: { food: "food truck, grill or heavy bites" },
  pool_party: { food: "grill, tacos or a food truck", venue: "your pool, a club or a rented pool", rentals: "shade tents, lounge chairs & coolers" },
};

/** Event security rates (match the Event Security service): unarmed guard-hour, supervisor-hour, service minimum. */
const GUARD_RATE = 39, SUPERVISOR_RATE = 48, SECURITY_MINIMUM = 220;

/**
 * Should this event have licensed security, and how many guards? 1 guard per 50 guests when alcohol is served,
 * per 75 without; at least 2 for 100+ guests. Recommended with alcohol and 50+ guests, or for any event of 150+.
 */
export function securityAdvice(o: { guests: number; alcohol?: boolean; hours?: number }) {
  const guests = Math.max(0, Math.round(o.guests));
  const hours = Math.max(4, Math.round(o.hours ?? 5));
  const recommended = (Boolean(o.alcohol) && guests >= 50) || guests >= 150;
  const guards = Math.min(30, Math.max(guests >= 100 ? 2 : 1, Math.ceil(guests / (o.alcohol ? 50 : 75))));
  const supervisors = guards >= 5 ? Math.ceil(guards / 10) : 0;
  const cost = Math.max(SECURITY_MINIMUM, guards * hours * GUARD_RATE + supervisors * hours * SUPERVISOR_RATE);
  const reason = o.alcohol ? `Alcohol with ${guests} guests` : `${guests} guests`;
  return { recommended, guards, hours, cost, reason };
}

const LABEL: Record<BudgetLine["key"], string> = {
  food: "Food & drink", venue: "Venue", music: "Music & entertainment", rentals: "Seating, tables & décor",
  coordination: "Planning & day-of coordination", contingency: "Cake, extras & contingency", security: "Security",
};

export function planEventBudget(opts: { budget: number; guests: number; eventType: string; haveVenue?: boolean; alcohol?: boolean }) {
  const budget = Math.round(opts.budget);
  const guests = Math.max(1, Math.round(opts.guests));
  const sec = securityAdvice({ guests, alcohol: opts.alcohol });
  // security comes off the top when it's recommended and fits (≤ 20% of the budget); the rest is split as usual
  const security = sec.recommended && sec.cost <= budget * 0.2 ? sec.cost : 0;
  const pool = budget - security;
  const split: Record<BudgetLine["key"], number> = { ...(SPLITS[opts.eventType] ?? SPLITS.birthday), security: 0 };
  // no venue needed → its share goes to food, rentals and music
  if (opts.haveVenue) {
    const v = split.venue;
    split.venue = 0;
    split.food += v * 0.5; split.rentals += v * 0.3; split.music += v * 0.2;
  }
  const keys = Object.keys(split) as BudgetLine["key"][];
  const amounts = Object.fromEntries(keys.map((k) => [k, Math.floor(pool * split[k])])) as Record<BudgetLine["key"], number>;
  amounts.security = security;
  amounts.contingency += budget - keys.reduce((t, k) => t + amounts[k], 0); // rounding → contingency, so lines sum exactly

  const perGuest = amounts.food / guests;
  const food = perGuest >= 48 ? "plated dinner" : perGuest >= 36 ? "family-style meal" : perGuest >= 26 ? "buffet" : perGuest >= 15 ? "food truck or heavy appetizers" : "light bites / snacks";
  const djHours = Math.floor(amounts.music / 175);
  const music = amounts.music >= 2800 ? "live band or DJ + MC" : djHours >= 2 ? `DJ for ~${Math.min(djHours, 8)} hours` : "speaker rental + curated playlist";
  const seatsCost = guests * 3.75 + Math.ceil(guests / 8) * 14;
  const rentals = amounts.rentals >= seatsCost + 175 + 495 ? "chairs, tables, linens + a tent or décor" : amounts.rentals >= seatsCost + 175 ? "chairs & tables for everyone, delivered & set up" : "partial seating (cocktail-style)";
  const venueBuys = opts.haveVenue ? "your space" : amounts.venue >= 1500 ? "banquet hall, loft or restaurant buyout" : amounts.venue >= 600 ? "private room or park pavilion" : "home, backyard or a free community space";

  const buys: Record<BudgetLine["key"], string> = {
    food: STYLE[opts.eventType]?.food ? `${STYLE[opts.eventType].food} (~$${Math.round(perGuest)}/guest)` : `${food} (~$${Math.round(perGuest)}/guest)`,
    venue: STYLE[opts.eventType]?.venue && !opts.haveVenue ? STYLE[opts.eventType].venue! : venueBuys,
    music, rentals: STYLE[opts.eventType]?.rentals ? `${rentals}; ${STYLE[opts.eventType].rentals}` : rentals,
    coordination: "planner, vendor booking & on-site coordinator", contingency: "cake/dessert, décor touches, a cushion for surprises",
    security: `licensed guards ×${sec.guards}, ~${sec.hours} hrs (door, ID & crowd control)`,
  };
  const lines: BudgetLine[] = keys.filter((k) => amounts[k] > 0).map((k) => ({ key: k, label: LABEL[k], amount: amounts[k], buys: buys[k] }));
  const warnings: string[] = [];
  if (perGuest < 15) warnings.push(`$${budget.toLocaleString("en-US")} is tight for ${guests} guests — about $${Math.round(perGuest)}/guest for food. Consider fewer guests, a food truck, or a larger budget.`);
  if (!opts.haveVenue && split.venue > 0.06 && amounts.venue < 600) warnings.push("The venue share is small — hosting at home or a free space stretches this budget further.");
  if (sec.recommended && !security) warnings.push(`${sec.reason}: we recommend ${sec.guards} licensed guard${sec.guards > 1 ? "s" : ""} (about $${sec.cost.toLocaleString("en-US")}), which doesn't fit this budget — add Event Security separately or raise the budget.`);
  return { budget, guests, perGuest: budget / guests, lines, warnings, security: sec };
}
