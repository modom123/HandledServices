/*
 * FILE    : apps/web/app/hub/email/page.tsx
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-05_0148 UTC
 * PURPOSE : Hub → Email Center: marketing from the company mailbox (Hostinger, info@handledsvc.com).
 *           Setup status, today's sending vs the daily cap, campaigns with results, starter templates,
 *           the inbox, sender settings, and the do-not-email list.
 */
import Link from "next/link";
import { EMAIL_AUDIENCES, EMAIL_TEMPLATES } from "@handled/core";
import { adminClient } from "@/lib/supabase/server";
import { getEmailSettings, sendingProblems, type Campaign } from "@/lib/email-center";
import { mailboxUser } from "@/lib/mailbox";
import { Stat } from "@/components/ui";
import { EmailSettingsForm, OptoutForm } from "@/components/EmailCenter";

export const dynamic = "force-dynamic";

const STATUS: Record<string, string> = { draft: "bg-paper", scheduled: "bg-sky-100", sending: "bg-amber-100", sent: "bg-emerald-100", paused: "bg-slate-200", cancelled: "bg-rose-100" };

export default async function EmailCenter() {
  const db = adminClient();
  const dayStart = new Date(new Date().toISOString().slice(0, 10) + "T00:00:00Z").toISOString();
  const [s, { data }, { count: today }, { count: optouts }] = await Promise.all([
    getEmailSettings(),
    db.from("email_campaigns").select("*").order("created_at", { ascending: false }).limit(100),
    db.from("email_campaign_recipients").select("id", { count: "exact", head: true }).eq("status", "sent").gte("sent_at", dayStart),
    db.from("email_optouts").select("email", { count: "exact", head: true }),
  ]);
  const campaigns = (data ?? []) as Campaign[];
  const problems = sendingProblems();
  const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : "—");
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Email Center</h1>
          <p className="max-w-3xl text-sm text-ink-soft">Marketing email from {mailboxUser() ?? "the company mailbox"}: pick who gets it, write it (or start from a template), send yourself a test, then send now or schedule it. It goes out in small batches within your daily cap. Every email carries your business address and a one-click unsubscribe, and anyone who unsubscribes is never emailed again.</p>
        </div>
        <div className="flex gap-2"><Link href="/hub/email/inbox" className="btn-ghost">📥 Inbox</Link><Link href="/hub/email/new" className="btn-primary">New campaign</Link></div>
      </div>
      {problems.length > 0 && (
        <div className="card border-amber-300 bg-amber-50 text-sm">
          <div className="font-semibold">Finish setup to send</div>
          <ul className="mt-1 list-disc pl-5">{problems.map((p) => <li key={p}>{p}</li>)}</ul>
          <p className="mt-2 text-xs">In Vercel → Settings → Environment Variables add <code>SMTP_USER</code> = info@handledsvc.com and <code>SMTP_PASSWORD</code> = the mailbox password (type it there yourself; never paste it in chat or email), plus <code>BUSINESS_POSTAL_ADDRESS</code>. Then redeploy and press “Check mailbox & domain” below.</p>
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-4">
        <Stat label="Sent today" value={`${today ?? 0} / ${s.daily_cap}`} hint="daily cap" />
        <Stat label="Campaigns" value={campaigns.length} />
        <Stat label="Sending now" value={campaigns.filter((c) => ["sending", "scheduled"].includes(c.status)).length} />
        <Stat label="Unsubscribed" value={optouts ?? 0} hint="never emailed" />
      </div>
      <section>
        <h2 className="mb-2 text-lg font-bold">Campaigns</h2>
        {campaigns.length ? (
          <div className="card overflow-x-auto p-0"><table className="w-full text-sm">
            <thead className="bg-paper text-left text-xs uppercase tracking-wide text-ink-soft"><tr><th className="p-3">Campaign</th><th className="p-3">Audience</th><th className="p-3">Status</th><th className="p-3">Sent</th><th className="p-3">Clicked</th><th className="p-3">Unsubscribed</th></tr></thead>
            <tbody>{campaigns.map((c) => (
              <tr key={c.id} className="border-t border-line">
                <td className="p-3"><Link href={`/hub/email/${c.id}`} className="font-semibold text-brand underline">{c.name}</Link><div className="text-xs text-ink-soft">{c.subject || "—"}</div></td>
                <td className="p-3 text-xs">{EMAIL_AUDIENCES[c.audience]?.label}</td>
                <td className="p-3"><span className={`rounded px-2 py-0.5 text-xs ${STATUS[c.status] ?? ""}`}>{c.status}</span>{c.status === "scheduled" && c.scheduled_at && <div className="text-xs text-ink-soft">{new Date(c.scheduled_at).toLocaleString("en-US", { timeZone: "America/Detroit" })}</div>}</td>
                <td className="p-3 text-xs">{c.sent.toLocaleString()} / {c.recipients.toLocaleString()}{c.failed ? <div className="text-rose-700">{c.failed} failed</div> : null}</td>
                <td className="p-3 text-xs">{c.clicks} ({pct(c.clicks, c.sent)})</td>
                <td className="p-3 text-xs">{c.unsubscribes} ({pct(c.unsubscribes, c.sent)})</td>
              </tr>
            ))}</tbody>
          </table></div>
        ) : <p className="text-sm text-ink-soft">No campaigns yet. Start from a template below.</p>}
      </section>
      <section>
        <h2 className="mb-2 text-lg font-bold">Start from a template</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {EMAIL_TEMPLATES.map((t) => (
            <Link key={t.key} href={`/hub/email/new?template=${t.key}`} className="card block hover:border-brand">
              <div className="font-semibold">{t.name}</div>
              <div className="text-xs text-ink-soft">{EMAIL_AUDIENCES[t.audience].label}{t.body_es ? " · English + Spanish" : ""}</div>
              <div className="mt-1 text-sm">“{t.subject}”</div>
            </Link>
          ))}
        </div>
      </section>
      <section className="card"><h2 className="mb-2 text-lg font-bold">Sender & mailbox</h2><EmailSettingsForm s={s} /></section>
      <section className="card"><h2 className="mb-2 text-lg font-bold">Do-not-email list</h2><p className="mb-2 text-sm text-ink-soft">Someone asked by phone or in person not to get emails? Add them here. Unsubscribe links add people automatically. Booking messages (receipts, schedule changes) still go.</p><OptoutForm /></section>
    </div>
  );
}
