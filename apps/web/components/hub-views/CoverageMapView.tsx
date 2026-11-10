/*
 * FILE    : apps/web/components/hub-views/CoverageMapView.tsx
 * PROJECT : Handled — AI-run home & business services
 * CREATED : 2026-11-10_0415 UTC
 * PURPOSE : Hub → Pros & recruiting → Coverage map. A map of the United States showing where our pros are and which
 *           services we offer, so the team can see the network at a glance:
 *             • every pro with a location as a dot (active green, onboarding amber) and their service radius shaded
 *             • states shaded by active pros, outlined where we have an open market
 *             • filter by service (pros who do it) and status; hover a dot or a state for details
 *             • a state table, and for a chosen state: its markets, the services open there, how many active pros
 *               cover each, and the services with nobody yet (gaps)
 *           Drawn on the server as SVG (us-atlas Albers USA states + d3-geo), no map service or API key.
 *           No pay or money here, so dispatchers see it too. The layout (app/hub/map/page.tsx loads the data).
 */
import Link from "next/link";
import { feature } from "topojson-client";
import { geoAlbersUsa, geoPath } from "d3-geo";
import type { FeatureCollection, Geometry } from "geojson";
import us from "us-atlas/states-albers-10m.json";
import { SERVICES, getService } from "@handled/core";


export type Pro = { id: string; business_name: string; status: string; trades: string[] | null; base_lat: number | null; base_lng: number | null; base_zip: string | null; base_state: string | null; base_city: string | null; service_radius_mi: number | null };
export type Market = { id: string; name: string; state: string; active: boolean; launch_services: string[] | null };

const STATES: Record<string, string> = {
  AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California", CO: "Colorado", CT: "Connecticut", DE: "Delaware", DC: "District of Columbia",
  FL: "Florida", GA: "Georgia", HI: "Hawaii", ID: "Idaho", IL: "Illinois", IN: "Indiana", IA: "Iowa", KS: "Kansas", KY: "Kentucky", LA: "Louisiana", ME: "Maine",
  MD: "Maryland", MA: "Massachusetts", MI: "Michigan", MN: "Minnesota", MS: "Mississippi", MO: "Missouri", MT: "Montana", NE: "Nebraska", NV: "Nevada",
  NH: "New Hampshire", NJ: "New Jersey", NM: "New Mexico", NY: "New York", NC: "North Carolina", ND: "North Dakota", OH: "Ohio", OK: "Oklahoma", OR: "Oregon",
  PA: "Pennsylvania", RI: "Rhode Island", SC: "South Carolina", SD: "South Dakota", TN: "Tennessee", TX: "Texas", UT: "Utah", VT: "Vermont", VA: "Virginia",
  WA: "Washington", WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming",
};
const CODE_OF = Object.fromEntries(Object.entries(STATES).map(([c, n]) => [n, c]));
// us-atlas "albers" files are already projected to 975×610; this projection places lat/lng on the same canvas
const project = geoAlbersUsa().scale(1300).translate([487.5, 305]);
const path = geoPath();
const statesGeo = feature(us as never, (us as unknown as { objects: { states: never } }).objects.states) as unknown as FeatureCollection<Geometry, { name: string }>;

const isActive = (p: Pro) => p.status === "approved";
const doesService = (p: Pro, slug: string) => { const s = getService(slug); return Boolean(s && s.trades.some((t) => (p.trades ?? []).includes(t))); };

export default function CoverageMapView({ q, proRows, marketRows }: { q: { service?: string; status?: string; state?: string }; proRows: Pro[]; marketRows: Market[] }) {
  const service = q.service && getService(q.service) ? q.service : "";
  const status = q.status === "active" || q.status === "onboarding" ? q.status : "all";
  const pick = q.state && STATES[q.state.toUpperCase()] ? q.state.toUpperCase() : "";
  const all = proRows;
  const pros = all.filter((p) => (!service || doesService(p, service)) && (status === "all" || (status === "active" ? isActive(p) : !isActive(p))));
  const markets = marketRows.filter((m) => m.active);

  // by state
  type Row = { code: string; active: number; onboarding: number; noLocation: number; markets: Market[]; trades: Map<string, number> };
  const by = new Map<string, Row>();
  const row = (code: string) => { let r = by.get(code); if (!r) { r = { code, active: 0, onboarding: 0, noLocation: 0, markets: [], trades: new Map() }; by.set(code, r); } return r; };
  for (const p of pros) {
    const code = (p.base_state ?? "").toUpperCase();
    if (!STATES[code]) continue;
    const r = row(code);
    if (isActive(p)) r.active++; else r.onboarding++;
    if (p.base_lat == null || p.base_lng == null) r.noLocation++;
    for (const t of p.trades ?? []) r.trades.set(t, (r.trades.get(t) ?? 0) + 1);
  }
  for (const m of markets) if (STATES[m.state?.toUpperCase()]) row(m.state.toUpperCase()).markets.push(m);
  const maxActive = Math.max(1, ...[...by.values()].map((r) => r.active));
  const fill = (code: string) => {
    const r = by.get(code);
    if (!r || (!r.active && !r.onboarding)) return r?.markets.length ? "#eef6f1" : "#f4f1e8";
    if (!r.active) return "#fbefd5";
    const t = 0.14 + 0.36 * (r.active / maxActive); // light enough that the pro dots stand out
    return `rgba(15,107,80,${t.toFixed(2)})`;
  };

  // dots (pros with a location; pixels per mile on this projection ≈ 0.42)
  const dots = pros.flatMap((p) => {
    if (p.base_lat == null || p.base_lng == null) return [];
    const xy = project([Number(p.base_lng), Number(p.base_lat)]);
    return xy ? [{ p, x: xy[0], y: xy[1], r: Math.max(3, Math.min(60, Number(p.service_radius_mi ?? 25) * 0.42)) }] : [];
  });

  const totals = { active: pros.filter(isActive).length, onboarding: pros.filter((p) => !isActive(p)).length, states: [...by.values()].filter((r) => r.active).length, located: dots.length };
  const servicesOpen = (code: string) => {
    const ms = by.get(code)?.markets ?? [];
    if (!ms.length) return [] as string[];
    if (ms.some((m) => !m.launch_services?.length)) return SERVICES.map((s) => s.slug); // a market with no list = every service
    return [...new Set(ms.flatMap((m) => m.launch_services ?? []))];
  };
  const stateRows = [...by.values()].sort((a, b) => b.active - a.active || b.onboarding - a.onboarding || a.code.localeCompare(b.code));
  const href = (o: Record<string, string>) => `/hub/map?${new URLSearchParams(Object.entries({ service, status, state: pick, ...o }).filter(([, v]) => v && v !== "all")).toString()}`;
  const picked = pick ? by.get(pick) : undefined;
  const pickedServices = pick ? servicesOpen(pick).map((slug) => ({ slug, name: getService(slug)?.name ?? slug, active: all.filter((p) => isActive(p) && (p.base_state ?? "").toUpperCase() === pick && doesService(p, slug)).length })).sort((a, b) => a.active - b.active || a.name.localeCompare(b.name)) : [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Coverage map</h1>
          <p className="text-sm text-ink-soft">{totals.active} active pro{totals.active === 1 ? "" : "s"} · {totals.onboarding} onboarding · {totals.states} state{totals.states === 1 ? "" : "s"} with active pros · {markets.length} open market{markets.length === 1 ? "" : "s"}{totals.located < pros.length ? ` · ${pros.length - totals.located} without a location yet` : ""}</p>
        </div>
        <form className="flex flex-wrap items-center gap-2 text-sm" action="/hub/map">
          <select name="service" defaultValue={service} className="input w-56">
            <option value="">All services</option>
            {SERVICES.map((s) => [s.slug, s.name] as const).sort((a, b) => a[1].localeCompare(b[1])).map(([slug, name]) => <option key={slug} value={slug}>{name}</option>)}
          </select>
          <select name="status" defaultValue={status} className="input w-52">
            <option value="all">Active + onboarding</option><option value="active">Active only</option><option value="onboarding">Onboarding only</option>
          </select>
          {pick && <input type="hidden" name="state" value={pick} />}
          <button className="btn-primary">Show</button>
        </form>
      </div>

      <div className="card overflow-hidden p-2">
        <svg viewBox="0 0 975 610" className="h-auto w-full" role="img" aria-label="Map of the United States with Handled pros and service areas">
          {statesGeo.features.map((f) => {
            const code = CODE_OF[f.properties.name] ?? "";
            const r = by.get(code);
            const tip = `${f.properties.name}: ${r?.active ?? 0} active, ${r?.onboarding ?? 0} onboarding${r?.markets.length ? ` · markets: ${r.markets.map((m) => m.name).join(", ")}` : ""}`;
            return (
              <a key={f.properties.name} href={href({ state: code })}>
                <path d={path(f) ?? ""} fill={fill(code)} stroke={r?.markets.length ? "#c4993a" : "#ffffff"} strokeWidth={r?.markets.length ? 1.6 : 0.8} className="cursor-pointer hover:opacity-80"><title>{tip}</title></path>
              </a>
            );
          })}
          {dots.map(({ p, x, y, r }) => <circle key={`r${p.id}`} cx={x} cy={y} r={r} fill={isActive(p) ? "rgba(15,107,80,0.12)" : "rgba(196,153,58,0.12)"} stroke="none" />)}
          {dots.map(({ p, x, y }) => (
            <a key={p.id} href={`/hub/pros/${p.id}`}>
              <circle cx={x} cy={y} r={4} fill={isActive(p) ? "#0f6b50" : "#c4993a"} stroke="#fff" strokeWidth={1.2} className="cursor-pointer">
                <title>{`${p.business_name} · ${isActive(p) ? "active" : "onboarding"} · ${[p.base_city, p.base_state].filter(Boolean).join(", ")} · ${p.service_radius_mi ?? 25} mi · ${(p.trades ?? []).join(", ")}`}</title>
              </circle>
            </a>
          ))}
        </svg>
        <div className="flex flex-wrap items-center gap-4 px-2 pb-1 pt-2 text-xs text-ink-soft">
          <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded-full bg-[#0f6b50]" /> Active pro</span>
          <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded-full bg-[#c4993a]" /> Onboarding</span>
          <span className="flex items-center gap-1"><span className="inline-block h-3 w-5 rounded-sm bg-[rgba(15,107,80,0.4)]" /> State shade = active pros</span>
          <span className="flex items-center gap-1"><span className="inline-block h-3 w-5 rounded-sm border-2 border-[#c4993a]" /> Open market</span>
          <span>Shaded circle = service radius · click a state or a pro</span>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_1.1fr]">
        <section className="card overflow-x-auto p-0">
          <div className="border-b border-line px-4 py-3 font-bold">By state</div>
          {!stateRows.length && <p className="px-4 py-6 text-center text-sm text-ink-soft">No pros or markets yet{service ? " for this service" : ""}.</p>}
          {stateRows.length > 0 && <table className="w-full text-sm">
            <thead className="bg-paper text-left text-xs uppercase tracking-wide text-ink-soft"><tr><th className="p-2 pl-4">State</th><th className="p-2">Active</th><th className="p-2">Onboarding</th><th className="p-2">Markets</th><th className="p-2">Services open</th></tr></thead>
            <tbody>{stateRows.map((r) => (
              <tr key={r.code} className={`border-t border-line ${r.code === pick ? "bg-brand-tint" : ""}`}>
                <td className="p-2 pl-4"><Link href={href({ state: r.code })} className="font-semibold underline">{STATES[r.code]}</Link></td>
                <td className="p-2 font-semibold">{r.active}</td><td className="p-2">{r.onboarding}</td>
                <td className="p-2 text-xs">{r.markets.map((m) => m.name).join(", ") || "—"}</td>
                <td className="p-2">{servicesOpen(r.code).length || "—"}</td>
              </tr>
            ))}</tbody>
          </table>}
        </section>

        <section className="card p-0">
          <div className="flex items-center justify-between border-b border-line px-4 py-3"><span className="font-bold">{pick ? STATES[pick] : "Pick a state"}</span>{pick && <Link href={href({ state: "" })} className="text-xs text-brand underline">Clear</Link>}</div>
          {!pick && <p className="px-4 py-6 text-sm text-ink-soft">Click a state on the map or in the table to see its markets, the services open there, and which ones have no active pro yet.</p>}
          {pick && (
            <div className="space-y-3 px-4 py-3 text-sm">
              <div>{picked?.active ?? 0} active · {picked?.onboarding ?? 0} onboarding{picked?.noLocation ? ` · ${picked.noLocation} without a location on the map` : ""} · markets: {picked?.markets.map((m) => m.name).join(", ") || "none yet"}</div>
              {!pickedServices.length && <p className="text-ink-soft">No open market here yet, so no services are open. Pros here can still be recruited ahead of a launch.</p>}
              {pickedServices.length > 0 && (
                <>
                  <div className="font-semibold">Services open ({pickedServices.length}) <span className="font-normal text-ink-soft">· {pickedServices.filter((x) => !x.active).length} with no active pro</span></div>
                  <div className="flex max-h-80 flex-wrap gap-1.5 overflow-y-auto">
                    {pickedServices.map((x) => (
                      <Link key={x.slug} href={href({ service: x.slug })} className={`rounded-full border px-2.5 py-1 text-xs ${x.active ? "border-brand/30 bg-brand-tint text-brand-dark" : "border-rose-200 bg-rose-50 text-rose-800"}`}>
                        {x.name} <b>{x.active}</b>
                      </Link>
                    ))}
                  </div>
                  <p className="text-xs text-ink-soft">Red = open to customers here but no active pro yet (recruit for it in Pros &amp; recruiting → Depth chart / Supply gaps).</p>
                </>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
