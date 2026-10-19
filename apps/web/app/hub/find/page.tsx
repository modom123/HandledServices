/*
 * FILE    : apps/web/app/hub/find/page.tsx
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-12_0121 UTC
 * PURPOSE : Hub → find by ID: type H-1042 (job), C-10001 (customer), B-501 (business client), P-1001 (pro) or S-101
 *           (staff) in the box at the top of the Hub menu and go straight to it. Dashes and case don't matter.
 */
import { redirect } from "next/navigation";
import Link from "next/link";
import { ID_KINDS, hubPathForId, normalizeId } from "@/lib/ids";

export const dynamic = "force-dynamic";
export const metadata = { title: "Find by ID" };

export default async function Find({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const q = ((await searchParams).q ?? "").trim();
  const id = normalizeId(q);
  const path = id ? await hubPathForId(id).catch(() => null) : null;
  if (path) redirect(path);
  return (
    <div className="max-w-xl space-y-4">
      <h1 className="text-2xl font-bold">Find by ID</h1>
      <form className="flex gap-2" action="/hub/find"><input className="input" name="q" defaultValue={q} placeholder="H-1042, C-10001, B-501, P-1001, S-101" autoFocus /><button className="btn-primary">Find</button></form>
      {q && <p className="card text-sm">{id ? <>Nothing has the ID <b>{id}</b>. Check the number, or run supabase/setup/RUN_ONCE_LATEST_2026-10-12_1525.sql if ID numbers aren&apos;t switched on yet.</> : <>“{q}” isn&apos;t an ID. IDs look like {ID_KINDS.map(([k, label]) => `${k}-… (${label.toLowerCase()})`).join(", ")}.</>}</p>}
      <ul className="text-sm text-ink-soft">{ID_KINDS.map(([k, label]) => <li key={k}><b className="font-mono text-ink">{k}-</b> {label}{k === "C" ? " — one per email, guests included" : k === "S" ? " — admins and dispatchers" : ""}</li>)}</ul>
      <p className="text-xs text-ink-soft">Looking for a name or email instead? Use <Link className="underline" href="/hub/customers">Customers</Link> or <Link className="underline" href="/hub/pros">Pro roster</Link>.</p>
    </div>
  );
}
