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
 * UPDATED : 2026-11-10_0700 UTC — click a state: every pro there with the services they offer (★ starter / cleared / not cleared), and the state's depth chart (filled / thin / open per service, linked to /hub/depth for that state).
 */
import Link from "next/link";
import { feature } from "topojson-client";
import { geoAlbersUsa, geoPath } from "d3-geo";
import type { FeatureCollection, Geometry } from "geojson";
import us from "us-atlas/states-albers-10m.json";
import { SERVICES, getService, type Position } from "@handled/core";


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

export default function CoverageMapView({ q, proRows, marketRows, depth = [] }: { q: { service?: string; status?: string; state?: string }; proRows: Pro[]; marketRows: Market[]; depth?: Position[] }) {
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
  // every pro based in the clicked state (the service / status filters apply), with the services they can offer
  const statePros = pick ? pros.filter((p) => (p.base_state ?? "").toUpperCase() === pick).sort((a, b) => Number(isActive(b)) - Number(isActive(a)) || a.business_name.localeCompare(b.business_name)) : [];
  const offers = (p: Pro) => SERVICES.filter((s) => doesService(p, s.slug)).map((s) => ({ slug: s.slug, name: s.name }));
  // the state's depth chart: open services first (or, with no market yet, every position someone could play)
  const pos = new Map(depth.map((d) => [d.slug, d]));
  const depthHref = (slug?: string) => `/hub/depth?state=${pick}${slug ? `&service=${slug}` : ""}`;
  const positions = pick ? (pickedServices.length ? pickedServices.map((x) => pos.get(x.slug)).filter((d): d is Position => Boolean(d)) : depth.filter((d) => d.projected.length > 0))
    .sort((a, b) => ({ open: 0, thin: 1, covered: 2 }[a.status] - { open: 0, thin: 1, covered: 2 }[b.status]) || Number(b.focus) - Number(a.focus) || a.name.localeCompare(b.name)) : [];
  const DEPTH_CLS = { covered: "border-emerald-300 bg-emerald-50 text-emerald-900", thin: "border-amber-300 bg-amber-50 text-amber-900", open: "border-rose-300 bg-rose-50 text-rose-900" } as const;

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
          {!pick && <p className="px-4 py-6 text-sm text-ink-soft">Click a state on the map or in the table to see every pro there with the services they offer, and the state&apos;s depth chart: which services are filled, thin or open.</p>}
          {pick && (
            <div className="space-y-4 px-4 py-3 text-sm">
              <div>{picked?.active ?? 0} active · {picked?.onboarding ?? 0} onboarding{picked?.noLocation ? ` · ${picked.noLocation} without a location on the map` : ""} · markets: {picked?.markets.map((m) => m.name).join(", ") || "none yet"}</div>

              {/* the state's depth chart: each service is a position; open and thin ones first */}
              <div>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-semibold">Depth chart{pickedServices.length ? ` · ${pickedServices.length} services open` : " · no open market yet"}</span>
                  <Link href={depthHref()} className="text-xs font-semibold text-brand underline">Full depth chart for {STATES[pick]} →</Link>
                </div>
                {!positions.length && <p className="mt-1 text-ink-soft">{pickedServices.length ? "No positions yet." : "No open market here and no pros who could play a position yet. Recruit ahead of a launch."}</p>}
                {positions.length > 0 && (
                  <>
                    <p className="mt-1 text-xs text-ink-soft">{positions.filter((d) => d.status === "covered").length} filled · {positions.filter((d) => d.status === "thin").length} thin · {positions.filter((d) => d.status === "open").length} open{!pickedServices.length ? " (positions pros here could play, ahead of a launch)" : ""}</p>
                    <div className="mt-2 flex max-h-72 flex-wrap gap-1.5 overflow-y-auto">
                      {positions.map((d) => (
                        <Link key={d.slug} href={depthHref(d.slug)} title={d.depth[0] ? `Starter: ${d.depth[0].name}${d.depth.length > 1 ? ` · backups: ${d.depth.slice(1).map((x) => x.name).join(", ")}` : ""}` : d.projected[0] ? `Nobody cleared yet · next up: ${d.projected[0].name}` : "Nobody yet"} className={`rounded-full border px-2.5 py-1 text-xs ${DEPTH_CLS[d.status]}`}>
                          {d.name} <b>{d.depth.length}/{d.target}</b>
                        </Link>
                      ))}
                    </div>
                    <p className="mt-1 text-xs text-ink-soft">Green filled · amber thin (needs backups) · red open (nobody cleared). Counts are cleared pros / depth needed. Click one for its starter and bench.</p>
                  </>
                )}
              </div>

              {/* every pro based here, with the services they can offer */}
              <div>
                <div className="font-semibold">Pros in {STATES[pick]} ({statePros.length}){service ? <span className="font-normal text-ink-soft"> · doing {getService(service)?.name}</span> : null}</div>
                {!statePros.length && <p className="mt-1 text-ink-soft">No pros based here{service || status !== "all" ? " for this filter" : " yet"}.</p>}
                <ul className="mt-2 max-h-[28rem] space-y-2 overflow-y-auto pr-1">
                  {statePros.map((p) => {
                    const list = offers(p);
                    return (
                      <li key={p.id} className="rounded-lg border border-line p-2.5">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <Link href={`/hub/pros/${p.id}`} className="font-semibold underline">{p.business_name}</Link>
                          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${isActive(p) ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-900"}`}>{isActive(p) ? "active" : "onboarding"}</span>
                        </div>
                        <div className="text-xs text-ink-soft">{[p.base_city, p.base_zip].filter(Boolean).join(" ") || "no address yet"} · {p.service_radius_mi ?? 25} mi radius{p.base_lat == null ? " · not on the map yet" : ""}</div>
                        {list.length ? (
                          <details className="mt-1.5">
                            <summary className="cursor-pointer text-xs font-semibold text-brand">{list.length} service{list.length === 1 ? "" : "s"} offered</summary>
                            <div className="mt-1.5 flex flex-wrap gap-1">{list.map((s) => {
                              const d = pos.get(s.slug); const slot = d ? d.depth.findIndex((x) => x.id === p.id) : -1;
                              return <Link key={s.slug} href={depthHref(s.slug)} title={slot === 0 ? "Starter here" : slot > 0 ? `Backup ${slot} here` : "Not cleared for this one yet (open its depth chart for why)"} className={`rounded-full border px-2 py-0.5 text-xs ${slot === 0 ? "border-emerald-300 bg-emerald-50 text-emerald-900" : slot > 0 ? "border-emerald-200 bg-white text-emerald-900" : "border-line bg-paper text-ink-soft"}`}>{slot === 0 ? "★ " : ""}{s.name}</Link>;
                            })}</div>
                          </details>
                        ) : <div className="mt-1 text-xs text-ink-soft">No trades set yet.</div>}
                      </li>
                    );
                  })}
                </ul>
                <p className="mt-1 text-xs text-ink-soft">★ = starter for that service in {STATES[pick]}. Grey = has the trade but isn&apos;t cleared for it yet.</p>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
