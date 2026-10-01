/*
 * FILE    : apps/web/app/pro/onboarding/page.tsx
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-01_2000 UTC
 * UPDATED : 2026-10-01_2109 UTC — specialties, trade-specific coverage, requirements by trade.
 * PURPOSE : Pro onboarding checklist. Every step is required before activation; offers
 *           stop automatically if insurance or a license expires.
 */
import { COVERAGES, TRADE_PROFILES, TRADES, onboardingChecklist, requiredCoverages, specialtiesFor, type Contractor, type CoverageKey } from "@handled/core";
import { getViewer } from "@/lib/auth";
import { AGREEMENT_SECTIONS, AGREEMENT_TITLE } from "@/lib/agreement";
import { Badge } from "@/components/ui";
import { Field, StepForm } from "@/components/ProOnboarding";

export default async function Onboarding() {
  const v = await getViewer();
  if (!v?.contractorId) return null;
  const [{ data: c }, { data: docs }] = await Promise.all([
    v.db.from("contractors").select("*").eq("id", v.contractorId).single(),
    v.db.from("contractor_documents").select("kind, status, expires_on, created_at").order("created_at", { ascending: false }),
  ]);
  const pro = c as Contractor;
  const { steps, complete } = onboardingChecklist(pro as never);
  const latest = (kind: string) => (docs ?? []).find((d: { kind: string }) => d.kind === kind) as { status: string; expires_on: string | null } | undefined;
  const pending = (kind: string) => latest(kind)?.status === "pending";
  const body = (key: string) => {
    if (key === "w9") return (
      <StepForm step="w9" cta="Save W-9">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Legal name (as on your tax return)" name="legal_name" defaultValue={pro.legal_name ?? ""} required />
          <div><label className="label">Tax classification</label>
            <select name="entity_type" className="input" defaultValue={pro.entity_type ?? "individual"}>
              <option value="individual">Individual / sole proprietor</option><option value="llc">LLC</option><option value="s_corp">S corporation</option>
              <option value="c_corp">C corporation</option><option value="partnership">Partnership</option></select></div>
          <Field label="Last 4 of SSN / EIN" name="tin_last4" inputMode="numeric" maxLength={4} pattern="\d{4}" required />
          <Field label="Street address" name="address_line" defaultValue={pro.address_line ?? ""} required />
          <Field label="City" name="city" defaultValue={pro.city ?? ""} required />
          <div className="grid grid-cols-2 gap-2"><Field label="State" name="state" maxLength={2} defaultValue={pro.state ?? "MI"} required /><Field label="ZIP" name="zip" maxLength={5} defaultValue={pro.zip ?? ""} required /></div>
        </div>
        <Field label="Signed IRS Form W-9 (PDF or photo)" name="file" type="file" accept="application/pdf,image/*" required />
        <p className="text-xs text-ink-soft">We store only the last 4 digits of your TIN. Your full W-9 is kept in encrypted private storage for 1099 filing.</p>
      </StepForm>
    );
    if (key === "agreement") return (
      <div className="mt-3">
        <details className="rounded-xl border border-line p-3 text-sm"><summary className="cursor-pointer font-semibold">{AGREEMENT_TITLE}</summary>
          <div className="mt-3 space-y-3">{AGREEMENT_SECTIONS.map((s) => <div key={s.h}><div className="font-semibold">{s.h}</div><p className="text-ink-soft">{s.p}</p></div>)}</div></details>
        <StepForm step="agreement" cta="Sign agreement">
          <Field label="Type your full name to sign" name="signer_name" required />
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="agree" value="true" required /> I have read and agree to the Independent Contractor Agreement.</label>
        </StepForm>
      </div>
    );
    if (key === "coi") return pending("coi") ? <p className="mt-2 text-sm text-ink-soft">Certificate received — we’re verifying it.</p> : (
      <StepForm step="coi" cta="Upload certificate">
        <div className="grid gap-3 sm:grid-cols-2"><Field label="Policy expires" name="expires_on" type="date" required /><Field label="Certificate of insurance" name="file" type="file" accept="application/pdf,image/*" required /></div>
      </StepForm>
    );
    if (key === "license") return pending("license") ? <p className="mt-2 text-sm text-ink-soft">License received — we’re verifying it.</p> : (
      <StepForm step="license" cta="Upload license">
        <div className="grid gap-3 sm:grid-cols-3"><Field label="License #" name="license_number" defaultValue={pro.license_number ?? ""} required /><Field label="Expires" name="expires_on" type="date" required /><Field label="License copy" name="file" type="file" accept="application/pdf,image/*" required /></div>
      </StepForm>
    );
    if (key === "specialties") return (
      <StepForm step="specialties" cta="Save specialties">
        <p className="text-sm text-ink-soft">Pick what you do best. Jobs that match your specialties come to you first.</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {specialtiesFor(pro.trades).map((sp) => (
            <label key={sp.id} className="flex items-center gap-2 text-sm"><input type="checkbox" name="specialties" value={sp.id} defaultChecked={pro.specialties?.includes(sp.id)} /> {sp.label}</label>
          ))}
        </div>
      </StepForm>
    );
    if (key.startsWith("coverage:")) {
      const k = key.slice(9) as CoverageKey;
      if (pending(k)) return <p className="mt-2 text-sm text-ink-soft">Policy received — we’re verifying it with your carrier.</p>;
      const canExempt = k === "workers_comp" && !requiredCoverages(pro.trades).includes("workers_comp");
      return (
        <div className="mt-3 space-y-3">
          <StepForm step="coverage" cta={`Upload ${COVERAGES[k].label.toLowerCase()}`}>
            <input type="hidden" name="coverage" value={k} />
            <div className="grid gap-3 sm:grid-cols-2"><Field label="Policy expires" name="expires_on" type="date" required /><Field label="Certificate or declarations page" name="file" type="file" accept="application/pdf,image/*" required /></div>
          </StepForm>
          {canExempt && (
            <StepForm step="coverage" cta="Sign no-employees statement">
              <input type="hidden" name="coverage" value="workers_comp" /><input type="hidden" name="exempt" value="true" />
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" required /> I work alone and have no employees. I’ll get workers’ comp before anyone works for me on a Handled job.</label>
            </StepForm>
          )}
        </div>
      );
    }
    if (key === "background") return <p className="mt-2 text-sm text-ink-soft">{pro.background_checked ? "Cleared." : "We’ll email you a secure link from our screening provider to consent and complete the check."}</p>;
    if (key === "payout") return (
      <StepForm step="payout" cta="Save payout method">
        <div className="grid gap-3 sm:grid-cols-2">
          <div><label className="label">Method</label><select name="payout_method" className="input" defaultValue={pro.payout_method ?? "ach"}><option value="ach">Bank deposit (ACH)</option><option value="stripe_connect">Stripe Connect</option><option value="check">Check</option></select></div>
          <Field label="Account last 4 (optional)" name="account_last4" maxLength={4} />
        </div>
      </StepForm>
    );
    return null;
  };
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div><h1 className="text-2xl font-bold">Get set up</h1><p className="text-sm text-ink-soft">You work as an independent business. These steps let us send you prepaid jobs and file your 1099.</p></div>
        <Badge tone={complete ? "green" : "amber"}>{steps.filter((s) => s.done).length}/{steps.length} complete</Badge>
      </div>
      <details className="card text-sm">
        <summary className="cursor-pointer font-semibold">What your trades require</summary>
        <div className="mt-3 space-y-3">
          {pro.trades.map((t) => { const p = TRADE_PROFILES[t]; if (!p) return null; return (
            <div key={t}>
              <div className="font-semibold">{TRADES.find((x) => x.id === t)?.label ?? t}</div>
              <ul className="list-disc pl-5 text-ink-soft">
                <li>General liability ${(p.glMin / 1e6).toFixed(0)}M per occurrence{p.requires.length ? ` + ${p.requires.map((k) => COVERAGES[k].label.toLowerCase()).join(", ")}` : ""}</li>
                {p.conditional.map((c) => <li key={c.key}>{COVERAGES[c.key].label} when {c.when}</li>)}
                {p.license && <li>License: {p.license}</li>}
                {p.preferred.map((x) => <li key={x}>Preferred: {x}</li>)}
                <li>Skills check: {p.skillsCheck}</li>
              </ul>
            </div>
          ); })}
        </div>
      </details>
      {steps.map((s) => (
        <div key={s.key} className={`card ${s.done ? "border-brand/40" : ""}`}>
          <div className="flex items-center justify-between gap-2"><div className="font-semibold">{s.done ? "✅" : "⬜"} {s.label}</div>{s.expiring && <Badge tone="amber">expires soon</Badge>}</div>
          <div className="text-sm text-ink-soft">{s.detail}</div>
          {(!s.done || s.expiring) && body(s.key)}
        </div>
      ))}
    </div>
  );
}
