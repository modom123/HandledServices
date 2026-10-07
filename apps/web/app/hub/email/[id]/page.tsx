/*
 * FILE    : apps/web/app/hub/email/[id]/page.tsx
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-05_0148 UTC
 * PURPOSE : Hub → Email Center → one campaign. A draft opens in the editor; once launched it shows progress,
 *           clicks, unsubscribes, who clicked, failures and skips, with pause / resume / cancel / duplicate.
 */
import Link from "next/link";
import { notFound } from "next/navigation";
import { EMAIL_AUDIENCES } from "@handled/core";
import { adminClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/auth";
import { renderFor, type Campaign } from "@/lib/email-center";
import { Stat } from "@/components/ui";
import { CampaignActions, CampaignEditor } from "@/components/EmailCenter";

export const dynamic = "force-dynamic";

export default async function CampaignPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const db = adminClient();
  const { data } = await db.from("email_campaigns").select("*").eq("id", id).maybeSingle();
  const c = data as Campaign | null;
  if (!c) notFound();
  const v = await getViewer();
  const head = (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><Link href="/hub/email" className="text-sm text-brand underline">← Email Center</Link><h1 className="text-2xl font-bold">{c.name}</h1><p className="text-sm text-ink-soft">{EMAIL_AUDIENCES[c.audience]?.label} · {c.status}</p></div>
      <CampaignActions id={c.id} status={c.status} />
    </div>
  );
  if (c.status === "draft") {
    return (<div className="space-y-4">{head}<CampaignEditor me={v?.email ?? "you"} initial={{ id: c.id, name: c.name, subject: c.subject, preheader: c.preheader ?? "", body: c.body, subject_es: c.subject_es ?? "", body_es: c.body_es ?? "", audience: c.audience, custom_list: c.custom_list ?? "", custom_consent: c.custom_consent }} /></div>);
  }
  const [{ data: clicked }, { data: problems }, { count: queued }] = await Promise.all([
    db.from("email_campaign_recipients").select("email, name, clicks, clicked_at").eq("campaign_id", id).gt("clicks", 0).order("clicked_at", { ascending: false }).limit(100),
    db.from("email_campaign_recipients").select("email, status, error").eq("campaign_id", id).in("status", ["failed", "skipped"]).limit(100),
    db.from("email_campaign_recipients").select("id", { count: "exact", head: true }).eq("campaign_id", id).eq("status", "queued"),
  ]);
  const sample = renderFor(c, { email: "sample@example.com", locale: "en", vars: { first_name: "Alex", company: "Sample Property Co.", city: "Detroit" } }, null);
  return (
    <div className="space-y-6">
      {head}
      <div className="grid gap-3 sm:grid-cols-5">
        <Stat label="Sent" value={`${c.sent.toLocaleString()} / ${c.recipients.toLocaleString()}`} />
        <Stat label="Waiting" value={queued ?? 0} hint={c.status === "sending" ? "goes out every 10 min" : c.status} />
        <Stat label="Clicked" value={c.clicks} hint={c.sent ? `${Math.round((c.clicks / c.sent) * 100)}% of sent` : undefined} />
        <Stat label="Unsubscribed" value={c.unsubscribes} />
        <Stat label="Failed / skipped" value={`${c.failed} / ${c.skipped}`} />
      </div>
      {(clicked ?? []).length > 0 && (
        <section><h2 className="mb-2 text-lg font-bold">Who clicked (follow up)</h2>
          <div className="card text-sm">{(clicked as { email: string; name: string | null; clicks: number }[]).map((r) => <div key={r.email}>{r.name ? `${r.name} · ` : ""}<a className="underline" href={`mailto:${r.email}`}>{r.email}</a> · {r.clicks} click{r.clicks === 1 ? "" : "s"}</div>)}</div>
        </section>
      )}
      {(problems ?? []).length > 0 && (
        <section><h2 className="mb-2 text-lg font-bold">Failed and skipped</h2>
          <div className="card text-xs">{(problems as { email: string; status: string; error: string | null }[]).map((r) => <div key={r.email}>{r.email} · {r.status}{r.error ? ` — ${r.error}` : ""}</div>)}</div>
        </section>
      )}
      <section><h2 className="mb-2 text-lg font-bold">What was sent</h2><div className="mb-2 text-sm">Subject: <b>{sample.subject}</b></div><iframe title="Email" srcDoc={sample.html} className="h-[600px] w-full max-w-2xl rounded-xl border border-line bg-white" /></section>
    </div>
  );
}
