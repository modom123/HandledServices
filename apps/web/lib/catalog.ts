/*
 * FILE    : apps/web/lib/catalog.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-01_2230 UTC
 * PURPOSE : Keep the database's services table in sync with the code catalog. Jobs reference
 *           services(slug), so a service added in code must exist in the DB before anyone
 *           books it. Runs once per server instance (and from Hub → Setup). Only catalog
 *           columns are written — ops settings like `active` and `price_multiplier` are kept.
 * UPDATED : 2026-10-06_0740 UTC — payout_share is the pro's real share on the typical job (sliding rate, from
 *           typicalProShare), kept inside the table's 0.60–0.85 check. Reporting only; splitJob pays pros.
 * UPDATED : 2026-10-09_0300 UTC — Handled +5 points paid by customers (commission about 20% → 37%, take band 15–40%; pro pay unchanged).
 * UPDATED : 2026-11-05_1222 UTC — a payout-share rule error names the file that fixes it (FIX_PAYOUT_SHARE_BANDS_*.sql).
 */
import "server-only";
import { SERVICES, typicalProShare } from "@handled/core";
import { adminClient } from "./supabase/server";

let synced: Promise<{ ok: boolean; count: number; error?: string }> | null = null;

export function syncCatalog(force = false) {
  if (!synced || force) {
    synced = (async () => {
      const rows = SERVICES.map((s, i) => ({ slug: s.slug, name: s.name, category: s.category, minimum: s.minimum, payout_share: Math.min(0.85, Math.max(0.6, typicalProShare(s.slug))), site_visit: s.siteVisit, sort: i }));
      const { error } = await adminClient().from("services").upsert(rows, { onConflict: "slug" });
      if (error) synced = null; // retry next time
      // the database still has the old 65% floor (the Oct 9 pricing update's rules weren't run): say which file fixes it
      const msg = error && /services_payout_share_band/.test(error.message)
        ? "The database still has the old payout rules (65% floor). Run supabase/setup/FIX_PAYOUT_SHARE_BANDS_2026-11-05_1222.sql in the Supabase SQL Editor, then sync again"
        : error?.message;
      return { ok: !error, count: rows.length, error: msg };
    })();
  }
  return synced;
}
