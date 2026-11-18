<!--
  FILE    : docs/WALKTHROUGHS_AND_LANDING_PAGES_2026-11-17_2350.md
  PROJECT : Handled (HandledServices) — AI-run home & business services
  CREATED : 2026-11-17_2350 UTC
  UPDATED : 2026-11-18_0005 UTC — simpler booking: one screen, four boxes (+ address on site), Book.
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

1. They tap a day and a time.
2. They fill in four boxes: name, company, email, phone. For an on-site visit there's one more: the property address.
   "What do you need done?" is optional. A sales-email lead is pre-filled.
3. They press **Book**. That's it. A small link switches between "we come see it" and "a quick call".
4. They get a confirmation email with **Add to Google Calendar** and a link to change or cancel, plus a reminder about
   a day before.
5. You get a Hub alert and an email (OPS_EMAIL, or the addresses set in Hub → Walkthroughs). A lead that books stops
   getting sales emails and is marked warm.

**Hub → Clients & sales → Walkthroughs:** upcoming list (who's going, notes, map link), **Done + send order link**
(emails them `/book?for=business` carrying the lead), No-show, Cancel; numbers for the last 30 days; booking hours
(days, from/to, slot length, how many at once, notice, how far ahead, time zone).

## Setup

1. Supabase → SQL Editor → run `supabase/setup/ADD_WALKTHROUGHS_2026-11-17_2350.sql`.
2. Hub → Walkthroughs → set your real hours and who gets the booking emails → Save.
3. Try it: open `/business/property-managers`, book a time, check the emails, then mark it Done in the Hub.
