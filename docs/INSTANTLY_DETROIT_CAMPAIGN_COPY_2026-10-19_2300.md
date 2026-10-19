<!--
FILE    : docs/INSTANTLY_DETROIT_CAMPAIGN_COPY_2026-10-19_2300.md
PROJECT : Handled (HandledServices) — AI-run home & business services
CREATED : 2026-10-19_2300 UTC
PURPOSE : Email copy for the Instantly campaign "1ST OUTREACH DETROIT" (3de836a0-4845-4350-80af-db9725831b43),
          commercial cleaning outreach to Detroit businesses. Setup: INSTANTLY_DETROIT_CAMPAIGN_SETUP_2026-10-19_2230.md.
-->
# 1ST OUTREACH DETROIT: email copy

The campaign uses its own copy (setup option B). `{{firstName}}` and `{{companyName}}` come from the lead's first name and company, which our sales engine fills when it adds a lead. Replies reach Hub → Business leads, and the AI reply agent drafts the answers.

Paste each step into Instantly as written. Replace `[mailing address]` with the business address, the same one as `BUSINESS_POSTAL_ADDRESS` in Vercel.

## Step 1 (day 0)
**Subject:** Cleaning for {{companyName}}

```
Hi {{firstName}},

I'm with Handled, a Detroit company that manages commercial cleaning: offices, common areas, move-outs and floors, done by vetted, insured local crews. We schedule, check the work with photos, and send one invoice, so there's nothing for your team to chase.

Who handles cleaning and janitorial for {{companyName}}? If it's you, I'd be glad to do a free walkthrough and quote, with no commitment.

Would a 15-minute call this week work?

Best,
{{sendingAccountFirstName}}
Handled Services LLC · [mailing address]
Not the right person, or don't want these emails? Just reply "no thanks."
```

## Step 2 (3 days later, same thread)
```
Hi {{firstName}}, just following up. If cleaning at {{companyName}} is handled by a contract that's up for renewal, we can quote it side by side so you can compare. Worth a look?

{{sendingAccountFirstName}}
Handled Services LLC · [mailing address]
Reply "no thanks" and I won't email again.
```

## Step 3 (5 days later, same thread)
```
Hi {{firstName}}, last note from me. If a free walkthrough would help, just reply with a good day and I'll set it up. If not, no worries, and I won't follow up again.

{{sendingAccountFirstName}}
Handled Services LLC · [mailing address]
```

## Before you launch
- **No made-up results.** Only cite a client result (e.g. "cut coordination time 30%") if it's real and you can back it up. Invented results are deceptive advertising (FTC rules, and CAN-SPAM's ban on misleading content).
- **CAN-SPAM:** every email carries the postal address and a way to opt out. Turn on Instantly's unsubscribe link in the campaign settings as well. Anyone who says no is blocked automatically; the AI reply agent handles it.
- **Blank first names:** set a fallback for `{{firstName}}` in Instantly (e.g. "there"), or make sure every lead has a first name, so no email opens with "Hi ,".
- **Prices:** never quote a price or start date by email. Offer the free walkthrough or quote. The AI's draft replies follow the same rule.
- **Volume:** start at 20–30 emails a day per warmed inbox, from a separate sending domain, not info@handledsvc.com.

## If you switch to AI-written emails later (setup option A)
Replace the steps with `{{subject_1}}` / `{{body_1}}` through `{{subject_3}}` / `{{body_3}}`. Each lead the engine adds then gets its own personalized sequence with a tracked sign-up link (`{{signup_url}}`).
