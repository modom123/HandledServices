/*
 * FILE    : apps/web/lib/contracts/es.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-03_0050 UTC
 * PURPOSE : All Spanish translations of the contract library, by contract key. English controls
 *           if they differ (said at the top of every Spanish copy).
 * UPDATED : 2026-10-05_2034 UTC — Handled Talent client agreement (Spanish).
 */
import type { ContractTranslation } from "./types";
import { CUSTOMER_ES_A } from "./es-customer-a";
import { CUSTOMER_ES_B } from "./es-customer-b";
import { PRO_ES_A } from "./es-pro-a";
import { PRO_ES_B } from "./es-pro-b";
import { TALENT_CLIENT_AGREEMENT_ES } from "./talent";

export const CONTRACTS_ES: Record<string, ContractTranslation> = { ...CUSTOMER_ES_A, ...CUSTOMER_ES_B, ...PRO_ES_A, ...PRO_ES_B, "talent-client-agreement": TALENT_CLIENT_AGREEMENT_ES };
