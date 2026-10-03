/*
 * FILE    : apps/web/lib/instantly.ts
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-03_0324 UTC
 * PURPOSE : Instantly.ai (API v2) — the cold-email sender for the pro lead engine. Instantly owns the
 *           sending: warmed-up inboxes, rotation, daily limits, sequence timing, reply detection and
 *           its unsubscribe handling. We hand it each lead with its three emails already written
 *           (custom variables subject_1…3 / body_1…3), and block an address the moment the person
 *           applies or unsubscribes through us. Events come back on /api/webhooks/instantly.
 *             INSTANTLY_API_KEY        — Instantly → Settings → Integrations → API keys (v2, scopes: leads, block list)
 *             INSTANTLY_CAMPAIGN_ID    — the campaign whose steps are just {{subject_N}} / {{body_N}}
 *             INSTANTLY_WEBHOOK_SECRET — any long random string, also put in the webhook URL (?secret=)
 */
import "server-only";
import { timingSafeEqual } from "node:crypto";

const BASE = "https://api.instantly.ai/api/v2";
export const instantlyReady = () => Boolean(process.env.INSTANTLY_API_KEY && process.env.INSTANTLY_CAMPAIGN_ID && process.env.BUSINESS_POSTAL_ADDRESS);

async function call(path: string, body: unknown) {
  const r = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.INSTANTLY_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`instantly ${path} ${r.status}: ${JSON.stringify(j).slice(0, 300)}`);
  return j as Record<string, unknown>;
}

export interface InstantlyLead {
  email: string;
  firstName?: string | null;
  companyName: string;
  phone?: string | null;
  website?: string | null;
  /** Our own lead id + the pre-written emails and anything the campaign template uses. */
  variables: Record<string, string>;
}

/** Add a lead to the campaign. Skips anyone already in the workspace (no double-emailing). */
export async function addLeadToCampaign(l: InstantlyLead): Promise<string | null> {
  const j = await call("/leads", {
    campaign: process.env.INSTANTLY_CAMPAIGN_ID,
    email: l.email,
    first_name: l.firstName ?? undefined,
    company_name: l.companyName,
    phone: l.phone ?? undefined,
    website: l.website ?? undefined,
    custom_variables: l.variables,
    skip_if_in_workspace: true,
  });
  return typeof j.id === "string" ? j.id : null;
}

/** Never email this address again from Instantly (applied, unsubscribed through us, or asked not to be contacted). */
export async function blockInInstantly(email: string): Promise<void> {
  if (!process.env.INSTANTLY_API_KEY) return;
  await call("/block-lists-entries", { bl_value: email.trim().toLowerCase() }).catch((e) => console.error("[instantly block]", e instanceof Error ? e.message : e));
}

export function validWebhookSecret(given: string | null): boolean {
  const want = process.env.INSTANTLY_WEBHOOK_SECRET;
  if (!want || !given) return false;
  const a = Buffer.from(given), b = Buffer.from(want);
  return a.length === b.length && timingSafeEqual(a, b);
}
