<!--
  FILE    : docs/JOB_CHECKLISTS_2026-10-05_0221.md
  PROJECT : Handled (myhumanai) — AI-run home & business services
  CREATED : 2026-10-05_0221 UTC
  PURPOSE : How job checklists work across the system, the format, and how to add or change one.
-->

# Job checklists

Every job goes out with a checklist that spells out what "done" means for that kind of job. A standard clean, a
deep clean and a move-out clean each get a different list, and special instructions always sit at the top.

## Where it shows up
| Who | Where | What they do |
|---|---|---|
| Pro, before accepting | Offer page (web), offer screen (app), offer email | Sees the full checklist and special instructions as part of the work order (v3) |
| Pro, on the job | Job sheet (web), job screen (app) | Checks items off; marks anything that doesn't apply **N/A with a reason**. The job can't be submitted while a required (\*) item is open |
| Customer | Job page (web and app) | Sees what's included, then live progress once work starts; adds up to 5 **special requests** before work starts |
| Staff | Hub → job page | Adds or removes **special instructions** (required or optional) and sees what the pro checked |
| Staff and pros | Hub → Checklists, Pro portal → Checklists | The library: every service's checklist, which items appear for which booking, printable, English or Spanish |
| AI quality review | Runs after the pro submits | Compares the photos with the checklist as checked. N/A reasons that look like skipped paid work go to a person |

## The format (`packages/core/src/checklists.ts`)
- **One template per service**, in English and Spanish, built as **Start → work sections → Finish**:
  - **Start:** scope confirmed and before photos.
  - **Finish:** after photos, area left clean, home secured, and a walkthrough.
  - Pet visits, errands, rides and events use their own start and finish.
- **Items can switch on from the booking answers:**
  - `when: { q: "level", in: ["deep", "move"] }`
  - `{ q: "pets", in: [true] }`
  - `{ q: "stairs", gt: 0 }`
- **Flags on items:** `required` items must be done or marked N/A with a reason; `photo` items need a photo.
- **Item IDs never change** (`kitchen.oven`). Bump `version` when you change a template's text.
- **Frozen on accept:** when a pro accepts, the job keeps the checklist it was accepted with, so its text can't change mid-job. Special instructions stay live.
- **Special instructions, top section, in this order:**
  1. Staff instructions (`jobs.instructions`, one per line)
  2. Instructions added to this job only
  3. The customer's requests
  4. "Customer's notes read and followed"

### Services with their own template
House cleaning (standard / deep / move-out), unit turnover, carpet, windows, gutters, power washing, lawn care,
leaf removal, snow removal, junk removal, large items, junk container, small moves, retail delivery, handyman,
plumbing, water heater, garbage disposal, lighting, interior and exterior painting, tree work, pet waste, dog
walking, organizing, car detailing.

Every other service gets a general checklist built from its booked scope and what it includes.

## Rules
- Items describe the **result** the customer paid for, never how to do the work. Pros are independent businesses
  and choose their own methods, tools and order. Don't add items like "wear our shirt" or "use product X".
- A customer request isn't extra paid work. Anything outside what was booked goes through a change order.
- Changing a template: edit `checklists.ts`, keep item IDs, bump `version`, and run `npm test`. The tests check
  that every service has a checklist, that every item has Spanish, and that conditions only use real booking questions.
