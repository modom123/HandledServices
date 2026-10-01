/*
 * FILE    : apps/web/components/ui.tsx
 * PROJECT : Handled — AI-run home & business services
 * CREATED : 2026-10-01_1723 UTC
 * PURPOSE : Small shared UI pieces (badges, stats, empty states).
 */
import { JOB_STATUS_LABEL, type JobStatus } from "@handled/core";

const STATUS_COLOR: Record<JobStatus, string> = {
  requested: "bg-sky-100 text-sky-800",
  site_visit: "bg-violet-100 text-violet-800",
  quoted: "bg-indigo-100 text-indigo-800",
  scheduled: "bg-slate-100 text-slate-700",
  dispatched: "bg-amber-100 text-amber-800",
  assigned: "bg-emerald-100 text-emerald-800",
  in_progress: "bg-teal-100 text-teal-800",
  qa_review: "bg-orange-100 text-orange-800",
  completed: "bg-green-100 text-green-800",
  cancelled: "bg-rose-100 text-rose-700",
};

export function StatusBadge({ status }: { status: JobStatus }) {
  return <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_COLOR[status]}`}>{JOB_STATUS_LABEL[status]}</span>;
}

export function Badge({ children, tone = "slate" }: { children: React.ReactNode; tone?: "slate" | "green" | "amber" | "red" | "brand" }) {
  const c = { slate: "bg-slate-100 text-slate-700", green: "bg-green-100 text-green-800", amber: "bg-amber-100 text-amber-800", red: "bg-rose-100 text-rose-700", brand: "bg-brand-tint text-brand-dark" }[tone];
  return <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${c}`}>{children}</span>;
}

export function Stat({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div className="card">
      <div className="text-xs font-semibold uppercase tracking-wide text-ink-soft">{label}</div>
      <div className="mt-1 text-2xl font-bold">{value}</div>
      {hint && <div className="mt-1 text-xs text-ink-soft">{hint}</div>}
    </div>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="rounded-2xl border border-dashed border-line p-8 text-center text-sm text-ink-soft">{children}</div>;
}

export function NotConfigured() {
  return (
    <div className="wrap py-16">
      <div className="card max-w-xl">
        <h1 className="text-xl font-bold">Connect Supabase to continue</h1>
        <p className="mt-2 text-sm text-ink-soft">
          Set <code>NEXT_PUBLIC_SUPABASE_URL</code>, <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> and <code>SUPABASE_SERVICE_ROLE_KEY</code>, then run the migration in <code>supabase/migrations</code>. See the README.
        </p>
      </div>
    </div>
  );
}

export const fmtDate = (d: string | null | undefined) =>
  d ? new Date(d.length === 10 ? `${d}T12:00:00` : d).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }) : "Date TBD";
