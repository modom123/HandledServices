/*
 * FILE    : apps/web/app/hub/email/page.tsx
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-05_0148 UTC
 * PURPOSE : Hub → Email Center: marketing from the company mailbox (Hostinger, info@handledsvc.com).
 *           Setup status, today's sending vs the daily cap, campaigns with results, starter templates,
 *           the inbox, sender settings, and the do-not-email list.
 * UPDATED : 2026-11-12_0005 UTC — link to Email signature (/hub/email/signature).
 * UPDATED : 2026-11-24_2330 UTC — Sending status: which mailbox (handledsvc.net only), the mailing address, when the 10-minute
 *           job last ran, today's count, and why recipients of live campaigns were skipped or failed.
 */
import Link from "next/link";
import { EMAIL_AUDIENCES, EMAIL_TEMPLATES } from "@handled/core";
import { adminClient } from "@/lib/supabase/server";
import { campaignSender, getEmailSettings, sendingProblems, type Campaign } from "@/lib/email-center";
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
  // sending status: the 10-minute job's last run, and why recipients of live campaigns are waiting, skipped or failed
  const { data: beat } = await db.from("site_settings").select("value").eq("key", "cron_dispatch").maybeSingle();
  const lastJob = (beat?.value as { at?: string } | null)?.at ?? null;
  const jobAgo = lastJob ? Math.round((Date.now() - new Date(lastJob).getTime()) / 60000) : null;
  const liveIds = ((data ?? []) as Campaign[]).filter((c) => ["scheduled", "sending"].includes(c.status)).map((c) => c.id);
  const { data: issues } = liveIds.length ? await db.from("email_campaign_recipients").select("status, error").in("campaign_id", liveIds).in("status", ["failed", "skipped"]).limit(5000) : { data: [] };
  const reasons = new Map<string, number>();
  for (const r of (issues ?? []) as { status: string; error: string | null }[]) { const k = `${r.status}: ${(r.error ?? "no reason").slice(0, 140)}`; reasons.set(k, (reasons.get(k) ?? 0) + 1); }
  const campaigns = (data ?? []) as Campaign[];
  const problems = sendingProblems();
  const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : "—");
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Email Center</h1>
          <p className="max-w-3xl text-sm text-ink-soft">Marketing email from {campaignSender() ?? "your handledsvc.net mailbox (not connected yet)"}: pick who gets it, write it (or start from a template), send yourself a test, then send now or schedule it. It goes out in small batches within your daily cap. Every email carries your business address and a one-click unsubscribe, and anyone who unsubscribes is never emailed again.</p>
        </div>
        <div className="flex flex-wrap gap-2"><Link href="/hub/email/inbox" className="btn-ghost">📥 Inbox</Link><Link href="/hub/email/signature" className="btn-ghost">✍️ Email signature</Link><Link href="/hub/email/new" className="btn-primary">New campaign</Link></div>
      </div>
      <section className="card text-sm">
        <h2 className="font-semibold">Sending status</h2>
        <ul className="mt-1 space-y-0.5">
          <li>{campaignSender() ? <>✅ Sends from <b>{campaignSender()}</b></> : <>⛔ The handledsvc.net mailbox isn&apos;t ready (see below)</>}</li>
          <li>{process.env.BUSINESS_POSTAL_ADDRESS ? "✅ Mailing address set (required on marketing email)" : "⛔ BUSINESS_POSTAL_ADDRESS isn't set in Vercel: nothing can send until it is"}</li>
          <li>{jobAgo === null ? "⛔ The 10-minute sending job has never run" : jobAgo <= 30 ? `✅ Sending job ran ${jobAgo} min ago` : `⚠️ Sending job last ran ${jobAgo >= 120 ? `${Math.round(jobAgo / 60)} hours` : `${jobAgo} min`} ago. GitHub runs it late; each run catches up (up to 150), but a reliable outside 10-minute timer is better.`}</li>
          <li>Today: <b>{today ?? 0}</b> of {s.daily_cap} sent · up to {s.per_run} every 10 minutes</li>
          {reasons.size > 0 && <li>Not sent on live campaigns: {[...reasons.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k, n]) => `${n} ${k}`).join(" · ")}</li>}
        </ul>
      </section>
      {problems.length > 0 && (
        <div className="card border-amber-300 bg-amber-50 text-sm">
          <div className="font-semibold">Finish setup to send</div>
          <ul className="mt-1 list-disc pl-5">{problems.map((p) => <li key={p}>{p}</li>)}</ul>
          <p className="mt-2 text-xs">In Vercel → Settings → Environment Variables: <code>OUTREACH_SMTP_USER</code> = mark@handledsvc.net, <code>OUTREACH_SMTP_PASSWORD</code> = that mailbox&apos;s password (type it there yourself; never paste it in chat or email), and <code>BUSINESS_POSTAL_ADDRESS</code> = your business mailing address. Then redeploy. Campaigns never go out from handledsvc.com.</p>
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
