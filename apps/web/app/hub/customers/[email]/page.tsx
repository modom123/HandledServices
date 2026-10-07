/*
 * FILE    : apps/web/app/hub/customers/[email]/page.tsx
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-05_2146 UTC
 * PURPOSE : One customer (keyed by email): contact details, bookings, lifetime spend, reviews, and the full permanent
 *           history — every note, call, email, meeting and text staff logged, plus their bookings, completions and
 *           reviews — newest first. Notes are append-only; a correction is a new note.
 */
import Link from "next/link";
import { notFound } from "next/navigation";
import { getService, money } from "@handled/core";
import { adminClient } from "@/lib/supabase/server";
import { customerSubjectId, timeline } from "@/lib/notes";
import { AddNote, Timeline } from "@/components/AccountNotes";
import { Badge } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function Customer({ params }: { params: Promise<{ email: string }> }) {
  const email = decodeURIComponent((await params).email).trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+$/.test(email)) notFound();
  const pattern = email.replace(/[\\%_]/g, (c) => `\\${c}`);
  const db = adminClient();
  const [{ data: jobs }, { data: profile }] = await Promise.all([
    db.from("jobs").select("id, ref, service_slug, status, price_final, estimate_low, estimate_high, frequency, scheduled_date, contact_name, contact_phone, company_name, customer_type, address, city, zip, created_at").ilike("contact_email", pattern).order("created_at", { ascending: false }).limit(500),
    db.from("profiles").select("full_name, phone, company, role").ilike("email", pattern).maybeSingle(),
  ]);
  if (!(jobs ?? []).length && !profile) notFound();
  const latest = jobs?.[0];
  const name = latest?.company_name ?? latest?.contact_name ?? profile?.full_name ?? email;
  const spend = (jobs ?? []).filter((j) => j.status === "completed").reduce((s, j) => s + Number(j.price_final ?? 0), 0);
  const items = await timeline("customer", customerSubjectId(email), email);
  const notes = items.filter((i) => i.source === "note").length;
  return (
    <div className="space-y-5">
      <Link href="/hub/customers" className="text-sm text-brand">← Customers</Link>
      <div>
        <div className="text-xs text-ink-soft">{latest?.customer_type ?? profile?.role ?? "customer"}{latest?.city ? ` · ${latest.city}` : ""} · {(jobs ?? []).length} job(s) · lifetime spend {money(spend)} · {notes} note(s)</div>
        <h1 className="text-2xl font-bold">{name}</h1>
        <div className="text-sm text-ink-soft">{[latest?.contact_name !== name ? latest?.contact_name : null, email, latest?.contact_phone ?? profile?.phone].filter(Boolean).join(" · ")}{latest?.address ? ` · ${latest.address}, ${latest.city} ${latest.zip}` : ""}</div>
        <Link href={`/hub/contracts?q=${encodeURIComponent(email)}`} className="text-sm text-brand underline">Signed contracts</Link>
      </div>
      <section className="card"><h2 className="mb-2 text-lg font-bold">Add to the history</h2><AddNote subjectType="customer" customerEmail={email} /></section>
      {!!(jobs ?? []).length && (
        <section className="card overflow-x-auto p-0"><table className="w-full text-sm">
          <thead className="bg-paper text-left text-xs uppercase tracking-wide text-ink-soft"><tr><th className="p-3">Job</th><th className="p-3">Service</th><th className="p-3">Date</th><th className="p-3">Price</th><th className="p-3">Status</th></tr></thead>
          <tbody>{(jobs ?? []).map((j) => (
            <tr key={j.id} className="border-t border-line"><td className="p-3"><Link href={`/hub/jobs/${j.id}`} className="font-semibold text-brand underline">{j.ref}</Link></td><td className="p-3">{getService(j.service_slug)?.name ?? j.service_slug}{j.frequency !== "once" ? ` · ${j.frequency}` : ""}</td><td className="p-3 text-xs">{j.scheduled_date ?? new Date(j.created_at).toLocaleDateString()}</td><td className="p-3">{j.price_final ? money(j.price_final) : j.estimate_low ? `${money(j.estimate_low)}–${money(j.estimate_high)}` : "—"}</td><td className="p-3"><Badge tone={j.status === "completed" ? "green" : "amber"}>{String(j.status).replace(/_/g, " ")}</Badge></td></tr>
          ))}</tbody>
        </table></section>
      )}
      <section className="card"><h2 className="mb-3 text-lg font-bold">Notes & history</h2><Timeline items={items} /></section>
    </div>
  );
}
