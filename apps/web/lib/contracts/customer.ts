/*
 * FILE    : apps/web/lib/contracts/customer.ts
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-03_0039 UTC
 * UPDATED : 2026-10-04_2204 UTC — first looks (business account pros, customer favorites, crew member requests) and the open job board ("Jobs near you"); agreement v5 / Service Agreement v7.
 * PURPOSE : Every contract a customer or business client agrees to, in plain English:
 *             TERMS_OF_USE            — the website/app, accounts, messages, disputes (arbitration)
 *             SERVICE_AGREEMENT       — accepted at every booking, printed on every invoice
 *                                       (version = SERVICE_AGREEMENT_VERSION; replaces lib/service-agreement.ts v4)
 *             BUSINESS_MSA            — master services agreement for business accounts
 *             MEMBERSHIP_PROMO_TERMS  — Plus membership, gift cards, promo codes, referrals, tips
 *             CUSTOMER_ADDENDA        — extra terms for specific services (rides, medical, pets,
 *                                       events, construction, errands, hauling, detailing, home & yard)
 *             CORE_ONLY_SERVICES / customerCoverageGaps() — every service is covered by an addendum
 *           Numbers come from @handled/core so a price change never leaves a contract stale.
 *           "[Confirm with counsel.]" marks the judgment calls. TEMPLATES — not legal advice.
 * UPDATED : 2026-10-03_0152 UTC — market pricing (suggested price that learns from what pros accept,
 *           name your price within OFFER_BOUNDS, flat BOOKING_FEE, pro counteroffers, raising an offer):
 *           Terms of Use, Service Agreement, Business MSA and Plus/promo terms updated to match.
 * UPDATED : 2026-10-03_1311 UTC — construction addendum: equipment you buy for us to install must be new; we never install used.
 * UPDATED : 2026-10-04_1934 UTC — hauling addendum covers small moves, large-item delivery and staging moves (new "Moves and deliveries" section); unit turnover under the hauling and construction addenda; Business MSA: terms approved in the business account portal count as an Order.
 * UPDATED : 2026-10-04_1950 UTC — errands addendum: grocery delivery removed, Same-Day Courier added.
 * UPDATED : 2026-10-05_0439 UTC — events addendum covers Event Security (licensed agencies, unarmed by default, de-escalation, incident reports).
 * UPDATED : 2026-10-05_1433 UTC — addendum-security (standing posts, patrols, fire watch).
 */
import {
  AI_MAX_CUT,
  AI_MAX_RAISE,
  BOOKING_FEE,
  BRAND,
  DEPOSIT,
  DISCOUNT_FLOOR,
  HANDLED_PLUS,
  LATE_CANCEL_FEE,
  MARKET_BOUNDS,
  OFFER_BOUNDS,
  PRO_POLICY_DEFAULTS,
  RECURRING_DISCOUNT,
  REFERRAL,
  RUSH_HOURS,
  RUSH_SURCHARGE,
  SERVICES,
  SERVICE_AGREEMENT_VERSION,
  TIP_MAX,
  money,
} from "@handled/core";
import type { Contract, ContractSection } from "./types";

// ─── helpers ──────────────────────────────────────────────────────────────────
const V1 = "2026-10-v1";
const COUNSEL = " [Confirm with counsel.]";
const pct = (x: number) => `${Math.round(x * 100)}%`;
/** Paragraphs → one section body. */
const p = (...paras: string[]) => paras.join("\n\n");
/** Bullet list (one paragraph). */
const ul = (...items: string[]) => items.map((i) => `• ${i}`).join("\n");
/** Number the headings in order: "1. Title". */
const numbered = (items: [string, string][]): ContractSection[] => items.map(([h, body], i) => ({ h: `${i + 1}. ${h}`, p: body }));

const US = `${BRAND.legalName} ("${BRAND.name}", "we", "us")`;
const CONTACT = `email ${BRAND.supportEmail} or call ${BRAND.supportPhone}`;
const MATERIALS_OK = money(PRO_POLICY_DEFAULTS.materials.autoApproveUpTo);
const SHOPPING_MAX = money(PRO_POLICY_DEFAULTS.materials.shoppingMax);
/** How far the learned local market can move a suggested price, and the name-your-price range. */
const MARKET_DOWN = pct(1 - MARKET_BOUNDS.min);
const MARKET_UP = pct(MARKET_BOUNDS.max - 1);
const OFFER_LOW = pct(OFFER_BOUNDS.min);
const OFFER_HIGH = `${OFFER_BOUNDS.max} times`;
const FEE = money(BOOKING_FEE);
const PLAN_DISCOUNTS = `weekly ${pct(RECURRING_DISCOUNT.weekly)}, every two weeks ${pct(RECURRING_DISCOUNT.biweekly)}, monthly ${pct(RECURRING_DISCOUNT.monthly)}, quarterly ${pct(RECURRING_DISCOUNT.quarterly)}`;

// ════════════════════════════════════════════════════════════════════════════
// 1. TERMS OF USE
// ════════════════════════════════════════════════════════════════════════════
export const TERMS_OF_USE: Contract = {
  key: "terms-of-use",
  title: `${BRAND.name} Terms of Use`,
  version: V1,
  audience: "customer",
  appliesTo: `Everyone who visits the ${BRAND.name} website or app, creates an account, gets a price, or books a service.`,
  summary: [
    "You must be 18 or older to use the app and book services.",
    `${BRAND.name} is the company you deal with. We suggest the price, book, manage and guarantee the job. Independent, vetted pros do the work.`,
    "Our AI suggests prices and answers questions. It can make mistakes. You may offer your own price within limits. The firm price is the one on your invoice.",
    "We text and email you about your jobs. You can stop marketing email anytime, and reply STOP to stop texts.",
    "Be honest and respectful. Don't misuse the app, our pros or other people's information.",
    "If we have a problem, we talk first. If we can't fix it in 30 days, a neutral arbitrator decides, one person at a time. Small claims court is always an option.",
    "You can opt out of arbitration within 30 days of creating your account by emailing us.",
    "Michigan law applies.",
  ],
  sections: numbered([
    ["Agreeing to these terms", p(
      `These Terms of Use are a contract between you and ${US}. They cover our website, our mobile apps, your account, our AI assistant and our messages to you (together, "the app").`,
      "By using the app, creating an account or booking a service, you agree to these terms. Each booking also has its own Service Agreement, which is part of the same deal. If you book for a business, the Business Services Agreement may also apply.",
      "If you don't agree, please don't use the app.",
    )],
    ["Who can use the app", p(
      "You must be at least 18 years old and able to make a legal contract. You may book for yourself, your family or a business you are allowed to act for.",
      "If you book for someone else (for example, a parent or a tenant), you promise you have their permission. You are still responsible for payment and for following these terms.",
      "Our services are not for children. We don't knowingly collect information from children under 13.",
    )],
    ["Your account", p(
      ul(
        "Give us true, current information: your name, phone, email and service address.",
        "Keep your password and sign-in codes private. Don't share your account.",
        "You are responsible for bookings and activity on your account.",
        `Tell us right away if you think someone else used your account: ${CONTACT}.`,
        "One person, one account. Don't make extra accounts to get promotions again.",
      ),
      "You can close your account at any time by contacting us. Bookings already paid for still follow their Service Agreement.",
    )],
    ["How the marketplace works", p(
      `${BRAND.name} is a service company that runs on a network of independent pros. When you book, you contract with us. We suggest a price (and you may offer a different one within limits), schedule the job, choose a qualified pro, check the work and stand behind it with our guarantee.`,
      "The work itself is done by independent, insured, background-checked service businesses (\"pros\"). Pros are not our employees. They control how they do the work, within the scope you paid for.",
      "Some services, like rides and licensed trade work, must be done by a company that holds a special license. For those, we book a licensed company for you. The extra terms for that service (an \"addendum\") explain who does what.",
      "We may decline any booking. For example, if the job is outside our area, unsafe, unlawful, or not something we can do well.",
    )],
    ["Prices, quotes and our AI", p(
      "We use software, including artificial intelligence (AI), to suggest prices, answer questions, read photos, schedule pros and check work.",
      "Suggested price and name your price: for each job we show a suggested price. It is based on the details you give us, our standard rates, and what pros in your area have actually accepted for similar jobs. You may book at that price or offer a different price within the limits shown. Pros decide whether to take a job at the price offered, so a lower offer may take longer or may not be taken. The Service Agreement explains suggested prices, offers, the booking fee, pro counteroffers and raising your offer.",
      "AI can make mistakes. A suggested price, a price range, a chat answer or a photo estimate is not a promise. The firm price is the price on your invoice: the price you agreed to and paid when you booked, plus any raise or pro counteroffer you accepted. If the job turns out to be different from what you described, the Service Agreement explains how a change order works.",
      "Some jobs need a pro to see them first (a free site visit). A firm quote after a site visit is good for 14 days.",
      "Please don't rely on our AI for medical, legal, safety, tax or financial advice. For emergencies like gas leaks, fires, flooding with electrical risk, or medical problems, call 911 or your utility first.",
      "If you think a price is wrong, ask us before you pay. We will check it. If we made an obvious pricing error, we may correct it before the work starts, and you may cancel for a full refund.",
    )],
    ["Payments", p(
      "Payments are processed by Stripe, our payment provider. Your card details go straight to Stripe. We don't store your full card number.",
      "By saving a card, you let us charge it for bookings you make, balances due on deposits, raises to your offer and pro counteroffers you accept, approved change orders and materials, recurring plans you sign up for, memberships, tips you choose to give, and fees described in the Service Agreement (like a late-cancellation fee).",
      "Refunds go back to the original payment method. Gift card and credit amounts go back to your gift card or credit balance.",
      "Stripe's own terms also apply to your payment.",
    )],
    ["Messages we send you", p(
      "By giving us your phone number and email, you agree that we may contact you, including by automated text messages, about:",
      ul(
        "Your bookings: confirmations, arrival times, your pro's name, live location, photos, receipts and invoices.",
        "Your account: sign-in codes, security alerts and payment problems.",
        "Customer support and quality checks, including a short survey after a job.",
      ),
      "These job messages are part of the service. You can't turn all of them off while you have an active booking, but you can choose email over text by contacting us.",
      "Marketing email: we may send offers, seasonal reminders and saved-quote follow-ups. Every marketing email has a one-click unsubscribe link. Unsubscribing does not stop job messages.",
      "Marketing texts: we only send marketing texts if you separately agree to them. Consent is not a condition of buying anything.",
      "Texts: reply STOP to stop texts, or HELP for help. Message and data rates may apply. Message frequency varies with your bookings.",
      "Push notifications: you can turn these off in your phone's settings.",
      "Language: we send messages in English or Spanish, based on the language you choose. You can change it in your account.",
      "Calls and chats with support may be recorded or saved for quality and training. Our AI may help write or answer messages.",
    )],
    ["Ratings and reviews", p(
      "After a job, we ask you to rate it. We also ask every customer who rates us to consider leaving a public Google review. We ask everyone, happy or not. We never pay for reviews or offer anything in return for a positive one.",
      "Please be honest and fair. Don't post reviews that are false, hateful, threatening, or that share someone's private information (like a pro's home address or phone number).",
      "We never stop you from posting an honest review, and nothing in these terms limits your right to do so.",
      "We may remove ratings or content that break these terms. We don't edit honest reviews to change their meaning.",
    )],
    ["Content you share", p(
      "You keep ownership of the photos, notes, messages and reviews you share (\"your content\").",
      "You give us a license to use your content to provide and improve the service: to price and plan jobs, share what's needed with your pro, check quality, train our staff and software, resolve disputes, and meet legal duties. This license is worldwide, free, and lasts as long as we need it for those purposes.",
      "We never publish photos of your home or property, or your name, in our marketing without your permission. If you post a public review on our site, we may show it with your first name and last initial.",
      "Only share content you have the right to share. Don't upload photos of other people without their permission.",
    )],
    ["Things you must not do", p(
      "When you use the app, you agree not to:",
      ul(
        "Break the law, or ask a pro to break the law or a safety rule.",
        "Harass, threaten, discriminate against or abuse pros, our staff or anyone else.",
        "Give false information, book in someone else's name without permission, or use a stolen card.",
        "Abuse promotions, referrals, gift cards or our guarantee (for example, many accounts, fake referrals, or false damage claims).",
        "Hire a pro you met through us directly to avoid our fees (see the Service Agreement).",
        "Copy, scrape, resell or reverse-engineer the app, or use bots to book or take data.",
        "Interfere with the app's security or try to get into accounts or systems that aren't yours.",
        "Use the app to send spam or to collect pros' or customers' personal information.",
        "Try to trick our AI into giving prices or answers that break our rules.",
      ),
      "We may limit, pause or close accounts that break these rules.",
    )],
    ["Location features", p(
      "If you allow it, the app uses your device's location to fill in your address and show nearby service. You can turn this off in your device settings.",
      "While a pro is on the way to you, we show you the pro's live location. This is shared only for that job, only while they are en route or on the job, and only with you and our team.",
      "Please don't share a pro's live location with others or use it for anything else.",
    )],
    ["Privacy", p(
      "Our Privacy Policy explains what information we collect and how we use and share it. It is part of these terms. We never sell your personal information.",
      "We share with your pro only what they need to do the job, such as your first name, the address, access notes and photos.",
    )],
    ["Our intellectual property", p(
      `The app, our name and logo, our prices and pricing tools, our text, designs and software belong to ${BRAND.legalName} or our licensors. We give you a limited, personal, non-transferable right to use the app to get and manage services. You may not copy or use our brand or content for anything else without our written permission.`,
      "If you send us ideas or feedback, we may use them without owing you anything.",
    )],
    ["Other companies' services", p(
      "The app uses and links to services run by other companies, such as Stripe (payments), Google (maps and reviews), app stores, text and email providers, and AI providers. Their terms and privacy policies apply to how you use them. We are not responsible for their services, but we pick them with care.",
    )],
    ["Disclaimers", p(
      "We work hard to keep the app running and accurate. But the app is provided \"as is\" and \"as available.\" We don't promise it will always be available, error-free or secure.",
      "Our promises about the actual work are in the Service Agreement and its guarantee. To the extent the law allows, we make no other warranties about the app, including implied warranties of merchantability, fitness for a particular purpose and non-infringement.",
      "Some states don't allow these disclaimers, so some of them may not apply to you.",
    )],
    ["Limits on our liability", p(
      "To the extent the law allows:",
      ul(
        "We are not responsible for indirect, special, incidental, consequential or punitive damages, or for lost profits, lost data or lost business, from your use of the app.",
        "For claims about the app itself (not a job), our total liability is limited to the greater of $100 or the amount you paid us in the 6 months before the claim.",
        "Claims about a job are covered by that job's Service Agreement and its limits.",
      ),
      "Nothing in these terms limits liability for our fraud, our gross negligence or willful misconduct, death or personal injury caused by our negligence, or anything else the law does not allow us to limit.",
    )],
    ["Your responsibility for misuse", p(
      `If you misuse the app, break these terms or the law, or give us false information, and that causes a claim against ${BRAND.name}, our team or a pro, you agree to cover the reasonable costs of that claim, including reasonable lawyer fees. This does not apply to claims caused by our own fault.`,
    )],
    ["Resolving disputes: talk to us first", p(
      `Most problems are fixed quickly. Before starting any formal claim, you and we each agree to try to resolve it informally. Send a written \"Notice of Dispute\" by email to ${BRAND.supportEmail} (subject line: Notice of Dispute). Include your name, contact details, booking number if any, what happened and what you want. We will send ours to the email on your account.`,
      "We will both try in good faith to settle it for 30 days after the notice is received. If you ask, we will talk by phone or video. Neither side may start arbitration or a lawsuit until the 30 days end, and time limits for bringing the claim pause during this period.",
    )],
    ["Binding individual arbitration", p(
      "If we can't resolve it informally, you and we agree that any dispute about the app, these terms, a booking, a service, our messages or our relationship will be decided by binding individual arbitration, not in court. This includes disputes about whether this section applies, except as stated below.",
      ul(
        "Who runs it: the American Arbitration Association (AAA) under its Consumer Arbitration Rules. If AAA can't or won't, the parties pick another neutral provider, or a court will.",
        "Where: by video or phone, or in person in the county where you live or where the service took place, as you choose. Claims of $25,000 or less may be decided on written documents alone if you want.",
        "Fees: you pay no more than you would to file a case in court. We pay all other AAA filing, administration and arbitrator fees, unless the arbitrator finds your claim was frivolous or brought for an improper purpose.",
        "Powers: the arbitrator can award the same individual relief a court could, including damages and lawyer fees where the law allows. Any relief only applies to you and us.",
        "The Federal Arbitration Act governs this section.",
      ),
      "There is no judge or jury in arbitration, and review by a court is limited." + COUNSEL,
    )],
    ["Exceptions: small claims and urgent matters", p(
      "Either side may instead bring an individual claim in small claims court, as long as it stays there and qualifies there.",
      "Either side may also go to court to stop misuse of intellectual property or unauthorized access to the app.",
      "Nothing here stops you from bringing an issue to a government agency (like the Michigan Attorney General) or your bank.",
    )],
    ["No class actions", p(
      "You and we may only bring claims as individuals, not as a plaintiff or class member in a class, collective or representative action. The arbitrator may not combine more than one person's claims unless everyone agrees.",
      "If a court decides this no-class rule can't be enforced for a particular claim, then that claim (and only that claim) goes to court, after the individual arbitration of any other claims is finished. The rest of the arbitration agreement still applies." + COUNSEL,
    )],
    ["Many similar claims (mass arbitration)", p(
      "If 25 or more similar arbitration demands are filed against us (or by us) by the same or coordinated lawyers or organizations within 90 days, they will be handled in batches. AAA will group them in batches of up to 50 claims, with one arbitrator per batch where possible, and only one batch is processed at a time. The other cases wait, and filing fees for waiting cases are not due until their batch starts. Time limits for those claims pause while they wait.",
      "This keeps everyone's claims moving fairly and stops fee pressure from forcing settlements. A court may enforce this section." + COUNSEL,
    )],
    ["Your right to opt out of arbitration", p(
      `You can opt out of the arbitration agreement within 30 days after you first accept these terms (for example, when you create your account or make your first booking). Email ${BRAND.supportEmail} with the subject line \"Arbitration Opt-Out\" and include your name, the email or phone on your account, and a clear statement that you opt out.`,
      "Opting out doesn't change anything else in these terms, and it doesn't affect your service. If you opt out, disputes will go to the courts described below.",
      "If we make a significant change to the arbitration section later, you may reject that change by emailing us within 30 days of the change. The earlier version will then still apply to you.",
    )],
    ["Michigan law and courts", p(
      "Michigan law governs these terms and any dispute, except where federal law (including the Federal Arbitration Act) applies. If you live in another state, you still keep any consumer protection rights your state gives you that can't be waived.",
      "For anything that goes to court and is not in small claims, the state and federal courts for Wayne County, Michigan will hear it, unless the law says you may sue where you live.",
      "Any claim must be brought within one year after it arises, unless the law requires a longer time." + COUNSEL,
    )],
    ["Changes to these terms", p(
      "We may update these terms as the service changes or the law changes. If a change is important, we will tell you by email or in the app at least 14 days before it takes effect, unless it is required sooner by law or to fix a safety or security problem.",
      "Changes don't apply to bookings already paid for, or to disputes already started. If you keep using the app after a change takes effect, you accept the new terms. If you don't agree, you may close your account.",
    )],
    ["Ending your account", p(
      "You can stop using the app and close your account at any time.",
      "We may suspend or close your account if you break these terms, if we suspect fraud or abuse, if you are unsafe or abusive toward a pro or our staff, or if we stop offering the service. If we close your account through no fault of yours, we will refund paid bookings that haven't happened yet and unused gift card balances.",
      "Sections that by their nature should survive (like payment owed, content license, disclaimers, limits on liability, dispute resolution and governing law) continue after your account closes.",
    )],
    ["General", p(
      ul(
        "These terms, the Privacy Policy, each Service Agreement and any addendum for your service are the whole agreement about the app.",
        "If one part is found unenforceable, the rest still applies, and that part is changed only as much as needed.",
        "If we don't enforce a rule right away, we can still enforce it later.",
        "You may not transfer these terms. We may transfer them to a company that takes over our business, with notice to you.",
        "We aren't responsible for delays caused by events outside our control, like storms, outages, or government action.",
        "Headings are only for convenience. \"Including\" means \"including but not limited to.\"",
        "If these terms are translated, the English version controls where there is a difference, to the extent the law allows.",
      ),
    )],
    ["Contact us", p(
      `${BRAND.legalName} · ${BRAND.supportEmail} · ${BRAND.supportPhone}. Legal notices to us must be sent by email to ${BRAND.supportEmail} with "Legal Notice" in the subject line, plus by mail if we publish a mailing address for notices.`,
    )],
  ]),
};

// ════════════════════════════════════════════════════════════════════════════
// 2. SERVICE AGREEMENT (per booking, printed on every invoice)
// ════════════════════════════════════════════════════════════════════════════
export const SERVICE_AGREEMENT: Contract = {
  key: "service-agreement",
  title: `${BRAND.legalName} — Service Agreement`,
  version: SERVICE_AGREEMENT_VERSION,
  audience: "customer",
  appliesTo: "Every booking. You accept it when you book and pay, and it prints on your invoice.",
  summary: [
    `You book and pay ${BRAND.name}. We schedule, manage and guarantee the job. An independent, insured, background-checked pro does the work. Please don't pay your pro directly.`,
    `We suggest a price based on what pros near you actually accept. You may offer a different price within limits, but a lower offer may take longer or may not be taken. You pay upfront, and the price includes a flat ${FEE} booking fee.`,
    "Until a pro accepts, you may raise your offer, and a pro may counter with a higher price. Paying more is always your choice, and we only charge the difference. Extra work only happens after you approve and pay for it.",
    `Cancel or move your booking free up to 24 hours before your arrival window. Inside 24 hours, or if your pro can't get in, we keep a ${money(LATE_CANCEL_FEE)} fee and refund the rest.`,
    `Not right? Tell us within ${BRAND.guaranteeDays} days with photos. We send the pro back free, give you a free service, or refund you.`,
    "Report any damage within 72 hours with photos. Every pro carries liability insurance, and we handle the claim with you.",
    "Please give access, secure pets and valuables, tell us about hazards, and have an adult (18+) home for in-home work unless we agree otherwise. Respect goes both ways: harassment or discrimination ends the job.",
    "Book future work with pros you meet through us, so this agreement and our guarantee keep protecting you.",
  ],
  sections: numbered([
    ["Who you're contracting with", p(
      `You are contracting with ${US}. We suggest the price, schedule, manage and guarantee your job. The work is done by an independent, insured, background-checked service business that we select and quality-check ("your pro"). Pros are independent businesses, not our employees.`,
      "You pay us. We pay your pro after the work is done and passes our quality check. Please don't pay your pro directly. Payments made outside the app are not covered by this agreement or our guarantee.",
      "Favorites and asking for a pro: you may mark a pro (or a member of a pro company's crew) as a favorite, or ask for a pro you've had when you book again. We then offer your job to that pro first for a few hours (shorter when the job is soon). It is a first look, not a promise: if they can't take it in that time, another vetted pro does, and your price, date and guarantee stay the same. Asking for a crew member is a request to that company; the company decides who it sends.",
      "Some services have extra terms (an \"addendum\"), for example rides, medical deliveries, pet care, events, construction and remodels, errands, hauling, car detailing, and home and yard services. If your service has an addendum, it is part of this agreement.",
    )],
    ["What's included (scope)", p(
      "We will do the work described on your invoice. Our suggested price is based on the details and photos you give us. Please describe the job fully and honestly. Anything not listed on the invoice is not included.",
      "If you add notes, we read them, but a note does not add work unless it is reflected in the price and the invoice.",
    )],
    ["Changes on site (change orders)", p(
      "Sometimes a job is different once the pro arrives. For example: more items or area, hidden damage, unsafe conditions, or access problems.",
      "When that happens, your pro will pause and we will send you a change order in the app with a new price, based on our standard rates. Extra work is done only after you approve the change order and pay for it.",
      "If you don't approve it, your pro will finish the work you already paid for if it can be done safely and properly. If the original work can't be done, we will refund the part that can't be done, minus any trip fee explained below.",
      "Please don't ask your pro to do extra work \"on the side.\" Work that isn't on your invoice or an approved change order isn't covered by our guarantee or insurance coordination.",
    )],
    ["Price", p(
      ul(
        `Suggested price: before you book, we show a suggested price. It is based on the details and photos you give us, our standard rates, and what pros in your area have actually accepted for similar jobs lately. What pros accept can move the suggested price up or down, but only within set limits (no more than ${MARKET_DOWN} lower or ${MARKET_UP} higher than our standard price).`,
        `Name your price: you may book at the suggested price or offer a different price, from ${OFFER_LOW} of the suggested price up to ${OFFER_HIGH} the suggested price. Pros choose whether to take a job at the price offered. A lower offer may take longer to be taken, or may not be taken at all, and we tell you before you book when an offer is low. Whatever price you choose, you pay it upfront, the same way.`,
        `Booking fee: every booking includes a flat ${FEE} booking fee (for recurring plans, on each visit). It is already included in the price we show you and is listed on your invoice. ${BRAND.name} keeps it to run booking, payments and support. It is not part of your pro's pay, and promo codes, ${HANDLED_PLUS.name} savings and other discounts don't reduce it. There is no booking fee on free redos or complimentary services.`,
        "Upfront price: you see the full price before you book. It includes labor, the materials listed and the booking fee. The price on your invoice (your offer, plus any raise or counteroffer you accepted) is the price you pay for that scope.",
        `Priority fee: jobs that start within ${RUSH_HOURS} hours of booking have a ${pct(RUSH_SURCHARGE)} priority (rush) fee, shown before you book. ${HANDLED_PLUS.name} members don't pay it.`,
        `Recurring plans: plans get a discount on each visit (${PLAN_DISCOUNTS}), shown on your invoice.`,
        `AI price check: our AI may check your details and photos and adjust the suggested price, but only within set limits (no more than ${pct(AI_MAX_CUT)} lower or ${pct(AI_MAX_RAISE)} higher than our standard price). If a job needs more than that, we offer a free site visit instead. You always see the final price before you pay.`,
        "Your budget: if you tell us your budget, we use it to suggest options. It doesn't change the price unless we agree on a different scope or you choose to offer a different price.",
        "Site visits: on-site estimates are free. A firm quote after a site visit is good for 14 days.",
        "Price errors: if there is an obvious mistake in a price, we may correct it before work starts. If you don't accept the corrected price, you get a full refund.",
      ),
    )],
    ["Pro counteroffers and raising your offer", p(
      "After you book and pay, we offer your job to qualified pros at your price. Each pro sees exactly what they would be paid and decides whether to take it.",
      ul(
        "Counteroffers: a pro may reply with the pay they would accept instead. We then show you the full price that counteroffer means for you. You may accept it, and we charge only the difference and give the job to that pro at the pay they asked for. Or you may keep waiting at your price. While you decide, other pros may still take your job at your original price. Counteroffers end as soon as any pro takes the job.",
        "Raising your offer: until a pro accepts your job, you may raise your price. We charge only the difference, to your saved card or through a payment link. Your job is then offered to pros again at the higher price.",
        "No pro yet: if no pro has taken your job after a while, we may suggest a higher price, one time. You never have to raise it. You may keep waiting, or cancel under \"Rescheduling and cancelling\" below. If we can't find a pro for your date, we will offer another time or a full refund.",
      ),
      "The price you end up paying (your offer, plus any raise or counteroffer you accepted) becomes the price on your invoice. Refunds, cancellations and our guarantee apply to that total.",
    )],
    ["Payment", p(
      "The full price is paid upfront to schedule the work, unless a deposit applies (see below). Payments are processed by Stripe. You can pay by card, and larger jobs may be paid by bank transfer (ACH) where we offer it.",
      "If you raise your offer or accept a pro's counteroffer, we charge only the difference, to your saved card or through a payment link we send you.",
      `How your price is shared: from the price you pay, ${BRAND.name} keeps the booking fee and a commission, and your pro is paid the rest. Promo codes and ${HANDLED_PLUS.name} savings come out of our share, never your pro's pay.`,
      "Your pro is only paid by us. Please don't pay your pro in cash or any other way.",
    )],
    ["Deposits for large jobs and events", p(
      `For jobs that need a site visit, events, and jobs of ${money(DEPOSIT.threshold)} or more, you may be able to pay a deposit instead of the full price.`,
      ul(
        `Most jobs: a deposit of ${pct(DEPOSIT.share)} of the price (at least ${money(DEPOSIT.minimum)}). The balance is charged to your saved card ${DEPOSIT.balanceDaysBefore} days before the job.`,
        `Events: a deposit of ${pct(DEPOSIT.eventShare)} (at least ${money(DEPOSIT.minimum)}). The balance is charged ${DEPOSIT.eventBalanceDaysBefore} days before the event.`,
        "If a job is booked too close to the date to leave room for a balance, it is paid in full.",
        "If the balance charge fails, we will tell you and try again. If it isn't paid by the day before the job, we may cancel, and the cancellation terms apply.",
      ),
      "Your invoice shows the deposit, the balance and the date it will be charged. By booking with a deposit, you authorize us to charge the balance to your saved card on that date.",
    )],
    ["Materials and parts", p(
      "Prices include the materials listed. If your job needs parts or materials that aren't included, they are billed at cost, with no markup, against the store receipt.",
      `We tell you before your card is charged. Purchases over ${MATERIALS_OK} need your OK first. You can always say no; your pro will then do what can be done without them.`,
      "Receipts are saved to your job in the app. If you return an unused part we bought for you, you get what the store refunds us.",
    )],
    ["Taxes", p(
      "Taxes that apply to your service, if any, are shown on your invoice. Most home services are not subject to Michigan sales tax, but some items (like materials sold to you, rentals or catering) may be.",
    )],
    ["Tips", p(
      `Tips are optional and never expected. If you tip in the app after the job, 100% of the tip goes to your pro. We don't keep any of it. The most you can tip on one job in the app is ${money(TIP_MAX)}.`,
      "Tips are not refundable once paid to your pro, except in cases of fraud or error.",
    )],
    ["Recurring plans", p(
      "If you choose a recurring plan (for example, weekly cleaning or monthly lawn care), each visit is charged to your saved card before that visit. You can change, pause or cancel your plan at any time before the next charge, in the app or by contacting us. There is no long-term commitment unless your invoice says so (for example, a prepaid snow season).",
      `Each charge uses the plan price at that time. If you are a ${HANDLED_PLUS.name} member, we re-check your membership before each charge. If your membership has ended, the member discount stops on the next visit.`,
      "We may change plan prices with at least 14 days' notice. You can cancel before the new price applies.",
    )],
    ["Scheduling and arrival", p(
      `You choose a date and an arrival window (morning, midday, afternoon or flexible), up to ${BRAND.bookingHorizonDays} days ahead. We are closed on some days, which the calendar shows. Your pro arrives within the booked window. The window is for arrival; the job then takes as long as it needs.`,
      "We send your pro's name and live location as they head to you. If your pro is running late or can't make it, we will tell you and either send another qualified pro or offer a new time. If we can't, you get a full refund.",
      "Same-day and \"as soon as possible\" bookings depend on a pro being free. If we can't fill one in time, we will offer the next available time or a full refund.",
    )],
    ["Your timing", p(
      "If you tell us the date you need the work done by, we treat it as a target and plan for it. It is not a guarantee unless we confirm that date in writing (in the app or on your invoice).",
      "Weather, permits, materials, other vendors and access can affect timing. We will keep you updated.",
    )],
    ["Rescheduling and cancelling", p(
      ul(
        "More than 24 hours before your arrival window: move or cancel free, for a full refund. You can do it in your account.",
        `Inside 24 hours: we keep a ${money(LATE_CANCEL_FEE)} late-cancellation fee and refund the rest. To move a booking inside 24 hours, message us; we will help if we can.`,
        `No access: if your pro arrives and can't get in, or nobody is there when someone needs to be, we keep a ${money(LATE_CANCEL_FEE)} trip fee and refund the rest, or reschedule.`,
        "Quoted projects (like remodels, HVAC, tree work and events): once materials are ordered or vendors are booked, the cancellation terms in the quote or addendum apply. Non-refundable costs we already paid for you are deducted, and we show them to you.",
        `Moving to a date within ${RUSH_HOURS} hours may add the priority fee.`,
        "If we cancel: you get a full refund.",
      ),
      "Part of the fee we keep goes to your pro, who set aside the time.",
    )],
    ["What we need from you", p(
      ul(
        "Access: let your pro in, or give us clear access instructions (codes, keys, gate, parking).",
        "Utilities: working water, electricity and heat where the job needs them.",
        "Clear work areas: move personal items, fragile items and vehicles out of the way where you can.",
        "Pets: keep pets secured away from the work area, unless your service is pet care.",
        "A safe place to work: no threats, weapons shown, illegal activity or unsafe conditions.",
        "Tell us about hazards before the job: mold, asbestos, pests, sharps, unsafe floors, aggressive animals, someone sick in the home, recent fire or flood damage, or anything else a pro should know.",
        "Someone 18 or older must be present for in-home work, unless we agree in writing (for example, a key or lockbox for cleaning). Children must be supervised by you, not by the pro.",
        "Accurate details: the address, size and photos you give us are what we price from.",
      ),
    )],
    ["Our make-it-right guarantee", p(
      `If anything isn't right, tell us within ${BRAND.guaranteeDays} days of the job with photos. We will do one of the following, whichever fairly fixes the problem, at our choice:`,
      ul(
        "Send your pro (or another pro) back to fix it at no cost;",
        "Give you a complimentary service; or",
        "Refund all or part of the price.",
      ),
      "Refunds go back to your original payment method. Please let us try to fix it before you have someone else redo the work. We can't cover the cost of another company's work that we didn't approve first.",
      "The guarantee does not cover:",
      ul(
        "Misuse, neglect, accidents or changes made by someone else after the job.",
        "Normal wear and tear, weather, and things that come back over time (like weeds, dirt or snow).",
        "Problems that existed before the job (pre-existing conditions), like old stains, cracks, rot or worn parts, unless the job was to fix them.",
        "Materials or products you supplied, and how they perform.",
        "Cosmetic results we told you about before the work (for example, a stain that may not fully come out).",
        "Work or items not listed on your invoice or an approved change order.",
        "Work paid for outside the app.",
      ),
      "Some services carry a longer warranty (for example, a one-year workmanship warranty on remodels and licensed trade work). The addendum for your service will say so. Manufacturer warranties on products pass to you.",
    )],
    ["Property damage", p(
      "Every pro carries general liability insurance. If something is damaged, please report it within 72 hours with photos. Don't throw away the damaged item until we've seen it, unless it is unsafe to keep.",
      "We will work with you, your pro and the pro's insurer to resolve the claim fairly, and keep you updated. For small claims, we may pay you directly and handle the insurer ourselves.",
      "To the extent the law allows, our total liability for any job is limited to the amount you paid for that job, plus any amount recovered from the pro's insurance for your claim. We are not liable for indirect or consequential losses, like lost income, lost use, or emotional distress, except where the law does not allow this limit.",
      "This limit does not apply to injury or death caused by our negligence, or to our gross negligence, fraud or willful misconduct." + COUNSEL,
    )],
    ["Valuables, cash and private items", p(
      "Please put away cash, jewelry, firearms, medications, important papers and other valuables, or lock them away, before your pro arrives. Pros are told not to open drawers, safes or private areas unless the job requires it.",
      "We are not responsible for cash, jewelry or valuables left out in the work area, except where loss is caused by our or the pro's dishonesty or negligence. If anything goes missing, tell us right away; we take it seriously and will cooperate with the police.",
    )],
    ["Photos, live location and messages", p(
      "Your pro takes before and after photos for our quality check. We use them for quality control, support and resolving claims only. We store them privately and never publish them without your permission.",
      "While your pro is on the way, we share their live location with you. We may also record when they arrive and leave.",
      "You agree to receive texts and emails about your jobs. Reply STOP to opt out of texts. Our Terms of Use explain our messages in full.",
      "Please don't record pros with hidden cameras in private spaces. Normal home security cameras are fine; tell us if they record sound.",
    )],
    ["Safety and respect", p(
      "Everyone deserves a safe, respectful job. We have zero tolerance for harassment, threats, violence or discrimination based on race, color, religion, sex, sexual orientation, gender identity, national origin, age, disability or any other protected trait. This applies both ways: pros toward you, and you toward pros.",
      ul(
        "If you feel unsafe or a pro acts inappropriately, leave the area and contact us right away. In an emergency, call 911.",
        "A pro may stop work and leave if the site is unsafe, if they are threatened or harassed, or if they are asked to do something unlawful or unsafe.",
        "We may cancel or stop a job, or close an account, for safety reasons. If the reason is your conduct or an unsafe site you didn't tell us about, the late-cancellation terms apply. Otherwise we refund the work not done.",
        "We may decline or stop work involving hazards such as asbestos, mold, hazardous waste, sharps, pests or unsafe structures, and refund the part not done.",
      ),
    )],
    ["Booking through us", p(
      "Please book future work with pros you meet through us, so this agreement, our insurance requirements and our guarantee keep protecting you.",
      `For 12 months after you meet a pro through ${BRAND.name}, please don't hire that pro directly, outside the app, for the same kind of services. Pros agree to the same rule. If this happens, we may close your account and charge a reasonable referral fee to cover the introduction (the greater of ${money(250)} or 20% of the first year of direct work).` + COUNSEL,
      "Pros are independent businesses, not our employees. You aren't hiring them as your employees either; you are buying a service from us.",
    )],
    ["Card disputes (chargebacks)", p(
      "If something is wrong with a charge or a job, please contact us first. We can usually fix it faster than your bank, and our guarantee is there for that.",
      "If you dispute a charge with your bank, we will share our records with the bank, including your signed agreement, photos and messages. While a dispute is open on a job we are already working to resolve, we may pause new bookings on your account until it is settled. If the dispute is decided in our favor, the original charge stands.",
      "Nothing here limits your rights under card network rules or the law.",
    )],
    ["Your right to cancel home sales (Michigan 3-day rule)", p(
      "Michigan's Home Solicitation Sales Act gives you extra rights when a sale is made at your home. If you sign or agree to a contract for more than $25 at your home, after our pro or representative visits you there in person (for example, a free site visit for a remodel, HVAC or tree job), you may cancel it without any penalty or obligation until midnight of the third business day after you agree to it." + COUNSEL,
      "NOTICE OF CANCELLATION. You may cancel this transaction, without any penalty or obligation, within three business days from the date it was agreed to. If you cancel, any payment you made and any papers you signed will be returned within 10 business days after we receive your cancellation notice. To cancel, send a signed and dated copy of a cancellation notice, or any other written notice, or send an email or a message in the app, to " + `${BRAND.legalName}, ${BRAND.supportEmail}` + ", no later than midnight of the third business day after the date of the transaction. You may also tap \"Cancel\" on the booking in your account. The notice is effective when sent." + COUNSEL,
      "If you ask us in writing to start the work sooner because of a real emergency (for example, a burst pipe or no heat in winter), we may begin earlier, and you may waive this right only as the law allows." + COUNSEL,
      "This right is in addition to our normal free cancellation more than 24 hours before your arrival window.",
    )],
    ["Lead-safe work in older homes", p(
      "If your home was built before 1978, it may have lead-based paint. For painting, remodeling and repairs that disturb painted surfaces, we use pros certified under the EPA Renovation, Repair and Painting (RRP) rule and lead-safe work practices. We will give you the EPA \"Renovate Right\" pamphlet before work starts. Please tell us the year your home was built.",
    )],
    ["Licensed work and permits", p(
      "Plumbing, electrical, HVAC, painting, remodeling, catering, food trucks, passenger transportation and medical courier work is done only by pros or companies that hold the license the work requires. You can ask to see a license.",
      "Where a permit or inspection is required, the licensed pro pulls it, and the cost is shown on your invoice. Please let inspectors in. We don't do work that requires a permit without one.",
    )],
    ["Weather and events outside our control", p(
      "Some things are out of anyone's control: storms, snow, ice, extreme heat or cold, flooding, power outages, road closures, public emergencies, strikes, supply shortages and government orders. If one of these delays or stops a job, we will reschedule at no cost or refund the part not done. Neither side is in breach for a delay caused by these events.",
      "Snow, lawn, leaf, power washing, exterior painting, gutter and other outdoor work may move to the next safe day because of weather. We will tell you as soon as we know.",
    )],
    ["Governing law and disputes", p(
      `Please contact us first at ${BRAND.supportEmail} or ${BRAND.supportPhone}. Most issues are fixed within a business day.`,
      "This agreement is governed by Michigan law. Any dispute is resolved under the dispute resolution section of our Terms of Use, including talking first for 30 days, binding individual arbitration, the small-claims option, the class-action waiver and your right to opt out. If a job takes place in another state, that state's consumer protection laws that can't be waived also apply.",
    )],
    ["General terms", p(
      ul(
        "Transfer: you may not transfer this agreement without our consent. We may assign it to a company that takes over our business, or have another qualified pro do the work.",
        "Severability: if any part is found unenforceable, the rest still applies, and that part is changed only as much as needed to be enforceable.",
        "No waiver: if we don't enforce a term right away, we can still enforce it later.",
        "Notices: we send notices to the email or phone on your booking. You send them to us at " + BRAND.supportEmail + ".",
      ),
    )],
    ["Entire agreement and your signature", p(
      "Your invoice, this Service Agreement, any addendum for your service, any approved change orders, and our Terms of Use (including its arbitration agreement) make up the entire agreement for this job. If they conflict, this order applies: an approved change order, then the invoice, then the addendum, then this agreement, then the Terms of Use.",
      "Accepting these terms online when you book is your electronic signature, with the same effect as signing on paper. We keep a record of when and from where you accepted. You can view and print this agreement and your invoice at any time in your account.",
    )],
  ]),
};

// ════════════════════════════════════════════════════════════════════════════
// 3. BUSINESS SERVICES AGREEMENT (MSA)
// ════════════════════════════════════════════════════════════════════════════
export const BUSINESS_MSA: Contract = {
  key: "business-services-agreement",
  title: `${BRAND.legalName} — Business Services Agreement`,
  version: V1,
  audience: "business",
  appliesTo: "Business accounts (offices, retail, restaurants, clinics, property managers, HOAs, venues and other organizations), accepted when the account is opened or an order form is signed.",
  summary: [
    "This is the master agreement for your business account. Each order form, proposal or booking is a separate job under it.",
    "Prepaid by card or ACH by default. Net payment terms only if an order form says so.",
    "Every pro is background-checked, insured and licensed where the trade requires. Certificates of insurance on request.",
    "We keep your keys, codes and information confidential, and you do the same for ours. Patient information only under a signed HIPAA BAA.",
    "Service levels are targets. If we miss, we redo the work or credit you.",
    "Please don't hire our pros directly for 12 months, or a conversion fee applies.",
    "Either side can end the agreement with 30 days' notice, or right away for a serious breach.",
    "Michigan law. Courts in Wayne County. No mandatory arbitration for businesses.",
  ],
  sections: numbered([
    ["Parties and structure", p(
      `This Business Services Agreement ("Agreement") is between ${US} and the business or organization named on the account or order form ("Client", "you").`,
      "This Agreement sets the general terms. Each order form, signed proposal, recurring service schedule or booking made through your business account is a statement of work (an \"Order\"). Each Order describes the services, sites, schedule and price. Each Order is part of this Agreement.",
      "The customer Service Agreement and the service addenda also apply to each Order, except where this Agreement or the Order says something different.",
    )],
    ["What we provide", p(
      `${BRAND.name} manages facilities and business services through vetted independent pros and licensed companies. These include janitorial and cleaning, exterior and grounds (including snow and ice), repairs and maintenance by licensed trades, painting and build-outs, clean-outs and hauling, courier and medical courier, corporate transportation, corporate events and catering, and fleet detailing.`,
      "We schedule, dispatch, supervise quality (time-stamped visits with before and after photos), handle re-dos and send reports. If a pro can't make a visit, we reassign it to another qualified pro.",
    )],
    ["Authorized users", p(
      "You may add people to your account to book, approve change orders and receive reports (\"authorized users\"). You are responsible for what they do on your account, including bookings and approvals.",
      "Remove a person's access when they leave your business. Bookings made by an authorized user before access is removed are binding.",
      "You may set approval limits in the Order. Change orders above that limit need approval from the person named in the Order.",
    )],
    ["Ordering, scope and changes", p(
      "Each Order lists the work included. Work not listed is not included. If site conditions differ from what we were told, we send a change order priced at our standard rates. Extra work is done only after an authorized user approves it.",
      `Pricing: unless an Order fixes the price, bookings made through your business account use the same suggested price and offer process as our customer Service Agreement. We show a suggested price, an authorized user may offer a different price within the limits shown, pros may counter, and a flat ${FEE} booking fee per booking (per visit for recurring services) is included in the price shown. Where an Order fixes the price, that price applies.`,
      "Recurring services continue on the Order's schedule until the Order ends or is changed. Either side may change a recurring schedule with 14 days' notice; price changes take effect at the next billing period after notice.",
    )],
    ["Invoicing and payment", p(
      ul(
        "Default: work is prepaid by card or ACH. Recurring services are charged before each visit or billing period.",
        "Net terms: only if an Order says so in writing (for example, net 15 or net 30), after a credit review. Terms we approve for your business account, shown in your account portal with a credit limit, count as such an Order. A booking that would go over the credit limit, or made while an invoice is more than 10 days overdue, is paid at booking instead. Invoices are due by the date shown.",
        "PO numbers and cost centers: we will put them on invoices if you give them to us. A missing PO number doesn't delay payment.",
        "Late payment: unpaid amounts on net terms carry a late fee of 1.5% per month (or the highest rate the law allows, if lower) from the due date. We may pause service after 10 days' written notice of non-payment, and require prepayment after that." + COUNSEL,
        "Disputes: tell us about a billing dispute in writing within 30 days of the invoice. Pay the part not in dispute on time. We will work in good faith to resolve the rest.",
        "Taxes: prices exclude taxes. You pay sales and similar taxes that apply, unless you give us a valid exemption certificate.",
        "Collection: if we must use collection or court to recover overdue amounts, you will pay reasonable collection costs and lawyer fees.",
      ),
    )],
    ["Cancellations and access", p(
      `Visits may be moved or cancelled free more than 24 hours before the scheduled window. Inside 24 hours, or if our pro can't get access (locked doors, wrong codes, no one to receive them), a trip fee of ${money(LATE_CANCEL_FEE)} per visit applies, unless the Order states a different amount.`,
      "Event, transportation and project cancellations follow the addendum for that service or the Order.",
    )],
    ["Our pros: vetting and insurance", p(
      "Every pro we send has passed a background check and carries general liability insurance of at least $1,000,000 per occurrence (higher for some trades), plus the coverage their trade requires, such as commercial auto, passenger carrier liability, workers' compensation where they have employees, fidelity bonds for unsupervised access, and liquor liability where alcohol is served. Licensed trades carry the license their work requires.",
      `We will provide certificates of insurance on request, and can ask pros to name you as an additional insured where their insurer allows. Pros name ${BRAND.legalName} as an additional insured.`,
      "Pros are independent contractors, not our employees or yours. They are not entitled to your employee benefits, and you will not direct their work beyond the scope, site rules and safety needs.",
    )],
    ["Site rules, keys and access codes", p(
      "Tell us your site rules (hours, check-in, PPE, restricted areas, alarm procedures, parking). We will share them with each pro and require them to follow them.",
      "Keys, badges, fobs and alarm codes you give us are kept securely, logged and shared only with the pro assigned to the visit, and only for as long as needed. Tell us right away if you change a code or want a key returned. If a key or badge we hold is lost through our or a pro's fault, we pay the reasonable cost to re-key or replace it.",
      "You are responsible for securing cash, confidential documents and valuables. Please don't give pros access to areas they don't need.",
    )],
    ["Confidentiality", p(
      "Each side may learn the other's confidential information, such as prices, business plans, client lists, building layouts, security procedures and access codes. Each side will use the other's confidential information only to carry out this Agreement, protect it with reasonable care, and share it only with people who need it and are bound to keep it confidential (including our pros).",
      "This doesn't cover information that is public, already known, independently created or properly received from someone else. Either side may disclose information when required by law, after giving notice where allowed.",
      "These duties last for 3 years after the Agreement ends, and for trade secrets and access information, for as long as it stays confidential.",
    )],
    ["Data and privacy", p(
      "We use your business data and your staff's contact information only to provide the services, bill you and improve the service, as described in our Privacy Policy. We never sell it.",
      "For personal information you give us about your customers, tenants, patients or staff, we act on your behalf as a service provider (a \"processor\"), using it only to perform the services and following your reasonable written instructions.",
      "We protect data with encryption in transit, role-based access and private storage, and tell you without unreasonable delay if we learn of a security incident affecting your data.",
      "Protected health information (PHI) under HIPAA: we will only receive, carry or handle PHI after both sides sign our HIPAA Business Associate Agreement (BAA). Until a BAA is signed, please don't send us PHI. If a BAA is signed, it controls for PHI and wins over this Agreement where they differ." + COUNSEL,
    )],
    ["Non-solicitation of pros", p(
      `During this Agreement and for 12 months after the last service a pro performs for you through ${BRAND.name}, you agree not to hire, contract with or directly engage that pro (or their business) for the same kind of services outside our platform.`,
      "If you want to bring a pro in-house or work with them directly, tell us. You may do so by paying a conversion fee equal to the greater of $2,500 or 25% of what you paid us for that pro's services in the prior 12 months. This fee is a fair estimate of our recruiting, vetting and placement costs, not a penalty." + COUNSEL,
      "This doesn't stop a pro from answering a general job posting not aimed at our pros.",
    )],
    ["Service levels and remedies", p(
      "Service levels in an Order (such as arrival windows, response times, frequency or cleaning standards) are targets we work hard to meet.",
      `If we miss a service level or the work doesn't meet the Order, tell us within ${BRAND.guaranteeDays} days (sooner for daily services, within 48 hours). Your remedy is that we redo the work at no charge, or, if a redo isn't practical, credit or refund the fee for the affected visit. If we repeatedly miss the same service level (3 times in 60 days), you may end that Order without a termination fee.`,
      "These are your only remedies for missed service levels, but they don't limit claims for property damage or injury.",
    )],
    ["Your responsibilities", p(
      ul(
        "Give safe access during the agreed hours, with working utilities where needed.",
        "Tell us in writing about known hazards: chemicals, asbestos, mold, sharps, biohazards, aggressive animals, unsafe structures and anything else a pro should know.",
        "Give accurate site information (square footage, number of units, lot size).",
        "Comply with laws that apply to your premises.",
        "Get any landlord or property owner approvals we need.",
      ),
    )],
    ["Limits on liability", p(
      "To the extent the law allows, neither side is liable to the other for indirect, special, incidental, consequential or punitive damages, or for lost profits, revenue or business, even if warned they were possible.",
      "To the extent the law allows, each side's total liability under this Agreement is limited to the fees you paid us under this Agreement in the 12 months before the event giving rise to the claim, plus, for our liability, any amount recovered from a pro's insurance for the claim.",
      "These limits do not apply to: your payment obligations; either side's indemnity obligations for third-party claims for bodily injury or property damage; breach of confidentiality; gross negligence, fraud or willful misconduct; or anything else the law does not allow to be limited." + COUNSEL,
    )],
    ["Indemnities", p(
      "We will defend and cover you against third-party claims for bodily injury or damage to property to the extent caused by the negligence or willful misconduct of us or a pro we sent, while performing the services, or by our breach of this Agreement. We may handle such claims through the pro's insurance first.",
      "You will defend and cover us and our pros against third-party claims to the extent caused by: hazards on your premises you knew of and didn't tell us about; your instructions that we followed; your or your staff's negligence or willful misconduct; your breach of law; or your breach of this Agreement.",
      "Each side's duty is reduced in proportion to the other side's share of fault. The side asking for protection must tell the other side promptly, let them control the defense and settlement (a settlement can't admit fault for the protected side without consent), and reasonably cooperate." + COUNSEL,
    )],
    ["Insurance we carry and require", p(
      `We require pros to keep the insurance in "Our pros: vetting and insurance" above for as long as they work on ${BRAND.name} jobs, and we stop offers to any pro whose coverage lapses. We maintain our own business insurance in amounts we consider reasonable for our business and will describe it on request.`,
      "You keep property insurance for your premises and contents.",
    )],
    ["Term and termination", p(
      "This Agreement starts when you accept it or sign the first Order and continues until ended. Each Order has the term it states, or continues month to month if none.",
      ul(
        "Either side may end this Agreement or any Order for any reason with 30 days' written notice.",
        "Either side may end it immediately by written notice if the other side materially breaches it and doesn't fix the breach within 10 days after notice (5 days for non-payment), or becomes insolvent.",
        "We may suspend service immediately for safety reasons, including threats or harassment toward a pro.",
      ),
      "When it ends: you pay for work done and non-cancellable costs we incurred for you (such as vendor deposits and materials ordered); we refund prepaid amounts for work not done; we return your keys, badges and materials within 10 business days and delete access codes. Sections that by their nature should survive (payment, confidentiality, non-solicitation, liability limits, indemnities, governing law) survive.",
    )],
    ["Governing law, venue and disputes", p(
      "Michigan law governs this Agreement. Any lawsuit must be brought in the state or federal courts for Wayne County, Michigan, and both sides consent to those courts.",
      "Before suing, each side will give the other written notice and senior people from both sides will meet (in person or by video) within 30 days to try to resolve it. Either side may still go to court sooner for urgent relief (like protecting confidential information or stopping misuse of keys or codes).",
      "Why no arbitration here: the individual consumer arbitration in our Terms of Use is designed for individual customers. For businesses, a court in our home county is simpler, cheaper for both sides for most disputes, and gives each side a right to appeal. The two sides may still agree in writing to arbitrate or mediate a particular dispute.",
      "Both sides waive the right to a jury trial for any dispute under this Agreement, to the extent the law allows." + COUNSEL,
    )],
    ["Order of precedence", p(
      "If documents conflict, this order applies, first to last: (1) a signed HIPAA BAA, for PHI only; (2) the Order, but only for the specific term it says it is changing; (3) this Agreement; (4) the service addendum; (5) the customer Service Agreement; (6) the Terms of Use. Purchase order terms you send us don't apply, even if we accept the PO, unless we sign them.",
    )],
    ["General", p(
      ul(
        "Independent parties: nothing here creates a partnership, joint venture, employment or agency between us.",
        "Assignment: neither side may assign this Agreement without consent, except to a company that takes over its business, with notice.",
        "Force majeure: neither side is liable for delays caused by events outside its reasonable control (severe weather, outages, public emergencies, government orders). Payment duties for work done still apply.",
        "Notices: in writing, by email to the addresses on the account and in the Order (ours: " + BRAND.supportEmail + "), effective when sent unless bounced.",
        "Entire agreement: this Agreement and its Orders are the whole agreement for business services and replace earlier proposals. Changes must be in writing and accepted by both sides (an Order accepted in the app counts).",
        "Severability and waiver: an unenforceable part is changed only as needed; not enforcing a term is not a waiver.",
        "Electronic signatures: accepting in the app or by e-signature is binding.",
        "Publicity: we won't use your name or logo in marketing without your written permission.",
      ),
    )],
  ]),
};

// ════════════════════════════════════════════════════════════════════════════
// 4. PLUS MEMBERSHIP, GIFT CARDS, PROMOS, REFERRALS, TIPS
// ════════════════════════════════════════════════════════════════════════════
export const MEMBERSHIP_PROMO_TERMS: Contract = {
  key: "plus-gift-cards-promos",
  title: `${HANDLED_PLUS.name}, Gift Cards, Promo Codes & Referrals`,
  version: V1,
  audience: "customer",
  appliesTo: `Anyone who joins ${HANDLED_PLUS.name}, buys or uses a gift card, uses a promo code, refers a friend or tips a pro.`,
  summary: [
    `${HANDLED_PLUS.name} costs ${money(HANDLED_PLUS.monthly)} a month and renews automatically every month until you cancel.`,
    "Cancel anytime online in a couple of clicks. Your benefits last until the end of the month you paid for.",
    "Gift cards don't expire for at least 5 years and have no inactivity fees. Treat them like cash.",
    "One promo code per booking unless it says otherwise. Codes have no cash value.",
    "Some discounts are capped so the pro's pay is never cut.",
    `Refer a friend: they get ${money(REFERRAL.friendOff)} off their first job, and you get ${money(REFERRAL.reward)} credit when it's done.`,
    "Tips are optional, and 100% goes to your pro.",
  ],
  sections: numbered([
    [`${HANDLED_PLUS.name}: what you get`, p(
      `${HANDLED_PLUS.name} is a paid membership. While your membership is active, you get:`,
      ul(...HANDLED_PLUS.perks),
      `The ${pct(HANDLED_PLUS.discountPct)} member discount applies to the job price after any plan discount. Like other discounts, it may be limited on some jobs so the pro's pay is never cut (see "Promo codes" below). First pick of same-day slots means members are offered open same-day slots first; it doesn't guarantee a slot. The member discount doesn't apply to the ${FEE} booking fee included in each booking.`,
      "We may change or add benefits. If we reduce benefits or raise the price, we will tell you at least 30 days before your next renewal, and you can cancel before it applies.",
    )],
    [`${HANDLED_PLUS.name}: automatic renewal`, p(
      `AUTOMATIC RENEWAL: When you join, you authorize us to charge ${money(HANDLED_PLUS.monthly)} per month (plus any tax) to your payment method, starting the day you join and then every month on the same date, until you cancel. The membership renews automatically each month. The price, the renewal date and how to cancel are shown before you join and in your welcome email.` + COUNSEL,
      "If a renewal charge fails, we will try again and tell you. If it still can't be charged, your membership ends and member benefits stop.",
    )],
    [`${HANDLED_PLUS.name}: cancelling`, p(
      "You can cancel anytime, online, in a few clicks: go to your account and choose \"Manage membership.\" This opens our secure billing portal, where you can cancel right away. You can also cancel by contacting us. You never need to call to cancel.",
      "When you cancel, you won't be charged again. Your benefits continue until the end of the month you already paid for, then stop.",
      "We don't give partial refunds for unused parts of a month, except where the law requires. If you were charged by mistake (for example, after you cancelled), we will refund it.",
      "Discounts already applied to jobs booked while you were a member stay applied. Recurring plan visits charged after your membership ends are charged without the member discount.",
    )],
    ["Gift cards", p(
      ul(
        "Gift cards can be used for any of our services. Enter the code at checkout.",
        "No expiration: gift cards don't expire for at least 5 years from the date of purchase. We don't plan to expire them at all.",
        "No fees: we never charge dormancy, inactivity or service fees on gift cards.",
        "Use it across bookings: if your booking costs less than the balance, the rest stays on the card for next time. If it costs more, you pay the difference.",
        "Not cash: gift cards can't be redeemed for cash, except where the law requires (if the law requires cash back for small balances, we will honor it).",
        "Gift cards are prepaid money, not a discount. They don't reduce the pro's pay.",
        "Refunds on a booking paid with a gift card go back to the gift card balance.",
        "Treat it like cash: if a code is lost, stolen or used without your permission, we can't replace it, unless it was sent to an email on an account and we can verify it hasn't been used. We will try to help.",
        "We may cancel gift cards bought with stolen payment or through fraud.",
        "Gift cards can't be resold or used to buy other gift cards.",
      ),
      "Michigan law protects gift card holders, and these terms are meant to give you at least that protection." + COUNSEL,
    )],
    ["Promo codes", p(
      ul(
        "One promo code per booking, unless the code says it can be combined.",
        "Codes may have limits, which we show: first job only, minimum order, a certain service, an end date, or a set number of uses.",
        "Codes have no cash value, can't be sold or traded, and can't be applied to a booking you already paid for.",
        `Some discounts are capped so the pro's pay is never cut. Discounts come out of our share, not the pro's. On each job, we keep at least ${pct(DISCOUNT_FLOOR)} of the price after paying the pro, so a large discount may be reduced on some jobs. The app shows the discount you actually get before you pay.`,
        `Tips, taxes, the ${FEE} booking fee and gift card purchases don't get promo discounts.`,
        "If you cancel or get a refund, we refund what you actually paid. Single-use codes may be restored at our discretion.",
        "We may end or change a promotion at any time, but not for bookings already paid.",
      ),
    )],
    ["Referral program", p(
      `Share your referral code. When a friend uses it, they get ${money(REFERRAL.friendOff)} off their first job. When their first job is completed and paid, you get a ${money(REFERRAL.reward)} credit toward your next booking.`,
      ul(
        `You can earn up to ${REFERRAL.maxRewardsPerYear} referral rewards per calendar year.`,
        "Your friend must be a new customer, and the referral code must be used at their first booking.",
        "No self-referrals: you can't refer yourself, your own other accounts, or people in your household.",
        "No spam: don't share your code with people you don't know through spam, ads on search engines using our name, or coupon sites.",
        "Credits work like gift card balance on your account. They have no cash value and can't be transferred.",
        "If we find fraud or abuse, we may cancel the credit, the friend's discount or the code, and charge back credits already used.",
        "We may change or end the program with notice. Rewards already earned stay valid.",
      ),
    )],
    ["Tips", p(
      `Tips are always optional. You can tip after the job is completed, in the app. 100% of every tip goes to your pro; we keep none of it. You can tip up to ${money(TIP_MAX)} per job in the app.`,
      "A tip doesn't change your guarantee, and not tipping never affects your service. Tips are not refundable once paid out, except for errors or fraud.",
    )],
    ["Fraud and changes", p(
      "We may refuse, cancel or reverse any membership, gift card, promo code, credit or reward that was obtained by fraud, abuse, error or in violation of these terms.",
      "We may update these terms with notice. Changes don't reduce gift card balances or rewards already earned.",
      "Our Terms of Use (including dispute resolution) also apply.",
    )],
  ]),
};

// ════════════════════════════════════════════════════════════════════════════
// 5. SERVICE ADDENDA
// ════════════════════════════════════════════════════════════════════════════
const ADDENDUM_INTRO = "This addendum adds to the Service Agreement for the services listed. If they conflict, this addendum controls for those services.";

const TRANSPORTATION: Contract = {
  key: "addendum-transportation",
  title: "Addendum — Rides & Transportation",
  version: V1,
  audience: "customer",
  appliesTo: "Private drivers, black cars, airport transfers, limousines, party buses, charter and tour buses, game day and concert rides, and event shuttles.",
  services: ["private-driver", "airport-transfer", "limousine", "party-bus", "charter-bus", "game-day-rides", "event-shuttle"],
  summary: [
    "We book a licensed, insured passenger carrier for you. The carrier and its driver run the trip.",
    "The driver is in charge of safety and can refuse unsafe or unlawful behavior.",
    "No alcohol for anyone under 21. Carrier rules on alcohol apply.",
    "Don't go over the vehicle's seat count.",
    "Extra waiting time, and cleaning or damage (like vomit), are charged.",
    "Traffic and event crowds can cause delays we can't control.",
  ],
  sections: numbered([
    ["How rides work", p(
      ADDENDUM_INTRO,
      "Transportation is provided by licensed, insured passenger carrier companies (\"carrier\"). We book the carrier for you, as your agent. The carrier holds the required authority (for example, Michigan Department of Transportation (MDOT) authority for limousines and buses, and federal FMCSA authority for interstate trips) and carries passenger carrier insurance.",
      "The carrier is responsible for operating the vehicle, its driver and its safety. We are responsible for booking, payment, customer support and our guarantee on the booking itself. We do not drive or operate vehicles.",
      "Our Service Agreement's damage claims process still applies: report problems to us, and we will deal with the carrier and its insurer for you." + COUNSEL,
    )],
    ["Pickup, timing and waiting", p(
      "Give us the exact pickup address, time, stops, flight number (for airport rides) and passenger count. The price is based on these details.",
      ul(
        "Airport rides: we track your flight and adjust pickup for delays when you give us the flight number.",
        "Waiting: a short grace period is included (shown on your invoice). After that, waiting time is charged at the rate on your invoice, in 15-minute blocks.",
        "Extra stops or route changes during the trip may be charged at the rate on your invoice.",
        "Hourly bookings: the time runs from pickup to drop-off, including waiting, and often has a minimum.",
        "Delays caused by traffic, weather, road closures, game or concert crowds, or police are not the carrier's fault. We will do our best to keep you informed.",
      ),
    )],
    ["Passengers and conduct", p(
      ul(
        "Never more passengers than the vehicle's seat count. The driver may refuse extra passengers.",
        "Everyone must wear a seat belt where the vehicle has them.",
        "Children: Michigan law requires car seats or booster seats for young children. Bring your own, or request one when booking if the carrier provides them.",
        "No smoking or vaping, no illegal drugs, no weapons where prohibited, and nothing thrown from the vehicle.",
        "No standing or hanging out of windows or sunroofs while moving.",
        "The driver may end the trip, without refund, if passengers are unsafe, violent, abusive or breaking the law. We may still charge for damage.",
        "The person who books is responsible for the conduct of their group.",
      ),
    )],
    ["Alcohol", p(
      "No one under 21 may have or drink alcohol aboard. If anyone under 21 is aboard, the carrier may ban alcohol for the whole trip.",
      "Where Michigan law allows passengers 21 and older to drink in a limousine or chartered vehicle, the carrier's own rules still apply. The driver may stop alcohol use or end the trip if anyone is intoxicated to the point of being unsafe. Drivers never drink, and never serve alcohol." + COUNSEL,
    )],
    ["Cleaning and damage", p(
      "You are responsible for damage to the vehicle caused by your group beyond normal use. Cleaning fees apply for spills, trash left behind, and bodily fluids (such as vomit). The fee is the carrier's documented cost, with photos, up to the amount shown in the carrier's rate sheet. We will show you the photos and the fee before charging your card on file.",
    )],
    ["Lost items", p(
      "Please check the vehicle before you leave. If you leave something behind, contact us right away. We will ask the carrier to look for it. We can't guarantee items will be found. Return delivery may cost extra.",
    )],
    ["Cancellation", p(
      "Rides follow the Service Agreement's cancellation rules, except: larger vehicles (limousines, party buses, charter buses and shuttles) often need more notice. If the carrier's cancellation terms are stricter, we will show them when you book, and those terms apply.",
      "If a carrier cancels or doesn't show up, we will find another carrier or give you a full refund. To the extent the law allows, we aren't liable for missed flights, events or connections caused by delays outside our control." + COUNSEL,
    )],
  ]),
};

const MEDICAL: Contract = {
  key: "addendum-medical-delivery",
  title: "Addendum — Medical Deliveries",
  version: V1,
  audience: "customer",
  appliesTo: "Prescription pickups, medical supplies and equipment, lab specimens and medical records couriered for patients, caregivers, pharmacies, clinics and labs.",
  services: ["medical-delivery"],
  summary: [
    "Background-checked, HIPAA-trained couriers. Signature and chain-of-custody log on every run.",
    "We deliver. We never give medical advice.",
    "Prescriptions need ID or a signature at handoff. Controlled substances only with the pharmacy's approval.",
    "Clinics, pharmacies and labs must sign a HIPAA BAA before sending patient information.",
    "Specimens must be packed and labeled to UN3373/OSHA rules by the sender.",
    "Time-critical delivery is best effort within the stated window. Our liability is limited.",
  ],
  sections: numbered([
    ["About this service", p(
      ADDENDUM_INTRO,
      "Our couriers are background-checked and have HIPAA training. Specimen couriers also have bloodborne-pathogen training. Every run has a signature and a chain-of-custody log, with time stamps and photos.",
      "We are a courier only. We do not prescribe, dispense, give medical advice, or check whether a medicine or item is right for you. Ask your doctor or pharmacist.",
    )],
    ["For patients and caregivers", p(
      ul(
        "Tell the pharmacy that we are picking up for you. The pharmacy decides whether to release the item.",
        "Controlled substances are only carried with the pharmacy's approval and in line with its procedures.",
        "At delivery, the person receiving must show ID and/or sign, as the pharmacy or law requires. If no one authorized is there, we will contact you and may return the item to the pharmacy. A second delivery attempt is charged.",
        "Temperature-sensitive items (like insulin or some vaccines) are carried in temperature-controlled containers when you book cold chain. Please be available to receive them promptly and store them right away.",
        "Prescription costs and copays are paid to the pharmacy, not included in our price, unless we agree otherwise.",
        "In a medical emergency, call 911. Do not rely on a delivery.",
      ),
    )],
    ["For clinics, pharmacies and labs", p(
      ul(
        "HIPAA: before you give us any protected health information (PHI), you must sign our Business Associate Agreement (BAA). Until then, send only what's needed for delivery (for example, a sealed package and an address), without diagnosis or other health details.",
        "Packaging: you are responsible for packing and labeling specimens and medical items correctly (for example, UN3373 Biological Substance, Category B triple packaging, and OSHA bloodborne pathogen rules) and following your own procedures. Our couriers may refuse a package that is leaking, damaged or not properly packed or labeled.",
        "We don't carry Category A infectious substances, radioactive materials or hazardous materials that require special permits, unless agreed in writing with a qualified carrier.",
        "Chain of custody: we log pickup, handoffs and delivery with time, signature and photos, and share the log with you.",
        "Timing: STAT pickups aim for pickup within 90 minutes. Delivery times are best-effort targets within the window we confirm. Traffic and weather can cause delays. Please plan critical time windows with that in mind.",
        "Recurring routes and business terms are covered by the Business Services Agreement and your Order.",
      ),
    )],
    ["Liability for items", p(
      "If an item is lost or damaged while in our courier's care, tell us within 24 hours. To the extent the law allows, our liability is limited to the delivery fee plus the documented replacement cost of the item, up to $500 per delivery, unless a higher value is agreed in writing before pickup." + COUNSEL,
      "We are not liable for medical outcomes, spoiled specimens or the need for a new specimen draw caused by delays outside our control, improper packaging, or incorrect information given to us. This does not limit liability for our gross negligence or willful misconduct.",
    )],
  ]),
};

const PETS: Contract = {
  key: "addendum-pet-care",
  title: "Addendum — Pet Care",
  version: V1,
  audience: "customer",
  appliesTo: "Dog walking, dog sitting and pet watching, and dog poop removal.",
  services: ["dog-walking", "dog-sitting", "pet-waste-removal"],
  summary: [
    "Your pet must be vaccinated (including rabies), and you must tell us about any bites or aggression.",
    "Leashed at all times on walks. Never off-leash.",
    "In an emergency we take your pet to a vet. You pay vet bills unless our pro caused the problem.",
    "Pros may shorten walks in extreme weather.",
    "We keep your keys secure and return them on request.",
  ],
  sections: numbered([
    ["Your promises about your pet", p(
      ADDENDUM_INTRO,
      ul(
        "Your pet is up to date on vaccines required by law (including rabies) and is licensed where required.",
        "You have told us about any history of biting, fighting, aggression, escaping, health problems, allergies and medications.",
        "Your pet is used to a collar or harness and leash that fits properly.",
        "You are the owner or have the owner's permission.",
      ),
      "If your dog bites or injures someone, including our pro or another animal, while in our care, you are responsible as the owner, as Michigan law provides, unless our pro's negligence caused it. Please tell us about any bite history; if you don't, you are responsible for resulting injuries and costs." + COUNSEL,
    )],
    ["Walks and care", p(
      ul(
        "Dogs are always leashed outside a fenced yard. We never let dogs off-leash, at dog parks or elsewhere, even if you ask.",
        "We walk one household's dogs together unless you agree to group walks.",
        "Pros may shorten or skip outdoor time in extreme heat, cold, ice or storms, and spend the time indoors instead. The visit still counts.",
        "We follow your feeding, medicine and care instructions in the app. Please leave food and supplies out.",
        "We may decline or stop care for an animal that is aggressive or dangerous. If we stop for that reason, the late-cancellation terms apply.",
      ),
    )],
    ["Emergencies and vet care", p(
      "If your pet is sick or hurt, we will try to reach you and your emergency contact. If we can't reach you quickly, you authorize our pro to take your pet to your vet or the nearest emergency vet and approve the care needed to stabilize your pet, up to $500 unless you set a different limit in the app." + COUNSEL,
      "You pay the vet bills, unless the problem was caused by our pro's negligence. Our make-it-right and damage process applies to that case.",
    )],
    ["Keys and home access", p(
      "Keys, garage codes and lockbox codes are kept securely and shared only with the pro on your visit. Tell us right away if you change a code. We return keys when you ask or when your service ends. If we lose a key, we pay to re-key the lock.",
    )],
    ["Poop pickup", p(
      "For yard poop removal, please make sure gates are unlocked and dogs are inside. We bag and remove waste. We can't guarantee every piece is found under snow, in tall grass or in dense plants.",
    )],
  ]),
};

const EVENTS: Contract = {
  key: "addendum-events",
  title: "Addendum — Parties & Events",
  version: V1,
  audience: "customer",
  appliesTo: "Event planning by budget, event planning and coordination, catering, food trucks, DJs and live music, event security, seating and party rentals, and event venues.",
  services: ["event-package", "event-planning", "catering", "food-truck", "dj-music", "event-security", "event-rentals", "event-venue"],
  summary: [
    `Events are booked with a ${pct(DEPOSIT.eventShare)} deposit. The balance is charged ${DEPOSIT.eventBalanceDaysBefore} days before the event.`,
    `Your final guest count is due ${DEPOSIT.eventBalanceDaysBefore} days before. After that, it can go up (if possible) but you're not refunded for fewer guests.`,
    "If a vendor can't make it, we replace them with one of equal quality.",
    "Only licensed providers serve alcohol.",
    "Event security comes from licensed security agencies; guards de-escalate and call police when needed, and you follow their safety calls.",
    "You follow venue rules and are responsible for damage to rentals.",
    "The closer to the event you cancel, the more of the price is non-refundable.",
  ],
  sections: numbered([
    ["Deposits and balance", p(
      ADDENDUM_INTRO,
      `Events are booked with a deposit of ${pct(DEPOSIT.eventShare)} of the price (at least ${money(DEPOSIT.minimum)}). The balance is charged to your saved card ${DEPOSIT.eventBalanceDaysBefore} days before the event. Events booked within ${DEPOSIT.eventBalanceDaysBefore} days are paid in full.`,
      "Many vendors need notice. Some events can't be booked on short notice; the app shows the minimum notice for each service.",
    )],
    ["Guest count and changes", p(
      ul(
        `Your final guest count is due when the balance is charged (${DEPOSIT.eventBalanceDaysBefore} days before). You pay for the final count, or the actual count if higher.`,
        "Increases after that are subject to availability and priced at the per-guest rate.",
        "Decreases after that aren't refunded, because food, staff and rentals are already ordered.",
        "Menu, time or location changes may change the price. We will send a change order for you to approve.",
      ),
    )],
    ["Vendors and substitutions", p(
      "We book vendors (caterers, food trucks, DJs, rental companies and venues) for you. If a vendor can't perform, we will replace it with one of equal or better quality and similar style, at no extra cost. If we can't, we refund that vendor's part of the price.",
      "Menu items may be substituted with equal items if an ingredient is unavailable.",
      "Food safety: caterers and food trucks hold the required food licenses. Please tell us about food allergies in advance. We can't guarantee food is free of allergens unless the caterer confirms it in writing. Leftover food is handled under health rules; we may not be able to leave it with you.",
    )],
    ["Alcohol", p(
      "Alcohol is only served by providers holding the right Michigan Liquor Control Commission license and liquor liability insurance. Servers may check ID, refuse service to anyone under 21 or visibly intoxicated, and stop service at any time.",
      "If you supply your own alcohol where the venue allows it, you are responsible for serving it lawfully and for the conduct of your guests." + COUNSEL,
    )],
    ["Event security", p(
      "Security is provided by a security guard agency licensed in Michigan; the guards are that agency's employees. Guards are unarmed unless you book armed officers, who are provided only by agencies authorized to arm them.",
      ul(
        "Guards work the posts, hours and duties on your booking (for example door and ID checks, guest list, crowd and parking control). Tell us about entrances, VIPs, known risks and whether alcohol is served.",
        "Guards may refuse entry, ask someone to leave, stop unsafe activity, and call police or emergency services. They de-escalate first and use no more force than the law allows. They are not police and can't promise that nothing will happen.",
        "Please follow their safety calls and don't ask them to do anything unlawful (for example, searching guests without consent).",
        "You get a written incident report after the event when anything is reported. Too few guards for the crowd? We may recommend more; you decide.",
      ),
    )],
    ["Venues, permits and noise", p(
      ul(
        "You and your guests must follow the venue's rules (hours, decorations, capacity, cleanup, music limits).",
        "If your event is in a park, a street or another public place, a permit may be needed. We will tell you if we know one is needed and can help get it. The permit cost is on your invoice.",
        "Local noise rules apply. The DJ may lower the volume or stop at the required time.",
        "Venue damage, extra cleaning or overtime caused by your group are charged at the venue's documented cost.",
      ),
    )],
    ["Rentals", p(
      "Rentals (tables, chairs, tents, linens, equipment) stay the property of the rental company. You are responsible for loss or damage beyond normal use while they are with you, at the rental company's documented replacement or repair cost. Please keep them dry and secure, and have them ready at pickup time.",
      "Tents and some equipment can only be set up on suitable ground and in safe weather. The crew may refuse unsafe setup.",
    )],
    ["Outdoor events and weather", p(
      "For outdoor events, please plan a rain or cold-weather backup (a tent, an indoor space or a rain date). The weather is not a reason for a free cancellation unless authorities or the venue close the event, or our crew can't safely set up (for example, lightning or high wind). In that case, we will work with you to move the date, and vendors' non-refundable costs may still apply.",
    )],
    ["Cancellation", p(
      "Because vendors reserve your date and order supplies, events have their own cancellation tiers:" + COUNSEL,
      ul(
        "More than 30 days before the event: full refund, minus any non-refundable vendor costs already paid for you (shown on your invoice or quote).",
        `Between 30 and ${DEPOSIT.eventBalanceDaysBefore + 1} days before the event: the deposit is non-refundable. You won't be charged the balance.`,
        `Within ${DEPOSIT.eventBalanceDaysBefore} days of the event: the full price is non-refundable. We will refund anything vendors return to us.`,
        "Instead of cancelling, you may move the event once to a date within 12 months, subject to availability. Money paid is credited to the new date; price differences apply.",
        "If we cancel, or can't provide a replacement vendor, you get a full refund of the affected part.",
      ),
    )],
  ]),
};

const SECURITY: Contract = {
  key: "addendum-security",
  title: "Addendum — Security Guards & Patrol",
  version: V1,
  audience: "customer",
  appliesTo: "Standing guard posts, mobile patrols and fire watch for buildings, job sites, vacant properties and parking lots.",
  services: ["security-guard"],
  summary: [
    "Guards come from a security guard agency licensed in Michigan; they are that agency's employees.",
    "Unarmed unless you book armed officers. Guards are not police and can't promise nothing will happen.",
    "You give clear post orders, safe access and a contact for incidents. Keys and codes are used only for the job.",
    "Fire watch doesn't replace your alarm or sprinklers: you still must fix them and follow the fire marshal's orders.",
    "A daily activity report with photos after every shift; anything unusual is reported to you right away.",
    "Weekly and monthly coverage continues until you cancel; cancel before the next shift starts.",
  ],
  sections: numbered([
    ["About this service", p(
      ADDENDUM_INTRO,
      "Security is provided by a security guard agency licensed in Michigan. The guards are that agency's employees, background-checked and in uniform with agency ID. Guards are unarmed unless you book armed officers, who are provided only by agencies authorized to arm them.",
    )],
    ["Post orders and access", p(
      ul(
        "Tell us the areas to cover, shift times, how to get in (keys, codes, gate), what is off limits, and who to call for incidents, day and night. Keep this up to date.",
        "Keys, access cards and alarm codes are used only for the job, never copied, and returned when coverage ends.",
        "Guards may observe and report, refuse entry, ask people to leave, and call police or emergency services. They de-escalate first and use no more force than the law allows. They don't search people or belongings without consent, and they don't do work outside security (for example, cleaning or deliveries).",
      ),
    )],
    ["Fire watch", p(
      "Fire watch is a temporary measure while a fire alarm or sprinkler system is out of service. Guards walk every area on the schedule the fire marshal or your insurer requires (at least hourly), log each round, and call 911 first for any fire or smoke. Fire watch doesn't replace a working system: you remain responsible for repairing it, notifying the fire department when required, and following its orders." + COUNSEL,
    )],
    ["Reports and incidents", p(
      "You get a daily activity report with photos after each shift. Anything unusual is reported to your contact right away, and police or 911 are called first in an emergency. Guards are a deterrent and a set of eyes; they are not police and can't guarantee that no theft, damage or injury will happen. Our liability follows the Service Agreement.",
    )],
    ["Recurring coverage", p(
      "Weekly and monthly coverage repeats on the same schedule and is charged per period, until you cancel or change it. To cancel or change a shift, tell us before the shift starts; late cancellations follow the Service Agreement.",
    )],
  ]),
};

const CONSTRUCTION: Contract = {
  key: "addendum-construction-remodel",
  title: "Addendum — Repairs, Trades, Painting & Remodels",
  version: V1,
  audience: "customer",
  appliesTo: "Handyman, plumbing, water heaters, HVAC, lighting and ceiling fans, security cameras, garbage disposals, interior and exterior painting, and bathroom, kitchen and whole-home remodels.",
  services: ["handyman", "plumbing", "water-heater", "hvac-install", "lighting-install", "camera-install", "garbage-disposal", "interior-painting", "exterior-painting", "bathroom-remodel", "kitchen-remodel", "home-remodel", "unit-turnover"],
  summary: [
    "Licensed work (plumbing, electrical, HVAC, painting, remodels) is done only by licensed contractors.",
    "The contractor pulls any permits needed. The cost is on your invoice.",
    "Bigger projects are paid in steps (milestones). Changes are approved and paid in the app before extra work.",
    "Hidden problems behind walls or floors are priced as a change order.",
    "You get a 1-year workmanship warranty on remodels and licensed trade work, plus our 30-day guarantee.",
    "You have 3 business days to cancel a contract signed at your home after a site visit.",
  ],
  sections: numbered([
    ["Who does the work", p(
      ADDENDUM_INTRO,
      "Work that legally requires a license (plumbing, electrical, HVAC, painting contracting, remodeling and residential building) is done only by a contractor holding the right Michigan license. Simple handyman work is done by insured handyman pros, within what Michigan law allows without a license.",
      `${BRAND.legalName} manages and guarantees the job. Where the law requires the licensed contractor to contract directly with you, the licensed contractor is the contractor of record, and we act as your project manager and payment agent.` + COUNSEL,
    )],
    ["Permits and inspections", p(
      "If a permit is required, the licensed contractor pulls it in their name and schedules the inspections. The permit cost is shown on your invoice. You agree to give inspectors access. Work that fails inspection is fixed at no cost to you, unless the failure is caused by a condition outside the scope.",
      "We do not do permit-required work without a permit, even if you ask.",
    )],
    ["Payment schedule", p(
      "Smaller jobs are paid upfront. Larger projects are paid in steps, as shown on your quote. For example: a deposit to schedule and order materials, a payment at a set stage (like rough-in or cabinet delivery), and the final payment when the work is done and has passed our quality check and any final inspection.",
      `Deposits follow the Service Agreement (${pct(DEPOSIT.share)}, at least ${money(DEPOSIT.minimum)}). The contractor is paid by us as each step is completed and checked, never more than the work done plus materials delivered.`,
    )],
    ["Change orders", p(
      "Any change to the work, price or schedule must be in writing as a change order in the app, approved by you and paid before the extra work begins. Verbal agreements with the crew are not binding on you or us. Change orders are priced at our standard rates.",
    )],
    ["Hidden conditions", p(
      "Some problems can't be seen until work starts, such as rot, mold, water damage, old wiring, failed pipes, structural problems, asbestos or lead. When found, work on that area stops and we send a change order to fix it. If the hidden condition is hazardous (like asbestos), a licensed specialist must handle it, and we can't proceed until they do.",
    )],
    ["Materials", p(
      "Materials are listed on your quote. Special-order materials (such as cabinets, counters, tile and fixtures) are ordered after you pay the deposit and approve your choices. Special orders usually can't be returned. If you cancel or change your mind after ordering, you pay the cost of the materials, plus any restocking fees the supplier charges, minus what the supplier refunds. You get any materials you've paid for.",
      "Delivery delays by suppliers may move your schedule. We will keep you informed.",
      "Materials you supply yourself must be on site and correct. They are not covered by our warranty, and delays they cause may cost extra.",
      "Equipment you buy for us to install (for example, a water heater on an install-only job) must be new and unused, in its original packaging, and the right size and type for your home. Our 1-year workmanship warranty covers our installation; the equipment itself is covered by its maker or seller, not by us. We don't install used equipment.",
    )],
    ["Liens and lien waivers", p(
      "Under the Michigan Construction Lien Act, contractors, suppliers and workers who aren't paid may have the right to place a lien on your property. To protect you, for projects where liens are possible, we will give you a sworn statement listing the contractors and suppliers, and on final payment we provide waivers of lien from the contractor and major suppliers. Please don't pay any contractor or supplier directly." + COUNSEL,
      "If you receive a notice of furnishing from a supplier, send it to us right away.",
    )],
    ["Warranty", p(
      `Our ${BRAND.guaranteeDays}-day make-it-right guarantee applies to every job. In addition, remodels and licensed trade work (plumbing, electrical, HVAC, water heaters and painting by licensed contractors) come with a 1-year workmanship warranty from completion. If a defect in workmanship appears within that year, tell us and we will fix it at no cost.`,
      "Manufacturer warranties on products and equipment (like a water heater or furnace) pass to you. Registration may be required; we will help you register.",
      "The warranty doesn't cover: materials you supplied; normal wear; damage from misuse, accidents, weather events, or lack of maintenance (for example, not changing HVAC filters); settling, minor drywall cracks or nail pops; changes by others; and items listed as excluded on the quote.",
    )],
    ["Your 3-day right to cancel", p(
      "If you agree to the project at your home after a site visit, you may cancel within 3 business days under the Michigan Home Solicitation Sales Act, as explained in the Service Agreement. Work and material orders won't start before that period ends, unless you ask us in writing for an emergency repair." + COUNSEL,
    )],
    ["Lead-safe work", p(
      "Homes built before 1978 get EPA RRP lead-safe work practices by certified renovators for painting, remodeling and repairs that disturb painted surfaces. You will receive the \"Renovate Right\" pamphlet before work starts. Lead-safe practices can add time and cost, shown on your quote.",
    )],
    ["Job site, utilities and cleanup", p(
      ul(
        "We may need to turn off water, power or gas for part of the job. We will tell you before we do.",
        "Please keep children and pets out of the work area.",
        "The crew protects floors and furnishings near the work area and cleans up each day. Debris from the job is hauled away unless the quote says otherwise.",
        "Dust and noise are normal in construction. We take reasonable steps to limit them.",
        "Work hours follow local rules, usually weekdays and Saturdays, during the day.",
      ),
    )],
    ["Painting", p(
      "Painting prices include the prep listed on the quote. Colors look different on walls than on chips; we recommend trying a sample first. Repainting because of a color change after work starts is a change order. Exterior painting depends on dry weather and temperatures above the paint maker's minimum, so dates may move.",
    )],
  ]),
};

const ERRANDS: Contract = {
  key: "addendum-errands-delivery",
  title: "Addendum — Errands, Courier & Personal Assistant",
  version: V1,
  audience: "customer",
  appliesTo: "Errands, pickups and store shopping, same-day courier deliveries, and a personal assistant for the day.",
  services: ["errands", "courier", "personal-assistant"],
  summary: [
    "We buy things for you at cost, with the receipt. No markup.",
    "Tell us your substitution choices. If something's out, we follow them or skip it.",
    "Alcohol and tobacco need an adult with ID at handoff, and may be refused.",
    "No prescriptions through errands. Use Medical Deliveries instead.",
    "Once delivered, perishables are your responsibility.",
    "Pros don't carry cash for you.",
  ],
  sections: numbered([
    ["Purchases on your behalf", p(
      ADDENDUM_INTRO,
      `When we shop for you, we buy items on your behalf and charge you the exact cost on the store receipt, with no markup. Our price covers the service. The receipt is saved in the app. Purchases over ${MATERIALS_OK} need your OK first, and errand shopping is limited to ${SHOPPING_MAX} per booking unless we agree to more.`,
      "Store prices, sales tax and bottle deposits are what the store charges. Store loyalty discounts apply only if you give us your loyalty number.",
    )],
    ["Substitutions", p(
      "Tell us in the app whether we may substitute an item that is out of stock, and with what. If you don't say, the pro may message you; if you don't answer quickly, they will choose a close match (same type, similar size and price) or skip the item. You may refuse a substitute at delivery, and we will refund it or return it to the store when possible.",
    )],
    ["Age-restricted items", p(
      "Alcohol, tobacco and vape products can only be bought and delivered where the law allows. A person 21 or older must show valid ID at delivery. If no one can, or if the person appears intoxicated, the item is returned to the store and a return fee may apply. The pro may refuse to buy these items.",
    )],
    ["What we don't do", p(
      ul(
        "No prescriptions or controlled substances through errands. Use Medical Deliveries, which has HIPAA-trained couriers and pharmacy procedures.",
        "No illegal items, weapons, ammunition, hazardous materials or live animals.",
        "We don't carry or handle cash for you, or make bank deposits.",
        "No driving or transporting people in the pro's car. Use our ride services.",
        "No personal care (like bathing or medical help) or childcare.",
        "No signing legal documents or contracts in your name.",
      ),
    )],
    ["Delivery and perishables", p(
      "We deliver to the address you give us. If no one is home, we leave non-perishable items in a safe place you choose, with a photo. Perishable and frozen items are kept cold as practical while shopping and in transit. Once delivered (handed to you or left as you asked), they are your responsibility. If items arrive spoiled or damaged, tell us within 24 hours with a photo.",
    )],
    ["Personal assistant", p(
      "Your assistant follows your task list, in order, for the booked hours. Tasks must be lawful and safe and must fit the service. Extra hours are a change order. If your assistant drives for errands, mileage up to the amount on your invoice is included.",
    )],
  ]),
};

const HAULING: Contract = {
  key: "addendum-hauling",
  title: "Addendum — Junk Removal, Large Items, Containers, Moves & Deliveries",
  version: V1,
  audience: "customer",
  appliesTo: "Junk removal, large item removal, junk container drop-off and pickup, small moves, same-day large item delivery, home staging furniture moves, and the cleanout part of a rental unit turnover.",
  services: ["junk-removal", "large-item-removal", "junk-container", "small-moves", "retail-delivery", "staging-transport", "unit-turnover"],
  summary: [
    "You confirm you own the items, or have the right to have them hauled away.",
    "No hazardous waste: paint, chemicals, asbestos, propane tanks and similar items.",
    "Some items (tires, mattresses, appliances, electronics) may carry disposal fees.",
    "We donate or recycle when we can, at our choice.",
    "Containers can mark driveways. Street placement needs a city permit.",
    "Container weight over the allowance is billed at the landfill's cost, with the weigh ticket.",
    "Moves and deliveries: hourly moves are billed for the actual time; our liability for moved items is limited unless you buy added protection.",
  ],
  sections: numbered([
    ["Your items", p(
      ADDENDUM_INTRO,
      "You confirm that you own the items to be removed, or have the owner's permission (for example, a landlord or an estate). Once items are loaded, they become ours to dispose of. We can't return items after they are taken. Please remove anything you want to keep, and point out items to leave behind.",
      "We don't search items for valuables. Check drawers, pockets and boxes first.",
    )],
    ["Items we can't take", p(
      "For safety and legal reasons, we don't take:",
      ul(
        "Hazardous waste: paint (except fully dried latex), solvents, oil, gasoline, pesticides, pool chemicals, cleaning chemicals.",
        "Asbestos, lead-paint debris from abatement, mold remediation debris, or medical waste and sharps.",
        "Propane tanks, fuel tanks, batteries from cars, ammunition and explosives.",
        "Dead animals, food waste in quantity, or human or animal waste.",
      ),
      "Some items are accepted only for an extra disposal fee shown before you pay: tires, mattresses and box springs, appliances with refrigerant (fridges, freezers, AC units), TVs and electronics. If we find prohibited items, we will leave them.",
    )],
    ["Disposal, donation and recycling", p(
      "We take items to licensed disposal, recycling or donation facilities. We donate or recycle when items are in good condition and a facility will accept them, at our choice. We can't guarantee any item will be donated, and we can't give tax receipts for donations unless the charity provides one.",
    )],
    ["Containers (junk container)", p(
      ul(
        "Placement: you choose a flat, firm spot with clear access. We use driveway protection boards, but containers and trucks are heavy and can scuff, crack or mark driveways, lawns and curbs. We are not responsible for this unless caused by our driver's negligence." + COUNSEL,
        "Street placement needs a city permit. If you choose street placement, we file the permit and the cost is on your invoice.",
        "Don't overfill: nothing above the top edge. We may remove extra material before pickup, at a charge.",
        "Weight: your price includes a weight allowance. Weight over the allowance is billed at the landfill's cost per ton, with the weigh ticket.",
        "Heavy-debris containers (concrete, brick, dirt) are for that material only. Mixed loads may be charged as regular debris, plus any extra landfill fees.",
        "Extra days are charged at the rate on your invoice.",
        "If we can't pick up because the container is blocked or overloaded, a trip fee applies.",
        "You are responsible for what is put in the container, including by neighbors or others.",
      ),
    )],
    ["Loading and access", p(
      "Our crew loads from where you tell us. Long carries, stairs and disassembly are priced on your quote. We take care, but moving heavy items through tight spaces can cause minor scuffs to walls or floors. Please point out fragile areas. Damage caused by negligence is handled under the Service Agreement.",
    )],
    ["Moves and deliveries", p(
      ul(
        "Hourly moves: your quote shows the estimated hours. You pay for the actual time, from when the crew arrives to when the last item is placed, in half-hour steps, with the minimum on your quote. If the move will run over the estimate, the crew lead tells you in the app before going past it.",
        "Pack and prepare: boxes should be packed and closed unless you booked packing. We don't move cash, jewelry, important papers, medications, firearms, pets, plants that can't survive the trip, perishable food or hazardous items. Keep valuables with you.",
        "Protection for your items: unless you buy added protection, our liability for loss or damage to moved or delivered items is limited to $0.60 per pound per item. Items you packed yourself are covered only for damage we caused by handling them carelessly. Report damage within 7 days, with photos." + COUNSEL,
        "Deliveries for stores and sellers: we deliver what we pick up, in its packaging; we don't open or inspect it for defects, hook up gas, water or electric, or install anything beyond basic assembly. Proof of delivery is a photo at the drop-off.",
        "Staging furniture: the stager or agent is our customer for both trips. Pickup is scheduled when you tell us the listing closed; if the furniture isn't ready or access isn't available at the booked time, a trip fee applies.",
        "Moves are local, within Michigan, and priced as labor and local transport." + COUNSEL,
      ),
    )],
  ]),
};

const DETAILING: Contract = {
  key: "addendum-vehicle-detailing",
  title: "Addendum — Mobile Car Detailing",
  version: V1,
  audience: "customer",
  appliesTo: "Mobile car detailing at your home or business.",
  services: ["mobile-car-detailing"],
  summary: [
    "The pro photographs existing damage before starting.",
    "Remove valuables and personal items before your appointment.",
    "We may need water and power, unless the pro brings their own.",
    "Some scratches, stains and odors can't be fully removed.",
  ],
  sections: numbered([
    ["Before we start", p(
      ADDENDUM_INTRO,
      "The pro walks around your vehicle and takes photos of existing scratches, dents, chips, stains and wear before starting. We are not responsible for damage that existed before.",
      "Please remove valuables, cash, child seats and personal items. We aren't responsible for items left in the vehicle.",
      "You confirm you own the vehicle or have permission, and that it's parked where detailing is allowed (your driveway or a lot where the owner allows it).",
    )],
    ["Water and power", p(
      "The pro may need access to an outdoor water tap and electric outlet, unless they bring their own. Tell us if neither is available. Detailing may be moved for rain, freezing temperatures or extreme heat.",
    )],
    ["Results", p(
      ul(
        "Paint correction improves the paint's look. It can't remove scratches that are through the clear coat, rock chips or rust.",
        "Interior stains and odors (smoke, pets, spills) can often be reduced but not always fully removed.",
        "Old or damaged trim, upholstery, leather and wraps may be more fragile. The pro will warn you of anything that might be risky.",
        "Waxes and coatings last different lengths of time depending on weather and care.",
      ),
      "Cosmetic limits we explained before the job are not covered by the guarantee. Anything we missed is covered.",
    )],
  ]),
};

const HOME_YARD: Contract = {
  key: "addendum-home-and-yard",
  title: "Addendum — Cleaning, Home & Yard",
  version: V1,
  audience: "customer",
  appliesTo: "Cleaning, windows, carpets and upholstery, organizing, gutters, power washing, lawn care, leaf removal, snow removal, and tree removal and trimming.",
  services: ["house-cleaning", "window-cleaning", "carpet-cleaning", "organizing", "gutter-cleaning", "power-washing", "lawn-care", "leaf-removal", "snow-removal", "tree-removal"],
  summary: [
    "Pros only work at heights they can reach safely, with proper ladders.",
    "Snow: we clear after 2 inches or more on a season plan. Please mark curbs, beds and edges; we can't be responsible for unmarked items under snow.",
    "Power washing can loosen old, failing paint or siding.",
    "Some carpets may shrink or bleed color; we test first.",
    "When organizing, you decide what's kept, donated or thrown out.",
    "Tree work is done by insured crews. Utility lines are handled by the utility.",
  ],
  sections: numbered([
    ["Ladders and heights", p(
      ADDENDUM_INTRO,
      "Pros use proper ladders and safety gear, and only work at heights they can reach safely. Windows, gutters and siding higher than our listed limit (or on steep roofs) may need special equipment and a change order, or may not be possible. Pros may skip areas that are unsafe to reach and will tell you.",
    )],
    ["Cleaning", p(
      ul(
        "Tell us about delicate surfaces (natural stone, unsealed wood, antiques) and preferred products. Our pros use standard products unless you ask otherwise.",
        "We don't move heavy furniture, clean up biohazards (blood, bodily fluids beyond normal household cleaning, needles), handle pest infestations, or clean above safe reach.",
        "We can't guarantee removal of old stains, hard-water deposits, etching or damage.",
      ),
    )],
    ["Carpets and upholstery", p(
      "We pre-test fabrics where we can. Some carpets, rugs and fabrics may shrink, bleed color, ripple or lose texture when cleaned, especially older, natural-fiber or poorly made ones. We will tell you about any risk we see first. Some stains (bleach, dyes, pet urine that has soaked into padding) may not come out. Allow drying time before walking or sitting on cleaned areas.",
    )],
    ["Organizing and decluttering", p(
      "You decide what is kept, donated, recycled or thrown away. Our pro will not throw anything out without your OK. Items marked for donation or disposal are taken away only if your booking includes haul-away. We are not responsible for items you told us to discard.",
    )],
    ["Gutters and power washing", p(
      ul(
        "Gutter cleaning clears debris and checks downspouts. It doesn't include repairs unless quoted. We may find damage; we will tell you.",
        "Power washing can loosen paint that is already failing, damage old or brittle siding, wood or mortar, and force water past bad seals. Please close windows and tell us about weak spots. We use lower-pressure soft washing where suitable. Damage to surfaces that were already failing isn't covered.",
        "We need an outdoor water tap. Runoff and plants: we rinse nearby plants, but cleaning solutions can affect sensitive plants.",
      ),
    )],
    ["Lawn and leaves", p(
      "Please remove toys, hoses, pet waste and debris from the lawn before each visit. We are not responsible for items hidden in tall grass or leaves, or for damage to unmarked sprinkler heads, cables or invisible dog fences. Visits may move for rain or wet ground. Leaf removal covers the areas booked; leaves that fall after the visit aren't included.",
    )],
    ["Snow removal", p(
      ul(
        "Single clearing: we clear once, on the date and time you book. Snowfall after the visit isn't covered.",
        "Season plan (prepaid, November through March): your crew comes automatically after each snowfall of 2 inches or more, up to the number of storms in your plan. Visits are usually done after the snow stops; during long storms we may come more than once. Extra storms beyond your plan are charged per visit at your plan's rate.",
        "Timing: after big storms, everyone needs clearing at once. We work through routes as fast as safely possible; we can't promise a specific time.",
        "Markers: please put stakes or markers along driveway edges, curbs, beds, walkways and anything hidden under snow before the season. We are not responsible for damage to lawns, curbs, landscaping, pavers, edging or items under the snow that weren't marked. Some lawn scraping at driveway edges is normal." + COUNSEL,
        "Salt and ice melt: only when booked. Ice can come back as snow melts and refreezes; clearing does not guarantee a surface free of ice. Walk carefully. Salt can harm concrete, plants and pets; ask for a pet-safe product.",
        "Please move cars from the area to be cleared. We can't clear around parked cars fully.",
        "Ice dams, roofs and city-plowed snow at the end of the driveway after our visit are not included unless booked.",
      ),
    )],
    ["Tree removal and trimming", p(
      ul(
        "Tree work is done by insured tree crews, and the firm price is set after a free site visit.",
        "Utility lines: we don't work within the distance from power lines that the law reserves for line-clearance workers. If a tree touches lines, the utility (such as DTE) must make it safe first.",
        "Stump grinding: before we grind, the crew calls MISS DIG 811 to mark public underground lines. Private lines (sprinklers, invisible fences, lighting, private gas or water lines) must be marked by you.",
        "You confirm the tree is on your property, or you have the owner's written permission. Neighbors' trees and property-line disputes are your responsibility.",
        "Heavy equipment can leave ruts in lawns. We protect where we can, but lawn repair isn't included unless quoted.",
        "Wood and debris are hauled away unless you ask us to leave the wood.",
      ),
    )],
  ]),
};

export const CUSTOMER_ADDENDA: Contract[] = [TRANSPORTATION, MEDICAL, PETS, EVENTS, SECURITY, CONSTRUCTION, ERRANDS, HAULING, DETAILING, HOME_YARD];

/** Services fully covered by the Service Agreement alone (no addendum needed). Every current service has one. */
export const CORE_ONLY_SERVICES: string[] = [];

/** Service slugs not covered by any addendum or CORE_ONLY_SERVICES (should be empty; checked in CI/tests). */
export function customerCoverageGaps(): string[] {
  const covered = new Set<string>([...CORE_ONLY_SERVICES, ...CUSTOMER_ADDENDA.flatMap((a) => a.services ?? [])]);
  return SERVICES.map((s) => s.slug).filter((slug) => !covered.has(slug));
}

export const CUSTOMER_CONTRACTS: Contract[] = [TERMS_OF_USE, SERVICE_AGREEMENT, BUSINESS_MSA, MEMBERSHIP_PROMO_TERMS, ...CUSTOMER_ADDENDA];
