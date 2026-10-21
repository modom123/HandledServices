<!--
FILE    : docs/PRO_MARKETPLACE_2026-10-20_0200.md
PROJECT : Handled (HandledServices) — AI-run home & business services
CREATED : 2026-10-20_0200 UTC
PURPOSE : How the dynamic marketplace works: pros set their own prices (80–175%), customers choose (still one upfront,
          all-in price), customers can name their price, and big jobs get up to 3 firm quotes in 24 hours.
-->
# The Handled marketplace: dynamic, still upfront

Every price a customer sees is **final, all-in, and paid upfront**. What's new is **who sets it**:

| Who sets the price | How | Where |
|---|---|---|
| **Handled's engine** | The job's answers, photos, market factor and area level | Default on every booking ("Fastest match") |
| **The pro** | Their own price card: **80%–175%** of Handled's price per service, plus an optional minimum job | Pro portal → **🏷️ My prices** |
| **The customer** | "Name your price" (75%–300% of ours). Pros decide | Booking page (already live) |
| **Pros, for big jobs** | Firm quotes: up to 3 pros, 24 hours | **/quote-request**. Linked from site-visit services |

## 1. Pro price cards
- **Every service the pro's trades cover** gets a row. For each one:
  - choose "Use Handled's price", or set **your %** (80–175, in steps of 5);
  - optionally set a **minimum job**;
  - toggle **Show to customers**.
- **A live example:** "Typical job: customer pays $X (Handled: $Y) · you earn $Z (Handled: $W)".
- **Local market:** once 3 or more pros price a service, the pro sees the middle half and the median, never other pros' names.
- **The math:** a pro's % applies to **their pay**. The customer's price is built from it with the same commission and booking-fee rules as every job (`priceForPayout`). The pro keeps their whole rate. A pricier pro never costs Handled margin, and a cheaper one never cuts it. The tests check this at every % and job size.

## 2. "Choose your price" at booking
Once the customer enters a ZIP, the price panel shows:
- **Handled's price**, the fastest match;
- **up to 3 pros' prices**, each all-in, with rating and jobs done.

Rules for the pro list:
- **Who appears:** only pros who would actually be offered this job: approved, right trade, licensed, insured, background-checked, in the area, working that day, and not over their probation size limit.
- **Ranking:** rating 35 · on-time 20 · experience 10 · price 35. Quality outweighs price, so the cheapest pro is not automatically first.
- **Honest labels:** **Best value** (lowest of those shown), **Top rated** (4.8★+ with 10+ jobs), **New on Handled** (under 5 jobs).
- **Locked price:** the server recalculates the chosen pro's price at booking. If the pro changed their card in the meantime, the customer is told the new price before paying.
- **First look:** the chosen pro gets the job first for a few hours. If they can't take it, another vetted pro does it **at the same price**.
- **Scope changes** only go through "extra work" with photos and the customer's approval. No surprise charges.

## 3. Request-a-quote (big jobs)
1. **The customer** fills in **/quote-request**: service, description, photos, ZIP, preferred date and contact.
2. **Up to 3 nearby eligible pros** get a private link. They see the job and photos, but not the customer's contact details.
3. **Each pro** enters **what they want to earn**. They see the customer's all-in price live, and add an earliest start date and a note. Or they decline.
4. **The customer** gets an email for each quote. Their private page lists quotes cheapest first, each with **Book this quote**. That goes through normal checkout at that **locked price**, and the pro gets the job first. The other quotes close.
5. **If nobody answers:** after **24 hours**, unanswered invites expire and the next pros are asked, once. If there are still no quotes, the team gets an alert to set up a free site visit. Requests close after 7 days.

## Hub
- **Hub → 🏷️ Marketplace & quotes:**
  - bookings by who set the price (engine, pro price, quote, named price);
  - every quote request with who was asked and the prices;
  - how pros price each service (count, median, middle half).

## Database
Run `supabase/setup/ADD_PRO_MARKETPLACE_2026-10-20_0200.sql` once in Supabase.

## Fairness and legal notes
- **Pros as independent businesses:** pros setting their own prices and choosing which jobs to quote supports their status as independent businesses. Keep the pro agreement consistent with this, and have counsel review it.
- **No collusion tools:** pros see the market median, never named competitor prices.
- **Customers always see the final price** before paying. The booking fee and Handled's commission are inside it.
