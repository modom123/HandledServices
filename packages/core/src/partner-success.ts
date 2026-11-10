/*
 * FILE    : packages/core/src/partner-success.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-11-10_1430 UTC
 * PURPOSE : Partner Success: "partner success = Handled success". Three roadmaps that teach a partner how to grow their
 *           referral / sales business by selling more kinds of services, each a ladder of stages with goals we can
 *           measure from their real numbers, the actions that get them there and the services to sell at that stage:
 *             neighborhood — the Neighborhood Connector (friends, neighbors, local groups; referrals)
 *             property     — Property & Real Estate Accounts (realtors, property managers, landlords, HOAs; recurring work)
 *             field_sales  — the Field Sales Pro (direct sales on sales tickets; lead pay; commercial accounts)
 *           Plus the plays every roadmap uses: service bundles that turn one job into three, and a seasonal calendar.
 *           roadmapProgress() turns a partner's stats into where they are, what's done and the next step. Shown on
 *           /partner/grow, linked from the partner welcome email, printed in the Partner Success Playbook PDF.
 */
import { PARTNER_LADDER, REFERRAL_LADDER, SALES_DRAW, type PartnerKind } from "./partners.ts";
import { getService } from "./services.ts";

/** What we can measure for a partner (lib/partners.ts partnerGrowthStats). */
export interface PartnerGrowthStats {
  payoutsReady: boolean;
  customers: number;          // customers who are theirs (link, code, tickets)
  jobs: number;               // completed, paying jobs from their customers
  categories: number;         // different service categories their customers have booked
  recurring: number;          // customers on a recurring plan
  accounts: number;           // business / property accounts
  leads: number;              // sales tickets written (Field Sales)
  directJobs: number;         // completed jobs from customers they sold directly
  earned: number;             // commissions earned (paid + pending), dollars
  referralRate: number;       // their current referral rate (share of the job price)
  salesRate: number;          // their current direct-sales rate (share of our profit)
}
export type GoalMetric = Exclude<keyof PartnerGrowthStats, "payoutsReady" | "referralRate" | "salesRate"> | "payoutsReady" | "referralRate" | "salesRate";
export interface Goal { metric: GoalMetric; target: number; label: string }
export interface Stage { id: string; name: string; why: string; goals: Goal[]; actions: string[]; sell: string[]; unlocks: string }
export interface Roadmap { id: "neighborhood" | "property" | "field_sales"; name: string; forWho: string; promise: string; kinds: PartnerKind[]; stages: Stage[] }

const pct = (r: number) => `${+(r * 100).toFixed(2)}%`;
const START: Stage = {
  id: "start", name: "Set up and share", why: "You can't be paid until payouts are set up, and nobody books until they've seen your link.",
  goals: [{ metric: "payoutsReady", target: 1, label: "Payouts set up" }, { metric: "customers", target: 1, label: "Your first customer" }],
  actions: ["Set up payouts on your partner page (2 minutes, Stripe).", "Send your short link to 10 people who own a home or run a business.", "Put your code on your business card, email signature and social profiles."],
  sell: ["house-cleaning", "junk-removal", "handyman"],
  unlocks: "Your first commission, paid on a Monday.",
};

export const PARTNER_ROADMAPS: Roadmap[] = [
  {
    id: "neighborhood", name: "Neighborhood Connector", kinds: ["customer", "other", "pro", "contractor"],
    forWho: "Anyone with a network: neighbors, friends, family, local groups, your customers. A few hours a week.",
    promise: "Turn the people you already know into steady monthly commissions by sending them more than one kind of service.",
    stages: [
      START,
      {
        id: "repeat", name: "Make it repeat", why: "A customer on a plan pays you every visit for 12 months. One weekly cleaning is worth more than ten one-time jobs.",
        goals: [{ metric: "customers", target: 5, label: "5 customers" }, { metric: "recurring", target: 1, label: "1 customer on a recurring plan" }],
        actions: ["Ask every customer you send: \"Want it every two weeks? Plans save up to 20%.\"", "Follow up a week after their first job: how did it go, what else is on their list?", "Share your link in your neighborhood group or HOA newsletter (with permission)."],
        sell: ["house-cleaning", "lawn-care", "dog-walking", "trash-bin-cleaning"],
        unlocks: "Monthly commissions that keep coming without new work from you.",
      },
      {
        id: "cross_sell", name: "Sell the whole list", why: "Every home has a to-do list. Customers who book three kinds of services stay longer and pay you more.",
        goals: [{ metric: "categories", target: 3, label: "Customers in 3 service categories" }, { metric: "jobs", target: 15, label: "15 paying jobs" }],
        actions: ["Use the bundles: after a cleaning, suggest windows and carpets; after a lawn, suggest gutters and power washing.", "Use the seasonal calendar below: send the right service before your customers think of it.", "Send referral tickets with photos for bigger jobs (painting, repairs, remodels). They pay more."],
        sell: ["window-cleaning", "carpet-cleaning", "gutter-cleaning", "power-washing", "interior-painting"],
        unlocks: `Faster raises: every 10 job credits is +1 point, up to ${pct(REFERRAL_LADDER.jobsCapRate)} of the job price.`,
      },
      {
        id: "community", name: "Become the neighborhood go-to", why: "When people ask \"who do you use?\", the answer is your link.",
        goals: [{ metric: "customers", target: 25, label: "25 customers" }, { metric: "recurring", target: 5, label: "5 customers on plans" }, { metric: "referralRate", target: 0.18, label: "Referral rate 18%+" }],
        actions: ["Host a table at a block party or school event with your short link and a QR code.", "Partner with a local business (barber, coffee shop) to keep your cards at the counter.", "Recruit a pro you'd vouch for: they earn, you earn, and your customers get a pro you trust."],
        sell: ["holiday-lights", "snow-removal", "leaf-removal", "event-package", "small-moves"],
        unlocks: `A rate climbing toward ${pct(REFERRAL_LADDER.topRate)} of every job, for 12 months per customer.`,
      },
    ],
  },
  {
    id: "property", name: "Property & Real Estate Accounts", kinds: ["realtor", "property_manager", "business"],
    forWho: "Realtors, property managers, landlords, HOAs and business owners: people who control a lot of recurring work.",
    promise: "Land a few accounts that order every month, and bundle every service a property needs.",
    stages: [
      { ...START, actions: ["Set up payouts on your partner page (2 minutes, Stripe).", "Send your next listing or vacant unit as a referral ticket (photos, unit details, timing).", "Tell your team and your clients' sellers about the upfront price and photo proof."], sell: ["unit-turnover", "house-cleaning", "junk-removal"] },
      {
        id: "first_account", name: "Your first account", why: "One property manager or office can order every month. That's a commission every month, for 12 months.",
        goals: [{ metric: "accounts", target: 1, label: "1 business or property account" }, { metric: "jobs", target: 5, label: "5 paying jobs" }],
        actions: ["Turn a one-time job into an account: \"Want every turnover handled the same way, on one monthly invoice?\"", "Offer the make-ready bundle for every vacant unit: cleaning, junk, paint touch-ups and repairs.", "Get the decision maker's OK to send future units straight to us."],
        sell: ["unit-turnover", "interior-painting", "handyman", "carpet-cleaning"],
        unlocks: "Recurring account work: the steadiest commissions in the program.",
      },
      {
        id: "portfolio", name: "Cover the whole property", why: "Grounds, snow, gutters and repairs repeat all year. Sell the property, not the job.",
        goals: [{ metric: "accounts", target: 3, label: "3 accounts" }, { metric: "categories", target: 4, label: "4 service categories" }, { metric: "recurring", target: 2, label: "2 recurring contracts" }],
        actions: ["Walk each property with the manager and list every service it needs this year.", "Set up seasonal contracts early: lawn in spring, leaves in fall, snow before the first storm.", "Bring in commercial work: offices, retail and clinics need janitorial, windows and grounds."],
        sell: ["lawn-care", "snow-removal", "leaf-removal", "gutter-cleaning", "power-washing", "pest-control"],
        unlocks: `A referral rate on the way to ${pct(REFERRAL_LADDER.topRate)}, earned on every visit to every property.`,
      },
      {
        id: "book", name: "Build a book of business", why: "Ten accounts that order monthly is a real business, and every one is our customer too.",
        goals: [{ metric: "accounts", target: 10, label: "10 accounts" }, { metric: "earned", target: 5000, label: "$5,000 earned" }],
        actions: ["Ask every happy manager for one introduction a quarter.", "Join your local landlord association or BOMA chapter and bring your link.", "Use direct sales for the deals you close yourself: you earn on our profit instead, up to 45%."],
        sell: ["roofing", "exterior-painting", "fence-install", "driveway-sealcoating", "security-guard"],
        unlocks: "The biggest jobs in the catalog, on accounts that keep ordering.",
      },
    ],
  },
  {
    id: "field_sales", name: "Field Sales Pro", kinds: ["sales_rep"],
    forWho: "People who like talking to customers face to face, part-time or full-time. You close the sale on the spot.",
    promise: `Write leads, close sales from your phone and climb from ${pct(PARTNER_LADDER.baseRate)} to ${pct(PARTNER_LADDER.topRate)} of our profit.`,
    stages: [
      { ...START, goals: [{ metric: "payoutsReady", target: 1, label: "Payouts set up" }, { metric: "leads", target: 1, label: "Your first sales ticket" }], actions: ["Set up payouts on your partner page (2 minutes, Stripe).", "Pick one neighborhood or commercial strip and walk it for two hours.", "Look for visible work: overgrown lawns, full gutters, dirty windows, junk by the curb."] },
      {
        id: "unlock", name: "Unlock lead pay", why: `Lead pay (${"$" + SALES_DRAW.perLead} per lead) starts after ${SALES_DRAW.unlockLeads} leads and ${SALES_DRAW.unlockPaidSales} paid-out sale.`,
        goals: [{ metric: "leads", target: SALES_DRAW.unlockLeads, label: `${SALES_DRAW.unlockLeads} sales tickets` }, { metric: "directJobs", target: SALES_DRAW.unlockPaidSales, label: "1 closed, paid sale" }],
        actions: ["Take 3–4 photos with the owner's OK and fill out the sales ticket on the spot.", "Show the upfront price right away and let them pay on your phone.", "Follow up the next day with everyone who said \"let me think about it\"."],
        sell: ["lawn-care", "gutter-cleaning", "window-cleaning", "power-washing", "junk-removal"],
        unlocks: `${"$" + SALES_DRAW.perLead} for every lead (up to ${SALES_DRAW.weeklyCap} a week), paid weekly.`,
      },
      {
        id: "route", name: "Build your route", why: "Every customer you sell pays you on every job for 12 months. A route of recurring customers compounds.",
        goals: [{ metric: "directJobs", target: 20, label: "20 completed direct-sale jobs" }, { metric: "recurring", target: 3, label: "3 customers on plans" }],
        actions: ["Sell the plan, not the visit: weekly lawn, biweekly cleaning, monthly pest control.", "Use bundles to raise every ticket: lawn + gutters + power washing.", "Work the same streets weekly so neighbors see the pros at work."],
        sell: ["lawn-care", "house-cleaning", "pest-control", "trash-bin-cleaning", "pool-service"],
        unlocks: `Fast track: every 10 job credits (a sale counts 1.5) is +1 point, up to ${pct(PARTNER_LADDER.jobsCapRate)} of our profit.`,
      },
      {
        id: "commercial", name: "Go commercial", why: "Offices, retail, restaurants and property managers order every week and pay the biggest commissions.",
        goals: [{ metric: "accounts", target: 2, label: "2 commercial accounts" }, { metric: "salesRate", target: 0.2, label: "Sales rate 20%+" }, { metric: "earned", target: 10000, label: "$10,000 earned" }],
        actions: ["Visit businesses before opening or after the lunch rush and ask for the owner or manager.", "Lead with what hurts: a dirty entrance, overflowing dumpster area, a parking lot that needs sealing.", "Bundle the facility: janitorial-style cleaning, windows, grounds, snow and repairs on one account."],
        sell: ["house-cleaning", "window-cleaning", "snow-removal", "driveway-sealcoating", "security-guard", "website-design"],
        unlocks: `The ladder all the way to ${pct(PARTNER_LADDER.topRate)} of our profit on every job you sold.`,
      },
    ],
  },
];

/** Bundles: one job becomes three. Every slug is a real service (tested). */
export const SERVICE_PLAYS: { name: string; when: string; services: string[] }[] = [
  { name: "Move-out / make-ready", when: "Someone's moving, selling, or a unit is empty", services: ["house-cleaning", "junk-removal", "interior-painting", "carpet-cleaning", "handyman"] },
  { name: "Curb appeal", when: "A home is going on the market, or it's spring", services: ["power-washing", "gutter-cleaning", "landscaping", "window-cleaning", "exterior-painting"] },
  { name: "Clean home, every week", when: "After any one-time cleaning", services: ["house-cleaning", "window-cleaning", "carpet-cleaning", "organizing"] },
  { name: "Yard all year", when: "Any lawn customer", services: ["lawn-care", "leaf-removal", "snow-removal", "sprinkler-service", "tree-removal"] },
  { name: "Fix-it list", when: "Any homeowner with a to-do list", services: ["handyman", "furniture-assembly", "plumbing", "lighting-install", "smart-home-setup"] },
  { name: "Facility account", when: "Offices, retail, restaurants, clinics", services: ["house-cleaning", "window-cleaning", "pest-control", "snow-removal", "security-guard"] },
];

/** What to sell when (Michigan & Washington seasons). */
export const SEASONAL_CALENDAR: { season: string; months: string; services: string[] }[] = [
  { season: "Spring", months: "Mar–May", services: ["lawn-care", "gutter-cleaning", "power-washing", "sprinkler-service", "window-cleaning"] },
  { season: "Summer", months: "Jun–Aug", services: ["pool-service", "deck-build", "exterior-painting", "small-moves", "event-package"] },
  { season: "Fall", months: "Sep–Nov", services: ["leaf-removal", "gutter-cleaning", "holiday-lights", "chimney-sweep", "duct-cleaning"] },
  { season: "Winter", months: "Dec–Feb", services: ["snow-removal", "holiday-lights", "interior-painting", "house-cleaning", "home-watch"] },
];

export const serviceName = (slug: string) => getService(slug)?.name ?? slug;

/** The roadmap that fits a kind of partner. */
export const roadmapFor = (kind: string | null | undefined): Roadmap => PARTNER_ROADMAPS.find((r) => r.kinds.includes(kind as PartnerKind)) ?? PARTNER_ROADMAPS[0];

/** Where a partner is on a roadmap: every goal's progress, the current stage, and the next thing to do. */
export function roadmapProgress(r: Roadmap, s: PartnerGrowthStats) {
  const value = (g: Goal) => (g.metric === "payoutsReady" ? (s.payoutsReady ? 1 : 0) : Number(s[g.metric] ?? 0));
  const stages = r.stages.map((st) => {
    const goals = st.goals.map((g) => { const v = value(g); return { ...g, value: v, done: v >= g.target, share: Math.max(0, Math.min(1, g.target ? v / g.target : 1)) }; });
    return { ...st, goals, done: goals.every((g) => g.done) };
  });
  const current = stages.findIndex((x) => !x.done);
  const at = current === -1 ? stages.length - 1 : current;
  const nextGoal = current === -1 ? null : stages[current].goals.find((g) => !g.done) ?? null;
  return { stages, current: at, complete: current === -1, nextGoal, nextAction: current === -1 ? null : stages[current].actions[0] };
}
