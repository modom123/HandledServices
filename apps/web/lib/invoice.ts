/*
 * FILE    : apps/web/lib/invoice.ts
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-01_2030 UTC
 * PURPOSE : Signed, login-free links to a job's Invoice & Service Agreement.
 */
import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { siteUrl } from "./notify";

const secret = () => process.env.INVOICE_SIGNING_SECRET ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? "dev-only-secret";

export const invoiceToken = (jobId: string) => createHmac("sha256", secret()).update(`invoice:${jobId}`).digest("base64url").slice(0, 32);

export function validInvoiceToken(jobId: string, token: string | null | undefined) {
  if (!token) return false;
  const a = Buffer.from(token), b = Buffer.from(invoiceToken(jobId));
  return a.length === b.length && timingSafeEqual(a, b);
}

export const invoiceUrl = (jobId: string) => `${siteUrl()}/invoice/${jobId}?t=${invoiceToken(jobId)}`;
