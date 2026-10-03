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
const highGlTrades = Object.entries(TRADE_PROFILES).filter(([, p]) => p.glMin > 1_000_000).map(([id, p]) => `${label(id)} (${money(p.glMin)})`);
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
      p: `You'll keep, at your own cost, for as long as you accept jobs:\n• General liability insurance of at least $1,000,000 per occurrence and $2,000,000 aggregate${highGlTrades.length ? ` (higher for ${list(highGlTrades)})` : ""}, naming ${L} as additional insured.\n• Auto insurance for any vehicle you use for jobs. Personal auto policies often exclude business use — make sure yours covers it. Commercial auto (${COVERAGES.auto.detail.split(".")[0]}) is required for ${list(tradesRequiring("auto"))}.\n• Workers' compensation for your own employees where Michigan (or your state) requires it. If you have no employees, you'll sign a no-employees statement and get coverage before anyone works for you on a ${N} job.\n• The trade-specific coverages for your trades, shown in your onboarding checklist — for example a fidelity bond for ${list(tradesRequiring("bond"))}; passenger carrier auto liability for transportation; liquor liability whenever alcohol is served.\n\nYou'll upload current certificates and tell us right away if coverage is cancelled, reduced or lapses. We verify policies with carriers. Offers stop automatically the day a required policy expires and restart as soon as a renewal is verified. Your insurance is primary for your work.`,
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
