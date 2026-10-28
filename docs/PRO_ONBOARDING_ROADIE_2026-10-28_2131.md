<!--
  FILE    : docs/PRO_ONBOARDING_ROADIE_2026-10-28_2131.md
  PROJECT : Handled (HandledServices) — AI-run home & business services
  CREATED : 2026-10-28_2131 UTC
  PURPOSE : Pro onboarding, Roadie-style: sign up in 2 minutes, account opens right away, ID + background check is
            the gate, pros see jobs near them while the check runs.
  UPDATED : 2026-10-28_2150 UTC — resume required, verified ID and Handled staff approval before any paid work.
-->

# Pro onboarding (Roadie-style)

| # | Step | What the pro does |
|---|---|---|
| 1 | **Sign up (2 minutes)** | Name, email, mobile, trades, ZIP codes. Account opens right away: no interview, no references. |
| 2 | **Photo ID + background check** | ID photo matched to a selfie; consent to the Checkr check (MVR for driving trades). |
| 3 | **Resume + paperwork** | Resume upload, W-9, agreement e-sign, payout. Insurance and license only for trades that need them. |
| 4 | **Handled approves you** | A person at Handled reviews the file and presses Activate. Until then the pro sees jobs near them, locked. First 3 jobs stay under $750 with a photo review. |

**Before any paid work:** a resume on file, a verified photo ID, and approval by a person at Handled. Nothing activates
a pro automatically: not the daily sweep, not a clear background check, not the AI agents (their "activate" action now
only flags the pro for staff). When everything is verified, Mastermind shows one "Ready to approve" alert per pro; it
clears when staff activate them in Hub → Pros.

## What changed
- **Instant sign-up** (`RecruitingSettings.instantSignup`, on by default): every applicant gets an account unless the
  AI screen says "decline" (then staff decides). The screening interview is off by default. Hub → Recruiting →
  Pipeline → Automation has the switch; turning it off brings back the score and interview rules.
- **Sign-up form** cut to the essentials. Years, crew, equipment, references, work links and "other coverage" are gone;
  the license number is optional at sign-up.
- **Auto-activate removed** from Recruiting settings: a person approves every pro.
- **Job preview**: a pro in setup sees up to 10 open jobs in their trades and area on their dashboard, locked until
  they're approved (`boardPreview` in `apps/web/lib/board.ts`).
- Emails, the /pros page, FAQ and the Spanish text say the same thing.

## What stayed (safety)
Resume, photo ID, the background check, W-9, the agreement, insurance and license where the trade needs them, staff
approval, and probation on the first jobs.
