/*
 * FILE    : apps/web/app/hub/find/page.tsx
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-12_0121 UTC
 * PURPOSE : Hub → find by ID: type H-1042 (job), C-10001 (customer), B-501 (business client), P-1001 (pro) or S-101
 *           (staff) in the box at the top of the Hub menu and go straight to it. Dashes and case don't matter.
 * UPDATED : 2026-11-05_0000 UTC — also finds people by name or email (customers, pros, staff, partners, business accounts)
 *           and opens their file; ?type=&key= shows a person's file here (staff and partners have no page of their own),
 *           so there's no separate Files menu item.
 */
import { redirect } from "next/navigation";
import Link from "next/link";
import { ID_KINDS, hubPathForId, normalizeId } from "@/lib/ids";
import { describeOwner, findPeople, parseOwner, type OwnerType } from "@/lib/person-files";
import { PersonFiles } from "@/components/PersonFiles";

/** Where a person opens: their own Hub page when they have one, else their file right here. */
const personHref = (type: OwnerType, key: string) =>
  type === "pro" ? `/hub/pros/${key}` : type === "customer" ? `/hub/customers/${encodeURIComponent(key)}` : type === "business" ? `/hub/business/${key}` : `/hub/find?type=${type}&key=${key}`;

export const dynamic = "force-dynamic";
export const metadata = { title: "Find" };

export default async function Find({ searchParams }: { searchParams: Promise<{ q?: string; type?: string; key?: string }> }) {
  const sp = await searchParams;
  const owner = sp.type && sp.key ? parseOwner(sp.type, sp.key) : null;
  if (owner) {
    const who = await describeOwner(owner);
    return (
      <div className="max-w-4xl space-y-4">
        <Link href="/hub/find" className="text-sm text-brand">← Find</Link>
        <div><h1 className="text-2xl font-bold">{who?.name ?? "Unknown person"}</h1><p className="text-sm text-ink-soft">{who?.sub ?? "Nobody has this record"}{who?.href && <> · <Link className="underline" href={who.href}>open their page</Link></>}</p></div>
        {who && <PersonFiles type={owner.type} ownerKey={owner.key} />}
      </div>
    );
  }
  const q = (sp.q ?? "").trim();
  const id = normalizeId(q);
  const path = id ? await hubPathForId(id).catch(() => null) : null;
  if (path) redirect(path);
  const people = q && !id ? await findPeople(q) : [];
  return (
    <div className="max-w-xl space-y-4">
      <h1 className="text-2xl font-bold">Find</h1><p className="text-sm text-ink-soft">An ID, a name or an email — customers, pros, staff, partners and business accounts.</p>
      <form className="flex gap-2" action="/hub/find"><input className="input" name="q" defaultValue={q} placeholder="H-1042, P-1001, a name or an email" autoFocus /><button className="btn-primary">Find</button></form>
      {q && id && <p className="card text-sm">Nothing has the ID <b>{id}</b>. Check the number, or run supabase/setup/RUN_ONCE_LATEST_2026-10-12_1525.sql if ID numbers aren&apos;t switched on yet.</p>}
      {q && !id && (people.length ? (
        <ul className="card divide-y divide-line p-0 text-sm">{people.map((p) => (
          <li key={`${p.type}:${p.key}`} className="flex flex-wrap items-center justify-between gap-2 p-3"><div><Link className="font-semibold text-brand underline" href={personHref(p.type, p.key)}>{p.name}</Link><div className="text-xs text-ink-soft">{p.sub}</div></div><Link className="text-xs underline" href={`/hub/find?type=${p.type}&key=${encodeURIComponent(p.key)}`}>Files</Link></li>
        ))}</ul>
      ) : <p className="card text-sm">Nobody matches “{q}”. Try part of a name, an email or an ID.</p>)}
      <ul className="text-sm text-ink-soft">{ID_KINDS.map(([k, label]) => <li key={k}><b className="font-mono text-ink">{k}-</b> {label}{k === "C" ? " — one per email, guests included" : k === "S" ? " — admins and dispatchers" : ""}</li>)}</ul>
    </div>
  );
}
