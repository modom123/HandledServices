/*
 * FILE    : apps/web/lib/contracts/state.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-11-06_0311 UTC
 * PURPOSE : State addenda for the states we opened in November 2026: New York, New Jersey and Nevada (Las Vegas area).
 *             Customers — accepted with every booking whose service address is in that state (bookingContracts):
 *               addendum-new-york, addendum-new-jersey, addendum-nevada
 *             Pros — signed by pros based in, or covering ZIPs in, that state (proSigningSet):
 *               pro-addendum-new-york, pro-addendum-new-jersey, pro-addendum-nevada
 *           Each one adds to the base agreements (Terms of Use, Service Agreement, Business Services Agreement, Pro
 *           Agreement) and controls if they conflict. Michigan and Washington customers and pros see no change.
 *           TEMPLATES — not legal advice. Every "[Confirm with counsel.]" marks a point a lawyer licensed in that state
 *           must check before these are used, along with the whole text. Spanish: es-state.ts (English controls).
 */
import { BRAND } from "@handled/core";
import type { Contract } from "./types";

const V = "2026-11-v1";
const COUNSEL = " [Confirm with counsel.]";
const p = (...paras: string[]) => paras.join("\n\n");
const ul = (...items: string[]) => items.map((i) => `• ${i}`).join("\n");
const numbered = (items: [string, string][]) => items.map(([h, body], i) => ({ h: `${i + 1}. ${h}`, p: body }));
const L = BRAND.legalName;
const N = BRAND.name;
const CONTACT = `${BRAND.supportEmail} or ${BRAND.supportPhone}`;

// Filled from Vercel env so the live text never shows a blank: BUSINESS_POSTAL_ADDRESS (also on the Contact page) and
// NJ_HIC_REGISTRATION (Handled's New Jersey home improvement contractor registration number, once issued).
let ADDRESS = "", NJ_REG = "";
try { ADDRESS = process.env.BUSINESS_POSTAL_ADDRESS?.trim() ?? ""; NJ_REG = process.env.NJ_HIC_REGISTRATION?.trim() ?? ""; } catch { /* no process here */ }

/** Two-letter state of a ZIP we serve with a state addendum (NY 100–149, NJ 070–089, NV 889–898). */
export function addendumStateOfZip(zip: string | null | undefined): "NY" | "NJ" | "NV" | null {
  if (!zip || !/^\d{5}/.test(zip)) return null;
  const n = Number(zip.slice(0, 3));
  if (n >= 100 && n <= 149) return "NY";
  if (n >= 70 && n <= 89) return "NJ";
  if (n >= 889 && n <= 898) return "NV";
  return null;
}

// ─── Customers ───────────────────────────────────────────────────────────────

const HOW_IT_WORKS = (state: string) => p(
  `This addendum adds to our Terms of Use, the Service Agreement and, for business bookings, the Business Services Agreement, for every job performed at an address in ${state}. If they conflict, this addendum controls for those jobs.`,
  `${state} law gives you rights that no agreement can take away. Nothing in our agreements limits them.`,
);

export const CUSTOMER_ADDENDUM_NY: Contract = {
  key: "addendum-new-york",
  title: "Addendum — New York",
  version: V,
  audience: "customer",
  appliesTo: "Every booking for work at an address in New York State, homes and businesses.",
  summary: [
    "New York law and New York courts apply to jobs in New York.",
    "Home improvement jobs get a written contract with the details New York requires, and you can cancel within 3 business days of signing.",
    "Money you pay before home improvement work is finished is held as the law requires until the work is done.",
    "In New York City and in Nassau, Suffolk, Westchester, Rockland and Putnam counties, home improvement work is done under the required home improvement licenses.",
    "New York sales tax is added to taxable services (like cleaning, lawn care, snow removal, pest control and repairs). Capital improvements aren't taxed.",
    "Recurring plans tell you the price and how often you're charged, and you can cancel any time online.",
  ],
  sections: numbered([
    ["How this addendum works", HOW_IT_WORKS("New York")],
    ["New York law and courts", p(
      "New York law governs each job performed at a New York address, apart from federal law.",
      "The dispute resolution section of our Terms of Use still applies, including talking first, individual arbitration and your right to opt out. Small claims court is always available. If a dispute about a New York job goes to court, it is heard in the New York county where the work was done.",
    )],
    ["Home improvement work: your written contract", p(
      "\"Home improvement\" means repairing, remodeling, altering, converting or modernizing a home or the land around it: for example carpentry, painting, roofing, siding, flooring, fences, decks, concrete, masonry, windows and doors, and remodels. It does not include cleaning, lawn care or other upkeep that doesn't change the home.",
      "For a home improvement job priced over $500, your booking confirmation and work order are your written contract. Together they show:",
      ul(
        `The names, addresses and license numbers of ${L} and your pro (where a license is required).`,
        "The approximate start date and completion date.",
        "A description of the work and the main materials, with their brand or grade where it matters.",
        "The price and when each payment is due: the part you pay when you book, and the rest when the job is done.",
        "Your right to cancel (next section).",
      ),
      `Changes to a home improvement job are made only by a written change order that you approve in the app before the extra work starts.${COUNSEL}`,
    )],
    ["Your right to cancel a home improvement contract", p(
      "You may cancel a home improvement contract without any penalty or obligation within three business days after you sign it (after you book and receive your confirmation).",
      `To cancel, use "Cancel" on the booking in My bookings, email ${BRAND.supportEmail}, or mail a signed and dated note to ${L} at ${ADDRESS || "the address on your confirmation"}. If you cancel within the three business days, we refund everything you paid within 10 business days.`,
      `Your pro won't start non-emergency home improvement work during those three days unless you ask in writing for it to start sooner.${COUNSEL}`,
    )],
    ["Payments before home improvement work is finished", p(
      `New York treats money paid before home improvement work is finished as trust funds. Any part of the price you pay before the job is complete is held in a separate account (or protected as the law otherwise allows) and used only for your job, until the work is done or the money is refunded.${COUNSEL}`,
      "You pay the rest of the price only after the work is done and you've seen the photo check-out.",
    )],
    ["Licenses in New York City and nearby counties", p(
      `In New York City, home improvement work is sold and done under a home improvement contractor license from the NYC Department of Consumer and Worker Protection (DCWP). Nassau, Suffolk, Westchester, Rockland and Putnam counties have their own home improvement licenses. ${N} only sends home improvement jobs in those places to pros who hold the license that applies, and we show the license numbers on your work order.${COUNSEL}`,
      "Plumbing, electrical and other licensed trades are done only by pros licensed where the work is performed, with permits where the law requires them.",
    )],
    ["Sales tax", p(
      "New York sales tax, at the rate for the job's address, is added to services New York taxes. These include cleaning and maintenance of buildings, lawn and landscape maintenance, snow removal, pest control, and repairs to items you own.",
      "Capital improvements (work that adds to your home's value or life and becomes a permanent part of it) aren't taxed. You may be asked to sign a Certificate of Capital Improvement (Form ST-124) for that work. Tax is shown on your quote and invoice.",
    )],
    ["Recurring plans", p(
      "If you choose a recurring plan, we tell you the price and how often you'll be charged before you confirm, and send a reminder before the plan renews if it renews for a longer term. You can cancel any time in My bookings, with no phone call needed.",
    )],
    ["Your information", p(
      "We protect your personal information with reasonable security safeguards, and we'll tell you if a data breach affects you, as New York's SHIELD Act requires.",
    )],
    ["Complaints", p(
      `Please tell us first at ${CONTACT}. You can also contact the New York State Attorney General's Bureau of Consumer Frauds and Protection, or, in New York City, the Department of Consumer and Worker Protection (call 311).`,
    )],
  ]),
};

export const CUSTOMER_ADDENDUM_NJ: Contract = {
  key: "addendum-new-jersey",
  title: "Addendum — New Jersey",
  version: V,
  audience: "customer",
  appliesTo: "Every booking for work at an address in New Jersey, homes and businesses.",
  summary: [
    "New Jersey law and New Jersey courts apply to jobs in New Jersey.",
    "Home improvement jobs over $500 get a written contract with everything New Jersey requires, including the registration number and insurance details.",
    "You can cancel a home improvement contract until midnight of the third business day after you receive it, for a full refund.",
    "You never pay the final amount before the work is done.",
    "New Jersey sales tax is added to taxable services. Capital improvements are exempt with Form ST-8.",
    "This addendum names the parts of our terms that don't apply to New Jersey consumers.",
  ],
  sections: numbered([
    ["How this addendum works", HOW_IT_WORKS("New Jersey")],
    ["New Jersey law and courts", p(
      "New Jersey law governs each job performed at a New Jersey address, apart from federal law.",
      "If a dispute about a New Jersey job goes to court, it is heard in the Superior Court of New Jersey for the county where the work was done. Claims within its limits can go to the Special Civil Part (Small Claims).",
    )],
    ["Arbitration: what you're agreeing to", p(
      "Our Terms of Use ask that disputes go to binding individual arbitration, unless you opt out within 30 days. Please read it carefully: if you don't opt out, you give up your right to have a dispute decided in court by a judge or jury. Instead, a neutral arbitrator decides it. You can still use small claims court.",
    )],
    ["Home improvement work: your written contract", p(
      "\"Home improvement\" means remodeling, altering, repairing, painting, renovating or modernizing a home or residential property: for example carpentry, roofing, siding, flooring, fences, decks, driveways, concrete, masonry, windows and doors, and remodels.",
      `Every company that sells or performs home improvement work in New Jersey must be registered with the New Jersey Division of Consumer Affairs. ${NJ_REG ? `${L}'s registration number is ${NJ_REG}, and your pro's is on your work order.` : `${L}'s and your pro's registration numbers are on your work order.`}${COUNSEL}`,
      "For a home improvement job priced over $500, your booking confirmation and work order are a written contract signed by you (when you book) and by us. Together they show:",
      ul(
        `The legal name, business address and registration number of ${L} and of your pro.`,
        "The start date and completion date.",
        "A description of the work and the products and materials, with their brand, model or grade where that applies.",
        "The total price, including any finance charges (we don't charge any).",
        "A copy of the certificate of commercial general liability insurance, and the insurer's phone number.",
        "Your right to cancel, in the words the law requires (next section).",
      ),
      `Any change to the work, price or dates is made only by a written change order that you approve in the app before the extra work starts.${COUNSEL}`,
    )],
    ["Notice of your right to cancel", p(
      "YOU MAY CANCEL THIS CONTRACT AT ANY TIME BEFORE MIDNIGHT OF THE THIRD BUSINESS DAY AFTER RECEIVING A COPY OF THIS CONTRACT. IF YOU WISH TO CANCEL THIS CONTRACT, YOU MUST EITHER:",
      ul(
        "SEND A SIGNED AND DATED WRITTEN NOTICE OF CANCELLATION BY REGISTERED OR CERTIFIED MAIL, RETURN RECEIPT REQUESTED; OR",
        `PERSONALLY DELIVER A SIGNED AND DATED WRITTEN NOTICE OF CANCELLATION TO: ${L.toUpperCase()}, ${ADDRESS ? ADDRESS.toUpperCase() : "AT THE MAILING ADDRESS ON YOUR CONFIRMATION"}, ${BRAND.supportPhone}.`,
      ),
      "IF YOU CANCEL THIS CONTRACT WITHIN THE THREE-DAY PERIOD, YOU ARE ENTITLED TO A FULL REFUND OF YOUR MONEY. REFUNDS MUST BE MADE WITHIN 30 DAYS OF OUR RECEIPT OF THE CANCELLATION NOTICE.",
      `You can also cancel in My bookings or by emailing ${BRAND.supportEmail}; we accept those too.${COUNSEL}`,
    )],
    ["Payments and completion", p(
      "You pay part of the price when you book and the rest only when the work is finished and you've seen the photo check-out. We never ask for final payment before the work is complete, including any inspections the permit requires.",
      "Where a job needs a building permit, the pro (or we) gets it before work starts, and the job is not complete until it passes the required inspections.",
    )],
    ["Sales tax", p(
      "New Jersey sales tax (6.625%, or the reduced rate where it applies) is added to services New Jersey taxes. These include cleaning and janitorial services, landscaping and lawn care, repairs and maintenance of property, and pest control.",
      "Capital improvements to real property are exempt when you give us a completed Certificate of Exempt Capital Improvement (Form ST-8). Tax is shown on your quote and invoice.",
    )],
    ["Parts of our terms that don't apply to New Jersey consumers", p(
      "If you're a New Jersey consumer, these parts of our agreements do not apply to you, to the extent New Jersey law doesn't allow them:",
      ul(
        "In the Terms of Use, \"Limits on our liability\": the exclusion of punitive damages, and any limit on our liability for our own negligence that New Jersey law doesn't permit.",
        "In the Service Agreement, \"Property damage\": the cap on our liability at the amount you paid, where the damage was caused by our or the pro's negligence.",
        "In the Terms of Use, \"Your responsibility for misuse\": any duty to pay our legal fees, except as a court or arbitrator orders under New Jersey law.",
      ),
      `Everything else in our agreements applies.${COUNSEL}`,
    )],
    ["Complaints", p(
      `Please tell us first at ${CONTACT}. You can also contact the New Jersey Division of Consumer Affairs.`,
    )],
  ]),
};

export const CUSTOMER_ADDENDUM_NV: Contract = {
  key: "addendum-nevada",
  title: "Addendum — Nevada",
  version: V,
  audience: "customer",
  appliesTo: "Every booking for work at an address in Nevada (we currently serve the Las Vegas area), homes and businesses.",
  summary: [
    "Nevada law and Clark County courts (or the county where the work was done) apply to jobs in Nevada.",
    "Work that needs a Nevada contractor's license is done only by pros licensed by the Nevada State Contractors Board, within their license limit.",
    "Homeowners may be able to get help from the Contractors Board's Residential Recovery Fund.",
    "Nevada doesn't tax most services. Items and materials sold to you are taxed at the local rate.",
    "Pest control is done only by pros licensed by the Nevada Department of Agriculture.",
  ],
  sections: numbered([
    ["How this addendum works", HOW_IT_WORKS("Nevada")],
    ["Nevada law and courts", p(
      "Nevada law governs each job performed at a Nevada address, apart from federal law.",
      "The dispute resolution section of our Terms of Use still applies, including talking first, individual arbitration and your right to opt out. Small claims court (Justice Court) is always available. If a dispute about a Nevada job goes to court, it is heard in the county where the work was done, such as Clark County.",
    )],
    ["Licensed contractor work", p(
      "In Nevada, most construction, repair and improvement work needs a license from the Nevada State Contractors Board (NSCB). The license has a monetary limit: the largest job the contractor may take.",
      "On a job that needs a license, your work order shows the pro's NSCB license number and classification. We only send it to a pro whose license covers that kind of work and whose limit covers the price.",
      `Small jobs that Nevada law lets an unlicensed handyman do may be done by a pro without a contractor's license. That generally means jobs under $1,000 in total for labor and materials, that need no building permit and aren't part of a larger project.${COUNSEL}`,
      "Where a building permit is required, the pro gets it before work starts.",
    )],
    ["Residential work: the Recovery Fund and your written contract", p(
      "If you hire a licensed contractor to work on your own home, the Nevada State Contractors Board's Residential Recovery Fund may help you if the contractor doesn't do the work properly. You can learn about it at nscb.nv.gov or by calling the Board.",
      `For residential work that needs a license, your booking confirmation and work order are your written contract. They show the contractor's name, license number and limit, a description of the work, the price, the payment schedule, and the start and completion dates, along with any other notices Nevada requires for that kind of work (for example, pools and spas).${COUNSEL}`,
      "Changes are made only by a written change order that you approve in the app before the extra work starts.",
    )],
    ["Pest control and other licensed services", p(
      "Pest control is done only by pros licensed by the Nevada Department of Agriculture. Other services that need a Nevada license or certificate are done only by pros who hold it.",
    )],
    ["Taxes", p(
      "Nevada doesn't charge sales tax on most services. Items and materials sold to you as part of a job are taxed at the rate for the job's address (Clark County's rate for the Las Vegas area). Tax is shown on your quote and invoice.",
    )],
    ["Complaints", p(
      `Please tell us first at ${CONTACT}. You can also contact the Nevada State Contractors Board (for contractor work) or the Consumer Affairs Unit of the Nevada Department of Business and Industry.`,
    )],
  ]),
};

export const STATE_CUSTOMER_ADDENDA: Contract[] = [CUSTOMER_ADDENDUM_NY, CUSTOMER_ADDENDUM_NJ, CUSTOMER_ADDENDUM_NV];
const CUSTOMER_BY_STATE: Record<"NY" | "NJ" | "NV", Contract> = { NY: CUSTOMER_ADDENDUM_NY, NJ: CUSTOMER_ADDENDUM_NJ, NV: CUSTOMER_ADDENDUM_NV };

/** The customer state addendum for a service address's ZIP (none for Michigan, Washington or other states). */
export const customerStateAddendum = (zip: string | null | undefined): Contract | null => {
  const s = addendumStateOfZip(zip);
  return s ? CUSTOMER_BY_STATE[s] : null;
};

// ─── Pros ────────────────────────────────────────────────────────────────────

const PRO_HOW = (state: string) => p(
  `This addendum adds to the Pro Agreement and its policies for any pro who lives in ${state}, is based there, or takes jobs there. If they conflict, this addendum controls for that work.`,
  `${state} law gives you protections that no agreement can take away. Nothing in our agreements limits them.`,
);

export const PRO_ADDENDUM_NY: Contract = {
  key: "pro-addendum-new-york",
  title: "New York Addendum (pros)",
  version: V,
  audience: "pro",
  appliesTo: "Pros who live in New York, are based there, or take jobs at New York addresses. Signed with the Pro Agreement.",
  summary: [
    "The Pro Agreement and each work order together are your written contract under New York's Freelance Isn't Free Act.",
    "You're paid every Monday for approved work, and never later than 30 days after you finish a job.",
    "New York law and the courts where you live or work apply.",
    "Home improvement jobs in New York City and in Nassau, Suffolk, Westchester, Rockland and Putnam counties need the local home improvement license.",
    "If you have employees, you carry New York workers' compensation and disability and paid family leave coverage.",
  ],
  sections: numbered([
    ["How this addendum works", PRO_HOW("New York")],
    ["Your written contract (Freelance Isn't Free Act)", p(
      "New York State's Freelance Isn't Free Act, and New York City's law of the same name, protect freelancers paid $800 or more, for one job or for jobs together over 120 days. For every job you do in New York, the Pro Agreement and the job's work order are your written contract. Together they show:",
      ul(
        `The names and mailing addresses of you and ${L}.`,
        "An itemized list of the work (the work order's scope).",
        "What you'll be paid and how (your payout on the work order, with any tips, show-up pay or bonuses).",
        "When you'll be paid: the Monday payout after the job is checked and approved.",
        "When you must finish your part to be paid on that date: completing the job in the app with the check-out photos.",
      ),
      "You can download a copy of everything you've signed, and every work order, from the Pro portal at any time. We keep these records for at least six years.",
    )],
    ["Paying you on time", p(
      "Approved work is paid every Monday, as the Pro Agreement says. No payment for completed work is ever made later than 30 days after you complete the job, even while a customer issue is being reviewed. If a review is still open on day 30, we pay you and settle any adjustment afterwards under the Pro Agreement.",
      `We will never make getting paid on time depend on you accepting less money, agreeing to work only through ${N}, or giving up any right. We won't penalize, threaten or deactivate you for asserting your rights under these laws, or for filing a complaint.${COUNSEL}`,
    )],
    ["New York law and courts", p(
      "If you live or work in New York, New York law governs the Pro Agreement for that work, apart from federal law. If anything goes to court, it is heard in the New York county where you live or work. The arbitration section of the Pro Agreement still applies unless you opted out, and nothing in it stops you from filing a complaint with the New York State Department of Labor or the NYC Department of Consumer and Worker Protection.",
    )],
    ["Licenses", p(
      "Before you take these jobs, upload your license to the Pro portal:",
      ul(
        "Home improvement in New York City: a home improvement contractor license from the NYC Department of Consumer and Worker Protection.",
        "Home improvement in Nassau, Suffolk, Westchester, Rockland or Putnam counties: that county's home improvement license.",
        "Plumbing, electrical and other licensed trades: the license required where the work is done (for example, a New York City master plumber or electrician license from the Department of Buildings).",
        "Pest control: certification as a commercial pesticide applicator from the New York State Department of Environmental Conservation, working for a registered business.",
      ),
      `Don't accept a job that needs a license you don't hold. Show your license number on the work order where the law requires it.${COUNSEL}`,
    )],
    ["Workers' compensation and disability coverage", p(
      "If you have employees or helpers on New York jobs, you must carry New York workers' compensation and disability and paid family leave insurance for them, and upload proof. If you work alone with no employees, you can file the New York exemption form (CE-200) instead, which home improvement licenses also ask for.",
    )],
    ["Sales tax on your jobs", p(
      `${N} collects New York sales tax from the customer where it applies. Don't charge the customer tax yourself on ${N} jobs.`,
    )],
  ]),
};

export const PRO_ADDENDUM_NJ: Contract = {
  key: "pro-addendum-new-jersey",
  title: "New Jersey Addendum (pros)",
  version: V,
  audience: "pro",
  appliesTo: "Pros who live in New Jersey, are based there, or take jobs at New Jersey addresses. Signed with the Pro Agreement.",
  summary: [
    "You run your own independent business: your own registration, insurance, tools, hours and other customers.",
    "Home improvement work in New Jersey needs your own registration with the Division of Consumer Affairs and at least $500,000 of general liability insurance.",
    "Plumbing, electrical, HVAC and pest control need the New Jersey license for that trade.",
    "Home improvement customers have 3 business days to cancel, so don't start non-emergency work before then unless they ask in writing.",
    "New Jersey law and the courts where you live or work apply. If New Jersey law treats you as an employee for any purpose, you get those protections.",
  ],
  sections: numbered([
    ["How this addendum works", PRO_HOW("New Jersey")],
    ["Your independent business", p(
      "New Jersey uses a strict test to decide whether someone is an independent contractor. You are one only if you are free from our control over how you do the work, and you run an independently established business of your own. For work in New Jersey, you confirm and agree that:",
      ul(
        "You decide how, when and whether to do each job. You can decline any offer, set your own hours and days off, and choose your methods, within the customer's scope and the law.",
        "You run your own business. You hold a New Jersey Business Registration Certificate (or the registration your business type needs), and you keep it current.",
        "You offer your services to the public and are free to work for other customers and platforms, including competitors.",
        "You use your own tools, equipment and vehicle, and you carry your own insurance.",
        "You can hire helpers or employees, at your cost and responsibility.",
      ),
      `${N} runs a marketplace that connects customers with independent service businesses. We don't supervise how you do the work beyond the customer's scope, safety rules and the quality check the customer is promised.`,
      `If a court or agency decides that New Jersey law treats you as an employee for any purpose (for example, unemployment insurance or wage payment), you get the protections that law gives for that purpose, and nothing in our agreements waives them.${COUNSEL}`,
    )],
    ["Home improvement registration and insurance", p(
      "To do home improvement work on residential property in New Jersey (for example carpentry, painting, roofing, siding, flooring, fences, decks, concrete, masonry, windows and doors, and remodels), you must:",
      ul(
        "Be registered as a home improvement contractor with the New Jersey Division of Consumer Affairs, and upload your registration number.",
        "Carry commercial general liability insurance of at least $500,000 per occurrence, and upload the certificate. Customers receive a copy with their contract.",
        "Put your registration number on your work orders, invoices and any advertising.",
      ),
      `${N} only offers you home improvement jobs in New Jersey once your registration and insurance are verified.${COUNSEL}`,
    )],
    ["Licensed trades", p(
      "These need a New Jersey license or certification before you take the job, uploaded to the Pro portal:",
      ul(
        "Plumbing: a New Jersey master plumber license (State Board of Master Plumbers), or working under one.",
        "Electrical: a New Jersey electrical contractor license, or working under one.",
        "Heating, ventilation, air conditioning and refrigeration: a New Jersey HVACR contractor license.",
        "Pest control: New Jersey Department of Environmental Protection pesticide applicator certification, working for a licensed business.",
        "Work that disturbs paint in homes built before 1978: EPA lead-safe (RRP) certification.",
      ),
    )],
    ["Home improvement contracts and the right to cancel", p(
      "New Jersey home improvement customers get a written contract and can cancel until midnight of the third business day after receiving it. The app gives the customer the contract and the cancellation notice when they book.",
      ul(
        "Don't start non-emergency home improvement work before the cancellation period ends, unless the customer asks in writing for it to start sooner.",
        "Make every change to the work, price or dates through a change order the customer approves in the app before you do the extra work. Never agree to changes off the app.",
        "Get the permits the job needs before you start, and don't treat the job as complete until any required inspections pass.",
      ),
      COUNSEL.trim(),
    )],
    ["New Jersey law and courts", p(
      "If you live or work in New Jersey, New Jersey law governs the Pro Agreement for that work, apart from federal law. If anything goes to court, it is heard in the Superior Court of New Jersey for the county where you live or work. The arbitration section of the Pro Agreement still applies unless you opted out. By not opting out, you give up your right to have a dispute decided in court by a judge or jury. Nothing in it stops you from filing a complaint with the New Jersey Department of Labor and Workforce Development.",
    )],
    ["Sales tax on your jobs", p(
      `${N} collects New Jersey sales tax from the customer where it applies. Don't charge the customer tax yourself on ${N} jobs.`,
    )],
  ]),
};

export const PRO_ADDENDUM_NV: Contract = {
  key: "pro-addendum-nevada",
  title: "Nevada Addendum (pros)",
  version: V,
  audience: "pro",
  appliesTo: "Pros who live in Nevada, are based there, or take jobs at Nevada addresses. Signed with the Pro Agreement.",
  summary: [
    "You need a Nevada State Business License and the local business license for where you work (for example Clark County, Las Vegas, Henderson or North Las Vegas).",
    "Construction and repair work needs a Nevada State Contractors Board license. Don't take a job above your license's limit or outside its classification.",
    "Without a contractor's license, only small handyman jobs are allowed (generally under $1,000 in total, no permit, and not part of a larger project).",
    "Pest control needs a Nevada Department of Agriculture license.",
    "You run your own independent business. Nevada law and the courts where you live or work apply.",
  ],
  sections: numbered([
    ["How this addendum works", PRO_HOW("Nevada")],
    ["Business licenses", p(
      "To do business in Nevada, you need a Nevada State Business License from the Secretary of State (unless your business is exempt), and the business license for the city or county where you work: for example Clark County, the City of Las Vegas, Henderson or North Las Vegas. Upload them to the Pro portal and keep them current.",
    )],
    ["Contractor's license and its limits", p(
      "Most construction, repair and improvement work in Nevada needs a license from the Nevada State Contractors Board (NSCB), in the classification for that work. Your license also has a monetary limit: the largest job you may take.",
      ul(
        "Upload your NSCB license number, classification and limit. Your work orders show them.",
        "Don't accept a job outside your classification or priced above your limit.",
        "Without an NSCB license, you may only do small handyman jobs that Nevada law allows. That generally means jobs under $1,000 in total for labor and materials, that need no building permit and aren't part of a larger project. Don't split a larger job into small ones, and don't advertise yourself as a contractor.",
        "Get the permits the job needs before you start.",
      ),
      COUNSEL.trim(),
    )],
    ["Other licensed services", p(
      "Pest control needs a license from the Nevada Department of Agriculture, and you must work for a licensed business. Pool and spa work, landscaping contracting and other specialty work need the NSCB classification for that work when the job is above the handyman limit. Upload every license before you take those jobs.",
    )],
    ["Your independent business", p(
      "Nevada law presumes you're an independent contractor when you hold the registrations your business needs and meet the conditions in Nevada law. For work in Nevada, you confirm and agree that:",
      ul(
        "You control how you do the work, your hours and which jobs you accept, within the customer's scope and the law.",
        `You're free to work for others, including other platforms and your own customers. ${N} doesn't require you to work only through us.`,
        "You can hire employees or helpers, at your cost and responsibility.",
        "You provide your own tools, equipment and vehicle, and you have the business registrations and licenses this addendum lists.",
      ),
      `If a court or agency decides that Nevada law treats you as an employee for any purpose, you get the protections that law gives for that purpose.${COUNSEL}`,
    )],
    ["Heat safety", p(
      "Las Vegas summers are dangerous for outdoor work. Plan outdoor jobs for cooler hours where the customer allows, bring water, take shade breaks, and stop if you or a helper shows signs of heat illness. If you have employees, Nevada's heat illness rules for employers apply to you. You can move or cancel a job for dangerous heat without any penalty.",
    )],
    ["Nevada law and courts", p(
      "If you live or work in Nevada, Nevada law governs the Pro Agreement for that work, apart from federal law. If anything goes to court, it is heard in the county where you live or work, such as Clark County. The arbitration section of the Pro Agreement still applies unless you opted out. Nothing in it stops you from filing a complaint with the Nevada Labor Commissioner.",
    )],
    ["Taxes on your jobs", p(
      `Nevada doesn't tax most services. ${N} collects any sales tax due on materials sold to the customer. Don't charge the customer tax yourself on ${N} jobs.`,
    )],
  ]),
};

export const STATE_PRO_ADDENDA: Contract[] = [PRO_ADDENDUM_NY, PRO_ADDENDUM_NJ, PRO_ADDENDUM_NV];
/** Where a pro is based and works (any of these may be missing). */
export interface ProWhere { state?: string | null; zip?: string | null; base_state?: string | null; base_zip?: string | null; service_zips?: string[] | null }

const PRO_BY_STATE: Record<"NY" | "NJ" | "NV", Contract> = { NY: PRO_ADDENDUM_NY, NJ: PRO_ADDENDUM_NJ, NV: PRO_ADDENDUM_NV };

/**
 * The pro state addenda for where a pro is based and the ZIPs they cover (a pro on the NY–NJ line signs both).
 * `state` / `base_state` are the two-letter states on the pro's profile and place of business, if any.
 */
export function proStateAddenda(o: ProWhere): Contract[] {
  const states = new Set<"NY" | "NJ" | "NV">();
  for (const raw of [o.state, o.base_state]) {
    const st = raw?.trim().toUpperCase();
    if (st === "NY" || st === "NJ" || st === "NV") states.add(st);
  }
  for (const z of [o.zip, o.base_zip, ...(o.service_zips ?? [])]) { const s = addendumStateOfZip(z); if (s) states.add(s); }
  return (["NY", "NJ", "NV"] as const).filter((s) => states.has(s)).map((s) => PRO_BY_STATE[s]);
}
