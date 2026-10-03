/*
 * FILE    : apps/web/lib/contracts/es.ts
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-03_0050 UTC
 * PURPOSE : All Spanish translations of the contract library, by contract key. English controls
 *           if they differ (said at the top of every Spanish copy).
 */
import type { ContractTranslation } from "./types";
import { CUSTOMER_ES_A } from "./es-customer-a";
import { CUSTOMER_ES_B } from "./es-customer-b";
import { PRO_ES_A } from "./es-pro-a";
import { PRO_ES_B } from "./es-pro-b";

export const CONTRACTS_ES: Record<string, ContractTranslation> = { ...CUSTOMER_ES_A, ...CUSTOMER_ES_B, ...PRO_ES_A, ...PRO_ES_B };
