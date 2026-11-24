/*
 * FILE    : packages/core/src/pro-showcase.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-11-10_2000 UTC
 * PURPOSE : "New pros in the Handled Network": the public chain of newly approved pros on the website (home page and
 *           area pages, refreshed every 6 hours). Pure rules, tested:
 *             showcaseCard()  — what a card shows: a public name (the business name, or first name + last initial for
 *                               a solo pro), the area (city and state, never an address), up to 5 services they're
 *                               cleared to take (their specialties first), when they joined, and a rating once they have one
 *             showcaseChain() — who is shown: approved pros who opted in (contractors.showcase_opt_in) and are cleared for
 *                               at least one service, newest first, optionally one state
 *           Opt-in only: the pro agreement doesn't license a pro's name or likeness for marketing.
 * UPDATED : 2026-11-24_1900 UTC — every activated pro joins the chain (owner): opted-in pros are named with their photo; the
 *           rest are nameless cards ("House Cleaning pro", city, services). networkGrowth() for the "N pros, +X this
 *           month" line. The chain refreshes the moment a pro is activated or suspended.
 */
import { proServiceSummary } from "./pro-welcome.ts";
import type { Contractor } from "./types.ts";

export const SHOWCASE = { maxServices: 5, limit: 24, refreshHours: 6, minJobsForRating: 3 } as const;

export interface ShowcaseCard { id: string; /** false: shown without name or photo (the pro hasn't opted in) */ named: boolean; name: string; area: string; state: string | null; services: { slug: string; name: string }[]; more: number; joined: string | null; rating: number | null; jobs: number }

type ShowPro = Contractor & { onboarded_at?: string | null; showcase_opt_in?: boolean | null; specialties?: string[] | null; base_city?: string | null; base_state?: string | null };

/** "Sparkle Clean Co." stays; a sole proprietor listed under their own name shows as "Dana R." */
export function publicName(c: { business_name?: string | null; contact_name?: string | null }): string {
  const biz = String(c.business_name ?? "").trim();
  const person = String(c.contact_name ?? "").trim();
  const short = (n: string) => { const p = n.split(/\s+/).filter(Boolean); return p.length > 1 ? `${p[0]} ${p[p.length - 1][0].toUpperCase()}.` : p[0] ?? ""; };
  if (!biz || biz.toLowerCase() === person.toLowerCase()) return short(person || biz) || "Handled pro";
  return biz;
}

export function showcaseCard(c: ShowPro, today = new Date()): ShowcaseCard {
  const { cleared } = proServiceSummary(c, today);
  const spec = (c.specialties ?? []).map((s) => s.toLowerCase());
  const ranked = [...cleared].sort((a, b) => Number(spec.some((s) => b.name.toLowerCase().includes(s) || b.slug.includes(s))) - Number(spec.some((s) => a.name.toLowerCase().includes(s) || a.slug.includes(s))));
  const services = ranked.slice(0, SHOWCASE.maxServices);
  const jobs = Number(c.jobs_completed ?? 0);
  const named = c.showcase_opt_in === true;
  return {
    // not opted in: in the chain as "a new House Cleaning pro" — never their name or photo (the pro agreement doesn't
    // license a pro's name or likeness for marketing)
    id: c.id, named, name: named ? publicName(c) : `${services[0]?.name ?? "Handled"} pro`, state: c.base_state ? c.base_state.toUpperCase() : null,
    area: [c.base_city, c.base_state?.toUpperCase()].filter(Boolean).join(", ") || "Handled Network",
    services, more: Math.max(0, cleared.length - services.length),
    joined: c.onboarded_at ? new Date(c.onboarded_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : null,
    rating: jobs >= SHOWCASE.minJobsForRating && c.rating ? Math.round(Number(c.rating) * 10) / 10 : null, jobs,
  };
}

/**
 * Who the chain shows (owner, 2026-11-24: "as a pro gets activated they are added, so you keep showing the network
 * growing"): every approved pro cleared for something, newest first, optionally one state. Opted-in pros are named;
 * everyone else is a nameless card ("House Cleaning pro · Livonia, MI").
 */
export function showcaseChain(pros: ShowPro[], o: { state?: string | null; limit?: number; today?: Date } = {}): ShowcaseCard[] {
  const st = o.state?.toUpperCase() || null;
  return pros
    .filter((c) => c.status === "approved" && (!st || (c.base_state ?? "").toUpperCase() === st))
    .sort((a, b) => String(b.onboarded_at ?? "").localeCompare(String(a.onboarded_at ?? "")))
    .map((c) => showcaseCard(c, o.today))
    .filter((card) => card.services.length > 0)
    .slice(0, o.limit ?? SHOWCASE.limit);
}

/** The growth line over the chain: how many vetted pros, how many joined in the last 30 days, in how many states. */
export function networkGrowth(pros: { status?: string | null; onboarded_at?: string | null; base_state?: string | null }[], today = new Date()) {
  const live = pros.filter((c) => c.status === "approved");
  const since = today.getTime() - 30 * 86400000;
  return {
    total: live.length,
    last30: live.filter((c) => c.onboarded_at && new Date(c.onboarded_at).getTime() >= since).length,
    states: new Set(live.map((c) => (c.base_state ?? "").toUpperCase()).filter(Boolean)).size,
  };
}
