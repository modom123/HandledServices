/*
 * FILE    : packages/core/src/partner-welcome.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-11-10_1400 UTC
 * PURPOSE : The partner's welcome email and the payout-setup reminders (pure functions; lib/partners.ts sends them).
 *             partnerWelcomeEmail()  — sent at sign-up: STEP 1 set up payouts (one tap, Stripe; pros are already set
 *                                      up), their code and links, both ways to earn with the real rates and how they
 *                                      climb, Field Sales lead pay, what counts, when they're paid, tips for their kind
 *                                      of partner, the rules and where to get help
 *             PAYOUT_REMINDER_DAYS / payoutReminderDay() / partnerPayoutReminder()
 *                                    — the days after sign-up we remind a partner whose payouts aren't set up yet
 *                                      (the daily sweep, no extra state needed), and the reminder itself
 *           Every number comes from the shared rules (PARTNER_PROGRAM, REFERRAL_LADDER, PARTNER_LADDER, SALES_DRAW).
 */
import { BRAND } from "./brand.ts";
import { PARTNER_LADDER, PARTNER_PROGRAM, REFERRAL_LADDER, SALES_DRAW, ladderTable, type PartnerKind } from "./partners.ts";

const pct = (r: number) => `${+(r * 100).toFixed(2)}%`;
const usd = (n: number) => `$${n % 1 ? n.toFixed(2) : n.toLocaleString("en-US")}`;
const firstName = (name: string) => String(name ?? "").trim().split(/\s+/)[0] || "there";

/** Who they told us they are → where their best customers are. */
const TIPS: Record<PartnerKind, string[]> = {
  realtor: ["Every listing needs a move-out or deep clean, junk removal and small repairs before photos.", "Buyers need movers, cleaning, lawn and handyman work the week they move in.", "Put your short link on your listing packets and closing notes."],
  property_manager: ["Unit turnovers, grounds, snow and repairs repeat every month, so one account keeps paying you.", "Send each property as a referral ticket and it's yours for 12 months."],
  contractor: ["Send us the jobs you don't do yourself: cleaning after construction, haul-away, painting, lawn.", "Your customers stay yours; you just earn on the work you hand off."],
  business: ["Office cleaning, grounds, repairs, courier and events are recurring work.", "Refer the businesses next door, your landlord and your suppliers."],
  customer: ["Friends, family and neighbors who need the same services you book.", "Share your short link in your neighborhood group or with your HOA."],
  pro: ["Jobs you see that aren't your trade: snap photos and send a referral ticket.", "Your commissions arrive in the same weekly payout as your jobs."],
  sales_rep: ["Walk a neighborhood or a commercial strip: homeowners, landlords and businesses with visible work (lawns, gutters, windows, cleaning, junk).", "Write a sales ticket on the spot (3–4 photos with their OK) and let them pay from your phone. A closed sale pays more than a referral.", "Follow up the next day with anyone who needed time to decide."],
  other: ["Anyone you know who needs a home or business service.", "Share your short link in texts, social posts and on your business card."],
};

export function partnerWelcomeEmail(p: { name: string; code: string; kind: PartnerKind | string }, o: { site: string; portalUrl: string; isPro?: boolean; payoutsReady?: boolean }): { subject: string; text: string } {
  const site = o.site.replace(/\/$/, "");
  const link = `${site}/home?partner=${p.code}`;
  const short = `${site}/r/${p.code}`;
  const P = PARTNER_PROGRAM;
  const refTop = pct(REFERRAL_LADDER.topRate), refBase = pct(REFERRAL_LADDER.baseRate);
  const saleTop = pct(PARTNER_LADDER.topRate), saleBase = pct(PARTNER_LADDER.baseRate);
  const ref = ladderTable(REFERRAL_LADDER), sale = ladderTable(PARTNER_LADDER);
  const at = (rows: { level: number; rate: number; profit: number }[], lv: number[]) => rows.filter((r) => lv.includes(r.level)).map((r) => `${pct(r.rate)} at ${usd(r.profit)}`).join(" · ");
  const kind = (p.kind in TIPS ? p.kind : "other") as PartnerKind;
  const sales = kind === "sales_rep";

  const payout = o.isPro
    ? ["STEP 1: PAYOUTS", "You're already set up: your commissions go to the same bank as your job payouts, every Monday. Nothing to do."]
    : o.payoutsReady
      ? ["STEP 1: PAYOUTS", "Your payouts are already set up. Commissions go to your bank every Monday."]
      : ["STEP 1: SET UP YOUR PAYOUTS (2 minutes, do it now)",
         "We can only pay you once this is done, so do it before you share your link:",
         `  1. Open your partner page: ${o.portalUrl}`,
         "  2. Tap \"Set up payouts\". Stripe opens (our payment partner).",
         "  3. Add your bank account or debit card and confirm your details. Stripe also collects the tax info for a 1099 if you earn $600+ in a year.",
         `  4. You're back on your partner page and it shows "Payouts ready". From then on you're paid every Monday.`,
         "Your bank details go to Stripe, never to us."];

  const text = [
    `Hi ${firstName(p.name)},`,
    "",
    `Welcome to the ${BRAND.name} Partner Program! You're in, and you can start earning today.`,
    "",
    ...payout,
    "",
    "YOUR CODE AND LINKS",
    `  • Partner code: ${p.code} (new customers can type it when they pay)`,
    `  • Your link: ${link}`,
    `  • Short link for texts and business cards: ${short}`,
    `  • Your partner page (one tap, no password): ${o.portalUrl}`,
    "",
    "TWO WAYS TO EARN",
    `1. Referrals: you send them, we sell it. Share your link or code, or send a referral ticket from your partner page. You earn ${refBase} of the job price on every completed job from that customer for ${P.months} months, rising to ${refTop} as you grow.`,
    `2. Direct sales: you sell it. Write a sales ticket (3–4 photos with the customer's OK) and the customer pays ${BRAND.name} on your phone or from our text. You earn ${saleBase} of our profit on the job, rising to ${saleTop}, on every job from that customer for ${P.months} months.`,
    sales ? `   Field Sales lead pay: ${usd(SALES_DRAW.perLead)} for every lead (a complete sales ticket for a new customer), up to ${SALES_DRAW.weeklyCap} a week. It's an advance on that lead's commission: when the job pays, the ${usd(SALES_DRAW.perLead)} comes out of it; if the lead never books, you keep it. Lead pay starts after your first ${SALES_DRAW.unlockLeads} leads and ${SALES_DRAW.unlockPaidSales} paid-out sale, and what you built up is paid that week.` : null,
    "",
    "HOW YOUR RATE CLIMBS",
    "Every raise is one point, the first ones come quickly, and your rate never goes down. Raises come from the profit your customers' jobs bring in (direct sales count 1.5×, referrals 1×):",
    `  • Referrals: ${at(ref, [1, 2, 5, 10, 15])}`,
    `  • Direct sales: ${at(sale, [1, 2, 5, 10, 20, 35])}`,
    `  • Fast track: every ${PARTNER_LADDER.jobsPerStep} jobs also moves you up a point, up to ${pct(PARTNER_LADDER.jobsCapRate)}.`,
    "Your partner page shows your rate and exactly what gets you the next raise.",
    "",
    "WHAT COUNTS AS YOUR CUSTOMER",
    `  • Someone new to ${BRAND.name} who books within ${P.cookieDays} days of clicking your link, types your code when they pay, or comes from your referral or sales ticket.`,
    "  • Each customer belongs to the first partner who sent them.",
    "  • Referring yourself, your household or your own business doesn't count.",
    "",
    "WHEN YOU'RE PAID",
    `  • Every Monday, by direct deposit through Stripe, once each job is ${P.holdDays} days past completion (our make-it-right window).`,
    `  • Balances under ${usd(P.minPayout)} roll over to the next week. A refund reduces the commission on that job.`,
    "",
    "WHERE TO FIND CUSTOMERS",
    ...TIPS[kind].map((t) => `  • ${t}`),
    "",
    "THE RULES",
    "  • Only send people who agreed to hear from us, and only photograph property with the owner's OK.",
    "  • Never take payment yourself, and don't promise prices or services we didn't offer.",
    "  • No spam and no fake reviews. Breaking the rules ends the partnership.",
    `  • You're an independent partner, not an employee. We send a 1099 if you earn $600+ in a year. Full terms: ${site}/partners`,
    "",
    "HELP",
    `  • ${BRAND.supportPhone} · ${BRAND.supportEmail}`,
    "",
    "Thanks for joining. Every customer you send gets an upfront price, a vetted pro and a free redo if anything's missed, so they're easy to send.",
    `— ${BRAND.name}`,
  ].filter((x): x is string => x !== null).join("\n");
  return { subject: `Welcome to the ${BRAND.name} Partner Program: set up your payouts first`, text };
}

/** Days after sign-up we remind a partner whose payouts still aren't set up (the daily sweep sends on these days only). */
export const PAYOUT_REMINDER_DAYS = [1, 3, 7, 14] as const;

/** Which reminder (by day) is due today for a partner who signed up at `createdAt`, or null. */
export function payoutReminderDay(createdAt: string | Date, now = new Date()): number | null {
  const days = Math.floor((now.getTime() - new Date(createdAt).getTime()) / 86400000);
  return (PAYOUT_REMINDER_DAYS as readonly number[]).includes(days) ? days : null;
}

export function partnerPayoutReminder(p: { name: string }, o: { portalUrl: string; day: number; waiting?: number }): { subject: string; text: string } {
  const last = o.day >= PAYOUT_REMINDER_DAYS[PAYOUT_REMINDER_DAYS.length - 1];
  const text = [
    `Hi ${firstName(p.name)},`,
    "",
    o.waiting ? `You have ${usd(o.waiting)} in ${BRAND.name} commissions, and we can't send it until your payouts are set up.` : `Your ${BRAND.name} partner payouts aren't set up yet, so we couldn't pay you if a customer you sent booked today.`,
    "",
    "It takes about 2 minutes:",
    `  1. Open your partner page: ${o.portalUrl}`,
    "  2. Tap \"Set up payouts\" and add your bank account or debit card with Stripe (our payment partner).",
    "  3. That's it. You're paid every Monday from then on.",
    "",
    last ? "This is our last reminder. Your commissions are kept safe until you finish." : "Anything you earn in the meantime is kept safe until you finish.",
    `Questions? ${BRAND.supportPhone} · ${BRAND.supportEmail}`,
    "",
    `— ${BRAND.name}`,
  ].join("\n");
  return { subject: o.waiting ? `${usd(o.waiting)} is waiting: set up your ${BRAND.name} payouts` : `Set up your ${BRAND.name} payouts (2 minutes)`, text };
}
