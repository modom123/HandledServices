/*
 * FILE    : apps/web/app/pro/onboarding/page.tsx
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-01_2000 UTC
 * UPDATED : 2026-10-02_0233 UTC — pros set their own daily job limit (dispatch never offers past it).
 * UPDATED : 2026-10-01_2109 UTC — specialties, trade-specific coverage, requirements by trade.
 * UPDATED : 2026-10-02_1440 UTC — Spanish (pro onboarding & recruiting)
 * UPDATED : 2026-10-03_0042 UTC — signing lists the Code of Conduct, policies, consents and trade addenda it covers.
 * UPDATED : 2026-10-03_0051 UTC — the agreement (and the list) in Spanish for Spanish-speaking pros.
 * PURPOSE : Pro onboarding checklist. Every step is required before activation; offers
 *           stop automatically if insurance or a license expires.
 * UPDATED : 2026-10-04_1934 UTC — photo ID verification step (Stripe Identity or a video call).
 */
import { VerifyId } from "@/components/VerifyId";
import { COVERAGES, TRADE_PROFILES, TRADES, onboardingChecklist, requiredCoverages, specialtiesFor, t as tr, type Contractor, type CoverageKey } from "@handled/core";
import { getViewer } from "@/lib/auth";
import { getLocale } from "@/lib/locale";
import { getPolicy } from "@/lib/pro-benefits";
import { PRO_AGREEMENT, localized, proSigningSet } from "@/lib/contracts";
import { Badge } from "@/components/ui";
import { Field, StepForm } from "@/components/ProOnboarding";

export default async function Onboarding() {
  const v = await getViewer();
  if (!v?.contractorId) return null;
  const l = await getLocale();
  const es = l === "es";
  const t = (s: string) => tr(l, s);
  const [{ data: c }, { data: docs }] = await Promise.all([
    v.db.from("contractors").select("*").eq("id", v.contractorId).single(),
    v.db.from("contractor_documents").select("kind, status, expires_on, created_at").order("created_at", { ascending: false }),
  ]);
  const pro = c as Contractor;
  const partners = (await getPolicy()).insurance.partners.filter((x) => x.url || x.phone);
  const { steps, complete } = onboardingChecklist(pro as never);
  const latest = (kind: string) => (docs ?? []).find((d: { kind: string }) => d.kind === kind) as { status: string; expires_on: string | null } | undefined;
  const pending = (kind: string) => latest(kind)?.status === "pending";
  const covLabel = (k: CoverageKey) => t(COVERAGES[k].label);
  /** Step labels and details from core are English; the dynamic ones are rebuilt here in Spanish. */
  const stepLabel = (s: { key: string; label: string }) => {
    if (!es) return s.label;
    if (s.key.startsWith("coverage:") && s.key !== "coverage:workers_comp") return `${covLabel(s.key.slice(9) as CoverageKey)} (verificado)`;
    return t(s.label);
  };
  const stepDetail = (d: string) => {
    if (!es) return d;
    let m: RegExpMatchArray | null;
    if ((m = d.match(/^(\d+) selected$/))) return `${m[1]} seleccionadas`;
    if ((m = d.match(/^From (\S+), up to (\d+) mi · (.*)$/))) return `Desde ${m[1]}, hasta ${m[2]} mi · ${m[3] === "any day" ? "cualquier día" : m[3].replace(/(\d+) days a week/, "$1 días a la semana")}`;
    if ((m = d.match(/^Valid until (.+)$/))) return `Válido hasta ${m[1]}`;
    if ((m = d.match(/^Current version (.+)$/))) return `Versión actual ${m[1]}`;
    if ((m = d.match(/^General liability, \$(\d+)M per occurrence minimum, Handled named as additional insured$/))) return `Responsabilidad civil general, mínimo de $${m[1]}M por incidente, con Handled como asegurado adicional`;
    if ((m = d.match(/^#(.+) · until (.+)$/))) return `#${m[1]} · hasta ${m[2]}`;
    return t(d);
  };
  const body = (key: string) => {
    if (key === "w9") return (
      <StepForm step="w9" cta={t("Save W-9")} locale={l}>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t("Legal name (as on your tax return)")} name="legal_name" defaultValue={pro.legal_name ?? ""} required />
          <div><label className="label">{t("Tax classification")}</label>
            <select name="entity_type" className="input" defaultValue={pro.entity_type ?? "individual"}>
              <option value="individual">{t("Individual / sole proprietor")}</option><option value="llc">LLC</option><option value="s_corp">{t("S corporation")}</option>
              <option value="c_corp">{t("C corporation")}</option><option value="partnership">{t("Partnership")}</option></select></div>
          <Field label={t("Last 4 of SSN / EIN")} name="tin_last4" inputMode="numeric" maxLength={4} pattern="\d{4}" required />
          <Field label={t("Street address")} name="address_line" defaultValue={pro.address_line ?? ""} required />
          <Field label={t("City")} name="city" defaultValue={pro.city ?? ""} required />
          <div className="grid grid-cols-2 gap-2"><Field label={t("State")} name="state" maxLength={2} defaultValue={pro.state ?? "MI"} required /><Field label={t("ZIP")} name="zip" maxLength={5} defaultValue={pro.zip ?? ""} required /></div>
        </div>
        <Field label={t("Signed IRS Form W-9 (PDF or photo)")} name="file" type="file" accept="application/pdf,image/*" required />
        <p className="text-xs text-ink-soft">{t("We store only the last 4 digits of your TIN. Your full W-9 is kept in encrypted private storage for 1099 filing.")}</p>
      </StepForm>
    );
    if (key === "agreement") return (
      <div className="mt-3">
        {(() => { const ag = localized(PRO_AGREEMENT, l); return (
        <details className="rounded-xl border border-line p-3 text-sm"><summary className="cursor-pointer font-semibold">{ag.title}</summary>
          {es && <p className="mt-3 text-xs text-ink-soft">{ag.translated ? "Esta es una traducción al español. Si hay alguna diferencia con la versión en inglés, prevalece la versión en inglés." : "El texto legal del acuerdo está en inglés. Si tiene preguntas, escríbanos antes de firmar."} <a href={`/terms/pro-agreement?lang=${es ? "en" : "es"}`} target="_blank" rel="noopener noreferrer" className="underline">{es ? "Ver en inglés" : "Ver en español"}</a></p>}
          <div className="mt-3 rounded-xl bg-paper p-3"><div className="font-semibold">{es ? "La versión corta" : "The short version"}</div><ul className="mt-1 list-disc pl-5">{ag.summary.map((x) => <li key={x}>{x}</li>)}</ul></div>
          <div className="mt-3 space-y-3">{ag.sections.map((s) => <div key={s.h}><div className="font-semibold">{s.h}</div><p className="whitespace-pre-line text-ink-soft">{s.p}</p></div>)}</div></details>); })()}
        <div className="mt-3 rounded-xl bg-paper p-3 text-sm">
          <div className="font-semibold">{t("Your signature also covers:")}</div>
          <ul className="mt-1 list-disc pl-5">{proSigningSet((pro.trades ?? []) as string[]).slice(1).map((c) => <li key={c.key}><a href={`/terms/${c.key}${es ? "?lang=es" : ""}`} target="_blank" rel="noopener noreferrer" className="text-brand underline">{localized(c, l).title}</a></li>)}</ul>
          <p className="mt-2 text-xs text-ink-soft">{t("Each one starts with a short plain-English version. Copies of everything you sign are saved in My contracts.")}</p>
        </div>
        <StepForm step="agreement" cta={t("Sign agreement")} locale={l}>
          <Field label={t("Type your full name to sign")} name="signer_name" required />
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="agree" value="true" required /> {t("I have read and agree to the Independent Contractor Agreement and the documents listed above.")}</label>
        </StepForm>
      </div>
    );
    if (key === "coi") return pending("coi") ? <p className="mt-2 text-sm text-ink-soft">{t("Certificate received — we’re verifying it.")}</p> : (
      <StepForm step="coi" cta={t("Upload certificate")} locale={l}>
        <div className="grid gap-3 sm:grid-cols-2"><Field label={t("Policy expires")} name="expires_on" type="date" required /><Field label={t("Certificate of insurance")} name="file" type="file" accept="application/pdf,image/*" required /></div>
      </StepForm>
    );
    if (key === "license") return pending("license") ? <p className="mt-2 text-sm text-ink-soft">{t("License received — we’re verifying it.")}</p> : (
      <StepForm step="license" cta={t("Upload license")} locale={l}>
        <div className="grid gap-3 sm:grid-cols-3"><Field label={t("License #")} name="license_number" defaultValue={pro.license_number ?? ""} required /><Field label={t("Expires")} name="expires_on" type="date" required /><Field label={t("License copy")} name="file" type="file" accept="application/pdf,image/*" required /></div>
      </StepForm>
    );
    if (key === "area") {
      const days = pro.availability?.days ?? [1, 2, 3, 4, 5, 6];
      const wins = pro.availability?.windows ?? ["morning", "midday", "afternoon"];
      return (
        <StepForm step="area" cta={t("Save work area & hours")} locale={l}>
          <p className="text-sm text-ink-soft">{t("We only offer you jobs within your driving distance of your place of business, on the days and times you work. Set your daily limit and days off so you never get offers you can’t take.")}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t("Place of business — street address")} name="base_address" defaultValue={(pro as { base_address?: string | null }).base_address ?? ""} required />
            <Field label={t("City")} name="base_city" defaultValue={(pro as { base_city?: string | null }).base_city ?? ""} required />
            <Field label={t("State (2 letters)")} name="base_state" defaultValue={(pro as { base_state?: string | null }).base_state ?? "MI"} maxLength={2} pattern="[A-Za-z]{2}" required />
            <Field label={t("ZIP")} name="base_zip" defaultValue={pro.base_zip ?? pro.zip ?? ""} maxLength={5} pattern="\d{5}" required />
            <Field label={t("How far you’ll drive (miles)")} name="service_radius_mi" type="number" min={1} max={150} defaultValue={String(pro.service_radius_mi ?? 25)} required />
            <Field label={t("Most jobs you want in one day")} name="daily_capacity" type="number" min={1} max={20} defaultValue={String(pro.daily_capacity ?? 3)} required />
          </div>
          <div><span className="label">{t("Days you work")}</span><div className="flex flex-wrap gap-3 text-sm">{["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d, i) => <label key={d} className="flex items-center gap-1"><input type="checkbox" name="days" value={i} defaultChecked={days.includes(i)} /> {t(d)}</label>)}</div></div>
          <div><span className="label">{t("Times you work")}</span><div className="flex flex-wrap gap-3 text-sm">{[["morning", "Morning 8–11"], ["midday", "Midday 11–2"], ["afternoon", "Afternoon 2–5"]].map(([w, lb]) => <label key={w} className="flex items-center gap-1"><input type="checkbox" name="windows" value={w} defaultChecked={wins.includes(w)} /> {t(lb)}</label>)}</div></div>
          <Field label={t("Days off (YYYY-MM-DD, separated by commas)")} name="time_off" defaultValue={(pro.time_off ?? []).join(", ")} />
        </StepForm>
      );
    }
    if (key === "specialties") return (
      <StepForm step="specialties" cta={t("Save specialties")} locale={l}>
        <p className="text-sm text-ink-soft">{t("Pick what you do best. Jobs that match your specialties come to you first.")}</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {specialtiesFor(pro.trades).map((sp) => (
            <label key={sp.id} className="flex items-center gap-2 text-sm"><input type="checkbox" name="specialties" value={sp.id} defaultChecked={pro.specialties?.includes(sp.id)} /> {t(sp.label)}</label>
          ))}
        </div>
      </StepForm>
    );
    if (key.startsWith("coverage:")) {
      const k = key.slice(9) as CoverageKey;
      if (pending(k)) return <p className="mt-2 text-sm text-ink-soft">{t("Policy received — we’re verifying it with your carrier.")}</p>;
      const help = partners.length ? <p className="text-xs text-ink-soft">{t("Need this coverage? Our partners:")} {partners.map((x, i) => <span key={i}>{i ? " · " : ""}{x.url ? <a className="text-brand underline" href={x.url} target="_blank">{x.name}</a> : x.name}{x.phone ? ` ${x.phone}` : ""}{x.code ? ` (${es ? "código" : "code"} ${x.code})` : ""}</span>)}</p> : null;
      const canExempt = k === "workers_comp" && !requiredCoverages(pro.trades).includes("workers_comp");
      return (
        <div className="mt-3 space-y-3">
          {help}
          <StepForm step="coverage" cta={es ? `Subir póliza: ${covLabel(k).toLowerCase()}` : `Upload ${COVERAGES[k].label.toLowerCase()}`} locale={l}>
            <input type="hidden" name="coverage" value={k} />
            <div className="grid gap-3 sm:grid-cols-2"><Field label={t("Policy expires")} name="expires_on" type="date" required /><Field label={t("Certificate or declarations page")} name="file" type="file" accept="application/pdf,image/*" required /></div>
          </StepForm>
          {canExempt && (
            <StepForm step="coverage" cta={t("Sign no-employees statement")} locale={l}>
              <input type="hidden" name="coverage" value="workers_comp" /><input type="hidden" name="exempt" value="true" />
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" required /> {t("I work alone and have no employees. I’ll get workers’ comp before anyone works for me on a Handled job.")}</label>
            </StepForm>
          )}
        </div>
      );
    }
    if (key === "id") {
      const st = (pro as Contractor & { id_verification?: { status?: string; provider?: string } | null }).id_verification;
      return st?.provider === "manual" && st.status === "requested"
        ? <p className="mt-2 text-sm text-ink-soft">{t("We'll verify your ID on a short video call. We'll contact you to schedule it.")}</p>
        : <div className="mt-2 space-y-2">{st?.status === "requires_input" && <p className="text-sm text-rose-700">{t("Your ID photo couldn't be read. Please try again in good light.")}</p>}<p className="text-sm text-ink-soft">{t("Take a photo of your driver's license, state ID or passport and a selfie. It takes about 2 minutes on your phone. We only keep the result.")}</p><VerifyId label={t("Verify my ID")} /></div>;
    }
    if (key === "background") {
      const bs = (pro as Contractor & { background_status?: string | null }).background_status;
      return <p className="mt-2 text-sm text-ink-soft">{t(pro.background_checked ? "Cleared." : bs === "invited" ? "Our screening provider (Checkr) emailed you a secure link — check your inbox and spam. It takes about 5 minutes, results in 1–3 business days." : bs === "pending" ? "In progress — usually 1–3 business days. We’ll notify you when it clears." : "Starts automatically as soon as your W-9 and agreement are in.")}</p>;
    }
    if (key === "payout") return (
      <StepForm step="payout" cta={t("Save payout method")} locale={l}>
        <div className="grid gap-3 sm:grid-cols-2">
          <div><label className="label">{t("Method")}</label><select name="payout_method" className="input" defaultValue={pro.payout_method ?? "ach"}><option value="ach">{t("Bank deposit (ACH)")}</option><option value="stripe_connect">Stripe Connect</option><option value="check">{t("Check")}</option></select></div>
          <Field label={t("Account last 4 (optional)")} name="account_last4" maxLength={4} />
        </div>
      </StepForm>
    );
    return null;
  };
  const doneCount = steps.filter((s) => s.done).length;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div><h1 className="text-2xl font-bold">{t("Get set up")}</h1><p className="text-sm text-ink-soft">{t("You work as an independent business. These steps let us send you prepaid jobs and file your 1099.")}</p></div>
        <Badge tone={complete ? "green" : "amber"}>{doneCount}/{steps.length} {es ? "completos" : "complete"}</Badge>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-paper-deep"><div className="h-full bg-brand transition-all" style={{ width: `${(doneCount / steps.length) * 100}%` }} /></div>
      {!complete && (() => { const next = steps.find((s) => !s.done && s.key !== "background"); return next ? <p className="text-sm">{es ? "Siguiente:" : "Next:"} <a href={`#step-${next.key}`} className="font-semibold text-brand underline">{stepLabel(next)}</a>. {t("Saved as you go — finish any time on your phone.")}</p> : <p className="text-sm text-ink-soft">{t("All your steps are in. We’re verifying documents and your background check; you’ll get a notification the moment you’re live.")}</p>; })()}
      <details className="card text-sm">
        <summary className="cursor-pointer font-semibold">{t("What your trades require")}</summary>
        <div className="mt-3 space-y-3">
          {pro.trades.map((td) => { const p = TRADE_PROFILES[td]; if (!p) return null; const label = TRADES.find((x) => x.id === td)?.label; return (
            <div key={td}>
              <div className="font-semibold">{label ? t(label) : td}</div>
              <ul className="list-disc pl-5 text-ink-soft">
                <li>{es ? `Responsabilidad civil general de $${(p.glMin / 1e6).toFixed(0)}M por incidente` : `General liability $${(p.glMin / 1e6).toFixed(0)}M per occurrence`}{p.requires.length ? ` + ${p.requires.map((k) => covLabel(k).toLowerCase()).join(", ")}` : ""}</li>
                {p.conditional.map((cn) => <li key={cn.key}>{covLabel(cn.key)} {es ? "si" : "when"} {t(cn.when)}</li>)}
                {p.license && <li>{es ? "Licencia" : "License"}: {t(p.license)}</li>}
                {p.preferred.map((x) => <li key={x}>{es ? "Preferible" : "Preferred"}: {t(x)}</li>)}
                <li>{es ? "Prueba de habilidades" : "Skills check"}: {t(p.skillsCheck)}</li>
              </ul>
            </div>
          ); })}
        </div>
      </details>
      {steps.map((s) => (
        <div key={s.key} id={`step-${s.key}`} className={`card scroll-mt-24 ${s.done ? "border-brand/40" : ""}`}>
          <div className="flex items-center justify-between gap-2"><div className="font-semibold">{s.done ? "✅" : "⬜"} {stepLabel(s)}</div>{s.expiring && <Badge tone="amber">{t("expires soon")}</Badge>}</div>
          <div className="text-sm text-ink-soft">{stepDetail(s.detail)}</div>
          {(!s.done || s.expiring || s.key === "area") && body(s.key)}
        </div>
      ))}
    </div>
  );
}
