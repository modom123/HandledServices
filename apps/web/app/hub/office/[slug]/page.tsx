/*
 * FILE    : apps/web/app/hub/office/[slug]/page.tsx
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-11-17_2300 UTC
 * PURPOSE : Front Office → an executive's office (admins only):
 *             /hub/office/odom   — Mark Odom, CEO: to-dos, email, Zoom, and the important ops tools (today's jobs, jobs
 *                                  without a pro, open alerts, legal reviews, the last 7 days' revenue)
 *             /hub/office/gulley — Cecilia Gulley, Chief Strategy & Recruiting: to-dos, email, Zoom (interviews), and the
 *                                  recruiting tools (pipeline by stage, new applications, pros in vetting, legal checks on pros)
 *           The to-do list is shared between the two offices and goes back and forth (lib/office-todos.ts).
 *           Setup (env names) in lib/offices.ts and lib/zoom.ts.
 * UPDATED : 2026-11-17_2330 UTC — email reads in place (OfficeMail): opening an email stays on the office page, and Back
 *           (the link or the browser's) returns to the inbox instead of leaving the office. The page also loads faster:
 *           the inbox loads after the page instead of holding it up.
 * UPDATED : 2026-11-20_1500 UTC — Mark's office: a second inbox, Business leads email (mark@handledsvc.net — outreach replies),
 *           next to his own email; read and reply in place, with a link to the lead.
 */
import Link from "next/link";
import { notFound } from "next/navigation";
import { PIPELINE } from "@handled/core";
import { adminClient } from "@/lib/supabase/server";
import { adminOnly } from "@/components/AdminOnly";
import { Stat } from "@/components/ui";
import { OFFICES, leadsEmail, leadsMail, officeBySlug, officeEmail, officeMail, officeZoomLink, officeZoomUser, type Office } from "@/lib/offices";
import { upcomingZoomMeetings, zoomReady } from "@/lib/zoom";
import { listTodos, otherOffice } from "@/lib/office-todos";
import { OfficeMail, TodoBoard, VerifyMailbox, ZoomScheduler, type TodoView } from "@/components/Office";

export const dynamic = "force-dynamic";

const when = (iso: string) => new Date(iso).toLocaleString("en-US", { timeZone: "America/Detroit", weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
const usd = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

function Tools({ links }: { links: [string, string][] }) {
  return <div className="flex flex-wrap gap-2">{links.map(([href, label]) => <Link key={href} href={href} className="btn-ghost text-sm">{label}</Link>)}</div>;
}

async function OpsTools() {
  const db = adminClient();
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Detroit" });
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
  const [{ data: todays }, { count: noPro }, { data: alerts }, { count: legal }, { data: done }] = await Promise.all([
    db.from("jobs").select("ref, service_slug, status, time_window, contractor_id").eq("scheduled_date", today).limit(200),
    db.from("jobs").select("id", { count: "exact", head: true }).is("contractor_id", null).in("status", ["requested", "scheduled"]),
    db.from("ops_alerts").select("id, severity, title, created_at").eq("resolved", false).in("severity", ["critical", "warn"]).order("created_at", { ascending: false }).limit(8),
    db.from("agent_tasks").select("id", { count: "exact", head: true }).eq("agent", "legal").eq("status", "open"),
    db.from("jobs").select("price_final").eq("status", "completed").gte("completed_at", weekAgo).limit(5000),
  ]);
  const jobs = (todays ?? []) as { ref: string; service_slug: string; status: string; time_window: string | null; contractor_id: string | null }[];
  const revenue = ((done ?? []) as { price_final: number | null }[]).reduce((s, j) => s + Number(j.price_final ?? 0), 0);
  const al = (alerts ?? []) as { id: string; severity: string; title: string; created_at: string }[];
  return (
    <section className="card space-y-3">
      <h2 className="text-lg font-bold">🧭 Ops tools</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Jobs today" value={jobs.length} hint={`${jobs.filter((j) => !j.contractor_id).length} without a pro`} />
        <Stat label="Need a pro" value={noPro ?? 0} hint="requested or scheduled, unassigned" />
        <Stat label="Revenue, 7 days" value={usd(revenue)} hint={`${(done ?? []).length} completed jobs`} />
        <Stat label="Legal reviews open" value={legal ?? 0} hint="Legal & Compliance team" />
      </div>
      <div>
        <h3 className="text-sm font-semibold">Needs attention</h3>
        {al.length ? (
          <ul className="mt-1 divide-y divide-line text-sm">
            {al.map((a) => <li key={a.id} className="py-1.5"><span className={`mr-2 rounded px-1.5 text-xs ${a.severity === "critical" ? "bg-rose-100 text-rose-800" : "bg-amber-100 text-amber-800"}`}>{a.severity}</span>{a.title}<span className="ml-2 text-xs text-ink-soft">{when(a.created_at)}</span></li>)}
          </ul>
        ) : <p className="text-sm text-ink-soft">No open warnings.</p>}
      </div>
      <Tools links={[["/hub/briefing", "☀️ Daily briefing"], ["/hub/jobs", "🗂️ Jobs"], ["/hub/roster", "🗺️ Live map"], ["/hub/coverage", "🛟 Cancellations"], ["/hub/money", "💵 Money"], ["/hub/accounting", "📒 Accounting"], ["/hub/agents", "🤖 AI agents & legal"], ["/hub/partners", "🤝 Partners"], ["/hub/setup", "✅ Go-live setup"]]} />
    </section>
  );
}

async function RecruitingTools() {
  const db = adminClient();
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
  const [{ data: apps }, { count: vetting }, { count: approved }, { count: legal }] = await Promise.all([
    db.from("contractor_applications").select("id, business_name, contact_name, stage, trades, created_at").order("created_at", { ascending: false }).limit(1000),
    db.from("contractors").select("id", { count: "exact", head: true }).eq("status", "vetting"),
    db.from("contractors").select("id", { count: "exact", head: true }).eq("status", "approved"),
    db.from("agent_tasks").select("id", { count: "exact", head: true }).eq("agent", "legal").eq("status", "open").like("target", "pro:%"),
  ]);
  const list = (apps ?? []) as { id: string; business_name: string | null; contact_name: string | null; stage: string; trades: string[] | null; created_at: string }[];
  const byStage = PIPELINE.map((s) => [s, list.filter((a) => a.stage === s).length] as const);
  const fresh = list.filter((a) => a.created_at >= weekAgo);
  return (
    <section className="card space-y-3">
      <h2 className="text-lg font-bold">🎯 Recruiting tools</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="New applications, 7 days" value={fresh.length} />
        <Stat label="Interviews to do" value={list.filter((a) => a.stage === "interview").length} hint="schedule them on Zoom here" />
        <Stat label="Pros in vetting" value={vetting ?? 0} hint={`${approved ?? 0} approved pros`} />
        <Stat label="Pro compliance checks" value={legal ?? 0} hint="license, insurance, classification" />
      </div>
      <div>
        <h3 className="text-sm font-semibold">Pipeline</h3>
        <div className="mt-1 flex flex-wrap gap-2 text-xs">{byStage.map(([s, n]) => <Link key={s} href="/hub/recruiting/pipeline" className="rounded bg-paper px-2 py-1">{s} <b>{n}</b></Link>)}</div>
      </div>
      <div>
        <h3 className="text-sm font-semibold">Latest applications</h3>
        <ul className="mt-1 divide-y divide-line text-sm">
          {list.slice(0, 8).map((a) => (
            <li key={a.id} className="flex flex-wrap justify-between gap-2 py-1.5">
              <Link href={`/hub/recruiting/${a.id}`} className="font-medium text-brand underline">{a.business_name || a.contact_name || "Applicant"}</Link>
              <span className="text-xs text-ink-soft">{(a.trades ?? []).join(", ")} · {a.stage} · {when(a.created_at)}</span>
            </li>
          ))}
          {!list.length && <li className="py-1.5 text-ink-soft">No applications yet.</li>}
        </ul>
      </div>
      <Tools links={[["/hub/recruiting/pipeline", "📋 Pipeline"], ["/hub/recruiting/openings", "📌 Openings"], ["/hub/recruiting/indeed", "🔎 Indeed"], ["/hub/leads", "🧲 Pro leads"], ["/hub/recruiting/onboarding", "🚀 Onboarding"], ["/hub/recruiting/files", "🗃️ Pro files"], ["/hub/gaps", "🕳️ Supply gaps"], ["/hub/talent", "🤝 Client searches"]]} />
    </section>
  );
}

function Mail({ o }: { o: Office }) {
  const acct = officeMail(o);
  return (
    <section className="card space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-bold">✉️ Email{officeEmail(o) ? ` · ${officeEmail(o)}` : ""}</h2>
        {acct && <VerifyMailbox office={o.slug} />}
      </div>
      {acct ? <OfficeMail office={o.slug} first={o.first} /> : (
        <p className="rounded bg-amber-50 p-2 text-sm">Not connected yet. In Vercel → Environment Variables add <code>OFFICE_{o.key}_EMAIL</code> ({o.first}&apos;s mailbox address) and <code>OFFICE_{o.key}_PASSWORD</code>, then redeploy.</p>
      )}
    </section>
  );
}

/** Mark's office: the business-leads mailbox (cold outreach replies to mark@handledsvc.net). */
function LeadsMail({ o }: { o: Office }) {
  const connected = Boolean(leadsMail());
  return (
    <section className="card space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-bold">📨 Business leads email{leadsEmail() ? ` · ${leadsEmail()}` : ""}</h2>
        {connected && <VerifyMailbox office={o.slug} box="leads" />}
      </div>
      <p className="text-xs text-ink-soft">Replies to the business-leads outreach. The sales agent reads them too and stops emailing anyone who says no; answer the interested ones here. <a className="text-brand underline" href="/hub/biz-leads">All business leads →</a></p>
      {connected ? <OfficeMail office={o.slug} first={o.first} box="leads" /> : (
        <p className="rounded bg-amber-50 p-2 text-sm">Not connected yet. In Vercel → Environment Variables add <code>OUTREACH_SMTP_USER</code> (mark@handledsvc.net), <code>OUTREACH_SMTP_PASSWORD</code> and <code>OUTREACH_FROM_NAME</code>, then redeploy.</p>
      )}
    </section>
  );
}

async function Zoom({ o }: { o: Office }) {
  const link = officeZoomLink(o);
  const user = officeZoomUser(o);
  const ready = zoomReady() && Boolean(user);
  let error: string | null = null;
  const upcoming = ready ? await upcomingZoomMeetings(user!).catch((e: Error) => { error = e.message; return []; }) : [];
  return (
    <section className="card space-y-3">
      <h2 className="text-lg font-bold">🎥 Zoom</h2>
      {link ? <a href={link} target="_blank" rel="noreferrer" className="btn-primary inline-block">Open my Zoom room</a> : <p className="text-sm text-ink-soft">Add <code>OFFICE_{o.key}_ZOOM_LINK</code> ({o.first}&apos;s Personal Meeting Room link) for a one-click room.</p>}
      <ZoomScheduler office={o.slug} ready={ready} defaultTopic={o.tools === "recruiting" ? "Interview: " : ""} />
      {error && <p className="text-xs text-rose-700">Couldn&apos;t load upcoming meetings: {error}</p>}
      {upcoming.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold">Coming up</h3>
          <ul className="mt-1 divide-y divide-line text-sm">{upcoming.map((m) => <li key={m.id} className="flex flex-wrap justify-between gap-2 py-1.5"><a href={m.join_url} target="_blank" rel="noreferrer" className="text-brand underline">{m.topic}</a><span className="text-xs text-ink-soft">{when(m.start_time)}</span></li>)}</ul>
        </div>
      )}
      {!zoomReady() && <p className="text-xs text-ink-soft">Setup: a Zoom Server-to-Server OAuth app (scopes to create and read meetings) → <code>ZOOM_ACCOUNT_ID</code>, <code>ZOOM_CLIENT_ID</code>, <code>ZOOM_CLIENT_SECRET</code> in Vercel. Meetings go on <code>OFFICE_{o.key}_ZOOM_USER</code> (defaults to the office email).</p>}
    </section>
  );
}

export default async function OfficePage({ params }: { params: Promise<{ slug: string }> }) {
  const gate = await adminOnly();
  if (gate) return gate;
  const { slug } = await params;
  const o = officeBySlug(slug);
  if (!o) notFound();
  const other = otherOffice(o.slug);
  const names = Object.fromEntries(OFFICES.map((x) => [x.slug, x.name]));
  const todos = await listTodos().catch((e: Error) => ({ open: [], done: [], error: e.message }));
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{o.icon} {o.name}</h1>
        <p className="text-sm text-ink-soft">{o.title} · <Link href={`/hub/office/${other}`} className="text-brand underline">{names[other]}&apos;s office →</Link></p>
      </div>
      <section className="card space-y-3">
        <h2 className="text-lg font-bold">📝 To-do list <span className="text-sm font-normal text-ink-soft">— shared with {names[other]}; send items back and forth</span></h2>
        <TodoBoard office={o.slug} other={other} names={names} todos={todos.open as TodoView[]} done={todos.done as TodoView[]} error={todos.error} />
      </section>
      {o.tools === "ops" ? <OpsTools /> : <RecruitingTools />}
      <div className="grid gap-6 lg:grid-cols-2">
        <Mail o={o} />
        {o.leadsInbox ? <LeadsMail o={o} /> : <Zoom o={o} />}
      </div>
      {o.leadsInbox && <Zoom o={o} />}
    </div>
  );
}
