/*
 * FILE    : apps/web/app/hub/leads/page.tsx
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-03_0210 UTC
 * PURPOSE : Handled Hub → Pro leads. The automatic pro-recruiting engine: what it found, who it
 *           emailed, who clicked and applied, the call list for phone-only leads, CSV import, and
 *           the settings. Setup status for the three keys it needs.
 */
import Link from "next/link";
import { TRADES } from "@handled/core";
import { adminClient } from "@/lib/supabase/server";
import { getLeadSettings, outreachReady } from "@/lib/leads";
import { Stat } from "@/components/ui";
import { LeadActions, LeadImport, LeadSettingsPanel } from "@/components/LeadAdmin";

export const dynamic = "force-dynamic";
const trade = (t: string) => TRADES.find((x) => x.id === t)?.label ?? t;

type Lead = { id: string; business_name: string; contact_name: string | null; trade: string; city: string | null; phone: string | null; email: string | null; website: string | null; rating: number | null; review_count: number | null; score: number; status: string; step: number; source: string; created_at: string };

export default async function LeadsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const filter = (await searchParams).status ?? "";
  const db = adminClient();
  const [settings, { data: all }] = await Promise.all([
    getLeadSettings(),
    db.from("pro_leads").select("id, business_name, contact_name, trade, city, phone, email, website, rating, review_count, score, status, step, source, created_at").order("score", { ascending: false }).limit(3000),
  ]);
  const leads = (all ?? []) as Lead[];
  const n = (s: string | string[]) => leads.filter((l) => (Array.isArray(s) ? s : [s]).includes(l.status)).length;
  const emailed = leads.filter((l) => l.step > 0).length;
  const shown = (filter ? leads.filter((l) => l.status === filter) : leads).slice(0, 300);
  const calls = leads.filter((l) => l.status === "call").slice(0, 50);
  const keys = [
    ["GOOGLE_PLACES_API_KEY", Boolean(process.env.GOOGLE_PLACES_API_KEY), "finds businesses automatically (Google Cloud → Places API (New) → API key)"],
    ["OUTREACH_RESEND_API_KEY + OUTREACH_FROM", Boolean(process.env.OUTREACH_RESEND_API_KEY && process.env.OUTREACH_FROM), "sends invitations from a SEPARATE domain (e.g. pros@join-handled.com) so cold email never affects booking emails"],
    ["BUSINESS_POSTAL_ADDRESS", Boolean(process.env.BUSINESS_POSTAL_ADDRESS), "required by law (CAN-SPAM) in every invitation"],
  ] as const;
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Pro leads</h1>
        <p className="text-sm text-ink-soft">Finds independent pros where we’re short (<Link href="/hub/gaps" className="text-brand underline">Supply gaps</Link>), finds the email on their own website, and sends a 3-email invitation (day 0, 3, 8). It stops when they apply, unsubscribe or bounce. Phone-only leads go to the call list below — we never send automated texts. Applicants land in <Link href="/hub/recruiting" className="text-brand underline">Recruiting</Link>.</p>
      </div>
      <div className="grid gap-2 sm:grid-cols-3">{keys.map(([k, ok, why]) => <div key={k} className={`card text-xs ${ok ? "" : "border-amber-300 bg-amber-50"}`}><b>{ok ? "✓" : "⚠"} {k}</b><div className="text-ink-soft">{why}</div></div>)}</div>
      {!outreachReady() && <p className="text-xs text-ink-soft">Without the outreach keys the engine still finds leads and builds the call list; it just doesn’t email.</p>}
      <div className="grid gap-3 sm:grid-cols-6">
        <Stat label="Leads found" value={leads.length} />
        <Stat label="With email" value={leads.filter((l) => l.email).length} />
        <Stat label="Emailed" value={emailed} />
        <Stat label="Clicked" value={n(["clicked"]) + n(["applied"])} hint={emailed ? `${Math.round(((n("clicked") + n("applied")) / emailed) * 100)}% of emailed` : undefined} />
        <Stat label="Applied" value={n("applied")} />
        <Stat label="Call list" value={n("call")} />
      </div>
      <LeadSettingsPanel initial={{ enabled: settings.enabled, discover_per_day: settings.discover_per_day, emails_per_day: settings.emails_per_day, min_rating: Number(settings.min_rating), min_reviews: settings.min_reviews, trades: settings.trades }} />
      <LeadImport />

      <section className="card">
        <div className="font-semibold">Call list <span className="text-sm font-normal text-ink-soft">— phone only, best first</span></div>
        <p className="mt-1 text-xs text-ink-soft">Script: “Hi, this is [name] with {"Handled"} — we send independent {"[trade]"} pros prepaid jobs near them, no lead fees; you see the pay before you accept. Could I text or email you the 5-minute sign-up link?” Only text them the link if they say yes.</p>
        {!calls.length ? <p className="mt-2 text-sm text-ink-soft">Nobody to call right now.</p> : (
          <ul className="mt-2 divide-y divide-line text-sm">{calls.map((l) => (
            <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <div><b>{l.business_name}</b> · {trade(l.trade)} · {l.city ?? "—"}{l.rating ? ` · ${l.rating}★ (${l.review_count})` : ""}<div className="text-xs"><a className="text-brand underline" href={`tel:${l.phone}`}>{l.phone}</a>{l.website ? <> · <a className="underline" href={l.website} target="_blank" rel="noopener noreferrer">site</a></> : null}</div></div>
              <LeadActions id={l.id} status={l.status} />
            </li>))}</ul>
        )}
      </section>

      <section className="card overflow-x-auto">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <b>All leads</b>
          {["", "queued", "emailing", "clicked", "applied", "call", "replied", "not_interested", "unsubscribed", "bounced", "do_not_contact"].map((s) => (
            <Link key={s} href={s ? `/hub/leads?status=${s}` : "/hub/leads"} className={`rounded-full px-2.5 py-0.5 text-xs ${filter === s ? "bg-brand text-white" : "bg-paper"}`}>{s ? s.replace(/_/g, " ") : "all"} ({s ? n(s) : leads.length})</Link>
          ))}
        </div>
        <table className="mt-3 w-full text-sm">
          <thead className="text-left text-xs uppercase tracking-wide text-ink-soft"><tr><th className="py-2">Business</th><th>Trade</th><th>City</th><th>Rating</th><th>Contact</th><th>Score</th><th>Status</th><th /></tr></thead>
          <tbody>{shown.map((l) => (
            <tr key={l.id} className="border-t border-line align-top">
              <td className="py-2">{l.business_name}{l.website ? <a className="ml-1 text-xs text-brand underline" href={l.website} target="_blank" rel="noopener noreferrer">site</a> : null}<div className="text-xs text-ink-soft">{l.source.replace("_", " ")}</div></td>
              <td>{trade(l.trade)}</td><td>{l.city ?? "—"}</td><td>{l.rating ? `${l.rating}★ (${l.review_count})` : "—"}</td>
              <td className="text-xs">{l.email ?? ""}{l.email && l.phone ? <br /> : null}{l.phone ?? ""}</td>
              <td>{l.score}</td><td className="text-xs">{l.status.replace(/_/g, " ")}{l.step ? ` · ${l.step}/3 sent` : ""}</td>
              <td><LeadActions id={l.id} status={l.status} /></td>
            </tr>))}{!shown.length && <tr><td className="py-3 text-ink-soft" colSpan={8}>No leads yet. Turn the engine on, add the keys above, or import a list.</td></tr>}</tbody>
        </table>
      </section>
    </div>
  );
}
