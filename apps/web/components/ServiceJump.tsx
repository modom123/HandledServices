/*
 * FILE    : apps/web/components/ServiceJump.tsx
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-11-17_2030 UTC
 * PURPOSE : Hub → Pros → Roster: "Look up a service…" dropdown — every service by category with its status (✓ backups,
 *           ⚠ one pro, ✗ none) and pro count; choosing one opens its depth chart (/hub/depth?service=…).
 */
"use client";

import { useRouter } from "next/navigation";

export function ServiceJump({ groups }: { groups: { label: string; items: { slug: string; label: string }[] }[] }) {
  const router = useRouter();
  return (
    <select className="input w-full sm:w-72" defaultValue="" aria-label="Look up a service" onChange={(e) => { if (e.target.value) router.push(`/hub/depth?service=${e.target.value}`); }}>
      <option value="" disabled>Look up any service…</option>
      {groups.map((g) => (
        <optgroup key={g.label} label={g.label}>
          {g.items.map((i) => <option key={i.slug} value={i.slug}>{i.label}</option>)}
        </optgroup>
      ))}
    </select>
  );
}
