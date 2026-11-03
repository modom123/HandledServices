<!--
FILE    : docs/RFI_550595_HOUSING_HELPLINE_EVALUATION_2026-11-03_0709.md
PROJECT : Handled (HandledServices) — AI-run home & business services
CREATED : 2026-11-03_0709 UTC
PURPOSE : Go/no-go look at City of Detroit RFI 550595 (Detroit Housing Resource Helpline) for IEBC and Handled Services.
SOURCES : 550595_RFI.pdf and RFI_Attachment_A.pdf (Respondent Questionnaire, rev. 8/22/23), as uploaded.
-->
# RFI 550595: Detroit Housing Resource Helpline. Is there an opportunity?

## Bottom line
**Yes, respond, but only as positioning. Don't expect to win the call-center contract.**

- **It is an RFI, not a bid.** The City says no contract will come from it, and responses are "information only." The City will use what it learns to write the real RFP(s).
- **Responding costs little and gets the business known before the RFP.** It puts you on the City's radar and lets you shape the requirements before they are fixed.
- **Neither company can lead (prime) the RFP that follows.** The City asks for 3 references for similar work in the last 5 years, call-center experience in social services, 99.99% uptime and SOC 2. Neither IEBC nor Handled can show those today.
- **The realistic wins:**
  - **IEBC** as the AI and technology partner of an established call-center operator.
  - **Handled Services** as a provider of housing-stabilization services that the Helpline refers residents to.

## What the City wants (summary)
| Item | Detail |
|---|---|
| Volume | 100,000+ calls in 2025. The City plans for about 120,000 a year, with peak days of about 1,500. |
| Two tracks (answer one or both) | **Operations:** staffing and running the call center. **Technology/Integration:** IVR, CRM/case management, messaging, reporting. |
| Hours | Mon–Fri 8am–6pm and Sat 9am–12pm, with routing to an after-hours emergency line. The existing number, 866-313-2520, must stay. |
| Languages | English, Spanish, Arabic and Bengali at minimum. |
| Integrations | Smartsheet, Snowflake, Tableau, Salesforce, Google, Corteza/Pathways, SeeClickFix, Accela. |
| Outreach | Text, email and robocalls. Follow-up for after-hours callers. Resource inventory sent by text or email. |
| Change speed | Screening-logic changes within 7 days (non-emergency) or 24 hours (emergency). |
| Reliability | 99.99% uptime, 15-minute RTO, 30-minute RPO, data centers in different regions, DR tested every year. |
| Security | MFA, least privilege, encryption at rest and in transit, pen testing, searchable audit logs, US data residency, SOC 2 reporting. |
| AI | Every AI feature needs a **City AI Factsheet**: human oversight, bias controls, logging, and the ability to switch AI off. |
| Wait time | Initial wait of no more than 5 minutes. |
| Attachment A | Standard OCP questionnaire: contacts, FEIN, entity, years in business, headcount, City contracts, lawsuits, **3 references (5 years)**, subcontractor references. |

**Due date: the uploaded files don't give one.** Look up RFI 550595 on the City's OCP / Supplier Portal (Bids & Tabulations) to find the deadline and the submission method.

## Size of the prize (rough estimates, not from the RFI)
- **Traffic:** about 53 operating hours a week, roughly 2,750 hours a year.
  - Average: about 44 calls an hour.
  - Peak day: 1,500 calls in 10 hours is about 150 calls an hour.
- **Staffing:** assuming a 10–12 minute screening call:
  - About 10–12 agents on an average day.
  - About 30–35 agents on peak days, plus supervisors and QA.
- **Operations contract:** social-service helplines often run about $15–30 per handled call. That suggests **about $1.8M–$3.6M a year**.
- **Technology track:** platform, IVR, integrations and AI is probably **$150K–$500K to implement**, plus licenses and support each year.

## Fit: IEBC
| Strength | Gap |
|---|---|
| AI-workforce story fits the Technology track: AI intake, call summaries, agent assist, after-hours text and callback follow-up, multilingual IVR. | No public-sector contact-center references. The RFP will ask for 3. |
| Already bidding Detroit OCP work (RFP 550575 Media Relations, Council marketing), so the vendor registration may already exist. | SOC 2, 99.99% uptime and 15-min RTO can't be met by a custom-built platform. The architecture has to sit on a certified platform such as Amazon Connect, Twilio Flex, Genesys Cloud or Salesforce Service Cloud. |
| Data-flow, integration and reporting questions (Tech Q4, Q5, Q10, Q13) are answerable with a solid architecture. | AI Factsheet and AI governance (Q11–12) must be written carefully. A "fully AI-run" pitch will hurt here. The City wants humans in the loop and an AI off switch. |

**IEBC play:** answer the **Technology/Integration questionnaire only**.
- Build on a SOC 2 / FedRAMP-backed contact-center platform.
- Use AI only for assistive tasks: transcription, summaries, language detection, after-hours follow-up texts, QA scoring. Humans make every eligibility decision.
- At the same time, approach likely primes about teaming. Examples: Michigan 211 / United Way, Wayne Metro, Gryphon Place, and national public-sector BPOs.

## Fit: Handled Services
| Strength | Gap |
|---|---|
| Already does the work behind many referrals: move-out and cleanout, junk hauling, repairs, pest control, water damage, locksmith, lead-safe painting (if certified), snow and lawn for code compliance. | Not a call-center operator. Should not answer the Operations track as a prime. |
| Has a live digital intake, quoting, dispatch and photo QA stack. That makes it a good closed-loop referral partner: the Helpline refers, Handled books, outcome data goes back. | Launched Oct 2026, so it lacks years in business and references. Same wall as IEBC for the RFP. |
| Detroit-based, with a vetted, insured local pro network. Detroit-Based Business (DBB) / Detroit-Headquartered certification can earn equalization credit. | Housing-program work often requires prevailing wage, lead-safe (RRP) certification, and City insurance minimums. Check each program. |

**Handled play:**
1. **Optionally, add a short section to the RFI response** under Ops Q4 (connect and enroll residents in services). Describe Handled as a *referral endpoint*: an API or form handoff where the Helpline sends a referral and Handled returns a quote, schedule and completion photos. That shows the City an outcome-tracking loop it doesn't have today.
2. **Pursue the programs the Helpline feeds, which is where Handled can win sooner.** Approach Detroit housing-repair and eviction-prevention programs, land banks and nonprofit housing providers to get on their approved vendor lists. Examples: City home-repair programs, Detroit Land Bank, Wayne Metro, DHC. The work includes cleanouts, turnover and minor repairs.
3. **Get the Detroit Business certifications** (DBB/DHB) through the Civil Rights, Inclusion & Opportunity office before the RFP is released.

## Recommended plan
| # | Action | Who |
|---|---|---|
| 1 | Find the RFI deadline and submission portal on Detroit OCP. | Owner |
| 2 | Submit one RFI response. Lead with IEBC on the Technology track and add a Handled "referral endpoint" section. Answer only what is true. RFI answers get compared against later RFP answers. | IEBC + Handled |
| 3 | Fill out Attachment A truthfully. Answer "none" for City contracts and lawsuits where that's true, and list the real years in business and headcount. | Owner |
| 4 | Contact 2–3 likely primes about teaming before the RFP drops. | IEBC |
| 5 | Apply for DBB/DHB certification. Register Handled as a vendor with the City and Detroit housing nonprofits. | Handled |
| 6 | Add "Detroit housing helpline RFP 550595" to the Hub gov-contract watch list. | Owner |

## Don't
- Don't claim SOC 2, 99.99% uptime, past public-sector call-center work, or references you don't have.
- Don't present Handled's internal AI agents (named IEBC "employees") as the City's agents. The City wants named human staff roles and ratios (Ops Q8).
- Don't let RFI answers make commitments. Keep everything in "proposed approach" language.
