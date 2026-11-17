/*
 * FILE    : apps/web/lib/contracts/partner.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-11-17_2100 UTC
 * PURPOSE : Referral Partner Agreement (partner-v6) — the signable version of the Partner Program terms, for anyone who
 *           sends us customers: realtors, property managers, contractors, neighbors, Field Sales partners. Numbers come
 *           from core (REFERRAL_LADDER, PARTNER_PROGRAM, PARTNER_LADDER, SALES_DRAW, FIRST_PROJECT_REWARD) so the
 *           agreement, the website and the payouts always match. Rendered at /terms/referral-partner-agreement, accepted
 *           at sign-up (/partners) or on the partner page (/partner), recorded in contract_acceptances.
 *           v6 over v5 (same money rules, written out): business & property-account referrals; what is commissionable,
 *           with a worked example; the pro always pays their half (referred jobs only go to pros on the current pro
 *           agreement); conflicts of interest (no commission for a referred business's own people without that
 *           business's written consent); how credit is verified and disputed; payout timing.
 *           TEMPLATE — not legal advice; have counsel review before use.
 */
import { BRAND, FIRST_PROJECT_REWARD, PARTNER_LADDER, PARTNER_PROGRAM as P, REFERRAL_LADDER as R, SALES_DRAW, partnerSplit, splitJob } from "@handled/core";
import type { Contract, ContractSection } from "./types";

const N = BRAND.name;
const pct = (x: number) => `${Math.round(x * 100)}%`;
const usd = (x: number) => `$${x.toLocaleString("en-US", { minimumFractionDigits: Number.isInteger(x) ? 0 : 2, maximumFractionDigits: 2 })}`;
const p = (...paras: string[]) => paras.join("\n\n");
const ul = (...items: string[]) => items.map((i) => `• ${i}`).join("\n");
const COUNSEL = " [Confirm with counsel.]";
const numbered = (items: [string, string][]): ContractSection[] => items.map(([h, body], i) => ({ h: `${i + 1}. ${h}`, p: body }));

// the worked example: a $450 completed rental unit turnover at the starting rate
const EX_PRICE = 450;
const EX = partnerSplit({ price: EX_PRICE, payout: splitJob(EX_PRICE, "unit-turnover").payout, tier: "account", rate: R.baseRate });

export const REFERRAL_PARTNER_AGREEMENT: Contract = {
  key: "referral-partner-agreement",
  title: `${N} Referral Partner Agreement`,
  version: P.termsVersion,
  audience: "partner",
  appliesTo: `Anyone who joins the ${N} Partner Program to refer customers (people or businesses) or to sell ${N} services on a sales ticket.`,
  summary: [
    `Free to join. No website, storefront or paid account needed.`,
    `Referrals: ${pct(R.baseRate)} of the job price (what the customer pays, minus refunds; not sales tax or tips) on every completed job from a customer you refer, for ${P.months} months — rising to ${pct(R.topRate)} as you grow. Example: a ${usd(EX_PRICE)} completed turnover pays you ${usd(EX.amount)}.`,
    `Businesses and property managers count: when a business you refer signs with ${N} and pays ${N} directly, every completed job on its account is credited to you for ${P.months} months. Their price is never raised because of you.`,
    `Half your commission is paid by the pro who does the job and half by ${N}. You receive the full rate except on refunds, chargebacks, redo visits, or a rare job where ${N}'s margin after card fees can't cover its half.`,
    `Paid every Monday through Stripe once a job is ${P.holdDays} days past completion — about ${P.holdDays}–${P.holdDays + 6} days after the first job. Balances under ${usd(P.minPayout)} roll to the next week.`,
    `Every referred customer, job and commission is listed on your partner page. Report a missing credit within 90 days and we'll check it against our records.`,
    `No commission for referring yourself, your household, your own business, or a business you work for or help run — unless that business consents in writing first.`,
    `You're independent: you can't sign, promise prices or take payment for ${N}. Either side can end this at any time.`,
  ],
  sections: numbered([
    ["Who we are and what this covers", p(
      `This agreement is between ${BRAND.legalName} ("${N}", "we") and you, the partner. It covers the ${N} Partner Program: referring customers to ${N}, and (if you choose) selling ${N} services on a sales ticket. It replaces earlier versions of the partner terms for jobs booked after you accept it; jobs booked before keep the terms in place when they were booked.`,
      `You accept this agreement by signing it electronically when you join or on your partner page. Your typed name, the date and time, your IP address and the exact text are recorded.`,
    )],
    ["Joining", p(
      "Joining is free. You don't need a website, a storefront, a social media following or any paid account. You need to be at least 18, give us accurate contact details, and keep them current.",
      "You get a partner code, a personal link and access to your partner page, where you send referral and sales tickets and see every referral, job and commission. One partner account per person or business.",
    )],
    ["How a customer becomes yours", p(
      `A customer is credited to you when they are new to ${N} and, within the times below:`,
      ul(
        `they book through your link within ${P.cookieDays} days of clicking it;`,
        "they enter your partner code when they book or pay; or",
        "you send them to us on a referral ticket or a sales ticket from your partner page, with their permission to be contacted.",
      ),
      `Each customer belongs to one partner: the first one who meets these rules. Your credit lasts ${P.months} months from the referral and covers every completed job from that customer in that time. "New to ${N}" means they haven't booked with us, or been referred by someone else, before.`,
    )],
    ["Business and property-management referrals", p(
      `You may refer a business — for example a property management company, landlord, HOA or commercial client — that contracts with ${N} under our Business Services Agreement and pays ${N} directly.`,
      `Once that business is credited to you, every completed job booked on its business account in the ${P.months} months counts, across all of its properties and units, whoever at the business books it.`,
      `${N} alone sets the business's prices, scope and terms. The business never pays more because it was referred. You may share our published prices and the Business Services Agreement, but you may not promise a price, discount, date or result we haven't confirmed in writing.`,
    )],
    ["What you earn on referrals", p(
      `Your referral rate starts at ${pct(R.baseRate)} and is the same on every service. It rises one point at a time to ${pct(R.topRate)} as your level credit grows (${pct(R.topRate)} at ${usd(R.topProfit)} of level credit: the lifetime profit you've generated for ${N}, with direct sales counting ${PARTNER_LADDER.directCredit}× and referrals ${PARTNER_LADDER.referralCredit}×), or every ${R.jobsPerStep} job credits up to ${pct(R.jobsCapRate)}. The rate is locked on each job when it's booked.`,
      `Commissionable amount: the price the customer pays ${N} for a completed job, minus any refund, credit or chargeback on that job. It does not include sales tax or tips.`,
      `Your commission on a job = your locked rate × the commissionable amount, rounded down to the cent.`,
      `Example: a business you referred books a rental unit turnover. The job is completed for ${usd(EX_PRICE)} with no refund. At ${pct(R.baseRate)} you earn ${usd(EX.amount)} — ${usd(EX.fromPro)} from the pro's pay and ${usd(EX.fromUs)} from ${N}. The business still pays ${usd(EX_PRICE)}.`,
    )],
    ["Who pays your commission, and what can reduce it", p(
      `Half of each referral commission is paid by the ${N} pro who does the job (it comes out of their pay for that job, under the pro agreement they accepted) and half by ${N}. Referred jobs are only offered to pros who have accepted that term, so the pro's half is always paid.`,
      "Your commission on a job can be lower than your full rate, or zero, only when:",
      ul(
        "the job is refunded, credited or charged back (in part or in full) — the commission follows the amount the customer actually paid;",
        `the visit is a free redo or make-it-right visit under our guarantee — those earn nothing;`,
        `on the rare job where what ${N} keeps after paying the pro and the card fee is less than ${N}'s half — ${N}'s half is then limited to what it kept, so a referred job never costs ${N} money; or`,
        "the job was cancelled, or was booked after your 12-month credit ended.",
      ),
      `If a refund or chargeback happens after you were paid, the difference is taken from your next commissions.`,
    )],
    ["Direct sales (Field Sales)", p(
      `If you sell a customer yourself on a sales ticket and they pay ${N} directly, you earn a share of ${N}'s profit on the job (the price minus what the pro is paid and any refunds) instead of the referral rate, paid by ${N} alone, on every completed job from that customer for ${P.months} months. The share starts at ${pct(PARTNER_LADDER.baseRate)} and rises one point at a time to ${pct(PARTNER_LADDER.topRate)} (at ${usd(PARTNER_LADDER.topProfit)} of lifetime direct-sale profit), or every ${PARTNER_LADDER.jobsPerStep} completed direct-sale jobs up to ${pct(PARTNER_LADDER.jobsCapRate)}. It never goes down.`,
      `Lead pay: ${usd(SALES_DRAW.perLead)} per complete sales ticket for a new customer (up to ${SALES_DRAW.weeklyCap} a week), as an advance against that lead's commission. It starts once you've written ${SALES_DRAW.unlockLeads} leads and at least ${SALES_DRAW.unlockPaidSales} sale has closed and been paid out. When the lead's job pays you a commission, the advance comes back out of it; if the lead never books, you keep it. Fake or duplicate leads earn nothing.`,
    )],
    ["Your own first project", p(
      `Referring yourself, your household or your own business earns nothing — with one exception: if you join by posting your own project on our Post your project page and you're new to ${N}, your own first project pays you ${pct(FIRST_PROJECT_REWARD.rate)} of its price (minus refunds), up to ${usd(FIRST_PROJECT_REWARD.cap)}, once, paid by ${N} alone.`,
    )],
    ["When and how you're paid", p(
      `Commissions are paid in our weekly Monday payout once a job is ${P.holdDays} days past completion (our make-it-right window, so refunds come first). For a job completed today, that's the first Monday on or after day ${P.holdDays} — about ${P.holdDays}–${P.holdDays + 6} days later.`,
      `Payouts go to a Stripe account in your name, which you set up once from your partner page (bank account or debit card). Balances under ${usd(P.minPayout)} roll to the next week. Nothing is paid until your payout setup is complete; your balance waits safely until it is.`,
      `Taxes: you are responsible for taxes on what you earn. Stripe collects your tax details; if we pay you ${usd(600)} or more in a calendar year, we send you a Form 1099.`,
    )],
    ["Seeing and checking your credit", p(
      "Your partner page lists each customer credited to you, the date and how they were credited (link, code or ticket), every completed job, its commissionable amount, your rate, your commission and its payout status. You can ask us for a statement at any time.",
      `If you believe a customer or job should have been credited to you, tell us within 90 days of the job's completion, with what you have (the ticket number, the date you sent your link, the customer's name). We'll check our records — link clicks, codes entered and tickets — and answer within 30 days. Credit is decided by those records; claims made after 90 days aren't reviewed.`,
    )],
    ["Conflicts of interest", p(
      "You may not earn a commission on:",
      ul(
        "yourself, your household, or a business you own;",
        "a business you work for, are an officer, director, partner or agent of, or for which you decide or influence what services it buys — unless that business has agreed in writing, before its first job, that you may be paid by us for the referral, and you've sent us a copy;",
        "a customer you're already being paid to advise on choosing a service provider, unless you've told that customer in writing that we pay you.",
      ),
      `You will never share or offer any part of your commission to the customer's employees or decision-makers, and never present yourself as neutral when recommending ${N}. We may ask you to confirm in writing that a referral meets this section, and we may hold or cancel commissions that don't.${COUNSEL}`,
    )],
    ["How you refer", p(
      ul(
        "Only send us people and businesses who have agreed to be contacted by us. No spam: follow the laws on calls, texts and email (no autodialed or prerecorded calls or texts without consent; honor every opt-out).",
        `Describe ${N} honestly, using our published information. No fake reviews, no false claims, no pretending to be ${N} staff.`,
        "Only photograph property with the owner's or manager's permission.",
        `Never take payment for ${N}. Customers pay ${N} directly.`,
        `You may use our name and logo only to describe the program and only as we provide them; no paid search ads on "${N}" brand terms.`,
      ),
    )],
    ["Independent relationship", p(
      `You're an independent referral partner. You are not an employee, agent, franchisee or joint venturer of ${N}, and you can't sign contracts, make promises or accept payment for ${N}. You decide how, when and whether to refer, and you pay your own expenses.`,
    )],
    ["Customer information", p(
      `Use any customer information you receive or send only to make the referral. Keep it private and don't sell or reuse it. ${N} handles customer information under its Privacy Policy.`,
    )],
    ["Changes", p(
      `We may change this agreement or the program with at least 30 days' notice by email and on your partner page. Commissions already earned, and jobs already booked, are paid under the terms in place when the job was booked. If you don't agree to a change, you can end this agreement before it takes effect.`,
    )],
    ["Ending this agreement", p(
      "Either of us may end this agreement at any time by email. Commissions on jobs booked before the end date are still paid when earned under these terms.",
      "If you break sections 11 or 12, or commit fraud, we may end this agreement immediately, and unpaid commissions on the affected referrals are forfeited. Paid commissions on fraudulent referrals must be returned.",
    )],
    ["Liability", p(
      `${N} is responsible for the services it provides to customers under its customer agreements; you aren't. You're responsible for your own statements and conduct, and you'll cover ${N}'s losses caused by your breaking this agreement or the law. Neither of us is liable to the other for indirect or lost-profit damages, and ${N}'s total liability to you under this agreement is limited to the commissions owed to you.${COUNSEL}`,
    )],
    ["General", p(
      `This agreement is governed by Michigan law, and disputes go to the state or federal courts serving Wayne County, Michigan.${COUNSEL} It is the whole agreement about the Partner Program and replaces earlier partner terms going forward. If any part can't be enforced, the rest still applies. Electronic signatures and records are valid. You can't transfer this agreement without our written consent.`,
    )],
  ]),
};
