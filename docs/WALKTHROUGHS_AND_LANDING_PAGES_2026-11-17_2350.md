<!--
  FILE    : docs/WALKTHROUGHS_AND_LANDING_PAGES_2026-11-17_2350.md
  PROJECT : Handled (HandledServices) — AI-run home & business services
  CREATED : 2026-11-17_2350 UTC
  PURPOSE : Self-booked free walkthroughs and the landing page for each kind of business.
-->

# Walkthrough booking and business landing pages

A business shouldn't have to email back and forth to get a price. Every sales email, AI reply draft and business
page now leads to one button: **Book a free walkthrough**. They pick their own time and get an exact price the same day.

## Landing pages (one offer, one button)

| Page | For | First job offered | Default booking |
|---|---|---|---|
| `/business/property-managers` | Property managers | Your next unit turnover | On-site walkthrough |
| `/business/offices` | Offices, clinics, facilities | Your first office cleaning | On-site walkthrough |
| `/business/real-estate` | Agents and brokerages | Next listing prep or move-out clean | 10-minute call |
| `/business/self-storage` | Self-storage | Next unit cleanout | 10-minute call |
| `/business/stagers` | Home stagers | Next staging install | 10-minute call |
| `/business/furniture-stores` | Furniture & appliance stores | Next customer deliveries | 10-minute call |
| `/business/hiring` | Businesses hiring cleaners / maintenance | Cover the work while the role is open | 10-minute call |

Sales-email links (`/b/<token>`) now open the page for that lead's kind of business (job-posting leads get **hiring**),
and the lead is carried to the walkthrough or order so it's credited. Pages are in the sitemap; the main `/business`
page links to all of them. Copy lives in `packages/core/src/walkthrough.ts` (`BIZ_LANDINGS`); no $ prices on them.

## Walkthrough booking (`/walkthrough`)

1. They choose **on-site walkthrough** (address required) or **10-minute call** (phone required).
2. They pick a day and time (open times only; weekdays 9–5 Detroit time, every 30 minutes, at least 18 hours ahead,
   up to 14 days out by default).
3. Details: name, company, email, phone, what they need, number of properties. A sales-email lead is pre-filled.
4. They get a confirmation with **Add to Google Calendar** and a private link to **change or cancel**
   (`/walkthrough/<token>`), plus a reminder about a day before.
5. You get a Hub alert and an email (OPS_EMAIL, or the addresses set in Hub → Walkthroughs). A lead that books stops
   getting sales emails and is marked warm.

**Hub → Clients & sales → Walkthroughs:** upcoming list (who's going, notes, map link), **Done + send order link**
(emails them `/book?for=business` carrying the lead), No-show, Cancel; numbers for the last 30 days; booking hours
(days, from/to, slot length, how many at once, notice, how far ahead, time zone).

## Setup

1. Supabase → SQL Editor → run `supabase/setup/ADD_WALKTHROUGHS_2026-11-17_2350.sql`.
2. Hub → Walkthroughs → set your real hours and who gets the booking emails → Save.
3. Try it: open `/business/property-managers`, book a time, check the emails, then mark it Done in the Hub.
