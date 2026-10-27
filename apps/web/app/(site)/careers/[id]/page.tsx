/*
 * FILE    : apps/web/app/(site)/careers/[id]/page.tsx
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-27_1700 UTC
 * PURPOSE : One open role on our team or with a client (a public Talent search): what it is, pay, must-haves, and the
 *           apply form. This is where Indeed's "Apply on company website" link lands (?utm_source=indeed is kept as the
 *           candidate's source). Client roles never show the company.
 */
import Link from "next/link";
import { notFound } from "next/navigation";
import { BRAND } from "@handled/core";
import { adminClient } from "@/lib/supabase/server";
import { CareersApply } from "@/components/CareersApply";

export const dynamic = "force-dynamic";

export default async function Role({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ utm_source?: string }> }) {
  const { id } = await params;
  const { utm_source } = await searchParams;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  let s: Record<string, unknown> | null = null;
  try { s = (await adminClient().from("talent_searches").select("id, title, location, workplace, salary_min, salary_max, description, must_haves, status, public, talent_clients(internal)").eq("id", id).maybeSingle()).data; } catch { /* database not reachable: treat as not found */ }
  if (!s || !s.public || !["open", "on_hold"].includes(String(s.status))) notFound();
  const internal = Boolean((s.talent_clients as { internal?: boolean } | null)?.internal);
  const pay = s.salary_min || s.salary_max ? `$${Number(s.salary_min ?? s.salary_max).toLocaleString("en-US")}${s.salary_min && s.salary_max ? ` – $${Number(s.salary_max).toLocaleString("en-US")}` : ""} a year` : null;
  return (
    <div className="wrap grid gap-10 py-12 lg:grid-cols-[1.3fr_1fr]">
      <div>
        <Link href="/careers" className="text-sm text-brand">← All roles</Link>
        <div className="mt-4 text-xs font-bold uppercase tracking-widest text-brand">{internal ? `${BRAND.name} team` : `${BRAND.name} Talent · confidential client`}</div>
        <h1 className="mt-2 text-4xl font-extrabold tracking-tight">{String(s.title)}</h1>
        <p className="mt-2 text-ink-soft">{String(s.location ?? "")}{s.workplace && s.workplace !== "onsite" ? ` · ${String(s.workplace)}` : ""}{pay ? ` · ${pay}` : ""}</p>
        {s.description ? <div className="mt-6 whitespace-pre-line leading-relaxed">{String(s.description)}</div> : null}
        {s.must_haves ? <><h2 className="mt-8 text-xl font-bold">What you bring</h2><ul className="mt-2 list-disc space-y-1 pl-5">{String(s.must_haves).split(/\n|;/).map((x) => x.trim()).filter(Boolean).map((x) => <li key={x}>{x}</li>)}</ul></> : null}
        <p className="mt-8 text-xs text-ink-soft">{internal ? BRAND.legalName : "Our client"} is an equal opportunity employer. We consider every qualified applicant without regard to race, color, religion, sex, sexual orientation, gender identity, national origin, age, disability, veteran status or any other protected characteristic.{internal ? "" : " You never pay a fee to work with us."}</p>
      </div>
      <div><CareersApply searchId={s.id as string} title={s.title as string} source={utm_source ?? ""} /></div>
    </div>
  );
}
