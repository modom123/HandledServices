/*
 * FILE    : apps/web/app/hub/checklists/page.tsx
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-05_0221 UTC
 * PURPOSE : Hub → Checklists: the checklist library for every service (?lang=es for Spanish).
 */
import { ChecklistLibrary } from "@/components/ChecklistLibrary";

export default async function HubChecklists({ searchParams }: { searchParams: Promise<{ lang?: string }> }) {
  const { lang } = await searchParams;
  return (<div><div className="mb-3 text-right text-sm print:hidden"><a className="underline" href={lang === "es" ? "?" : "?lang=es"}>{lang === "es" ? "English" : "Español"}</a></div><ChecklistLibrary es={lang === "es"} audience="staff" /></div>);
}
