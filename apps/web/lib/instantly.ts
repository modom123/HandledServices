/*
 * FILE    : apps/web/lib/instantly.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-03_0324 UTC
 * PURPOSE : Instantly.ai (API v2) — the cold-email sender for the pro lead engine. Instantly owns the
 *           sending: warmed-up inboxes, rotation, daily limits, sequence timing, reply detection and
 *           its unsubscribe handling. We hand it each lead with its three emails already written
 *           (custom variables subject_1…3 / body_1…3), and block an address the moment the person
 *           applies or unsubscribes through us. Events come back on /api/webhooks/instantly.
 *             INSTANTLY_API_KEY        — Instantly → Settings → Integrations → API keys (v2, scopes: leads, block list)
 *             INSTANTLY_CAMPAIGN_ID    — the campaign whose steps are just {{subject_N}} / {{body_N}}
 *             INSTANTLY_WEBHOOK_SECRET — any long random string, also put in the webhook URL (?secret=)
 *             INSTANTLY_BIZ_CAMPAIGN_ID — a second campaign for the business sales engine (same template style)
 * UPDATED : 2026-10-04_1934 UTC — a campaign per lead (pro recruiting vs business sales).
 * UPDATED : 2026-10-19_2230 UTC — listCampaignLeads (pull every lead in the business campaign, including ones uploaded
 *           straight into Instantly, into Hub → Business leads) and isBizCampaign (route webhook events by campaign).
 */
import "server-only";
import { timingSafeEqual } from "node:crypto";

const BASE = "https://api.instantly.ai/api/v2";
export const instantlyBizReady = () => Boolean(process.env.INSTANTLY_API_KEY && process.env.INSTANTLY_BIZ_CAMPAIGN_ID && process.env.BUSINESS_POSTAL_ADDRESS);
/** Pulling leads from the business campaign only needs the key and the campaign id. */
export const instantlyBizSyncReady = () => Boolean(process.env.INSTANTLY_API_KEY && process.env.INSTANTLY_BIZ_CAMPAIGN_ID);
/** The webhook event belongs to the business campaign (e.g. 1ST OUTREACH DETROIT). */
export const isBizCampaign = (id: unknown) => Boolean(typeof id === "string" && id && id === process.env.INSTANTLY_BIZ_CAMPAIGN_ID?.trim());
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
  /** Campaign to add to (default: the pro campaign, INSTANTLY_CAMPAIGN_ID). */
  campaign?: string;
}

/** Add a lead to the campaign. Skips anyone already in the workspace (no double-emailing). */
export async function addLeadToCampaign(l: InstantlyLead): Promise<string | null> {
  const j = await call("/leads", {
    campaign: l.campaign ?? process.env.INSTANTLY_CAMPAIGN_ID,
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

export interface InstantlyCampaignLead {
  id: string; email: string; first_name: string | null; last_name: string | null; company_name: string | null;
  phone: string | null; website: string | null; replies: number; clicks: number; opens: number;
  /** Instantly's interest flag: 1 interested, 0 neutral / not set, -1 not interested (and other negatives). */
  interest: number | null;
  variables: Record<string, unknown>;
}

/** One page (up to 100) of the leads in a campaign, and the cursor for the next page (null at the end). */
export async function listCampaignLeads(campaign: string, startingAfter: string | null): Promise<{ leads: InstantlyCampaignLead[]; next: string | null }> {
  const j = await call("/leads/list", { campaign, limit: 100, ...(startingAfter ? { starting_after: startingAfter } : {}) });
  const items = Array.isArray(j.items) ? (j.items as Record<string, unknown>[]) : [];
  const s = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
  const n = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);
  const leads = items.filter((x) => s(x.email)?.includes("@")).map((x) => ({
    id: String(x.id ?? ""), email: s(x.email)!.toLowerCase(), first_name: s(x.first_name), last_name: s(x.last_name), company_name: s(x.company_name),
    phone: s(x.phone), website: s(x.website), replies: n(x.email_reply_count), clicks: n(x.email_click_count), opens: n(x.email_open_count),
    interest: x.lt_interest_status == null ? null : n(x.lt_interest_status),
    variables: (x.payload && typeof x.payload === "object" ? x.payload : {}) as Record<string, unknown>,
  }));
  return { leads, next: s(j.next_starting_after) };
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
