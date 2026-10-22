/*
 * FILE    : packages/core/src/partners.test.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-22_0400 UTC
 * PURPOSE : Referral program rates: refer a person (10%, 12 months), a one-time job (20%) or a recurring job
 *           (15%, 12 months) — always a share of our take, never the pro's pay; the money split and ticket tokens. Run: npm test.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { COMMISSION_BASIS, PARTNER_PROGRAM, REFERRAL_COST_SPLIT, agreementNumber, proSharesReferral, referralCostShares, referralShareEstimate, cleanTicketToken, jobReferralBasis, makeTicketToken, moneySplit, partnerCommission, partnerExpiry, partnerTake, partnerTerms, pctLabel, ticketExpiry } from "./partners.ts";

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

test("money split before the shared bonus: Handled carries it all, the pro's pay doesn't move", () => {
  const m = moneySplit(job, 0.2);
  assert.equal(m.customer, 400); assert.equal(m.pro, 280); assert.equal(m.referrer, 24); assert.equal(m.handled, 96);
  assert.equal(m.proShare, 0); assert.equal(m.handledShare, 24);
  assert.equal(m.pro + m.referrer + m.handled, m.customer);
});

test("ticket tokens are URL-safe and validated", () => {
  const t = makeTicketToken();
  assert.match(t, /^[a-z0-9]{24}$/);
  assert.equal(cleanTicketToken(t), t);
  assert.equal(cleanTicketToken("../etc"), null);
  assert.equal(cleanTicketToken(undefined), null);
});

// ─── Standard Referral Ticket (RT-1) — added 2026-10-22_0600 UTC ───
import { TICKET_SECTIONS, TICKET_STANDARD_VERSION, ticketCheck, ticketNotes } from "./referral-ticket.ts";

const good = {
  customer_name: "Dana Lee", customer_email: "dana@example.com", customer_phone: "(313) 555-0142", address: "123 Main St", city: "Detroit", state: "MI", zip: "48226",
  service_slug: "lawn-care", description: "Front and back yard mowing and edging, about a quarter acre, weekly through fall.",
  frequency: "weekly", urgency: "this_week", answers: { yard_sqft: 10000 }, photos: [] as string[],
  details: { relationship: "my_customer", preferred_contact: "text", property_type: "house" } as const,
  customer_consent: true, customer_expects_contact: true,
};

test("standard ticket: a complete ticket passes, with what would make it better", () => {
  const c = ticketCheck(good);
  assert.deepEqual(c.required, []);
  assert.ok(c.recommended.some((r) => r.startsWith("Photos")));
  assert.ok(c.score >= 70 && c.score < 100);
  assert.equal(TICKET_STANDARD_VERSION, "RT-1");
  assert.deepEqual(TICKET_SECTIONS.map((s) => s.id), ["referrer", "customer", "location", "job", "photos", "confirm"]);
});

test("standard ticket: missing basics, the service's required size and required photos block it", () => {
  const c = ticketCheck({ ...good, customer_phone: "555", details: {}, answers: {}, description: "mow it", customer_expects_contact: false });
  for (const r of ["Mobile phone", "How you know the customer", "Best way to reach them", "Type of property", "What needs doing (30+ characters)"]) assert.ok(c.required.includes(r), r);
  assert.ok(c.required.some((r) => r.startsWith("Size:")));
  const pw = ticketCheck({ ...good, service_slug: "power-washing", answers: { surface: "driveway", sqft: 800 } });
  assert.ok(pw.required.some((r) => r.startsWith("2 photos")));
  assert.deepEqual(ticketCheck({ ...good, service_slug: "power-washing", answers: { surface: "driveway", sqft: 800 }, photos: ["a", "b"] }).required, []);
  assert.ok(c.score < ticketCheck(good).score);
});

test("standard ticket: notes for the pro carry property, pets, parking and the wished date", () => {
  const n = ticketNotes({ ...good, details: { ...good.details, occupancy: "vacant", pets: "Two dogs, friendly", parking: "Driveway", preferred_date: "2026-11-02" } });
  for (const s of ["Property: House, empty.", "Pets: Two dogs, friendly.", "Parking: Driveway.", "2026-11-02"]) assert.ok(n.includes(s), s);
});

// ─── Shared referral bonus: half Handled, half the pro — added 2026-10-22_0900 UTC ───
test("shared bonus: half from Handled's take, half from the pro's pay — worked examples", () => {
  // $400 job, pro paid $280, Handled's take $120
  const once = moneySplit(job, 0.2, true);   // one-time ticket: 20% of $120 = $24 → pro $12, Handled $12
  assert.deepEqual([once.referrer, once.proShare, once.handledShare, once.pro, once.handled], [24, 12, 12, 268, 108]);
  const rec = moneySplit(job, 0.15, true);   // recurring ticket: 15% of $120 = $18 → $9 / $9
  assert.deepEqual([rec.referrer, rec.proShare, rec.handledShare, rec.pro, rec.handled], [18, 9, 9, 271, 111]);
  const person = moneySplit(job, 0.1, true); // referred person: 10% of $120 = $12 → $6 / $6
  assert.deepEqual([person.referrer, person.proShare, person.handledShare, person.pro, person.handled], [12, 6, 6, 274, 114]);
  assert.deepEqual(REFERRAL_COST_SPLIT.pro + REFERRAL_COST_SPLIT.handled, 1);
});

test("shared bonus: odd cents go to Handled, shares always add up to the bonus exactly", () => {
  assert.deepEqual(referralCostShares(10.01), { pro: 5, handled: 5.01 });
  assert.deepEqual(referralCostShares(0.01), { pro: 0, handled: 0.01 });
  assert.deepEqual(referralCostShares(24, false), { pro: 0, handled: 24 });
  assert.deepEqual(referralCostShares(-3), { pro: 0, handled: 0 });
  for (let c = 0; c <= 5000; c += 7) { const s = referralCostShares(c / 100); assert.equal(Math.round((s.pro + s.handled) * 100), c, `c=${c}`); assert.ok(s.pro <= s.handled); }
});

test("shared bonus: customer = pro + referrer + Handled to the cent, for any price, pay, refund and rate", () => {
  let seed = 7; const rnd = () => ((seed = (seed * 48271) % 2147483647) / 2147483647);
  for (let i = 0; i < 3000; i++) {
    const price = Math.round(rnd() * 500000) / 100, payout = Math.round(price * (0.55 + rnd() * 0.3) * 100) / 100, refunded = rnd() < 0.2 ? Math.round(rnd() * price * 100) / 100 : 0;
    for (const pct of [0.1, 0.15, 0.2]) for (const proPays of [true, false]) {
      const m = moneySplit({ price, payout, refunded }, pct, proPays);
      assert.equal(Math.round((m.pro + m.referrer + m.handled) * 100), Math.round(m.customer * 100), JSON.stringify({ price, payout, refunded, pct, proPays }));
      assert.equal(Math.round((m.proShare + m.handledShare) * 100), Math.round(m.referrer * 100));
      assert.ok(m.referrer <= m.take * pct + 0.005);            // the bonus is never more than the rate on our take
      assert.ok(m.proShare <= m.referrer / 2 + 1e-9);           // the pro never carries more than half
    }
  }
});

test("shared bonus: the bonus is worked out on the pro's FULL pay (their half never feeds back in)", () => {
  // if the pro's half were taken first, our take would look bigger and the bonus would grow — it must not
  assert.equal(moneySplit(job, 0.2, true).referrer, moneySplit(job, 0.2, false).referrer);
  assert.equal(referralShareEstimate({ price: 400, payout: 280 }, 0.2), 12);
});

test("shared bonus: refunds shrink the bonus and both halves with it", () => {
  // $60 refunded comes out of our take first: take $60 → bonus $12 → pro $6, Handled $6 → Handled keeps $60 − $6 = $54
  const m = moneySplit({ price: 400, payout: 280, refunded: 60 }, 0.2, true); // take $60 → bonus $12 → $6 / $6
  assert.deepEqual([m.referrer, m.proShare, m.handledShare, m.pro, m.handled, m.customer], [12, 6, 6, 274, 54, 340]);
  const gone = moneySplit({ price: 400, payout: 280, refunded: 200 }, 0.2, true); // take below zero → no bonus, no share
  assert.deepEqual([gone.referrer, gone.proShare], [0, 0]);
});

test("shared bonus: only on jobs accepted from the effective date, under agreement v10 or later", () => {
  const after = "2026-11-22T00:00:00Z", before = "2026-11-21T23:59:59Z";
  assert.equal(agreementNumber("2026-10-v10"), 10); assert.equal(agreementNumber("2026-10-v9"), 9); assert.equal(agreementNumber(null), 0);
  assert.equal(proSharesReferral({ acceptedAt: after, agreementVersion: "2026-10-v10" }), true);
  assert.equal(proSharesReferral({ acceptedAt: after, agreementVersion: "2026-12-v11" }), true);
  assert.equal(proSharesReferral({ acceptedAt: before, agreementVersion: "2026-10-v10" }), false); // accepted under the old terms
  assert.equal(proSharesReferral({ acceptedAt: after, agreementVersion: "2026-10-v9" }), false);   // hasn't signed the new agreement
  assert.equal(proSharesReferral({ acceptedAt: null, agreementVersion: "2026-10-v10" }), false);   // no accepted offer on record
});

test("shared bonus: the work order shows the pro their half before they accept (from the effective date only)", async () => {
  const { buildWorkOrder } = await import("./workorder.ts");
  const wjob = { ref: "H-1", service_slug: "lawn-care", answers: {}, notes: null, scheduled_date: null, time_window: "morning", address: "1 Main", city: "Detroit", state: "MI", zip: "48226", contact_name: "A", contact_phone: "1", company_name: null, contractor_payout: 280, price_final: 400, referral_pct: 0.2 } as never;
  const after = buildWorkOrder(wjob, { reveal: false, now: new Date("2026-11-22T12:00:00Z") }).terms.join(" ");
  assert.ok(after.includes("$24 referral bonus") && after.includes("$12 comes out of this payout") && after.includes("you receive $268"), after);
  const before = buildWorkOrder(wjob, { reveal: false, now: new Date("2026-11-01T12:00:00Z") }).terms.join(" ");
  assert.ok(!before.includes("referral bonus"));
  const notReferred = buildWorkOrder({ ...(wjob as object), referral_pct: null } as never, { reveal: false, now: new Date("2026-12-01T12:00:00Z") }).terms.join(" ");
  assert.ok(!notReferred.includes("referral bonus"));
});

// ─── Security: referral tickets can't claim bookings that would have happened anyway — added 2026-10-22_1100 UTC ───
test("security: an existing customer's own rebooking is never credited to a ticket without its link", async () => {
  const { ticketCredit } = await import("./partners.ts");
  assert.equal(ticketCredit({ viaLink: false, customerHadPaidJobBefore: true }), false);  // organic rebooking → no bonus
  assert.equal(ticketCredit({ viaLink: true, customerHadPaidJobBefore: true }), true);    // booked from the ticket link → bonus
  assert.equal(ticketCredit({ viaLink: false, customerHadPaidJobBefore: false }), true);  // a new customer the ticket brought in
  assert.equal(ticketCredit({ viaLink: true, customerHadPaidJobBefore: false }), true);
});

test("security: pros can't ticket their own customers; existing customers go to staff review", async () => {
  const { ticketIntake, PRO_OWN_CUSTOMER_DAYS } = await import("./partners.ts");
  assert.equal(PRO_OWN_CUSTOMER_DAYS, 365);
  const own = ticketIntake({ existingCustomer: true, proServedSameService: true, proServedOtherService: false, clear: true });
  assert.equal(own.ok, false);
  const other = ticketIntake({ existingCustomer: true, proServedSameService: false, proServedOtherService: true, clear: true });
  assert.ok(other.ok && other.status === "needs_review" && /new work/.test(other.reason ?? ""));
  const existing = ticketIntake({ existingCustomer: true, proServedSameService: false, proServedOtherService: false, clear: true });
  assert.ok(existing.ok && existing.status === "needs_review");
  const fresh = ticketIntake({ existingCustomer: false, proServedSameService: false, proServedOtherService: false, clear: true });
  assert.ok(fresh.ok && fresh.status === "open" && fresh.reason === null);
  const unclear = ticketIntake({ existingCustomer: false, proServedSameService: false, proServedOtherService: false, clear: false });
  assert.ok(unclear.ok && unclear.status === "needs_review");
});
