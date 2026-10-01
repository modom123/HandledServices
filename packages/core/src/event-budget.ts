/*
 * FILE    : packages/core/src/event-budget.ts
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-01_2145 UTC
 * PURPOSE : "Plan by budget" for parties & events. Splits a customer's total budget across
 *           food, venue, music, rentals and coordination by event type, says what each
 *           share buys at our à-la-carte prices, and flags budgets that are tight for the
 *           guest count. The lines always add up to exactly the budget.
 */

export interface BudgetLine {
  key: "food" | "venue" | "music" | "rentals" | "coordination" | "contingency";
  label: string;
  amount: number;
  /** What this share buys, in plain words. */
  buys: string;
}

const SPLITS: Record<string, Record<BudgetLine["key"], number>> = {
  birthday: { food: 0.4, venue: 0.15, music: 0.12, rentals: 0.15, coordination: 0.12, contingency: 0.06 },
  wedding: { food: 0.35, venue: 0.25, music: 0.12, rentals: 0.12, coordination: 0.1, contingency: 0.06 },
  corporate: { food: 0.42, venue: 0.22, music: 0.1, rentals: 0.1, coordination: 0.1, contingency: 0.06 },
};

const LABEL: Record<BudgetLine["key"], string> = {
  food: "Food & drink", venue: "Venue", music: "Music & entertainment", rentals: "Seating, tables & décor",
  coordination: "Planning & day-of coordination", contingency: "Cake, extras & contingency",
};

export function planEventBudget(opts: { budget: number; guests: number; eventType: string; haveVenue?: boolean }) {
  const budget = Math.round(opts.budget);
  const guests = Math.max(1, Math.round(opts.guests));
  const split = { ...(SPLITS[opts.eventType] ?? SPLITS.birthday) };
  // no venue needed → its share goes to food, rentals and music
  if (opts.haveVenue) {
    const v = split.venue;
    split.venue = 0;
    split.food += v * 0.5; split.rentals += v * 0.3; split.music += v * 0.2;
  }
  const keys = Object.keys(split) as BudgetLine["key"][];
  const amounts = Object.fromEntries(keys.map((k) => [k, Math.floor(budget * split[k])])) as Record<BudgetLine["key"], number>;
  amounts.contingency += budget - keys.reduce((t, k) => t + amounts[k], 0); // rounding → contingency, so lines sum exactly

  const perGuest = amounts.food / guests;
  const food = perGuest >= 48 ? "plated dinner" : perGuest >= 36 ? "family-style meal" : perGuest >= 26 ? "buffet" : perGuest >= 15 ? "food truck or heavy appetizers" : "light bites / snacks";
  const djHours = Math.floor(amounts.music / 175);
  const music = amounts.music >= 2800 ? "live band or DJ + MC" : djHours >= 2 ? `DJ for ~${Math.min(djHours, 8)} hours` : "speaker rental + curated playlist";
  const seatsCost = guests * 3.75 + Math.ceil(guests / 8) * 14;
  const rentals = amounts.rentals >= seatsCost + 175 + 495 ? "chairs, tables, linens + a tent or décor" : amounts.rentals >= seatsCost + 175 ? "chairs & tables for everyone, delivered & set up" : "partial seating (cocktail-style)";
  const venueBuys = opts.haveVenue ? "your space" : amounts.venue >= 1500 ? "banquet hall, loft or restaurant buyout" : amounts.venue >= 600 ? "private room or park pavilion" : "home, backyard or a free community space";

  const buys: Record<BudgetLine["key"], string> = {
    food: `${food} (~$${Math.round(perGuest)}/guest)`, venue: venueBuys, music, rentals,
    coordination: "planner, vendor booking & on-site coordinator", contingency: "cake/dessert, décor touches, a cushion for surprises",
  };
  const lines: BudgetLine[] = keys.filter((k) => amounts[k] > 0).map((k) => ({ key: k, label: LABEL[k], amount: amounts[k], buys: buys[k] }));
  const warnings: string[] = [];
  if (perGuest < 15) warnings.push(`$${budget.toLocaleString("en-US")} is tight for ${guests} guests — about $${Math.round(perGuest)}/guest for food. Consider fewer guests, a food truck, or a larger budget.`);
  if (!opts.haveVenue && amounts.venue < 600) warnings.push("The venue share is small — hosting at home or a free space stretches this budget further.");
  return { budget, guests, perGuest: budget / guests, lines, warnings };
}
