/*
 * FILE    : apps/web/app/(site)/talent/review/[token]/page.tsx
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-05_2034 UTC
 * PURPOSE : The client's private page for one search (no login; the link is the key): accept the client agreement
 *           once, then review each submitted candidate and choose interview / pass / hold.
 */
import { notFound } from "next/navigation";
import { BRAND } from "@handled/core";
import { adminClient } from "@/lib/supabase/server";
import { searchByReviewToken } from "@/lib/talent";
import { ReviewBoard } from "@/components/TalentUI";

export const metadata = { title: "Your search", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function Review({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const f = await searchByReviewToken(token);
  if (!f) notFound();
  const { data: s } = await adminClient().from("talent_searches").select("talent_clients(agreement_signed_at)").eq("id", f.search.id).single();
  const signed = Boolean((s?.talent_clients as unknown as { agreement_signed_at: string | null } | null)?.agreement_signed_at);
  const client = f.search.talent_clients as unknown as { company: string; contact_name: string };
  type Cand = { full_name: string; location: string | null; current_title: string | null; linkedin: string | null; resume_path: string | null };
  const subs = f.submissions.map((x) => {
    const c = x.talent_candidates as unknown as Cand;
    return { id: x.id, stage: x.stage, pitch: x.pitch, expected_salary: x.expected_salary, submitted_at: x.submitted_at, client_feedback: x.client_feedback, client_decision: x.client_decision, candidate: { full_name: c.full_name, location: c.location, current_title: c.current_title, linkedin: c.linkedin, hasResume: Boolean(c.resume_path) } };
  });
  return (
    <div className="wrap max-w-3xl space-y-5 py-8">
      <div>
        <div className="text-sm text-ink-soft">{BRAND.name} Talent · {client.company}</div>
        <h1 className="text-2xl font-bold">{f.search.title}</h1>
        <p className="text-sm text-ink-soft">{[f.search.location, f.search.workplace].filter(Boolean).join(" · ")} · {f.search.type === "retained" ? "Retained search" : "Contingency search"} · {f.search.status === "open" ? "Open" : f.search.status.replace("_", " ")}</p>
      </div>
      <ReviewBoard token={token} signed={signed} subs={subs} agreementUrl="/terms/talent-client-agreement" />
      <p className="text-xs text-ink-soft">Keep this page private: anyone with the link can see these candidates. Questions? Reply to any of our emails.</p>
    </div>
  );
}
