/*
 * FILE    : apps/web/lib/notes.ts
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-05_2141 UTC
 * UPDATED : 2026-10-05_2146 UTC — customers too: keyed by email (customerSubjectId), timeline adds their bookings and reviews.
 * PURPOSE : Account notes — the running conversation history for a business lead, business account, Talent client or customer.
 *             addNote  — append a note / call / email / meeting / text (never edits or deletes; the database refuses)
 *             timeline — everything that happened, newest first: notes written by people, plus the lead's automated
 *                        events (found, emailed, clicked, replied, status changes). A business account's timeline also
 *                        carries the history of the lead it came from, so the whole relationship reads in one place.
 */
import "server-only";
import { createHash } from "node:crypto";
import { adminClient } from "./supabase/server";

const db = () => adminClient();
export type NoteSubject = "biz_lead" | "business_account" | "talent_client" | "customer";

/** A customer's history key — md5 of the lowercased email as a uuid; matches public.customer_subject_id() in SQL. */
export function customerSubjectId(email: string) {
  const h = createHash("md5").update(email.trim().toLowerCase()).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
export type NoteKind = "note" | "call" | "email" | "meeting" | "text" | "status";
export const NOTE_KIND_LABEL: Record<string, string> = { note: "Note", call: "Call", email: "Email", meeting: "Meeting", text: "Text", status: "Status" };

export interface TimelineItem { at: string; kind: string; label: string; body: string | null; author: string | null; source: "note" | "event"; from?: string }

export async function addNote(subject: NoteSubject, subjectId: string, kind: NoteKind, body: string, author: string) {
  const text = body.trim();
  if (!text) return { ok: false, error: "Write the note first" };
  const { error } = await db().from("account_notes").insert({ subject_type: subject, subject_id: subjectId, kind, body: text.slice(0, 8000), author });
  return error ? { ok: false, error: error.message } : { ok: true };
}

const EVENT_LABEL: Record<string, string> = { found: "Found", enriched: "Email found", queued: "Queued", emailed: "Emailed", clicked: "Clicked the link", replied: "Replied", converted: "Became an account", bounced: "Email bounced", unsubscribed: "Unsubscribed" };
const eventLabel = (k: string) => (k.startsWith("status:") ? `Status → ${k.slice(7).replace("_", " ")}` : EVENT_LABEL[k] ?? k.replace(/_/g, " "));

async function leadItems(leadId: string, from?: string): Promise<TimelineItem[]> {
  const [{ data: notes }, { data: events }] = await Promise.all([
    db().from("account_notes").select("kind, body, author, created_at").eq("subject_type", "biz_lead").eq("subject_id", leadId),
    db().from("biz_lead_events").select("kind, note, actor, created_at").eq("lead_id", leadId),
  ]);
  return [
    ...(notes ?? []).map((n) => ({ at: n.created_at, kind: n.kind, label: NOTE_KIND_LABEL[n.kind] ?? n.kind, body: n.body, author: n.author, source: "note" as const, from })),
    ...(events ?? []).map((e) => ({ at: e.created_at, kind: e.kind, label: eventLabel(e.kind), body: e.note, author: e.actor, source: "event" as const, from })),
  ];
}

/** A customer's bookings, completions and reviews, by email. */
async function customerItems(email: string): Promise<TimelineItem[]> {
  const { data: jobs } = await db().from("jobs").select("id, ref, service_slug, status, price_final, estimate_low, notes, created_at, completed_at").ilike("contact_email", email.trim().replace(/[\\%_]/g, (c) => `\\${c}`)).order("created_at", { ascending: false }).limit(500);
  const list = jobs ?? [];
  const items: TimelineItem[] = [];
  for (const j of list) {
    const price = Number(j.price_final ?? j.estimate_low ?? 0);
    items.push({ at: j.created_at, kind: "booked", label: `Booked ${j.ref}`, body: `${j.service_slug.replace(/-/g, " ")}${price ? ` · $${price.toLocaleString("en-US")}` : ""} · now ${String(j.status).replace(/_/g, " ")}${j.notes ? `\n“${j.notes}”` : ""}`, author: null, source: "event" });
    if (j.completed_at) items.push({ at: j.completed_at, kind: "completed", label: `Completed ${j.ref}`, body: null, author: null, source: "event" });
  }
  if (list.length) {
    const ref = new Map(list.map((j) => [j.id, j.ref]));
    const { data: reviews } = await db().from("reviews").select("job_id, rating, comment, created_at").in("job_id", list.map((j) => j.id).slice(0, 200));
    for (const r of reviews ?? []) items.push({ at: r.created_at, kind: "review", label: `Review ${"★".repeat(r.rating)}${"☆".repeat(5 - r.rating)} · ${ref.get(r.job_id) ?? ""}`, body: r.comment, author: null, source: "event" });
  }
  return items;
}

/** Everything that happened with this lead / account / customer, newest first. For a customer pass their email. */
export async function timeline(subject: NoteSubject, subjectId: string, customerEmail?: string): Promise<TimelineItem[]> {
  let items: TimelineItem[] = [];
  if (subject === "biz_lead") items = await leadItems(subjectId);
  else {
    const { data: notes } = await db().from("account_notes").select("kind, body, author, created_at").eq("subject_type", subject).eq("subject_id", subjectId);
    items = (notes ?? []).map((n) => ({ at: n.created_at, kind: n.kind, label: NOTE_KIND_LABEL[n.kind] ?? n.kind, body: n.body, author: n.author, source: "note" as const }));
    if (subject === "business_account") {
      const { data: a } = await db().from("business_accounts").select("source_lead_id").eq("id", subjectId).maybeSingle();
      if (a?.source_lead_id) items.push(...(await leadItems(a.source_lead_id, "as a lead")));
    }
    if (subject === "customer" && customerEmail) items.push(...(await customerItems(customerEmail)));
  }
  return items.sort((x, y) => y.at.localeCompare(x.at));
}

/** Latest note and how many, per subject — for list pages. */
export async function noteSummaries(subject: NoteSubject, ids: string[]) {
  if (!ids.length) return {} as Record<string, { count: number; last: { at: string; kind: string; body: string; author: string } }>;
  // a long id list would overflow the request URL — past 200, read the latest notes of this type instead
  let q = db().from("account_notes").select("subject_id, kind, body, author, created_at").eq("subject_type", subject).order("created_at", { ascending: false }).limit(5000);
  if (ids.length <= 200) q = q.in("subject_id", ids);
  const { data } = await q;
  const out: Record<string, { count: number; last: { at: string; kind: string; body: string; author: string } }> = {};
  for (const n of data ?? []) {
    const cur = out[n.subject_id];
    if (cur) cur.count++;
    else out[n.subject_id] = { count: 1, last: { at: n.created_at, kind: n.kind, body: n.body, author: n.author } };
  }
  return out;
}
