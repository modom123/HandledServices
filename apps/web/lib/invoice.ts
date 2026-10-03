/*
 * FILE    : apps/web/lib/invoice.ts
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-01_2030 UTC
 * PURPOSE : Signed, login-free links to a job's Invoice & Service Agreement.
 * UPDATED : 2026-10-03_0027 UTC — signed one-click unsubscribe tokens for reminder emails.
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

/**
 * A signed price quote: the exact price the customer saw after the AI price check, for these
 * exact details. Booking with a valid token charges that price — no second AI call, no surprise.
 */
export type QuotePayload = { slug: string; answers: unknown; frequency: string; photos: string[]; notes: string | null; rush: boolean; ai: unknown; exp: number };

export function quoteToken(q: QuotePayload) {
  const body = Buffer.from(JSON.stringify(q)).toString("base64url");
  return `${body}.${createHmac("sha256", secret()).update(`quote:${body}`).digest("base64url").slice(0, 32)}`;
}

export function readQuoteToken(token: string | null | undefined) {
  if (!token) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const want = createHmac("sha256", secret()).update(`quote:${body}`).digest("base64url").slice(0, 32);
  if (want.length !== sig.length || !timingSafeEqual(Buffer.from(want), Buffer.from(sig))) return null;
  const q = JSON.parse(Buffer.from(body, "base64url").toString()) as QuotePayload;
  return q.exp > Date.now() ? q : null;
}

/** One-click unsubscribe from reminders (seasonal, quote follow-ups) — no login needed. */
export const unsubscribeToken = (email: string) => createHmac("sha256", secret()).update(`unsub:${email.trim().toLowerCase()}`).digest("base64url").slice(0, 24);

export function validUnsubscribeToken(email: string, token: string | null | undefined) {
  if (!token) return false;
  const a = Buffer.from(token), b = Buffer.from(unsubscribeToken(email));
  return a.length === b.length && timingSafeEqual(a, b);
}
