/*
 * FILE    : packages/core/src/launch-checklist.ts
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-02_1329 UTC
 * PURPOSE : The business & legal launch checklist — the things software can't do for us.
 *           Shown in Hub → Go-live setup with tick boxes (who / when is saved), and written up in
 *           docs/BUSINESS_LEGAL_CHECKLIST_*.md. Not legal advice: each item says who to ask.
 */
export interface ChecklistItem { key: string; group: string; title: string; why: string; who: string; blocking: boolean }

export const LAUNCH_CHECKLIST: ChecklistItem[] = [
  // Insurance for Handled itself (pros carry their own; these cover the company)
  { key: "ins_gl", group: "Company insurance", title: "General liability for the company (with contingent liability over subcontractors)", why: "Customers and their insurers will name Handled in any claim, not just the pro.", who: "Commercial insurance broker who places marketplace / gig-platform policies", blocking: true },
  { key: "ins_hnoa", group: "Company insurance", title: "Hired & non-owned auto (HNOA)", why: "Rides, deliveries, errands and courier runs happen in vehicles we don't own.", who: "Same broker", blocking: true },
  { key: "ins_eo", group: "Company insurance", title: "Professional / tech errors & omissions", why: "Our AI sets prices and dispatches work — a mistake there is a professional-liability claim.", who: "Same broker", blocking: true },
  { key: "ins_cyber", group: "Company insurance", title: "Cyber liability", why: "We hold addresses, door codes, photos of homes, medical-delivery details and payment data.", who: "Same broker", blocking: true },
  { key: "ins_crime", group: "Company insurance", title: "Third-party crime / fidelity bond", why: "Covers theft by a pro inside a customer's home or business — customers ask for it.", who: "Same broker", blocking: false },
  { key: "ins_occacc", group: "Company insurance", title: "Occupational accident cover for pros (optional benefit)", why: "Independent pros have no workers' comp; an accident on our job is a reputational and legal risk.", who: "Broker — occupational accident programs for 1099 workers", blocking: false },
  { key: "ins_umbrella", group: "Company insurance", title: "Umbrella policy and workers' comp for our own W-2 staff", why: "Large claims, and any employees we hire (ops, support).", who: "Same broker", blocking: false },

  // Legal review
  { key: "law_contractor", group: "Legal review", title: "Pro agreement reviewed for independent-contractor status", why: "Michigan uses the IRS-style test; states like CA, NJ, MA and IL use the stricter ABC test. Pricing set by us is a risk factor — the review should cover it.", who: "Employment attorney", blocking: true },
  { key: "law_terms", group: "Legal review", title: "Customer Service Agreement, privacy policy and arbitration clause", why: "Refunds, guarantees, cancellations, data use and dispute handling must be enforceable.", who: "Consumer / tech attorney", blocking: true },
  { key: "law_builder", group: "Legal review", title: "Michigan residential builder / home-improvement rules for remodels", why: "Michigan generally requires a residential builder license to contract for residential construction above a small threshold, and home-solicitation sales carry a 3-day cancellation right. Confirm how Handled must contract remodel and painting jobs.", who: "Construction attorney / LARA", blocking: true },
  { key: "law_fcra", group: "Legal review", title: "Background-check process (FCRA) — disclosures and adverse action", why: "Rejecting a pro over a report needs the pre-adverse / adverse notices. Checkr provides the forms; confirm our process follows them.", who: "Employment attorney + Checkr", blocking: true },
  { key: "law_sms", group: "Legal review", title: "Text-message consent (TCPA) and A2P 10DLC registration", why: "Business texting needs recorded consent and carrier registration, or messages are blocked and fines apply.", who: "Twilio registration + attorney review of the consent wording", blocking: true },

  // Medical deliveries
  { key: "hipaa_baa", group: "Medical deliveries", title: "HIPAA Business Associate Agreement ready for clinics, pharmacies and labs", why: "Covered entities must sign a BAA before we touch patient information. A draft is in docs/HIPAA_BAA_DRAFT_*.md for counsel to finalize.", who: "Healthcare attorney", blocking: true },
  { key: "hipaa_policies", group: "Medical deliveries", title: "HIPAA policies: minimum necessary, breach notification, courier training records", why: "Couriers' HIPAA certificates are already required in onboarding; the written policies and a privacy officer are still needed.", who: "Healthcare attorney / compliance consultant", blocking: true },
  { key: "med_specimens", group: "Medical deliveries", title: "Specimen transport: OSHA bloodborne pathogens + UN3373 packaging procedure", why: "Lab specimens are regulated (DOT hazmat, Category B).", who: "Lab customers' compliance teams / safety consultant", blocking: false },

  // Transportation
  { key: "trans_broker", group: "Transportation", title: "Confirm whether Handled needs its own authority to arrange rides", why: "We only book licensed operators (MDOT; FMCSA for interstate). Confirm that arranging and collecting payment for rides doesn't require Handled itself to hold broker or carrier authority.", who: "Transportation attorney", blocking: true },

  // Business setup
  { key: "biz_entity", group: "Business setup", title: "Company formed, EIN, Michigan registration, business bank account", why: "Stripe, insurance, contracts and taxes are all in the company's name.", who: "Accountant / attorney", blocking: true },
  { key: "biz_states", group: "Business setup", title: "Register in each new state before launching there (and its sales tax if services are taxable)", why: "Expansion to new cities means foreign qualification and, in some states, sales tax on services.", who: "Accountant", blocking: false },
  { key: "biz_local", group: "Business setup", title: "Local business licenses (City of Detroit and each city served)", why: "Many cities license service businesses separately.", who: "City clerk / accountant", blocking: false },
  { key: "biz_trademark", group: "Business setup", title: "Trademark search and filing for the brand name", why: "\"Handled\" is used by many companies — confirm we can use it for home services and file before spending on marketing.", who: "Trademark attorney (USPTO search)", blocking: true },
  { key: "biz_stripe", group: "Business setup", title: "Stripe account activated under the company (Connect enabled for pro payouts)", why: "Live payments, payouts and the customer billing portal.", who: "Owner — Stripe dashboard", blocking: true },
  { key: "biz_app_stores", group: "Business setup", title: "Apple and Google developer accounts under the company (D-U-N-S number for Apple)", why: "The app must be published by the company, not a person.", who: "Owner", blocking: true },
  { key: "biz_1099", group: "Business setup", title: "1099-NEC filing process each January", why: "Every pro paid $600+ in a year gets a 1099-NEC (export is in Hub → Finance).", who: "Accountant", blocking: false },
];

export const CHECKLIST_GROUPS = [...new Set(LAUNCH_CHECKLIST.map((i) => i.group))];
