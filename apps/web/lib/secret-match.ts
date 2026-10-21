/*
 * FILE    : apps/web/lib/secret-match.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-20_0100 UTC
 * PURPOSE : Constant-time check of a shared secret for inbound webhooks (fails closed when the secret isn't set or is
 *           shorter than 16 characters).
 */
import "server-only";
import { timingSafeEqual } from "node:crypto";

export function secretMatches(given: string | null | undefined, want: string | null | undefined): boolean {
  if (!want || want.length < 16 || !given) return false;
  const a = Buffer.from(given), b = Buffer.from(want);
  return a.length === b.length && timingSafeEqual(a, b);
}
