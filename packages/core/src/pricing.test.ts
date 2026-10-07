/*
 * FILE    : packages/core/src/pricing.test.ts
 * PROJECT : Handled — AI-run home & business services
 * CREATED : 2026-10-01_1723 UTC
 * PURPOSE : Unit tests for the pricing engine and dispatch ranking.
 * UPDATED : 2026-10-02_0233 UTC — calculator checks for every service: more of anything never
 *           costs less, and every amount question actually moves the price.
 *           Run: npm test (node --test, no extra dependencies).
 * UPDATED : 2026-10-04_2204 UTC — open job board and favorites first-look windows.
 * UPDATED : 2026-10-05_0130 UTC — job-posting letter (business sales engine).
 * UPDATED : 2026-10-05_0148 UTC — Email Center (merge tags, rendering, law / spam checks).
 * UPDATED : 2026-10-05_0221 UTC — job checklists.
 * UPDATED : 2026-10-05_0246 UTC — pro screening interview.
 * UPDATED : 2026-10-05_0418 UTC — pro rewards.
 * UPDATED : 2026-10-05_1433 UTC — security tests; calendar test pins its clock (it broke on the Monday it was written for).
 * UPDATED : 2026-10-06_0526 UTC — dead animal removal: size, location, extra animals, add-ons, wildlife trade.
 * UPDATED : 2026-10-06_0606 UTC — property-manager sales email now leads with move-out cleans (cleaning push).
 * UPDATED : 2026-10-06_0637 UTC — six new services: prices, licensing, and no rush surcharge on urgent rides.
 * UPDATED : 2026-10-05_1443 UTC — government contracts (SAM.gov parsing, fit, search queries).
 * UPDATED : 2026-10-06_0726 UTC — security: sign-in redirects, server fetches of outside websites, booking photo paths.
 * UPDATED : 2026-10-07_0530 UTC — Handled Points (customer and business loyalty).
 * UPDATED : 2026-10-06_0740 UTC — real sliding pro share (no fixed payoutShare): typical-job take band, estimate share, the scale.
 * UPDATED : 2026-10-06_0752 UTC — every AI agent has a mission role, the two priorities and standing tasks.
 * UPDATED : 2026-10-06_0841 UTC — Request for Proposal scope summary and follow-up questions.
 * UPDATED : 2026-10-06_1950 UTC — coverage: cancel tiers (24h free / 6–24h short notice / under 6h late), time zones, backup order.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { SERVICES, defaultAnswers, getService, type Answers, type Question } from "./services.ts";
import { estimate, clampAiPrice, AI_MAX_RAISE, AI_MAX_CUT, BOOKING_FEE, splitJob, commissionRate } from "./pricing.ts";
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
  assert.equal(clampAiPrice(e, e.point * 10), Math.round(e.point * (1 + AI_MAX_RAISE)));
  assert.equal(clampAiPrice(e, 1), Math.round(Math.max(e.point * (1 - AI_MAX_CUT), 0)), "AI can cut at most 10%");
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

test("every service keeps our take between 15% and 35% on its typical job (real sliding share)", async () => {
  const { TAKE_MIN, TAKE_MAX, typicalProShare } = await import("./pricing.ts");
  for (const svc of SERVICES) {
    const take = 1 - typicalProShare(svc.slug);
    assert.ok(take >= TAKE_MIN - 1e-9 && take <= TAKE_MAX + 1e-9, `${svc.slug} take ${take}`);
  }
});

test("estimate().payoutShare is the real share of the price, not a fixed number", async () => {
  const { estimate, splitJob } = await import("./pricing.ts");
  for (const svc of SERVICES) {
    const e = estimate({ slug: svc.slug, answers: defaultAnswers(svc) });
    assert.equal(e.payout, splitJob(e.point, svc.slug).payout);
    assert.ok(Math.abs(e.payoutShare - e.payout / e.point) < 0.001, `${svc.slug} share ${e.payoutShare}`);
  }
});

test("the sliding scale: pros keep more on small jobs, our cut never passes 35%", async () => {
  const { slidingScale, TAKE_MAX } = await import("./pricing.ts");
  const rows = slidingScale();
  for (let i = 1; i < rows.length; i++) {
    assert.ok(rows[i].payout >= rows[i - 1].payout, "payout rises with price");
    assert.ok(rows[i].commission >= rows[i - 1].commission, "commission slides up with price");
  }
  for (const r of rows) assert.ok(r.takeRate <= TAKE_MAX + 1e-9, `take ${r.takeRate} @${r.price}`);
  assert.equal(rows.find((r) => r.price === 64)!.payout, 51);
  assert.equal(rows.find((r) => r.price === 1004)!.payout, 680);
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
  assert.deepEqual([...LICENSED_TRADES].sort(), ["catering", "electrical", "fire_safety", "food_truck", "foundation", "hvac", "medical_courier", "painting", "plumbing", "remodel", "security", "transportation", "waste_oil"]);
  const future = new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10);
  const ok = { status: "vetting", trades: ["cleaning"], legal_name: "Dana Reyes", tin_last4: "1234", w9_received_at: "2026-10-01", agreement_version: AGREEMENT_VERSION,
    agreement_signed_at: "2026-10-01", insured_until: future, license_number: null, license_expires: null, background_checked: true, payout_method: "ach",
    specialties: ["standard_clean"], coverage: { bond: future, workers_comp: "exempt" }, base_zip: "48201", base_address: "100 Main St", base_city: "Detroit", id_verified_at: "2026-10-01" };
  assert.equal(onboardingChecklist({ ...ok, base_zip: null }).complete, false, "needs work area & hours");
  assert.equal(onboardingChecklist({ ...ok, base_address: null }).complete, false, "needs a place of business, not just a ZIP");
  assert.equal(onboardingChecklist({ ...ok, id_verified_at: null }).complete, false, "needs a verified photo ID");
  assert.equal(onboardingChecklist(ok).complete, true);
  assert.equal(onboardingChecklist({ ...ok, tin_last4: null }).complete, false);
  assert.equal(onboardingChecklist({ ...ok, agreement_version: "old" }).complete, false);
  assert.equal(onboardingChecklist({ ...ok, trades: ["plumbing"] }).complete, false, "plumber needs a license");
  assert.equal(onboardingChecklist({ ...ok, trades: ["plumbing"], license_number: "PL-1", license_expires: future }).complete, true);
  assert.equal(onboardingChecklist({ ...ok, coverage: { workers_comp: "exempt" } }).complete, true, "residential cleaners need no bond (bond only for large commercial jobs)");
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
  const r = buildAvailability({ slug: "house-cleaning", zip: "48201", contractors: [pro], jobs, start, days: 7, now: new Date("2026-10-04T12:00:00Z") });
  assert.equal(r.mode, "live");
  const mon = r.days[0], tue = r.days[1], sun = r.days[6];
  assert.equal(mon.spots, 2); assert.equal(mon.windows.morning, 0); assert.equal(mon.windows.midday, 1);
  assert.equal(tue.level, "full");
  assert.equal(sun.level, "closed");
  const none = buildAvailability({ slug: "house-cleaning", zip: "90210", contractors: [pro], jobs, start, days: 3, now: new Date("2026-10-04T12:00:00Z") });
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
  // the budget is the service price; the booking fee is on top
  assert.equal(e.point, 10000 + BOOKING_FEE); assert.equal(e.low, 10000 + BOOKING_FEE); assert.equal(e.high, 10000 + BOOKING_FEE);
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
  assert.deepEqual(requiredCoverages(["hauling", "cleaning"]).sort(), ["auto"], "cleaners: no bond for regular jobs");
  assert.deepEqual(requiredCoverages(["cleaning"], { customer_type: "commercial", price_final: 2000 }), ["bond"], "big commercial cleaning needs a bond");
  assert.deepEqual(requiredCoverages(["cleaning"], { customer_type: "commercial", price_final: 400 }), [], "small commercial jobs don't");
  assert.deepEqual(requiredCoverages(["cleaning"], { customer_type: "residential", price_final: 5000 }), [], "big homes don't");
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

test("pro policy: who qualifies, and every benefit keeps the job at or above $0", async () => {
  const { PRO_POLICY_DEFAULTS: P, mergePolicy, whyNot, qualifies, showUpPay, instantPayFee, materialsDecision, guaranteeTopUp } = await import("./pro-policy.ts");
  const { refundSplit } = await import("./pricing.ts");
  const pro = { jobs_completed: 3, rating: 4.9, on_time_rate: 1, acceptance_rate: 1, trades: ["handyman"], status: "approved" };
  // rules
  assert.equal(qualifies(P.payProtection, pro), true);
  assert.match(whyNot(P.instantPay, pro) ?? "", /5 completed jobs/);
  assert.match(whyNot(P.guarantee, pro) ?? "", /not offered/); // off by default
  const custom = mergePolicy({ guarantee: { enabled: true, minTier: "pro" }, instantPay: { minJobs: 0 } });
  assert.equal(custom.guarantee.weeklyMinimum, P.guarantee.weeklyMinimum, "unset fields keep defaults");
  assert.match(whyNot(custom.guarantee, pro) ?? "", /trade/);
  assert.equal(qualifies(custom.instantPay, pro), true);
  assert.equal(qualifies(P.materials, { ...pro, trades: ["cleaning"] }), false);
  // 1. pay protection: our take absorbs a no-fault refund; the job never goes below $0
  for (const [paid, payout, refund] of [[200, 150, 30], [200, 150, 80], [200, 150, 200], [1000, 700, 450]]) {
    const s = refundSplit({ paid, alreadyRefunded: 0, payout, refund, protectPro: true });
    assert.ok(s.takeAfter >= -0.001, `take ${s.takeAfter}`);
    assert.equal(Math.round((s.fromPro + s.fromUs) * 100) / 100, s.refund);
    if (refund <= paid - payout) assert.equal(s.fromPro, 0, "fully protected");
  }
  // 2. show-up pay never exceeds the fee we keep after card costs
  for (const paid of [60, 200, 1000, 5000]) assert.ok(showUpPay(P, paid) <= 49 - (paid * 0.029 + 0.3) + 1e-9 || showUpPay(P, paid) === 0);
  assert.equal(showUpPay(P, 200), 35);
  // 3. instant fee
  assert.equal(instantPayFee(P, 10), 0.5);
  assert.equal(instantPayFee(P, 400), 7); // 1.75%
  // 5. materials
  assert.equal(materialsDecision(P, 60, 300), "auto");
  assert.equal(materialsDecision(P, 120, 300), "review");
  assert.equal(materialsDecision(P, 100, 300, 60), "over_cap");
  assert.equal(materialsDecision(P, 180, 53, 0, "errands"), "review", "errand shopping uses a dollar cap");
  assert.equal(materialsDecision(P, 400, 53, 0, "errands"), "over_cap");
  // 6. guarantee
  const g = mergePolicy({ guarantee: { enabled: true } });
  assert.equal(guaranteeTopUp(g, { earned: 500, offered: 10, accepted: 10, daysAvailable: 5, month: 1 }), 300);
  assert.equal(guaranteeTopUp(g, { earned: 500, offered: 10, accepted: 5, daysAvailable: 5, month: 1 }), 0, "turned down offers");
  assert.equal(guaranteeTopUp(g, { earned: 500, offered: 10, accepted: 10, daysAvailable: 5, month: 9 }), 0, "off season");
});

test("intake: required photos, AI corrections and price decisions never underbid", async () => {
  const { photoRule, photoProblem, applyCorrections, aiPriceDecision, scopeChange } = await import("./intake.ts");
  const { getService } = await import("./services.ts");
  for (const slug of ["junk-removal", "water-heater", "power-washing", "kitchen-remodel", "dog-walking", "house-cleaning"]) assert.ok(getService(slug), slug);
  assert.equal(photoRule("junk-removal").need, "required");
  assert.equal(photoRule("dog-walking").need, "none");
  assert.match(photoProblem("junk-removal", 1) ?? "", /at least 2 photos/);
  assert.equal(photoProblem("junk-removal", 2), null);
  assert.equal(photoProblem("house-cleaning", 0), null, "recommended only");
  // corrections stay within the question's limits and re-price
  const { answers, changes } = applyCorrections("power-washing", { surface: "driveway", sqft: 800 }, [{ question_id: "sqft", value: 99999, reason: "photo shows a long driveway" }, { question_id: "nope", value: 1, reason: "x" }]);
  assert.equal(answers.sqft, 6000);
  assert.equal(changes.length, 1);
  const base = estimate({ slug: "power-washing", answers: { surface: "driveway", sqft: 800 } });
  assert.equal(aiPriceDecision(base, base.point * 0.5, { confidence: "high" }).final, Math.round(base.point * 0.9), "max 10% cut");
  assert.equal(aiPriceDecision(base, base.point * 0.8, { confidence: "low" }).final, base.point, "low confidence never lowers");
  assert.equal(aiPriceDecision(base, base.point * 1.3, { confidence: "high" }).final, Math.round(base.point * 1.3));
  assert.equal(aiPriceDecision(base, base.point * 2, { confidence: "high" }).action, "site_visit", "too big → free site visit, not a capped price");
  assert.equal(aiPriceDecision(base, base.point, { needsSiteVisit: true }).action, "site_visit");
  const sc = scopeChange("junk-removal", { volume: "quarter" }, { volume: "full" });
  assert.ok(sc.extra > 0 && sc.after > sc.before);
  assert.equal(scopeChange("junk-removal", { volume: "full" }, { volume: "quarter" }).extra, 0, "never a negative change order");
});

test("dispatch: availability, driving radius and quality decide who gets the offer", async () => {
  const { offDuty, milesBetween } = await import("./dispatch.ts");
  const base: Contractor = {
    id: "a", profile_id: null, business_name: "A", contact_name: "A", email: "a@x", phone: "1", trades: ["cleaning"], service_zips: [], status: "approved",
    rating: 4.8, jobs_completed: 40, acceptance_rate: 0.9, on_time_rate: 0.95, insured_until: "2099-01-01", license_number: null, background_checked: true,
    daily_capacity: 3, notes: null, coverage: { bond: "2099-01-01" }, base_lat: 42.33, base_lng: -83.05, service_radius_mi: 20,
    availability: { days: [1, 2, 3, 4, 5], windows: ["morning", "midday"] }, time_off: ["2026-11-04"],
  };
  // 2026-11-02 is a Monday, 2026-11-07 a Saturday
  assert.equal(offDuty(base, "2026-11-02", "morning"), null);
  assert.match(offDuty(base, "2026-11-07") ?? "", /Saturdays/);
  assert.match(offDuty(base, "2026-11-02", "afternoon") ?? "", /afternoon/);
  assert.equal(offDuty(base, "2026-11-04"), "time off");
  assert.ok(Math.abs(milesBetween({ lat: 42.33, lng: -83.05 }, { lat: 42.48, lng: -83.47 }) - 23.8) < 1.5);
  const near = { service_slug: "house-cleaning", zip: "48201", scheduled_date: "2026-11-02", time_window: "morning", lat: 42.35, lng: -83.06 };
  assert.equal(rankContractors([base], near).length, 1);
  assert.equal(rankContractors([base], { ...near, lat: 42.6, lng: -83.6 }).length, 0, "outside the 20-mile radius");
  assert.equal(rankContractors([base], { ...near, time_window: "afternoon" }).length, 0, "not working afternoons");
  const far = { ...base, id: "far", base_lat: 42.45, base_lng: -83.3 };
  const sloppy = { ...base, id: "sloppy" };
  const ranked = rankContractors([far, sloppy, base], near, {}, { sloppy: { qaPass: 0.6, redoRate: 0.2 }, a: { qaPass: 0.98, redoRate: 0 }, far: { qaPass: 0.98, redoRate: 0 } });
  assert.equal(ranked[0].contractor.id, "a", "close + high quality first");
  assert.equal(ranked[2].contractor.id, "sloppy", "redos and failed QA rank last");
  assert.ok(ranked[0].reasons.some((r) => /mi away/.test(r)));
});

test("painting: rooms and buildings price sensibly", () => {
  const two = estimate({ slug: "interior-painting", answers: { rooms: 2, size: "medium" } }).point;
  const six = estimate({ slug: "interior-painting", answers: { rooms: 6, size: "medium", ceilings: true, trim: true } }).point;
  assert.ok(six > two * 3, "more rooms + ceilings + trim cost more");
  const house = estimate({ slug: "exterior-painting", answers: { sqft: 1800, stories: "2", siding: "wood" } }).point;
  const big = estimate({ slug: "exterior-painting", answers: { sqft: 6000, stories: "3", siding: "masonry", building: "commercial" } }).point;
  assert.ok(house >= 1200 && big > house * 3);
  assert.ok(estimate({ slug: "exterior-painting", answers: { sqft: 1800, trim_only: true } }).point < house, "trim-only is cheaper");
});

test("big jobs get a free site visit instead of an instant price", async () => {
  const { sizeNeedsSiteVisit } = await import("./intake.ts");
  assert.equal(sizeNeedsSiteVisit("exterior-painting", { building: "house", sqft: 2000 }), null);
  assert.ok(sizeNeedsSiteVisit("exterior-painting", { building: "commercial", sqft: 2000 }));
  assert.ok(sizeNeedsSiteVisit("interior-painting", { rooms: 20 }));
  assert.equal(sizeNeedsSiteVisit("house-cleaning", { bedrooms: 9 }), null);
});

test("removal: weight classes, heaviest item and the junk container", async () => {
  const { sizeNeedsSiteVisit } = await import("./intake.ts");
  const couch = estimate({ slug: "large-item-removal", answers: { medium: 1, heaviest: 120 } }).point;
  const fridge = estimate({ slug: "large-item-removal", answers: { heavy: 1, heaviest: 250 } }).point;
  const safe = estimate({ slug: "large-item-removal", answers: { very_heavy: 1, heaviest: 500 } }).point;
  assert.ok(couch < fridge && fridge < safe, "heavier costs more");
  const down = estimate({ slug: "large-item-removal", answers: { very_heavy: 1, heaviest: 500, flights: 2 } }).point;
  assert.ok(down - safe >= 150, "stairs scale with weight");
  assert.ok(sizeNeedsSiteVisit("large-item-removal", { heaviest: 1500 }));
  assert.equal(sizeNeedsSiteVisit("large-item-removal", { heaviest: 400 }), null);
  const q = estimate({ slug: "junk-removal", answers: { volume: "quarter", kind: "household" } }).point;
  assert.ok(estimate({ slug: "junk-removal", answers: { volume: "quarter", kind: "heavy" } }).point > q);
  assert.ok(estimate({ slug: "junk-removal", answers: { volume: "quarter", special: 2 } }).point >= q + 60);
  const wk = estimate({ slug: "junk-container", answers: { size: "15", days: "7", debris: "mixed" } }).point;
  assert.ok(wk >= 349 && estimate({ slug: "junk-container", answers: { size: "15", days: "14", debris: "mixed" } }).point > wk);
  assert.ok(estimate({ slug: "junk-container", answers: { size: "30", days: "7" } }).point > wk);
  const { containerPickup } = await import("./intake.ts");
  assert.equal(containerPickup("2026-11-02", "7"), "2026-11-09");
  assert.equal(containerPickup("2026-11-28", 14), "2026-12-12");
});

test("recruiting: auto-invite, pipeline stages, follow-ups", async () => {
  const { RECRUITING_DEFAULTS: R, autoInviteDecision, pipelineStage, reminderDue, shouldDrop, mergeRecruiting } = await import("./recruiting.ts");
  assert.equal(autoInviteDecision(R, { recommendation: "approve_after_checks", score: 82 }).invite, true);
  assert.equal(autoInviteDecision(R, { recommendation: "interview", score: 55 }).invite, false);
  assert.equal(autoInviteDecision(R, { recommendation: "decline", score: 90 }).invite, false);
  assert.equal(autoInviteDecision(mergeRecruiting({ autoInvite: false }), { recommendation: "approve_after_checks", score: 95 }).invite, false);
  const steps = (done: string[]) => ["w9", "agreement", "specialties", "area", "coi", "background", "payout"].map((key) => ({ key, done: done.includes(key) }));
  assert.equal(pipelineStage({ appStage: "applied" }), "applied");
  assert.equal(pipelineStage({ appStage: "screened" }), "screened");
  assert.equal(pipelineStage({ contractorStatus: "vetting", steps: steps([]) }), "invited");
  assert.equal(pipelineStage({ contractorStatus: "vetting", steps: steps(["w9", "agreement"]) }), "onboarding");
  assert.equal(pipelineStage({ contractorStatus: "vetting", steps: steps(["w9", "agreement", "specialties", "area", "payout"]), pendingDocs: 1 }), "verifying");
  assert.equal(pipelineStage({ contractorStatus: "vetting", steps: steps(["w9", "agreement", "specialties", "area", "coi", "payout"]) }), "background");
  assert.equal(pipelineStage({ contractorStatus: "approved", steps: steps([]) }), "active");
  assert.equal(pipelineStage({ appStage: "rejected" }), "rejected");
  const day = (n: number) => new Date(Date.now() - n * 86400000).toISOString();
  assert.equal(reminderDue(R, day(0.5), 0), null);
  assert.equal(reminderDue(R, day(1.2), 0), 0);
  assert.equal(reminderDue(R, day(2), 1), null);
  assert.equal(reminderDue(R, day(8), 2), 2);
  assert.equal(reminderDue(R, day(40), 4), null, "all reminders sent");
  assert.equal(shouldDrop(R, day(31), 4), true);
  assert.equal(shouldDrop(R, day(31), 2), false, "still reminding");
});

test("transportation: hourly minimums, licensed operators with passenger-carrier insurance", async () => {
  const { requiredCoverages } = await import("./vetting.ts");
  const { sizeNeedsSiteVisit } = await import("./intake.ts");
  assert.equal(estimate({ slug: "private-driver", answers: { vehicle: "sedan", hours: 1 } }).point, 170 + BOOKING_FEE, "2-hour minimum (+ booking fee)");
  assert.ok(estimate({ slug: "limousine", answers: { vehicle: "suv_limo", hours: 4 } }).point > estimate({ slug: "limousine", answers: { vehicle: "stretch", hours: 4 } }).point);
  assert.equal(estimate({ slug: "airport-transfer", answers: { vehicle: "sedan", trip: "round_trip" } }).point, 190 + BOOKING_FEE);
  assert.ok(estimate({ slug: "party-bus", answers: { size: "40", hours: 4, weekend_night: true } }).point > 1300);
  assert.equal(estimate({ slug: "charter-bus", answers: { vehicle: "motorcoach", days: 2, overnight: true } }).point, 3800 + BOOKING_FEE);
  assert.deepEqual(requiredCoverages(["transportation"]), ["passenger_auto"]);
  assert.ok(sizeNeedsSiteVisit("event-shuttle", { vehicles: 6 }));
  assert.ok(sizeNeedsSiteVisit("charter-bus", { out_of_state: true }));
  const pro: Contractor = {
    id: "t", profile_id: null, business_name: "T", contact_name: "T", email: "t@x", phone: "1", trades: ["transportation"], service_zips: [], status: "approved",
    rating: 5, jobs_completed: 20, acceptance_rate: 1, on_time_rate: 1, insured_until: "2099-01-01", license_number: null, background_checked: true, daily_capacity: 3, notes: null,
  };
  const job = { service_slug: "limousine", zip: "48201", scheduled_date: null };
  assert.equal(rankContractors([pro], job).length, 0, "needs authority on file");
  assert.equal(rankContractors([{ ...pro, license_number: "MDOT-1" }], job).length, 0, "needs passenger-carrier insurance");
  assert.equal(rankContractors([{ ...pro, license_number: "MDOT-1", coverage: { passenger_auto: "2099-01-01" } }], job).length, 1);
});

// ── Calculators: like adding rooms to a house cleaning, more of anything never costs less ──

/** Answers that make a question apply (e.g. mini-split zones need system = minisplit). */
function answersFor(svc: (typeof SERVICES)[number], q: Question): Answers {
  const a = defaultAnswers(svc);
  if (q.showIf) a[q.showIf.id] = q.showIf.is[0];
  return a;
}
function numberSteps(q: Extract<Question, { type: "number" }>): number[] {
  if (q.max - q.min <= 60) return Array.from({ length: q.max - q.min + 1 }, (_, i) => q.min + i);
  return Array.from({ length: 41 }, (_, i) => Math.round(q.min + ((q.max - q.min) * i) / 40));
}
/** Toggles that intentionally make the job smaller (and cheaper). */
const SMALLER_SCOPE_TOGGLES = new Set(["exterior-painting.trim_only"]);
/** Amount questions that intentionally don't change the price (the budget sets it, or they only matter in combination). */
const INFO_ONLY_NUMBERS = new Set(["event-package.guests",
  // measurements the pro uses to plan (vehicle, saw, crew), not priced: tree trunk, load weight, longest side
  "tree-removal.trunk_in", "junk-removal.est_weight_lb", "retail-delivery.largest_in", "courier.package_in"]);

test("calculators: raising any amount never lowers the price", () => {
  for (const svc of SERVICES) {
    for (const q of svc.questions) {
      if (q.type !== "number") continue;
      const base = answersFor(svc, q);
      let prev = -1, prevV = 0;
      // a required measurement at 0 means "not entered yet" (booking is blocked), so start from 1
      for (const v of numberSteps(q).filter((x) => !(q.required && x === 0))) {
        const p = estimate({ slug: svc.slug, answers: { ...base, [q.id]: v } }).point;
        assert.ok(p >= prev, `${svc.slug}.${q.id}: ${prevV}→${v} dropped the price ${prev}→${p}`);
        prev = p; prevV = v;
      }
    }
  }
});

test("calculators: every amount question moves the price", () => {
  for (const svc of SERVICES) {
    for (const q of svc.questions) {
      if (q.type !== "number" || INFO_ONLY_NUMBERS.has(`${svc.slug}.${q.id}`)) continue;
      // with the defaults, or with every choice at its smallest option (e.g. passengers only matter in a smaller vehicle)
      const smallest = { ...answersFor(svc, q), ...Object.fromEntries(svc.questions.filter((x) => x.type === "select" && x.id !== q.showIf?.id).map((x) => [x.id, (x as Extract<Question, { type: "select" }>).options[0].value])) };
      const moves = [answersFor(svc, q), smallest].some((base) =>
        estimate({ slug: svc.slug, answers: { ...base, [q.id]: q.max } }).point > estimate({ slug: svc.slug, answers: { ...base, [q.id]: q.min } }).point);
      assert.ok(moves, `${svc.slug}.${q.id} (${q.label}) has no effect between ${q.min} and ${q.max}`);
    }
  }
});

test("calculators: turning an add-on on never lowers the price", () => {
  for (const svc of SERVICES) {
    for (const q of svc.questions) {
      if (q.type !== "toggle" || SMALLER_SCOPE_TOGGLES.has(`${svc.slug}.${q.id}`)) continue;
      const base = answersFor(svc, q);
      const off = estimate({ slug: svc.slug, answers: { ...base, [q.id]: false } }).point;
      const on = estimate({ slug: svc.slug, answers: { ...base, [q.id]: true } }).point;
      assert.ok(on >= off, `${svc.slug}.${q.id}: turning on lowers the price ${off}→${on}`);
    }
  }
});

test("house cleaning: each added bedroom and bathroom adds to the price", () => {
  const svc = SERVICES.find((x) => x.slug === "house-cleaning")!;
  for (const id of ["bedrooms", "bathrooms"]) {
    const q = svc.questions.find((x) => x.id === id);
    if (!q || q.type !== "number") continue;
    let prev = 0;
    for (let v = q.min; v <= q.max; v++) {
      const p = estimate({ slug: svc.slug, answers: { ...defaultAnswers(svc), [id]: v } }).point;
      if (v > q.min) assert.ok(p > prev, `house-cleaning ${id} ${v - 1}→${v}: ${prev}→${p}`);
      prev = p;
    }
  }
});

test("rides: more passengers than the vehicle seats moves up a size", () => {
  const p = (slug: string, a: Answers) => estimate({ slug, answers: { ...defaultAnswers(SERVICES.find((x) => x.slug === slug)!), ...a } }).point;
  assert.ok(p("private-driver", { vehicle: "sedan", passengers: 5 }) > p("private-driver", { vehicle: "sedan", passengers: 3 }));
  assert.equal(p("private-driver", { vehicle: "sedan", passengers: 5 }), p("private-driver", { vehicle: "suv", passengers: 5 }));
  assert.ok(p("airport-transfer", { vehicle: "sedan", passengers: 8 }) > p("airport-transfer", { vehicle: "suv", passengers: 6 }));
  assert.ok(p("limousine", { vehicle: "stretch", passengers: 14 }) > p("limousine", { vehicle: "stretch", passengers: 10 }));
  assert.ok(p("charter-bus", { vehicle: "minicoach", passengers: 45 }) > p("charter-bus", { vehicle: "minicoach", passengers: 30 }));
  assert.ok(p("game-day-rides", { vehicle: "suv", passengers: 10 }) > p("game-day-rides", { vehicle: "suv", passengers: 6 }), "game day: SUV → Sprinter");
  assert.ok(p("game-day-rides", { vehicle: "party_bus", passengers: 35 }) > p("game-day-rides", { vehicle: "party_bus", passengers: 20 }), "game day: bigger party bus");
});

// ── Pro promises: real stats, daily limit, referral ──

test("acceptance rate (shown to the pro only) counts answered offers — not ignored ones or ones another pro took", async () => {
  const { acceptanceRate } = await import("./pro-stats.ts");
  const o = (s: string, n: number) => Array.from({ length: n }, () => ({ status: s }));
  assert.equal(acceptanceRate([...o("accepted", 3), ...o("declined", 1)], 1), 1, "too few offers keeps the current rate");
  assert.equal(acceptanceRate([...o("accepted", 6), ...o("declined", 2), ...o("expired", 2), ...o("taken", 10)], 1), 0.75);
});

test("on time = started before the booked window ends, in local time", async () => {
  const { onTimeRate, startedOnTime } = await import("./pro-stats.ts");
  // 10:30 EDT = 14:30Z, morning window ends 11:00 local
  assert.equal(startedOnTime({ scheduled_date: "2026-10-05", time_window: "morning", started_at: "2026-10-05T14:30:00Z" }), true);
  assert.equal(startedOnTime({ scheduled_date: "2026-10-05", time_window: "morning", started_at: "2026-10-05T15:30:00Z" }), false);
  assert.equal(startedOnTime({ scheduled_date: "2026-10-05", time_window: "morning", started_at: "2026-10-06T13:00:00Z" }), false, "next day is late");
  const j = (h: number) => ({ scheduled_date: "2026-10-05", time_window: "afternoon" as const, started_at: `2026-10-05T${h}:00:00Z` });
  assert.equal(onTimeRate([j(18), j(19), j(20), j(22)], 1), 0.75); // 22Z = 6pm local, after 5pm
});

test("a pro at the daily limit they set gets no more offers that day", () => {
  const pro = { id: "p", business_name: "A", contact_name: "A", email: "a@x", phone: "", zip: "48201", service_zips: ["48201"], trades: ["cleaning"], status: "approved",
    rating: 5, jobs_completed: 20, acceptance_rate: 1, on_time_rate: 1, insured_until: "2099-01-01", license_number: null, background_checked: true, daily_capacity: 2, notes: null, coverage: { bond: "2099-01-01" } } as unknown as Contractor;
  const job = { service_slug: "house-cleaning", zip: "48201", scheduled_date: "2099-06-02" };
  assert.equal(rankContractors([pro], job, { p: 1 }).length, 1);
  assert.equal(rankContractors([pro], job, { p: 2 }).length, 0);
});

test("referral bonus is due once, after the referred pro's Nth job", async () => {
  const { referralDue } = await import("./pro-stats.ts");
  const { PRO_REFERRAL } = await import("./pro-program.ts");
  const c = { referred_by: "r", jobs_completed: PRO_REFERRAL.afterJobs, status: "approved", referral_bonus_paid_at: null };
  assert.equal(referralDue(c), true);
  assert.equal(referralDue({ ...c, jobs_completed: PRO_REFERRAL.afterJobs - 1 }), false);
  assert.equal(referralDue({ ...c, referral_bonus_paid_at: "2026-10-01" }), false);
  assert.equal(referralDue({ ...c, referred_by: null }), false);
});

test("business groups and industries only list real services", async () => {
  const { BUSINESS_GROUPS, INDUSTRIES } = await import("./business.ts");
  const { SERVICE_BY_SLUG } = await import("./services.ts");
  for (const g of [...BUSINESS_GROUPS, ...INDUSTRIES]) for (const s of g.slugs) assert.ok(SERVICE_BY_SLUG[s], `${g.id}: unknown service ${s}`);
});

// ── Roster: on call, live location, calendar ──

test("on call: available today outside usual days, ranked up, live location used", async () => {
  const { localDate, proStatus, proCalendar, liveLocation } = await import("./roster.ts");
  const now = new Date();
  const today = localDate(now);
  const pro = { id: "p", business_name: "A", contact_name: "A", email: "a@x", phone: "", zip: "48201", service_zips: [], trades: ["cleaning"], status: "approved",
    rating: 5, jobs_completed: 20, acceptance_rate: 1, on_time_rate: 1, insured_until: "2099-01-01", license_number: null, background_checked: true, daily_capacity: 3, notes: null,
    coverage: { bond: "2099-01-01" }, base_lat: 42.33, base_lng: -83.05, service_radius_mi: 10, availability: { days: [], windows: [] }, time_off: [today] } as unknown as Contractor;
  const job = { service_slug: "house-cleaning", zip: "48201", scheduled_date: today, time_window: "morning", lat: 42.6, lng: -83.6 };
  assert.equal(rankContractors([pro], job).length, 0, "day off and 30+ miles from base");
  const on = { ...pro, on_call_until: new Date(now.getTime() + 3600000).toISOString(), last_lat: 42.59, last_lng: -83.59, last_located_at: now.toISOString() };
  const [r] = rankContractors([on], job);
  assert.ok(r, "on call + nearby now → eligible");
  assert.ok(r.reasons.includes("on call now") && r.reasons.includes("live location"));
  assert.equal(liveLocation({ ...on, last_located_at: new Date(now.getTime() - 3600000).toISOString() }), null, "stale location ignored");
  assert.equal(proStatus(on, []), "on_call");
  assert.equal(proStatus(pro, [{ status: "in_progress" }]), "on_job");
  assert.equal(proStatus(pro, []), "off");
  const cal = proCalendar({ ...pro, time_off: [], availability: { days: [1, 2, 3, 4, 5], windows: [] } }, [{ id: "j", service_slug: "house-cleaning", scheduled_date: "2026-10-05", time_window: "morning", status: "assigned" }], "2026-10-04", 2);
  assert.equal(cal[0].off, "Doesn't work Sundays");
  assert.equal(cal[1].open, 2);
});

// ── Customer timing & budget ──

test("urgency sets the deadline and dispatch priority; budget fit; deadline risk", async () => {
  const { neededBy, urgencyPriority, budgetFit, deadlineRisk } = await import("./timing.ts");
  assert.equal(neededBy("two_weeks", "2026-10-02"), "2026-10-16");
  assert.equal(neededBy("asap", "2026-10-02"), "2026-10-03");
  assert.equal(urgencyPriority("asap", false), "urgent");
  assert.equal(urgencyPriority("two_weeks", true), "high");
  assert.equal(urgencyPriority("flexible", false), "normal");
  assert.equal(budgetFit(500, 450).status, "fits");
  assert.equal(budgetFit(400, 450).status, "close");
  assert.equal(budgetFit(200, 450).status, "over");
  assert.equal(budgetFit(null, 450).status, "none");
  assert.equal(deadlineRisk({ needed_by: "2026-10-01", status: "scheduled" }, "2026-10-02"), "late");
  assert.equal(deadlineRisk({ needed_by: "2026-10-03", status: "assigned" }, "2026-10-02"), "due");
  assert.equal(deadlineRisk({ needed_by: "2026-10-01", status: "completed" }, "2026-10-02"), null);
});

test("same-day availability: on-call pros only, windows not yet started", async () => {
  const { buildAvailability } = await import("./availability.ts");
  // 9:30am Detroit (13:30Z): morning (starts 8) is gone, midday (11) is open
  const now = new Date("2026-10-05T13:30:00Z");
  const base = { id: "p", business_name: "A", contact_name: "A", email: "a@x", phone: "", zip: "48201", service_zips: ["48201"], trades: ["cleaning"], status: "approved",
    rating: 5, jobs_completed: 20, acceptance_rate: 1, on_time_rate: 1, insured_until: "2099-01-01", license_number: null, background_checked: true, daily_capacity: 3, notes: null,
    coverage: { bond: "2099-01-01" }, availability: { days: [6], windows: [] } } as unknown as Contractor;
  const off = buildAvailability({ slug: "house-cleaning", zip: "48201", contractors: [base], jobs: [], includeToday: true, now, days: 1 });
  assert.equal(off.days[0].date, "2026-10-05");
  assert.equal(off.days[0].spots, 0, "doesn't work Mondays and not on call");
  const on = buildAvailability({ slug: "house-cleaning", zip: "48201", contractors: [{ ...base, on_call_until: "2026-10-05T20:00:00Z" }], jobs: [], includeToday: true, now, days: 1 });
  assert.equal(on.days[0].windows.morning, 0);
  assert.ok(on.days[0].windows.midday > 0 && on.days[0].spots > 0);
});

test("every service and category has Spanish text", async () => {
  const { ES_SERVICE_SLUGS, categoryText, t } = await import("./i18n.ts");
  const { SERVICES, CATEGORIES } = await import("./services.ts");
  for (const s of SERVICES) assert.ok(ES_SERVICE_SLUGS.includes(s.slug), `no Spanish for ${s.slug}`);
  for (const c of CATEGORIES) assert.notEqual(categoryText("es", c.id, c).name, c.name === "Pet Care" ? "" : c.name);
  assert.equal(t("es", "Book now"), "Reservar");
  assert.equal(t("en", "Book now"), "Book now");
  assert.equal(t("es", "Not in the dictionary"), "Not in the dictionary");
});

test("growth: discounts never touch the pro's pay and we keep 5%", async () => {
  const { capDiscount, promoDiscount, memberSaving } = await import("./growth.ts");
  assert.equal(capDiscount(200, 150, 100), 40); // 200 - 150 - 10 = 40 max
  assert.equal(capDiscount(200, 195, 50), 0);
  assert.equal(promoDiscount({ code: "X", kind: "percent", value: 10 }, 300, { firstJob: false }).amount, 30);
  assert.equal(promoDiscount({ code: "X", kind: "amount", value: 25, first_job_only: true }, 300, { firstJob: false }).ok, false);
  assert.equal(promoDiscount({ code: "X", kind: "amount", value: 25, expires_at: "2000-01-01" }, 300, { firstJob: true }).ok, false);
  assert.equal(memberSaving(345, 45), 75); // rush back + 10% of 300
});

test("every pricing question, answer, help line and included item has Spanish", async () => {
  const { ES_CATALOG } = await import("./i18n-catalog-es.ts");
  const { SERVICES } = await import("./services.ts");
  const missing: string[] = [];
  const need = (s?: string) => { if (s && !ES_CATALOG[s]) missing.push(s); };
  for (const s of SERVICES) {
    s.includes.forEach(need); need(s.notesHint);
    for (const q of s.questions) { need(q.label); need(q.help); if (q.type === "select") q.options.forEach((o) => need(o.label)); }
  }
  assert.deepEqual(missing, [], `add Spanish in i18n-catalog-es.ts for: ${missing.join(" | ")}`);
});

test("every t(\"…\") phrase in the mobile app has Spanish", async () => {
  const fs = await import("node:fs");
  const path = await import("node:path");
  const { t } = await import("./i18n.ts");
  const root = path.resolve(import.meta.dirname, "../../../apps/mobile");
  const { ES_APP } = await import(path.join(root, "lib/es-app.ts"));
  const { ES_PRO } = await import(path.join(root, "lib/es-pro.ts"));
  const files: string[] = [];
  const walk = (d: string) => { for (const f of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, f.name); if (f.isDirectory()) walk(p); else if (p.endsWith(".tsx")) files.push(p); } };
  walk(path.join(root, "app")); walk(path.join(root, "components"));
  const missing = new Set<string>();
  for (const f of files) for (const m of fs.readFileSync(f, "utf8").matchAll(/\bt\("((?:[^"\\]|\\.)*)"\)/g)) {
    const k = JSON.parse(`"${m[1]}"`);
    if (!ES_APP[k] && !ES_PRO[k] && t("es", k) === k) missing.add(k);
  }
  assert.deepEqual([...missing], [], "add Spanish to apps/mobile/lib/es-app.ts or es-pro.ts");
});

test("every price-breakdown line has a Spanish template", async () => {
  const { ES_LINES } = await import("./i18n-lines-es.ts");
  const { SERVICES, defaultAnswers } = await import("./services.ts");
  const { estimate } = await import("./pricing.ts");
  const NUM = /\$?\d[\d,]*(?:\.\d+)?/g;
  const missing = new Set<string>();
  for (const s of SERVICES) {
    const base = defaultAnswers(s);
    const variants = [base];
    for (const q of s.questions) {
      if (q.type === "select") for (const o of q.options) variants.push({ ...base, [q.id]: o.value });
      if (q.type === "toggle") variants.push({ ...base, [q.id]: !q.default });
      if (q.type === "number") { variants.push({ ...base, [q.id]: q.max }); variants.push({ ...base, [q.id]: q.min }); }
    }
    for (const v of variants) for (const frequency of ["once", "weekly", "biweekly", "monthly"] as const) for (const rush of [false, true]) {
      for (const it of estimate({ slug: s.slug, answers: v, frequency, rush }).items) { const k = it.label.replace(NUM, "{#}"); if (!ES_LINES[k]) missing.add(k); }
    }
  }
  assert.deepEqual([...missing], [], "add Spanish templates to i18n-lines-es.ts");
});

test("supply gaps: no pros, thin coverage and covered areas", async () => {
  const { serviceGaps, gapsByService, JOBS_PER_PRO_MONTH } = await import("./gaps.ts");
  const pro: Contractor = {
    id: "a", profile_id: null, business_name: "A", contact_name: "A", email: "a@x", phone: "1", trades: ["cleaning"],
    service_zips: ["48201"], status: "approved", rating: 4.9, jobs_completed: 10, acceptance_rate: 1, on_time_rate: 1,
    insured_until: "2099-01-01", license_number: null, background_checked: true, daily_capacity: 3, notes: null, coverage: { bond: "2099-01-01" },
  };
  const many = (n: number, d: { service_slug: string; zip: string; no_pro?: boolean }) => Array.from({ length: n }, () => ({ ...d }));
  const rows = serviceGaps({
    contractors: [pro, { ...pro, id: "b", status: "vetting" }],
    jobs: [
      ...many(3, { service_slug: "house-cleaning", zip: "48201" }),                       // covered
      ...many(2, { service_slug: "lawn-care", zip: "48201", no_pro: true }),            // no lawn pro
      { service_slug: "nope", zip: "48201" }, { service_slug: "house-cleaning", zip: "bad" }, // ignored
    ],
    waitlist: [{ service_slug: "house-cleaning", zip: "90210" }],
  });
  const by = (slug: string, zip: string) => rows.find((r) => r.slug === slug && r.zip === zip)!;
  assert.equal(rows.length, 3);
  assert.equal(by("house-cleaning", "48201").level, "ok");
  assert.equal(by("house-cleaning", "48201").pros, 1, "vetting pros don't count");
  assert.equal(by("lawn-care", "48201").level, "none");
  assert.equal(by("lawn-care", "48201").noPro, 2);
  assert.equal(by("house-cleaning", "90210").level, "none");
  assert.equal(by("house-cleaning", "90210").needed, 1);
  assert.notEqual(rows[rows.length - 1].level, "none", "gaps sort first");
  const busy = serviceGaps({ contractors: [pro], jobs: many(JOBS_PER_PRO_MONTH * 2 + 1, { service_slug: "house-cleaning", zip: "48201" }), waitlist: [] });
  assert.equal(busy[0].level, "thin");
  assert.equal(busy[0].needed, 2);
  const svc = gapsByService(rows);
  assert.equal(svc.find((s) => s.slug === "house-cleaning")!.zipsWithoutPros, 1);
});

test("seasonal reminders: right month, long enough since, not already covered", async () => {
  const { seasonalDue, seasonKey, seasonalPitch, SEASONAL, followupDue } = await import("./seasonal.ts");
  const { getService } = await import("./services.ts");
  for (const r of SEASONAL) {
    assert.ok(getService(r.slug), `${r.slug} is a real service`);
    for (const m of r.months) { const half = m <= 6 ? r.spring : r.fall; assert.ok(half.en && half.es, `${r.slug} has wording for month ${m}`); }
  }
  const oct = new Date("2026-10-15T12:00:00Z");
  const hist = [
    { service_slug: "gutter-cleaning", completed_at: "2026-04-20T00:00:00Z" },  // 178 days → due
    { service_slug: "window-cleaning", completed_at: "2026-08-01T00:00:00Z" },  // too recent
    { service_slug: "lawn-care", completed_at: "2025-04-01T00:00:00Z" },        // not lawn season
    { service_slug: "leaf-removal", completed_at: "2025-10-20T00:00:00Z" },     // due
    { service_slug: "snow-removal", completed_at: null },                        // never finished
  ];
  const due = seasonalDue(hist, { now: oct });
  assert.deepEqual(due.map((d) => d.rule.slug), ["leaf-removal", "gutter-cleaning"]);
  assert.deepEqual(seasonalDue(hist, { now: oct, skip: ["leaf-removal"] }).map((d) => d.rule.slug), ["gutter-cleaning"]);
  assert.equal(seasonKey("gutter-cleaning", oct), "gutter-cleaning:2026-fall");
  assert.match(seasonalPitch(due[1].rule, "es", oct), /canaletas/);
  assert.equal(followupDue("2026-10-01T00:00:00Z", 0, [1, 3, 7], new Date("2026-10-01T12:00:00Z")), null);
  assert.equal(followupDue("2026-10-01T00:00:00Z", 0, [1, 3, 7], new Date("2026-10-02T01:00:00Z")), 0);
  assert.equal(followupDue("2026-10-01T00:00:00Z", 1, [1, 3, 7], new Date("2026-10-03T01:00:00Z")), null);
  assert.equal(followupDue("2026-10-01T00:00:00Z", 1, [1, 3, 7], new Date("2026-10-04T01:00:00Z")), 1);
  assert.equal(followupDue("2026-10-01T00:00:00Z", 3, [1, 3, 7], new Date("2026-12-01T00:00:00Z")), null);
});

test("pro fairness: deduction notice, clawback cap, chargebacks, warnings, offers", async () => {
  const { addBusinessDays, clawbackPlan, chargebackFromWork, standingIssues, DEACTIVATION_RULES } = await import("./pro-fairness.ts");
  const { proTier, PRO_TIERS } = await import("./pro-program.ts");
  const { acceptanceRate } = await import("./pro-stats.ts");
  // Friday + 3 business days = Wednesday
  assert.equal(addBusinessDays(new Date("2026-10-02T15:00:00Z"), 3).toISOString().slice(0, 10), "2026-10-07");
  // half of non-tip pay, never from tips; the rest carries over
  const plan = clawbackPlan([{ amount: 200, kind: "job" }, { amount: 50, kind: "tip" }], [{ id: "a", amount: -60 }, { id: "b", amount: -80 }]);
  assert.equal(plan.cap, 100);
  assert.deepEqual(plan.apply, [{ id: "a", amount: 60 }, { id: "b", amount: 40 }]);
  assert.deepEqual(plan.carry, [{ id: "b", amount: 40 }]);
  assert.deepEqual(clawbackPlan([{ amount: 80, kind: "tip" }], [{ id: "a", amount: -10 }]).apply, [], "tips alone never pay a deduction");
  assert.equal(chargebackFromWork("fraudulent"), false);
  assert.equal(chargebackFromWork("product_unacceptable"), true);
  // warnings need enough history and real thresholds
  assert.deepEqual(standingIssues({ ratings: [3, 3, 3], lateCancels: 0, noShows: 0, qaFailures: 0 }), []);
  assert.equal(standingIssues({ ratings: Array(DEACTIVATION_RULES.ratedJobs).fill(4), lateCancels: 3, noShows: 2, qaFailures: 0 }).length, 3);
  // declining offers never changes tier; ignored offers don't count at all
  const strong = { jobs_completed: 200, rating: 4.95, on_time_rate: 0.99, acceptance_rate: 0.05 };
  assert.equal(proTier(strong).id, PRO_TIERS[PRO_TIERS.length - 1].id);
  assert.equal(acceptanceRate([...Array(10)].map(() => ({ status: "expired" })), 0.7), 0.7);
});

test("market pricing: booking fee, sliding commission, counters, learning, offer bounds", async () => {
  const { splitJob, commissionRate, priceForPayout, marketFactor, offerCheck, BOOKING_FEE, MARKET_BOUNDS } = await import("./pricing.ts");
  // small jobs: small cut, so a $60 mow pays the pro $51 (+ our $4 fee)
  const mow = splitJob(60 + BOOKING_FEE);
  assert.equal(mow.payout, 51); assert.equal(mow.fee, BOOKING_FEE); assert.equal(mow.take, 13);
  assert.equal(commissionRate(60), 0.15); assert.equal(commissionRate(600), 0.32); assert.equal(commissionRate(5000), 0.32);
  // payout never goes down when the price goes up
  let last = -1;
  for (let p = 20; p <= 3000; p += 7) { const x = splitJob(p).payout; assert.ok(x >= last, `payout drops at ${p}`); last = x; }
  // counters: the lowest price that pays at least the pro's number
  for (const want of [45, 51, 120, 333, 900]) { const p = priceForPayout(want); assert.ok(splitJob(p).payout >= want); assert.ok(splitJob(p - 1).payout < want, `not minimal for ${want}`); }
  // learning needs enough samples, is damped and bounded
  const sig = (n: number, price: number, outcome: "accepted" | "declined" | "countered", counter?: number) => Array.from({ length: n }, () => ({ price, suggested: 100, outcome, counter }));
  assert.equal(marketFactor(sig(3, 100, "declined")).factor, 1, "too few samples");
  const up = marketFactor([...sig(6, 100, "countered", 125), ...sig(4, 100, "declined")]);
  assert.ok(up.factor > 1 && up.factor <= MARKET_BOUNDS.max, `raises when pros counter (${up.factor})`);
  const down = marketFactor(sig(10, 88, "accepted"));
  assert.ok(down.factor < 1 && down.factor >= MARKET_BOUNDS.min, `lowers when pros accept below (${down.factor})`);
  assert.equal(marketFactor(sig(20, 300, "countered", 400)).factor, MARKET_BOUNDS.max, "bounded");
  // name-your-price bounds
  assert.equal(offerCheck(100, 100).level, "ok");
  assert.equal(offerCheck(85, 100).level, "low");
  assert.equal(offerCheck(70, 100).ok, false);
  assert.equal(offerCheck(400, 100).ok, false);
});

test("pro lead engine: searches, scoring, emails found, sequence, copy", async () => {
  const { TRADE_SEARCH, TRADE_WORD, leadScore, extractEmails, nextSendAt, leadEmail, LEAD_SEQUENCE } = await import("./lead-engine.ts");
  const { TRADES } = await import("./services.ts");
  for (const t of TRADES) { assert.ok(TRADE_SEARCH[t.id], `search phrase for ${t.id}`); assert.ok(TRADE_WORD[t.id], `word for ${t.id}`); }
  assert.ok(leadScore({ rating: 4.8, reviewCount: 40, email: "a@b.co", inGap: true }) > leadScore({ rating: 4.0, reviewCount: 900, phone: "1" }));
  assert.ok(leadScore({ rating: 5, reviewCount: 50, email: "x@y.z", website: "w", inGap: true, licensed: true }) <= 100);
  const html = `<a href="mailto:Info@SparkleClean.com">Email</a> jane&#64;sparkleclean.com noreply@wix.com logo@2x.png owner@gmail.com`;
  assert.deepEqual(extractEmails(html, "www.sparkleclean.com"), ["info@sparkleclean.com", "jane@sparkleclean.com", "owner@gmail.com"]);
  const t0 = new Date("2026-10-01T15:00:00Z");
  assert.equal(nextSendAt(0, t0)!.toISOString(), t0.toISOString());
  assert.equal(nextSendAt(1, t0)!.getTime() - t0.getTime(), 3 * 86400000);
  assert.equal(nextSendAt(LEAD_SEQUENCE.length, t0), null);
  const e = leadEmail({ step: 0, businessName: "Sparkle Clean", trade: "cleaning", city: "Dearborn", payExample: "$156 for a standard 3-bedroom clean", demand: 7, applyUrl: "https://x/pros?lead=abc", unsubscribeUrl: "https://x/u", postalAddress: "1 Main St, Detroit, MI" });
  assert.match(e.subject, /house cleaning jobs in Dearborn/);
  assert.match(e.text, /7 house cleaning requests in Dearborn/);
  assert.match(e.text, /1 Main St, Detroit, MI/);
  assert.match(e.text, /won't email again: https:\/\/x\/u/);
  assert.doesNotMatch(leadEmail({ step: 1, businessName: "B", trade: "plumbing", applyUrl: "u", unsubscribeUrl: "u", postalAddress: "a", demand: 0 }).text, /requests/);
});

test("pro earnings showcase: ranges are ordered, days computed, nothing below a fair floor", async () => {
  const { earningsShowcase, earningsHeadline, EARNINGS_SHOWCASE } = await import("./earnings.ts");
  const rows = earningsShowcase();
  assert.equal(rows.length, EARNINGS_SHOWCASE.length, "every showcase trade prices");
  for (const r of rows) {
    assert.ok(r.low <= r.typical && r.typical <= r.high, `${r.slug} low ≤ typical ≤ high`);
    assert.ok(r.high >= r.low * 1.5, `${r.slug} shows a real small → large range`);
    if (r.day !== null) assert.ok(r.day >= 250, `${r.slug} full day ≥ $250`);
  }
  const h = earningsHeadline();
  assert.ok(h.keepSmall > h.keepLarge && h.keepLarge >= 65);
});

test("water heater: standard tank priced to market, commission capped so the plumber clears labor", () => {
  const e = estimate({ slug: "water-heater", answers: { type: "tank50", fuel: "gas" } });
  assert.ok(e.point >= 1150 && e.point <= 1400, `50-gal gas suggested ${e.point}`);
  const sp = splitJob(e.point, "water-heater");
  assert.ok(sp.payout / e.point >= 0.84, "our cut is capped at 15% on equipment jobs");
  assert.ok(sp.payout - 750 >= 250, "pro clears ≥ $250 labor after a ~$750 unit + permit");
  assert.ok(commissionRate(1000, "water-heater") <= 0.15 && commissionRate(1000) === 0.32);
});

test("pricing accuracy: flags under/overpriced services from what happened after the job", async () => {
  const { scorePricing, pricingAccuracy } = await import("./pricing-accuracy.ts");
  const job = (o: Partial<import("./pricing-accuracy.ts").AccuracyJob> = {}) => ({ suggested: 200, final: 200, scopeExtra: 0, refunded: 0, paid: 200, estHours: 3, actualHours: 3, expenses: 0, rating: 5, ...o });
  const quiet = { accepted: 10, declined: 3, countered: 1, expired: 0, counterRatios: [1.1] };
  const none = { saved: 0, booked: 0 };
  // Jobs run 50% long and pros counter: underpriced, suggested factor goes up, inside bounds.
  const slow = scorePricing({ slug: "house-cleaning", factor: 1, quotes: none, jobs: Array.from({ length: 12 }, () => job({ actualHours: 4.5, final: 215 })), signals: { accepted: 6, declined: 4, countered: 5, expired: 1, counterRatios: [1.2, 1.25, 1.2, 1.3, 1.2] } });
  assert.equal(slow.verdict, "underpriced");
  assert.ok(slow.change! > 1.05 && slow.suggestedFactor! > 1 && slow.suggestedFactor! <= 1.3);
  assert.ok(slow.evidence.some((e) => e.key === "time") && slow.evidence.some((e) => e.key === "pros"));
  // Jobs go for less than suggested, run short, pros take everything: overpriced.
  const rich = scorePricing({ slug: "water-heater", factor: 1, quotes: { saved: 40, booked: 3 }, jobs: Array.from({ length: 10 }, () => job({ suggested: 2000, final: 1700, paid: 1700, estHours: 4, actualHours: 2.5 })), signals: { accepted: 20, declined: 0, countered: 0, expired: 0, counterRatios: [] } });
  assert.equal(rich.verdict, "overpriced");
  assert.ok(rich.suggestedFactor! < 1 && rich.suggestedFactor! >= 0.85);
  // Matches reality: on target, nothing to apply.
  const ok = scorePricing({ slug: "lawn-care", factor: 1, quotes: none, jobs: Array.from({ length: 8 }, () => job()), signals: quiet });
  assert.equal(ok.verdict, "on_target");
  assert.equal(ok.suggestedFactor, null);
  // Refunds are a quality flag, not a price change.
  const refunds = scorePricing({ slug: "lawn-care", factor: 1, quotes: none, jobs: Array.from({ length: 8 }, (_, i) => job({ refunded: i < 2 ? 100 : 0 })), signals: quiet });
  assert.equal(refunds.verdict, "watch");
  // Too little data: no verdict; worst services sort first.
  const thin = scorePricing({ slug: "snow-removal", factor: 1, quotes: none, jobs: [job()], signals: { accepted: 1, declined: 0, countered: 0, expired: 0, counterRatios: [] } });
  assert.equal(thin.verdict, "no_data");
  assert.deepEqual(pricingAccuracy([{ slug: "snow-removal", factor: 1, quotes: none, jobs: [], signals: { accepted: 0, declined: 0, countered: 0, expired: 0, counterRatios: [] } }, { slug: "house-cleaning", factor: 1, quotes: none, jobs: Array.from({ length: 12 }, () => job({ actualHours: 4.5 })), signals: quiet }]).map((r) => r.verdict), ["underpriced", "no_data"]);
});

test("water heater options: value, install-only and repair price below a standard replacement", () => {
  const p = (job: string, extra: Record<string, string> = {}) => estimate({ slug: "water-heater", answers: { job, type: "tank50", fuel: "gas", ...extra } }).point;
  const replace = p("replace"), budget = p("budget"), install = p("install"), repair = p("repair");
  assert.ok(replace > budget && budget > install && install > repair, `${replace} > ${budget} > ${install} > ${repair}`);
  assert.ok(repair >= 175 && repair <= 400, `repair ${repair}`);
  assert.ok(install >= 500 && install <= 950, `install-only ${install}`);
  assert.ok(replace - budget >= 150 && replace - budget <= 300);
  assert.ok(p("repair", { type: "tankless" }) > repair, "tankless repair adds a descale");
  const svc = SERVICES.find((s) => s.slug === "water-heater")!;
  assert.match(svc.description, /never used/);
});

test("crews: who can be sent, and when the company can send crew at all", async () => {
  const { crewCanTake, crewReady } = await import("./crew.ts");
  const m = { active: true, role: "lead" as const, background_status: "clear" as const, license_number: null, trades: ["handyman"] };
  assert.equal(crewCanTake(m, "handyman"), null);
  assert.match(crewCanTake({ ...m, background_status: "invited" }, "handyman")!, /Background/);
  assert.match(crewCanTake({ ...m, role: "helper" }, "handyman")!, /never alone/);
  assert.match(crewCanTake(m, "water-heater")!, /licensed tech/);
  assert.equal(crewCanTake({ ...m, role: "licensed", license_number: "PL-1", trades: ["plumbing"] }, "water-heater"), null);
  assert.match(crewCanTake({ ...m, role: "licensed", license_number: "EL-1", trades: ["electrical"] }, "water-heater")!, /trade/);
  const future = new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10);
  assert.match(crewReady({ crew_attested_at: null, coverage: { workers_comp: future } })!, /Crew Addendum/);
  assert.match(crewReady({ crew_attested_at: "2026-10-03", coverage: { workers_comp: "exempt" } })!, /workers' comp/);
  assert.equal(crewReady({ crew_attested_at: "2026-10-03", coverage: { workers_comp: future } }), null);
});

test("fast track: approved masters start at Pro+ while their numbers hold up", async () => {
  const { proTier } = await import("./pro-program.ts");
  const { FAST_TRACK, fastTrackProblem } = await import("./crew.ts");
  const fresh = { jobs_completed: 0, rating: 5, on_time_rate: 1 };
  assert.equal(proTier(fresh).id, "pro");
  assert.equal(proTier({ ...fresh, tier_floor: "pro_plus" }).id, "pro_plus");
  assert.equal(proTier({ jobs_completed: FAST_TRACK.graceJobs - 1, rating: 3.9, on_time_rate: 0.5, tier_floor: "pro_plus" }).id, "pro_plus", "grace period");
  assert.equal(proTier({ jobs_completed: FAST_TRACK.graceJobs, rating: 4.5, on_time_rate: 0.95, tier_floor: "pro_plus" }).id, "pro", "floor lapses when numbers drop");
  assert.equal(proTier({ jobs_completed: 150, rating: 4.9, on_time_rate: 0.97, tier_floor: "pro_plus" }).id, "elite", "earned tier wins when higher");
  assert.match(fastTrackProblem({ years: 2, photos: 5, summary: "x".repeat(60) })!, /years/);
  assert.match(fastTrackProblem({ years: 8, photos: 1, summary: "x".repeat(60) })!, /photos/);
  assert.equal(fastTrackProblem({ years: 8, photos: 4, summary: "Twelve years of finish carpentry and cabinets in Monterrey and Detroit." }), null);
});

test("city scorecard: stages climb gate by gate, and replicate needs the last 30 days too", async () => {
  const { scoreCity, CITY_TARGETS: T, planPace } = await import("./city-scorecard.ts");
  const base = { days: 90, completedJobs: 0, bookings: 0, take: 0, netTake: 0, refunded: 0, fillRate: null, hoursToAssign: null, activePros: 0, thinTrades: [], customers: 0,
    repeatRate: null, planConversion: null, avgRating: null, reviews: 0, redoRate: null, aiDrivenRate: null };
  assert.equal(scoreCity(base).stage, "launching");
  const month = (usd: number) => usd * 90 / 30.4;
  const traction = { ...base, completedJobs: 80, bookings: month(20_000), take: month(6_000), netTake: month(5_000), fillRate: 0.85, activePros: 12 };
  assert.equal(scoreCity(traction).stage, "traction");
  assert.equal(scoreCity(traction).next, "proven");
  assert.ok(scoreCity(traction).todo.length > 0);
  const proven = { ...traction, completedJobs: 300, bookings: month(70_000), take: month(21_000), netTake: month(18_000), refunded: month(1_000), fillRate: 0.95, hoursToAssign: 1.2,
    activePros: 30, customers: 200, repeatRate: 0.35, planConversion: 0.25, avgRating: 4.85, reviews: 120, redoRate: 0.02, aiDrivenRate: 0.85 };
  assert.equal(scoreCity(proven).stage, "proven");
  const big = { ...proven, bookings: month(160_000), take: month(48_000), netTake: month(42_000), refunded: month(2_000), repeatRate: 0.45, activePros: 45 };
  const recentGood = { ...big, days: 30, completedJobs: 120, bookings: 160_000, take: 48_000, netTake: 42_000, refunded: 2_000 };
  assert.equal(scoreCity(big, recentGood).stage, "replicate");
  assert.equal(scoreCity(big, recentGood).readyToReplicate, true);
  assert.equal(scoreCity(big, { ...recentGood, fillRate: 0.7 }).readyToReplicate, false, "slipped in the last 30 days");
  assert.equal(scoreCity({ ...big, thinTrades: ["plumbing"] }).stage, "traction", "a thin busy trade blocks proven");
  assert.ok(T.replicate.bookingsPerMonth > T.proven.bookingsPerMonth && T.proven.bookingsPerMonth > T.traction.bookingsPerMonth);
  const p = planPace({ launchedAt: new Date(Date.now() - 400 * 86400000).toISOString(), bookings30: 830_000, take30: 166_500, markets: 1 });
  assert.equal(p.year, 2);
  assert.ok(Math.abs(p.takePace - 1) < 0.05, `year-2 revenue pace ${p.takePace}`);
  const { GROWTH_PLAN, LONG_RANGE_GOALS } = await import("./city-scorecard.ts");
  for (const g of LONG_RANGE_GOALS) assert.equal(GROWTH_PLAN[g.year - 1].revenue, g.revenue, "plan hits the owner's milestones");
  assert.equal(GROWTH_PLAN[4].bookings, 50_000_000, "$10M revenue ≈ $50M bookings at a 20% take");
});

test("launch set: only a city's launch services open; outside every city nothing is blocked", async () => {
  const { serviceOpen, marketForZip, LAUNCH_SET_RECOMMENDED } = await import("./launch.ts");
  const detroit = { name: "Metro Detroit", zip_prefixes: ["480", "481", "482"], launch_services: [...LAUNCH_SET_RECOMMENDED] };
  const all = { name: "Ann Arbor", zip_prefixes: ["481"], launch_services: null };
  assert.equal(marketForZip([detroit], "48201")?.name, "Metro Detroit");
  assert.equal(marketForZip([detroit], "49503"), null);
  assert.equal(serviceOpen(detroit, "junk-removal"), true);
  assert.equal(serviceOpen(detroit, "limousine"), false);
  assert.equal(serviceOpen(all, "limousine"), true, "no list = every service");
  assert.equal(serviceOpen(null, "limousine"), true, "outside any city");
  for (const s of LAUNCH_SET_RECOMMENDED) assert.ok(SERVICES.some((x) => x.slug === s), `${s} exists`);
});

test("business accounts: terms are case by case, within the credit limit and not on hold; pilot from our share", async () => {
  const { termsDecision, pilotDiscount, invoicePeriod, daysOverdue, invoiceReminderDue, BUSINESS_TERMS } = await import("./business-accounts.ts");
  const prepay = { billing_mode: "prepay" as const, credit_limit: 0, terms_hold: false };
  assert.equal(termsDecision(prepay, 0, 300).onTerms, false, "every account starts on prepay");
  const terms = { billing_mode: "terms" as const, credit_limit: 2500, terms_hold: false };
  assert.equal(termsDecision(terms, 1000, 300).onTerms, true);
  assert.equal(termsDecision(terms, 2400, 300).onTerms, false, "over the credit limit → prepay");
  assert.equal(termsDecision({ ...terms, terms_hold: true }, 0, 100).onTerms, false, "overdue hold → prepay");
  const list = 400, payout = splitJob(list, "unit-turnover").payout;
  const pilot = pilotDiscount({ pilot_discount_pct: 20, pilot_jobs_left: 2 }, list, payout);
  assert.ok(pilot > 0 && pilot <= list * 0.2 && list - pilot - payout >= list * 0.05 - 1, `pilot ${pilot} leaves us a margin`);
  assert.equal(pilotDiscount({ pilot_discount_pct: 20, pilot_jobs_left: 0 }, list, payout), 0);
  assert.equal(pilotDiscount({ pilot_discount_pct: 90, pilot_jobs_left: 1 }, list, payout) <= list * BUSINESS_TERMS.maxPilotPct / 100, true);
  assert.deepEqual(invoicePeriod(new Date("2026-11-01T12:00:00Z")), { start: "2026-10-01", end: "2026-10-31", issue: "2026-11-01" });
  assert.deepEqual(invoicePeriod(new Date("2027-01-01T12:00:00Z")).start, "2026-12-01");
  assert.equal(daysOverdue("2026-11-30", new Date("2026-11-30T15:00:00Z")), 0);
  assert.equal(daysOverdue("2026-11-30", new Date("2026-12-11T15:00:00Z")), 11);
  assert.equal(invoiceReminderDue("2026-11-30", 0, new Date("2026-11-26T15:00:00Z")), null);
  assert.equal(invoiceReminderDue("2026-11-30", 0, new Date("2026-11-27T15:00:00Z")), -3);
  assert.equal(invoiceReminderDue("2026-11-30", 1, new Date("2026-12-01T15:00:00Z")), 1);
});

test("business sales engine: segments map to real services; emails are honest with an unsubscribe and address", async () => {
  const { BIZ_SEGMENTS, bizLeadEmail, bizLeadScore, BIZ_LEAD_SEQUENCE } = await import("./biz-lead-engine.ts");
  for (const [k, seg] of Object.entries(BIZ_SEGMENTS)) for (const s of seg.services) assert.ok(SERVICES.some((x) => x.slug === s), `${k}: ${s}`);
  for (let i = 0; i < BIZ_LEAD_SEQUENCE.length; i++) {
    const m = bizLeadEmail({ step: i, businessName: "Maple PM", segment: "property_manager", city: "Southfield", pilotPct: 20, pilotJobs: 2, signupUrl: "https://x/b/abc", unsubscribeUrl: "https://x/u", postalAddress: "1 Main St, Detroit, MI" });
    assert.match(m.text, /https:\/\/x\/u/); assert.match(m.text, /1 Main St/); assert.match(m.text, /https:\/\/x\/b\/abc/);
  }
  assert.match(bizLeadEmail({ step: 0, businessName: "A", segment: "stager", pilotPct: 20, pilotJobs: 1, signupUrl: "u", unsubscribeUrl: "u", postalAddress: "a" }).text, /up to 20% off your first job/);
  assert.ok(bizLeadScore({ email: "a@b.co", reviewCount: 30, rating: 4.8, website: "x" }) > bizLeadScore({ phone: "1" }));
});

test("open job board: first looks first, then 30 min after the first targeted round; never unpaid or taken", async () => {
  const { onBoard, BOARD, favoriteWindowHours, FAVORITES } = await import("./board.ts");
  const now = new Date("2026-10-10T15:00:00Z");
  const ago = (min: number) => new Date(now.getTime() - min * 60000).toISOString();
  const job = { status: "dispatched", contractor_id: null, paid_at: ago(60), scheduled_date: "2026-10-12" };
  assert.equal(onBoard(job, [], now), true, "never offered (no ranked pro) → open");
  assert.equal(onBoard({ ...job, paid_at: null }, [], now), false, "unpaid");
  assert.equal(onBoard({ ...job, billed_on_terms: true, paid_at: null }, [], now), true, "billed on account terms counts as paid");
  assert.equal(onBoard({ ...job, contractor_id: "p" }, [], now), false, "taken");
  assert.equal(onBoard({ ...job, status: "assigned" }, [], now), false);
  assert.equal(onBoard({ ...job, scheduled_date: "2026-10-09" }, [], now), false, "in the past");
  assert.equal(onBoard({ ...job, scheduled_date: "2026-11-30" }, [], now), false, `beyond ${BOARD.horizonDays} days`);
  assert.equal(onBoard(job, [{ kind: "job", status: "offered", offered_at: ago(10) }], now), false, "first round still fresh");
  assert.equal(onBoard(job, [{ kind: "job", status: "offered", offered_at: ago(BOARD.afterMinutes) }], now), true, "first round 30 min old");
  assert.equal(onBoard(job, [{ kind: "job", status: "declined", offered_at: ago(5) }], now), true, "everyone passed");
  for (const kind of ["favorite", "recurring", "redo", "account"])
    assert.equal(onBoard(job, [{ kind, status: "offered", offered_at: ago(120) }], now), false, `${kind} first look is respected`);
  assert.equal(onBoard(job, [{ kind: "favorite", status: "expired", offered_at: ago(240) }, { kind: "job", status: "offered", offered_at: ago(5) }], now), false, "the window after a first look is the targeted round's");
  assert.equal(onBoard(job, [{ kind: "board", status: "offered", offered_at: ago(1) }], now), true, "a board claim doesn't hide the job");
  assert.equal(favoriteWindowHours("2026-10-14", now), FAVORITES.firstLookHours);
  assert.equal(favoriteWindowHours("2026-10-10", now), 1, "job today → short window so it still gets covered");
  assert.equal(favoriteWindowHours(null, now), FAVORITES.firstLookHours);
});

test("job-posting letter: names their posting, keeps to what we promise, unsubscribe and address on every email", async () => {
  const { bizLeadEmail, bizCoverLetter, jobPostNeed, BIZ_LEAD_SEQUENCE, BIZ_SEGMENTS } = await import("./biz-lead-engine.ts");
  for (const s of BIZ_SEGMENTS.facilities.services) assert.ok(SERVICES.some((x) => x.slug === s), s);
  const ctx = { businessName: "Maple PM", segment: "property_manager" as const, city: "Southfield", pilotPct: 20, pilotJobs: 2, signupUrl: "https://x/b/abc", unsubscribeUrl: "https://x/u", postalAddress: "1 Main St, Detroit, MI", jobTitle: "Office Cleaner", postingSource: "Indeed" };
  const first = bizLeadEmail({ ...ctx, step: 0 });
  assert.match(first.subject, /Office Cleaner posting on Indeed/);
  assert.match(first.text, /for an Office Cleaner in Southfield/);
  for (let i = 0; i < BIZ_LEAD_SEQUENCE.length; i++) { const m = bizLeadEmail({ ...ctx, step: i }); assert.match(m.text, /https:\/\/x\/u/); assert.match(m.text, /1 Main St/); }
  assert.doesNotMatch(first.text, /Net[- ]?30|surcharge|guarantee upfront/i, "terms are case by case; prices can change with an approved change order");
  assert.match(first.text, /approved accounts/);
  assert.equal(jobPostNeed("Groundskeeper").work, "grounds work");
  assert.equal(jobPostNeed("Housekeeper").work, "cleaning");
  const letter = bizCoverLetter({ ...ctx, step: 0, senderName: "Jordan Smith", phone: "(313) 555-0100" });
  assert.match(letter.text, /Jordan Smith/); assert.match(letter.text, /call me at \(313\) 555-0100/);
  assert.match(bizLeadEmail({ ...ctx, jobTitle: null, step: 0 }).subject, /move-out clean/i, "no job title → the segment sequence");
});

test("email center: merge tags, HTML with button and footer, law and spam checks, pasted lists", async () => {
  const { mergeTags, renderEmailHtml, lintCampaign, parseEmailList, marketingFooter, EMAIL_TEMPLATES, EMAIL_AUDIENCES } = await import("./email-center.ts");
  assert.equal(mergeTags("Hi {{first_name|there}}, {{company}}!", { first_name: "" }), "Hi there, !");
  assert.equal(mergeTags("Hi {{ first_name }}", { first_name: "Ana" }), "Hi Ana");
  const foot = marketingFooter("customers", "1 Main St, Detroit, MI", "https://x/unsub");
  assert.match(foot, /1 Main St/); assert.match(foot, /https:\/\/x\/unsub/); assert.match(foot, /booked a service/);
  assert.match(marketingFooter("customers", "a", "u", "es"), /Cancelar la suscripción/);
  const r = renderEmailHtml("Hello **you** <script>\n\n[Book now](https://a.co/b)\n\n• one\n• two", { footer: foot, preheader: "pre", link: (u) => `https://t/${encodeURIComponent(u)}` });
  assert.match(r.html, /<b>you<\/b> &lt;script&gt;/, "bold, and HTML is escaped");
  assert.match(r.html, /href="https:\/\/t\/https%3A%2F%2Fa.co%2Fb"[^>]*>Book now<\/a>/, "button with tracked link");
  assert.match(r.html, /<li[^>]*>one<\/li>/);
  assert.match(r.text, /Book now: https:\/\/a.co\/b/); assert.match(r.text, /Unsubscribe: https:\/\/x\/unsub/);
  assert.ok(lintCampaign({ subject: "Re: your home", body: "Hello there, this is long enough {{book_url}}" }).blockers.some((b) => /Re:/.test(b)), "deceptive Re: subject blocked");
  assert.ok(lintCampaign({ subject: "Hi", body: "Hello {{firstname}}, this is long enough {{book_url}}" }).blockers.some((b) => /firstname/.test(b)), "typo tag blocked");
  assert.ok(lintCampaign({ subject: "BIG SAVINGS NOW", body: "Act now!! click here {{book_url}} and more text" }).warnings.length >= 2);
  for (const t of EMAIL_TEMPLATES) {
    assert.ok(t.audience in EMAIL_AUDIENCES);
    const l = lintCampaign(t);
    if (t.key !== "new_service") assert.deepEqual(l.blockers, [], `${t.key}: ${l.blockers.join(" ")}`);
    else assert.ok(l.blockers.length, "new-service template makes you fill in the service name");
  }
  assert.deepEqual(parseEmailList("Jane Doe <JANE@x.com>\nbob@y.co, Bob\njane@x.com\nnot an email"), [{ email: "jane@x.com", name: "Jane Doe" }, { email: "bob@y.co", name: "Bob" }]);
});

test("job checklists: every service has one, standard vs deep vs move-out differ, special instructions on top, Spanish everywhere", async () => {
  const { buildChecklist, resolveChecklist, checklistProgress, checklistText, CHECKLISTS, checklistOutline } = await import("./checklists.ts");
  const { buildWorkOrder, workOrderText } = await import("./workorder.ts");
  for (const s of SERVICES) {
    const c = buildChecklist(s.slug, Object.fromEntries(s.questions.map((q) => [q.id, q.default])));
    const items = c.sections.flatMap((x) => x.items);
    assert.ok(items.length >= 3, `${s.slug}: checklist too short`);
    assert.equal(new Set(items.map((x) => x.id)).size, items.length, `${s.slug}: duplicate item ids`);
    for (const x of items) assert.ok(x.text_es && x.text_es !== "", `${s.slug}: ${x.id} needs Spanish`);
    assert.ok(items.some((x) => x.required), `${s.slug}: no required items`);
    assert.ok(checklistOutline(s.slug).sections.length);
  }
  for (const t of Object.values(CHECKLISTS)) {
    const svc = SERVICES.find((x) => x.slug === t.service);
    assert.ok(svc, `${t.service}: template for an unknown service`);
    for (const sec of t.sections) for (const it of [sec, ...sec.items]) if (it.when) assert.ok(svc!.questions.some((q) => q.id === it.when!.q), `${t.service}: condition on unknown question ${it.when.q}`);
    for (const sec of t.sections) for (const it of sec.items) assert.ok(it.es.length > 3, `${t.service}.${sec.id}.${it.id} Spanish`);
  }
  const ids = (lvl: string, extra: Record<string, unknown> = {}) => buildChecklist("house-cleaning", { level: lvl, ...extra }).sections.flatMap((s) => s.items.map((x) => x.id));
  const std = ids("standard"), deep = ids("deep"), move = ids("move");
  assert.ok(!std.includes("detail.baseboards") && deep.includes("detail.baseboards") && move.includes("detail.baseboards"));
  assert.ok(move.includes("kitchen.inside_cabinets") && !deep.includes("kitchen.inside_cabinets"));
  assert.ok(ids("standard", { fridge_oven: true }).includes("kitchen.oven") && !std.includes("kitchen.oven"));
  assert.ok(ids("standard", { pets: true }).includes("rooms.pet_hair"));
  assert.equal(buildChecklist("house-cleaning", { level: "deep" }).title, "Deep clean checklist");
  const job = { service_slug: "house-cleaning", answers: { level: "standard" }, notes: "Dog is friendly", instructions: "Gate code 4411", checklist_extra: [{ id: "x1", text: "Skip the office", from: "customer" as const }] };
  const c = resolveChecklist(job);
  assert.equal(c.sections[0].id, "special");
  assert.deepEqual(c.sections[0].items.map((x) => x.id), ["special.instr1", "special.x1", "special.notes"]);
  assert.equal(c.sections[0].items.find((x) => x.id === "special.x1")!.required, false, "customer requests aren't required");
  const req = c.sections.flatMap((s) => s.items).filter((x) => x.required);
  const p0 = checklistProgress(c, []);
  assert.equal(p0.open.length, req.length);
  const p1 = checklistProgress(c, req.map((x) => ({ item_id: x.id, status: "done" as const })));
  assert.equal(p1.open.length, 0);
  assert.match(checklistText(c, "en", [{ item_id: "kitchen.sink", status: "na", note: "no sink" }]), /N\/A \(no sink\)/);
  // frozen checklist wins over the current template; special instructions stay live
  const frozen = { ...buildChecklist("house-cleaning", { level: "standard" }), version: 0 };
  assert.equal(resolveChecklist({ ...job, checklist: frozen }).version, 0);
  const w = buildWorkOrder({ ref: "HND-1", service_slug: "house-cleaning", answers: { level: "deep" }, notes: null, scheduled_date: "2026-10-10", time_window: "morning", address: "1 A", city: "Detroit", state: "MI", zip: "48226", contact_name: "C", contact_phone: "1", company_name: null, contractor_payout: 100 } as never, { reveal: false });
  assert.match(workOrderText(w), /DEEP CLEAN CHECKLIST/);
  assert.match(workOrderText(buildWorkOrder({ ...w, ref: "HND-1", service_slug: "house-cleaning", answers: { level: "deep" }, scheduled_date: null, time_window: "morning", city: "Detroit", state: "MI", zip: "48226", contractor_payout: 100 } as never, { reveal: false, locale: "es" }), "es"), /LISTA DE LIMPIEZA PROFUNDA/);
});

test("pro interview: plans per trade, scoring rules, no protected topics, approval checklist", async () => {
  const { QUESTIONS, interviewPlan, scoreInterview, approvalChecklist, COMPETENCIES, tradeGroups } = await import("./interview.ts");
  const { TRADES } = await import("./services.ts");
  assert.equal(new Set(QUESTIONS.map((q) => q.id)).size, QUESTIONS.length, "unique question ids");
  for (const q of QUESTIONS) assert.ok(q.es.length > 10 && q.lookFor.length > 10, `${q.id}: Spanish and look-for`);
  // no question touches a protected topic
  const banned = /\b(age|old are you|born|citizen|immigra|religio|church|married|pregnan|children|kids|disab|health|medical|medication|arrest|convict|criminal|nationality|accent|credit|union)\b/i;
  for (const q of QUESTIONS) assert.doesNotMatch(q.en, banned, `${q.id} asks about a protected topic`);
  for (const t of TRADES) {
    const plan = interviewPlan([t.id]);
    assert.ok(tradeGroups([t.id]).length === 1, `${t.id} has a trade group`);
    assert.ok(plan.length >= 15 && plan.length <= 22, `${t.id}: plan size ${plan.length}`);
    for (const c of Object.keys(COMPETENCIES)) assert.ok(plan.some((q) => q.competency === c), `${t.id}: plan covers ${c}`);
    assert.equal(plan[plan.length - 1].id, "questions");
  }
  assert.ok(interviewPlan(["cleaning", "lawn", "plumbing", "pet_care"]).filter((q) => q.group).length <= 6, "trade questions capped");
  const all = (n: number) => Object.keys(COMPETENCIES).map((c) => ({ competency: c as never, score: n }));
  assert.equal(scoreInterview(all(4)).result, "advance");
  assert.equal(scoreInterview(all(4), ["Won't carry required insurance"]).result, "not_now");
  assert.equal(scoreInterview(all(3)).result, "follow_up", "3.0 average is a follow-up, not an advance");
  assert.equal(scoreInterview(all(2)).result, "not_now");
  assert.equal(scoreInterview([...all(5).slice(1), { competency: "skill" as never, score: 1 }]).result, "follow_up", "one very low score → follow up even with a high average");
  assert.equal(scoreInterview(all(5).slice(0, 4)).result, "follow_up", "missing competencies → follow up");
  const c0 = approvalChecklist({ applied_at: "2026-10-01T00:00:00Z" });
  assert.equal(c0.next?.key, "screen");
  const c1 = approvalChecklist({ applied_at: "x", ai_screen: { score: 80 }, interview: { status: "completed", result: "advance" }, onboarding: [{ key: "w9", label: "W-9 on file", done: false }] });
  assert.equal(c1.next?.key, "decision", "after the interview a person decides");
  assert.equal(c1.next?.who, "staff");
  assert.equal(approvalChecklist({ applied_at: "x", ai_screen: { score: 80 }, interview: { status: "completed" }, invited_at: "2026-10-02" }).next?.key, "account", "after the invite: they create their pro account");
  const c2 = approvalChecklist({ applied_at: "x", ai_screen: { score: 80 }, interview: { status: "completed" }, invited_at: "2026-10-02", account_linked: true, onboarding: [{ key: "w9", label: "W-9 on file", done: true }, { key: "background", label: "Background check cleared", done: false }] });
  assert.equal(c2.next?.key, "setup:background");
});

test("pro rewards: formula, multipliers, milestones, catalog, cost stays near 10% of our take", async () => {
  const { pointsForJob, tenureTier, takeOf, milestonesReached, CATALOG_SEED, REWARD_DEFAULTS, pointsToDollars, monthsBetween, REWARD_RULES_EN, REWARD_RULES_ES } = await import("./rewards.ts");
  assert.equal(takeOf({ price_final: 200, contractor_payout: 150 }), 50);
  assert.equal(takeOf({ price_final: 100, contractor_payout: 120 }), 0, "never negative");
  const base = { take: 50, monthsActive: 0, qaPassedFirstTime: false, redo: false, refunded: false };
  assert.equal(pointsForJob(base).points, 500, "10 points per $1 of take");
  assert.equal(pointsForJob({ ...base, qaPassedFirstTime: true, rating: 5 }).points, 625, "quality ×1.25");
  assert.equal(pointsForJob({ ...base, qaPassedFirstTime: true, rating: 4.5 }).points, 500, "low rating: no quality bonus");
  assert.equal(pointsForJob({ ...base, qaPassedFirstTime: true, redo: true }).points, 500, "redo: no quality bonus");
  assert.equal(pointsForJob({ ...base, refunded: true }).points, 0, "refunded: nothing");
  assert.equal(pointsForJob({ ...base, monthsActive: 30, qaPassedFirstTime: true }).points, 938, "2 years ×1.5 and quality");
  assert.deepEqual([0, 5, 6, 11, 12, 23, 24, 60].map((m) => tenureTier(m).multiplier), [1, 1, 1.1, 1.1, 1.25, 1.25, 1.5, 1.5]);
  assert.equal(monthsBetween("2025-10-05", new Date("2026-10-05T12:00:00")), 12);
  // base cost = 10 points × $0.01 = 10% of take; max = 18.75%
  assert.equal(pointsToDollars(pointsForJob(base).points), 5);
  assert.ok(pointsToDollars(pointsForJob({ ...base, monthsActive: 30, qaPassedFirstTime: true }).points) / 50 <= 0.19);
  assert.deepEqual(milestonesReached({ jobsCompleted: 55, monthsActive: 13, fiveStarReviews: 30 }, ["jobs_10"]).map((m) => m.key), ["jobs_50", "year_1", "five_star_25"]);
  for (const c of CATALOG_SEED) {
    assert.ok(c.name_es && c.description_es, `${c.slug} Spanish`);
    const value = c.points * REWARD_DEFAULTS.pointValue;
    assert.ok(c.cost_usd <= value * 1.05, `${c.slug}: costs more than its points are worth`);
  }
  assert.equal(REWARD_RULES_EN().length, REWARD_RULES_ES().length);
  for (const r of REWARD_RULES_EN()) assert.doesNotMatch(r, /\b(share|equity|stock|wage|salary|employee)\b/i, "points are not equity or pay");
});

test("security: event budget sets aside licensed guards when alcohol is served; guard service prices by coverage", async () => {
  const { planEventBudget, securityAdvice } = await import("./event-budget.ts");
  assert.equal(securityAdvice({ guests: 40, alcohol: true }).recommended, false);
  assert.deepEqual([securityAdvice({ guests: 120, alcohol: true }).guards, securityAdvice({ guests: 120 }).guards], [3, 2]);
  assert.equal(securityAdvice({ guests: 160 }).recommended, true);
  const p = planEventBudget({ budget: 10000, guests: 120, eventType: "wedding", alcohol: true });
  assert.equal(p.lines.reduce((t, l) => t + l.amount, 0), 10000);
  assert.ok(p.lines.some((l) => l.key === "security" && l.amount === 3 * 5 * 39));
  assert.equal(planEventBudget({ budget: 10000, guests: 120, eventType: "wedding" }).lines.some((l) => l.key === "security"), false);
  const tight = planEventBudget({ budget: 1000, guests: 100, eventType: "birthday", alcohol: true });
  assert.ok(!tight.lines.some((l) => l.key === "security") && tight.warnings.some((w) => w.includes("licensed guard")));
  const post = estimate({ slug: "security-guard", answers: { kind: "post", guards: 1, hours: 8, days: 5, type: "unarmed" } });
  assert.equal(post.items[0].amount, 1 * 8 * 5 * 36);
  const patrol = estimate({ slug: "security-guard", answers: { kind: "patrol", visits: 3, days: 7 } });
  assert.equal(patrol.items[0].amount, 3 * 7 * 45);
  assert.ok(getService("security-guard")!.licensed && getService("security-guard")!.trades.includes("security"));
});

test("gov contracts: SAM.gov records parse, NAICS map to our services, fit scores Michigan open work highest", async () => {
  const { parseSamOpportunity, govFit, samSearchQueries, servicesForNaics, GOV_NAICS } = await import("./gov-contracts.ts");
  for (const n of GOV_NAICS) assert.ok(servicesForNaics(n.code).length > 0, `NAICS ${n.code} maps to no catalog service`);
  const raw = {
    noticeId: "abc123", title: "Janitorial Services — Detroit Federal Building", solicitationNumber: "47PF0026Q0001", fullParentPathName: "GENERAL SERVICES ADMINISTRATION.PUBLIC BUILDINGS SERVICE.PBS R5",
    postedDate: "2026-10-01", type: "Combined Synopsis/Solicitation", typeOfSetAside: "SBA", typeOfSetAsideDescription: "Total Small Business Set-Aside (FAR 19.5)",
    responseDeadLine: "2026-10-30T14:00:00-04:00", naicsCode: "561720", classificationCode: "S201", active: "Yes",
    placeOfPerformance: { city: { code: "22000", name: "Detroit" }, state: { code: "MI", name: "Michigan" }, zip: "48226" },
    pointOfContact: [{ fullName: "Pat Officer", email: "pat@gsa.gov", phone: "3135550100", type: "primary" }],
    description: "https://api.sam.gov/prod/opportunities/v1/noticedesc?noticeid=abc123", uiLink: "https://sam.gov/opp/abc123/view",
  };
  const o = parseSamOpportunity(raw)!;
  assert.equal(o.ptype, "k"); assert.equal(o.agency, "GENERAL SERVICES ADMINISTRATION"); assert.equal(o.office, "PBS R5"); assert.equal(o.pop_state, "MI");
  const now = new Date("2026-10-05T12:00:00Z");
  const good = govFit(o, { now });
  assert.ok(good.score >= 80 && good.biddable && good.services.includes("house-cleaning"), JSON.stringify(good));
  assert.ok(good.flags.some((f) => f.includes("subcontracting")));
  assert.ok(govFit({ ...o, set_aside_code: "SDVOSBC" }, { now }).score < good.score - 30);
  assert.ok(govFit({ ...o, set_aside_code: "SDVOSBC" }, { now, certifications: ["SDVOSBC"] }).score === good.score);
  assert.ok(govFit({ ...o, pop_state: "TX", pop_city: "Austin" }, { now }).score < good.score);
  assert.ok(govFit({ ...o, ptype: "a" }, { now }).score <= 15);
  assert.ok(govFit({ ...o, response_deadline: "2026-10-01T00:00:00Z" }, { now }).flags.some((f) => f.includes("passed")));
  assert.equal(parseSamOpportunity({ title: "no id" }), null);
  const qs = samSearchQueries({ naics: ["561720", "561730", "bad"], state: "mi", ptypes: ["o", "k", "zz"], daysBack: 7, now });
  assert.equal(qs.length, 2);
  const q = new URLSearchParams(qs[0]);
  assert.deepEqual([q.get("postedFrom"), q.get("postedTo"), q.get("ncode"), q.get("state"), q.get("ptype")], ["09/28/2026", "10/05/2026", "561720", "MI", "o,k"]);
  assert.ok(!qs[0].includes("api_key"));
});

test("bid engine: price from pro cost up, margin on price, gate blocks until everything is true", async () => {
  const { priceLine, priceBid, goDecision, bestQuotes, submitGate, REVIEW_CHECKS, standardRequirements, GO_NO_GO } = await import("./bid-engine.ts");
  // $30 pro cost: overheads 20% + financing 12%×45/365 = 1.48% → 36.44 loaded → /0.85 = 42.88 → $43
  const l = priceLine({ id: "a", item: "Mow", unit: "visit", qty: 15, years: 2, pro_unit_cost: 30 });
  assert.equal(l.loaded, 36.44); assert.equal(l.unitPrice, 43); assert.equal(l.yearPrice, 645); assert.equal(l.totalPrice, 1290);
  assert.ok(l.marginPct >= 15);
  assert.ok(priceLine({ id: "b", item: "x", unit: "u", qty: 1, years: 1, pro_unit_cost: 30 }, { marginPct: 5 }).flags.some((f) => f.includes("floor")));
  assert.ok(priceLine({ id: "c", item: "x", unit: "u", qty: 1, years: 1, pro_unit_cost: 30, benchmark: 35 }).flags.some((f) => f.includes("above the last award")));
  const bid = priceBid([l, { id: "d", item: "Snow", unit: "event", qty: 6, years: 2, pro_unit_cost: null }]);
  assert.ok(bid.warnings.some((w) => w.includes("without a pro price")));
  assert.equal(bid.totals.totalPrice, 1290);
  assert.equal(goDecision({ eligible: "yes", staffed: "yes", insured: "yes", profitable: "yes", time: "yes" }).decision, "go");
  assert.equal(goDecision({ eligible: "no", staffed: "yes" }).decision, "no_go");
  assert.equal(goDecision({ eligible: "yes" }).decision, "undecided");
  const q = bestQuotes([{ id: "a" }], [{ contractor_id: "p1", status: "committed", prices: { a: 32 } }, { contractor_id: "p2", status: "committed", prices: { a: 29 } }, { contractor_id: "p3", status: "declined", prices: { a: 10 } }]);
  assert.equal(q.a.best?.contractor_id, "p2"); assert.equal(q.a.count, 2); assert.ok(q.a.backup);
  const allYes = Object.fromEntries(GO_NO_GO.map((g) => [g.id, "yes" as const]));
  const review = Object.fromEntries(REVIEW_CHECKS.map((c) => [c.id, true]));
  const now = new Date("2026-10-05T12:00:00Z");
  const base = { go: allYes, requirements: [{ required: true, done: true }], lines: [l], review, reviewer: "b@x.com", owner: "a@x.com", confirmationUploaded: true, dueAt: "2026-10-20T18:00:00Z", now };
  assert.ok(submitGate(base).canMarkSubmitted);
  assert.ok(!submitGate({ ...base, confirmationUploaded: false }).canMarkSubmitted);
  assert.ok(submitGate({ ...base, confirmationUploaded: false }).ready);
  assert.ok(submitGate({ ...base, requirements: [{ required: true, done: false }] }).missing.some((m) => m.includes("compliance")));
  assert.ok(submitGate({ ...base, review: {} }).missing.some((m) => m.includes("Review")));
  assert.ok(submitGate({ ...base, go: { ...allYes, eligible: "no" } }).missing.some((m) => m.includes("no-go")));
  assert.ok(submitGate({ ...base, dueAt: "2026-10-01T00:00:00Z" }).missing.some((m) => m.includes("passed")));
  assert.ok(submitGate({ ...base, reviewer: "a@x.com" }).warnings.some((w) => w.includes("second person")));
  assert.ok(standardRequirements("city").some((r) => r.text.includes("tax clearance")));
  assert.ok(standardRequirements("sam").some((r) => r.text.includes("SAM.gov")));
});

test("Handled Talent: 25% fee splits 20/5, retained thirds with true-up, guarantee, ownership, fair hiring", async () => {
  const { placementFee, retainedSchedule, guaranteeOutcome, ownershipCheck, fairHiringCheck, TALENT_TERMS } = await import("./talent.ts");
  const p = placementFee(80000);
  assert.deepEqual([p.fee, p.recruiterPay, p.platform], [20000, 16000, 4000]);
  const m = placementFee(20000, { minimumFee: 7500 });
  assert.ok(m.minimumApplied); assert.equal(m.fee, 7500); assert.equal(m.recruiterPay, 6000); assert.equal(m.platform, 1500);
  const r = retainedSchedule({ estimatedSalary: 150000, engagedOn: "2026-10-05" });
  assert.equal(r.estimatedFee, 45000);
  assert.deepEqual(r.payments.map((x) => x.amount), [15000, 15000, 15000]);
  assert.equal(r.payments[0].recruiterPay, 12000);
  assert.equal(r.payments[1].due, "2026-11-04");
  const up = retainedSchedule({ estimatedSalary: 150000, engagedOn: "2026-10-05", actualSalary: 170000 });
  assert.equal(up.totalFee, 51000); assert.equal(up.payments[2].amount, 21000);
  const down = retainedSchedule({ estimatedSalary: 150000, engagedOn: "2026-10-05", actualSalary: 80000 });
  assert.equal(down.payments[2].amount, 0, "never a negative last payment");
  const base = { fee: 20000, recruiterPay: 16000, startDate: "2026-01-05", paidOnTime: true };
  assert.equal(guaranteeOutcome({ ...base, endDate: "2026-02-04", reason: "resigned" }).remedy, "replacement");
  const ref = guaranteeOutcome({ ...base, endDate: "2026-02-04", reason: "resigned", remedy: "refund" });
  assert.equal(ref.worked, 30); assert.equal(ref.refund, 13333.33); assert.equal(ref.recruiterClawback, 10666.67);
  assert.equal(guaranteeOutcome({ ...base, endDate: "2026-02-04", reason: "laid_off" }).covered, false);
  assert.equal(guaranteeOutcome({ ...base, endDate: "2026-06-04", reason: "resigned" }).covered, false);
  assert.equal(guaranteeOutcome({ ...base, endDate: "2026-02-04", reason: "resigned", paidOnTime: false }).covered, false);
  const prior = [{ client_id: "c1", candidate_email: "Ann@x.com", recruiter_id: "r1", submitted_at: "2026-03-01T00:00:00Z" }];
  const now = new Date("2026-10-05T00:00:00Z");
  assert.equal(ownershipCheck(prior, { client_id: "c1", candidate_email: "ann@x.com", recruiter_id: "r2" }, now).ok, false);
  assert.equal(ownershipCheck(prior, { client_id: "c2", candidate_email: "ann@x.com", recruiter_id: "r2" }, now).ok, true);
  assert.equal(ownershipCheck(prior, { client_id: "c1", candidate_email: "ann@x.com", recruiter_id: "r2" }, new Date("2027-04-01T00:00:00Z")).ok, true, "ownership lapses after 12 months");
  assert.ok(fairHiringCheck("Looking for a young, energetic salesman, native English speaker").length >= 3);
  assert.equal(fairHiringCheck("Senior accountant, CPA, 5+ years, fluent in English, authorized to work in the U.S.").length, 0);
  assert.equal(TALENT_TERMS.contingencyPct - TALENT_TERMS.recruiterPct, 5);
});

test("bid archive: comparing two submitted versions", async () => {
  const { compareSubmissions } = await import("./bid-engine.ts");
  const L = (item: string, unitPrice: number, qty = 10) => ({ id: item, item, unit: "visit", qty, years: 1, unitPrice, totalPrice: unitPrice * qty, marginPct: 15 });
  const c = compareSubmissions({ lines: [L("Mow", 45), L("Snow", 55), L("Trees", 400)], total: 5000 }, { lines: [L("Mow", 43), L("Snow", 55), L("Debris", 60)], total: 4600 });
  assert.deepEqual(c.changed, [{ item: "Mow", unit: "visit", from: 45, to: 43, qtyFrom: 10, qtyTo: 10 }]);
  assert.deepEqual(c.added, ["Debris"]); assert.deepEqual(c.removed, ["Trees"]);
  assert.equal(c.diff, -400); assert.equal(c.pct, -8);
});

test("dead animal removal: priced by size and location, extra animals at 35%, add-ons, wildlife trade", () => {
  const open = getService("dead-animal-removal")!.price({ size: "small", where: "open", count: 1 });
  assert.deepEqual(open.items.map((i) => i.amount), [129]);
  const attic = getService("dead-animal-removal")!.price({ size: "medium", where: "attic", count: 3, sanitize: true, pet: true });
  assert.deepEqual(attic.items.map((i) => i.amount), [159, 2 * Math.round(159 * 0.35), 175, 49, 45]);
  const under = getService("dead-animal-removal")!.price({ size: "xl", where: "under", count: 1 });
  assert.deepEqual(under.items.map((i) => i.amount), [299, 90]);
  const sv = getService("dead-animal-removal")!;
  assert.ok(sv.category === "removal" && sv.trades.includes("wildlife") && !sv.licensed && sv.frequencies.join() === "once");
});

test("new services: small engine, dock & door, fire extinguisher, foundation, used oil, urgent ride", () => {
  const p = (slug: string, a: Answers) => getService(slug)!.price(a).items.map((i) => i.amount);
  assert.deepEqual(p("small-engine-repair", { equipment: "riding", service: "repair", machines: 1, pickup: true }), [159 + 50, 89]);
  assert.deepEqual(p("dock-door-service", { service: "inspection", kind: "dock", doors: 4 }), [95, 4 * 75]);
  assert.deepEqual(p("dock-door-service", { service: "repair", kind: "overhead", doors: 2, after_hours: true }), [95, 2 * 145, 150]);
  assert.deepEqual(p("fire-extinguisher-inspection", { units: 10, recharge: 2, hydro: 0, new_units: 1 }), [59, 120, 70, 79]);
  assert.deepEqual(p("foundation-repair", { cracks: 1, walls: 1, piers: 0, drain_ft: 0 }), [550, 4000]);
  assert.deepEqual(p("waste-oil-collection", { gallons: 255, container: "drums", filter_drums: 1, antifreeze: 0 }), [95, 70, 95]);
  assert.deepEqual(p("urgent-ride", { vehicle: "sedan", miles: 10, passengers: 1, wait_return: true }), [35, 55, 30]);
  // urgent rides are already priced on demand: no within-48h surcharge on top
  assert.ok(!estimate({ slug: "urgent-ride", answers: { miles: 10 }, rush: true }).items.some((i) => /48h/.test(i.label)));
  assert.ok(estimate({ slug: "small-engine-repair", answers: {}, rush: true }).items.some((i) => /48h/.test(i.label)));
  assert.ok(getService("foundation-repair")!.siteVisit && getService("foundation-repair")!.licensed);
  assert.ok(["fire-extinguisher-inspection", "waste-oil-collection", "urgent-ride"].every((x) => getService(x)!.licensed));
  assert.match(getService("urgent-ride")!.description, /call 911/i);
});

test("security: sign-in redirects stay on our site; outside fetches skip internal addresses; photo paths are ours", async () => {
  const { safeNext, safeExternalUrl, isPhotoPath } = await import("./security.ts");
  const o = "https://handledsvc.com";
  // after sign-in: only our own pages
  for (const ok of ["/account", "/hub?tab=jobs#x", "/pro/jobs/123"]) assert.equal(safeNext(ok, o), ok);
  for (const bad of ["//evil.com", "/\\evil.com", "/\\/evil.com", "https://evil.com", "javascript:alert(1)", "/\tevil", "", null]) assert.equal(safeNext(bad as string, o), "/auth/home", String(bad));
  // lead engines read business websites: never internal addresses
  for (const ok of ["https://acmecleaning.com/contact", "http://www.joes-lawn.net"]) assert.ok(safeExternalUrl(ok), ok);
  for (const bad of ["http://localhost:3000", "http://127.0.0.1", "http://10.0.0.5", "http://192.168.1.1", "http://172.16.0.1", "http://169.254.169.254/latest/meta-data",
    "http://100.64.0.1", "http://[::1]/", "http://2130706433/", "http://0x7f000001/", "ftp://example.com", "file:///etc/passwd", "http://user:pw@example.com",
    "http://metadata.google.internal", "http://example.com:6379", "http://intranet/"]) assert.equal(safeExternalUrl(bad), null, bad);
  // booking photos: exactly what /api/uploads creates
  assert.ok(isPhotoPath("booking/2026-10-06/1759734000000-a1b2c3d4.jpeg"));
  assert.ok(isPhotoPath("pro/0b8f3c1e-1234-4abc-9def-001122334455/1759734000000-a1b2c3d4.png"));
  for (const bad of ["booking/../pro-docs/w9.pdf", "pro-docs/x/1759734000000-a1b2c3d4.pdf", "booking/2026-10-06/x.jpeg", "/booking/2026-10-06/1759734000000-a1b2c3d4.jpeg", "booking/2026-10-06/1759734000000-a1b2c3d4.svg"]) assert.equal(isPhotoPath(bad), false, bad);
});

test("every AI agent runs with the $100M mission, the two priorities and its tasks", async () => {
  const { readdirSync, readFileSync } = await import("node:fs");
  const { AGENTS, MISSION, missionPrompt } = await import("./mission.ts");
  const dir = new URL("../../../apps/web/lib/ai/", import.meta.url);
  const used = new Set<string>();
  // AI calls only (structured / logRun) — not ops_alerts rows, which also have a kind
  for (const f of readdirSync(dir)) for (const line of readFileSync(new URL(f, dir), "utf8").split("\n")) if (!line.includes("ops_alerts")) for (const m of line.matchAll(/kind: "([a-z_]+)"/g)) used.add(m[1]);
  for (const f of ["../gov.ts", "../bids.ts"]) for (const m of readFileSync(new URL(f, dir), "utf8").matchAll(/kind: "((?:gov|bid)_[a-z_]+)"/g)) used.add(m[1]);
  for (const k of used) assert.ok(AGENTS.some((a) => a.kind === k), `agent ${k} has no role in mission.ts`);
  for (const a of AGENTS) {
    const p = missionPrompt(a.kind, ["Get 10 bookings"]);
    assert.match(p, /\$100M/);
    assert.ok(p.includes(MISSION.priorities[0]) && p.includes(MISSION.priorities[1]), `${a.kind} missing priorities`);
    assert.ok(a.tasks.length >= 1 && p.includes(a.tasks[0]), `${a.kind} missing standing tasks`);
    assert.match(p, /Get 10 bookings/);
    if (a.external) assert.match(p, /never mention revenue targets/);
    if (a.gate) assert.match(p, /gatekeeper/);
  }
});

test("Request for Proposal: summary lists every service with its frequency; follow-up asks for what's missing", async () => {
  const { rfpSummary, rfpFollowUp, RFP_NEXT_STEPS } = await import("./rfp.ts");
  const scope = { sqft: "not_sure" as const, site: "Detroit", services: [{ slug: "house-cleaning", frequency: "nightly" as const, note: "3 floors, 6 restrooms" }, { slug: "window-cleaning", frequency: "monthly" as const }],
    hours: ["after_hours" as const], vendor: "replacing" as const, pain: "missed visits", term: "twelve_months" as const, decision: "formal_bid" as const, bidDue: "2026-11-01", walkthrough: [], contact: "call" as const };
  const lines = rfpSummary(scope, { locations: 3, startBy: "Within 2 weeks", budget: 4000 });
  assert.ok(lines.some((l) => l.includes("Nightly") && l.includes("3 floors")));
  assert.ok(lines.some((l) => l.includes("Monthly")));
  assert.ok(lines.some((l) => l.includes("due 2026-11-01")));
  const ask = rfpFollowUp(scope, { locations: 3, budget: null, phone: null });
  for (const want of ["square footage", "all 3 locations", "Window Cleaning", "current vendor", "Budget", "due 2026-11-01", "phone number"]) assert.ok(ask.some((q) => q.toLowerCase().includes(want.toLowerCase())), `missing follow-up: ${want}`);
  assert.ok(!ask.some((q) => q.startsWith("House & Office Cleaning")), "a service with specifics needs no follow-up");
  assert.equal(RFP_NEXT_STEPS.length, 4);
});

test("coverage: cancel tiers, time zones and backup order", async () => {
  const { cancelTier, hoursUntilWindow, zonedInstant, nextBackup, openBackupRanks, backupAnswerMinutes } = await import("./coverage.ts");
  assert.equal(cancelTier(30), "free");
  assert.equal(cancelTier(24), "free");
  assert.equal(cancelTier(12), "short_notice");
  assert.equal(cancelTier(6), "short_notice");
  assert.equal(cancelTier(5.9), "late");
  assert.equal(cancelTier(-1), "late");
  // 8am in Detroit is 12:00 UTC in summer (EDT) and 13:00 UTC in winter (EST)
  assert.equal(zonedInstant("2026-07-10", 8).toISOString(), "2026-07-10T12:00:00.000Z");
  assert.equal(zonedInstant("2026-12-10", 8).toISOString(), "2026-12-10T13:00:00.000Z");
  // a morning job is 6h away at 06:00 UTC (2am Detroit) in July
  assert.equal(Math.round(hoursUntilWindow({ scheduled_date: "2026-07-10", time_window: "morning" }, new Date("2026-07-10T06:00:00Z"))), 6);
  assert.equal(hoursUntilWindow({ scheduled_date: null }), Infinity);
  const rows = [
    { contractor_id: "a", rank: 1, status: "asked" as const },
    { contractor_id: "b", rank: 2, status: "standby" as const },
    { contractor_id: "c", rank: 3, status: "standby" as const },
  ];
  assert.equal(nextBackup(rows)?.contractor_id, "b", "confirmed standbys go first");
  assert.equal(nextBackup(rows, ["b", "c"])?.contractor_id, "a", "then backups who were asked");
  assert.equal(nextBackup(rows, ["a", "b", "c"]), null);
  assert.deepEqual(openBackupRanks([{ contractor_id: "x", rank: 2, status: "standby" }, { contractor_id: "y", rank: 1, status: "declined" }]), [1, 3]);
  assert.ok(backupAnswerMinutes(2) < backupAnswerMinutes(12) && backupAnswerMinutes(12) < backupAnswerMinutes(48));
});

test("referral partner program: 10% of our take, never negative, codes", async () => {
  const { partnerCommission, partnerTake, makePartnerCode, cleanPartnerCode, partnerExpiry, PARTNER_PROGRAM } = await import("./partners.ts");
  assert.equal(PARTNER_PROGRAM.pctOfTake, 0.1);
  assert.equal(partnerTake({ price: 400, payout: 300 }), 100);
  assert.equal(partnerCommission({ price: 400, payout: 300 }), 10);
  assert.equal(partnerCommission({ price: 199.99, payout: 150 }), 4.99, "rounded down to the cent");
  assert.equal(partnerCommission({ price: 400, payout: 300, refunded: 60 }), 4, "refunds come out first");
  assert.equal(partnerCommission({ price: 400, payout: 300, refunded: 400 }), 0, "never negative");
  assert.equal(partnerCommission({ price: 100, payout: 120 }), 0);
  let i = 0;
  const code = makePartnerCode("Jane O'Neil", () => [0, 0.5, 0.99, 0.2][i++ % 4]);
  assert.match(code, /^JANEO[A-Z2-9]{4}$/);
  assert.equal(cleanPartnerCode(" jane7k2q "), "JANE7K2Q");
  assert.equal(cleanPartnerCode("<script>"), null);
  assert.equal(partnerExpiry(new Date("2026-10-07T00:00:00Z")).toISOString().slice(0, 10), "2027-10-07");
});

test("measurements pick the calibrated size band and are required", async () => {
  const { getService, applyMeasurements, missingMeasurements, questionVisible } = await import("./services.ts");
  const { estimate } = await import("./pricing.ts");
  const lawn = getService("lawn-care")!;
  assert.equal(applyMeasurements(lawn.questions, { yard_sqft: 8000 }).lot, "small");
  assert.equal(applyMeasurements(lawn.questions, { yard_sqft: 15000 }).lot, "quarter");
  assert.equal(applyMeasurements(lawn.questions, { yard_sqft: 60000 }).lot, "acre");
  assert.equal(applyMeasurements(lawn.questions, { yard_sqft: 0, lot: "half" }).lot, "half", "no measurement → band kept");
  // same price as picking the band by hand
  assert.equal(estimate({ slug: "lawn-care", answers: { yard_sqft: 15000 } }).point, estimate({ slug: "lawn-care", answers: { lot: "quarter" } }).point);
  assert.equal(missingMeasurements(lawn.questions, {}).map((q) => q.id).join(), "yard_sqft");
  assert.equal(missingMeasurements(lawn.questions, { yard_sqft: 9000 }).length, 0);
  assert.equal(questionVisible(lawn.questions.find((q) => q.id === "lot")!, {}, lawn.questions), false, "band isn't asked");
  const junk = getService("junk-removal")!;
  assert.equal(applyMeasurements(junk.questions, { cubic_yards: 3 }).volume, "quarter");
  assert.equal(applyMeasurements(junk.questions, { cubic_yards: 40 }).volume, "double");
  const animal = getService("dead-animal-removal")!;
  assert.equal(applyMeasurements(animal.questions, { weight_lb: 3 }).size, "small");
  assert.equal(applyMeasurements(animal.questions, { weight_lb: 150 }).size, "xl");
});

test("bid engine: measured lines, deal-maker, negotiation", async () => {
  const { catalogCost, dealStrategy, negotiate, priceLine, winProbability, MIN_MARGIN_PCT } = await import("./bid-engine.ts");
  // 2 acres of mowing → priced like a lawn of 87,120 sq ft (scaled above the top band)
  const two = catalogCost("lawn-care", 2, "acres")!, one = catalogCost("lawn-care", 1, "acre")!;
  assert.ok(two && one && two.retail > one.retail && two.proCost < two.retail, "acres convert and scale");
  assert.equal(catalogCost("lawn-care", 2, "gallons"), null);
  assert.equal(catalogCost(null, 2, "acres"), null);
  const line = priceLine({ id: "a", item: "Mow park, 2 acres", unit: "visit", qty: 30, years: 1, pro_unit_cost: null, slug: "lawn-care", measure_size: 2, measure_unit: "acres" });
  assert.equal(line.costSource, "catalog_estimate");
  assert.ok(line.unitPrice > 0 && line.deal, "estimated lines are priced and get a deal");
  // deal-maker never goes below the floor
  const d = dealStrategy({ loaded: 100, benchmark: 90 })!;
  assert.ok(d.recommended >= d.floorPrice && Math.abs(d.floorPrice - 100 / (1 - MIN_MARGIN_PCT / 100)) < 1.01);
  assert.ok(d.notes.some((n) => /above the market/.test(n)), "warns when cost beats the market");
  const rich = dealStrategy({ loaded: 100, benchmark: 160 })!;
  assert.ok(rich.recommended > rich.targetPrice, "captures room above target when the market pays more");
  const big = dealStrategy({ loaded: 100, annualValue: 300000 })!, small = dealStrategy({ loaded: 100, annualValue: 10000 })!;
  assert.ok(big.targetPrice < small.targetPrice, "big contracts get a thinner target");
  assert.ok(winProbability(90, 100, true) > winProbability(110, 100, true));
  // negotiation
  assert.equal(negotiate({ loaded: 100, ourPrice: 120, counter: 119 }).action, "accept");
  assert.equal(negotiate({ loaded: 100, ourPrice: 120, counter: 112 }).action, "counter");
  assert.equal(negotiate({ loaded: 100, ourPrice: 120, counter: 80 }).action, "walk");
});

test("bid engine learns the market from paid jobs", async () => {
  const { learnMarketRates, marketBenchmark, dealStrategy } = await import("./bid-engine.ts");
  const rows = [10000, 12000, 20000, 15000].map((sq, i) => ({ slug: "lawn-care", price: [60, 70, 110, 90][i], answers: { yard_sqft: sq } }));
  const r = learnMarketRates([...rows, { slug: "courier", price: 30 }]);
  assert.ok(r["lawn-care"] && !r.courier, "needs 3+ paid jobs");
  assert.equal(r["lawn-care"].n, 4);
  assert.equal(r["lawn-care"].unit, "sq ft");
  // 2 acres at the learned $/sq ft
  const m = marketBenchmark({ slug: "lawn-care", measure_size: 2, measure_unit: "acres" }, r)!;
  assert.ok(m > 400, "scales by measured size");
  assert.equal(marketBenchmark({ slug: "lawn-care" }, r), r["lawn-care"].medianJob, "unsized line → median job");
  const d = dealStrategy({ loaded: 100, market: 200 })!;
  assert.ok(d.recommended > d.targetPrice && d.notes.some((n) => /paid jobs/.test(n)), "anchors on paid jobs when no award");
});

test("Handled Points: earn, tiers, balance, redeem", async () => {
  const { loyaltyPointsForJob, loyaltyTier, loyaltyBalance, checkRedeem, redeemable, paidForPoints, loyaltyDollars } = await import("./loyalty.ts");
  assert.equal(paidForPoints({ price_final: 250, amount_refunded: 50 }), 200);
  assert.equal(loyaltyPointsForJob(199.99, 0).points, 199);
  assert.equal(loyaltyTier(999).key, "member");
  assert.equal(loyaltyTier(1000).key, "silver");
  assert.equal(loyaltyTier(5000).key, "gold");
  assert.equal(loyaltyTier(400).toNext, 600);
  assert.equal(loyaltyPointsForJob(200, 3000).points, 300, "gold earns 1.5x");
  const now = new Date("2026-10-07T00:00:00Z");
  const b = loyaltyBalance([
    { kind: "earn", points: 600, status: "available", created_at: "2026-09-01T00:00:00Z" },
    { kind: "bonus", points: 100, status: "available", created_at: "2026-09-01T00:00:00Z" },
    { kind: "earn", points: 300, status: "pending", created_at: "2026-10-01T00:00:00Z" },
    { kind: "earn", points: 900, status: "void", created_at: "2026-10-01T00:00:00Z" },
    { kind: "earn", points: 50, status: "available", created_at: "2024-01-01T00:00:00Z" },
    { kind: "redeem", points: -500, status: "available", created_at: "2026-09-20T00:00:00Z" },
  ], now);
  assert.deepEqual(b, { available: 250, pending: 300, lifetime: 1050, earned12m: 1000, redeemed: 500 });
  assert.equal(redeemable(1499), 1000);
  assert.equal(loyaltyDollars(500), 5);
  assert.ok(checkRedeem(500, 700).ok && checkRedeem(500, 700).credit === 5);
  assert.ok(!checkRedeem(250, 700).ok, "blocks of 500");
  assert.ok(!checkRedeem(1000, 700).ok, "not more than available");
});

test("area pricing raises price, minimum and pro pay", async () => {
  const { estimate } = await import("./pricing.ts");
  const ans = { bedrooms: 3, bathrooms: 2 } as never;
  const base = estimate({ slug: "house-cleaning", answers: ans });
  const sea = estimate({ slug: "house-cleaning", answers: ans, region: 1.25 });
  assert.equal(sea.region, 1.25);
  assert.ok(sea.point > base.point * 1.2 && sea.point < base.point * 1.3, `${base.point} → ${sea.point}`);
  assert.ok(sea.payout > base.payout, "pros are paid more in pricier areas");
  assert.ok(sea.items.some((i) => i.label === "Area pricing"));
  assert.equal(estimate({ slug: "house-cleaning", answers: ans, region: 99 }).region, 2, "bounded");
});
