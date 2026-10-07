/*
 * FILE    : apps/web/lib/cron-auth.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-06_0726 UTC
 * PURPOSE : Who may run the scheduled jobs (/api/cron/*): only Vercel Cron or the GitHub Action, which send
 *           "Authorization: Bearer <CRON_SECRET>". Fails closed: with CRON_SECRET missing or shorter than
 *           16 characters nothing runs (before, a missing secret let anyone in with "Bearer undefined").
 *           Constant-time comparison.
 */
import "server-only";
import { timingSafeEqual } from "node:crypto";

export function cronAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET ?? "";
  if (secret.length < 16) return false;
  const got = req.headers.get("authorization") ?? "";
  const want = `Bearer ${secret}`;
  const a = Buffer.from(got), b = Buffer.from(want);
  return a.length === b.length && timingSafeEqual(a, b);
}
