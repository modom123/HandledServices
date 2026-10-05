/*
 * FILE    : apps/web/app/(site)/talent/candidate/[token]/page.tsx
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-05_2034 UTC
 * PURPOSE : A candidate's link from "your résumé went to …": confirm they agreed, or withdraw it right away.
 */
import { notFound } from "next/navigation";
import { BRAND } from "@handled/core";
import { adminClient } from "@/lib/supabase/server";
import { CandidateAnswer } from "@/components/TalentUI";

export const metadata = { title: "Your application", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function CandidatePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[\w-]{20,40}$/.test(token)) notFound();
  const { data } = await adminClient().from("talent_submissions").select("stage, talent_searches(title, talent_clients(company))").eq("candidate_confirm_token", token).maybeSingle();
  if (!data) notFound();
  const s = data.talent_searches as unknown as { title: string; talent_clients: { company: string } };
  return (
    <div className="wrap max-w-xl space-y-4 py-10">
      <h1 className="text-2xl font-bold">Your résumé went to {s.talent_clients.company}</h1>
      <p className="text-sm">{BRAND.name} Talent sent your résumé to <b>{s.talent_clients.company}</b> for the <b>{s.title}</b> role. If you agreed to this, you&apos;re all set. If you didn&apos;t, or changed your mind, withdraw it and we&apos;ll pull it right away.</p>
      {data.stage === "withdrawn" ? <p className="card text-sm">This submission was withdrawn.</p> : <CandidateAnswer token={token} />}
      <p className="text-xs text-ink-soft">You never pay a fee to work with us. To have your information deleted, reply to any of our emails.</p>
    </div>
  );
}
