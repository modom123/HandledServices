/*
 * FILE    : packages/core/src/partners.test.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-22_0400 UTC
 * PURPOSE : Referral program rates: refer a person (10%, 12 months), a one-time job (20%) or a recurring job
 *           (15%, 12 months) — always a share of our take, never the pro's pay; the money split and ticket tokens. Run: npm test.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { COMMISSION_BASIS, PARTNER_PROGRAM, cleanTicketToken, jobReferralBasis, makeTicketToken, moneySplit, partnerCommission, partnerExpiry, partnerTake, partnerTerms, pctLabel, ticketExpiry } from "./partners.ts";

const job = { price: 400, payout: 280 }; // our take: $120

test("refer a person pays 10% of our take", () => {
  assert.equal(partnerTake(job), 120);
  assert.equal(partnerCommission(job), 12);
  assert.equal(partnerCommission(job, COMMISSION_BASIS.person.pct), 12);
});

test("refer a one-time job pays 20%, a recurring job 15%", () => {
  assert.equal(partnerCommission(job, COMMISSION_BASIS[jobReferralBasis("once")].pct), 24);
  for (const f of ["weekly", "biweekly", "monthly", "quarterly"]) assert.equal(jobReferralBasis(f), "job_recurring");
  assert.equal(partnerCommission(job, COMMISSION_BASIS.job_recurring.pct), 18);
});

test("commission follows refunds down and never goes negative or above half our take", () => {
  assert.equal(partnerCommission({ ...job, refunded: 60 }, 0.2), 12);
  assert.equal(partnerCommission({ price: 100, payout: 120 }, 0.2), 0);
  assert.equal(partnerCommission(job, 5), 60);
  assert.equal(partnerCommission(job, -1), 0);
});

test("rounds down to the cent without losing a cent to floating point", () => {
  assert.equal(partnerCommission({ price: 7, payout: 0 }, 0.15), 1.05);
  assert.equal(partnerCommission({ price: 33.33, payout: 0 }, 0.15), 4.99);
});

test("windows: 12 months to earn, 60 days to book a referral ticket", () => {
  const start = new Date("2026-10-22T00:00:00Z");
  assert.equal(partnerExpiry(start).toISOString().slice(0, 10), "2027-10-22");
  assert.equal(ticketExpiry(start).toISOString().slice(0, 10), "2026-12-21");
  assert.equal(PARTNER_PROGRAM.termsVersion, "partner-v2");
});

test("terms state every rate in plain numbers", () => {
  const t = partnerTerms().join(" ");
  for (const s of ["10%", "20%", "15%", "12 months", "60 days"]) assert.ok(t.includes(s), s);
  assert.equal(pctLabel(0.15), "15");
});

test("money split: customer = pro + referrer + Handled, and the pro's pay never moves", () => {
  const m = moneySplit(job, 0.2);
  assert.deepEqual(m, { customer: 400, pro: 280, referrer: 24, handled: 96 });
  assert.equal(m.pro + m.referrer + m.handled, m.customer);
  assert.equal(moneySplit(job, 0.15).pro, 280);
});

test("ticket tokens are URL-safe and validated", () => {
  const t = makeTicketToken();
  assert.match(t, /^[a-z0-9]{24}$/);
  assert.equal(cleanTicketToken(t), t);
  assert.equal(cleanTicketToken("../etc"), null);
  assert.equal(cleanTicketToken(undefined), null);
});
