/*
 * FILE    : apps/web/lib/agreement.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-01_2000 UTC
 * UPDATED : 2026-10-01_2124 UTC — v2: Pro Program benefits.
 * UPDATED : 2026-10-03_0042 UTC — the text now lives in the contract library (lib/contracts/pro.ts);
 *           this file keeps the old names working. Bumping AGREEMENT_VERSION (packages/core/
 *           compliance.ts) requires every pro to re-sign before receiving new offers.
 * PURPOSE : Independent Contractor Agreement shown and signed in the pro portal.
 */
import { PRO_AGREEMENT } from "./contracts";

export const AGREEMENT_TITLE = PRO_AGREEMENT.title;
export const AGREEMENT_SECTIONS = PRO_AGREEMENT.sections;
