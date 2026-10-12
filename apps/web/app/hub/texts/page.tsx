/*
 * FILE    : apps/web/app/hub/texts/page.tsx
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-12_0005 UTC
 * PURPOSE : Hub → Texts: two-way texting with customers and pros. Every text sent to the Handled number lands here as a
 *           conversation (by phone number), matched to the customer or pro and their current job. Texts matched to a job
 *           also show in that job's messages. Reply by text, mark handled, or attach an unknown number's text to a job.
 *           Conversations waiting on a reply come first.
 */
import Link from "next/link";
import { adminClient } from "@/lib/supabase/server";
import { smsConfigured } from "@/lib/sms";
import { siteUrl } from "@/lib/notify";
import { Badge } from "@/components/ui";
import { TextReply } from "@/components/TextsInbox";

export const dynamic = "force-dynamic";
export const metadata = { title: "Texts" };

type T = { id: string; from_number: string; body: string; media_count: number; matched_role: string | null; profile_id: string | null; contractor_id: string | null; job_id: string | null; direction: "in" | "out"; sent_by: string | null; handled_at: string | null; created_at: string };
const when = (iso: string) => new Date(iso).toLocaleString("en-US", { timeZone: "America/Detroit", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

export default async function Texts({ searchParams }: { searchParams: Promise<{ all?: string }> }) {
  const all = (await searchParams).all === "1";
  const db = adminClient();
  const since = new Date(Date.now() - (all ? 60 : 14) * 86400000).toISOString();
  const { data, error } = await db.from("sms_inbox").select("id, from_number, body, media_count, matched_role, profile_id, contractor_id, job_id, direction, sent_by, handled_at, created_at").gte("created_at", since).order("created_at", { ascending: false }).limit(600);
  const rows = (data ?? []) as T[];
  const convos = new Map<string, T[]>();
  for (const r of rows) convos.set(r.from_number, [...(convos.get(r.from_number) ?? []), r]);
  const ids = <K extends keyof T>(k: K) => [...new Set(rows.map((r) => r[k]).filter(Boolean))] as string[];
  const [{ data: pros }, { data: profs }, { data: jobs }] = await Promise.all([
    ids("contractor_id").length ? db.from("contractors").select("id, contact_name, business_name").in("id", ids("contractor_id")) : Promise.resolve({ data: [] }),
    ids("profile_id").length ? db.from("profiles").select("id, full_name, email").in("id", ids("profile_id")) : Promise.resolve({ data: [] }),
    ids("job_id").length ? db.from("jobs").select("id, ref, contact_name").in("id", ids("job_id")) : Promise.resolve({ data: [] }),
  ]);
  const proName = new Map(((pros ?? []) as { id: string; contact_name: string; business_name: string }[]).map((p) => [p.id, p.contact_name || p.business_name]));
  const profName = new Map(((profs ?? []) as { id: string; full_name: string | null; email: string | null }[]).map((p) => [p.id, p.full_name || p.email || "Customer"]));
  const jobRef = new Map(((jobs ?? []) as { id: string; ref: string; contact_name: string }[]).map((j) => [j.id, j]));
  const list = [...convos.entries()].map(([num, msgs]) => {
    const inbound = msgs.filter((m) => m.direction === "in");
    const who = inbound.find((m) => m.contractor_id || m.profile_id) ?? inbound[0];
    const job = msgs.find((m) => m.job_id)?.job_id ?? null;
    const name = who?.contractor_id ? proName.get(who.contractor_id) : who?.profile_id ? profName.get(who.profile_id) : job ? jobRef.get(job)?.contact_name : null;
    const open = inbound.filter((m) => !m.handled_at);
    return { num, msgs: [...msgs].reverse().slice(-8), role: who?.matched_role ?? "unknown", name: name ?? null, job, open, last: msgs[0].created_at };
  }).sort((a, b) => (b.open.length ? 1 : 0) - (a.open.length ? 1 : 0) || b.last.localeCompare(a.last));
  const waiting = list.filter((c) => c.open.length).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="text-2xl font-bold">Texts</h1>
          <p className="text-sm text-ink-soft">Two-way texting with customers and pros. {waiting ? <b>{waiting} conversation{waiting === 1 ? "" : "s"} waiting on a reply.</b> : "Nothing waiting."} Texts about a job also appear in that job&apos;s messages. Last {all ? 60 : 14} days · <Link className="underline" href={all ? "/hub/texts" : "/hub/texts?all=1"}>{all ? "show 14 days" : "show 60 days"}</Link></p></div>
      </div>
      {(!smsConfigured() || error) && (
        <div className="card border-amber-300 bg-amber-50 text-sm">
          {error ? <p><b>Run supabase/setup/RUN_ONCE_LATEST_2026-10-12_0121.sql</b> in Supabase → SQL Editor to turn on the texts inbox ({error.message}).</p>
            : <p><b>Texting isn&apos;t set up yet.</b> In Vercel set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and TWILIO_MESSAGING_SERVICE_SID (or TWILIO_FROM), redeploy, then in Twilio set the number&apos;s “A message comes in” webhook to <code>{siteUrl()}/api/webhooks/twilio</code> (HTTP POST).</p>}
        </div>
      )}
      {!list.length ? <p className="card text-sm text-ink-soft">No texts yet. When a customer or pro texts the Handled number, it shows up here.</p> : (
        <div className="grid gap-4 lg:grid-cols-2">
          {list.map((c) => (
            <section key={c.num} className={`card space-y-3 ${c.open.length ? "border-brand" : ""}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div><b>{c.name ?? c.num}</b> {c.name && <span className="text-xs text-ink-soft">{c.num}</span>}{" "}
                  <Badge tone={c.role === "pro" ? "brand" : c.role === "customer" ? "green" : "slate"}>{c.role === "unknown" ? "unknown number" : c.role}</Badge>{" "}
                  {c.open.length > 0 && <Badge tone="amber">needs reply</Badge>}</div>
                {c.job && jobRef.get(c.job) && <Link className="text-sm font-semibold text-brand underline" href={`/hub/jobs/${c.job}`}>{jobRef.get(c.job)!.ref}</Link>}
              </div>
              <ul className="space-y-1.5 text-sm">{c.msgs.map((m) => (
                <li key={m.id} className={`max-w-[85%] rounded-xl px-3 py-1.5 ${m.direction === "out" ? "ml-auto bg-brand-tint" : "bg-paper"}`}>
                  <div className="whitespace-pre-wrap">{m.body || (m.media_count ? "(photo)" : "")}{m.media_count > 0 && m.body ? " 📎" : ""}</div>
                  <div className="text-[11px] text-ink-soft">{when(m.created_at)}{m.direction === "out" && m.sent_by ? ` · ${m.sent_by}` : ""}{m.direction === "in" && m.handled_at ? " · handled" : ""}</div>
                </li>
              ))}</ul>
              <TextReply to={c.num} jobId={c.job} inboxId={(c.open[0] ?? c.msgs.filter((m) => m.direction === "in").at(-1))?.id} handled={!c.open.length} unmatched={c.role === "unknown" && !c.job} />
            </section>
          ))}
        </div>
      )}
      <p className="text-xs text-ink-soft">Photos sent by text are counted (📎) — open Twilio → Messaging logs to view them. STOP / START are handled automatically and update the person&apos;s text preference.</p>
    </div>
  );
}
