/*
 * FILE    : apps/web/lib/contracts/records.ts
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-03_0040 UTC
 * PURPOSE : Reading signed contracts back: a customer's (by account or booking email), a pro's
 *           (by contractor record), or one signed copy — for My contracts and the Hub.
 */
import "server-only";
import { adminClient } from "../supabase/server";
import type { ContractSection } from "./types";

export interface AcceptanceRow {
  id: string; contract_key: string; version: string; title: string; audience: string;
  profile_id: string | null; contractor_id: string | null; email: string | null; signer_name: string | null;
  job_id: string | null; method: string; ip: string | null; user_agent: string | null;
  sections: { appliesTo?: string; summary?: string[]; sections: ContractSection[] };
  content_hash: string; accepted_at: string;
  jobs?: { ref: string; service_slug: string } | null;
}

const LIST = "id, contract_key, version, title, audience, profile_id, contractor_id, email, signer_name, job_id, method, accepted_at, content_hash, jobs(ref, service_slug)";

/** A customer's contracts: signed into their account, or accepted with a booking under their email. */
export async function customerAcceptances(profileId: string, email: string): Promise<AcceptanceRow[]> {
  const { data } = await adminClient().from("contract_acceptances").select(LIST)
    .or(`profile_id.eq.${profileId},email.eq.${email.trim().toLowerCase()}`).neq("audience", "pro").order("accepted_at", { ascending: false }).limit(500);
  return (data ?? []) as unknown as AcceptanceRow[];
}

export async function proAcceptances(contractorId: string): Promise<AcceptanceRow[]> {
  const { data } = await adminClient().from("contract_acceptances").select(LIST).eq("contractor_id", contractorId).order("accepted_at", { ascending: false }).limit(500);
  return (data ?? []) as unknown as AcceptanceRow[];
}

export async function acceptance(id: string): Promise<AcceptanceRow | null> {
  if (!/^[0-9a-f-]{36}$/.test(id)) return null;
  const { data } = await adminClient().from("contract_acceptances").select("*, jobs(ref, service_slug)").eq("id", id).maybeSingle();
  return (data as AcceptanceRow | null) ?? null;
}
