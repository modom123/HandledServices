/*
 * FILE    : apps/web/components/Dropdowns.tsx
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-11-05_1215 UTC
 * PURPOSE : Dropdowns that replace long rows of buttons in Mastermind.
 *             MultiSelect  — pick several from a long list (trades, NAICS codes…): one compact button showing what's
 *                            picked; opens a searchable checklist with Select all / Clear and an optional maximum.
 *             FilterSelect — one dropdown for a filter that used to be a row of links (lead status, pipeline stage);
 *                            choosing an option opens that filter's page (the URL still carries the filter).
 */
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

export type Option = { value: string; label: string; hint?: string };

export function MultiSelect({ options, value, onChange, placeholder = "Choose…", noneLabel, max, disabled, label }: {
  options: Option[];
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  /** What "nothing picked" means, when it means something (e.g. "All trades"). */
  noneLabel?: string;
  max?: number;
  disabled?: boolean;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", close); document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", esc); };
  }, [open]);
  const byValue = useMemo(() => new Map(options.map((o) => [o.value, o])), [options]);
  const shown = options.filter((o) => !q || `${o.label} ${o.hint ?? ""} ${o.value}`.toLowerCase().includes(q.toLowerCase()));
  const full = max != null && value.length >= max;
  const flip = (v: string) => onChange(value.includes(v) ? value.filter((x) => x !== v) : full ? value : [...value, v]);
  const names = value.map((v) => byValue.get(v)?.label ?? v);
  const summary = !value.length ? (noneLabel ?? placeholder) : names.length <= 2 ? names.join(", ") : `${names.slice(0, 2).join(", ")} +${names.length - 2} more`;

  return (
    <div ref={box} className="relative">
      {label && <span className="label">{label}</span>}
      <button type="button" disabled={disabled} aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen(!open)}
        className="input flex w-full items-center justify-between gap-2 text-left disabled:opacity-60">
        <span className={`truncate ${value.length ? "" : "text-ink-soft"}`}>{summary}</span>
        <span className="shrink-0 text-xs text-ink-soft">{value.length ? `${value.length}${max ? `/${max}` : ""} ▾` : "▾"}</span>
      </button>
      {open && (
        <div className="absolute z-30 mt-1 w-full min-w-64 rounded-xl border border-line bg-white p-2 shadow-lg">
          <input autoFocus className="input mb-2" placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} />
          <div className="mb-1 flex items-center justify-between text-xs text-ink-soft">
            <span>{value.length} selected{max ? ` (up to ${max})` : ""}</span>
            <span className="flex gap-3">
              {!max && <button type="button" className="underline" onClick={() => onChange([...new Set([...value, ...shown.map((o) => o.value)])])}>Select {q ? "these" : "all"}</button>}
              {value.length > 0 && <button type="button" className="underline" onClick={() => onChange([])}>Clear</button>}
            </span>
          </div>
          <ul role="listbox" aria-multiselectable className="max-h-72 overflow-y-auto">
            {shown.map((o) => {
              const on = value.includes(o.value);
              return (
                <li key={o.value}>
                  <label className={`flex cursor-pointer items-start gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-paper ${!on && full ? "opacity-50" : ""}`}>
                    <input type="checkbox" className="mt-0.5" checked={on} disabled={!on && full} onChange={() => flip(o.value)} />
                    <span>{o.label}{o.hint && <span className="block text-xs text-ink-soft">{o.hint}</span>}</span>
                  </label>
                </li>
              );
            })}
            {!shown.length && <li className="px-2 py-1.5 text-sm text-ink-soft">Nothing matches “{q}”.</li>}
          </ul>
          <div className="mt-2 flex justify-end"><button type="button" className="btn-primary px-3 py-1 text-sm" onClick={() => setOpen(false)}>Done</button></div>
        </div>
      )}
    </div>
  );
}

/** A filter dropdown: each option is a page address; choosing one opens it. */
export function FilterSelect({ options, current, label }: { options: { href: string; label: string }[]; current: string; label?: string }) {
  const router = useRouter();
  return (
    <label className="flex items-center gap-2 text-sm">
      {label && <span className="text-ink-soft">{label}</span>}
      <select className="input w-auto py-1" value={current} onChange={(e) => router.push(e.target.value)}>
        {options.map((o) => <option key={o.href} value={o.href}>{o.label}</option>)}
      </select>
    </label>
  );
}
