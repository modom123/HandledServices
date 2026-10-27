/*
 * FILE    : apps/web/lib/recruiting-division.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-27_1700 UTC
 * PURPOSE : Data for the Recruiting division (Hub → Recruiting): every opening on all three tracks with its Indeed posting
 *           and candidate counts, and the funnel across tracks.
 *             · pro openings   — supply gaps (last 30 days: bookings, jobs no pro took, waitlist) rolled up by trade, plus
 *                                the trades we always recruit (core proOpenings)
 *             · staff openings — Talent searches for the internal client (Handled's own team)
 *             · client roles   — every other open Talent search
 *           Indeed status: talent_searches.indeed_url for searches, recruiting_postings for pro trades.
 *           Also the internal client (created on first use if the SQL hasn't seeded it), and applyToRole(): an applicant for a
 *           team or client role (from /careers or Indeed Apply) joins that search's pipeline.
 */
import "server-only";
import { BRAND, DIVISION_STAGES, getService, gapsByService, proOpenings, proStageToDivision, searchOpening, serviceGaps, talentStageToDivision, type Contractor, type DivisionStage, type Opening } from "@handled/core";
import { adminClient } from "./supabase/server";
import { pipeline } from "./recruiting";
import { addCandidate as addTalentCandidate } from "./talent";
import { opsEmail, sendEmail, siteUrl } from "./notify";

export type OpeningRow = Opening & { indeedUrl: string | null; postedAt: string | null; paused: boolean; candidates: number; isPublic: boolean; status: string };

const db = () => adminClient();

/** The internal client (Handled itself) — created if missing. Null when the database isn't set up for it yet. */
export async function internalClientId(): Promise<string | null> {
  try { return await findOrMakeInternalClient(); } catch { return null; } // no database (e.g. local preview)
}
async function findOrMakeInternalClient(): Promise<string | null> {
  const { data, error } = await db().from("talent_clients").select("id").eq("internal", true).limit(1).maybeSingle();
  if (error) return null; // column not there yet: run ADD_RECRUITING_DIVISION
  if (data) return data.id as string;
  const { data: made } = await db().from("talent_clients").insert({ company: "Handled Services LLC (our team)", contact_name: "Handled hiring", email: "info@handledsvc.com", status: "active", internal: true, created_by: "system", notes: "Internal: our own staff roles. No fees." }).select("id").single();
  return (made?.id as string) ?? null;
}

/** Trades we're short of, from supply gaps over the last 30 days. */
async function shortages() {
  const since = new Date(Date.now() - 30 * 86400000).toISOString();
  const [{ data: jobs }, { data: alerts }, { data: wait }, { data: pros }] = await Promise.all([
    db().from("jobs").select("id, service_slug, zip").gte("created_at", since).neq("status", "cancelled").limit(20000),
    db().from("ops_alerts").select("job_id").eq("kind", "no_pros").gte("created_at", since).not("job_id", "is", null).limit(5000),
    db().from("waitlist").select("service_slug, zip").is("notified_at", null).limit(20000),
    db().from("contractors").select("*").eq("status", "approved"),
  ]);
  const noPro = new Set((alerts ?? []).map((a: { job_id: string }) => a.job_id));
  const rows = serviceGaps({
    jobs: (jobs ?? []).map((j: { id: string; service_slug: string; zip: string }) => ({ service_slug: j.service_slug, zip: j.zip, no_pro: noPro.has(j.id) })),
    waitlist: (wait ?? []) as { service_slug: string; zip: string }[], contractors: (pros ?? []) as Contractor[], days: 30,
  });
  return gapsByService(rows).filter((g) => g.needed > 0).flatMap((g) => (getService(g.slug)?.trades.slice(0, 1) ?? []).map((trade) => ({ trade, needed: g.needed, zips: g.zipsWithoutPros })));
}

/** Every opening, all tracks, with Indeed posting and candidate counts. */
export async function openings(): Promise<OpeningRow[]> {
  const [short, internalId, { data: searches }, { data: posts }, { data: apps }, { data: subs }] = await Promise.all([
    shortages().catch(() => []),
    internalClientId(),
    db().from("talent_searches").select("*, talent_clients(company, internal)").in("status", ["intake", "open", "on_hold"]).order("created_at", { ascending: false }).limit(300),
    db().from("recruiting_postings").select("*"),
    db().from("contractor_applications").select("trades, stage, created_at").not("stage", "in", "(rejected,withdrawn)").limit(5000),
    db().from("talent_submissions").select("search_id, stage").limit(10000),
  ]);
  const post = new Map(((posts ?? []) as { opening_key: string; indeed_url: string | null; posted_at: string | null; paused: boolean }[]).map((p) => [p.opening_key, p]));
  const pro: OpeningRow[] = proOpenings(short).map((o) => {
    const p = post.get(o.key);
    const candidates = ((apps ?? []) as { trades: string[] }[]).filter((a) => (a.trades ?? []).includes(o.trade!)).length;
    return { ...o, indeedUrl: p?.indeed_url ?? null, postedAt: p?.posted_at ?? null, paused: Boolean(p?.paused), candidates, isPublic: true, status: p?.paused ? "paused" : "open" };
  });
  const srch: OpeningRow[] = ((searches ?? []) as Record<string, unknown>[]).map((s) => {
    const c = s.talent_clients as { company: string; internal?: boolean } | null;
    const internal = Boolean(c?.internal) || (internalId !== null && s.client_id === internalId);
    const o = searchOpening({ ...(s as unknown as Parameters<typeof searchOpening>[0]), company: c?.company ?? null }, internal);
    const candidates = ((subs ?? []) as { search_id: string; stage: string }[]).filter((x) => x.search_id === s.id && !["rejected", "withdrawn"].includes(x.stage)).length;
    return { ...o, indeedUrl: (s.indeed_url as string | null) ?? null, postedAt: (s.indeed_posted_at as string | null) ?? null, paused: s.status === "on_hold", candidates, isPublic: Boolean(s.public), status: String(s.status) };
  });
  return [...pro, ...srch.filter((o) => o.track === "staff"), ...srch.filter((o) => o.track === "client")];
}

/** The funnel across tracks: candidates by division stage, plus where the last 30 days of applicants came from. */
export async function funnel() {
  const [rows, { data: subs }] = await Promise.all([
    pipeline(),
    db().from("talent_submissions").select("stage, created_at, search_id, talent_clients(internal), talent_candidates(source)").limit(10000),
  ]);
  const zero = () => Object.fromEntries(DIVISION_STAGES.map((s) => [s, 0])) as Record<DivisionStage, number>;
  const by = { pro: zero(), staff: zero(), client: zero() };
  for (const r of rows) { const d = proStageToDivision(r.stage); if (d) by.pro[d]++; }
  for (const s of (subs ?? []) as { stage: string; talent_clients: { internal?: boolean } | null }[]) {
    const d = talentStageToDivision(s.stage); if (!d) continue;
    by[s.talent_clients?.internal ? "staff" : "client"][d]++;
  }
  const since = Date.now() - 30 * 86400000;
  const sources = new Map<string, number>();
  const bump = (src: unknown) => { const k = String(src ?? "not given").toLowerCase().includes("indeed") ? "Indeed" : String(src ?? "not given"); sources.set(k, (sources.get(k) ?? 0) + 1); };
  for (const r of rows) if (new Date(String(r.app.created_at)).getTime() >= since) bump(r.app.source);
  for (const s of (subs ?? []) as { created_at: string; talent_candidates: { source?: string | null } | null }[]) if (new Date(s.created_at).getTime() >= since) bump(s.talent_candidates?.source);
  const decide = rows.filter((r) => ["applied", "screened", "interviewed"].includes(r.stage)).length;
  return { by, sources: [...sources.entries()].sort((a, b) => b[1] - a[1]), decide, proRows: rows };
}

/** Someone applies to a team or client role (from /careers or Indeed Apply): they join that search's pipeline as "sourced". */
export async function applyToRole(searchId: string, a: { full_name: string; email: string; phone?: string | null; location?: string | null; linkedin?: string | null; summary?: string | null; resume_path?: string | null; source: string }, opts: { requirePublic: boolean }) {
  const { data: s } = await db().from("talent_searches").select("id, title, status, public, talent_clients(internal, company)").eq("id", searchId).maybeSingle();
  if (!s || !["open", "on_hold"].includes(String(s.status)) || (opts.requirePublic && !s.public)) return { ok: false as const, error: "This role isn't open any more" };
  const r = await addTalentCandidate(searchId, { full_name: a.full_name, email: a.email, phone: a.phone ?? null, location: a.location ?? null, current_title: null, linkedin: a.linkedin ?? null, resume_path: a.resume_path ?? null, summary: a.summary ?? null, source: a.source, expected_salary: null }, null, a.source === "indeed" ? "indeed" : "applicant");
  if (!r.ok) return { ok: false as const, error: r.error?.startsWith("Already") || r.error?.startsWith("Another") ? "You've already applied for this role — we'll be in touch" : r.error ?? "Couldn't save your application" };
  const internal = Boolean((s.talent_clients as { internal?: boolean } | null)?.internal);
  const first = a.full_name.split(/\s+/)[0] ?? "";
  await sendEmail(a.email, `We got your application: ${s.title}`, `Hi ${first},\n\nThanks for applying for ${s.title}${internal ? ` at ${BRAND.name}` : ` through ${BRAND.name} Talent`}. A recruiter reviews every application, usually within two business days, and will reach out if it's a fit.${internal ? "" : " You never pay a fee to work with us."}\n\n— ${BRAND.name}${internal ? "" : " Talent"}`).catch(() => {});
  await sendEmail(opsEmail(), `New applicant: ${a.full_name} for ${s.title}`, `${a.full_name} <${a.email}> ${a.phone ?? ""}\nSource: ${a.source}\n${a.summary ?? ""}\n\nOpen the search: ${siteUrl()}/hub/talent/${searchId}`).catch(() => {});
  return { ok: true as const, id: r.id };
}

let pubCache: { at: number; rows: OpeningRow[] } | null = null;
/** Openings for the public careers page: open pro trades, and team / client roles marked public. Cached 5 minutes. */
export async function publicOpenings(): Promise<OpeningRow[]> {
  if (pubCache && Date.now() - pubCache.at < 5 * 60_000) return pubCache.rows;
  const rows = (await openings().catch(() => [] as OpeningRow[])).filter((o) => !o.paused && o.isPublic && (o.track === "pro" || o.status === "open"));
  pubCache = { at: Date.now(), rows };
  return rows;
}
