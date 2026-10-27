/*
 * FILE    : apps/web/components/Crew.tsx
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-03_1311 UTC
 * PURPOSE : Crew accounts, pro side: sign the Crew Addendum, add / remove crew members, and pick who
 *           goes to a job. English and Spanish.
 * UPDATED : 2026-10-04_2204 UTC — the job sheet shows a customer's crew member request (preselected; the owner decides).
 * UPDATED : 2026-10-27_2141 UTC — CompanyPrefsForm (just me / crew, does the owner go to jobs, what customers see) and
 *           RosterQuickAdd (people listed on the application, one click to add with a background check). CrewPicker
 *           drops "Me" when the owner doesn't go to jobs.
 */
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ACCOUNT_TYPES, CREW_ROLES, CUSTOMER_DISPLAY, OWNER_ON_SITE, TRADES, t as tr, type AccountType, type CrewRole, type CustomerDisplay, type OwnerOnSite, type RosterEntry } from "@handled/core";

const PREFS_ES: Record<string, [string, string]> = {
  solo: ["Solo yo", "Usted hace cada trabajo."],
  crew: ["Mi empresa envía un equipo", "Registra a su gente; cada persona pasa nuestra verificación de antecedentes. Su empresa los dirige y les paga."],
  always: ["Voy a todos los trabajos", "Su equipo trabaja con usted."],
  sometimes: ["Yo o mi equipo", "Usted elige quién va, trabajo por trabajo."],
  never: ["Mi equipo hace los trabajos", "Usted lleva la oficina: elija a alguien de su equipo para cada trabajo antes de empezar."],
  person: ["Mi nombre de pila", "Los clientes ven “Miguel · Atkins & Sons”."],
  company: ["El nombre de mi empresa", "Los clientes ven “Atkins & Sons” y el nombre de pila de quien vaya."],
};

/** How the company works with us. Shown on My crew; the same choices as the application. */
export function CompanyPrefsForm({ es, value }: { es: boolean; value: { account_type: AccountType; owner_on_site: OwnerOnSite; customer_display: CustomerDisplay } }) {
  const router = useRouter();
  const [f, setF] = useState(value);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const L = (o: { id: string; label: string; help: string }) => (es ? PREFS_ES[o.id] : [o.label, o.help]);
  const group = <K extends keyof typeof f>(k: K, title: string, opts: { id: string; label: string; help: string }[]) => (
    <div><div className="label">{title}</div>
      <div className="grid gap-2 sm:grid-cols-3">{opts.map((o) => (
        <button key={o.id} type="button" onClick={() => setF({ ...f, [k]: o.id })} className={`rounded-xl border p-2 text-left text-sm ${f[k] === o.id ? "border-brand bg-brand-tint" : "border-line"}`}>
          <div className="font-semibold">{L(o)[0]}</div><div className="text-xs text-ink-soft">{L(o)[1]}</div></button>
      ))}</div></div>
  );
  const changed = f.account_type !== value.account_type || f.owner_on_site !== value.owner_on_site || f.customer_display !== value.customer_display;
  return (
    <div className="space-y-3">
      {group("account_type", es ? "¿Quién hace el trabajo?" : "Who does the work?", ACCOUNT_TYPES)}
      {f.account_type === "crew" && group("owner_on_site", es ? "¿Usted va a los trabajos?" : "Do you go to jobs?", OWNER_ON_SITE)}
      {group("customer_display", es ? "Los clientes ven" : "Customers see", CUSTOMER_DISPLAY)}
      <button className="btn-ghost" disabled={busy || !changed} onClick={async () => {
        setBusy(true); setMsg("");
        const e = await post("/api/pro/crew", { action: "prefs", ...f, owner_on_site: f.account_type === "solo" ? "always" : f.owner_on_site });
        setBusy(false);
        if (e) setMsg(e); else router.refresh();
      }}>{es ? "Guardar" : "Save"}</button>
      {msg && <p className="text-sm text-rose-700">{msg}</p>}
    </div>
  );
}

/** Someone listed on the application: add them for real (their background check goes out right away). */
export function RosterQuickAdd({ es, entry, trades }: { es: boolean; entry: RosterEntry; trades: string[] }) {
  const router = useRouter();
  const [email, setEmail] = useState(entry.email ?? "");
  const [license, setLicense] = useState(entry.license_number ?? "");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <li className="flex flex-wrap items-center gap-2 py-2 text-sm">
      <b>{entry.full_name}</b> · {roleLabel(entry.role, es)}
      <input className="input max-w-[14rem] py-1" type="email" placeholder={es ? "Correo" : "Email"} value={email} onChange={(e) => setEmail(e.target.value)} />
      {entry.role === "licensed" && <input className="input max-w-[10rem] py-1" placeholder={es ? "Licencia" : "License #"} value={license} onChange={(e) => setLicense(e.target.value)} />}
      <button className="btn-ghost px-3 py-1 text-xs" disabled={busy || !email.includes("@") || (entry.role === "licensed" && !license.trim())} onClick={async () => {
        setBusy(true); setMsg("");
        const e = await post("/api/pro/crew", { action: "add", full_name: entry.full_name, email, phone: entry.phone || null, locale: es ? "es" : "en", role: entry.role, trades, license_number: license.trim() || null });
        setBusy(false);
        if (e) setMsg(e); else router.refresh();
      }}>{es ? "Agregar y enviar verificación" : "Add and send check"}</button>
      {msg && <span className="text-rose-700">{msg}</span>}
    </li>
  );
}

async function post(url: string, body: unknown) {
  const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  return r.ok && j.ok !== false ? null : String(j.error ?? "Try again");
}

export const ROLE_ES: Record<CrewRole, [string, string]> = {
  lead: ["Jefe de cuadrilla", "Hace trabajos por su cuenta para su empresa (trabajo sin licencia)."],
  licensed: ["Técnico con licencia", "Tiene su propia licencia de oficio de Michigan (oficial o maestro)."],
  apprentice: ["Aprendiz", "Aprendiz registrado; trabaja con un técnico con licencia en trabajos con licencia."],
  helper: ["Ayudante", "Va con usted o con un jefe de cuadrilla; nunca va solo."],
};
export const roleLabel = (r: CrewRole, es: boolean) => (es ? ROLE_ES[r][0] : CREW_ROLES.find((x) => x.id === r)!.label);

export function CrewSign({ es }: { es: boolean }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [agree, setAgree] = useState(false);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <div className="space-y-3">
      <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-1" />
        <span>{es ? "Leí y acepto el " : "I’ve read and agree to the "}<a href={`/terms/pro-crew-addendum${es ? "?lang=es" : ""}`} target="_blank" className="text-brand underline">{es ? "Anexo de Equipo de Trabajo" : "Crew Addendum"}</a>{es ? ". Confirmo que cada persona que registre tiene permiso legal para trabajar en los EE. UU. y que mi empresa se encarga de su I-9, nómina y seguro de accidentes laborales." : ". I confirm everyone I list is legally allowed to work in the U.S., and my company handles their I-9, payroll and workers’ comp."}</span></label>
      <div className="flex flex-wrap gap-2">
        <input className="input max-w-xs" placeholder={es ? "Su nombre completo (firma)" : "Your full name (signature)"} value={name} onChange={(e) => setName(e.target.value)} />
        <button className="btn-primary" disabled={busy || !agree || name.trim().length < 2} onClick={async () => { setBusy(true); const e = await post("/api/pro/crew", { action: "sign", signer_name: name, agree: true }); setBusy(false); if (e) setMsg(e); else router.refresh(); }}>{es ? "Firmar" : "Sign"}</button>
      </div>
      {msg && <p className="text-sm text-rose-700">{msg}</p>}
    </div>
  );
}

export function CrewAdd({ es, trades }: { es: boolean; trades: string[] }) {
  const router = useRouter();
  const blank = { full_name: "", email: "", phone: "", locale: es ? "es" : "en", role: "lead" as CrewRole, trades: [...trades.slice(0, 1)], years_experience: "", license_number: "" };
  const [f, setF] = useState(blank);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f, v: unknown) => setF({ ...f, [k]: v });
  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-2">
        <input className="input" placeholder={es ? "Nombre completo" : "Full name"} value={f.full_name} onChange={(e) => set("full_name", e.target.value)} />
        <input className="input" type="email" placeholder={es ? "Correo (recibe el enlace de verificación)" : "Email (gets the background check link)"} value={f.email} onChange={(e) => set("email", e.target.value)} />
        <input className="input" placeholder={es ? "Teléfono" : "Phone"} value={f.phone} onChange={(e) => set("phone", e.target.value)} />
        <select className="input" value={f.locale} onChange={(e) => set("locale", e.target.value)}><option value="en">English</option><option value="es">Español</option></select>
        <select className="input" value={f.role} onChange={(e) => set("role", e.target.value)}>{CREW_ROLES.map((r) => <option key={r.id} value={r.id}>{roleLabel(r.id, es)}</option>)}</select>
        <input className="input" inputMode="numeric" placeholder={es ? "Años de experiencia" : "Years of experience"} value={f.years_experience} onChange={(e) => set("years_experience", e.target.value.replace(/\D/g, ""))} />
        {f.role === "licensed" && <input className="input sm:col-span-2" placeholder={es ? "Número de licencia de Michigan" : "Michigan license number"} value={f.license_number} onChange={(e) => set("license_number", e.target.value)} />}
      </div>
      <p className="text-xs text-ink-soft">{es ? ROLE_ES[f.role][1] : CREW_ROLES.find((r) => r.id === f.role)!.help}</p>
      {trades.length > 1 && (
        <div className="flex flex-wrap gap-3 text-sm">{trades.map((t) => (
          <label key={t} className="flex items-center gap-1"><input type="checkbox" checked={f.trades.includes(t)} onChange={(e) => set("trades", e.target.checked ? [...f.trades, t] : f.trades.filter((x) => x !== t))} />{tr(es ? "es" : "en", TRADES.find((x) => x.id === t)?.label ?? t)}</label>
        ))}</div>
      )}
      <button className="btn-primary" disabled={busy || f.full_name.trim().length < 2 || !f.email.includes("@")} onClick={async () => {
        setBusy(true); setMsg("");
        const e = await post("/api/pro/crew", { action: "add", ...f, years_experience: f.years_experience ? Number(f.years_experience) : null, license_number: f.license_number || null, phone: f.phone || null });
        setBusy(false);
        if (e) return setMsg(e);
        setF(blank); router.refresh();
      }}>{busy ? "…" : es ? "Agregar y enviar verificación de antecedentes" : "Add and send background check"}</button>
      {msg && <p className="text-sm text-rose-700">{msg}</p>}
    </div>
  );
}

export function CrewRemove({ id, es }: { id: string; es: boolean }) {
  const router = useRouter();
  const [sure, setSure] = useState(false);
  return sure
    ? <button className="text-xs font-semibold text-rose-700" onClick={async () => { await post("/api/pro/crew", { action: "remove", id }); router.refresh(); }}>{es ? "Confirmar: ya no trabaja conmigo" : "Confirm: no longer works with me"}</button>
    : <button className="text-xs text-ink-soft underline" onClick={() => setSure(true)}>{es ? "Quitar" : "Remove"}</button>;
}

/** Who goes to this job. Options come from the server with a reason when someone can't take it. */
export function CrewPicker({ jobId, current, options, es, blocked, requested, ownerOff = false }: { jobId: string; current: string | null; options: { id: string; name: string; why: string | null }[]; es: boolean; blocked: string | null; requested?: { id: string; name: string } | null; ownerOff?: boolean }) {
  const router = useRouter();
  const ask = requested ? options.find((o) => o.id === requested.id && !o.why && !blocked) : undefined;
  const [v, setV] = useState(current ?? ask?.id ?? "");
  const [msg, setMsg] = useState("");
  return (
    <div className="card space-y-2 text-sm">
      <div className="font-semibold">{es ? "¿Quién va a este trabajo?" : "Who’s doing this job?"}</div>
      {requested && <p className="rounded bg-brand-tint p-2 text-xs">★ {es ? `El cliente pidió a ${requested.name.split(" ")[0]}. Es una solicitud: usted decide quién va.` : `The customer asked for ${requested.name.split(" ")[0]}. It’s a request — who goes is your call.`}</p>}
      {blocked && <p className="text-xs text-amber-800">{es ? "Para enviar a su equipo: " : "To send your crew: "}{blocked}</p>}
      <select className="input" value={v} onChange={(e) => setV(e.target.value)}>
        <option value="" disabled={ownerOff && !current}>{ownerOff ? (es ? "Elija a alguien de su equipo" : "Pick someone on your crew") : es ? "Yo mismo" : "Me"}</option>
        {options.map((o) => <option key={o.id} value={o.id} disabled={Boolean(o.why) || Boolean(blocked)}>{o.name}{o.why ? ` — ${o.why}` : ""}</option>)}
      </select>
      <button className="btn-ghost w-full" disabled={v === (current ?? "")} onClick={async () => { setMsg(""); const e = await post(`/api/pro/jobs/${jobId}`, { action: "crew", crew_member_id: v || null }); if (e) setMsg(e); else router.refresh(); }}>{es ? "Guardar" : "Save"}</button>
      <p className="text-xs text-ink-soft">{es ? "El cliente ve el nombre de pila de quien va." : "The customer sees the first name of who’s coming."}</p>
      {msg && <p className="text-rose-700">{msg}</p>}
    </div>
  );
}

/** Hub: record a hand-run background check result, or re-order it. */
export function HubCrewDecision({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const go = async (body: Record<string, unknown>) => { setBusy(true); await post("/api/hub/crew", { id, ...body }); setBusy(false); router.refresh(); };
  return (
    <span className="inline-flex gap-1">
      <button className="btn-ghost px-2 py-1 text-xs" disabled={busy} onClick={() => go({ background_status: "clear" })}>Clear</button>
      <button className="btn-ghost px-2 py-1 text-xs" disabled={busy} onClick={() => go({ background_status: "consider" })}>Needs review</button>
      <button className="btn-ghost px-2 py-1 text-xs" disabled={busy} onClick={() => go({ action: "reorder" })}>Re-order</button>
    </span>
  );
}
