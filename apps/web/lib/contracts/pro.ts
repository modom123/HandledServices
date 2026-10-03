/*
 * FILE    : apps/web/lib/contracts/pro.ts
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-03_0039 UTC
 * PURPOSE : Every contract a pro (independent contractor) signs in the pro portal:
 *             PRO_AGREEMENT                — Independent Contractor Agreement (replaces and expands the
 *                                            v2 text in lib/agreement.ts; keeps every v2 promise)
 *             PRO_CODE_OF_CONDUCT          — how we all treat customers, homes and each other
 *             PRO_DEACTIVATION_POLICY      — the objective reasons offers can stop, notice and appeal
 *             PRO_BACKGROUND_CHECK_NOTICE  — plain-English FCRA explainer (not the standalone disclosure)
 *             PRO_LOCATION_CONSENT         — location sharing, texts/push/email, call recording
 *             PRO_ADDENDA                  — trade-specific terms (transportation, medical courier, …)
 *             CORE_ONLY_TRADES             — trades with no addendum (covered by the main agreement only)
 *           Numbers come from @handled/core (benefits, tiers, probation, take rate, coverages) so the
 *           contract always matches what the system does. Written to keep pros genuinely independent:
 *           free choice of offers, own schedule, methods, tools, helpers and other clients; quality
 *           judged by results. "[Confirm with counsel.]" marks real legal judgment calls.
 *           TEMPLATES — not legal advice; have counsel review before use.
 */
import {
  AGREEMENT_VERSION,
  BRAND,
  COVERAGES,
  LATE_CANCEL_FEE,
  LICENSED_TRADES,
  LOCATION_FRESH_MIN,
  ON_CALL_MAX_HOURS,
  PROBATION,
  PRO_POLICY_DEFAULTS,
  PRO_REFERRAL,
  PRO_TIERS,
  STATS_WINDOW_DAYS,
  TAKE_MAX,
  TAKE_MIN,
  TIP_MAX,
  TRADES,
  TRADE_PROFILES,
  money,
  necThreshold,
  type CoverageKey,
} from "@handled/core";
import type { Contract } from "./types";

// ─── Shared helpers ────────────────────────────────────────────────────────────

const COUNSEL = " [Confirm with counsel.]";
/** Version for every pro contract except the agreement (which follows AGREEMENT_VERSION). */
const POLICY_VERSION = "2026-10-v1";
const P = PRO_POLICY_DEFAULTS;
const L = BRAND.legalName;
const N = BRAND.name;
const pct = (n: number, digits = 0) => `${(n * 100).toFixed(digits)}%`;
const cents = (n: number) => `$${n.toFixed(2)}`;
const label = (id: string) => TRADES.find((t) => t.id === id)?.label ?? id;
const list = (xs: string[]) => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`);
/** Trades (by label) whose vetting profile requires this coverage. */
const tradesRequiring = (k: CoverageKey) => Object.entries(TRADE_PROFILES).filter(([, p]) => p.requires.includes(k)).map(([id]) => label(id));
/** Trades (by label) with a general-liability minimum above the base $1M. */
const highGlTrades = Object.entries(TRADE_PROFILES).filter(([, p]) => p.glMin > 1_000_000).map(([id, p]) => `${money(p.glMin)} for ${label(id)}`);
const NEC_YEAR = 2026;

/**
 * Objective deactivation thresholds referenced by the agreement and the Deactivation Policy.
 * Not yet enforced in code — the lead should move these into @handled/core and build the
 * warning → review → appeal workflow before relying on them.
 */
export const DEACTIVATION_RULES = {
  /** Average rating below this over the last `ratedJobs` rated jobs → written warning, then review. */
  minRating: 4.3,
  ratedJobs: 20,
  /** A pro cancellation inside this many hours of the arrival window is a "late cancel". */
  lateCancelHours: 24,
  /** Late cancels or no-shows counted over this window. */
  windowDays: STATS_WINDOW_DAYS,
  lateCancels: 3,
  noShows: 2,
  /** First-time photo-QA failures (that the pro didn't fix) over the window. */
  qaFailures: 4,
  /** Days a pro has to improve after a written warning before a review. */
  improveDays: 30,
  /** Days to ask for an appeal; days we take to decide it. */
  appealDays: 14,
  decisionDays: 7,
} as const;
const D = DEACTIVATION_RULES;

const tierLines = PRO_TIERS.map((t) =>
  t.payoutBoost
    ? `• ${t.name} — ${t.min.jobs}+ completed jobs, ${t.min.rating}★+ rating, ${pct(t.min.onTime)}+ on time and ${pct(t.min.acceptance)}+ of offers accepted: +${pct(t.payoutBoost)} of the job price added to every payout, and ranked ahead of lower tiers for offers.`
    : `• ${t.name} — every active pro. Standard payout shown on each offer.`,
).join("\n");

// ─── 1. Independent Contractor Agreement ─────────────────────────────────────────

export const PRO_AGREEMENT: Contract = {
  key: "pro-agreement",
  title: `${L} — Independent Contractor Agreement (v${AGREEMENT_VERSION})`,
  version: AGREEMENT_VERSION,
  audience: "pro",
  appliesTo: `Every pro (independent business) who accepts jobs through ${N}; signed in the pro portal before the first offer and re-signed whenever the version changes.`,
  summary: [
    "You run your own business. You choose which offers to take, when and where you work, how you do the work, and who helps you. You can work for anyone else, including our competitors.",
    "Every offer shows the scope, the date and your exact payout before you say yes. Customers prepay. Payouts go out free every week; instant cash-out is optional for a small fee.",
    "Discounts and promotions never reduce your payout. Tips are 100% yours. You never pay lead fees or a subscription.",
    `Fix workmanship problems within ${BRAND.guaranteeDays} days at no extra payout. A refund only comes out of your pay when your workmanship caused it — capped at that job's payout, with notice and a chance to respond.`,
    "Keep your insurance, licenses and documents current. Offers pause automatically when one expires and restart when it's renewed.",
    "Don't take customers you met through us off the platform for 12 months. There is no non-compete.",
    "We can stop sending offers only for the objective reasons in the Deactivation Policy, with written notice and a human appeal. Money you've earned is always paid.",
    "Disagreements go to an informal talk first, then individual arbitration — you can opt out of arbitration within 30 days of signing.",
  ],
  sections: [
    {
      h: "1. Who we are and what this agreement covers",
      p: `This agreement is between ${L} ("${N}", "we", "us") and you — the person or business that signs it ("you", "pro"). It covers every job you accept through the ${N} website, app or pro portal.\n\nThe whole agreement is made up of: this document; the ${N} Pro Code of Conduct; the Pro Deactivation Policy; the Background Check Notice; the Location & Communications Consent; any trade addendum for the trades you do; and the work order for each job you accept. If they conflict, a trade addendum wins over this document for that trade, and this document wins over a work order.`,
    },
    {
      h: "2. You run an independent business",
      p: `You are an independent contractor running your own business. You are not our employee, partner, joint venturer or agent. You can't sign contracts for us, and we can't sign them for you.\n\nAs an independent business, you:\n• choose whether to accept any offer, with no penalty for saying no beyond the objective, published rules in section 15;\n• set your own work days, hours, days off, service area, driving distance and daily job limit — we never send an offer outside them unless you switch "On call" for same-day work;\n• decide how to do the work: your methods, order of tasks, tools, equipment, products, vehicle and helpers;\n• may work for other companies and customers at the same time, including our competitors;\n• may advertise and grow your own business under your own name;\n• provide and pay for your own tools, equipment, vehicle, phone, supplies and business expenses (except materials we reimburse under section 11).\n\nWe don't require uniforms or branded clothing. We may offer an optional ${N} ID badge so customers can confirm who you are; wearing it is up to you. We don't require training, except safety or compliance training the law requires for your trade (for example HIPAA for medical deliveries, bloodborne-pathogens training for specimens, EPA lead-safe certification for older homes, food-handler certification). Our skills check before you start is a one-time check that you're qualified, not training.\n\nWe judge the work by its results — the scope the customer paid for, completed, safely and on the agreed day — not by how you get there.\n\nWhere the law gives you rights that this agreement can't take away, those rights apply.`,
    },
    {
      h: "3. What we do, and what you do",
      p: `What ${N} does:\n• markets the services and finds customers;\n• contracts with the customer, sets the customer's price and collects payment up front;\n• sends job offers to pros who are eligible for them;\n• handles scheduling, reminders, customer messages and customer support;\n• backs the customer's satisfaction guarantee (redo, free extra service or refund), and pays for a redo from our share when you choose not to do it;\n• pays you for completed work on the schedule below, with a statement for every job.\n\nWhat you do:\n• do the work you accept, safely, lawfully and to the standard in the work order;\n• keep your insurance, licenses, certifications, tax forms and documents current;\n• communicate with the customer and us through the app about access, timing and anything that changes the job;\n• take the before-and-after photos that show the work is done;\n• pay your own taxes, helpers and suppliers.\n\nAn honest note about pricing: we set the price the customer pays, and your payout is a share of it. Our share is always between ${pct(TAKE_MIN)} and ${pct(TAKE_MAX)} of the job price. You see the exact payout before you accept and are always free to decline. You don't negotiate the price with the customer.${COUNSEL}`,
    },
    {
      h: "4. Job offers: always your choice",
      p: `Offers are optional. You may accept, decline or ignore any offer, for any reason or none. Some offers go to several pros at once and the first to accept gets the job; an offer another pro takes first never counts against you.\n\nWho gets an offer depends on objective eligibility rules: you're active, your trade and specialties match, the job is within your driving distance and on a day and time you work (or you're On call for today), your daily job limit isn't full, your insurance, required coverages, licenses and background check are current, and — while you're on probation — the job is within the probation size cap (section 9).\n\nWhen a recurring customer you serve has another visit, or a customer you served needs a redo, we offer that job to you first, alone, for a set time before anyone else (currently 24 hours for recurring visits and 12 hours for redos). You can pass; then it goes out normally.\n\nDeclining offers never changes your payout rate or ends your account. The only effect is through your acceptance rate, which is one of the published factors in offer order and tiers (section 15).${COUNSEL}`,
    },
    {
      h: "5. Accepting a job: the work order",
      p: `Before you accept, the offer shows the service, scope, date and arrival window, the area (not the exact address), required photos, the job terms and your exact payout. When you accept, the full address and customer contact details unlock and a work order is created.\n\nAccepting creates a binding commitment for that job: you agree to do the work described, in the arrival window shown, under this agreement. The arrival window is the customer's appointment, which you chose to accept — it is a result we promised the customer, not a schedule we set for you.\n\nIf the job needs a deposit, don't start until the app shows "Paid in full". Never take payment directly from a customer.`,
    },
    {
      h: "6. If you need to cancel a job you accepted",
      p: `Things come up. If you can't do a job you accepted, cancel in the app as early as possible so we can find another pro — ideally more than ${D.lateCancelHours} hours before the arrival window. If you're running late, message the customer in the app before the window starts.\n\nCancelling within ${D.lateCancelHours} hours of the arrival window is a "late cancel". Not showing up without cancelling is a "no-show". There is no fee or charge to you for cancelling. But repeated late cancels or no-shows let customers down, so they count under the objective rules in the Deactivation Policy (currently ${D.lateCancels} late cancels or ${D.noShows} no-shows in ${D.windowDays} days leads to a written warning first). Cancellations caused by an emergency, illness, unsafe conditions, severe weather or the customer don't count when you tell us the reason.`,
    },
    {
      h: "7. Customer information is confidential",
      p: `Customer names, addresses, phone numbers, emails, access codes, notes, photos and anything you see or hear in a customer's home or business are confidential. Use them only to do that job. Don't keep them after the job, share them, sell them, or use them to market to the customer. Delete customer contact details from your own phone and records once the job and any redo are finished, unless the law requires you to keep them.`,
    },
    {
      h: "8. How you're paid",
      p: `• Payout shown first. Every offer shows your exact payout. That is what you're paid for the work order, plus any approved change orders, materials, tips and benefits.\n• Customers prepay. Customers pay us before you're dispatched, so you never invoice or chase money.\n• Approval. Your payout is approved when you mark the job complete and your completion photos pass review. Photo review checks that the work in the work order was done; it doesn't tell you how to do it.\n• Weekly payouts. Approved payouts (jobs, show-up pay, stipends, materials, tips, bonuses and approved top-ups, minus any clawback under section 17) are sent automatically every Monday, free, to the bank account in your name through Stripe.\n• Instant pay (optional). You may cash out approved payouts early for a fee of ${pct(P.instantPay.feePct, 1)} (minimum ${cents(P.instantPay.minFee)}), once you qualify under the published rules. The weekly payout is always free.\n• Statements. You get a statement for every payout showing each job, its payout and any adjustment with the reason.\n• No fees to work. You never pay lead fees, sign-up fees, subscriptions or software fees.\n\nIf you think a payout is wrong, tell us within 90 days of the statement and we'll review it with you. Missing that window doesn't waive any right the law gives you.`,
    },
    {
      h: "9. Probation: your first jobs",
      p: `Your first ${PROBATION.jobs} jobs are probation jobs. They are limited to jobs with a price of ${money(PROBATION.maxJobPrice)} or less, and each one gets a human review of your completion photos and a follow-up call to the customer before the payout is approved. This is a one-time quality check on results; it adds a short delay to approval, not a cut to pay.`,
    },
    {
      h: "10. Discounts, promotions and tips",
      p: `Discounts, promo codes, memberships, referral credits and gift cards never reduce your payout. Your payout is based on the job's list price, and every discount comes out of our share.\n\nTips are 100% yours. Customers can tip in the app (up to ${money(TIP_MAX)} per job); we pass the full tip to you on the next payout and cover the card fee ourselves. A cash tip a customer offers on their own is yours too — just never ask for one or make the service depend on it.`,
    },
    {
      h: "11. Materials and parts",
      p: `For trades where materials reimbursement applies, parts and materials not included in the job price are reimbursed at cost against an itemized receipt uploaded in the app. Purchases up to ${money(P.materials.autoApproveUpTo)} are approved automatically; larger ones need our OK first. Materials over ${pct(P.materials.maxShareOfPrice)} of the job price (or over ${money(P.materials.shoppingMax)} of shopping for errands) need a change order to the customer first. We reimburse you once the customer has paid for them. We never mark up your receipts against you, and you never pay for customer materials out of your payout.\n\nIf we ask you to buy through an approved supplier or process for a specific job (for example, so the customer gets a warranty), the work order will say so.`,
    },
    {
      h: "12. Scope changes",
      p: "If you find more work than was booked (a bigger load, another room, hidden damage), stop that part, update the scope in the app and tell the customer we'll send a change order. We price the difference, send it to the customer to approve and pay, and add the extra payout to your job. Do the extra work only after the app shows it's paid. Work you do outside the work order without a paid change order is not paid, and you must not charge the customer for it directly.",
    },
    {
      h: "13. Late cancellations, lockouts and show-up pay",
      p: `If the customer cancels within 24 hours of the arrival window, they pay a late fee (currently ${money(LATE_CANCEL_FEE)}).\n\nIf you arrive and can't get in, tap "Can't get in?" in the app and wait 15 minutes while we try to reach the customer. If we confirm the lockout, the job is closed as a lockout and the customer pays the late fee.\n\nIn both cases, while show-up pay applies to you, you receive the published show-up amount (currently up to ${money(P.showUpPay.amount)}) out of the fee we keep, on your next payout.`,
    },
    {
      h: "14. Pro Program benefits",
      p: `While you meet the eligibility rules published in your pro portal, you get:\n• Pay protection — a refund that isn't caused by your workmanship comes out of our share first. It reduces your payout only by any amount our share can't cover.\n• Show-up pay — the published show-up amount on a late customer cancellation or a confirmed lockout (section 13).\n• Instant pay — cash out approved payouts early for the published fee, through a Stripe account in your name (section 8).\n• Materials at cost — section 11.\n• Insurance help — quotes through our insurance partners, and a one-time insurance stipend (currently ${money(P.insurance.stipend)}) after your ${P.insurance.afterJobs}th completed job.\n• Guaranteed weekly minimum — when we offer it, in the published months, for qualifying pros who meet the published availability and acceptance rules, subject to our approval and weekly budget. It tops up your week to the published minimum (currently ${money(P.guarantee.weeklyMinimum)}).\n• Refer-a-pro bonus — ${money(PRO_REFERRAL.bonus)} once a pro you referred completes ${PRO_REFERRAL.afterJobs} jobs.\n\nWe may change eligibility rules or amounts going forward, with notice in the portal. Changes never reduce anything you've already earned, and a change applies only to jobs accepted after it takes effect.`,
    },
    {
      h: "15. Tiers, offer order and your numbers",
      p: `Tiers are earned from your real numbers and recalculated automatically:\n${tierLines}\nTier payout boosts are capped so our share never falls below ${pct(TAKE_MIN)} of the job price.\n\nWhen several pros are eligible for a job, offers go out in an order based on objective measures over the last ${STATS_WINDOW_DAYS} days:\n• customer rating;\n• first-time photo-review pass rate;\n• redo and refund rate;\n• on-time rate (started before the end of the booked window);\n• acceptance rate (offers accepted out of offers you could answer — offers another pro took first don't count);\n• distance to the job, open slots that day, experience, matching specialties, being On call for same-day work, and your tier.\nNew pros aren't judged on a handful of jobs: rates only change once there's enough history.\n\nThese measures affect the order in which you see offers. They never change your payout rate, except the published tier boosts above. You can see your own numbers in the portal, and you can ask us to correct any that are wrong — for example, a late start caused by the customer.${COUNSEL}`,
    },
    {
      h: "16. Quality, photo review and redos",
      p: `You'll take before-and-after photos of every area you work on. We review them (with help from AI, and always with a human on probation jobs and whenever the automatic check isn't sure) to confirm the work in the work order was done.\n\nIf work you performed doesn't meet the agreed standard, you'll return to correct it within ${BRAND.guaranteeDays} days at no additional payout. A redo is offered to you first. If you decline or don't respond in time, we send another pro and pay them from our share — not from your payout — though section 17 may apply if the problem was your workmanship. A redo that the customer requests for something outside the original work order, or caused by someone else, is a new job and paid as one.`,
    },
    {
      h: "17. Refunds and clawbacks",
      p: `A refund reduces your payout only when your workmanship (or that of your helpers) caused it, and then only up to your payout for that job. Refunds for anything else — a customer change of mind, a pricing or scheduling mistake by us, something outside the work order, or things outside your control — come out of our share.\n\nBefore we deduct a workmanship refund from your pay, we'll tell you in writing what happened and show you the evidence (photos, messages, the customer's complaint), and give you at least 3 business days to respond with your side. A human decides. If the payout was already paid, the amount becomes a clawback taken from future payouts; we won't take more than half of any single weekly payout for a clawback unless you agree, and we never take it from tips. You can appeal a clawback the same way as a deactivation decision.`,
    },
    {
      h: "18. Chargebacks",
      p: "If a customer disputes a card charge with their bank, your payout for that job may be held while the dispute is open. We fight disputes using the signed customer agreement, your photos and the job record. If we win, or if the dispute isn't related to your work (for example, card fraud or a billing issue), the held payout is released on the next weekly run. If we lose because of your workmanship, section 17 applies, including notice and a chance to respond.",
    },
    {
      h: "19. Taxes",
      p: `You're responsible for your own income and self-employment taxes, and any sales, use or business taxes for your business. We don't withhold taxes. You'll give us an accurate Form W-9 and keep your legal name, tax classification and address current. We report payments to you on Form 1099-NEC (or another required form) when the law requires — for payments made in ${NEC_YEAR}, when they total ${money(necThreshold(NEC_YEAR))} or more for the year.`,
    },
    {
      h: "20. Insurance",
      p: `You'll keep, at your own cost, for as long as you accept jobs:\n• General liability insurance of at least $1,000,000 per occurrence and $2,000,000 aggregate${highGlTrades.length ? ` (higher: ${list(highGlTrades)})` : ""}, naming ${L} as additional insured.\n• Auto insurance for any vehicle you use for jobs. Personal auto policies often exclude business use — make sure yours covers it. Commercial auto (${COVERAGES.auto.detail.split(".")[0]}) is required for ${list(tradesRequiring("auto"))}.\n• Workers' compensation for your own employees where Michigan (or your state) requires it. If you have no employees, you'll sign a no-employees statement and get coverage before anyone works for you on a ${N} job.\n• The trade-specific coverages for your trades, shown in your onboarding checklist — for example a fidelity bond for ${list(tradesRequiring("bond"))}; passenger carrier auto liability for transportation; liquor liability whenever alcohol is served.\n\nYou'll upload current certificates and tell us right away if coverage is cancelled, reduced or lapses. We verify policies with carriers. Offers stop automatically the day a required policy expires and restart as soon as a renewal is verified. Your insurance is primary for your work.`,
    },
    {
      h: "21. Licenses and permits",
      p: `You'll hold every license, registration and certification your trade and each job legally require, in your business's name where the law requires, and keep them current. Licensed work (for example plumbing, electrical and HVAC) goes only to properly licensed pros. You'll pull required permits as the licensed party and pass inspections. Tell us immediately if a license is suspended, restricted or expires — offers for that trade stop until it's renewed.`,
    },
    {
      h: "22. Background checks",
      p: "Before activation, and from time to time after (currently every year, and when you add a driving trade), we run a background check through our screening provider, with your separate written consent on the provider's standalone FCRA disclosure and authorization form. Driving trades also get a motor-vehicle record check. If anything in a report might affect your eligibility, we follow the adverse-action process in the Background Check Notice: you get a copy of the report and a chance to explain or dispute it before any decision.",
    },
    {
      h: "23. Helpers and subcontractors",
      p: `You may use helpers, employees or subcontractors. You choose them, direct them, pay them and are fully responsible for their work, conduct, wages, taxes, insurance (including workers' comp) and compliance with this agreement. They are not ${N}'s employees or contractors.\n\nFor customer safety, anyone who will enter a customer's home or business, or handle a customer's pets, keys, vehicle, children's spaces or medical items, must first be listed on your account and pass our background check. Licensed work must be done or supervised by someone holding the required license. You're responsible for any refund or damage caused by your helpers, the same as if you'd done the work yourself.`,
    },
    {
      h: "24. Safety and incidents",
      p: "You'll follow OSHA and other safety rules that apply to your work, use proper protective equipment, and use your own judgment about safety. You may stop or refuse any job, or any part of one, that you believe is unsafe — tell us in the app and we'll work it out with the customer; a safety stop never counts against you.\n\nReport to us within 24 hours (immediately for emergencies — call 911 first): any injury, property damage, vehicle accident, police involvement, threat, harassment, animal bite, or loss or theft of customer property or keys. Notify your own insurer as your policy requires. Cooperate with any investigation and insurance claim.",
    },
    {
      h: "25. Customer property, keys, codes and privacy",
      p: "• Treat the customer's property with care. Report any damage or breakage right away, with photos — even if you think it's minor.\n• Keys, lockbox codes, door codes and garage codes are used only for that job, never copied or shared, and returned or deleted when the job ends. Lock up as you found it.\n• Go only where the job requires. Don't open drawers, cabinets, mail or devices unless the work requires it.\n• Photos are of the work areas only. Never photograph people, children, personal documents, mail, screens, medications, valuables or anything unrelated to the job.\n• Don't post photos or videos of a customer's home, business or property on social media or anywhere else without the customer's written consent through us.\n• Never bring anyone to a job who isn't listed as your helper.",
    },
    {
      h: "26. Location sharing",
      p: `Location sharing in the app is used only while you're On call (up to ${ON_CALL_MAX_HOURS} hours at a time, your choice) or have a job today. We use it to offer same-day jobs near you and to show your customer an approximate arrival time while you're on the way to or at their job. Customers see only an approximate position, only for their job. A location older than ${LOCATION_FRESH_MIN} minutes isn't used, and every stored location is erased after 12 hours. We don't track you on days off or when you're off call with no job. Details are in the Location & Communications Consent.`,
    },
    {
      h: "27. Communications",
      p: "Use the app for job messages with customers and with us, so there's a record that protects you and the customer. Messages may be reviewed for safety, quality, support and disputes. You never have to give a customer your personal phone number; where masked calling is available, calls go through it. Customer phone numbers you see after accepting are for that job only.",
    },
    {
      h: "28. Customer relationships: non-solicitation and non-circumvention",
      p: `We spend money to find each customer. For 12 months after you're first introduced to a customer through ${N}, you won't solicit or accept work from that customer for the same kind of services outside the platform, or encourage them to book around us. This applies only to customers you met through ${N} — never to your own existing customers or customers who find you on their own with no help from us.\n\nIf you break this rule, you agree to pay us, as a reasonable estimate of our lost fee (not a penalty), an amount equal to our share (the difference between the customer price and your payout on comparable ${N} jobs) on the diverted work for the rest of the 12 months. We'll show you how we calculated it, and you can dispute it under section 37.${COUNSEL}`,
    },
    {
      h: "29. No non-compete",
      p: `There is no non-compete. You're free to work for any other platform, company or customer, including our competitors, during and after this agreement.`,
    },
    {
      h: "30. Intellectual property and photos",
      p: `You own the photos you take. You give ${N} a non-exclusive, royalty-free license to use job photos to review quality, keep the job record, support the customer, resolve disputes and improve our quality-check tools. We'll use them in marketing only with the customer's consent and with people, addresses and personal details removed. Our name, logo, app, software, prices and content belong to us; you may say you're available on ${N}, but you may not use our brand in a way that suggests you're our employee or that we endorse your other business.`,
    },
    {
      h: "31. Confidentiality",
      p: `Besides customer information (section 7), keep confidential any non-public information about ${N} you learn through the platform — like customer lists, pricing rules and internal tools — and don't use it except to do jobs. This doesn't stop you from discussing your own pay or working conditions, reporting possible violations of law to a government agency, or anything else the law protects.`,
    },
    {
      h: "32. Indemnification",
      p: `You'll defend, cover and hold ${N} harmless against third-party claims, losses and reasonable legal fees to the extent caused by: your (or your helpers') negligence, misconduct or breach of this agreement or the law; your helpers' claims against us, including wage or classification claims by people you hire; or your tax and insurance obligations.\n\nWe'll defend, cover and hold you harmless against third-party claims, losses and reasonable legal fees to the extent caused by: our negligence or misconduct; errors in our platform or in information we gave you (for example a wrong address or scope we entered); or our breach of this agreement or the law, including the privacy of data we hold.\n\nEach side gives prompt notice of a claim and reasonable cooperation. Insurance pays first where it applies.${COUNSEL}`,
    },
    {
      h: "33. Limitation of liability",
      p: `Neither of us is liable to the other for indirect, special or punitive damages or lost profits. Apart from the exceptions below, each side's total liability to the other under this agreement is limited to the greater of the payouts made to you in the 12 months before the claim or $5,000. These limits don't apply to: payouts you've earned; indemnification for third-party claims; bodily injury or property damage; fraud, gross negligence or willful misconduct; breach of confidentiality or privacy; or anything the law doesn't allow to be limited.${COUNSEL}`,
    },
    {
      h: "34. Deactivation and suspension",
      p: `We stop sending you offers only for the objective reasons in the Pro Deactivation Policy (for example safety threats, fraud, theft, discrimination, or repeated late cancels, no-shows or quality problems after a written warning). We'll give you written notice with the reason. You can appeal within ${D.appealDays} days to a human, who will decide within ${D.decisionDays} days.\n\nWe suspend immediately, before an appeal, only for a credible safety threat, suspected fraud, or expired legally required documents (expired documents only pause offers until you renew). Money you've earned is always paid, minus only amounts properly owed under sections 17 and 18.`,
    },
    {
      h: "35. Term and ending the agreement",
      p: `This agreement starts when you sign it and continues until either of us ends it. You may end it at any time by closing your account or telling us in writing. We may end it with 14 days' written notice, or immediately under the Deactivation Policy. Jobs you've already accepted should be finished or cancelled under section 6. Payouts owed for completed work are paid on the normal schedule. Sections that by their nature continue (confidentiality, non-solicitation, indemnification, limits of liability, disputes, and payment of amounts owed) survive.`,
    },
    {
      h: "36. Changes to this agreement",
      p: `We'll give you at least 30 days' notice in the pro portal (and by email) before a change takes effect. Material changes require you to re-sign before you receive new offers; you can decline and end the agreement instead, and the old terms apply to every job you accepted before the change. Benefit amounts and eligibility rules may change under section 14. We never change pay for work you've already accepted.`,
    },
    {
      h: "37. Resolving disagreements: talk first, then arbitration",
      p: `Talk to us first. Most problems are solved by contacting us at ${BRAND.supportEmail}. If that doesn't work, send a written notice describing the dispute and what you want; we'll do the same. We'll both try in good faith to resolve it within 30 days.\n\nArbitration. If it isn't resolved, any dispute between you and ${N} arising from this agreement, your jobs or your relationship with us — including disputes about pay and whether you're an independent contractor — will be decided by a neutral arbitrator in individual arbitration, not by a judge or jury, under the American Arbitration Association's rules (Commercial or Employment rules, as counsel selects) in effect when the claim is filed.${COUNSEL} The Federal Arbitration Act governs this section; where it doesn't apply (for example to transportation workers engaged in interstate commerce), the Michigan Uniform Arbitration Act applies.${COUNSEL} The arbitrator can award any individual remedy a court could. Hearings take place in the county where you live or by video.\n\nCosts. You'll pay no more in filing fees than you would to file in court; we'll pay all other arbitration and arbitrator fees. Each side pays its own lawyers unless the law or the arbitrator awards fees.\n\nNot covered by arbitration:\n• individual claims in small-claims court;\n• charges or complaints to a government agency (such as the EEOC, the U.S. or Michigan Department of Labor, the NLRB or the IRS);\n• claims for unpaid wages, misclassification or other claims where the law forbids requiring arbitration or a waiver;\n• requests for emergency court orders to stop a safety threat or misuse of confidential information.`,
    },
    {
      h: "38. Class and collective action waiver",
      p: `To the extent the law allows, you and ${N} each bring claims only individually, not as a plaintiff or class member in a class, collective or representative action, and an arbitrator may not combine claims of different pros. If this waiver is found unenforceable for a particular claim, that claim goes to court, not class arbitration, and is paused until the individual arbitration is finished.${COUNSEL}`,
    },
    {
      h: "39. Opting out of arbitration",
      p: `You can opt out of arbitration (sections 37–38) within 30 days of first signing this agreement by emailing ${BRAND.supportEmail} with your name and the words "I opt out of arbitration". Opting out has no effect on your offers, pay or standing with us. If you opt out, disputes go to court, with the informal step first.`,
    },
    {
      h: "40. Governing law, e-signature and the whole agreement",
      p: `Michigan law governs this agreement, except where the Federal Arbitration Act or another federal law applies, and except that where you live and work in another state, that state's non-waivable worker protections apply. Courts in Wayne County, Michigan (or the federal court for the Eastern District of Michigan) hear anything that goes to court, unless you live elsewhere and the law lets you sue at home.\n\nYou agree to sign electronically. Your typed name and checkbox in the portal are your signature, and we keep a copy of exactly what you signed with the date, time and IP address. You can download it from the portal at any time.\n\nThis agreement, together with the Code of Conduct, Deactivation Policy, Background Check Notice, Location & Communications Consent, your trade addenda and each work order, is the whole agreement between us and replaces earlier versions. If any part is unenforceable, the rest still applies. Not enforcing a term once isn't a waiver. You may not transfer this agreement without our consent; we may transfer it to a company that takes over our business, with notice to you. Notices to you go to the email in your account; notices to us go to ${BRAND.supportEmail}.`,
    },
  ],
};

// ─── 2. Code of Conduct ─────────────────────────────────────────────────────────

export const PRO_CODE_OF_CONDUCT: Contract = {
  key: "pro-code-of-conduct",
  title: `${N} Pro Code of Conduct`,
  version: POLICY_VERSION,
  audience: "pro",
  appliesTo: `Every pro and every listed helper on every ${N} job; part of the Independent Contractor Agreement.`,
  summary: [
    "Be respectful, honest and safe. Zero tolerance for harassment, discrimination, violence, theft and working impaired.",
    "Arrive in the booked window and keep the customer posted in the app — these are customer-service results, not rules about how you work.",
    "Photos only of the work areas. Never people, documents or personal items, and never posted without written consent.",
    "No smoking or vaping in or near customers' homes. Be careful with pets and gates.",
    "Never be alone with a child unless the service allows it — no current service does.",
    "Dress clean and appropriate — no uniform required. Park legally and courteously.",
    "Report problems, incidents and anything that made you feel unsafe. Reporting in good faith never counts against you.",
  ],
  sections: [
    {
      h: "1. Why we have a code",
      p: `Customers let you into their homes, businesses, cars and lives. This code sets the basic standards every customer can count on. It describes results and behavior, not how to do your trade — your methods, tools and order of work are yours to decide. Breaking it can lead to the steps in the Deactivation Policy.`,
    },
    {
      h: "2. Respect for everyone",
      p: "Treat customers, their families, guests, employees, neighbors, other pros and our team with courtesy and respect. Disagreements happen — handle them calmly and bring us in through the app. Never argue about a refund, rating or review with a customer; tell us and we'll handle it.",
    },
    {
      h: "3. Zero tolerance",
      p: `Any of these leads to immediate suspension and review under the Deactivation Policy:\n• harassment of any kind, including sexual comments, advances or unwanted contact, and contacting a customer for personal reasons;\n• discrimination or refusing service because of race, color, religion, national origin, sex, sexual orientation, gender identity, age, disability, marital or familial status, height, weight or any other protected trait (refusing a job for genuine safety reasons is not discrimination);\n• violence, threats or carrying a weapon into a customer's home where prohibited by law or by the customer;\n• theft, damage on purpose, or taking anything — even "trash" — without the customer's OK;\n• working under the influence of alcohol, cannabis or drugs (including impairing prescription drugs);\n• fraud: fake photos, false receipts, false completion, using someone else's account, or asking a customer to pay you directly.`,
    },
    {
      h: "4. Arrival and communication",
      p: "Customers book an arrival window, and you chose to accept it. Arrive within it. If you're going to be late, message the customer in the app before the window starts and give a realistic time. Tap \"On my way\" when you leave so the customer gets an arrival estimate. Let the customer know when you're done. Answer customer and support messages about the job within a reasonable time while the job is active. How you plan your day, route and work is up to you.",
    },
    {
      h: "5. Photos and privacy",
      p: "• Take before-and-after photos of the work areas only.\n• Never photograph or record people, children, personal documents, mail, screens, medications, valuables or anything unrelated to the job.\n• Never record audio or video of customers.\n• Don't post anything about a customer's home, business, vehicle or pets online without the customer's written consent through us.\n• Keep what you see and hear private.",
    },
    {
      h: "6. In the customer's home or business",
      p: "• No smoking, vaping or using tobacco or cannabis in or near the customer's home, business, vehicle or yard.\n• Ask before using the bathroom, outlets, water or appliances that aren't part of the job, and leave them as you found them.\n• Protect floors and furniture, and clean up your work area.\n• Don't bring guests, children or pets to a job.\n• Keep music and phone calls to a level that doesn't disturb the customer or neighbors.",
    },
    {
      h: "7. Pets",
      p: "Ask about pets before you enter and keep doors and gates closed behind you. Never let a pet out. Don't feed or give treats to a customer's pet unless the job is pet care. If a pet seems aggressive, don't enter — tell the customer and us; the job will be rescheduled and it doesn't count against you.",
    },
    {
      h: "8. Children and vulnerable people",
      p: `Never be alone with a child under 18 unless the service explicitly allows it — no ${N} service currently does. If you arrive and the only person home is a minor, don't start: message us and wait for an adult. Be patient and respectful with older or disabled customers, and never accept gifts, loans or money (other than tips through the app or offered freely) from them.`,
    },
    {
      h: "9. Dress and identification",
      p: `There's no uniform and no ${N} clothing requirement. Wear clean clothing that's appropriate and safe for the work, without offensive images or language. You may wear your own business's branding. An optional ${N} ID badge is available if you'd like customers to recognize you.`,
    },
    {
      h: "10. Vehicles and parking",
      p: "Park legally, don't block driveways, sidewalks, hydrants or neighbors, and don't park on lawns unless the customer asks. Don't leave oil or debris behind. Drive safely and lawfully in residential areas.",
    },
    {
      h: "11. Reporting",
      p: `Report through the app (or by calling ${BRAND.supportPhone} for anything urgent): any injury or damage; anything that made you feel unsafe or uncomfortable; a customer's harassment or discrimination toward you; a helper or pro breaking this code; or anything that looks like abuse, neglect or a crime (call 911 first in an emergency). You can report harassment by a customer and refuse to return to that customer. Reports made in good faith never count against you, and we don't tolerate retaliation.`,
    },
  ],
};

// ─── 3. Deactivation Policy ─────────────────────────────────────────────────────

export const PRO_DEACTIVATION_POLICY: Contract = {
  key: "pro-deactivation-policy",
  title: `${N} Pro Deactivation Policy`,
  version: POLICY_VERSION,
  audience: "pro",
  appliesTo: `Every pro; explains the only reasons ${N} pauses or stops offers, and how to appeal. Part of the Independent Contractor Agreement.`,
  summary: [
    "Offers stop only for the objective reasons listed here — never for declining offers or for working with other companies.",
    "Immediate suspension is only for safety threats, violence, theft, fraud, impairment or discrimination.",
    "Expired insurance, licenses or required documents only pause offers until you renew — that's not a deactivation.",
    `Performance issues (low ratings, late cancels, no-shows, repeated QA failures, off-platform solicitation) get a written warning and ${D.improveDays} days to improve first.`,
    `You always get written notice with the reason, and can appeal to a human within ${D.appealDays} days. We decide within ${D.decisionDays} days.`,
    "Money you've earned is always paid.",
  ],
  sections: [
    {
      h: "1. What this policy covers",
      p: `"Deactivation" means we stop sending you offers and end the agreement. "Suspension" means offers are paused while we review something. "Pause" means offers stop automatically until a document is renewed. We use these only for the reasons below. Declining or ignoring offers, setting a small schedule, a short driving distance or a low daily limit, working with other platforms, competitors or your own customers, and making a good-faith complaint or safety report are never reasons for deactivation.`,
    },
    {
      h: "2. Automatic pause: expired documents",
      p: "Offers pause automatically, the day it happens, if any of these is expired or missing: general liability insurance, a coverage your trade requires (auto, bond, passenger carrier, liquor, workers' comp), a required license or certification (for example HIPAA training for medical deliveries), or your background check. This is not a deactivation and needs no appeal. We remind you 30 days before expiry. Upload the renewal and offers restart as soon as it's verified. Jobs you already accepted that you can no longer legally do will be reassigned; you're paid for any work already completed.",
    },
    {
      h: "3. Immediate suspension, then review",
      p: `We suspend offers right away, before an appeal, when we receive a credible report of:\n• a threat to anyone's safety, or violence;\n• theft or deliberate damage;\n• fraud (fake photos, receipts or completion; account sharing; taking payment directly);\n• working impaired by alcohol or drugs;\n• harassment, including sexual harassment, or discrimination;\n• for medical deliveries, a serious privacy (HIPAA) breach; for transportation, a serious safety violation.\n\nWe tell you in writing within one business day what was reported (without identifying a reporter where that would put them at risk), and you can give your side. A person on our team reviews the evidence — the job record, photos, messages and statements — and decides within ${D.decisionDays} days whether to reinstate you or deactivate you. If you're cleared, offers restart right away and the suspension doesn't count against you.`,
    },
    {
      h: "4. After a written warning",
      p: `These lead to a written warning first, with the facts and what needs to change. If the issue continues ${D.improveDays} days after the warning, a person on our team reviews it and may deactivate:\n• an average customer rating below ${D.minRating}★ over your last ${D.ratedJobs} rated jobs;\n• ${D.lateCancels} or more late cancels (inside ${D.lateCancelHours} hours of the window), or ${D.noShows} or more no-shows, in ${D.windowDays} days;\n• ${D.qaFailures} or more jobs in ${D.windowDays} days that failed photo review and weren't fixed;\n• soliciting customers off the platform (Agreement section 28);\n• repeated breaks of the Code of Conduct that aren't zero-tolerance items.\n\nLate cancels and no-shows caused by an emergency, illness, unsafe conditions, severe weather or the customer don't count when you tell us. Ratings you can show were retaliatory or discriminatory are removed. We publish these thresholds in your portal and give 30 days' notice before changing them.${COUNSEL}`,
    },
    {
      h: "5. Notice",
      p: "Every suspension and deactivation comes with written notice (in the portal and by email) that states the reason, the facts we relied on, and how to appeal. We never deactivate without telling you why.",
    },
    {
      h: "6. Appeal to a human",
      p: `You can appeal within ${D.appealDays} days of the notice, in the portal or by email to ${BRAND.supportEmail}. Send anything you want considered: photos, messages, receipts, witness names, your explanation. A person who wasn't involved in the original decision reviews it — never only an automated system — and decides within ${D.decisionDays} days of receiving your appeal, in writing, with reasons. If they overturn the decision, offers restart right away and the record is cleared. The appeal doesn't affect your right to use the dispute process in the Agreement.`,
    },
    {
      h: "7. Coming back",
      p: `• Expired documents: upload the renewal; offers restart once it's verified.\n• Performance deactivation: you may reapply after 6 months. Tell us what changed; you'll restart with probation jobs.\n• Background check: if a report was wrong and it's corrected, we reinstate you.\n• Zero-tolerance deactivations are permanent, unless the reason turns out to be false.`,
    },
    {
      h: "8. Your money is always paid",
      p: "Deactivation or suspension never cancels money you've earned: completed-job payouts, show-up pay, materials reimbursements, tips, stipends and bonuses are paid on the normal schedule. The only deductions are workmanship refunds and chargebacks handled under the Agreement, with notice and a chance to respond. A payout tied to a credible fraud report may be held only for that job while it's reviewed.",
    },
  ],
};

// ─── 4. Background Check Notice ────────────────────────────────────────────────

export const PRO_BACKGROUND_CHECK_NOTICE: Contract = {
  key: "pro-background-check",
  title: `${N} Background Check Notice`,
  version: POLICY_VERSION,
  audience: "pro",
  appliesTo: `Every pro and listed helper before activation and at each re-check. Explains the process; the legally required standalone disclosure and authorization come separately from our screening provider.`,
  summary: [
    "This notice explains our background checks in plain English. It is NOT the legal disclosure and authorization — that is a separate standalone form our screening provider (Checkr) gives you before any check.",
    "We check criminal records and sex-offender registries, and for driving trades your motor-vehicle record. We re-check every year.",
    "You can get a free copy of your report and dispute anything that's wrong.",
    "Before any decision based on a report, you get a copy, a summary of your rights and at least 5 business days to respond.",
    "We look at each record individually — what it was, how long ago, and whether it relates to the work.",
  ],
  sections: [
    {
      h: "1. This is not the FCRA disclosure",
      p: "Under the federal Fair Credit Reporting Act (FCRA), we must give you a clear standalone disclosure and get your written authorization before ordering a background report. Our screening provider, Checkr, gives you that standalone form (by email, before the check). This notice is extra information to help you understand the process. It does not replace that form, and signing this notice is not your authorization.",
    },
    {
      h: "2. What we check",
      p: `With your authorization, the report may include:\n• criminal records (national database, county and federal searches where you've lived);\n• national and state sex-offender registries;\n• identity and Social Security number trace;\n• for trades that drive for jobs (for example transportation, errands, medical deliveries, hauling) — your motor-vehicle record and license status.\nWe don't check credit. Each listed helper who enters customers' homes goes through the same check.`,
    },
    {
      h: "3. Re-checks",
      p: "We run a new check every year, when you add a driving trade, and if we receive credible information that a record may have changed. Each re-check uses the same standalone disclosure and authorization process (your original authorization may cover re-checks where the law allows; the form will say so).",
    },
    {
      h: "4. How we decide",
      p: `A record doesn't automatically disqualify you. We look at each one individually: the nature and seriousness of the offense, how long ago it happened, whether it relates to the work and the customers you'd serve (for example, entering homes, driving passengers, handling medications), and any evidence of rehabilitation you give us. We don't consider arrests that didn't lead to a conviction where Michigan law prohibits it, expunged or set-aside records, or juvenile records.${COUNSEL}`,
    },
    {
      h: "5. Before any decision: pre-adverse action notice",
      p: "If something in the report might lead us to not activate you or to stop offers, we first send you a pre-adverse action notice with a copy of the report, the CFPB's \"Summary of Your Rights Under the FCRA\", and the record we're concerned about. You then have at least 5 business days to tell us if the report is wrong, to dispute it with Checkr, or to share context (such as rehabilitation, or that the record isn't yours). We'll wait for a dispute you've started to be resolved before deciding.",
    },
    {
      h: "6. If we decide not to proceed: adverse action notice",
      p: "If we decide not to activate you or to stop offers based in whole or part on the report, we send an adverse action notice stating: the name, address and phone number of the screening company; that the screening company didn't make the decision and can't explain why it was made; your right to a free copy of your report if you ask within 60 days; and your right to dispute the accuracy or completeness of anything in it with the screening company.",
    },
    {
      h: "7. Getting a copy and disputing",
      p: "You can ask Checkr for a copy of your report at any time (free after an adverse action notice), and dispute anything inaccurate or incomplete directly with Checkr, which must reinvestigate, usually within 30 days. If a corrected report clears you, we'll reconsider promptly.",
    },
    {
      h: "8. Michigan and fair-chance rules",
      p: `Michigan has no statewide \"ban-the-box\" law for private businesses, but some cities (including Detroit, for city contractors) have fair-chance rules, and other states and cities where we may expand have their own — some limit when and how records can be considered or require an individualized assessment. We follow the stricter rule wherever you work, and our application doesn't ask about criminal history before a conditional offer to activate.${COUNSEL}`,
    },
    {
      h: "9. Privacy",
      p: "Background reports are seen only by the people on our team who make activation decisions, are stored securely, are used only for eligibility, and are kept only as long as the law requires.",
    },
  ],
};

// ─── 5. Location & Communications Consent ──────────────────────────────────────

export const PRO_LOCATION_CONSENT: Contract = {
  key: "pro-location-and-communications",
  title: `${N} Location & Communications Consent`,
  version: POLICY_VERSION,
  audience: "pro",
  appliesTo: `Every pro using the ${N} app or pro portal; explains when we use your location and how we contact you, and records your consent.`,
  summary: [
    "We use your phone's location only while you're On call or have a job today — never on days off or when you're off call with no job.",
    `Customers see only an approximate position, only while you're on the way to or at their job. Stored locations are erased after 12 hours.`,
    "We text, push and email you about offers and jobs. Reply STOP to stop texts at any time; offers still show in the app.",
    "Marketing messages are separate and optional.",
    "We don't record calls today. If we ever start, we'll tell you first.",
  ],
  sections: [
    {
      h: "1. When we use your location",
      p: `With your permission in your phone's settings, the app shares your location only:\n• while you've switched "On call" on (you choose how long, up to ${ON_CALL_MAX_HOURS} hours, and can turn it off any time); or\n• on a day you have a ${N} job, so we can show the customer an arrival estimate.\nWe don't collect your location on days off, or when you're off call with no job that day. If you turn location off in your phone, the app still works; you just won't get same-day "near you" offers or live arrival estimates.`,
    },
    {
      h: "2. What we use it for",
      p: `• Offering same-day jobs near where you are (for pros who are On call).\n• Telling your customer, while you're on the way to or at their job, roughly how far away you are and when you'll arrive. Customers see an approximate position (rounded to about 100 meters) and only for their own job, that day.\n• Our support team seeing who is on call or on a job, to help with emergencies, lockouts and reassignments.\nWe never sell your location, use it to monitor how you work, or share it with anyone else except as the law requires or in an emergency involving your safety.`,
    },
    {
      h: "3. How long we keep it",
      p: `A location older than ${LOCATION_FRESH_MIN} minutes isn't used or shown as live. Every stored location is erased after 12 hours, and it's erased right away when you go off call with no job that day. Job records keep only arrival and completion times, not your route.`,
    },
    {
      h: "4. Texts, push notifications and email",
      p: `By giving us your mobile number and turning on notifications, you agree that ${N} may send you automated text messages, push notifications and emails about: job offers; job updates, reminders and customer messages; payouts and statements; documents expiring; account and security notices; and this agreement. Message frequency varies with your offers and jobs. Message and data rates may apply. Consent isn't a condition of working with us — you can see offers in the app instead.\n\nReply STOP to any text to stop texts, and HELP for help. You can turn push notifications off in your phone and change email settings in the portal. Account and legal notices still come by email.\n\nMarketing (tips, promotions, recruiting events) is separate: we send it only if you opt in, and you can opt out any time without affecting your offers.`,
    },
    {
      h: "5. Calls and in-app messages",
      p: "We don't record phone calls today. If we start, we'll tell you first and announce it at the start of each recorded call. In-app messages between you, customers and our team are kept with the job record and may be reviewed for safety, quality, support and disputes. You don't have to share your personal phone number with customers.",
    },
    {
      h: "6. Changing your mind",
      p: "You can withdraw your location consent in your phone's settings, stop texts with STOP, and turn off push or marketing at any time. Withdrawing consent never counts against you; it only turns off the features that need it.",
    },
  ],
};

// ─── 6. Trade addenda ────────────────────────────────────────────────────────────

const addendum = (key: string, title: string, trades: string[], summary: string[], sections: { h: string; p: string }[]): Contract => ({
  key,
  title: `${N} Pro Addendum — ${title}`,
  version: POLICY_VERSION,
  audience: "pro",
  appliesTo: `Pros who do ${list(trades.map(label))} jobs; adds to the Independent Contractor Agreement and wins over it for these trades if they conflict.`,
  summary,
  sections,
  trades,
});

/** Building trades: the state-licensed ones (from LICENSED_TRADES) plus related home-improvement trades. */
const BUILDING = ["plumbing", "electrical", "hvac", "remodel", "painting"];
const BUILDING_TRADES = [...new Set([...LICENSED_TRADES.filter((t) => BUILDING.includes(t)), "remodel", "painting", "low_voltage", "handyman"])];

export const PRO_ADDENDA: Contract[] = [
  addendum("pro-addendum-transportation", "Passenger Transportation", ["transportation"], [
    "Only licensed carrier companies: MDOT authority for Michigan trips; USDOT number and FMCSA authority for interstate trips or where federal rules apply.",
    `${N} arranges rides as the customer's agent. You are the carrier and are fully responsible for operating the vehicle and the trip.`,
    "Passenger carrier insurance, inspected vehicles and qualified drivers (right license class, clean record, drug & alcohol testing and hours-of-service limits where they apply).",
    "Nobody under 21 drinks. Drivers never drink. Accessibility and service animals are welcome; child seats per Michigan law.",
    "Report any accident or injury immediately, and to us within 24 hours.",
  ], [
    {
      h: "1. Who you are and who we are",
      p: `Transportation jobs go only to licensed passenger carrier companies — never individual drivers in personal cars. You, the carrier, provide the vehicle and driver and are solely responsible for operating the trip safely and lawfully. ${N} books the ride and collects payment as the customer's agent; we are not a motor carrier, don't operate vehicles and don't control your drivers or vehicles.${COUNSEL}`,
    },
    {
      h: "2. Operating authority",
      p: "You'll hold and keep current: Michigan passenger-for-hire / limousine carrier authority from MDOT for intrastate trips; and a USDOT number and FMCSA operating authority for interstate trips, and wherever federal rules otherwise require them (for example vehicles designed to seat 16 or more including the driver). You'll follow any airport, venue or city permit rules for pickups and staging. Tell us immediately if any authority is suspended or revoked — offers stop until it's restored.",
    },
    {
      h: "3. Vehicles and insurance",
      p: `• Every vehicle used must be listed on your account with seats, year and current inspection, registered and in safe working order, and inspected as MDOT (and FMCSA, where it applies) requires.\n• You'll carry ${COVERAGES.passenger_auto.label.toLowerCase()}: ${COVERAGES.passenger_auto.detail} These are our minimums; if the law or a venue or corporate customer requires more, the higher amount applies.${COUNSEL}\n• Michigan no-fault (PIP) coverage as required for your vehicles, and workers' compensation for employee drivers.\n• Name ${L} as additional insured where your carrier allows.`,
    },
    {
      h: "4. Drivers",
      p: "Every driver must be listed on your account and must: hold the right license class and endorsements for the vehicle (a CDL with passenger endorsement for vehicles designed to seat 16 or more); have a clean motor-vehicle record that meets your insurer's standard and ours; pass our background check; be enrolled in DOT drug and alcohol testing where required (CDL drivers); and follow federal hours-of-service limits where they apply (for passenger-carrying vehicles: no more than 10 hours driving after 8 consecutive hours off duty, no driving after 15 hours on duty, and the 60/70-hour weekly limits). Drivers never use alcohol or drugs within the times prohibited by law and never drive impaired or fatigued. No handheld phone use while driving.",
    },
    {
      h: "5. Passengers, alcohol and conduct",
      p: `• Drivers never drink alcohol on duty.\n• Where Michigan law allows alcohol in the passenger area of a chartered limousine or bus, only passengers 21 or older may drink. If anyone under 21 is aboard, follow the customer's agreement and the law — no alcohol for anyone under 21, and you may end service if it happens.${COUNSEL}\n• You may refuse or end a ride (safely, at a public, lit place) for violence, threats, illegal activity or conduct that makes driving unsafe; report it to us right away.\n• Don't exceed seated capacity. Everyone wears a seatbelt where one is provided.`,
    },
    {
      h: "6. Accessibility and children",
      p: "Don't refuse a passenger because of a disability or a service animal. When a booking requests a wheelchair-accessible vehicle, provide one that meets ADA standards or tell us immediately if you can't. Children must ride in the car seats or boosters Michigan law requires; the customer provides them unless the booking says you will.",
    },
    {
      h: "7. Accidents and incidents",
      p: "After any accident: make sure everyone is safe, call 911 if anyone is hurt, exchange information, and follow your insurer's and the law's reporting rules (including FMCSA accident-register rules where they apply). Tell us immediately if passengers are affected, and in writing within 24 hours in every case.",
    },
  ]),

  addendum("pro-addendum-medical-courier", "Medical Courier & HIPAA", ["medical_courier"], [
    `On medical runs you're a subcontractor business associate under HIPAA: use only the minimum patient information needed, keep it safe, and report any problem within 24 hours.`,
    "Keep packages sealed, locked and with you. Never leave one unattended or at a door unless the sender's instructions say so.",
    "No photos of labels except the proof the app requires. No detours and no passengers on medical runs.",
    "Current HIPAA training (and bloodborne-pathogens training for specimens) is required. Specimens are packaged by the sender (UN3373 Category B); you keep them upright, at the right temperature, with a spill kit.",
    "Chain of custody: scan or sign at every handoff, and check ID where required.",
  ], [
    {
      h: "1. HIPAA: you're a subcontractor business associate",
      p: `When you carry prescriptions, specimens, records or other items for clinics, pharmacies or labs, you may see protected health information (PHI) — names, addresses, phone numbers and labels. ${N} signs business associate agreements with these customers, and you agree to the same restrictions as a subcontractor business associate under 45 C.F.R. § 164.502(e) and § 164.504(e). This addendum is your written subcontractor agreement for that purpose.${COUNSEL}`,
    },
    {
      h: "2. Minimum necessary",
      p: "Use and look at only the information you need to pick up and deliver: typically the recipient's name, address, phone and sealed package labels. Never open a sealed package, read enclosed documents, or discuss a patient, delivery or what you carried with anyone except the sender, recipient and our team.",
    },
    {
      h: "3. Safeguards",
      p: "• Keep packages sealed and in your control at all times; lock them in your vehicle (in a locked compartment or container where possible) whenever you step away.\n• Never leave a package unattended, with a neighbor or at a door unless the sender's written instructions allow it.\n• No photos of labels or contents except the proof-of-delivery photo or scan the app requires, framed to show as little patient information as possible.\n• Keep your phone locked with a passcode; don't save patient details outside the app.\n• No detours, personal stops or passengers during a medical run — go directly from pickup to delivery.",
    },
    {
      h: "4. Reporting breaches and incidents",
      p: "Report to us within 24 hours of discovering it (immediately if you can) any loss, theft, misdelivery, opened or damaged package, wrong-recipient handoff, or any use or disclosure of PHI not allowed here. Cooperate with our investigation and the customer's breach-notification duties, and don't contact the patient about the incident yourself unless we ask.",
    },
    {
      h: "5. Training and certificates",
      p: "Keep a current HIPAA training certificate on file (it's part of onboarding; offers stop when it expires). For lab specimens you also need current OSHA bloodborne-pathogens training. DOT hazmat awareness for UN3373 specimens is strongly recommended. Training is required because the law requires it, not to control how you work.",
    },
    {
      h: "6. Specimens and temperature-sensitive items",
      p: "• The sender packages specimens as UN3373 Biological Substance, Category B (triple packaging, absorbent, labeled). Don't accept a package that's leaking, damaged or not properly labeled — tell the sender and us.\n• Keep specimens upright, secured, away from passengers' space, and within the temperature range on the package or work order, using a validated cooler or container when required.\n• Carry a spill kit and gloves. If a package leaks, follow your bloodborne-pathogens training, don't clean up without protection, and report it immediately.",
    },
    {
      h: "7. Chain of custody and handoff",
      p: "Scan or sign at every pickup and delivery in the app with the time. Hand off only to the named recipient or an authorized person at the facility, and check photo ID (and get a signature) where the work order requires it — always for controlled substances. If you can't deliver, follow the sender's instructions or return the package to the sender the same day; never keep it overnight unless the sender's written instructions allow it.",
    },
    {
      h: "8. Controlled substances",
      p: `Prescriptions that include controlled substances must be handed only to the patient or their authorized adult (18+) after an ID check and signature — never left at a door. Never open, count or hold them longer than the run requires. Report any loss or theft to us and the pharmacy immediately so the pharmacy can make its required DEA reports. Follow any added pharmacy rules on the work order.${COUNSEL}`,
    },
    {
      h: "9. Returning or destroying PHI",
      p: "When a run ends, or this agreement ends, return any paperwork with patient information to the sender or destroy it securely (shred), and delete any patient details from your devices. If you can't, keep protecting it under this addendum for as long as you have it.",
    },
  ]),

  addendum("pro-addendum-licensed-trades", "Licensed Trades & Home Improvement", BUILDING_TRADES, [
    "Licensed work (plumbing, electrical, HVAC, and residential remodeling and painting over the Michigan threshold) needs a current license in your business's name. Handyman and low-voltage pros never do work that needs a license they don't hold.",
    "The licensed party pulls permits; permit costs go on the customer's invoice through a change order. Work passes code and inspections.",
    "EPA lead-safe (RRP) certification for painting or remodeling disturbing paint in pre-1978 homes.",
    "Licensed and remodel work carries a 1-year workmanship warranty (repairs at no extra payout unless someone else caused the problem).",
    "Once we pay you, you waive lien rights for that work — and you pay your suppliers and helpers so customers never face a lien.",
    "Clean up every day; shut off and restore utilities safely.",
  ], [
    {
      h: "1. Licenses",
      p: `Work that Michigan requires a license for goes only to properly licensed pros: plumbing, electrical and mechanical (HVAC) contractor licenses from LARA with work done by a licensed master or journeyman; a Residential Builder or Maintenance & Alteration Contractor license for residential remodeling and painting jobs over the state threshold (currently $600); and EPA Section 608 certification for refrigerant work. The license must be current and held by your business (or its qualifying officer) as the law requires. Handyman and low-voltage pros don't do plumbing, electrical (line-voltage), HVAC or other licensed work — stop and tell us if a job turns out to need it.`,
    },
    {
      h: "2. Permits and inspections",
      p: "Where a job requires a permit, the licensed party pulls it before work starts, posts it as required, and schedules the inspections. Permit fees are passed to the customer on the invoice through a change order (if not already in the price). Work must meet the applicable codes and pass inspection; fixing a failed inspection caused by your work is at no extra payout.",
    },
    {
      h: "3. Lead-safe work (RRP)",
      p: "For painting, remodeling or repair that disturbs painted surfaces in homes or child-occupied facilities built before 1978, the firm must be EPA RRP-certified, a certified renovator must direct the work, and lead-safe practices, the EPA \"Renovate Right\" pamphlet and record-keeping are required.",
    },
    {
      h: "4. Workmanship warranty",
      p: `Licensed-trade and remodel work carries a 1-year workmanship warranty from completion (other work in these trades carries the standard ${BRAND.guaranteeDays}-day redo). During the warranty you'll repair defects in your workmanship at no extra payout. Problems caused by others — the customer, another contractor, misuse, normal wear, or manufacturer defects in products you didn't choose — aren't covered, and a repair for them is a new paid job. Manufacturer warranties on products pass to the customer; register them where required.${COUNSEL}`,
    },
    {
      h: "5. Liens and paying your suppliers",
      p: `${N} collects from the customer and pays you. Once your payout for a job (or phase) is paid, you waive and release any construction lien rights against the customer's property for that work, and you'll sign a written lien waiver in the form Michigan's Construction Lien Act requires if we or the customer ask. You'll pay your suppliers, subcontractors and helpers in full and on time so that no one files a lien against a customer. If a lien is filed because you didn't pay someone, you'll get it released at your cost, and we may use payouts owed to you to pay that person directly.${COUNSEL}`,
    },
    {
      h: "6. Materials",
      p: "Materials not in the price are bought and reimbursed through the app's approved process (receipt upload; our OK above the auto-approve limit; a change order for big amounts). Use materials that meet code and the scope. Don't substitute a different product the customer chose without their OK through the app.",
    },
    {
      h: "7. Site care, cleanup and utilities",
      p: "Protect floors, furniture and finishes; contain dust; clean up at the end of each day and haul away your debris (unless the scope says otherwise). Before shutting off water, gas or power, tell the customer; restore service safely when you're done or explain in the app why you can't. Never leave a hazard (open wiring, gas off without notice, open trenches, unsecured ladders) unattended.",
    },
  ]),

  addendum("pro-addendum-pet-care", "Pet Care & Pet Waste", ["pet_care", "pet_waste"], [
    "Pets stay on leash outside a fenced area — always. Never off-leash at parks or on walks.",
    "We confirm the pet's vaccinations with the owner; you may decline any pet that isn't up to date.",
    "You can always refuse or stop with an aggressive animal. It never counts against you.",
    "Emergency? Get the pet to safety, call the owner and us. We may authorize vet care where the owner has agreed in advance.",
    "Respect weather limits, secure gates, and keep keys and lockbox codes safe.",
  ], [
    {
      h: "1. Leashes and gates",
      p: "Dogs stay on a secure leash at all times outside a fully fenced area — never off-leash on walks, at parks or dog parks unless the owner has given written permission through us and the area allows it. Walk one household's dogs at a time unless the owner agrees. Check gates and doors before letting a pet into a yard, and close them every time — this applies to pet-waste visits too.",
    },
    {
      h: "2. Vaccinations and health",
      p: "Before a first visit, we ask the owner to confirm the pet's vaccinations (rabies and others the vet recommends) and any medical needs. You may decline any pet that isn't up to date. Give medication only as the owner's written instructions say. Wash your hands between pets and between yards.",
    },
    {
      h: "3. Aggressive or unsafe animals",
      p: "If an animal acts aggressively or you feel unsafe, don't enter or stop the visit, keep yourself safe, and tell the owner and us. You can refuse any animal, at any time. This never counts against you.",
    },
    {
      h: "4. Emergencies",
      p: `If a pet is hurt, sick, lost or bitten: get the pet (and yourself) to safety, call the owner, and call us. If the owner can't be reached and the pet needs urgent care, take it to the owner's listed vet or the nearest emergency vet. ${N} may authorize treatment up to the amount the owner agreed to in the customer pet-care addendum; you never pay vet bills yourself. Report any bite to us and as local law requires.`,
    },
    {
      h: "5. Weather",
      p: "In extreme heat (generally 85°F+ with high humidity), extreme cold (generally below 20°F or icy conditions) or storms, shorten walks, avoid hot pavement and ice-melt salt, and keep the pet safe indoors where possible. Tell the owner what you did.",
    },
    {
      h: "6. Keys, lockboxes and pet waste",
      p: "Keys and codes are used only for that visit, never copied, and returned when the service ends. Lock up as you found it. Bag pet waste and dispose of it as the work order says (customer's bin or yours), never in a storm drain.",
    },
  ]),

  addendum("pro-addendum-events-food", "Events, Food & Venues", ["event_planner", "catering", "food_truck", "dj_music", "rentals", "venue"], [
    "Food service needs your health-department or MDARD license and a certified food protection manager; food handlers follow the Michigan Food Code.",
    "Label allergens and keep foods at safe temperatures.",
    "Alcohol only with a proper MLCC license and liquor liability insurance, by trained servers — never to anyone under 21 or visibly intoxicated.",
    "Follow venue rules, capacity limits, noise ordinances and permit rules. Set up safely, especially sound, power and tents.",
    "Rentals: inspect and photo at delivery and pickup. Coordinate with the event's planner.",
  ], [
    {
      h: "1. Food licenses and food safety",
      p: "Caterers need a food-service license from the county health department; food trucks need a mobile food establishment license (MDARD / county). Each operation needs a certified food protection manager, and everyone handling food follows the Michigan Food Code: handwashing, hot and cold holding temperatures, no bare-hand contact with ready-to-eat food, and staying home when sick. Keep your latest inspection on file with us.",
    },
    {
      h: "2. Allergens",
      p: "Label every dish with major allergens (milk, eggs, fish, shellfish, tree nuts, peanuts, wheat, soy and sesame) and with what the customer requested (vegan, halal, kosher, gluten-free). Prevent cross-contact for allergy-safe orders, and never claim a dish is allergen-free unless you're sure.",
    },
    {
      h: "3. Alcohol",
      p: `Serve alcohol only when you (or the venue) hold the right Michigan Liquor Control Commission license or permit for that event, carry liquor liability insurance (${COVERAGES.liquor.detail.split(".")[0]}), and use servers with responsible-service training (such as TIPS or ServSafe Alcohol). Check ID; never serve anyone under 21 or anyone visibly intoxicated; stop service at the agreed time. You may refuse service to anyone, and doing so never counts against you.${COUNSEL}`,
    },
    {
      h: "4. Venues",
      p: "Venue owners keep a current certificate of occupancy, respect the posted capacity, keep exits, fire equipment and accessible routes clear, and tell the customer the venue's rules in advance. Vendors follow the venue's rules on load-in, open flames, décor, noise and end times.",
    },
    {
      h: "5. Sound, lighting and power",
      p: "Set up equipment safely: secure speakers and stands, tape down or cover cables across walkways, don't overload circuits, keep liquids away from equipment, and use weatherproof gear and GFCI protection outdoors. Follow local noise ordinances and the venue's sound limits and curfews.",
    },
    {
      h: "6. Rentals: delivery, setup and pickup",
      p: "Deliver and pick up in the agreed windows. Set up tents, staging and inflatables per the manufacturer's instructions, anchored for wind, with any required tent permit (and call 811 before staking into the ground where required). Supervise or brief the customer on inflatable safety rules. Photograph items at delivery and pickup; report damage or missing items through the app within 24 hours of pickup so we can handle it with the customer — don't charge customers directly.",
    },
    {
      h: "7. Working with the planner",
      p: "Be set up and ready before the event start time. Coordinate timing, power, load-in and changes with the event planner on site (or with us if there isn't one). A planner's coordination is about the event schedule the customer set — how you do your own work stays up to you.",
    },
  ]),

  addendum("pro-addendum-errands-delivery", "Errands & Deliveries", ["errands"], [
    "Spend customer or company money only on what the customer asked for, and upload every receipt.",
    "Never use customer funds, cards or items for anything personal. No cash handling.",
    "Age-restricted items (alcohol, tobacco, vape, cannabis, some medicines) need an ID check at handoff — 21+ where the law says so.",
    "Keep cold food cold and hot food hot; don't deliver anything unsafe.",
    "Your auto insurance must cover business or delivery use — personal policies often exclude it.",
  ], [
    {
      h: "1. Purchases",
      p: `Buy only what the customer listed (or approved substitutions in the app), up to the shopping limit on the job (currently ${money(P.materials.shoppingMax)} without the customer's extra OK). Upload an itemized receipt for every purchase. Reimbursement is at cost; we never pay you more than the receipt and you never pay for the customer's items from your payout.`,
    },
    {
      h: "2. Customer funds and items",
      p: "Never use a customer's or our money, card, account or items for anything personal, and never keep change, rewards points or extras that belong to the customer. Don't accept or carry cash for a customer — all payment goes through the app.",
    },
    {
      h: "3. Age-restricted items",
      p: "Deliver alcohol, tobacco, vaping products, cannabis or other age-restricted items only where the law and the seller allow, and only to the customer (or an adult they named) after checking a valid photo ID showing they're of legal age (21+ for alcohol, tobacco and cannabis). If they can't show ID or appear intoxicated, don't hand it over — return it as the app instructs.",
    },
    {
      h: "4. Food safety",
      p: "Keep perishables in insulated bags or coolers, deliver promptly, and don't leave them in a hot or freezing car. Don't deliver items that are damaged, spoiled, recalled or past date — tell the customer in the app and let them choose a substitute or refund.",
    },
    {
      h: "5. Vehicle insurance",
      p: "If you drive for jobs, your auto insurance must cover business or delivery use. Many personal policies exclude it; get a business-use or delivery endorsement or a commercial policy, and keep proof on file. Without it, offers for driving jobs stop.",
    },
  ]),

  addendum("pro-addendum-hauling", "Hauling, Junk Removal & Containers", ["hauling", "dumpster"], [
    "Dispose of everything lawfully at licensed facilities, and upload the receipts or weigh tickets.",
    "Don't take prohibited items (hazardous waste, tires and appliances only where allowed, etc.).",
    "Donations go only where the customer agreed, with a receipt.",
    "Secure and tarp every load. Respect weight limits.",
    "Place containers carefully, with permits for the street, and protect driveways and lawns.",
  ], [
    {
      h: "1. Lawful disposal",
      p: "Take everything to licensed landfills, transfer stations or recycling facilities and upload the receipt or weigh ticket. Illegal dumping leads to immediate deactivation and you pay any fines and cleanup. Recycle appliances, electronics, metal and tires where the law requires, and remove refrigerant from appliances only through a certified technician or facility.",
    },
    {
      h: "2. Prohibited items",
      p: "Don't accept hazardous waste (paint, solvents, chemicals, propane tanks, asbestos, medical waste, ammunition) unless you're licensed and equipped to handle it. If you find it, leave it and tell the customer and us; we'll point the customer to a proper disposal option.",
    },
    {
      h: "3. Donations and customer items",
      p: "Take items to donation or resale only when the customer agreed in the app, and upload the donation receipt for the customer. Never keep, sell or give away a customer's items for yourself. Don't take anything not on the job list without the customer's OK.",
    },
    {
      h: "4. Loads, weight and placement",
      p: "Secure and tarp every load so nothing falls or blows out. Stay within your vehicle's and container's weight limits; overweight fees are passed to the customer only if the customer's loading caused them and the work order says so. Place containers where the customer chose, using boards to protect driveways; get the city's permit before placing on a street or sidewalk. Photograph the area before and after placement and pickup.",
    },
  ]),

  addendum("pro-addendum-outdoor-and-heights", "Outdoor Work, Trees, Snow & Heights", ["lawn", "tree", "snow", "gutters", "pressure_washing", "windows"], [
    "Use ladders and fall protection properly; you can always refuse unsafe heights.",
    "Tree work follows ANSI Z133 safety basics. Stay at least 10 feet from power lines — always.",
    "Call 811 before digging, staking or grinding stumps.",
    "Snow: mark obstacles, salt sensibly, and follow the trigger and timing in the work order.",
    "Use chemicals per the label, with an MDARD applicator certificate where required. Keep runoff out of storm drains.",
  ], [
    {
      h: "1. Ladders and fall protection",
      p: "Use ladders rated for the load, on level footing, at a safe angle, with three points of contact; secure or tie off extension ladders. Use fall protection when working on roofs or at heights where OSHA requires it. You can refuse any job or part of a job you think is unsafe at height — tell us and it doesn't count against you.",
    },
    {
      h: "2. Tree work and power lines",
      p: "Tree work follows ANSI Z133 safety standards (personal protective equipment, chainsaw safety, rigging, work zones and a qualified crew). Stay — and keep tools, ropes, branches and equipment — at least 10 feet from overhead power lines; if a tree is near or touching a line, stop and call the utility. Work near lines only with a qualified line-clearance arborist where the law allows. Protect structures, lawns and driveways; get permits for street trees or right-of-way work where required.",
    },
    {
      h: "3. Call 811 before you dig",
      p: "Before digging, staking, aerating deeply, installing posts or grinding stumps, contact MISS DIG 811 at least 3 business days ahead (as Michigan law requires) and respect the marks. Private lines (sprinklers, invisible fences, lighting) aren't marked by 811 — ask the customer.",
    },
    {
      h: "4. Snow and ice",
      p: "Put out plow markers before the season (or the first visit) and note obstacles. Follow the trigger depth and timing in the work order (for example, plow at 2 inches and finish by the time stated). Use salt and ice melt sensibly; avoid pet-unsafe products where the work order says pets are present. Don't push snow into streets, onto sidewalks or into neighbors' property. Photograph conditions when you finish.",
    },
    {
      h: "5. Chemicals and runoff",
      p: "Apply fertilizer, weed control and pesticides only as the label directs, and only with MDARD commercial applicator certification where Michigan requires it. Post required notices. For pressure and soft washing, protect plants, cover outlets and fixtures, and keep wash water and chemicals out of storm drains as local rules require.",
    },
  ]),

  addendum("pro-addendum-home-services", "Cleaning, Carpet, Organizing & Auto Detailing", ["cleaning", "carpet", "organizing", "auto_detailing"], [
    "Use products per their label and safety data sheet (SDS); never mix chemicals.",
    "Handle customer belongings with care and report any breakage right away with photos.",
    "Never throw anything away without the customer's clear OK.",
    "Auto detailing: photograph the vehicle's condition before you start.",
  ], [
    {
      h: "1. Chemicals",
      p: "Use products according to their labels and keep their safety data sheets (SDS) available on your phone or in your vehicle. Never mix chemicals (for example bleach and ammonia). Ventilate, use gloves and eye protection as the label says, and keep products away from children and pets. Use the customer's requested products (for example fragrance-free) when the work order says so.",
    },
    {
      h: "2. Customer belongings",
      p: "Move items carefully and put them back where they were. Don't clean or treat valuables, artwork, antiques or electronics unless the work order covers them. Report anything broken or damaged immediately in the app with photos — honest reporting is always better than discovery later.",
    },
    {
      h: "3. Discarding items",
      p: "Never throw away, donate or remove anything unless the customer has clearly OK'd it in the app or on the work order. When organizing or clearing out, sort into keep, donate and discard piles and get the customer's sign-off before anything leaves. Treat sensitive items (documents, photos, medications) with care and shred documents only on the customer's request.",
    },
    {
      h: "4. Vehicles",
      p: "Before you start a detail, walk around the vehicle and photograph existing scratches, dents, stains and damage, and note them in the app. Remove and return personal items to the customer, never keep anything found in a vehicle, and don't drive the vehicle unless the work order allows it. Follow local rules on water runoff; use self-contained water collection where required.",
    },
  ]),
];

/**
 * Trades with no addendum — fully covered by the main agreement. Computed so a trade added to
 * TRADES later shows up here until someone writes its addendum (currently empty).
 */
export const CORE_ONLY_TRADES: string[] = TRADES.map((t) => t.id).filter((id) => !PRO_ADDENDA.some((a) => a.trades?.includes(id)));

// ─── 7. Everything a pro signs ─────────────────────────────────────────────────

export const PRO_CONTRACTS: Contract[] = [PRO_AGREEMENT, PRO_CODE_OF_CONDUCT, PRO_DEACTIVATION_POLICY, PRO_BACKGROUND_CHECK_NOTICE, PRO_LOCATION_CONSENT, ...PRO_ADDENDA];
