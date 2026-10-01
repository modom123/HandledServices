/*
 * FILE    : packages/core/src/pricing.test.ts
 * PROJECT : Handled — AI-run home & business services
 * CREATED : 2026-10-01_1723 UTC
 * PURPOSE : Unit tests for the pricing engine and dispatch ranking.
 *           Run: npm test (node --test, no extra dependencies).
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { SERVICES, defaultAnswers } from "./services.ts";
import { estimate, clampAiPrice, AI_MAX_ADJUST } from "./pricing.ts";
import { rankContractors } from "./dispatch.ts";
import type { Contractor } from "./types.ts";

test("every service prices its default answers at or above its minimum", () => {
  for (const svc of SERVICES) {
    const e = estimate({ slug: svc.slug, answers: defaultAnswers(svc) });
    assert.ok(e.point >= svc.minimum, `${svc.slug} point ${e.point} < min ${svc.minimum}`);
    assert.ok(e.low <= e.point && e.point <= e.high, `${svc.slug} range ${e.low}-${e.high} excludes ${e.point}`);
    assert.equal(e.payout + e.margin, e.point);
    assert.ok(e.margin > 0, `${svc.slug} has no margin`);
  }
});

test("recurring plans are discounted", () => {
  const answers = defaultAnswers(SERVICES[0]);
  const once = estimate({ slug: "house-cleaning", answers });
  const weekly = estimate({ slug: "house-cleaning", answers, frequency: "weekly" });
  assert.ok(weekly.point < once.point);
});

test("unsupported frequency falls back to once", () => {
  const e = estimate({ slug: "junk-removal", answers: {}, frequency: "weekly" });
  assert.equal(e.discount, 0);
});

test("AI price is clamped to guardrails", () => {
  const e = estimate({ slug: "junk-removal", answers: { volume: "half" } });
  assert.equal(clampAiPrice(e, e.point * 10), Math.round(e.point * (1 + AI_MAX_ADJUST)));
  assert.equal(clampAiPrice(e, 1), Math.round(e.point * (1 - AI_MAX_ADJUST)));
});

test("dispatch filters ineligible pros and ranks the rest", () => {
  const base: Contractor = {
    id: "a", profile_id: null, business_name: "A", contact_name: "A", email: "a@x", phone: "1",
    trades: ["hauling"], service_zips: ["48201"], status: "approved", rating: 4.9, jobs_completed: 120,
    acceptance_rate: 0.9, on_time_rate: 0.95, insured_until: "2099-01-01", license_number: null,
    background_checked: true, daily_capacity: 3, notes: null, coverage: { auto: "2099-01-01" },
  };
  const pros: Contractor[] = [
    base,
    { ...base, id: "b", rating: 4.2 },
    { ...base, id: "c", trades: ["lawn"] },
    { ...base, id: "d", insured_until: "2000-01-01" },
    { ...base, id: "e", service_zips: ["90210"] },
  ];
  const ranked = rankContractors(pros, { service_slug: "junk-removal", zip: "48201", scheduled_date: null });
  assert.deepEqual(ranked.map((r) => r.contractor.id), ["a", "b"]);
});

test("every service keeps our take between 15% and 35%", async () => {
  const { TAKE_MIN, TAKE_MAX } = await import("./pricing.ts");
  for (const svc of SERVICES) {
    const take = 1 - svc.payoutShare;
    assert.ok(take >= TAKE_MIN && take <= TAKE_MAX, `${svc.slug} take ${take}`);
  }
});

test("splitJob never pays out more than the band allows, at any price", async () => {
  const { splitJob, TAKE_MIN, TAKE_MAX } = await import("./pricing.ts");
  for (const svc of SERVICES) {
    for (let price = 1; price <= 5000; price += 7) {
      const sp = splitJob(price, svc.slug);
      assert.ok(sp.payout <= price * (1 - TAKE_MIN) + 1e-9, `${svc.slug} @${price}: payout ${sp.payout} too high`);
      assert.ok(sp.take >= price * TAKE_MIN - 1e-9, `${svc.slug} @${price}: take ${sp.take} below 15%`);
      assert.ok(sp.take <= price * TAKE_MAX + 1, `${svc.slug} @${price}: take ${sp.take} above 35% + $1 rounding`);
      assert.ok(sp.payout >= 0 && sp.take > 0);
    }
  }
});

test("every default quote earns money after card fees", async () => {
  const { splitJob } = await import("./pricing.ts");
  for (const svc of SERVICES) {
    const e = estimate({ slug: svc.slug, answers: defaultAnswers(svc), frequency: svc.frequencies.at(-1) });
    const sp = splitJob(e.point, svc.slug);
    assert.ok(sp.net > 0, `${svc.slug} loses money after card fees: ${JSON.stringify(sp)}`);
  }
});

test("refunds never push our take below zero", async () => {
  const { refundSplit, splitJob } = await import("./pricing.ts");
  for (const svc of SERVICES) {
    for (const price of [20, 99, 259, 1200, 24000]) {
      const { payout } = splitJob(price, svc.slug);
      for (const pct of [0.1, 0.5, 1, 1.5]) {
        for (const proAtFault of [false, true]) {
          const r = refundSplit({ paid: price, alreadyRefunded: 0, payout, refund: price * pct, proAtFault });
          assert.ok(r.refund <= price, "refund capped at amount paid");
          assert.ok(r.takeAfter >= -0.01, `${svc.slug} @${price} refund ${pct} fault=${proAtFault}: take ${r.takeAfter}`);
          assert.ok(r.newPayout >= 0);
        }
      }
    }
  }
});

test("licensed work only goes to pros with a license on file", async () => {
  const base: Contractor = {
    id: "p", profile_id: null, business_name: "P", contact_name: "P", email: "p@x", phone: "1", trades: ["plumbing"],
    service_zips: [], status: "approved", rating: 4.8, jobs_completed: 10, acceptance_rate: 1, on_time_rate: 1,
    insured_until: "2099-01-01", license_number: null, background_checked: true, daily_capacity: 3, notes: null,
  };
  const job = { service_slug: "water-heater", zip: "48201", scheduled_date: null };
  assert.equal(rankContractors([base], job).length, 0);
  assert.equal(rankContractors([{ ...base, license_number: "MI-PL-123" }], job).length, 1);
});

test("onboarding blocks activation until every step is done", async () => {
  const { onboardingChecklist, AGREEMENT_VERSION, LICENSED_TRADES } = await import("./compliance.ts");
  assert.deepEqual([...LICENSED_TRADES].sort(), ["catering", "electrical", "food_truck", "hvac", "plumbing", "remodel"]);
  const future = new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10);
  const ok = { status: "vetting", trades: ["cleaning"], legal_name: "Dana Reyes", tin_last4: "1234", w9_received_at: "2026-10-01", agreement_version: AGREEMENT_VERSION,
    agreement_signed_at: "2026-10-01", insured_until: future, license_number: null, license_expires: null, background_checked: true, payout_method: "ach",
    specialties: ["standard_clean"], coverage: { bond: future, workers_comp: "exempt" } };
  assert.equal(onboardingChecklist(ok).complete, true);
  assert.equal(onboardingChecklist({ ...ok, tin_last4: null }).complete, false);
  assert.equal(onboardingChecklist({ ...ok, agreement_version: "old" }).complete, false);
  assert.equal(onboardingChecklist({ ...ok, trades: ["plumbing"] }).complete, false, "plumber needs a license");
  assert.equal(onboardingChecklist({ ...ok, trades: ["plumbing"], license_number: "PL-1", license_expires: future }).complete, true);
  assert.equal(onboardingChecklist({ ...ok, coverage: { workers_comp: "exempt" } }).complete, false, "in-home cleaners need a bond");
  assert.equal(onboardingChecklist({ ...ok, trades: ["remodel"], license_number: "RB-1", license_expires: future }).complete, false, "remodelers need a real workers' comp policy");
  assert.equal(onboardingChecklist({ ...ok, trades: ["remodel"], license_number: "RB-1", license_expires: future, coverage: { workers_comp: future } }).complete, true);
});

test("square footage drives the price wherever it's asked", async () => {
  for (const svc of SERVICES) {
    const q = svc.questions.find((x) => x.type === "number" && /sq ?ft/i.test(x.unit ?? ""));
    if (!q || q.type !== "number") continue;
    const at = (v: number) => estimate({ slug: svc.slug, answers: { ...defaultAnswers(svc), [q.id]: v } }).point;
    const span = q.max - q.min;
    const lo = Math.round(q.min + span * 0.05), mid = Math.round(q.min + span * 0.25), hi = Math.round(q.min + span * 0.5);
    assert.ok(at(mid) >= at(lo), `${svc.slug}: ${mid} sq ft should cost ≥ ${lo} sq ft`);
    assert.ok(at(hi) > at(lo), `${svc.slug}: ${hi} sq ft should cost more than ${lo} sq ft`);
  }
  const clean = (sqft: number) => estimate({ slug: "house-cleaning", answers: { sqft, bedrooms: 2, bathrooms: 1, level: "standard" } }).point;
  assert.ok(clean(1000) < clean(1800) && clean(1800) < clean(3000), "house cleaning scales with sq ft");
  const carpet = (sq: number) => estimate({ slug: "carpet-cleaning", answers: { rooms: 3, carpet_sqft: sq } }).point;
  assert.ok(carpet(2000) > carpet(800), "carpet sq ft scales");
});

test("calendar availability: capacity, booked jobs, closed days, no-pro areas", async () => {
  const { buildAvailability } = await import("./availability.ts");
  const pro: Contractor = {
    id: "a", profile_id: null, business_name: "A", contact_name: "A", email: "a@x", phone: "1", trades: ["cleaning"],
    service_zips: ["48201"], status: "approved", rating: 4.9, jobs_completed: 10, acceptance_rate: 1, on_time_rate: 1,
    insured_until: "2099-01-01", license_number: null, background_checked: true, daily_capacity: 3, notes: null, coverage: { bond: "2099-01-01" },
  };
  const start = new Date("2026-10-05T12:00:00Z"); // a Monday
  const jobs = [
    { contractor_id: "a", scheduled_date: "2026-10-05", time_window: "morning" as const },
    { contractor_id: "a", scheduled_date: "2026-10-06", time_window: "morning" as const },
    { contractor_id: "a", scheduled_date: "2026-10-06", time_window: "midday" as const },
    { contractor_id: "a", scheduled_date: "2026-10-06", time_window: "afternoon" as const },
  ];
  const r = buildAvailability({ slug: "house-cleaning", zip: "48201", contractors: [pro], jobs, start, days: 7 });
  assert.equal(r.mode, "live");
  const mon = r.days[0], tue = r.days[1], sun = r.days[6];
  assert.equal(mon.spots, 2); assert.equal(mon.windows.morning, 0); assert.equal(mon.windows.midday, 1);
  assert.equal(tue.level, "full");
  assert.equal(sun.level, "closed");
  const none = buildAvailability({ slug: "house-cleaning", zip: "90210", contractors: [pro], jobs, start, days: 3 });
  assert.equal(none.mode, "request");
  assert.equal(none.days[0].level, "request");
});

test("plan-by-budget splits exactly the budget and flags tight budgets", async () => {
  const { planEventBudget } = await import("./event-budget.ts");
  for (const [budget, guests, type] of [[5000, 50, "birthday"], [10000, 120, "corporate"], [25000, 150, "wedding"], [1000, 100, "birthday"]] as const) {
    const p = planEventBudget({ budget, guests, eventType: type });
    assert.equal(p.lines.reduce((t, l) => t + l.amount, 0), budget, `${type} lines must sum to budget`);
    assert.ok(p.lines.every((l) => l.amount > 0));
  }
  assert.ok(planEventBudget({ budget: 1000, guests: 100, eventType: "birthday" }).warnings.length > 0);
  assert.equal(planEventBudget({ budget: 5000, guests: 50, eventType: "birthday", haveVenue: true }).lines.some((l) => l.key === "venue"), false);
  const e = estimate({ slug: "event-package", answers: { budget: 10000, guests: 120, event_type: "corporate", venue: "need" } });
  assert.equal(e.point, 10000); assert.equal(e.low, 10000); assert.equal(e.high, 10000);
});

test("work order hides the exact address until the pro accepts", async () => {
  const { buildWorkOrder } = await import("./workorder.ts");
  const job = { ref: "H-1", service_slug: "plumbing", answers: { issue: "leak", count: 1, emergency: false }, notes: "Under kitchen sink", scheduled_date: "2026-10-05",
    time_window: "morning" as const, address: "12 Elm St", city: "Detroit", state: "MI", zip: "48226", contact_name: "Ann Lee", contact_phone: "313", company_name: null, contractor_payout: 181, instructions: "Bring a shutoff key" };
  const before = buildWorkOrder(job, { reveal: false });
  assert.ok(!before.where.includes("12 Elm St") && before.customer === undefined);
  const after = buildWorkOrder(job, { reveal: true });
  assert.ok(after.where.includes("12 Elm St") && after.customer?.name === "Ann Lee");
  assert.ok(after.terms.some((t) => t.includes("Licensed trade")), "licensed services add the license term");
  assert.equal(after.instructions, "Bring a shutoff key");
});

test("deposits: big tickets only, sensible amounts, balance due before the job", async () => {
  const { depositPolicy } = await import("./pricing.ts");
  const now = new Date("2026-10-01T12:00:00Z");
  assert.equal(depositPolicy("house-cleaning", 246, "2026-10-20", now).allowed, false, "small jobs pay in full");
  const remodel = depositPolicy("bathroom-remodel", 20000, "2026-11-15", now);
  assert.equal(remodel.amount, 6000); assert.equal(remodel.balance, 14000); assert.equal(remodel.balanceDue, "2026-11-12");
  const party = depositPolicy("catering", 1920, "2026-12-12", now);
  assert.equal(party.amount, 960); assert.equal(party.balanceDue, "2026-12-05");
  assert.equal(depositPolicy("catering", 1920, "2026-10-05", now).allowed, false, "too close to the event — pay in full");
  assert.equal(depositPolicy("handyman", 1200, null, now).amount, 360, "$1,000+ qualifies");
  assert.equal(depositPolicy("tree-removal", 300, "2026-11-01", now).amount, 100, "minimum deposit");
});

test("pro tiers: earned from live stats; boosts never push our take below 15%", async () => {
  const { PRO_TIERS, proTier, tierPayout, nextTierProgress, samplePayouts } = await import("./pro-program.ts");
  const { splitJob, TAKE_MIN } = await import("./pricing.ts");
  const stats = (jobs: number, rating: number, onTime = 0.97, acceptance = 0.9) => ({ jobs_completed: jobs, rating, on_time_rate: onTime, acceptance_rate: acceptance });
  assert.equal(proTier(stats(3, 5)).id, "pro");
  assert.equal(proTier(stats(30, 4.8)).id, "pro_plus");
  assert.equal(proTier(stats(150, 4.9)).id, "elite");
  assert.equal(proTier(stats(150, 4.9, 0.8)).id, "pro"); // late too often
  assert.ok(nextTierProgress(stats(20, 4.8)).todo.some((t) => t.includes("5 more")));
  for (const svc of SERVICES) {
    for (const price of [svc.minimum, 250, 1234, 25000]) {
      const base = splitJob(price, svc.slug).payout;
      for (const tier of PRO_TIERS) {
        const pay = tierPayout(price, base, tier);
        assert.ok(pay >= base, `${svc.slug} tier lowers pay`);
        assert.ok((price - pay) / price >= TAKE_MIN - 1e-9, `${svc.slug} ${tier.id} @${price}: take ${(price - pay) / price}`);
      }
    }
  }
  assert.ok(samplePayouts(["house-cleaning", "junk-removal"]).every((s) => s.payout > 0));
});

test("vetting: trade coverage, probation and specialists in dispatch", async () => {
  const { requiredCoverages, glMinimum, TRADE_PROFILES, PROBATION } = await import("./vetting.ts");
  const { TRADES } = await import("./services.ts");
  for (const t of TRADES) assert.ok(TRADE_PROFILES[t.id], `no vetting profile for trade ${t.id}`);
  assert.deepEqual(requiredCoverages(["hauling", "cleaning"]).sort(), ["auto", "bond"]);
  assert.equal(glMinimum(["lawn", "tree"]), 2_000_000);
  const pro: Contractor = {
    id: "n", profile_id: null, business_name: "N", contact_name: "N", email: "n@x", phone: "1", trades: ["hauling"], service_zips: [], status: "approved",
    rating: 5, jobs_completed: 0, acceptance_rate: 1, on_time_rate: 1, insured_until: "2099-01-01", license_number: null, background_checked: true, daily_capacity: 3, notes: null,
  };
  const job = { service_slug: "junk-removal", zip: "48201", scheduled_date: null, price_final: 300 };
  assert.equal(rankContractors([pro], job).length, 0, "no commercial auto");
  const insured = { ...pro, coverage: { auto: "2099-01-01" } };
  assert.equal(rankContractors([insured], job).length, 1);
  assert.equal(rankContractors([insured], { ...job, price_final: PROBATION.maxJobPrice + 1 }).length, 0, "probation caps job size");
  const [a, b] = rankContractors([{ ...insured, id: "x" }, { ...insured, id: "y", specialties: ["junk"] }], job);
  assert.equal(a.contractor.id, "y", "specialist ranks first");
});
