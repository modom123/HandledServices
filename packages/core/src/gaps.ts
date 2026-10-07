/*
 * FILE    : packages/core/src/gaps.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-02_2232 UTC
 * PURPOSE : Supply gaps — where customers want a service and we don't have enough pros.
 *           For each service × ZIP: bookings, bookings no pro could take, waitlist sign-ups,
 *           and the active pros who can actually do that work there (same eligibility as
 *           dispatch: trade, license, insurance, background check, driving radius).
 *           Shown in Hub → Supply gaps so recruiting goes where the demand is.
 */
import { eligible } from "./dispatch.ts";
import { getService } from "./services.ts";
import type { Contractor } from "./types.ts";

export interface GapDemand { service_slug: string; zip: string }
export interface GapInput {
  /** Bookings in the period (cancelled excluded by the caller). */
  jobs: (GapDemand & { no_pro?: boolean })[];
  /** Waitlist sign-ups still waiting. */
  waitlist: GapDemand[];
  /** Pros (any status — only approved ones count as supply). */
  contractors: Contractor[];
  /** ZIP centroids, for the driving-radius check. */
  geo?: Record<string, { lat: number; lng: number }>;
  /** Length of the period, to scale how much work one pro can absorb. */
  days?: number;
}

export type GapLevel = "none" | "thin" | "ok";
export interface GapRow {
  slug: string;
  zip: string;
  bookings: number;
  noPro: number;
  waitlist: number;
  pros: number;
  level: GapLevel;
  /** More pros to recruit for this service near this ZIP. */
  needed: number;
}

/** Bookings one active pro comfortably covers in 30 days for one service and area. */
export const JOBS_PER_PRO_MONTH = 20;

export function serviceGaps(input: GapInput): GapRow[] {
  const days = input.days ?? 30;
  const perPro = Math.max(1, (JOBS_PER_PRO_MONTH * days) / 30);
  const rows = new Map<string, GapRow>();
  const row = (d: GapDemand) => {
    const k = `${d.service_slug}|${d.zip}`;
    let r = rows.get(k);
    if (!r) rows.set(k, (r = { slug: d.service_slug, zip: d.zip, bookings: 0, noPro: 0, waitlist: 0, pros: 0, level: "ok", needed: 0 }));
    return r;
  };
  for (const j of input.jobs) { if (!/^\d{5}$/.test(j.zip ?? "") || !getService(j.service_slug)) continue; const r = row(j); r.bookings++; if (j.no_pro) r.noPro++; }
  for (const w of input.waitlist) { if (!/^\d{5}$/.test(w.zip ?? "") || !getService(w.service_slug)) continue; row(w).waitlist++; }

  const approved = input.contractors.filter((c) => c.status === "approved");
  for (const r of rows.values()) {
    const g = input.geo?.[r.zip];
    // scheduled_date null = "could they ever take it", not "are they free on a given day"
    r.pros = approved.filter((c) => eligible(c, { service_slug: r.slug, zip: r.zip, scheduled_date: null, lat: g?.lat, lng: g?.lng }) === null).length;
    const demand = r.bookings + r.waitlist;
    const want = Math.ceil(demand / perPro);
    r.needed = r.pros === 0 ? Math.max(1, want) : Math.max(r.noPro > 0 ? 1 : 0, want - r.pros);
    r.level = r.pros === 0 ? "none" : r.needed > 0 ? "thin" : "ok";
  }
  const rank: Record<GapLevel, number> = { none: 0, thin: 1, ok: 2 };
  return [...rows.values()].sort((a, b) => rank[a.level] - rank[b.level] || b.noPro + b.bookings + b.waitlist - (a.noPro + a.bookings + a.waitlist));
}

/** Roll the ZIP rows up to one line per service. */
export function gapsByService(rows: GapRow[]): { slug: string; bookings: number; noPro: number; waitlist: number; zipsWithoutPros: number; needed: number }[] {
  const m = new Map<string, { slug: string; bookings: number; noPro: number; waitlist: number; zipsWithoutPros: number; needed: number }>();
  for (const r of rows) {
    const s = m.get(r.slug) ?? { slug: r.slug, bookings: 0, noPro: 0, waitlist: 0, zipsWithoutPros: 0, needed: 0 };
    s.bookings += r.bookings; s.noPro += r.noPro; s.waitlist += r.waitlist; s.needed += r.needed;
    if (r.level === "none") s.zipsWithoutPros++;
    m.set(r.slug, s);
  }
  return [...m.values()].sort((a, b) => b.needed - a.needed || b.noPro - a.noPro);
}
