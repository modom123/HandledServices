/*
 * FILE    : apps/web/app/(site)/pros/interview/[token]/page.tsx
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-05_0246 UTC
 * PURPOSE : A candidate's private AI screening interview link (emailed after they apply). No login.
 */
import { notFound } from "next/navigation";
import { interviewByToken } from "@/lib/interviews";
import { InterviewChat } from "@/components/InterviewChat";

export const metadata = { title: "Pro interview", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function InterviewPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const s = await interviewByToken(token);
  if (!s) notFound();
  return (
    <div className="wrap max-w-2xl py-8">
      <InterviewChat token={token} initial={{ status: s.iv.status, locale: s.iv.locale, firstName: s.firstName, transcript: s.iv.transcript.map(({ role, text, at }) => ({ role, text, at })) }} />
    </div>
  );
}
