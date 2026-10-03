<!--
  FILE    : docs/PRICING_CALIBRATION_2026-10-03_0147.md
  PROJECT : Handled (myhumanai) — AI-run home & business services
  CREATED : 2026-10-03_0147 UTC
  PURPOSE : Detroit-metro market recalibration of the suggested prices in packages/core/src/services.ts
            (default scenarios before → after, market benchmarks, pro payout under the new sliding commission).
-->

# Pricing calibration: Detroit metro, launch 2026

**Scope.** I changed numbers only in `packages/core/src/services.ts`: the `price()` constants and `minimum`. Question ids, options, labels and price-line label strings are unchanged, so the Spanish line templates still match. `payoutShare` is untouched. `pricing.ts` is untouched.

**Payout formula used below.** This is the new commission on the service price, not counting the $4 booking fee:
`rate = 0.15 + 0.17 × clamp((price − 60) / 540, 0, 1)`, `payout ≈ price × (1 − rate)`.

**Benchmarks.** These are typical 2026 consumer ranges from Thumbtack, Angi/HomeAdvisor and Google local listings for Detroit, Dearborn, Southfield, Royal Oak, Warren and Livonia, adjusted for Michigan's below-national-average cost of living. They come from my own market knowledge. I did not run a live price survey. "Indie rate" means what a local independent pro typically charges their own customers for the same job.

**Recurring discounts** are set in pricing.ts: weekly −20%, biweekly −15%. These were checked too, because most lawn, dog-walking and scooping work books on a plan.

## Services changed

### House & Office Cleaning (`house-cleaning`)
The old model was almost all square footage ($0.12/sq ft), with bedrooms (+$10) and bathrooms (+$20) barely mattering. That made a standard 3 bd / 2 ba clean $246, above the market. The new model is a $45 visit base plus $0.06/sq ft up to 2,000 sq ft and $0.045/sq ft after that, +$25 per extra bathroom and ±$15 per bedroom. The deep-clean surcharge goes from +50% to +60%, and move-in/out from +80% to +90%. The minimum stays at $120.

| Scenario | Before | After | Market benchmark | Pro payout after | Indie rate |
|---|---|---|---|---|---|
| Standard, 3 bd / 2 ba, 1,800 sq ft (default) | $246 | **$193** | $150–$220 | ≈ $156 | $140–$180 |
| Deep clean, same home | $369 | **$309** | $250–$380 | ≈ $238 | $220–$300 |
| Move-in / move-out, same home | $443 | **$367** | $300–$450 | ≈ $276 | $250–$350 |
| 4 bd / 3 ba, 2,800 sq ft standard | $372 | **$281** | $230–$320 | ≈ $219 | $200–$260 |
| 2 bd / 1 ba, 1,000 sq ft standard | $120 (min) | **$120 (min)** | $110–$150 | ≈ $100 | $90–$120 |

Reason: the default was about $25 over the top of the market, deep and move-out were near the ceiling, and bedrooms and bathrooms now carry realistic weight.

### Lawn Care (`lawn-care`)
Mowing goes from small $45 / quarter $60 / half $85 / acre $125 to **$55 / $75 / $105 / $160**. The minimum goes from $45 to $55. Add-ons are now scaled from the ¼–½ acre price (`mow / 75` instead of `mow / 60`), so add-on prices for a ¼–½ acre lot stay where they were: leaves $160, aeration $120, fertilization $70.

| Scenario | Before | After | Market benchmark | Pro payout after | Indie rate |
|---|---|---|---|---|---|
| Mow, ¼–½ acre, one-time (default) | $60 | **$75** | $55–$80 | ≈ $64 (weekly plan: $60 → ≈ $51) | $45–$60 per cut |
| Mow, under ¼ acre | $45 | **$55** | $40–$60 | ≈ $47 (weekly ≈ $37) | $30–$45 |
| Mow, ½–1 acre | $85 | **$105** | $85–$130 | ≈ $88 | $70–$100 |
| Mow, over 1 acre | $125 | **$160** | $130–$200 | ≈ $131 | $110–$150 |

Reason: at $60, minus the 20% weekly discount ($48) and commission, a pro cleared about $41 for a cut they normally bill $45–$60. Nobody would take it. The new prices sit inside the consumer range, and the weekly-plan payout now meets indie rates.

### Snow Removal (`snow-removal`)
Per visit: one-car goes from $45 to $40, two-car from $65 to $50, long driveway from $95 to $75, and residential walks from $20 to $15. Business lots, steps, salt and the season formula (12 storms × 85%) are unchanged. The minimum goes from $45 to $40.

| Scenario | Before | After | Market benchmark | Pro payout after | Indie rate |
|---|---|---|---|---|---|
| 2-car driveway + walks, one clearing (default) | $85 | **$65** | $45–$75 per push | ≈ $55 | $40–$60 |
| Same, season plan (Nov–Mar, prepaid) | $867 | **$663** | $400–$700 per season | ≈ $451 | $350–$600 |
| 1-car driveway only | $45 | **$40** | $30–$50 | ≈ $34 | $30–$40 |

Reason: the default per-push price and especially the season plan were well above the metro Detroit market. An $867 season price would lose to any local plow contractor.

### Mobile Car Detailing (`mobile-car-detailing`)
The full-detail tier goes from sedan $179 / small SUV $209 / large $239 to **$189 / $219 / $249**. Exterior, interior and ceramic tiers are unchanged.

| Scenario | Before | After | Market benchmark | Pro payout after | Indie rate |
|---|---|---|---|---|---|
| Full detail, car/coupe (default) | $179 | **$189** | $160–$250 (mobile) | ≈ $153 | $150–$200 |

Reason: at $179 the payout (about $145) was under what a mobile detailer charges directly. $189 is still at the low end for customers.

### Dog Poop Removal (`pet-waste-removal`)
The per-visit base goes from $18 to $21 (×1.0 small, ×1.2 medium, ×1.6 large; +$5 per extra dog). Heavy cleanup ($75) and deodorizer are unchanged.

| Scenario | Before | After | Market benchmark | Pro payout after | Indie rate |
|---|---|---|---|---|---|
| 1 dog, medium yard (default) | $22 | **$25** | $15–$25 per weekly visit; $30–$60 one-time | ≈ $21 (weekly plan $20 → ≈ $17) | $15–$20 weekly |

Reason: after the weekly discount the old price paid about $15, which is the bottom of what scoopers charge. The default is set at $25 rather than $24 so the default quote's displayed range stays valid with spread [1, 1.05] (see notes).

### Grocery Pickup & Delivery (`grocery-delivery`)
The base delivery fee goes from $19 to $25. Shopping-size, extra-store, mileage, cold, carry-in and rush add-ons are unchanged.

| Scenario | Before | After | Market benchmark | Pro payout after | Indie rate |
|---|---|---|---|---|---|
| Medium order, 1 store, 5 mi, cold items (default) | $34 | **$40** | $30–$50 for a personal shopper with no grocery markup | ≈ $34 (≈1.8 h) | $15–$20/h gig; $25–$35/h independent |

Reason: the old price paid about $16/h for a job that takes about 1.8 h. That is under gig-shopper earnings, so it would be hard to staff.

### Medical Deliveries (`medical-delivery`)
Base prices: prescription $24 → $29, supplies $29 → $35, specimens $35 → $45, documents $24 → $29. The minimum goes from $24 to $29.

| Scenario | Before | After | Market benchmark | Pro payout after | Indie rate |
|---|---|---|---|---|---|
| Prescription pickup, 1 stop, 10 mi (default) | $24 | **$29** | $25–$45 local medical courier | ≈ $25 | $25–$40 |
| Lab specimen courier | $35 | **$45** | $40–$75 | ≈ $38 | $35–$60 |

Reason: HIPAA- and BBP-trained couriers were paid about $14/h. Specimen runs were underpriced for the handling they require.

## Default-scenario summary

| Service | Before | After | Payout after |
|---|---|---|---|
| house-cleaning | $246 | $193 | ≈ $156 |
| lawn-care | $60 | $75 | ≈ $64 |
| snow-removal | $85 | $65 | ≈ $55 |
| mobile-car-detailing | $179 | $189 | ≈ $153 |
| pet-waste-removal | $22 | $25 | ≈ $21 |
| grocery-delivery | $34 | $40 | ≈ $34 |
| medical-delivery | $24 | $29 | ≈ $25 |

All prices are service prices. The customer also pays the $4 booking fee.

## Reviewed and left unchanged

Each was within its Detroit-metro range and the payout covers indie rates. Default price and benchmark:

- **window-cleaning**: $300 for 20 windows in and out with screens, 1 story. Benchmark $200–$350. Payout ≈ $232.
- **carpet-cleaning**: $147 for 3 rooms. Benchmark $120–$180 for 3 rooms, with a $125–$150 truck-mount minimum.
- **organizing**: $289 (3 h + haul-away). Benchmark $60–$100/h.
- **gutter-cleaning**: $188 for 150 ft, 1 story. Benchmark $120–$200 for 1 story and $175–$275 for 2 stories.
- **power-washing**: $200 for an 800 sq ft driveway. Benchmark $150–$250; house wash about $300–$500.
- **leaf-removal**: $285 for ¼–½ acre, moderate, with beds. Benchmark $200–$450 for a fall cleanup.
- **dog-walking**: $27 per 30-minute walk ($135 for 5 a week). Benchmark $20–$27. **Not lowered on purpose:** with the 20% weekly discount, the effective price is $21.60 a walk and the payout about $18. Cutting the list price would underpay walkers, whose indie rate is $18–$25.
- **dog-sitting**: $28 drop-in, $55 day, $85 overnight. Benchmark $20–$30, $40–$60 and $60–$90.
- **tree-removal**: $900 for a medium removal. Benchmark $600–$1,500 (firm price comes from the site visit).
- **junk-removal**: $259 for ¼ truck. Benchmark $200–$300.
- **large-item-removal** ($99, couch) and **junk-container** ($425, 15 yd for a week): benchmarks $75–$150 and $350–$500.
- **handyman**: $95/h, $190 for 2 h. Benchmark $65–$100/h. On the high side of fair but not an outlier. The payout is about $77/h.
- **errands** ($53, 3 stops) and **personal-assistant** ($40/h): benchmarks $35–$60 per run and $30–$45/h.
- **airport-transfer**: $95 one-way sedan. Benchmark $85–$120 for a DTW black car. A test also pins round trip at $190.
- **private-driver, limousine, party-bus, charter-bus, game-day-rides, event-shuttle**: hourly and daily rates are in line with Detroit livery rates.
- **plumbing, water-heater, hvac-install, lighting-install, camera-install, garbage-disposal, interior-painting, exterior-painting, bathroom-remodel, kitchen-remodel, home-remodel**: within Detroit-metro ranges. The licensed trades and remodels get site visits or AI refinement anyway.
- **event-package, event-planning, catering, food-truck, dj-music, event-rentals, event-venue**: not part of this pass. They are within normal ranges.

## Notes and uncertainties

- **pricing.ts range rounding (left for its owner).** `estimate()` rounds the low end of the range to $5 with `Math.round`. For a service with spread low = 1.0, a point such as $24 gets a low of $25, which is above the point. That is why pet-waste's default is $25. Non-default pet-waste or snow answers can still produce a point that is not a multiple of 5 and hit this, as they could before this change. A floor-based rounding for `low` in pricing.ts would fix it.
- **Benchmarks are from my own knowledge.** They were not scraped live. Re-check lawn and snow against two or three local competitors before the season, because those prices move most with weather and fuel.
- **Snow season plan** stays at 12 storms × 85% ($663 for 2-car + walks), which is at the top of the seasonal range. Lowering it further would push pro payout below about $38 per push.
- **No tests needed changes.** All 48 core tests pass, and the typecheck is clean.
