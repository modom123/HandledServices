/*
 * FILE    : apps/web/app/hub/inbox/page.tsx
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-20_0100 UTC
 * PURPOSE : Hub → Lead inbox: every inbound lead from every channel (website form and AI chat, Facebook / Instagram /
 *           TikTok / Google / LinkedIn lead forms, Yelp, Google Local Services…), newest first, with how fast we answered
 *           (speed to lead) and one-tap status; and the channel report — leads, speed, bookings and revenue per channel
 *           (bookings by first-touch source), so money goes where customers come from.
 */
import Link from "next/link";
import { CHANNELS, SERVICE_BY_SLUG, channelLabel, channelOf, money } from "@handled/core";
import { adminClient } from "@/lib/supabase/server";
import { Stat } from "@/components/ui";
import { LeadStatusButtons } from "@/components/LeadInbox";

export const dynamic = "force-dynamic";

type Lead = { id: string; name: string | null; email: string | null; phone: string | null; company: string | null; zip: string | null; city: string | null; service_slug: string | null; message: string | null; channel: string | null; source: string; campaign: string | null; status: string | null; sms_consent: boolean | null; first_reply_at: string | null; contacted_at: string | null; biz_lead_id: string | null; created_at: string };

const mins = (a: string, b: string | null) => (b ? (new Date(b).getTime() - new Date(a).getTime()) / 60000 : null);
const fmtMins = (m: number | null) => (m == null ? "—" : m < 1 ? "<1 min" : m < 90 ? `${Math.round(m)} min` : m < 2880 ? `${Math.round(m / 60)} h` : `${Math.round(m / 1440)} d`);
const median = (xs: number[]) => { if (!xs.length) return null; const s = [...xs].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };

export default async function LeadInbox({ searchParams }: { searchParams: Promise<{ days?: string; channel?: string }> }) {
  const { days: d, channel } = await searchParams;
  const days = [7, 30, 90].includes(Number(d)) ? Number(d) : 30;
  const since = new Date(Date.now() - days * 86400000).toISOString();
  const db = adminClient();
  const [{ data: leadRows }, { data: jobs }, { data: calls }] = await Promise.all([
    db.from("leads").select("*").gte("created_at", since).order("created_at", { ascending: false }).limit(5000),
    db.from("jobs").select("status, price_final, attribution, created_at").gte("created_at", since).limit(20000),
    db.from("biz_lead_events").select("kind").like("kind", "call:%").gte("created_at", since).limit(20000),
  ]);
  const leads = ((leadRows ?? []) as Lead[]).map((l) => ({ ...l, channel: l.channel ?? channelOf(l.source) }));
  const open = leads.filter((l) => (l.status ?? "new") === "new" || l.status === "contacted").filter((l) => !channel || l.channel === channel);
  const firstReply = leads.map((l) => mins(l.created_at, l.first_reply_at)).filter((x): x is number => x != null);
  const firstCall = leads.map((l) => mins(l.created_at, l.contacted_at)).filter((x): x is number => x != null);
  const live = (jobs ?? []).filter((j) => j.status !== "cancelled");
  // one row per channel: leads in, how fast we got to them, and the bookings + revenue that came from the channel
  const rows = CHANNELS.map((c) => {
    const ls = leads.filter((l) => l.channel === c.id);
    const bk = live.filter((j) => channelOf(j.attribution as Record<string, unknown> | null) === c.id);
    const fast = ls.filter((l) => { const m = mins(l.created_at, l.contacted_at); return m != null && m <= 5; }).length;
    return { c, leads: ls.length, booked: ls.filter((l) => l.status === "booked").length, fast, bookings: bk.length, revenue: bk.reduce((t, j) => t + Number(j.price_final ?? 0), 0) };
  }).filter((r) => r.leads || r.bookings).sort((a, b) => b.revenue - a.revenue || b.leads - a.leads);
  const tab = (href: string, label: string, on: boolean) => <Link href={href} className={`rounded-full border px-3 py-1 text-xs ${on ? "border-brand bg-brand-tint font-semibold" : "border-line"}`}>{label}</Link>;
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Lead inbox</h1>
        <p className="max-w-3xl text-sm text-ink-soft">Every inbound lead from every channel lands here and gets an instant reply (email, plus a text only if they agreed to texts). Businesses also go to the top of the <Link href="/hub/biz-leads/calls" className="text-brand underline">Call desk</Link>. Call new leads within 5 minutes: the odds of reaching someone drop fast after that. Bookings are counted by the customer’s first-touch channel.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-5">
        <Stat label={`Leads (${days}d)`} value={leads.length} />
        <Stat label="Waiting for a call" value={leads.filter((l) => (l.status ?? "new") === "new").length} />
        <Stat label="Instant reply (median)" value={fmtMins(median(firstReply))} />
        <Stat label="First call (median)" value={fmtMins(median(firstCall))} hint={`${firstCall.filter((m) => m <= 5).length} within 5 min`} />
        <Stat label="Call desk dials" value={(calls ?? []).length} />
      </div>
      <section>
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <h2 className="mr-2 text-lg font-bold">Channels</h2>
          {[7, 30, 90].map((n) => tab(`/hub/inbox?days=${n}`, `${n} days`, days === n))}
          <a href="/api/hub/conversions" className="ml-auto text-xs text-brand underline">Google Ads offline conversions (CSV)</a>
        </div>
        {rows.length ? (
          <div className="card overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead className="bg-paper text-left text-xs uppercase tracking-wide text-ink-soft"><tr><th className="p-3">Channel</th><th className="p-3">Leads</th><th className="p-3">Called ≤ 5 min</th><th className="p-3">Leads booked</th><th className="p-3">Bookings (first touch)</th><th className="p-3">Revenue</th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.c.id} className="border-t border-line">
                    <td className="p-3"><Link href={`/hub/inbox?days=${days}&channel=${r.c.id}`} className="font-semibold text-brand hover:underline">{r.c.emoji} {r.c.label}</Link></td>
                    <td className="p-3">{r.leads}</td>
                    <td className="p-3">{r.leads ? `${Math.round((r.fast / r.leads) * 100)}%` : "—"}</td>
                    <td className="p-3">{r.booked}</td>
                    <td className="p-3">{r.bookings}</td>
                    <td className="p-3">{money(r.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="text-sm text-ink-soft">No leads or bookings in this window yet.</p>}
      </section>
      <section>
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <h2 className="mr-2 text-lg font-bold">Open leads</h2>
          {channel && tab(`/hub/inbox?days=${days}`, `${channelLabel(channel)} ✕`, true)}
        </div>
        {open.length ? (
          <div className="space-y-2">
            {open.slice(0, 200).map((l) => {
              const wait = mins(l.created_at, l.contacted_at ?? new Date().toISOString());
              return (
                <div key={l.id} className="card text-sm">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wide text-brand">{channelLabel(l.channel)}{l.campaign ? ` · ${l.campaign}` : ""}</div>
                      <div className="font-bold">{l.name ?? "(no name)"}{l.company ? ` — ${l.company}` : ""}</div>
                      <div className="text-xs text-ink-soft">{l.service_slug ? SERVICE_BY_SLUG[l.service_slug]?.name ?? l.service_slug : "Service not given"}{l.city || l.zip ? ` · ${[l.city, l.zip].filter(Boolean).join(" ")}` : ""} · {new Date(l.created_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/Detroit" })}</div>
                      {l.message && <p className="mt-1 whitespace-pre-wrap text-xs">{l.message.slice(0, 400)}</p>}
                      <div className="mt-1 text-xs text-ink-soft">{l.first_reply_at ? `Instant reply sent (${fmtMins(mins(l.created_at, l.first_reply_at))})` : "No instant reply"}{l.sms_consent ? " · OK to text" : " · no texts"}{(l.status ?? "new") === "new" ? <b className={wait != null && wait > 5 ? " text-rose-700" : ""}> · waiting {fmtMins(wait)}</b> : ` · contacted after ${fmtMins(mins(l.created_at, l.contacted_at))}`}{l.biz_lead_id ? <> · <Link href={`/hub/biz-leads/${l.biz_lead_id}`} className="underline">business lead</Link></> : null}</div>
                    </div>
                    <div className="flex flex-col items-end gap-1 text-xs">
                      {l.phone && <a href={`tel:${l.phone.replace(/[^\d+]/g, "")}`} className="btn-primary">📞 {l.phone}</a>}
                      {l.email && <a href={`mailto:${l.email}`} className="text-brand underline">{l.email}</a>}
                    </div>
                  </div>
                  <div className="mt-2"><LeadStatusButtons id={l.id} status={l.status ?? "new"} /></div>
                </div>
              );
            })}
          </div>
        ) : <p className="text-sm text-ink-soft">No open leads. 🎉</p>}
      </section>
    </div>
  );
}
