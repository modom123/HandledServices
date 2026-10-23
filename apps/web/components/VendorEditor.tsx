/*
 * FILE    : apps/web/components/VendorEditor.tsx
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-23_2200 UTC
 * PURPOSE : Hub → Approved vendors: turn vendors on or off and add local suppliers (POST api/hub/vendors). Admins only.
 */
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type V = { id: string; name: string; match: string[]; groups: string[]; online: boolean; active: boolean };
const label = (g: string) => g.replace(/_/g, " ").replace("hvac", "HVAC");

async function save(v: Partial<V> & { name: string; match: string[]; groups: string[] }) {
  const r = await fetch("/api/hub/vendors", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(v) });
  return r.ok ? null : ((await r.json().catch(() => ({}))) as { error?: string }).error ?? "Failed";
}

export function VendorEditor({ vendors, groups, canEdit }: { vendors: V[]; groups: string[]; canEdit: boolean }) {
  const router = useRouter();
  const [msg, setMsg] = useState("");
  const [n, setN] = useState({ name: "", match: "", groups: [] as string[], online: false });
  return (
    <div className="space-y-4">
      <div className="card overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-xs text-ink-soft"><th className="p-3">Vendor</th><th className="p-3">Card statement names</th><th className="p-3">Supplies</th><th className="p-3">Online</th><th className="p-3">Approved</th></tr></thead>
          <tbody>
            {vendors.map((v) => (
              <tr key={v.id} className={`border-t border-line ${v.active ? "" : "opacity-50"}`}>
                <td className="p-3 font-semibold">{v.name}</td>
                <td className="p-3 text-xs">{v.match.join(", ")}</td>
                <td className="p-3 text-xs">{v.groups.map(label).join(", ")}</td>
                <td className="p-3">{v.online ? "yes" : "—"}</td>
                <td className="p-3"><input type="checkbox" checked={v.active} disabled={!canEdit} onChange={async (e) => { setMsg((await save({ ...v, active: e.target.checked })) ?? ""); router.refresh(); }} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {canEdit && (
        <div className="card space-y-2 text-sm">
          <div className="font-semibold">Add a supplier</div>
          <div className="grid gap-2 sm:grid-cols-2">
            <input className="input" placeholder="Name (e.g. Detroit Lumber Co.)" value={n.name} onChange={(e) => setN({ ...n, name: e.target.value })} />
            <input className="input" placeholder="Card statement names, comma-separated (e.g. detroit lumber)" value={n.match} onChange={(e) => setN({ ...n, match: e.target.value })} />
          </div>
          <div className="flex flex-wrap gap-1.5">{groups.map((g) => (
            <button key={g} type="button" onClick={() => setN({ ...n, groups: n.groups.includes(g) ? n.groups.filter((x) => x !== g) : [...n.groups, g] })} className={`rounded-full border px-2.5 py-0.5 text-xs ${n.groups.includes(g) ? "border-brand bg-brand text-white" : "border-line"}`}>{label(g)}</button>
          ))}</div>
          <label className="flex items-center gap-2"><input type="checkbox" checked={n.online} onChange={(e) => setN({ ...n, online: e.target.checked })} /> Online supplier (orders by phone or website allowed)</label>
          <button className="btn-primary" disabled={!n.name || !n.match.trim() || !n.groups.length} onClick={async () => {
            const err = await save({ name: n.name, match: n.match.split(",").map((x) => x.trim()).filter(Boolean), groups: n.groups, online: n.online, active: true });
            setMsg(err ?? "Added");
            if (!err) setN({ name: "", match: "", groups: [], online: false });
            router.refresh();
          }}>Add supplier</button>
          <p className="text-xs text-ink-soft">The statement name is what shows on the card charge — look at a receipt or a past swipe below. It matches whole words, so &quot;detroit lumber&quot; matches &quot;DETROIT LUMBER CO #2&quot;.</p>
        </div>
      )}
      {msg && <p className="text-sm text-ink-soft">{msg}</p>}
    </div>
  );
}
