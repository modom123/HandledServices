/*
 * FILE    : apps/web/components/AccountingUI.tsx
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-06_2225 UTC
 * PURPOSE : Hub → Accounting (Xero) controls: connect / disconnect, sync start date and "mark reconciled",
 *           push now, the account mapping (save, check against Xero, create missing accounts) and the day preview.
 *           Everything posts to /api/hub/accounting (admins only).
 */
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

async function post<T = Record<string, unknown>>(body: unknown): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  const r = await fetch("/api/hub/accounting", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  return r.ok ? { ok: true, data: j as T } : { ok: false, error: String(j.error ?? "Failed") };
}

type SyncResult = { invoices: { made: number; voided: number; errors: string[] }; days: { day: string; status: string; docs: number; errors: string[] }[] };

function summary(r: SyncResult) {
  const done = r.days.filter((d) => d.status === "done").length, empty = r.days.filter((d) => d.status === "empty").length;
  const bad = r.days.filter((d) => d.status === "error" || d.status === "waiting");
  return [
    `${done} day(s) booked${empty ? `, ${empty} with no Stripe activity` : ""}`,
    r.invoices.made ? `${r.invoices.made} invoice(s) sent` : "",
    bad.length ? `problems: ${bad.map((d) => `${d.day} (${d.errors.join("; ")})`).join(" · ")}` : "",
    r.invoices.errors.length ? `invoice problems: ${r.invoices.errors.join(" · ")}` : "",
  ].filter(Boolean).join(" — ") || "Nothing due.";
}

export function AccountingControls({ admin, connected, syncFrom, reconciled }: { admin: boolean; connected: boolean; syncFrom: string; reconciled: boolean }) {
  const router = useRouter();
  const [from, setFrom] = useState(syncFrom);
  const [rec, setRec] = useState(reconciled);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (!admin) return <p className="text-ink-soft">{connected ? "Xero is connected." : "Xero isn't connected yet."} Only admins can change this.</p>;
  if (!connected) return <a className="btn-primary inline-block" href="/api/xero/connect">Connect Xero</a>;
  const run = async (body: unknown, done?: (d: Record<string, unknown>) => string) => {
    setBusy(true); setMsg(null);
    const r = await post(body);
    setBusy(false);
    setMsg(r.ok ? (done ? done(r.data) : "Saved.") : r.error);
    router.refresh();
  };
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-xs text-ink-soft">Book Stripe activity from<input className="input mt-1" type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
        <label className="flex items-center gap-2 text-xs text-ink-soft"><input type="checkbox" checked={rec} onChange={(e) => setRec(e.target.checked)} />Mark Stripe-account entries reconciled (Stripe is the source of truth)</label>
        <button className="btn-ghost" disabled={busy} onClick={() => run({ action: "save", sync_from: from || null, reconciled: rec })}>Save</button>
      </div>
      <div className="flex flex-wrap gap-2">
        <button className="btn-primary" disabled={busy} onClick={() => run({ action: "sync" }, (d) => summary(d as unknown as SyncResult))}>{busy ? "Working…" : "Push everything due now"}</button>
        <a className="btn-ghost" href="/api/xero/connect">Reconnect</a>
        <button className="btn-ghost" disabled={busy} onClick={() => { if (confirm("Disconnect Xero? Nothing is deleted in Xero; the daily push stops until you reconnect.")) run({ action: "disconnect" }, () => "Disconnected."); }}>Disconnect</button>
      </div>
      {msg && <p className="text-sm">{msg}</p>}
    </div>
  );
}

type MapRow = { key: string; code: string; name: string; type: string; help: string };
type Check = { key: string; code: string; found: { name: string; type: string; status: string } | null; typeOk: boolean };

export function AccountMapping({ admin, connected, rows }: { admin: boolean; connected: boolean; rows: MapRow[] }) {
  const router = useRouter();
  const [codes, setCodes] = useState<Record<string, string>>(Object.fromEntries(rows.map((r) => [r.key, r.code])));
  const [checks, setChecks] = useState<Record<string, Check>>({});
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true); setMsg(null);
    const r = await post({ action: "save", accounts: codes });
    setBusy(false); setMsg(r.ok ? "Mapping saved." : r.error); router.refresh();
  };
  const check = async () => {
    setBusy(true); setMsg(null);
    const r = await post<{ accounts: Check[] }>({ action: "check" });
    setBusy(false);
    if (!r.ok) return setMsg(r.error);
    setChecks(Object.fromEntries(r.data.accounts.map((c) => [c.key, c])));
    const missing = r.data.accounts.filter((c) => !c.found).length, wrong = r.data.accounts.filter((c) => !c.typeOk).length;
    setMsg(missing || wrong ? `${missing} missing, ${wrong} with the wrong type.` : "Every account is in Xero.");
  };
  const create = async () => {
    setBusy(true); setMsg(null);
    const s = await post({ action: "save", accounts: codes });
    if (!s.ok) { setBusy(false); return setMsg(s.error); }
    const r = await post<{ created: string[] }>({ action: "create_accounts" });
    setBusy(false);
    setMsg(r.ok ? (r.data.created.length ? `Created in Xero: ${r.data.created.join(", ")}` : "Nothing to create — every account exists.") : r.error);
    if (r.ok) await check();
  };
  return (
    <div className="space-y-3">
      <div className="overflow-x-auto"><table className="w-full text-sm">
        <thead><tr className="text-left text-xs text-ink-soft"><th className="p-2">Money</th><th className="p-2">Xero code</th><th className="p-2">Type</th><th className="p-2">In Xero</th></tr></thead>
        <tbody>{rows.map((r) => {
          const c = checks[r.key];
          return (
            <tr key={r.key} className="border-t border-line align-top">
              <td className="max-w-md p-2"><div className="font-medium">{r.name}</div><div className="text-xs text-ink-soft">{r.help}</div></td>
              <td className="p-2"><input className="input w-28" value={codes[r.key] ?? ""} disabled={!admin} placeholder={r.key === "checking_bank" ? "e.g. 090" : ""} onChange={(e) => setCodes({ ...codes, [r.key]: e.target.value })} /></td>
              <td className="p-2 text-xs text-ink-soft">{r.type}</td>
              <td className="p-2 text-xs">{!c ? "—" : c.found ? <span className={c.typeOk ? "text-emerald-700" : "text-rose-700"}>{c.found.name} ({c.found.type}){c.typeOk ? "" : " — wrong type"}</span> : <span className="text-amber-700">{c.code ? "missing" : "not set"}</span>}</td>
            </tr>
          );
        })}</tbody>
      </table></div>
      {admin && (
        <div className="flex flex-wrap gap-2">
          <button className="btn-ghost" disabled={busy} onClick={save}>Save mapping</button>
          <button className="btn-ghost" disabled={busy || !connected} onClick={check}>Check against Xero</button>
          <button className="btn-primary" disabled={busy || !connected} onClick={create}>Create missing accounts</button>
        </div>
      )}
      {msg && <p className="text-sm">{msg}</p>}
    </div>
  );
}

type Line = { account: string; amount: number };
type Preview = { day: string; count: number; stripeNet: number; waiting: string[]; receive: Line[]; spend: Line[]; pros: { pro: string; lines: Line[] }[]; payouts: { id: string; amount: number; arrival: string }[]; invoicePayments: { invoice: string; amount: number }[] };

const yesterday = () => { const d = new Date(Date.now() - 86400000); return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Detroit" }).format(d); };
const usd = (n: number) => `$${n.toFixed(2)}`;

function Lines({ title, lines }: { title: string; lines: Line[] }) {
  if (!lines.length) return null;
  return (
    <div><div className="font-semibold">{title} <span className="font-normal text-ink-soft">{usd(lines.reduce((t, l) => t + l.amount, 0))}</span></div>
      <ul className="ml-4 list-disc text-ink-soft">{lines.map((l, i) => <li key={i}>{l.account}: {usd(l.amount)}</li>)}</ul></div>
  );
}

export function DayPreview({ admin, connected }: { admin: boolean; connected: boolean }) {
  const router = useRouter();
  const [day, setDay] = useState(yesterday());
  const [p, setP] = useState<Preview | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (!admin) return <p className="text-ink-soft">Admins only.</p>;
  const preview = async () => {
    setBusy(true); setMsg(null); setP(null);
    const r = await post<{ preview: Preview }>({ action: "preview", day });
    setBusy(false);
    if (r.ok) setP(r.data.preview); else setMsg(r.error);
  };
  const push = async () => {
    setBusy(true); setMsg(null);
    const r = await post({ action: "sync", day });
    setBusy(false);
    setMsg(r.ok ? summary(r.data as unknown as SyncResult) : r.error);
    router.refresh();
  };
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-2">
        <label className="text-xs text-ink-soft">Day<input className="input mt-1" type="date" value={day} max={yesterday()} onChange={(e) => setDay(e.target.value)} /></label>
        <button className="btn-ghost" disabled={busy} onClick={preview}>Preview</button>
        <button className="btn-primary" disabled={busy || !connected} onClick={push}>Push this day to Xero</button>
      </div>
      {msg && <p className="text-sm">{msg}</p>}
      {p && (
        <div className="space-y-2 rounded-lg bg-paper p-3">
          <div>{p.count} Stripe item(s) · Stripe net for the day {usd(p.stripeNet)}</div>
          {p.waiting.length > 0 && <div className="text-rose-700">Can&apos;t book yet: {p.waiting.join("; ")}</div>}
          <Lines title="Money in (one receive entry)" lines={p.receive} />
          <Lines title="Money out (one spend entry)" lines={p.spend} />
          {p.pros.map((x) => <Lines key={x.pro} title={`Pro payout — ${x.pro}`} lines={x.lines} />)}
          {p.payouts.map((x) => <div key={x.id}>{x.amount >= 0 ? "Payout Stripe → checking" : "Transfer checking → Stripe"} {usd(Math.abs(x.amount))} · arrives {x.arrival}</div>)}
          {p.invoicePayments.map((x, i) => <div key={i}>Payment on invoice {x.invoice}: {usd(x.amount)}</div>)}
          {!p.count && <div className="text-ink-soft">No Stripe activity that day.</div>}
        </div>
      )}
    </div>
  );
}
