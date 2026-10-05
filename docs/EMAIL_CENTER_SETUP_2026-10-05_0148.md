<!--
  FILE    : docs/EMAIL_CENTER_SETUP_2026-10-05_0148.md
  PROJECT : Handled (myhumanai) — AI-run home & business services
  CREATED : 2026-10-05_0148 UTC
  PURPOSE : How to connect the Hostinger mailbox (info@handledsvc.com) to Hub → Email Center, keep marketing
            email out of spam, and stay within the law.
-->

# Email Center: setup

## 1. Connect the mailbox (5 minutes)
In **Vercel → Project → Settings → Environment Variables** (Production), add:

| Name | Value |
|---|---|
| `SMTP_USER` | `info@handledsvc.com` |
| `SMTP_PASSWORD` | the mailbox password. Type it into Vercel yourself; never paste it in chat, email or git |
| `BUSINESS_POSTAL_ADDRESS` | your business mailing address (required on every marketing email) |

Hostinger's servers are the defaults: SMTP `smtp.hostinger.com:465` (SSL) and IMAP `imap.hostinger.com:993`.
Then **redeploy**, open **Hub → Email Center**, and press **Check mailbox & domain**. Sending (SMTP), Inbox (IMAP),
SPF, DKIM and DMARC should all show ✅.

If `RESEND_API_KEY` is empty, booking and system emails (receipts, reminders) also go out from this mailbox.

## 2. Keep it out of spam (DNS on handledsvc.com)
- **SPF:** a TXT record on `handledsvc.com`: `v=spf1 include:_spf.mail.hostinger.com ~all`
- **DKIM:** turn it on in Hostinger → Emails → your domain → DNS settings. Hostinger adds the `hostingermail-*._domainkey` records.
- **DMARC:** a TXT record on `_dmarc.handledsvc.com`: `v=DMARC1; p=none; rua=mailto:info@handledsvc.com`

Hostinger can usually add all three for you if the domain's DNS is at Hostinger.

## 3. Sending pace
- Hostinger caps how many emails a mailbox sends per day, and the cap depends on your plan. Set **Daily cap**
  in the Email Center below that number.
- Start a new mailbox low: about 100/day in week 1, 200/day in week 2, then grow.
- Campaigns go out in small batches every 10 minutes (the dispatch cron), not all at once.
- Each person gets at most one campaign a week, across all campaigns.
- For cold outreach to businesses that never heard of us, keep using the Instantly sequences (Business leads) on
  their separate warmed-up domain. Cold email from info@ can hurt the main mailbox's reputation.

## 4. The rules the system enforces
- **Footer on every email (CAN-SPAM):** it says why they're getting it, our business name and postal address, and has a one-click unsubscribe (link plus List-Unsubscribe headers for Gmail and Yahoo).
- **Unsubscribes are permanent:** anyone who unsubscribes is never emailed marketing again. Booking messages still go. Staff can add people by hand on the **Do-not-email list**.
- **No deceptive subjects:** a subject starting with "Re:" or "Fwd:" blocks sending.
- **No mystery lists:** pasted lists require ticking "everyone gave permission". Never use bought or scraped lists.
- **No texts:** SMS marketing stays off (TCPA).

## 5. Using it
- **Hub → Email Center → New campaign** (or start from a template). Choose the audience and see how many it reaches, write it with an optional Spanish version, and watch the live preview.
- **Send me a test**, then **Send now** or **Schedule**.
- **Each campaign page** shows sent, clicks, unsubscribes, who clicked (follow up with them), and any failures. You can pause, resume, cancel or duplicate a campaign.
- **Inbox:** read and answer replies from the company mailbox. Each sender is tagged as a customer, business lead or pro, and a business lead who replies is marked "replied" so their sales sequence stops. Your replies are saved to the Sent folder.
