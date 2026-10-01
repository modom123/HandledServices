/*
 * FILE    : apps/web/lib/catalog.ts
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-01_2230 UTC
 * PURPOSE : Keep the database's services table in sync with the code catalog. Jobs reference
 *           services(slug), so a service added in code must exist in the DB before anyone
 *           books it. Runs once per server instance (and from Hub → Setup). Only catalog
 *           columns are written — ops settings like `active` and `price_multiplier` are kept.
 */
import "server-only";
import { SERVICES } from "@handled/core";
import { adminClient } from "./supabase/server";

let synced: Promise<{ ok: boolean; count: number; error?: string }> | null = null;

export function syncCatalog(force = false) {
  if (!synced || force) {
    synced = (async () => {
      const rows = SERVICES.map((s, i) => ({ slug: s.slug, name: s.name, category: s.category, minimum: s.minimum, payout_share: s.payoutShare, site_visit: s.siteVisit, sort: i }));
      const { error } = await adminClient().from("services").upsert(rows, { onConflict: "slug" });
      if (error) synced = null; // retry next time
      return { ok: !error, count: rows.length, error: error?.message };
    })();
  }
  return synced;
}
