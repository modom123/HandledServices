<!--
  FILE    : docs/STATE_CONTRACTS_NY_NJ_NV_2026-11-06_0311.md
  PROJECT : Handled (HandledServices) — AI-run home & business services
  CREATED : 2026-11-06_0311 UTC
  PURPOSE : Review packet for the New York, New Jersey and Nevada contract drafts: what each one says, how the app
            attaches it, what a lawyer must confirm, and what the app must do before the promises in them are true.
            The full text of all six addenda is at the end (English; Spanish in CONTRATOS_ES_*.md).
-->
# State contracts: New York, New Jersey and Nevada (drafts)

**These are drafts, not legal advice.**
- Have a lawyer licensed in each state review them before you take bookings or approve pros there.
- Every `[Confirm with counsel.]` marks a specific point to check. The whole text needs review, not just those points.

## What was drafted

| Contract | Who | Attached when | Main points |
|---|---|---|---|
| **Addendum — New York** | Customers | The service address is in NY (ZIPs 100–149) | NY law and courts. Home improvement written contract (over $500) with the GBL §771 items. **3-business-day right to cancel.** Deposits held as trust funds (Lien Law). NYC and Nassau/Suffolk/Westchester/Rockland/Putnam home improvement licenses. NY sales tax and ST-124. Auto-renewal and SHIELD Act. Complaint agencies. |
| **Addendum — New Jersey** | Customers | NJ address (070–089) | NJ law and courts. **Arbitration waiver stated plainly** (Atalese). Contractors' Registration Act contract terms (registration number, insurance certificate, dates, materials). **The statutory notice of the right to cancel, in capitals.** No final payment before completion. NJ sales tax and ST-8. **TCCWNA list** of the clauses that don't apply to NJ consumers. |
| **Addendum — Nevada** | Customers | NV address (889–898) | NV law and courts. NSCB license number, classification and limit on the work order. Handyman exemption (under $1,000, no permit, not part of a larger job). Residential Recovery Fund notice. Pest control license. No sales tax on most services. |
| **New York Addendum (pros)** | Pros | Pro's profile/business state is NY, or any covered ZIP is in NY | **Freelance Isn't Free Act** (state and NYC): the agreement plus work order is the written contract. Paid Mondays and **never later than 30 days** after the job. No retaliation. 6-year records. NY law and courts. NYC DCWP and county home improvement licenses, trade licenses, DEC pesticide certification. Workers' comp and DBL/PFL, or the CE-200 exemption. |
| **New Jersey Addendum (pros)** | Pros | Same, for NJ | **ABC test**: the pro confirms they run an independent business (BRC, insurance, tools, other customers, can decline). Employee protections preserved if NJ law applies. **HIC registration and $500k CGL.** Master plumber, electrical, HVACR and DEP pesticide licenses, and RRP. No non-emergency start inside the 3-day cancel window. NJ law and courts. |
| **Nevada Addendum (pros)** | Pros | Same, for NV | State Business License plus county/city licenses. **NSCB license: classification and limit.** Handyman limits (no splitting jobs). Agriculture pest license. NRS 608.0155 independent-contractor presumption points. Heat safety (you can cancel without penalty). NV law and courts. |

**How it's attached** (`apps/web/lib/contracts/index.ts`):
- `bookingContracts(slug, business, zip)` adds the customer addendum for the service address. It's recorded with the booking, and its content hash is stored.
- The booking page links it next to the agreement checkbox, and the invoice prints it.
- `proSigningSet(trades, where)` adds a pro addendum for every new state the pro is based in or covers. They're signed with the Pro Agreement in onboarding.
- Michigan and Washington customers and pros see no change.
- **Spanish:** all six are translated (`es-state.ts`). English controls. The NJ cancellation notice says its English wording controls.
- **Placeholders:** the NJ text pulls `BUSINESS_POSTAL_ADDRESS` and `NJ_HIC_REGISTRATION` from Vercel. Set both before NJ goes live; until then the text points to the confirmation and work order instead.

## What the app doesn't do yet (needed before these promises are true)

These are promises in the drafts that the code doesn't yet enforce. Fix each one, or soften the wording, before launch.

1. **3-day right to cancel (NY and NJ home improvement):**
   - The current cancel rule keeps a late-cancel fee inside 24 hours. For NY/NJ home improvement bookings, the refund must be full within 3 business days of booking.
   - Scheduling should also prevent a non-emergency start inside that window.
2. **NY trust funds:** deposits for NY home improvement must sit in a separate trust or escrow account (or meet a bonding alternative). This is a banking and Stripe setup question for the accountant and lawyer.
3. **Work orders:** they must show pro and Handled license or registration numbers (NYC DCWP, NJ HIC, NSCB number, classification and limit). NJ customers must also get the insurance certificate and insurer phone number.
4. **Dispatch and vetting:**
   - Offer NYC/county home improvement jobs only to pros with the matching license.
   - Offer NJ home improvement jobs only to registered pros with $500k CGL.
   - Offer NV jobs only within the pro's NSCB classification and limit, or under the $1,000 handyman line.
5. **Freelance Isn't Free (NY):** check that no payout is ever held more than 30 days after job completion (dispute holds, clawbacks, reviews).
6. **Tax forms:** add a way to collect NY ST-124 and NJ ST-8 for capital-improvement jobs, and turn on Stripe Tax before NY/NJ bookings.
7. **Pros who add a state later:** a pro who already signed and later adds NY/NJ/NV ZIPs isn't asked to sign the new state addendum. Add a re-sign prompt when service ZIPs change.
8. **Handled's own registrations:** NYC DCWP and county HIC licenses, NJ HIC registration, the NV State Business License and local licenses, and NSCB if Handled contracts for licensed work itself (see `NEW_MARKETS_NY_NJ_LAS_VEGAS_2026-11-06_0234.md`).

## Questions for the lawyer

- **NY:** Is Handled itself the "home improvement contractor" for GBL §771 and DCWP purposes, or is the pro? How should the Lien Law §71-a trust requirement work with card payments through Stripe?
- **NJ:** Does the cancellation notice match the exact statutory and regulatory wording and type size? Is the TCCWNA list complete for every clause in our Terms of Use and Service Agreement? How strong is the ABC-test position for the marketplace model, and what else should change?
- **NV:** Does Handled need an NSCB license to sell licensed work through the platform? What residential contract disclosures apply by job type (pools and spas especially)? Is the handyman exemption wording right?
- **All three:** Is it enough to rely on the base arbitration clause plus these addenda, or should the base agreements' governing-law sections be rewritten?

---

# Full text of the six addenda (English)
## Addendum — New York

Version 2026-11-v1 · Customers · Every booking for work at an address in New York State, homes and businesses.

### The short version
- New York law and New York courts apply to jobs in New York.
- Home improvement jobs get a written contract with the details New York requires, and you can cancel within 3 business days of signing.
- Money you pay before home improvement work is finished is held as the law requires until the work is done.
- In New York City and in Nassau, Suffolk, Westchester, Rockland and Putnam counties, home improvement work is done under the required home improvement licenses.
- New York sales tax is added to taxable services (like cleaning, lawn care, snow removal, pest control and repairs). Capital improvements aren't taxed.
- Recurring plans tell you the price and how often you're charged, and you can cancel any time online.

### 1. How this addendum works
This addendum adds to our Terms of Use, the Service Agreement and, for business bookings, the Business Services Agreement, for every job performed at an address in New York. If they conflict, this addendum controls for those jobs.

New York law gives you rights that no agreement can take away. Nothing in our agreements limits them.

### 2. New York law and courts
New York law governs each job performed at a New York address, apart from federal law.

The dispute resolution section of our Terms of Use still applies, including talking first, individual arbitration and your right to opt out. Small claims court is always available. If a dispute about a New York job goes to court, it is heard in the New York county where the work was done.

### 3. Home improvement work: your written contract
"Home improvement" means repairing, remodeling, altering, converting or modernizing a home or the land around it: for example carpentry, painting, roofing, siding, flooring, fences, decks, concrete, masonry, windows and doors, and remodels. It does not include cleaning, lawn care or other upkeep that doesn't change the home.

For a home improvement job priced over $500, your booking confirmation and work order are your written contract. Together they show:

• The names, addresses and license numbers of Handled Services LLC and your pro (where a license is required).
• The approximate start date and completion date.
• A description of the work and the main materials, with their brand or grade where it matters.
• The price and when each payment is due: the part you pay when you book, and the rest when the job is done.
• Your right to cancel (next section).

Changes to a home improvement job are made only by a written change order that you approve in the app before the extra work starts. [Confirm with counsel.]

### 4. Your right to cancel a home improvement contract
You may cancel a home improvement contract without any penalty or obligation within three business days after you sign it (after you book and receive your confirmation).

To cancel, use "Cancel" on the booking in My bookings, email info@handledsvc.com, or mail a signed and dated note to Handled Services LLC at the address on your confirmation. If you cancel within the three business days, we refund everything you paid within 10 business days.

Your pro won't start non-emergency home improvement work during those three days unless you ask in writing for it to start sooner. [Confirm with counsel.]

### 5. Payments before home improvement work is finished
New York treats money paid before home improvement work is finished as trust funds. Any part of the price you pay before the job is complete is held in a separate account (or protected as the law otherwise allows) and used only for your job, until the work is done or the money is refunded. [Confirm with counsel.]

You pay the rest of the price only after the work is done and you've seen the photo check-out.

### 6. Licenses in New York City and nearby counties
In New York City, home improvement work is sold and done under a home improvement contractor license from the NYC Department of Consumer and Worker Protection (DCWP). Nassau, Suffolk, Westchester, Rockland and Putnam counties have their own home improvement licenses. Handled only sends home improvement jobs in those places to pros who hold the license that applies, and we show the license numbers on your work order. [Confirm with counsel.]

Plumbing, electrical and other licensed trades are done only by pros licensed where the work is performed, with permits where the law requires them.

### 7. Sales tax
New York sales tax, at the rate for the job's address, is added to services New York taxes. These include cleaning and maintenance of buildings, lawn and landscape maintenance, snow removal, pest control, and repairs to items you own.

Capital improvements (work that adds to your home's value or life and becomes a permanent part of it) aren't taxed. You may be asked to sign a Certificate of Capital Improvement (Form ST-124) for that work. Tax is shown on your quote and invoice.

### 8. Recurring plans
If you choose a recurring plan, we tell you the price and how often you'll be charged before you confirm, and send a reminder before the plan renews if it renews for a longer term. You can cancel any time in My bookings, with no phone call needed.

### 9. Your information
We protect your personal information with reasonable security safeguards, and we'll tell you if a data breach affects you, as New York's SHIELD Act requires.

### 10. Complaints
Please tell us first at info@handledsvc.com or (313) 639-9373. You can also contact the New York State Attorney General's Bureau of Consumer Frauds and Protection, or, in New York City, the Department of Consumer and Worker Protection (call 311).

---

## Addendum — New Jersey

Version 2026-11-v1 · Customers · Every booking for work at an address in New Jersey, homes and businesses.

### The short version
- New Jersey law and New Jersey courts apply to jobs in New Jersey.
- Home improvement jobs over $500 get a written contract with everything New Jersey requires, including the registration number and insurance details.
- You can cancel a home improvement contract until midnight of the third business day after you receive it, for a full refund.
- You never pay the final amount before the work is done.
- New Jersey sales tax is added to taxable services. Capital improvements are exempt with Form ST-8.
- This addendum names the parts of our terms that don't apply to New Jersey consumers.

### 1. How this addendum works
This addendum adds to our Terms of Use, the Service Agreement and, for business bookings, the Business Services Agreement, for every job performed at an address in New Jersey. If they conflict, this addendum controls for those jobs.

New Jersey law gives you rights that no agreement can take away. Nothing in our agreements limits them.

### 2. New Jersey law and courts
New Jersey law governs each job performed at a New Jersey address, apart from federal law.

If a dispute about a New Jersey job goes to court, it is heard in the Superior Court of New Jersey for the county where the work was done. Claims within its limits can go to the Special Civil Part (Small Claims).

### 3. Arbitration: what you're agreeing to
Our Terms of Use ask that disputes go to binding individual arbitration, unless you opt out within 30 days. Please read it carefully: if you don't opt out, you give up your right to have a dispute decided in court by a judge or jury. Instead, a neutral arbitrator decides it. You can still use small claims court.

### 4. Home improvement work: your written contract
"Home improvement" means remodeling, altering, repairing, painting, renovating or modernizing a home or residential property: for example carpentry, roofing, siding, flooring, fences, decks, driveways, concrete, masonry, windows and doors, and remodels.

Every company that sells or performs home improvement work in New Jersey must be registered with the New Jersey Division of Consumer Affairs. Handled Services LLC's and your pro's registration numbers are on your work order. [Confirm with counsel.]

For a home improvement job priced over $500, your booking confirmation and work order are a written contract signed by you (when you book) and by us. Together they show:

• The legal name, business address and registration number of Handled Services LLC and of your pro.
• The start date and completion date.
• A description of the work and the products and materials, with their brand, model or grade where that applies.
• The total price, including any finance charges (we don't charge any).
• A copy of the certificate of commercial general liability insurance, and the insurer's phone number.
• Your right to cancel, in the words the law requires (next section).

Any change to the work, price or dates is made only by a written change order that you approve in the app before the extra work starts. [Confirm with counsel.]

### 5. Notice of your right to cancel
YOU MAY CANCEL THIS CONTRACT AT ANY TIME BEFORE MIDNIGHT OF THE THIRD BUSINESS DAY AFTER RECEIVING A COPY OF THIS CONTRACT. IF YOU WISH TO CANCEL THIS CONTRACT, YOU MUST EITHER:

• SEND A SIGNED AND DATED WRITTEN NOTICE OF CANCELLATION BY REGISTERED OR CERTIFIED MAIL, RETURN RECEIPT REQUESTED; OR
• PERSONALLY DELIVER A SIGNED AND DATED WRITTEN NOTICE OF CANCELLATION TO: HANDLED SERVICES LLC, AT THE MAILING ADDRESS ON YOUR CONFIRMATION, (313) 639-9373.

IF YOU CANCEL THIS CONTRACT WITHIN THE THREE-DAY PERIOD, YOU ARE ENTITLED TO A FULL REFUND OF YOUR MONEY. REFUNDS MUST BE MADE WITHIN 30 DAYS OF OUR RECEIPT OF THE CANCELLATION NOTICE.

You can also cancel in My bookings or by emailing info@handledsvc.com; we accept those too. [Confirm with counsel.]

### 6. Payments and completion
You pay part of the price when you book and the rest only when the work is finished and you've seen the photo check-out. We never ask for final payment before the work is complete, including any inspections the permit requires.

Where a job needs a building permit, the pro (or we) gets it before work starts, and the job is not complete until it passes the required inspections.

### 7. Sales tax
New Jersey sales tax (6.625%, or the reduced rate where it applies) is added to services New Jersey taxes. These include cleaning and janitorial services, landscaping and lawn care, repairs and maintenance of property, and pest control.

Capital improvements to real property are exempt when you give us a completed Certificate of Exempt Capital Improvement (Form ST-8). Tax is shown on your quote and invoice.

### 8. Parts of our terms that don't apply to New Jersey consumers
If you're a New Jersey consumer, these parts of our agreements do not apply to you, to the extent New Jersey law doesn't allow them:

• In the Terms of Use, "Limits on our liability": the exclusion of punitive damages, and any limit on our liability for our own negligence that New Jersey law doesn't permit.
• In the Service Agreement, "Property damage": the cap on our liability at the amount you paid, where the damage was caused by our or the pro's negligence.
• In the Terms of Use, "Your responsibility for misuse": any duty to pay our legal fees, except as a court or arbitrator orders under New Jersey law.

Everything else in our agreements applies. [Confirm with counsel.]

### 9. Complaints
Please tell us first at info@handledsvc.com or (313) 639-9373. You can also contact the New Jersey Division of Consumer Affairs.

---

## Addendum — Nevada

Version 2026-11-v1 · Customers · Every booking for work at an address in Nevada (we currently serve the Las Vegas area), homes and businesses.

### The short version
- Nevada law and Clark County courts (or the county where the work was done) apply to jobs in Nevada.
- Work that needs a Nevada contractor's license is done only by pros licensed by the Nevada State Contractors Board, within their license limit.
- Homeowners may be able to get help from the Contractors Board's Residential Recovery Fund.
- Nevada doesn't tax most services. Items and materials sold to you are taxed at the local rate.
- Pest control is done only by pros licensed by the Nevada Department of Agriculture.

### 1. How this addendum works
This addendum adds to our Terms of Use, the Service Agreement and, for business bookings, the Business Services Agreement, for every job performed at an address in Nevada. If they conflict, this addendum controls for those jobs.

Nevada law gives you rights that no agreement can take away. Nothing in our agreements limits them.

### 2. Nevada law and courts
Nevada law governs each job performed at a Nevada address, apart from federal law.

The dispute resolution section of our Terms of Use still applies, including talking first, individual arbitration and your right to opt out. Small claims court (Justice Court) is always available. If a dispute about a Nevada job goes to court, it is heard in the county where the work was done, such as Clark County.

### 3. Licensed contractor work
In Nevada, most construction, repair and improvement work needs a license from the Nevada State Contractors Board (NSCB). The license has a monetary limit: the largest job the contractor may take.

On a job that needs a license, your work order shows the pro's NSCB license number and classification. We only send it to a pro whose license covers that kind of work and whose limit covers the price.

Small jobs that Nevada law lets an unlicensed handyman do may be done by a pro without a contractor's license. That generally means jobs under $1,000 in total for labor and materials, that need no building permit and aren't part of a larger project. [Confirm with counsel.]

Where a building permit is required, the pro gets it before work starts.

### 4. Residential work: the Recovery Fund and your written contract
If you hire a licensed contractor to work on your own home, the Nevada State Contractors Board's Residential Recovery Fund may help you if the contractor doesn't do the work properly. You can learn about it at nscb.nv.gov or by calling the Board.

For residential work that needs a license, your booking confirmation and work order are your written contract. They show the contractor's name, license number and limit, a description of the work, the price, the payment schedule, and the start and completion dates, along with any other notices Nevada requires for that kind of work (for example, pools and spas). [Confirm with counsel.]

Changes are made only by a written change order that you approve in the app before the extra work starts.

### 5. Pest control and other licensed services
Pest control is done only by pros licensed by the Nevada Department of Agriculture. Other services that need a Nevada license or certificate are done only by pros who hold it.

### 6. Taxes
Nevada doesn't charge sales tax on most services. Items and materials sold to you as part of a job are taxed at the rate for the job's address (Clark County's rate for the Las Vegas area). Tax is shown on your quote and invoice.

### 7. Complaints
Please tell us first at info@handledsvc.com or (313) 639-9373. You can also contact the Nevada State Contractors Board (for contractor work) or the Consumer Affairs Unit of the Nevada Department of Business and Industry.

---

## New York Addendum (pros)

Version 2026-11-v1 · Pros (contractors) · Pros who live in New York, are based there, or take jobs at New York addresses. Signed with the Pro Agreement.

### The short version
- The Pro Agreement and each work order together are your written contract under New York's Freelance Isn't Free Act.
- You're paid every Monday for approved work, and never later than 30 days after you finish a job.
- New York law and the courts where you live or work apply.
- Home improvement jobs in New York City and in Nassau, Suffolk, Westchester, Rockland and Putnam counties need the local home improvement license.
- If you have employees, you carry New York workers' compensation and disability and paid family leave coverage.

### 1. How this addendum works
This addendum adds to the Pro Agreement and its policies for any pro who lives in New York, is based there, or takes jobs there. If they conflict, this addendum controls for that work.

New York law gives you protections that no agreement can take away. Nothing in our agreements limits them.

### 2. Your written contract (Freelance Isn't Free Act)
New York State's Freelance Isn't Free Act, and New York City's law of the same name, protect freelancers paid $800 or more, for one job or for jobs together over 120 days. For every job you do in New York, the Pro Agreement and the job's work order are your written contract. Together they show:

• The names and mailing addresses of you and Handled Services LLC.
• An itemized list of the work (the work order's scope).
• What you'll be paid and how (your payout on the work order, with any tips, show-up pay or bonuses).
• When you'll be paid: the Monday payout after the job is checked and approved.
• When you must finish your part to be paid on that date: completing the job in the app with the check-out photos.

You can download a copy of everything you've signed, and every work order, from the Pro portal at any time. We keep these records for at least six years.

### 3. Paying you on time
Approved work is paid every Monday, as the Pro Agreement says. No payment for completed work is ever made later than 30 days after you complete the job, even while a customer issue is being reviewed. If a review is still open on day 30, we pay you and settle any adjustment afterwards under the Pro Agreement.

We will never make getting paid on time depend on you accepting less money, agreeing to work only through Handled, or giving up any right. We won't penalize, threaten or deactivate you for asserting your rights under these laws, or for filing a complaint. [Confirm with counsel.]

### 4. New York law and courts
If you live or work in New York, New York law governs the Pro Agreement for that work, apart from federal law. If anything goes to court, it is heard in the New York county where you live or work. The arbitration section of the Pro Agreement still applies unless you opted out, and nothing in it stops you from filing a complaint with the New York State Department of Labor or the NYC Department of Consumer and Worker Protection.

### 5. Licenses
Before you take these jobs, upload your license to the Pro portal:

• Home improvement in New York City: a home improvement contractor license from the NYC Department of Consumer and Worker Protection.
• Home improvement in Nassau, Suffolk, Westchester, Rockland or Putnam counties: that county's home improvement license.
• Plumbing, electrical and other licensed trades: the license required where the work is done (for example, a New York City master plumber or electrician license from the Department of Buildings).
• Pest control: certification as a commercial pesticide applicator from the New York State Department of Environmental Conservation, working for a registered business.

Don't accept a job that needs a license you don't hold. Show your license number on the work order where the law requires it. [Confirm with counsel.]

### 6. Workers' compensation and disability coverage
If you have employees or helpers on New York jobs, you must carry New York workers' compensation and disability and paid family leave insurance for them, and upload proof. If you work alone with no employees, you can file the New York exemption form (CE-200) instead, which home improvement licenses also ask for.

### 7. Sales tax on your jobs
Handled collects New York sales tax from the customer where it applies. Don't charge the customer tax yourself on Handled jobs.

---

## New Jersey Addendum (pros)

Version 2026-11-v1 · Pros (contractors) · Pros who live in New Jersey, are based there, or take jobs at New Jersey addresses. Signed with the Pro Agreement.

### The short version
- You run your own independent business: your own registration, insurance, tools, hours and other customers.
- Home improvement work in New Jersey needs your own registration with the Division of Consumer Affairs and at least $500,000 of general liability insurance.
- Plumbing, electrical, HVAC and pest control need the New Jersey license for that trade.
- Home improvement customers have 3 business days to cancel, so don't start non-emergency work before then unless they ask in writing.
- New Jersey law and the courts where you live or work apply. If New Jersey law treats you as an employee for any purpose, you get those protections.

### 1. How this addendum works
This addendum adds to the Pro Agreement and its policies for any pro who lives in New Jersey, is based there, or takes jobs there. If they conflict, this addendum controls for that work.

New Jersey law gives you protections that no agreement can take away. Nothing in our agreements limits them.

### 2. Your independent business
New Jersey uses a strict test to decide whether someone is an independent contractor. You are one only if you are free from our control over how you do the work, and you run an independently established business of your own. For work in New Jersey, you confirm and agree that:

• You decide how, when and whether to do each job. You can decline any offer, set your own hours and days off, and choose your methods, within the customer's scope and the law.
• You run your own business. You hold a New Jersey Business Registration Certificate (or the registration your business type needs), and you keep it current.
• You offer your services to the public and are free to work for other customers and platforms, including competitors.
• You use your own tools, equipment and vehicle, and you carry your own insurance.
• You can hire helpers or employees, at your cost and responsibility.

Handled runs a marketplace that connects customers with independent service businesses. We don't supervise how you do the work beyond the customer's scope, safety rules and the quality check the customer is promised.

If a court or agency decides that New Jersey law treats you as an employee for any purpose (for example, unemployment insurance or wage payment), you get the protections that law gives for that purpose, and nothing in our agreements waives them. [Confirm with counsel.]

### 3. Home improvement registration and insurance
To do home improvement work on residential property in New Jersey (for example carpentry, painting, roofing, siding, flooring, fences, decks, concrete, masonry, windows and doors, and remodels), you must:

• Be registered as a home improvement contractor with the New Jersey Division of Consumer Affairs, and upload your registration number.
• Carry commercial general liability insurance of at least $500,000 per occurrence, and upload the certificate. Customers receive a copy with their contract.
• Put your registration number on your work orders, invoices and any advertising.

Handled only offers you home improvement jobs in New Jersey once your registration and insurance are verified. [Confirm with counsel.]

### 4. Licensed trades
These need a New Jersey license or certification before you take the job, uploaded to the Pro portal:

• Plumbing: a New Jersey master plumber license (State Board of Master Plumbers), or working under one.
• Electrical: a New Jersey electrical contractor license, or working under one.
• Heating, ventilation, air conditioning and refrigeration: a New Jersey HVACR contractor license.
• Pest control: New Jersey Department of Environmental Protection pesticide applicator certification, working for a licensed business.
• Work that disturbs paint in homes built before 1978: EPA lead-safe (RRP) certification.

### 5. Home improvement contracts and the right to cancel
New Jersey home improvement customers get a written contract and can cancel until midnight of the third business day after receiving it. The app gives the customer the contract and the cancellation notice when they book.

• Don't start non-emergency home improvement work before the cancellation period ends, unless the customer asks in writing for it to start sooner.
• Make every change to the work, price or dates through a change order the customer approves in the app before you do the extra work. Never agree to changes off the app.
• Get the permits the job needs before you start, and don't treat the job as complete until any required inspections pass.

[Confirm with counsel.]

### 6. New Jersey law and courts
If you live or work in New Jersey, New Jersey law governs the Pro Agreement for that work, apart from federal law. If anything goes to court, it is heard in the Superior Court of New Jersey for the county where you live or work. The arbitration section of the Pro Agreement still applies unless you opted out. By not opting out, you give up your right to have a dispute decided in court by a judge or jury. Nothing in it stops you from filing a complaint with the New Jersey Department of Labor and Workforce Development.

### 7. Sales tax on your jobs
Handled collects New Jersey sales tax from the customer where it applies. Don't charge the customer tax yourself on Handled jobs.

---

## Nevada Addendum (pros)

Version 2026-11-v1 · Pros (contractors) · Pros who live in Nevada, are based there, or take jobs at Nevada addresses. Signed with the Pro Agreement.

### The short version
- You need a Nevada State Business License and the local business license for where you work (for example Clark County, Las Vegas, Henderson or North Las Vegas).
- Construction and repair work needs a Nevada State Contractors Board license. Don't take a job above your license's limit or outside its classification.
- Without a contractor's license, only small handyman jobs are allowed (generally under $1,000 in total, no permit, and not part of a larger project).
- Pest control needs a Nevada Department of Agriculture license.
- You run your own independent business. Nevada law and the courts where you live or work apply.

### 1. How this addendum works
This addendum adds to the Pro Agreement and its policies for any pro who lives in Nevada, is based there, or takes jobs there. If they conflict, this addendum controls for that work.

Nevada law gives you protections that no agreement can take away. Nothing in our agreements limits them.

### 2. Business licenses
To do business in Nevada, you need a Nevada State Business License from the Secretary of State (unless your business is exempt), and the business license for the city or county where you work: for example Clark County, the City of Las Vegas, Henderson or North Las Vegas. Upload them to the Pro portal and keep them current.

### 3. Contractor's license and its limits
Most construction, repair and improvement work in Nevada needs a license from the Nevada State Contractors Board (NSCB), in the classification for that work. Your license also has a monetary limit: the largest job you may take.

• Upload your NSCB license number, classification and limit. Your work orders show them.
• Don't accept a job outside your classification or priced above your limit.
• Without an NSCB license, you may only do small handyman jobs that Nevada law allows. That generally means jobs under $1,000 in total for labor and materials, that need no building permit and aren't part of a larger project. Don't split a larger job into small ones, and don't advertise yourself as a contractor.
• Get the permits the job needs before you start.

[Confirm with counsel.]

### 4. Other licensed services
Pest control needs a license from the Nevada Department of Agriculture, and you must work for a licensed business. Pool and spa work, landscaping contracting and other specialty work need the NSCB classification for that work when the job is above the handyman limit. Upload every license before you take those jobs.

### 5. Your independent business
Nevada law presumes you're an independent contractor when you hold the registrations your business needs and meet the conditions in Nevada law. For work in Nevada, you confirm and agree that:

• You control how you do the work, your hours and which jobs you accept, within the customer's scope and the law.
• You're free to work for others, including other platforms and your own customers. Handled doesn't require you to work only through us.
• You can hire employees or helpers, at your cost and responsibility.
• You provide your own tools, equipment and vehicle, and you have the business registrations and licenses this addendum lists.

If a court or agency decides that Nevada law treats you as an employee for any purpose, you get the protections that law gives for that purpose. [Confirm with counsel.]

### 6. Heat safety
Las Vegas summers are dangerous for outdoor work. Plan outdoor jobs for cooler hours where the customer allows, bring water, take shade breaks, and stop if you or a helper shows signs of heat illness. If you have employees, Nevada's heat illness rules for employers apply to you. You can move or cancel a job for dangerous heat without any penalty.

### 7. Nevada law and courts
If you live or work in Nevada, Nevada law governs the Pro Agreement for that work, apart from federal law. If anything goes to court, it is heard in the county where you live or work, such as Clark County. The arbitration section of the Pro Agreement still applies unless you opted out. Nothing in it stops you from filing a complaint with the Nevada Labor Commissioner.

### 8. Taxes on your jobs
Nevada doesn't tax most services. Handled collects any sales tax due on materials sold to the customer. Don't charge the customer tax yourself on Handled jobs.
