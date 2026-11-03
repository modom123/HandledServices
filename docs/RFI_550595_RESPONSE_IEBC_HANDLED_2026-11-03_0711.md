<!--
FILE    : docs/RFI_550595_RESPONSE_IEBC_HANDLED_2026-11-03_0711.md
PROJECT : Handled (HandledServices) — AI-run home & business services
CREATED : 2026-11-03_0711 UTC
PURPOSE : Draft joint response to City of Detroit RFI No. 550595 (Detroit Housing Resource Helpline) from IEBC (respondent)
          with Handled Services LLC (partner). Companion to docs/RFI_550595_HOUSING_HELPLINE_EVALUATION_2026-11-03_0709.md.
STATUS  : DRAFT. Fill every [bracket] and delete the internal section before submitting.
-->

# Response to Request for Information No. 550595: Detroit Housing Resource Helpline

**City of Detroit, Office of Contracting and Procurement (OCP)**
**Respondent:** Integrated Efficiency Business Consultants, LLC (IEBC)
**Partner:** Handled Services LLC
**Tracks addressed:** Call Center Technology/Integration (full response) and Call Center Operation (proposed approach)
**Date:** [submission date]

---

## Before you submit (internal: delete this section)

1. **Deadline and portal.** The RFI files don't give a due date or a submission method.
   - Look up 550595 on EUNA Bonfire (detroit.bonfirehub.com), where RFP 550575 was posted, or on the OCP Bids page.
   - Check for addenda and a buyer name, and fill in the date above.
2. **One respondent, one contact.** This draft submits under **IEBC**, with Handled Services LLC as a named partner.
   - If both LLCs have the same owner, say so in Attachment A §2. If not, list each owner.
   - Use **one** phone number and **one** email on every page. The RFP 550575 draft had two different numbers.
3. **Honesty check.** RFI answers will be compared against RFP answers later.
   - This draft never claims SOC 2, a public-sector call-center reference, or 99.99% uptime as IEBC's own track record. It describes the certifications of the platforms we would build on.
   - Keep it that way.
4. **Teaming partner.** Operations Q3 and Q7 are strongest if you can name an established call-center operator you're talking with. If you have one by the deadline, add them where marked **[Teaming partner]**.
   - Otherwise leave the "we intend to team" language as is.
5. **Platform names.** The architecture names Amazon Connect and related AWS services as the reference design, with Salesforce or the City's existing systems as the case system of record.
   - Before submitting, check the current AWS service terms for the SLA, region and language claims, especially Bengali.
6. **AI Factsheet.** The RFI says to "complete the City AI Factsheet," but that form isn't in the files we received.
   - Ask the buyer for it. Section T-11 below already has the content in factsheet form, ready to paste in.
7. **Attachment A.** Fill in the FEIN, addresses, entity details and headcount from the state filings. For questions with no history, answer "None."
   - Don't invent references. Section A-3 explains why and how to answer instead.
8. Export to PDF on IEBC letterhead, and name the file with a timestamp (e.g., `IEBC_RFI550595_RESPONSE_YYYY-MM-DD_HHMM.pdf`).

---

## Cover letter

[Date]

City of Detroit, Office of Contracting and Procurement
Coleman A. Young Municipal Center, 2 Woodward Avenue, Suite 1008
Detroit, MI 48226
Attn: [Buyer name], RFI No. 550595

Re: Request for Information: Detroit Housing Resource Helpline

Dear [Buyer name]:

Integrated Efficiency Business Consultants, LLC (IEBC) and our partner, Handled Services LLC, thank the City for the chance to share market insight on the Detroit Housing Resource Helpline. Both firms are based in Detroit.

- **IEBC** designs and builds AI-assisted business systems: intake and triage logic, multi-channel messaging, dashboards, integrations, and the controls that keep humans in charge of automated tools.
- **Handled Services** runs a Detroit network of vetted, insured service professionals for cleaning, cleanouts, hauling, repairs and licensed trades. It books, dispatches and verifies work through its own digital intake and tracking platform.

We respond to both tracks:

- **Technology/Integration:** a full answer. We propose a cloud contact center on a commercially certified platform, a configurable screening and referral layer, closed-loop data exchange with City and partner systems, and assistive AI governed by the City's AI Factsheet. The AI can be switched off feature by feature.
- **Operation:** a proposed approach and staffing model for 120,000 calls a year with 1,500-call peak days. We are candid that we expect to deliver operations with an established contact-center partner, not alone.
- **Referral endpoint (Handled):** a way to close the loop on referrals. When a caller's housing stability depends on a physical service, such as a move-out cleanout, an emergency repair, pest treatment or code-compliance work, the Helpline can hand the referral to Handled. The City then gets back the quote, the schedule and photo-verified completion. Today that outcome is usually lost after the call.

We hope this is useful as the City shapes its RFP(s). We would welcome a follow-up conversation or a demonstration.

Respectfully,

Mark Odom
Founder & CEO, Integrated Efficiency Business Consultants, LLC
[phone] · [email]

---

## Executive summary

**What residents need:** one call, a fast answer, the right referral, and a follow-up when they called after hours.

**What the City needs:**
- Screening logic it can change in 24 hours.
- Data that reaches programs without re-keying.
- Metrics it can trust.
- A platform that doesn't go down on a 1,500-call day.

**What we recommend:**

| Need | Our approach |
|---|---|
| Reliability (99.99%, 15-min RTO, 30-min RPO) | Build on a cloud contact-center platform that publishes a 99.99% service commitment and has active-standby across two US regions. We don't build or host telephony ourselves. |
| Keep 866-313-2520 | Toll-free number ported to the new platform at a scheduled cutover, with the current carrier as fallback until verified. |
| Screening that changes fast | Screening scripts kept as versioned, no-code decision trees, with edits by an approved City or operator admin. Emergency changes go live within hours, logged and reversible. |
| Multilingual | Recorded greetings and menus in English, Spanish, Arabic and Bengali, Spanish- and Arabic-speaking agents, a contracted interpreter line for every other language, and translated texts and emails. |
| High-volume days | Callback-in-queue, self-service resource texts, staffing by forecast, and a surge plan, so callers aren't left on hold for more than 5 minutes. |
| Data handoff | One intake record per caller, sent to programs by API, secure file transfer or Salesforce integration, with an audit trail and a single named system of record for each data element. |
| AI | Assistive only: transcription, summaries, language detection, quality-assurance (QA) scoring, and agent knowledge search. Eligibility and referral decisions stay with trained staff. Every AI feature can be switched off. |
| Closing the loop | Partner endpoints, starting with Handled, return referral outcomes (accepted, scheduled, completed, with photos) to the case record. |

---

## Attachment A: Respondent Questionnaire (Part 1)

### A-1. Contact information

**Single point of contact**

| Field | Response |
|---|---|
| a. Name | Mark Odom |
| b. Title | Founder & CEO, IEBC |
| c. Address | [street], Detroit, MI 48219 |
| d. E-mail | [business email] |
| e. Phone | [one number] |

**Partner or manager in charge if awarded**

| Field | Response |
|---|---|
| a. Name | Mark Odom (program executive). [Add operations lead or teaming-partner project manager when named.] |
| b. Title | Founder & CEO, IEBC |
| c. Address | [street], Detroit, MI 48219 |
| d. E-mail | [business email] |
| e. Phone | [one number] |

### A-2. Respondent background (complete for each party)

| Item | IEBC (respondent) | Handled Services LLC (partner) |
|---|---|---|
| a. Legal name | Integrated Efficiency Business Consultants, LLC [confirm against state filing] | Handled Services LLC |
| b. Principal place of business / place of performance | [street], Detroit, MI 48219. Work is performed in Detroit and remotely. | [street], Detroit, MI [ZIP]. Services are performed in Detroit and Wayne County. |
| c. Entity type | Limited liability company [confirm] | Limited liability company |
| d. Tax status / FEIN | [ ] | [ ] |
| e. State formed | Michigan [confirm] | [Michigan] |
| f. Company phone | [one number] | (313) 639-9373 |
| g. Website | [IEBC website] | handledsvc.com |
| h. Years in business | Founded 2025. The founder has led sales and marketing operations since 2001. | Founded 2026. |
| i. Average employees, last 3 years | [2024: n/a · 2025: __ · 2026: __] | [2026: __ staff plus __ independent service professionals] |
| j. City of Detroit contracts, last 5 years | [None] | [None] |
| k. Claims or lawsuits from services, last 10 years | [None] | [None] |
| l. Contracts terminated | [None] | [None] |

If both companies share an owner, add: *"IEBC and Handled Services LLC are under common ownership [confirm]. Handled operates on systems IEBC designed."*

### A-3. Prior experience

> **Internal note: delete before submitting.** Don't fill these forms with projects that aren't of "similar size and scope." The rules for this RFI response:
> - Only list a teaming partner's public-sector contact-center work if that partner has agreed in writing.
> - Give each of these a reference form only if the client will take the reference call:
>   - IEBC systems, automation or messaging projects for clients.
>   - Handled's live platform (customer intake, AI-assisted quoting, dispatch, photo QA, partner referrals).
> - If there are no such projects, use the statement below.

*Suggested statement:* "IEBC and Handled are early-stage Detroit firms. We do not yet have a completed public-sector contact center of this size, and we won't present unrelated work as if it were. For an RFP, we intend to respond as part of a team led by, or including, an operator with documented public-sector helpline experience, and to provide three references that meet the City's standard. Today we can show the systems described in this response working live (Handled's intake, dispatch, messaging and QA platform), and we welcome a demonstration."

**Reference Form #1** [Teaming partner public-sector helpline, if available]: fields a–j.
**Reference Form #2** [IEBC client project: systems, automation or messaging]: fields a–j.
**Reference Form #3** [Handled commercial account or referral partner]: fields a–j.

### A-4. Subcontractors

| Question | Response |
|---|---|
| Do you intend to use subcontractors? | Yes, for an RFP.<br>• **Handled Services LLC** ([address]): referral endpoint for physical housing-stabilization services (cleanouts, move-outs, repairs, pest, water damage, locksmith, snow and lawn for code compliance), with photo-verified outcomes returned to the case record.<br>• **[Teaming partner]**: contact-center operations, agent staffing and supervision.<br>• **[Interpreter service]**: on-demand phone interpretation for languages not covered by staff.<br>• **Cloud platform providers** (e.g., Amazon Web Services; Salesforce if the City selects it) are used as licensed services, not subcontracted labor. |

---

## Part 2: Call Center Technology/Integration Questionnaire

### T-1. Implementation timeline

A 16-week plan from contract signature to go-live, plus 4 weeks of hypercare. The timeline depends on City access to the current carrier and the toll-free number's carrier of record, and on prompt approvals.

| Weeks | Phase | Key outputs |
|---|---|---|
| 1–3 | Discovery | Current-state call flows, CAM intake requirements, script inventory, integration and data inventory, security requirements. Port request for 866-313-2520 begins. |
| 4–6 | Design | Solution architecture, data-flow diagram, IVR and routing design, screening decision trees, reports, AI Factsheets. City approves security design. |
| 7–11 | Build and configure | Contact center in two regions, IVR in 4 languages, routing and callback, case and intake forms, integrations, messaging, dashboards, single sign-on (SSO) and multi-factor authentication (MFA). |
| 12–14 | Testing | Functional, integration, load (2× peak: 3,000 calls/day; 300 calls/hour), failover/DR drill, accessibility, penetration test, user acceptance testing (UAT) with City and partner staff. |
| 15 | Training and readiness | Agent, supervisor and admin training. Go/no-go checklist. |
| 16 | Cutover | Number port during a low-volume window, parallel monitoring, rollback plan. |
| 17–20 | Hypercare | Daily defect triage, weekly tuning of scripts and staffing, handover to steady-state support. |

### T-2. QA: reviewing, flagging, scoring and auditing interactions

- **100% of calls recorded and transcribed**, then stored with the case record under the City's retention schedule.
- **Automated screening of every call** to flag calls for human review:
  - Long holds, transfers, abandoned callbacks, or caller distress or escalation words.
  - Required screening questions that were missed (e.g., the CAM safety question, secondary-needs screening).
  - Mentions of eviction dates, utility shutoffs or no safe place to sleep tonight, so urgent cases are confirmed as routed.
- **Human-scored QA form:** a City-approved scorecard covering greeting, eligibility accuracy, complete screening, referral accuracy, empathy, privacy and documentation.
  - QA analysts score a random sample of at least 3% of calls per agent per month.
  - They also score 100% of flagged calls.
- **Calibration:** monthly sessions with City staff, and agreement between scorers tracked over time.
- **Reporting to the City:** a monthly QA report covering scores, trends, findings, corrective actions and coaching completed, with evidence. Corrective-action items are tracked to closure.
- **Audit:** every score, flag, recording access and export is logged with user and time.

### T-3. Tracking and reporting metrics

- **Dashboards:** a live operations wallboard, plus a City dashboard refreshed every 15 minutes and published to Tableau (or the City's BI tool).
- **Data path:** contact-center events, case records and messages land in a reporting warehouse. If the City uses Snowflake, the data is delivered there.
- **Required metrics:**
  - Call volume.
  - Calls received and handled.
  - Wait time.
  - Handle and processing time.
  - Call reasons and outcomes.
  - Resources shared.
  - Direct referrals made.
  - For referral partners, referral outcomes.
- **Standard reports:** daily (operations), weekly (City program staff) and monthly (performance and QA).
- **Self-service:** City staff can build their own Tableau views from a documented, de-identified data model.

### T-4. Solution architecture

| Layer | Proposed component (reference design) | Notes |
|---|---|---|
| Telephony / contact center | Amazon Connect (or equivalent CCaaS: Genesys Cloud, Twilio Flex), active-standby across two US regions | Inbound and outbound voice, queues, skills-based routing, callback-in-queue, recording. 866-313-2520 is ported to it. |
| IVR | Contact-flow IVR with recorded prompts in English, Spanish, Arabic and Bengali | Language selection, emergency shortcut (e.g., "if you have nowhere safe to sleep tonight, press 1"), after-hours routing, callback offer. |
| Agent desktop and case / intake | Salesforce Service Cloud (if the City selects it), or a configured intake application on a SOC 2 platform | Screening decision trees, caller record, referrals, notes, consent. Single sign-on for agents. |
| Screening / rules engine | Versioned no-code decision trees | Change control for both 7-day and 24-hour changes, with an audit trail. |
| Messaging | SMS, email and voice broadcast through the platform's messaging service | Opt-in and opt-out (TCPA), templates in 4+ languages, resource-inventory messages. |
| Knowledge base | Curated housing resource inventory with owners and review dates | Feeds agent search and resident texts and emails. |
| Integration layer | API gateway plus event and file pipelines (REST, SFTP, platform connectors) | To Smartsheet, Snowflake, Salesforce, Google Workspace, Corteza/Pathways, SeeClickFix, Accela, and partner endpoints (Handled). |
| Reporting | Warehouse (Snowflake or equivalent) plus Tableau | Near-real-time operations data and historical data. |
| AI (optional, switchable) | Transcription, call summary, language detection, QA flags, agent knowledge search | See T-11 and T-12. |
| Identity and security | City identity provider (SSO with SAML or OIDC) and MFA. Encryption with KMS, centralized logging and SIEM. | See T-9 and Section 5 alignment. |
| Third parties | [Interpreter service], [CCaaS], [CRM], [messaging], Handled Services (referral endpoint) | All listed in the security plan with data-processing terms. |

### T-5. Data-flow diagram

*(A drawn version goes in the PDF. Each flow is listed below.)*

```
 Resident ──voice──▶ [Contact center / IVR] ──screen-pop──▶ [Agent desktop + Intake/Case]
    ▲                     │ recordings, transcripts                │
    │ SMS/email           ▼                                         ▼
 [Messaging] ◀──templates── [Intake/Case record = system of record for the intake]
                                 │            │             │              │
                       API/SFTP  │   API      │   API/SFTP  │    API       │ API
                                 ▼            ▼             ▼              ▼
                       [CAM / shelter]  [City Salesforce/  [Partner      [Handled
                        (Pathways)]     Smartsheet/Google]  programs]     referral endpoint]
                                 │            │             │              │
                                 └────── outcomes / status returned ◀──────┘
                                                    ▼
                                      [Warehouse (Snowflake)] ──▶ [Tableau dashboards]
```

| # | From → To | Data | Direction | Method | Frequency | Security boundary | System of record |
|---|---|---|---|---|---|---|---|
| 1 | Resident → contact center | Voice, DTMF input, language choice | Inbound | PSTN, toll-free | Real time | Carrier → CCaaS (US regions) | CCaaS (call detail records) |
| 2 | Contact center → agent desktop | Caller ID, IVR choices, queue data | One-way | Native connector | Real time | Within the contractor's cloud tenant | Intake/Case |
| 3 | Agent → intake/case | Screening answers, needs, consent, notes | Write | UI | Real time | Contractor tenant, SSO and MFA | **Intake/Case** |
| 4 | Intake → CAM / Pathways | Shelter intake record | Outbound, with status back | API or SFTP (whichever Pathways supports) | Real time or every 15 minutes | Contractor → City/CoC system, TLS 1.2+ | Pathways (for CAM) |
| 5 | Intake → City programs (Salesforce, Smartsheet, Google) | Referral packet | Outbound, with status back | API | Real time | Contractor → City tenant | Receiving program |
| 6 | Intake → Handled | Service referral (minimum necessary: name, phone, address, need, consent) | Outbound, with outcomes back | REST API (signed requests) | Real time | Contractor → Handled tenant | Handled for the job; intake for the outcome summary |
| 7 | Messaging → resident | Resource lists, follow-ups, reminders | Outbound | SMS, email, voice | Event-driven | Contractor tenant → carriers | Messaging log |
| 8 | All → warehouse | Call, case, referral and outcome data | One-way | Pipeline | Every 15 minutes, plus nightly | Contractor → City Snowflake (or contractor warehouse) | Warehouse (reporting copy only) |
| 9 | Warehouse → Tableau | Aggregates and row-level data (role-based) | One-way | Connector | Every 15 minutes | City BI | n/a |
| 10 | Field updates (SeeClickFix, Accela) | Inspection or code-issue referrals | Outbound, with status back | API | Real time | Contractor → City | SeeClickFix / Accela |

### T-6. Hosting and deployment

| Item | Proposed |
|---|---|
| Model | Software-as-a-service: a multi-tenant cloud contact center with a dedicated, logically isolated City instance, account and encryption keys. |
| Cloud provider | Amazon Web Services (reference design). Salesforce (Hyperforce, US) if Service Cloud is selected. |
| Regions | Primary US-East, standby US-West. All data stays in the US. |
| Data residency | United States only, including backups, recordings, transcripts and AI processing. |
| Environments | Development, Test/UAT and Production, each separate with no production data in lower environments (synthetic data only). |
| Hosting subcontractors | None beyond the cloud and SaaS providers named above. All are listed, with their SOC 2 Type II reports available to the City under NDA. |

### T-7. Capacity

| Measure | Platform limit (reference design) | Proposed configuration |
|---|---|---|
| Maximum agents | Thousands; scales on demand | 60 agent seats licensed (peak plus surge plus training) |
| Concurrent calls | Hundreds to thousands (quota-based; raised on request) | Configured for 150 concurrent calls |
| Calls per hour | Scales with concurrency | Load-tested to 300/hour (2× projected peak hour) |
| Queue size | Configurable | 200 callers in queue, with automatic callback offer after 2 minutes |
| Callback volume | Configurable | 1,000+ pending callbacks per day |
| Outbound messages | Throughput by registered number type (toll-free / 10DLC) | 10,000+ SMS/day and unlimited email. Registration completed during implementation. |
| Storage | Object storage, effectively unlimited | Recordings and transcripts kept per the City retention schedule (proposed 3 years active, then archive) |

### T-8. Speed and service metrics

All of these are captured automatically for every interaction and reported by queue, language, hour and agent:
- Average speed of answer.
- Abandonment, total and after 30 seconds.
- Wait time: average, 90th percentile and maximum.
- Handle time: talk, hold and wrap-up.
- Hold time.
- Transfer rate.
- Callback performance: offered, accepted, completed, time to callback, and first-attempt success.
- Service level: % answered or called back within 5 minutes (City target).

### T-9. Protecting City Internal, Confidential, Restricted and PII data

- **Classification:** each data field is tagged (Internal, Confidential, Restricted, PII). Restricted data, such as domestic-violence indicators and health information shared by callers, gets field-level access restrictions.
- **Minimum necessary:**
  - Referral packets carry only the fields the receiving program needs.
  - Partner endpoints, including Handled, never receive screening detail they don't need.
- **Encryption:**
  - In transit: TLS 1.2 or higher.
  - At rest: AES-256, with keys in a managed key service (AWS KMS), rotated every year. Customer-managed keys are available to the City.
  - Limitations are disclosed, e.g., the carrier network carries voice before it reaches the platform.
- **Access:**
  - City SSO with MFA, a unique account for each user, and role-based groups.
  - Least privilege, with access reviewed every quarter.
  - Administrator timeouts and break-glass accounts.
  - Accounts disabled within 24 hours of separation, through the account lifecycle process.
- **Monitoring:**
  - Centralized logs, alerting and a 24×7 on-call rotation.
  - Incident response plan with City notification within [24] hours of a confirmed incident.
- **Vulnerability management:** monthly patching (critical within 72 hours), malware protection on agent endpoints, and an annual third-party penetration test.
- **Payment card data:** none. No payments are taken by phone.
- **Audit logs:** searchable, tamper-evident, and kept [7] years. They cover:
  - Access and failed logins.
  - Record creation, changes and deletion.
  - Configuration and permission changes.
  - Integrations and exports.
  - Administrator activity.
- **SOC 2:**
  - Cloud and SaaS providers supply current SOC 2 Type II reports.
  - IEBC will complete a SOC 2 Type I readiness assessment before any award and pursue Type II within 12 months, or deliver through a teaming partner that holds one. [Confirm this commitment before submitting.]

### T-10. Integrating with external systems and CRMs

- **Standard methods:**
  - REST/JSON APIs with OAuth 2.0.
  - Webhooks.
  - SFTP with PGP-encrypted file exchange.
  - Native connectors (Salesforce, Snowflake, Tableau, Google Workspace, Smartsheet).
- **Integration approach:**
  - Each interface has a documented contract (fields, frequency, error handling, retries, and the system of record).
  - Each interface is monitored, with failed transfers alerting operations staff.
- **Unique identifiers:** a single resident ID ties calls, texts, referrals and outcomes together across systems, so duplicate intakes are visible.
- **Partner onboarding:**
  - New programs connect through a lightweight "referral endpoint" pattern. Handled's endpoint is the first example: receive referral → accept or decline → schedule → complete → outcome.
  - Small partners without APIs can use a secure web portal or Smartsheet form.

### T-11. AI features and City AI Factsheet

All AI features are **assistive**, **optional**, and can be **switched off individually** by an authorized City administrator. **No AI feature decides eligibility, denies a service, or talks to a resident without a human in the loop.**

| # | Feature | Purpose | Input data | Output | Human role | Where it runs | Off switch |
|---|---|---|---|---|---|---|---|
| AI-1 | Speech transcription | Searchable record; feeds QA | Call audio | Transcript | QA staff review; transcript can be corrected | Platform service, US region | Yes. Recording continues without transcription. |
| AI-2 | Call summary | Cut wrap-up time and improve notes | Transcript | Draft case note | Agent edits and approves before saving | Large language model in US region, no training on City data | Yes. Agents write notes manually. |
| AI-3 | Language detection / translation of messages | Faster routing; translated texts | Caller's speech or text | Language tag; translated message draft | Templates pre-translated and reviewed by a human; free-text translations reviewed before sending | Platform service, US region | Yes |
| AI-4 | QA flagging | Find calls needing review | Transcript, call metrics | Flags and suggested scores | QA analyst makes the final score | Platform analytics, US region | Yes. Random sampling only. |
| AI-5 | Agent knowledge search | Find the right resource faster | Agent's question, resource inventory | Suggested resources with source links | Agent chooses what to share | Large language model over the City-approved inventory only | Yes |
| AI-6 | Forecasting and scheduling | Staff to demand | Historical call volumes | Forecast and schedule | Workforce manager approves | Workforce-management tool | Yes |

**Not proposed:** AI voice agents answering residents, automated eligibility decisions, and AI-chosen referrals without agent review.

### T-12. AI governance

- **Human oversight:** every AI output is either a draft that a person approves (AI-2, AI-3, AI-5, AI-6) or a flag a person reviews (AI-1, AI-4). The table in T-11 names the responsible role for each.
- **Accuracy testing:**
  - Before go-live, each feature is tested on a City-approved test set. Examples: transcription word-error rate by language, and how accurate summaries are compared with agent notes.
  - Each feature has acceptance thresholds, re-tested every quarter and after any model change.
- **Bias and risk controls:**
  - Accuracy is measured separately by language and accent group.
  - Features that fall below threshold for any group are switched off for that group.
  - No protected traits are used in routing.
  - Flagging rules are reviewed for disparate impact.
- **Logging:** every AI input, output and the human edit or approval is logged with model and version.
- **Data retention:** AI inputs and outputs follow the same retention schedule as the case record. Providers are contractually barred from keeping or **training on City data**.
- **Model and provider changes:** 30 days' written notice to the City, with re-testing results before the change takes effect. The City can refuse a change and keep the feature off.
- **Ability to disable:** each feature has a City-controlled on/off switch, and the call center runs fully without AI.

### T-13. Supported case management, ticketing and workflow software

| System | Integration available | Method |
|---|---|---|
| Salesforce (Service Cloud, Public Sector) | Yes | Native connector / REST API |
| Snowflake | Yes | Native connector, secure data share or pipeline |
| Tableau | Yes | Native connector (on Snowflake or the warehouse) |
| Smartsheet | Yes | REST API |
| Google Workspace (Sheets, Forms, Drive) | Yes | Google APIs with a service account |
| Corteza / Pathways | Yes, subject to the API or export access the vendor provides | REST API (Corteza) / API or SFTP |
| SeeClickFix | Yes | REST API |
| Accela | Yes | Accela Construct API |
| Others (HMIS, ServiceNow, Microsoft Dynamics, Zendesk) | Yes | REST API, webhooks or SFTP |
| Handled Services | Yes | REST referral endpoint (see Part 4) |

### T-14. Native translation

- **IVR prompts:** English, Spanish, Arabic and Bengali, recorded by professional native speakers rather than machine-generated, because some text-to-speech engines don't support Bengali.
- **Live calls:**
  - Agents who speak Spanish and Arabic.
  - Three-way conference with a contracted phone interpreter service for Bengali and 200+ other languages, about 30 seconds to connect.
- **Text and email:** templates pre-translated into the four required languages and reviewed by human translators. Machine translation of free text, with human review before sending, is available for 70+ languages, including Bengali.
- **Transcription (AI-1):** depends on language support. Where a language isn't supported, recording continues and QA is done by a qualified human reviewer.

---

## Part 3: Call Center Operation Questionnaire

> **Internal note: delete before submitting.** This part describes how we *propose* to operate. If you have a teaming partner, name them in O-3, O-7 and O-8.

### O-1. Solution and method for screening, triage and connection

1. **Front door (IVR, under 60 seconds):**
   - Language choice.
   - Emergency shortcut for "no safe place to sleep tonight" and "being locked out or evicted today." These callers go to a priority CAM queue.
   - Short reason menu (eviction or court, rent or utility help, shelter, repairs or conditions, other) to route to skilled agents.
2. **Structured screening:**
   - A versioned decision tree asks the minimum questions to place the caller in the right stage of housing instability: at risk, imminent loss, or literally homeless (CAM).
   - It then checks for **secondary needs**: employment, benefits, inspections or conditions, legal help, utilities, and physical service needs.
3. **Best-fit match:** program eligibility rules and current capacity (openings, waitlists) show the agent the top matches. The agent confirms them with the caller.
4. **Warm handoff or referral:** live transfer where a program accepts it, otherwise an electronic referral packet with the caller's consent.
5. **Resident leaves with a text:** a summary of referrals, phone numbers, documents to gather, and the next step, in their language.
6. **Follow-up:** automated check-ins at 3 and 14 days (opt-in). Unresolved callers are re-queued for an outbound call.

### O-2. Handling high demand (120,000 calls a year, 1,500-call days, waits of 5 minutes or less)

**Workload math**

Assumptions: about 2,750 operating hours a year, and an average handle time (AHT) of about 11 minutes. The AHT will be refined from City data during discovery.

| Scenario | Calls/hour | Workload (Erlangs) | Agents on phones for 80% answered in 60 sec | Scheduled agents (≈30% shrinkage) |
|---|---|---|---|---|
| Average day (~440 calls) | ~44 | 8.1 | 11 | ~15 |
| Peak day (1,500 calls) | ~150 | 27.5 | 33 | ~43 |
| Peak hour on peak day | ~200 | 36.7 | 42 | ~55 (with surge plan) |

**How we stay within 5 minutes without staffing every day for the peak:**
- **Callback-in-queue:** after 2 minutes, callers can keep their place and get a call back. Abandoned callers get an automatic callback.
- **Forecast-driven scheduling:**
  - Staff are scheduled in 30-minute intervals.
  - Rent-due and court-calendar days are treated as known peaks.
  - Split shifts and part-time agents cover Monday mornings and the start of the month.
- **Surge plan:**
  - A trained flex pool (cross-trained partner staff) is activated when the queue passes a set threshold.
  - The IVR plays a message during surges, and self-service texts send resource lists to callers who just need information.
- **Shorter calls without cutting corners:** AI summaries (if enabled) and knowledge search are expected to save 1–2 minutes of wrap-up and lookup per call.
- **After hours:** emergencies go to the after-hours line. Everyone else gets a text and is called back next business morning, in order received.

### O-3. Experience and lessons

**IEBC:**
- Builds AI-assisted operating systems for service businesses: intake flows, automated messaging, dashboards, approval queues, and integrations.
- Its founder has run sales and customer operations since 2001.

**Handled Services:** runs that model in Detroit today, including:
- Resident and business intake.
- Rules-based quoting.
- Dispatch to vetted professionals.
- Photo-verified completion with human review before anything is finalized.
- Multi-channel customer messaging.

**[Teaming partner]:** [years and public-sector helpline experience].

**What this has taught us:**
1. **Automate the paperwork, not the judgment.** Every AI step we run has a human approval point, and that's what keeps the quality high.
2. **Measure outcomes, not just calls.** A referral that never gets completed looks like success on a call report. We track whether the service happened.
3. **Make change cheap.** Rules and scripts change weekly, so they must be editable by trained staff, not developers.

We have not yet delivered a public-sector contact center of this size, and we say so plainly. That's why we propose to deliver operations with an experienced partner.

### O-4. Making sure residents are identified, connected and enrolled

- **Seamless intake:** each caller's answers are captured once and reused in every referral packet, so residents aren't asked to repeat their story to each program.
- **Supportive services:** the secondary-needs screen is required, not optional, and each "yes" creates a tracked referral.
- **Waitlists:**
  - Programs share capacity and waitlist status through the integration layer.
  - Agents see whether a program is open, waitlisted or closed.
  - Waitlisted residents get automatic status texts.
- **Connected referrals:** each referral has a status (sent, accepted, scheduled, enrolled or served, declined with reason). It is reported back to the City, and referrals with no response after [5] business days are flagged.
- **Physical services (Handled):** when stability depends on a service, such as a cleanout before a move-out inspection, a repair cited by an inspector, or pest treatment, the referral goes to Handled's endpoint. The case shows the quote, scheduled date and photo-verified completion (see Part 4).

### O-5. Continuous quality improvement

**The cycle:**
- **Weekly:** operations review of metrics and QA findings.
- **Monthly:** City performance meeting.
- **Quarterly:** script and resource-inventory review with program partners.
- Each change is logged with its reason, the expected effect and the measured result.

**Examples from our own operations**

> **Internal note: delete before submitting.** Replace these with real Handled or IEBC data, or drop them.

1. **Pricing accuracy (Handled).** Data showed that photo-based estimates sometimes differed from the work actually done.
   - **Change:** we required photos for each service, limited how far the automated adjustment could move a price, and required a free site visit for larger changes.
   - **Result:** [measured change in price adjustments after the visit and in customer disputes].
2. **Response speed.** Lead-response data showed that inquiries answered quickly converted at much higher rates.
   - **Change:** we added instant automated acknowledgment and same-day human follow-up queues.
   - **Result:** [measured response-time change].

### O-6. KPIs and compliance metrics

| Category | KPI | Proposed target (to be set with the City) |
|---|---|---|
| Access | Calls answered or called back within 5 min | ≥ 90% |
| Access | Abandonment rate (after 30 sec) | ≤ 8% |
| Access | Callback completed same business day | ≥ 95% |
| Quality | QA score | ≥ 90% |
| Quality | Screening completeness (required questions) | ≥ 98% |
| Outcomes | Referrals with a known outcome within 30 days | ≥ 75% (rising each year) |
| Outcomes | CAM intakes transmitted within 15 min | ≥ 99% |
| Resident | Post-call satisfaction (SMS survey) | ≥ 4.3 / 5 |
| Compliance | Screening changes deployed on time (24 hr emergency / 7 days other) | 100% |
| Compliance | Platform availability | ≥ 99.99% (platform service commitment) |
| Compliance | Access reviews and DR test completed | Quarterly / annually |
| Equity | Service level and QA by language | No language group more than 10 points below average |

### O-7. References and evidence

- **Public-sector contact center, transition and performance:** [Teaming partner references].
- **API integrations and data management:** the Handled platform is live and in production. It includes customer and professional portals, payment and accounting integrations (Stripe, Xero), a messaging layer, and staff dashboards. A demonstration is available.
- **Security controls:** cloud and SaaS provider SOC 2 Type II reports (available under NDA), plus IEBC's security plan and the SOC 2 readiness plan in T-9.
- **AI governance:** the human-approval model described in T-11 and T-12 is already in use in Handled's operations (quotes, dispatch, QA, screening).

### O-8. Staffing roles and ratios

| Role | Ratio / count (at ~120k calls a year) | Notes |
|---|---|---|
| Housing navigator (agent) | ~15 scheduled on average days, ~43 on peak days (see O-2) | Core plus part-time and flex pool. At least 25% Spanish- or Arabic-speaking. |
| Team lead / supervisor | 1 per 12–15 agents | Real-time floor support and escalations |
| QA analyst | 1 per 25–30 agents | Scoring, calibration, coaching inputs |
| Workforce manager | 1 | Forecasts, schedules, intraday adjustments |
| Trainer | 1 (0.5 after launch) | New hires, script changes, refreshers |
| Resource and partner coordinator | 1 | Keeps the resource inventory current. Partner onboarding. |
| Program / operations manager | 1 | City point of contact. Reporting. |
| Platform administrator | 1 | Routing, IVR, users and script changes |
| Integration and data engineer | 0.5–1 | Interfaces, warehouse, dashboards |
| Security and compliance lead | 0.25–0.5 | Access reviews, audits, incidents |

**City staff needed:**
- **1 product owner:** a program manager, not a technical role, who approves screening and script changes and owns the resource inventory with partners.
- **About 0.25 FTE from DoIT:** security reviews, SSO setup and integration approvals.
- **No developer skills needed:**
  - Screening trees, prompts and messaging templates are edited in admin screens.
  - City admins are trained (about 2 days) and given runbooks.

---

## Part 4: Partner capability: Handled Services referral endpoint

**What it is:** a way for the Helpline, or any City program, to send a resident to a vetted Detroit service professional for physical work that affects housing stability, and to get the outcome back.

**Example services:**
- Move-out and move-in cleaning.
- Cleanouts and junk hauling.
- Minor repairs and handyman work.
- Licensed trades (plumbing, electrical, HVAC) where licensed.
- Pest control.
- Water-damage mitigation.
- Lockouts and locksmith.
- Snow, lawn and debris removal for code compliance.

**How it works:**
1. The Helpline sends a referral by API or secure form: name, phone, address, service needed, urgency, consent, and the funding program if any.
2. Handled's system checks it and confirms within [2] business hours. The confirmation includes an upfront price from its pricing rules, or a free site visit for larger jobs.
3. A vetted, insured, background-checked professional is scheduled. The resident gets text updates in their language.
4. The work is completed and documented with before and after photos. A human reviews it before it is marked complete. A 30-day make-it-right guarantee applies.
5. The outcome goes back to the case record: accepted, scheduled, completed with photos, or declined with reason.

**Who pays:** the program or partner that funds the service. Residents are never charged without their agreement. [Confirm the pricing approach for program-funded work.]

**Data handling:**
- Handled receives only the fields needed to do the job.
- Data is stored in the US with role-based access.
- Data is deleted per the City's retention terms.
- Handled will not use referral data for marketing.

---

## Part 5: Recommendations for the City's RFP

These are offered to help the City get stronger, comparable proposals:

1. **Split the award, or allow teams:** one award for technology and integration, one for operations, or a prime with named subcontractors. That opens the field to strong Detroit firms in each track.
2. **Publish baseline data:**
   - Last year's calls by interval and by reason.
   - Current AHT.
   - Abandonment.
   - Languages.
   Bidders can then size staffing on facts, and prices become comparable.
3. **Define the system of record for each data element**, especially for CAM and Pathways, before bidders design integrations.
4. **Buy outcome metrics, not just call metrics.** Require referral outcome reporting from receiving programs, and include partner endpoints in scope.
5. **Include the City AI Factsheet and the data classification policy** in the RFP package, so AI and security answers are complete and comparable.
6. **Allow a phased transition:** number port and platform first, then integrations, then AI features. Each phase should have a go/no-go.

---

*Respectfully submitted by Integrated Efficiency Business Consultants, LLC, with Handled Services LLC, Detroit, Michigan.*
*Contact: Mark Odom, Founder & CEO · [phone] · [email]*
