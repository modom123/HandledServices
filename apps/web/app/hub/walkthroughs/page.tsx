/*
 * FILE    : apps/web/app/hub/walkthroughs/page.tsx
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-11-17_2350 UTC
 * PURPOSE : Handled Hub → Walkthroughs: free walkthroughs and calls businesses booked themselves (/walkthrough). Upcoming
 *           first (who's going, notes, done + order-link follow-up, no-show, cancel), then the last 30 days, the
 *           numbers (booked, held, no-shows, became customers) and the booking hours.
 */
import Link from "next/link";
import { WALKTHROUGH_KINDS, bizLanding, walkthroughWhen, type WalkthroughKind } from "@handled/core";
import { adminClient } from "@/lib/supabase/server";
import { getWalkthroughSettings } from "@/lib/walkthroughs";
import { Stat } from "@/components/ui";
import { WalkthroughRowActions, WalkthroughSettingsForm } from "@/components/WalkthroughAdmin";

export const dynamic = "force-dynamic";
type W = { id: string; kind: WalkthroughKind; starts_at: string; status: string; name: string; company: string; email: string; phone: string | null; address: string | null; city: string | null; zip: string | null; needs: string | null; properties: number | null; landing: string | null; biz_lead_id: string | null; staff_notes: string | null; assigned_to: string | null; followed_up_at: string | null; created_at: string };

export default async function Walkthroughs() {
  const db = adminClient();
  const since = new Date(Date.now() - 30 * 86400000).toISOString();
  const [s, { data, error }, { data: leads }] = await Promise.all([
    getWalkthroughSettings(),
    db.from("walkthroughs").select("*").gte("starts_at", since).order("starts_at").limit(500),
    db.from("biz_leads").select("id").eq("status", "converted").limit(5000),
  ]);
  if (error) return <div className="card text-sm">Walkthroughs aren’t set up yet. Run <code>supabase/setup/ADD_WALKTHROUGHS_2026-11-17_2350.sql</code> in Supabase → SQL Editor.</div>;
  const all = (data ?? []) as W[];
  const now = Date.now();
  const upcoming = all.filter((w) => w.status === "booked" && new Date(w.starts_at).getTime() >= now - 2 * 3600000);
  const overdue = all.filter((w) => w.status === "booked" && new Date(w.starts_at).getTime() < now - 2 * 3600000);
  const closed = all.filter((w) => w.status !== "booked").reverse();
  const converted = new Set((leads ?? []).map((l) => l.id));
  const Row = ({ w }: { w: W }) => (
    <tr className="border-t border-line align-top">
      <td className="p-3 text-sm"><div className="font-semibold">{walkthroughWhen(w.starts_at, s.time_zone).replace(/ \(.*\)$/, "")}</div><div className="text-xs text-ink-soft">{WALKTHROUGH_KINDS[w.kind].label}</div></td>
      <td className="p-3 text-sm">
        <div className="font-semibold">{w.company}{w.biz_lead_id && <> · <Link href={`/hub/biz-leads/${w.biz_lead_id}`} className="text-xs text-brand underline">lead{converted.has(w.biz_lead_id) ? " ✓ customer" : ""}</Link></>}</div>
        <div className="text-xs">{w.name} · <a href={`mailto:${w.email}`} className="underline">{w.email}</a>{w.phone ? <> · <a href={`tel:${w.phone}`} className="underline">{w.phone}</a></> : null}</div>
        {w.kind === "onsite" && w.address && <div className="text-xs"><a className="underline" target="_blank" rel="noreferrer" href={`https://maps.google.com/?q=${encodeURIComponent(`${w.address}, ${w.city ?? ""} ${w.zip ?? ""}`)}`}>{w.address}, {w.city}</a></div>}
        {w.needs && <div className="mt-1 whitespace-pre-wrap text-xs text-ink-soft">“{w.needs}”{w.properties ? ` · ${w.properties} properties` : ""}</div>}
        <div className="mt-1 text-[11px] text-ink-soft">{w.landing ? `from the ${bizLanding(w.landing)?.name ?? w.landing} page` : w.biz_lead_id ? "from the sales emails" : "from the website"} · {w.status.replace("_", " ")}{w.followed_up_at ? " · order link sent" : ""}</div>
      </td>
      <td className="w-[22rem] p-3"><WalkthroughRowActions id={w.id} status={w.status} notes={w.staff_notes} assigned={w.assigned_to} followedUp={Boolean(w.followed_up_at)} /></td>
    </tr>
  );
  const table = (rows: W[]) => <div className="card overflow-x-auto p-0"><table className="w-full"><tbody>{rows.map((w) => <Row key={w.id} w={w} />)}</tbody></table></div>;
  const held = all.filter((w) => w.status === "done").length;
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Walkthroughs</h1>
        <p className="max-w-3xl text-sm text-ink-soft">Businesses pick their own time at <a href="/walkthrough" target="_blank" className="underline">/walkthrough</a> (linked from every business landing page, the sales emails and the AI’s reply drafts). They get a confirmation, a calendar link and a reminder the day before; you get an alert. After the visit, press <b>Done + send order link</b> so the quote turns into a first job.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-5">
        <Stat label="Upcoming" value={upcoming.length} />
        <Stat label="Booked (30 days)" value={all.filter((w) => new Date(w.created_at).getTime() >= now - 30 * 86400000).length} />
        <Stat label="Held" value={held} />
        <Stat label="No-shows" value={all.filter((w) => w.status === "no_show").length} hint="call to rebook" />
        <Stat label="Became customers" value={all.filter((w) => w.biz_lead_id && converted.has(w.biz_lead_id)).length} hint="from sales-email leads" />
      </div>
      {overdue.length > 0 && <section><h2 className="mb-2 text-lg font-bold text-amber-800">Close these out ({overdue.length})</h2>{table(overdue)}</section>}
      <section><h2 className="mb-2 text-lg font-bold">Upcoming</h2>{upcoming.length ? table(upcoming) : <p className="text-sm text-ink-soft">Nothing booked yet. Share <a href="/business/property-managers" target="_blank" className="underline">a landing page</a> or reply to warm leads with the walkthrough link.</p>}</section>
      {closed.length > 0 && <section><h2 className="mb-2 text-lg font-bold">Last 30 days</h2>{table(closed)}</section>}
      <section className="card"><h2 className="mb-2 text-lg font-bold">Booking hours</h2><WalkthroughSettingsForm s={s} /></section>
    </div>
  );
}
