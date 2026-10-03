/*
 * FILE    : packages/core/src/pricing.test.ts
 * PROJECT : Handled — AI-run home & business services
 * CREATED : 2026-10-01_1723 UTC
 * PURPOSE : Unit tests for the pricing engine and dispatch ranking.
 * UPDATED : 2026-10-02_0233 UTC — calculator checks for every service: more of anything never
 *           costs less, and every amount question actually moves the price.
 *           Run: npm test (node --test, no extra dependencies).
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { SERVICES, defaultAnswers, type Answers, type Question } from "./services.ts";
import { estimate, clampAiPrice, AI_MAX_RAISE, AI_MAX_CUT, BOOKING_FEE } from "./pricing.ts";
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
  assert.deepEqual([...LICENSED_TRADES].sort(), ["catering", "electrical", "food_truck", "hvac", "medical_courier", "painting", "plumbing", "remodel", "transportation"]);
  const future = new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10);
  const ok = { status: "vetting", trades: ["cleaning"], legal_name: "Dana Reyes", tin_last4: "1234", w9_received_at: "2026-10-01", agreement_version: AGREEMENT_VERSION,
    agreement_signed_at: "2026-10-01", insured_until: future, license_number: null, license_expires: null, background_checked: true, payout_method: "ach",
    specialties: ["standard_clean"], coverage: { bond: future, workers_comp: "exempt" }, base_zip: "48201" };
  assert.equal(onboardingChecklist({ ...ok, base_zip: null }).complete, false, "needs work area & hours");
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
  assert.equal(instantPayFee(P, 400), 6);
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
const INFO_ONLY_NUMBERS = new Set(["event-package.guests"]);

test("calculators: raising any amount never lowers the price", () => {
  for (const svc of SERVICES) {
    for (const q of svc.questions) {
      if (q.type !== "number") continue;
      const base = answersFor(svc, q);
      let prev = -1, prevV = 0;
      for (const v of numberSteps(q)) {
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
