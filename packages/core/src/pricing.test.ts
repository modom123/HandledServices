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
    background_checked: true, daily_capacity: 3, notes: null,
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
