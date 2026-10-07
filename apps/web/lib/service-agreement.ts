/*
 * FILE    : apps/web/lib/service-agreement.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-01_2030 UTC
 * UPDATED : 2026-10-03_0042 UTC — the text now lives in the contract library (lib/contracts/customer.ts);
 *           this file keeps the old names working for the invoice.
 * PURPOSE : Customer Service Agreement (SERVICE_AGREEMENT_VERSION), printed on every invoice
 *           and accepted at booking.
 */
import { SERVICE_AGREEMENT as SA } from "./contracts";

export const SERVICE_AGREEMENT_TITLE = SA.title;
export const SERVICE_AGREEMENT = SA.sections;
