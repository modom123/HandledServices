/*
 * FILE    : apps/web/lib/favorites.ts
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-04_2204 UTC
 * PURPOSE : Customer favorites and "Book again with …" (rules in packages/core/src/board.ts).
 *             addFavorite / removeFavorite / myFavorites — a customer favorites a pro they had (or a crew
 *                                member of that pro company) from their job page; lists and removes them
 *             bookingPreference — a booking that asks for a pro (and maybe a crew member) is only honored
 *                                when the customer favorited or had that pro; anything else is dropped
 *             favoriteProsFor   — who gets the favorite first look when the job is dispatched
 *             crewRequest       — "The customer asked for Carlos" on the pro's job sheet and offer
 *           A favorite is a first look, never a guarantee: the pro can pass at no cost, and a crew request is
 *           a request to the company owner, who decides who goes.
 */
import "server-only";
import type { Job } from "@handled/core";
import { adminClient } from "./supabase/server";

const db = () => adminClient();

/** Did this customer have this pro on a job (by account or booking email)? */
async function hadPro(customerId: string | null, email: string | null, contractorId: string): Promise<boolean> {
  const [a, b] = await Promise.all([
    customerId ? db().from("jobs").select("id", { count: "exact", head: true }).eq("contractor_id", contractorId).eq("customer_id", customerId) : Promise.resolve({ count: 0 }),
    email ? db().from("jobs").select("id", { count: "exact", head: true }).eq("contractor_id", contractorId).ilike("contact_email", email.replace(/[\\%_]/g, "\\$&")) : Promise.resolve({ count: 0 }),
  ]);
  return Boolean(a.count || b.count);
}

/** Favorite the pro on one of the customer's jobs (and its crew member when `crew` is set). */
export async function addFavorite(customerId: string, jobId: string, crew = false): Promise<{ ok: boolean; error?: string; id?: string }> {
  const { data: job } = await db().from("jobs").select("id, customer_id, contractor_id, crew_member_id, service_slug").eq("id", jobId).maybeSingle();
  if (!job || job.customer_id !== customerId) return { ok: false, error: "Job not found" };
  if (!job.contractor_id) return { ok: false, error: "No pro on this job yet" };
  if (crew && !job.crew_member_id) return { ok: false, error: "No crew member on this job" };
  const crewId = crew ? (job.crew_member_id as string) : null;
  const find = db().from("customer_favorites").select("id").eq("customer_id", customerId).eq("contractor_id", job.contractor_id);
  const { data: same } = await (crewId ? find.eq("crew_member_id", crewId) : find.is("crew_member_id", null)).maybeSingle();
  if (same) return { ok: true, id: same.id };
  const { data, error } = await db().from("customer_favorites")
    .insert({ customer_id: customerId, contractor_id: job.contractor_id, crew_member_id: crewId, service_slug: job.service_slug })
    .select("id").single();
  return error ? { ok: false, error: error.message } : { ok: true, id: data.id };
}

export async function removeFavorite(customerId: string, id: string) {
  const { error } = await db().from("customer_favorites").delete().eq("id", id).eq("customer_id", customerId);
  return { ok: !error, error: error?.message };
}

export interface Favorite {
  id: string;
  contractor_id: string;
  crew_member_id: string | null;
  service_slug: string | null;
  pro_name: string;
  contact_first_name: string;
  crew_first_name: string | null;
  rating: number | null;
  jobs_completed: number;
  created_at: string;
}

/** The customer's favorites, with the safe pro details customers may see (name, first name, rating). */
export async function myFavorites(customerId: string): Promise<Favorite[]> {
  const { data } = await db().from("customer_favorites")
    .select("id, contractor_id, crew_member_id, service_slug, created_at, contractors(business_name, contact_name, rating, jobs_completed, status), crew_members(full_name, active)")
    .eq("customer_id", customerId).order("created_at", { ascending: false });
  type Row = { id: string; contractor_id: string; crew_member_id: string | null; service_slug: string | null; created_at: string;
    contractors: { business_name: string; contact_name: string | null; rating: number | null; jobs_completed: number | null; status: string } | null;
    crew_members: { full_name: string; active: boolean } | null };
  return ((data ?? []) as unknown as Row[])
    .filter((r) => r.contractors && r.contractors.status === "approved" && (!r.crew_member_id || r.crew_members?.active))
    .map((r) => ({
      id: r.id, contractor_id: r.contractor_id, crew_member_id: r.crew_member_id, service_slug: r.service_slug, created_at: r.created_at,
      pro_name: r.contractors!.business_name, contact_first_name: (r.contractors!.contact_name ?? "").split(" ")[0],
      crew_first_name: r.crew_members ? r.crew_members.full_name.split(" ")[0] : null,
      rating: r.contractors!.rating, jobs_completed: Number(r.contractors!.jobs_completed ?? 0),
    }));
}

/** Which of these favorites/past pros apply to a booking. Unknown or not-yet-worked-with pros are dropped (never an error). */
export async function bookingPreference(customerId: string | null, email: string, proId?: string | null, crewId?: string | null) {
  const none = { preferred_contractor_id: null as string | null, requested_crew_member_id: null as string | null };
  if (!proId) return none;
  const fav = customerId ? (await db().from("customer_favorites").select("id").eq("customer_id", customerId).eq("contractor_id", proId).limit(1)).data ?? [] : [];
  if (!fav.length && !(await hadPro(customerId, email, proId))) return none;
  let crew: string | null = null;
  if (crewId) {
    const { data: m } = await db().from("crew_members").select("id").eq("id", crewId).eq("contractor_id", proId).eq("active", true).maybeSingle();
    crew = m?.id ?? null;
  }
  return { preferred_contractor_id: proId, requested_crew_member_id: crew };
}

/** Pros who get the favorite first look on this job: the one the customer asked for, else their favorites. */
export async function favoriteProsFor(job: Pick<Job, "customer_id" | "preferred_contractor_id">): Promise<string[]> {
  if (job.preferred_contractor_id) return [job.preferred_contractor_id];
  if (!job.customer_id) return [];
  const { data } = await db().from("customer_favorites").select("contractor_id").eq("customer_id", job.customer_id).order("created_at", { ascending: false });
  return [...new Set(((data ?? []) as { contractor_id: string }[]).map((r) => r.contractor_id))];
}

/** "The customer asked for Carlos" — only when the requested crew member belongs to the pro on the job. */
export async function crewRequest(job: Pick<Job, "requested_crew_member_id" | "contractor_id">, contractorId?: string | null): Promise<{ id: string; name: string } | null> {
  const owner = contractorId ?? job.contractor_id;
  if (!job.requested_crew_member_id || !owner) return null;
  const { data } = await db().from("crew_members").select("id, full_name").eq("id", job.requested_crew_member_id).eq("contractor_id", owner).maybeSingle();
  return data ? { id: data.id, name: data.full_name } : null;
}
