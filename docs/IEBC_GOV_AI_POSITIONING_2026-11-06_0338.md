<!--
FILE    : docs/IEBC_GOV_AI_POSITIONING_2026-11-06_0338.md
PROJECT : IEBC (IE Business Consultants) — AI automation firm for government contracts
CREATED : 2026-11-06_0338 UTC
PURPOSE : How to position IEBC and The Executive OS for federal, state and local AI-automation bids. Covers what to
          say, what to cut from the commercial deck, how to show proof, and the 90-day plan to the first award.
SOURCE  : IEBC_Executive_OS_Roster_Presentation (Build 3.0.0, May 17 2026), plus the Handled Hub's IEBC Workforce,
          approval queue and Gov contracts / Bid engine features in this repo.
STATUS  : Draft for Mark Odom. Have a government-contracts adviser or counsel review it before the first submission.
-->

# IEBC: positioning for government AI-automation contracts

## 1. The one-line position

> **IEBC builds and runs governed AI agent workforces for public agencies. Our agents do the back-office work, a
> named human signs off on every high-risk action, and every action is logged for audit.**

The commercial deck sells **autonomy**: "zero human touch," "takeover," "mathematical certainty." Government buyers
grade the opposite. Federal AI policy (OMB M-25-21 for use, M-25-22 for acquisition, and the 2026 OMB memo on
"unbiased AI principles" for LLM contracts) asks agencies to keep **human oversight**, **transparency**, **risk
management** and **no vendor lock-in**. State and city buyers copy these rules.

So the pitch changes from *"we replace your people"* to *"your people get capacity, and they stay in control."* The
engine is the same. The framing and the proof are different.

### Why IEBC can win this
1. **It already runs a live company.** Handled runs on IEBC agents today. Each agent has scoped permissions and an
   autonomy level (*suggest*, *act with approval*, *autonomous*). Price changes, payouts, cancellations and outbound
   email wait in a human approval queue. Every call to `/api/iebc/v1` is logged. That is the governance model
   agencies are asked to buy, and it is working in production, not on a slide.
2. **It's small and it delivers fast.** A 72-hour proof of concept (deck slide 20) is a real advantage against large
   integrators that take 9-month discovery phases. Keep it, but turn it into a defined **pilot**: fixed scope, fixed
   price, success measures agreed up front.
3. **It's local.** IEBC is based in Detroit. That opens HUBZone, Michigan GDBE and Detroit-Based Business preferences,
   which most AI vendors can't claim (see §5).

---

## 2. Rewrite the deck before an agency sees it

Some claims in the commercial deck are fine for a private-sector pitch but can sink a public bid. A false
certification in a federal proposal creates False Claims Act exposure. Unproven claims get an offer marked
"unacceptable" or bring a debrief that ends the relationship.

| Deck slide / claim | Risk in a government bid | Say this instead |
|---|---|---|
| **19: "FedRAMP High & IL5 Security"** | FedRAMP and IL authorizations are formal. Claiming them without being listed on the FedRAMP Marketplace is a misrepresentation. | "Deploys on FedRAMP-authorized infrastructure (AWS GovCloud / Azure Government) and inherits its controls. Our own authorization path is planned through FedRAMP 20x when a sponsor agency requires it." |
| **19: "pass strict DCAA auditing"** | DCAA audits contractors. A product can't "pass" DCAA. | "IEBC keeps a DCAA-ready accounting setup: timekeeping, segregated direct and indirect costs, and job-cost ledgers." Only say this once it's true. Xero plus a timekeeping tool can get there. |
| **8–17: 153 "agents" with human names and titles (Dr. Silas Vance, Commander Ethan Ross…)** | Evaluators will read them as **key personnel**. Fake résumés or titles in a proposal are a serious problem. | Present them as **software roles**: "Risk Analysis Agent (Node 036)." Name only real humans as key personnel: Mark Odom (CEO, Node 001 owner) and Cece Gulley (CSO). Add an "AI system disclosure" line to every proposal. |
| **17: "The Palantir Moat," Foundry / Gotham** | Uses another company's trademarks and implies a partnership. | Only if true: "Integrates with existing agency data platforms, including Palantir Foundry, via documented APIs." Otherwise remove it. |
| **4: "Hot-Plug Takeover Engine," "immediate operational takeover," "low-level network sockets"** | Reads as an unauthorized-access and security threat to a CISO. It fails the security review on sight. | "**Non-invasive integration**: read-only connectors first, then write access only to approved systems under the agency's ATO, with least-privilege service accounts." |
| **3: "absolute mathematical certainty," "deterministic"** | LLM output isn't deterministic. Evaluators know that, and it costs credibility. | "Measured accuracy with human review thresholds. Every output is scored, sampled and auditable." |
| **10: "Zero-Human-Touch Ledgers"** | Government finance needs separation of duties and certifying officers. | "Automated reconciliation with a human certifying official." |
| **11: "Psychometric Targeting"** | Raises privacy-law and Privacy Act concerns. | Remove it for public-sector work. |
| **13: "Linux Ring-0 Drivers"** and **16: "bare-metal GPU clusters"** | Out of scope and unproven, and it invites questions you don't want. | Remove it, or keep it for a later R&D (SBIR-type) pitch with real evidence. |
| **18: Athlete Management** | Off-message for government. | Keep it in a separate commercial deck. |
| **Contact: internal.recovery@…** | Looks like an internal or test inbox. | Use a dedicated address such as `gov@iebusinessconsultants.com`, plus a phone number and a named point of contact. |

---

## 3. What to offer: four lanes that match how agencies buy

Package the Executive OS as outcomes agencies already have budget lines for:

| Lane | What IEBC delivers | Typical buyers | Maps to deck |
|---|---|---|---|
| **A. Back-office automation** | Intake, triage, forms processing, document extraction, case routing, records clean-up. | City clerks, permitting, benefits, HR, procurement offices | Ops & Takeover (016–035), Shadow Ingestion |
| **B. Constituent service agents** | 24/7 Tier-1 and Tier-2 chat and email agents for 311 and service desks, with handoff to staff, multilingual. | Cities, counties, transit, utilities, state agencies | Client Care (081–100) |
| **C. Finance & audit automation** | Invoice audit, vendor reconciliation, grant reporting, improper-payment flags, human certification step. | Finance departments, IG offices, grant administrators | FinOps (036–055) |
| **D. Capture & proposal automation (B2B)** | Sell the bid engine and SAM.gov search to other small contractors. | Small businesses, primes' small-business offices | Gov Contracting (slide 19) |

Lane D is a commercial product, not a government contract, but it brings in early revenue and shows the tooling
works.

**Pricing that procurement offices accept:**
- **Fixed-price pilot:** 30–60 days with a defined scope.
- **Then a monthly managed service:** firm-fixed-price per month per workflow, or per transaction processed.

Avoid pure "per agent" pricing. Agencies can't evaluate it.

---

## 4. Registration and codes

**NAICS codes.** These are already IEBC's focus codes in Hub → Gov contracts:
- **541511** Custom computer programming
- **541512** Computer systems design
- **541519** Other computer services

Also register under these (add them in SAM.gov):
- **541611** Administrative management consulting
- **541690** Other scientific & technical consulting
- **518210** Computing infrastructure & data processing

Check the SBA size standard for each code. IEBC will be "small" for all of them.

**PSC codes.** Confirm them in the current PSC manual. Most likely:
- **DA01**: IT business application and application development support
- **R408**: program management support
- **R499**: other professional services

**Checklist:**
- [ ] SAM.gov entity registration → UEI (free, 2–4 weeks) and CAGE code. Renew every year.
- [ ] SBA Dynamic Small Business Search profile. Put the capability statement text in it, because contracting
      officers search it.
- [ ] Michigan: SIGMA VSS vendor registration (state), MITN/BidNet (local).
- [ ] Detroit: Office of Contracting & Procurement supplier portal, plus Detroit-Based Business certification.
- [ ] Insurance: professional liability / E&O and **cyber liability**. Agencies will ask for both.
- [ ] Written policies agencies request: AI use and acceptable-use policy, data handling and retention, incident
      response, model/vendor list (which LLMs, where hosted), bias and accuracy testing method.
- [ ] Accessibility: a Section 508 / WCAG 2.1 AA statement for any agent UI.

---

## 5. Set-aside and preference levers (check eligibility, then use every one you qualify for)

| Program | Why it matters for IEBC | Key test |
|---|---|---|
| **HUBZone (SBA)** | Large parts of Detroit are HUBZones. Agencies have a 3% federal goal and a 10% price-evaluation preference in open competitions. | Principal office in a HUBZone **and** 35% of employees living in one. |
| **8(a) (SBA)** | Sole-source awards up to the SBA thresholds. This is the fastest path to federal IT work. | Socially and economically disadvantaged owner, 2 years in business (waivable). |
| **WOSB / EDWOSB, SDVOSB** | Only if the ownership qualifies. Don't stretch this. | Ownership and control tests. |
| **Michigan GDBE** | State preference for businesses in geographically disadvantaged areas. | Located in a qualifying area. |
| **Detroit Business Certification** | City bids give equalization credits to Detroit-based, headquartered and resident businesses. | Detroit location and headcount. |

The Handled → IEBC revenue-share relationship and shared ownership affect size and affiliation rules. Confirm with
counsel how Handled counts before you certify size.

---

## 6. Proof: how to show past performance with no government contracts yet

1. **Handled case study (affiliate, disclose it).** "IEBC agents run dispatch, client care, compliance tracking and
   finance for a live multi-trade services company. X% of actions are handled by agents, with Y approvals a week
   from humans." The Hub's *AI-driven rate* KPI (`apps/web/lib/metrics.ts`) gives you the real numbers. Use those
   numbers, never estimates.
2. **One or two paying commercial clients outside Handled.** Get them before the first federal bid. Commercial past
   performance counts in most evaluations.
3. **A free or low-cost pilot with a Detroit-area city department or school district.** Under micro-purchase
   thresholds no formal bid is needed. This creates the first government reference.
4. **Subcontract to a prime.** Large integrators winning AI task orders need small, HUBZone or local subs. Use Hub →
   Gov contracts → *Awards* (recompete and sub-fit scores) to find who won AI work in Michigan, then contact their
   small-business liaison.

---

## 7. Contract vehicles (in order of effort)

1. **Micro-purchases and simplified acquisitions.** Card buys and quick quotes. Lowest effort, fastest cash.
2. **Sources-sought and RFI responses on SAM.gov.** Answer every AI one in your lane. This is how agencies decide to
   set work aside for small business.
3. **Subcontracts under primes** (see §6.4).
4. **State and local RFPs:** Michigan DTMB, Detroit, Wayne, Oakland and Macomb counties, and school districts.
5. **GSA Multiple Award Schedule (MAS) under SIN 54151S IT Professional Services.** Once you have 2 years of
   financials or use the startup-springboard option. Being on schedule makes IEBC easy to buy.
6. **Innovation pathways:** Commercial Solutions Openings, DIU, AFWERX, and SBIR/STTR where authorized (check its
   current reauthorization status). These suit the R&D-style claims (GPU, inference) once you have evidence.
7. **Large IDIQs (OASIS+ small-business pools, agency BPAs).** Year 2+, with past performance.

---

## 8. 90-day plan to the first award

| Days | Action | Done when |
|---|---|---|
| 1–7 | Rewrite the deck per §2. Finish the capability statement (`IEBC_CAPABILITY_STATEMENT_2026-11-06_0338.pdf`). Start SAM.gov registration. | Clean government deck and capability statement exist; SAM registration submitted |
| 1–14 | Write the 5 policies in §4 (AI use, data, incident response, model list, testing). | PDFs in the bid library |
| 7–21 | Pull Handled's real AI-driven-rate numbers into a 1-page case study. | Case study in the bid library |
| 7–30 | Check HUBZone, Michigan GDBE and Detroit certification eligibility; apply for each one that fits. | Applications filed |
| 14–45 | Switch on daily SAM.gov search (AI codes) in Hub → Gov contracts. Answer every sources-sought notice in lanes A–C. | 5+ RFI responses sent |
| 14–60 | Pitch a fixed-price 30-day pilot to 10 Detroit-area departments and districts. | 1 pilot signed |
| 30–90 | Contact the small-business liaisons at 5 primes holding Michigan AI or IT awards. | 1 teaming agreement |
| 60–90 | Bid 2–3 well-fitting small-business set-asides through Hub → Bids (go/no-go first). | First award or a debrief to learn from |

---

## 9. Proposal language to reuse

**Technical approach opener:**
> IEBC deploys a governed AI agent workforce that takes on defined, repetitive workflows while agency staff keep
> decision authority. Each agent has a written role, scoped system permissions and an autonomy level set by the
> agency. Actions above a risk threshold (payments, eligibility decisions, outbound communications to the public,
> record changes) are held in an approval queue for a named official. Every agent action is logged with inputs,
> outputs and the approving user, and those logs are exportable for audit and FOIA review.

**AI disclosure (include in every proposal):**
> IEBC's solution uses large language models from [provider(s)], hosted in [region / GovCloud]. Agency data is not
> used to train third-party models. IEBC will provide the model information the agency needs under applicable OMB
> guidance, including documentation that supports the agency's review of the unbiased AI principles for LLMs.

**Risk and quality:**
> Accuracy is measured, not assumed. We set acceptance thresholds with the agency during the pilot. Outputs are
> sampled for human review at a rate tied to the risk of the workflow, and any agent whose measured accuracy falls
> below threshold is moved back to "suggest only" until it is corrected.

---

*Sources for the policy references: OMB M-25-21 and M-25-22 (April 2025), and OMB's 2026 memo on LLM procurement
and the unbiased AI principles, as reported by ExecutiveGov and others. Read the current OMB text before quoting it in
a proposal, because this guidance changes often.*
