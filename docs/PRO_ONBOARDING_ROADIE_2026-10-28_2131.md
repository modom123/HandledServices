<!--
  FILE    : docs/PRO_ONBOARDING_ROADIE_2026-10-28_2131.md
  PROJECT : Handled (HandledServices) — AI-run home & business services
  CREATED : 2026-10-28_2131 UTC
  PURPOSE : Pro onboarding, Roadie-style: sign up in 2 minutes, account opens right away, ID + background check is
            the gate, pros see jobs near them while the check runs.
-->

# Pro onboarding (Roadie-style)

| # | Step | What the pro does |
|---|---|---|
| 1 | **Sign up (2 minutes)** | Name, email, mobile, trades, ZIP codes. Account opens right away: no interview, no references. |
| 2 | **Photo ID + background check** | ID photo matched to a selfie; consent to the Checkr check (MVR for driving trades). |
| 3 | **Paperwork + payout** | W-9, agreement e-sign, payout. Insurance and license only for trades that need them. |
| 4 | **Take jobs** | Sees jobs near them (locked) while the check runs; takes them once cleared. First 3 jobs stay under $750 with a photo review. |

## What changed
- **Instant sign-up** (`RecruitingSettings.instantSignup`, on by default): every applicant gets an account unless the
  AI screen says "decline" (then staff decides). The screening interview is off by default. Hub → Recruiting →
  Pipeline → Automation has the switch; turning it off brings back the score and interview rules.
- **Sign-up form** cut to the essentials. Years, crew, equipment, references, work links and "other coverage" are gone;
  the license number is optional at sign-up.
- **Resume is optional**: it never blocks activation and pros aren't chased for it. The profile photo is still required.
- **Job preview**: a pro in setup sees up to 10 open jobs in their trades and area on their dashboard, locked until
  they're approved (`boardPreview` in `apps/web/lib/board.ts`).
- Emails, the /pros page, FAQ and the Spanish text say the same thing.

## What stayed (safety)
Photo ID, the background check, W-9, the agreement, insurance and license where the trade needs them, and probation
on the first jobs. Activation still happens only when every required step is done.
