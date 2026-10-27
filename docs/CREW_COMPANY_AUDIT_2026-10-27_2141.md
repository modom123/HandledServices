<!--
  FILE    : docs/CREW_COMPANY_AUDIT_2026-10-27_2141.md
  PROJECT : Handled (HandledServices) — AI-run home & business services
  CREATED : 2026-10-27_2141 UTC
  PURPOSE : Audit of how a crew company (example: "Atkins & Sons") signs up and is treated across the system, the gaps
            found, and what was fixed. Run supabase/setup/ADD_CREW_COMPANIES_2026-10-27_2141.sql once in Supabase.
-->

# Crew companies: audit & fixes

**Example:** Atkins & Sons, a family trade company. The owner may or may not hold the license, and the sons and
employees do the work. In the system they are a **pro** (Contractor) with `account_type = "crew"`. Their people are
listed as `crew_members` (lead, licensed tech, apprentice or helper), and each person is background-checked.

## How a crew company is now treated, end to end

| Stage | Where | Behavior |
|---|---|---|
| Sign-up | `/pros` → `ApplyForm` | **Who does the work?** Just me / My company sends a crew. A crew company also answers: **Do you go to jobs?** (every job / me or my crew / my crew does the jobs), **Customers see** (my first name / my company name), crew size and an optional **crew roster** (name, role, email, phone, license #). |
| Screening | `lib/recruiting.ts` | The AI screen sees `account_type` and how many people were listed. The Hub candidate page shows "Crew company", the owner on-site choice, the display choice and the roster. |
| Invite | `inviteApplicant` | The choices are copied onto the pro. Daily capacity starts from crew size (`capacityForCrew`). |
| Onboarding | `onboardingChecklist` | New **Crew Addendum signed** step. **Workers' comp must be a real policy**, because the no-employees statement is refused (API and checklist). The **license step is met** by a cleared licensed tech on the crew in each licensed trade when the owner holds no license. |
| My crew | `/pro/crew` | A **How you work with us** card lets the pro change any choice later. A **From your application** list adds each listed person with one click, which sends their background check. Signing the Addendum makes the pro a crew company. |
| Dispatch | `eligible()` | Licensed work goes to the company when a cleared licensed tech on its crew covers the trade and the crew can be sent (Addendum and workers' comp). `crew_license_trades` updates automatically on add, remove and background-check changes. |
| The job | `startJob` / job sheet | **Office-only owners must pick a crew member before starting.** An unlicensed owner on licensed work must assign a licensed tech. The job sheet explains why, and the picker drops "Me" for office-only owners. |
| Customer | `job_pro()` RPC (web + mobile) | With "company name", customers see **Atkins & Sons** and the first name of whoever came out, not the owner's first name. |
| Hub | `/hub/pros/[id]` | The crew panel shows for every crew company with the owner on-site choice, the display choice and the trades licensed through the crew. |
| Money / 1099 | unchanged | The company is paid, and the 1099 goes to the W-9 entity. Crew are never paid by Handled. |

## Gaps found (all fixed in this change)

1. Sign-up only asked for a crew size number and a free-text note. There was no solo/crew choice, no preferences and no roster.
2. The invite dropped everything except crew size → capacity.
3. A crew company could sign the **no-employees** workers' comp statement and go live, then find out at assignment that it couldn't send anyone.
4. The Crew Addendum wasn't on the onboarding checklist.
5. Licensed work required the **owner's** license, even when a licensed tech on the crew holds it.
6. Nothing stopped an office-only owner's job from starting with no crew member assigned. The job then read as if the owner did it.
7. Customers always saw the owner's first name, with no option to be shown as the company.
8. The Hub only showed a crew panel once someone was listed. The recruiting page showed only the crew size.

## Still open (not in this change)

- **Mobile app:** the pro application and "How you work with us" are web-only for now. Mobile already has crew management and the job picker.
- **Office staff logins:** an office manager can't yet sign in under the company to accept offers. Today it's one login per company.
- **Per-crew capacity:** capacity stays a single daily number the pro sets. It doesn't yet rise automatically as crew members clear their checks.

## To turn on

Run `supabase/setup/ADD_CREW_COMPANIES_2026-10-27_2141.sql` in Supabase (SQL Editor → paste → Run). It is safe to run twice.
Hub → Setup shows "crew companies" as done afterwards. Until then, sign-ups and invites keep working: crew details from
the form are saved into the application note.
