/*
 * FILE    : apps/web/lib/hunter.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-11_1625 UTC
 * PURPOSE : Hunter.io email finding for the lead engines (Hub → Pro leads and Business leads). When a business's own
 *           website shows no email, one Domain Search on its domain returns the public addresses Hunter knows; the best
 *           one for outreach is picked by pickHunterEmail (@handled/core): the owner for pros, the facilities /
 *           operations / office manager for business customers. One lookup = one Hunter credit, so lookups stop at
 *           HUNTER_DAILY_LIMIT a day (default 25), counted from the 'hunter_lookup' events in both lead logs.
 *           Optional: without HUNTER_API_KEY the engines work as before (website emails, then the call list).
 */
import "server-only";
import { pickHunterEmail, type HunterEmail, type HunterTarget } from "@handled/core";
import { adminClient } from "./supabase/server";

export const hunterReady = () => Boolean(process.env.HUNTER_API_KEY?.trim());
const dailyLimit = () => Math.max(0, Number(process.env.HUNTER_DAILY_LIMIT ?? 25) || 0);

/** Hunter lookups still allowed today (UTC), across both lead engines. */
export async function hunterLookupsLeft(): Promise<number> {
  if (!hunterReady()) return 0;
  const since = new Date(new Date().toISOString().slice(0, 10) + "T00:00:00Z").toISOString();
  const db = adminClient();
  const [pro, biz] = await Promise.all([
    db.from("pro_lead_events").select("id", { count: "exact", head: true }).eq("kind", "hunter_lookup").gte("created_at", since),
    db.from("biz_lead_events").select("id", { count: "exact", head: true }).eq("kind", "hunter_lookup").gte("created_at", since),
  ]);
  return Math.max(0, dailyLimit() - (pro.count ?? 0) - (biz.count ?? 0));
}

/** Site builders and social pages: a business's page there isn't its own domain, so there's nothing to search. */
const SHARED_HOSTS = ["facebook.com", "instagram.com", "linkedin.com", "yelp.com", "google.com", "business.site", "square.site", "wixsite.com", "godaddysites.com", "weebly.com", "squarespace.com"];

/** The domain to search for a website URL ("https://www.acme.com/contact" → "acme.com"); null for shared hosts. */
export function domainOf(website: string): string | null {
  try {
    const host = new URL(website).hostname.toLowerCase().replace(/^www\./, "");
    if (!host.includes(".") || SHARED_HOSTS.some((h) => host === h || host.endsWith(`.${h}`))) return null;
    return host;
  } catch { return null; }
}

/**
 * Hunter.io Domain Search for one domain → the best outreach address, or null (nothing confident, no key, a bad
 * domain or a Hunter error — the lead then goes to the call list as before). The caller logs a 'hunter_lookup' event.
 */
export async function hunterFind(domain: string, target: HunterTarget): Promise<{ email: string; name: string | null; position: string | null; confidence: number } | null> {
  if (!hunterReady()) return null;
  const url = `https://api.hunter.io/v2/domain-search?domain=${encodeURIComponent(domain)}&limit=10&api_key=${encodeURIComponent(process.env.HUNTER_API_KEY!.trim())}`;
  const r = await fetch(url, { signal: AbortSignal.timeout(8000), cache: "no-store" }).catch(() => null);
  if (!r?.ok) { if (r && r.status !== 404) console.error("[hunter] domain search failed", r.status, domain); return null; }
  const j = (await r.json().catch(() => null)) as { data?: { emails?: HunterEmail[] } } | null;
  return pickHunterEmail(j?.data?.emails ?? [], domain, target);
}
