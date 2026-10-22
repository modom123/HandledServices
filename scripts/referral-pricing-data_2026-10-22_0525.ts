/*
 * FILE    : scripts/referral-pricing-data_2026-10-22_0525.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-22_0525 UTC
 * PURPOSE : Numbers for the referral pricing PDF, straight from the pricing engine and the referral rules in
 *           @handled/core (splitJob, estimate, moneySplit, referralCostShares) — no hand math. Prints JSON.
 *           Run: node --experimental-strip-types scripts/referral-pricing-data_2026-10-22_0525.ts > out.json
 */
import { splitJob, estimate } from "../packages/core/src/pricing.ts";
import { PARTNER_PROGRAM, REFERRAL_COST_SPLIT, moneySplit } from "../packages/core/src/partners.ts";
import { defaultAnswers, getService } from "../packages/core/src/services.ts";

const P = PARTNER_PROGRAM;
const example = (title: string, slug: string, price: number, visits: number, rates: [string, number][], note: string) => {
  const s = splitJob(price, slug);
  return {
    title, slug, service: getService(slug)!.name, price, visits, note, payout: s.payout, take: s.take, takeRate: s.takeRate,
    rows: rates.flatMap(([label, pct]) => [false, true].map((proPays) => ({ label, pct, proPays, ...moneySplit({ price, payout: s.payout }, pct, proPays) }))),
  };
};
const quote = (label: string, slug: string, answers: Record<string, unknown>) => {
  const svc = getService(slug)!;
  const e = estimate({ slug, answers: { ...defaultAnswers(svc), ...answers } as never });
  const s = splitJob(e.point, slug);
  const once = moneySplit({ price: e.point, payout: s.payout }, P.jobOncePct, true); // one-time ticket, shared bonus
  return { label, service: svc.name, low: e.low, high: e.high, point: e.point, payout: s.payout, take: s.take, siteVisit: svc.siteVisit, items: e.items.map((i) => ({ label: i.label, amount: i.amount })),
    ticketOnce: { referrer: once.referrer, proShare: once.proShare, handledShare: once.handledShare, pro: once.pro, handled: once.handled } };
};

console.log(JSON.stringify({
  generated: new Date().toISOString(),
  rates: { person: P.pctOfTake, jobOnce: P.jobOncePct, jobRecurring: P.jobRecurringPct, months: P.months, holdDays: P.holdDays, minPayout: P.minPayout },
  split: REFERRAL_COST_SPLIT,
  examples: [
    example("Landscaping — lawn care every 2 weeks", "lawn-care", 150, 26, [["Referral ticket — recurring job", P.jobRecurringPct], ["Referred person", P.pctOfTake]], "26 visits in 12 months. A recurring ticket pays on every visit for 12 months."),
    example("Roof replacement — one time", "roofing", 10000, 1, [["Referral ticket — one-time job", P.jobOncePct], ["Referred person", P.pctOfTake]], "Firm price set after the free roof inspection."),
  ],
  newServices: [
    quote("Roof replacement — asphalt, 2,000 sq ft, 1 story", "roofing", { work: "replace", roof_sqft: 2000, material: "asphalt", stories: "1" }),
    quote("Roof replacement — metal, 2,000 sq ft, 2 stories", "roofing", { work: "replace", roof_sqft: 2000, material: "metal", stories: "2" }),
    quote("Roof leak repair — 1 area", "roofing", { work: "repair", roof_sqft: 1800, repairs: 1 }),
    quote("Luxury vinyl plank — 600 sq ft, materials + removal", "flooring", { material: "lvp", sqft: 600, supply: "pro", remove: true }),
    quote("Hardwood — 400 sq ft, materials + removal", "flooring", { material: "hardwood", sqft: 400, supply: "pro", remove: true }),
    quote("Asphalt driveway — 600 sq ft, replace", "paving", { work: "replace", material: "asphalt", sqft: 600, remove: true }),
    quote("Driveway sealcoat — 600 sq ft", "paving", { work: "sealcoat", sqft: 600 }),
    quote("Tree trimming — 2 medium trees (30–60 ft)", "tree-trimming", { height_ft: 40, height: "medium", trees: 2 }),
  ],
}, null, 1));
