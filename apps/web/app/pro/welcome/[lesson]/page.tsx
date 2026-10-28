/*
 * FILE    : apps/web/app/pro/welcome/[lesson]/page.tsx
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-28_2300 UTC
 * PURPOSE : One "Welcome to Handled" lesson: the key points, then its question (components/ProWelcome LessonQuiz).
 */
import Link from "next/link";
import { notFound } from "next/navigation";
import { ORIENTATION } from "@handled/core";
import { getViewer } from "@/lib/auth";
import { getLocale } from "@/lib/locale";
import { LessonQuiz } from "@/components/ProWelcome";

export const dynamic = "force-dynamic";

export default async function Lesson({ params }: { params: Promise<{ lesson: string }> }) {
  const { lesson } = await params;
  const i = ORIENTATION.findIndex((l) => l.id === lesson);
  if (i < 0) notFound();
  const v = await getViewer();
  if (!v?.contractorId) return null;
  const es = (await getLocale()) === "es";
  const { data } = await v.db.from("contractors").select("orientation").eq("id", v.contractorId).single();
  const done = Boolean((data?.orientation as Record<string, string> | null)?.[lesson]);
  const l = ORIENTATION[i];
  const x = es ? l.es : l.en;
  const next = ORIENTATION[i + 1];
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Link href="/pro/welcome" className="text-sm text-brand underline">← {es ? "Bienvenida a Handled" : "Welcome to Handled"}</Link>
      <div>
        <div className="text-xs font-semibold uppercase tracking-wide text-ink-soft">{es ? `Lección ${i + 1} de ${ORIENTATION.length}` : `Lesson ${i + 1} of ${ORIENTATION.length}`} · {l.minutes} min</div>
        <h1 className="text-2xl font-bold">{l.icon} {x.title}</h1>
      </div>
      <ul className="card list-disc space-y-2 pl-8 text-sm">{x.points.map((p) => <li key={p}>{p}</li>)}</ul>
      <LessonQuiz lesson={l.id} question={x.q} options={x.options} es={es} done={done} nextHref={next ? `/pro/welcome/${next.id}` : "/pro/welcome"} />
    </div>
  );
}
