/*
 * FILE    : apps/web/app/pro/checklists/page.tsx
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-05_0221 UTC
 * PURPOSE : Pro portal → Checklists: what each kind of job includes, so pros know what "done" means before they
 *           take one. In the pro's language.
 */
import { getLocale } from "@/lib/locale";
import { ChecklistLibrary } from "@/components/ChecklistLibrary";

export default async function ProChecklists() {
  return <div className="py-6"><ChecklistLibrary es={(await getLocale()) === "es"} audience="pro" /></div>;
}
