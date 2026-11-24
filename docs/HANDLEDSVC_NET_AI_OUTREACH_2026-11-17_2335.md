<!--
  FILE    : docs/HANDLEDSVC_NET_AI_OUTREACH_2026-11-17_2335.md
  PROJECT : Handled (HandledServices) — AI-run home & business services
  CREATED : 2026-11-17_2335 UTC
  PURPOSE : Turning on AI marketing and email outreach from handledsvc.net, the marketing / outreach domain.
-->

# AI email outreach from handledsvc.net

**handledsvc.net** is Handled's marketing and outreach domain. Cold email to businesses goes out from a mailbox there
(for example `mark@handledsvc.net`). **handledsvc.com** keeps bookings, receipts, invoices and the website, so a spam
complaint on cold email can never hurt the emails customers are waiting for. The app refuses to send cold outreach from
handledsvc.com or from a free mailbox (Gmail, Outlook and similar).

## What the AI does

| Where | What happens | Guardrails |
|---|---|---|
| Business sales engine (weekdays) | The **outreach writer** rewrites each email of the 3-email sequence (day 0, 4, 10) for that one business: their type, city, the job they posted, their reviews | Keeps the approved offer word for word. No prices, $ amounts or invented discounts. Only the lead's own link. 170 words or fewer, no spam words, no fake "Re:" on a first email. If the AI's version breaks any rule, the plain template goes instead. The address and unsubscribe footer are always added by code. |
| Follow-ups | Emails 2 and 3 reply in the same thread as email 1, so "Re:" is a real reply | Any reply, bounce or unsubscribe stops the sequence |
| Replies (every 10 minutes) | The **sales reply agent** reads each reply from the handledsvc.net inbox, sorts it (interested, question, not now, no, unsubscribe, out of office) and drafts an answer | Draft is checked: no prices, no links except ours. No's and unsubscribes are honored right away. **Nothing is sent without a person.** |
| Hub → Business leads → a lead | **They replied** card: their words, the AI's draft. Edit it, press **Send from handledsvc.net** and it goes in their thread and is saved to the mailbox's Sent folder. **✨ Draft with AI** writes a new draft. **Email preview** shows what the writer would send that lead | Send is blocked for anyone who unsubscribed, and for any $ amount |
| Hub → Email Center → ✨ Write with AI | The **campaign writer** drafts subject, preview text, body and optional Spanish from a goal you type (or a starter: seasonal push, win back, new service, business accounts, referrals, pro news) | Fills the editor only. The spam/law check runs as usual; you save, test and send it yourself |

Turn personalization off with **AI personalizes each email** in Hub → Business leads (the plain templates go out).
Without `ANTHROPIC_API_KEY`, everything still sends with the templates.

## Setup (about 30 minutes, then 4 weeks of warm-up)

1. **Database.** Supabase → SQL Editor → run `supabase/setup/ADD_AI_OUTREACH_HANDLEDSVC_NET_2026-11-17_2335.sql`
   (and `ADD_BIZ_LEAD_REFRESH_2026-11-11_0100.sql` if it hasn't been run yet).
2. **Mailbox.** At your email host (Hostinger), add the domain handledsvc.net and create one mailbox, e.g.
   `mark@handledsvc.net`. Keep the password in your password manager only.
3. **DNS for handledsvc.net** (at the registrar or Hostinger DNS). All three are needed before sending:
   - **SPF** — TXT on `handledsvc.net`: `v=spf1 include:_spf.mail.hostinger.com ~all`
   - **DKIM** — turn it on for handledsvc.net in Hostinger Email; it adds the `._domainkey` records
   - **DMARC** — TXT on `_dmarc.handledsvc.net`: `v=DMARC1; p=none; rua=mailto:mark@handledsvc.net`
   - Optional: point the handledsvc.net website at handledsvc.com (a redirect), so people who look up the
     domain see the real company.
4. **Vercel → Settings → Environment Variables** (Production), then **redeploy**:
   - `OUTREACH_SMTP_USER` = `mark@handledsvc.net`
   - `OUTREACH_SMTP_PASSWORD` = the mailbox password
   - `OUTREACH_FROM_NAME` = `Mark at Handled`
   - `BUSINESS_POSTAL_ADDRESS` = the real mailing address (required by CAN-SPAM in every email)
   - `ANTHROPIC_API_KEY` (already set if the other AI features work)
5. **Hub → Business leads:** *Send from* → **Our outreach domain: handledsvc.net**, keep **AI personalizes each email**
   on, press **Save**, then **Check outreach mailbox**. Sending, inbox, SPF, DKIM and DMARC should all show ✓.
6. Open any lead and use **Email preview** to read what it would send. Then turn the engine on.

## Warm-up and limits

A new domain starts at **10 emails a day** and ramps to 20, 30, then 40 a day over the first 4 weeks (your
*new sequences/day* setting is the ceiling). Follow-ups due today go first. Keep bounces under 2% and answer
every reply the same day. Businesses only, one offer, honest subject lines, and anyone who unsubscribes is never
emailed again.

## Files

- `packages/core/src/outreach-ai.ts`: domain rules and the AI guardrails (tested in `pricing.test.ts`)
- `apps/web/lib/ai/outreach-writer.ts`: the outreach writer and the campaign writer
- `apps/web/lib/outreach-mail.ts`: the handledsvc.net mailbox (SMTP/IMAP, threading, Sent folder, DNS check)
- `apps/web/lib/biz-leads.ts`: sequence sending, reply drafts, `sendOutreachReply`, `previewOutreachEmail`
- `supabase/migrations/20261117233500_ai_outreach_handledsvc_net.sql`
