<!--
  FILE    : docs/BUSINESS_LEGAL_CHECKLIST_2026-10-02_1346.md
  PROJECT : Handled (myhumanai) — AI-run home & business services
  CREATED : 2026-10-02_1346 UTC
  PURPOSE : What the business needs that software can't do — insurance, legal review, HIPAA,
            transportation authority and company setup. The same list is in Hub → Go-live setup
            with tick boxes. This is a checklist of questions for professionals, not legal advice.
  UPDATED : 2026-10-04_1934 UTC — 51 services (small moves, large-item delivery, staging moves, unit turnover added).
-->

# Business & legal launch checklist

Tick these off in **Hub → Go-live setup → Business & legal** (it records who and when, with a note
for the policy number or attorney). Items marked **Before launch** should be done before taking
real customers' money.

## How to work through it fastest

1. **One commercial insurance broker** who already insures marketplaces or gig platforms can quote
   every policy in the insurance section at once. Bring: the service list (51 services), expected
   jobs per month, that pros are 1099 subcontractors carrying their own insurance (our onboarding
   verifies it), and that we arrange rides and deliveries in vehicles we don't own.
2. **One business attorney** for the legal review section, with referrals for the specialists
   (employment, healthcare/HIPAA, transportation, construction, trademark). Send them:
   `apps/web/lib/agreement.ts` (pro agreement), `apps/web/lib/service-agreement.ts` (customer
   terms), the privacy page, and `docs/HIPAA_BAA_DRAFT_2026-10-02_1346.md`.
3. **An accountant** for entity, state registrations, sales tax and 1099s.

## Things the system already does that your advisers will ask about

- Pros are offered work, never assigned it; they set their own area, days, hours and daily limit,
  can decline anything, and use their own tools and insurance (independent-contractor factors).
- Insurance, licenses (incl. HIPAA training for medical couriers) and background checks are
  verified before a pro gets any job; expiring documents block dispatch.
- Customers accept the Service Agreement (version, time and IP recorded) before paying.
- Location of pros is only collected while on call or on a job today, and deleted after 12 hours.
- Account deletion is self-service; invoices are kept (name and email only) for tax records.
- Text messages carry STOP opt-out through Twilio; people who opt out are skipped.

## Company insurance

| | Item | Why | Who to ask |
|---|---|---|---|
| **Before launch** | General liability for the company (with contingent liability over subcontractors) | Customers and their insurers will name Handled in any claim, not just the pro. | Commercial insurance broker who places marketplace / gig-platform policies |
| **Before launch** | Hired & non-owned auto (HNOA) | Rides, deliveries, errands and courier runs happen in vehicles we don't own. | Same broker |
| **Before launch** | Professional / tech errors & omissions | Our AI sets prices and dispatches work — a mistake there is a professional-liability claim. | Same broker |
| **Before launch** | Cyber liability | We hold addresses, door codes, photos of homes, medical-delivery details and payment data. | Same broker |
| Soon after | Third-party crime / fidelity bond | Covers theft by a pro inside a customer's home or business — customers ask for it. | Same broker |
| Soon after | Occupational accident cover for pros (optional benefit) | Independent pros have no workers' comp; an accident on our job is a reputational and legal risk. | Broker — occupational accident programs for 1099 workers |
| Soon after | Umbrella policy and workers' comp for our own W-2 staff | Large claims, and any employees we hire (ops, support). | Same broker |

## Legal review

| | Item | Why | Who to ask |
|---|---|---|---|
| **Before launch** | Pro agreement reviewed for independent-contractor status | Michigan uses the IRS-style test; states like CA, NJ, MA and IL use the stricter ABC test. Pricing set by us is a risk factor — the review should cover it. | Employment attorney |
| **Before launch** | Customer Service Agreement, privacy policy and arbitration clause | Refunds, guarantees, cancellations, data use and dispute handling must be enforceable. | Consumer / tech attorney |
| **Before launch** | Michigan residential builder / home-improvement rules for remodels | Michigan generally requires a residential builder license to contract for residential construction above a small threshold, and home-solicitation sales carry a 3-day cancellation right. Confirm how Handled must contract remodel and painting jobs. | Construction attorney / LARA |
| **Before launch** | Background-check process (FCRA) — disclosures and adverse action | Rejecting a pro over a report needs the pre-adverse / adverse notices. Checkr provides the forms; confirm our process follows them. | Employment attorney + Checkr |
| **Before launch** | Text-message consent (TCPA) and A2P 10DLC registration | Business texting needs recorded consent and carrier registration, or messages are blocked and fines apply. | Twilio registration + attorney review of the consent wording |

## Medical deliveries

| | Item | Why | Who to ask |
|---|---|---|---|
| **Before launch** | HIPAA Business Associate Agreement ready for clinics, pharmacies and labs | Covered entities must sign a BAA before we touch patient information. A draft is in docs/HIPAA_BAA_DRAFT_*.md for counsel to finalize. | Healthcare attorney |
| **Before launch** | HIPAA policies: minimum necessary, breach notification, courier training records | Couriers' HIPAA certificates are already required in onboarding; the written policies and a privacy officer are still needed. | Healthcare attorney / compliance consultant |
| Soon after | Specimen transport: OSHA bloodborne pathogens + UN3373 packaging procedure | Lab specimens are regulated (DOT hazmat, Category B). | Lab customers' compliance teams / safety consultant |

## Transportation

| | Item | Why | Who to ask |
|---|---|---|---|
| **Before launch** | Confirm whether Handled needs its own authority to arrange rides | We only book licensed operators (MDOT; FMCSA for interstate). Confirm that arranging and collecting payment for rides doesn't require Handled itself to hold broker or carrier authority. | Transportation attorney |

## Business setup

| | Item | Why | Who to ask |
|---|---|---|---|
| **Before launch** | Company formed, EIN, Michigan registration, business bank account | Stripe, insurance, contracts and taxes are all in the company's name. | Accountant / attorney |
| Soon after | Register in each new state before launching there (and its sales tax if services are taxable) | Expansion to new cities means foreign qualification and, in some states, sales tax on services. | Accountant |
| Soon after | Local business licenses (City of Detroit and each city served) | Many cities license service businesses separately. | City clerk / accountant |
| **Before launch** | Trademark search and filing for the brand name | "Handled" is used by many companies — confirm we can use it for home services and file before spending on marketing. | Trademark attorney (USPTO search) |
| **Before launch** | Stripe account activated under the company (Connect enabled for pro payouts) | Live payments, payouts and the customer billing portal. | Owner — Stripe dashboard |
| **Before launch** | Apple and Google developer accounts under the company (D-U-N-S number for Apple) | The app must be published by the company, not a person. | Owner |
| Soon after | 1099-NEC filing process each January | Every pro paid $600+ in a year gets a 1099-NEC (export is in Hub → Finance). | Accountant |
