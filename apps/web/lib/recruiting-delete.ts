/*
 * FILE    : apps/web/lib/recruiting-delete.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-11-11_0030 UTC
 * PURPOSE : Hub → Recruiting: delete someone who didn't make it through onboarding (declined, dropped off, never
 *           finished setup). Admins only. One person = their application(s) (same email), their unfinished pro record
 *           and everything hanging off it (documents, interviews, offers, onboarding history: database cascades), their
 *           uploaded files (pro-docs: <pro id>/…, applications/<app id>/…; person-files and the profile photo), and
 *           their login if it was only ever a pro login (never a customer's or staff's).
 *           Refused when they can't be deleted cleanly: an approved / active pro, or anyone who has ever been assigned a
 *           job or has a payout (job, payment and tax records must stay — offboard them in Hub → Pros instead).
 *           What stays: one line in the recruiting log ("deleted applicant" + initials, trades, reason, who), so the
 *           decision is on record without the person's details.
 */
import "server-only";
import { adminClient } from "./supabase/server";

const db = () => adminClient();
/** ilike with the email's own _ and % escaped, so it only ever matches that exact address (case-insensitive). */
const exact = (email: string) => email.replace(/[\\%_]/g, (c) => `\\${c}`);
const initials = (n: string | null | undefined) => String(n ?? "").split(/\s+/).filter(Boolean).map((w) => `${w[0].toUpperCase()}.`).join(" ") || "—";

/** Every file under a folder in a bucket, through its subfolders. */
async function listAll(bucket: string, folder: string, depth = 0): Promise<string[]> {
  if (depth > 3) return [];
  const { data } = await db().storage.from(bucket).list(folder, { limit: 1000 });
  const out: string[] = [];
  for (const f of data ?? []) {
    const path = `${folder}/${f.name}`;
    if (f.id) out.push(path); // a file (folders have no id)
    else out.push(...(await listAll(bucket, path, depth + 1)));
  }
  return out;
}
async function removeFolder(bucket: string, folder: string) {
  const paths = await listAll(bucket, folder).catch(() => [] as string[]);
  for (let i = 0; i < paths.length; i += 100) await db().storage.from(bucket).remove(paths.slice(i, i + 100)).catch(() => null);
  return paths.length;
}

export type DeleteResult = { ok: true; removed: { applications: number; pro: boolean; files: number; login: boolean } } | { ok: false; error: string };

export async function deleteCandidate(ids: { applicationId?: string | null; contractorId?: string | null }, actor: string, reason?: string | null): Promise<DeleteResult> {
  // who is this: the application, and the pro record it led to (linked, or the same email — as the pipeline matches them)
  const app = ids.applicationId ? ((await db().from("contractor_applications").select("*").eq("id", ids.applicationId).maybeSingle()).data as Record<string, unknown> | null) : null;
  let pro = ids.contractorId ? ((await db().from("contractors").select("*").eq("id", ids.contractorId).maybeSingle()).data as Record<string, unknown> | null) : null;
  if (!pro && app?.contractor_id) pro = (await db().from("contractors").select("*").eq("id", String(app.contractor_id)).maybeSingle()).data as Record<string, unknown> | null;
  const email = String(app?.email ?? pro?.email ?? "").trim().toLowerCase();
  if (!pro && email) pro = ((await db().from("contractors").select("*").ilike("email", exact(email)).limit(1)).data?.[0] as Record<string, unknown> | undefined) ?? null;
  if (!app && !pro) return { ok: false, error: "Nobody found to delete" };

  // can they be deleted cleanly?
  if (pro) {
    if (pro.status === "approved") return { ok: false, error: "This pro is approved and active. Offboard them in Hub → Pros instead of deleting." };
    const [{ count: jobs }, { count: payouts }] = await Promise.all([
      db().from("jobs").select("id", { count: "exact", head: true }).eq("contractor_id", String(pro.id)),
      db().from("payouts").select("id", { count: "exact", head: true }).eq("contractor_id", String(pro.id)),
    ]);
    if (jobs || payouts) return { ok: false, error: `This pro has ${jobs ? `${jobs} job(s)` : ""}${jobs && payouts ? " and " : ""}${payouts ? `${payouts} payout(s)` : ""} on record, which must be kept for customers and taxes. Offboard them in Hub → Pros instead.` };
  }

  // every application from this person (the one clicked, plus duplicates under the same email)
  const { data: appRows } = email ? await db().from("contractor_applications").select("id").ilike("email", exact(email)) : { data: [] as { id: string }[] };
  const appIds = [...new Set([...(app ? [String(app.id)] : []), ...((appRows ?? []) as { id: string }[]).map((r) => r.id)])];

  // files first (their rows point at them)
  let files = 0;
  for (const id of appIds) files += await removeFolder("pro-docs", `applications/${id}`);
  if (pro) {
    const pid = String(pro.id);
    files += await removeFolder("pro-docs", pid);
    const { data: pf } = await db().from("person_files").select("path").eq("owner_type", "pro").eq("owner_key", pid);
    const pfPaths = ((pf ?? []) as { path: string }[]).map((f) => f.path);
    if (pfPaths.length) { await db().storage.from("person-files").remove(pfPaths).catch(() => null); files += pfPaths.length; }
    await db().from("person_files").delete().eq("owner_type", "pro").eq("owner_key", pid);
    await db().from("person_profile_photos").delete().eq("owner_type", "pro").eq("owner_key", pid);
  }

  // the records (documents, interviews, offers, onboarding history cascade from these)
  if (appIds.length) {
    const { error } = await db().from("contractor_applications").delete().in("id", appIds);
    if (error) return { ok: false, error: `Couldn't delete the application: ${error.message}` };
  }
  let login = false;
  if (pro) {
    const profileId = (pro.profile_id as string | null) ?? null;
    const { error } = await db().from("contractors").delete().eq("id", String(pro.id));
    if (error) return { ok: false, error: `Couldn't delete the pro record: ${error.message}` };
    // their login goes too — only when it was a pro-only login with no customer bookings (never a customer's or staff's)
    if (profileId) {
      const [{ data: prof }, { count: booked }] = await Promise.all([
        db().from("profiles").select("role").eq("id", profileId).maybeSingle(),
        db().from("jobs").select("id", { count: "exact", head: true }).eq("customer_id", profileId),
      ]);
      if (prof?.role === "pro" && !booked) login = !(await db().auth.admin.deleteUser(profileId)).error;
      else if (prof?.role === "pro") await db().from("profiles").update({ role: "customer" }).eq("id", profileId);
    }
  }

  // one line on record, without the person's details
  const who = app ?? pro!;
  await db().from("recruiting_events").insert({
    application_id: null, contractor_id: null, kind: "deleted_applicant", actor,
    note: [`${initials(String(who.contact_name ?? ""))}`, ((who.trades as string[] | null) ?? []).join(", ") || null, reason ? `reason: ${reason}` : null].filter(Boolean).join(" · "),
  });
  return { ok: true, removed: { applications: appIds.length, pro: Boolean(pro), files, login } };
}
