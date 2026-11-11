// ============================================================================
// FILE    : scripts/partner-success-facts_2026-11-10_1505.mts
// PROJECT : Handled (HandledServices) — AI-run home & business services
// CREATED : 2026-11-10_1505 UTC
// PURPOSE : Prints the Partner Success roadmaps, bundles, seasonal calendar and rate ladders (packages/core) as JSON,
//           with service slugs resolved to names. Read by scripts/build-partner-success-playbook-pdf_2026-11-10_1505.py.
// ============================================================================
import {
  BRAND, PARTNER_LADDER, PARTNER_PROGRAM, PARTNER_ROADMAPS, REFERRAL_LADDER, SALES_DRAW, SEASONAL_CALENDAR, SERVICE_PLAYS, ladderTable, serviceName,
} from "../packages/core/src/index.ts";

const pick = (rows: { level: number; rate: number; profit: number }[], lv: number[]) => rows.filter((r) => lv.includes(r.level)).map((r) => ({ rate: r.rate, credit: r.profit }));
console.log(JSON.stringify({
  phone: BRAND.supportPhone, email: BRAND.supportEmail,
  program: { months: PARTNER_PROGRAM.months, holdDays: PARTNER_PROGRAM.holdDays, minPayout: PARTNER_PROGRAM.minPayout, cookieDays: PARTNER_PROGRAM.cookieDays },
  draw: SALES_DRAW,
  referralLadder: pick(ladderTable(REFERRAL_LADDER), [0, 1, 2, 5, 10, 15]),
  salesLadder: pick(ladderTable(PARTNER_LADDER), [0, 1, 2, 5, 10, 20, 35]),
  fastTrack: { jobsPerStep: PARTNER_LADDER.jobsPerStep, capRate: PARTNER_LADDER.jobsCapRate, directCredit: PARTNER_LADDER.directCredit },
  roadmaps: PARTNER_ROADMAPS.map((r) => ({ ...r, stages: r.stages.map((s) => ({ ...s, sell: s.sell.map(serviceName) })) })),
  plays: SERVICE_PLAYS.map((p) => ({ ...p, services: p.services.map(serviceName) })),
  seasons: SEASONAL_CALENDAR.map((c) => ({ ...c, services: c.services.map(serviceName) })),
}));
