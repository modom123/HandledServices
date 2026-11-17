/*
 * FILE    : apps/web/lib/project-estimate.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-11-17_1446 UTC
 * PURPOSE : "Post your project" → instant estimate. From the customer's description (and photos, if any), the AI picks
 *           the service and fills in its pricing questions (lib/ai/identify.ts); the price itself always comes from the
 *           rules engine in @handled/core (estimate + the area price level for the ZIP), never from the AI. A service the
 *           customer picked wins over the AI's pick. Without the AI, a picked service is priced on typical answers.
 *           Business & Technology stays consultation-only (no price; a free video consultation sets it).
 * UPDATED : 2026-11-17_1600 UTC — up to $2,500 is an instant, bookable price with no call or site visit (core
 *           siteVisitReason); the estimate carries the exact price (point) and, when a visit is needed, why.
 */
import "server-only";
import { consultOnly, defaultAnswers, estimate, getService, serviceText, siteVisitReason, type Answers } from "@handled/core";
import { aiIdentifyJob } from "./ai/identify";
import { aiEnabled } from "./ai/client";
import { regionFactor } from "./launch";

export type ProjectEstimate = {
  service_slug: string | null;
  service_name: string | null;
  alternatives: { slug: string; name: string }[];
  summary: string | null;
  /** What the price assumes, in plain words (question → answer), so the customer can see and correct it. */
  assumptions: { label: string; value: string }[];
  answers: Answers;
  notes: string | null;
  /** null when there's no price to show (no service matched, or consultation-only work). */
  price: { point: number; low: number; high: number; items: { label: string; amount: number }[] } | null;
  site_visit: boolean;
  /** Why a site visit / call comes first (over $2,500, events, safety); null = book at this price now. */
  visit_reason: string | null;
  consult_only: boolean;
  ai: boolean;
  /** true when the AI read the details; false when we priced on typical answers. */
  tailored: boolean;
};

function describe(slug: string, answers: Answers) {
  const svc = getService(slug);
  if (!svc) return [];
  const shown = svc.questions.filter((q) => !q.showIf || q.showIf.is.includes(answers[q.showIf.id] as string | boolean));
  return shown.slice(0, 8).flatMap((q) => {
    const v = answers[q.id];
    if (v === undefined || v === null || v === "") return [];
    if (q.type === "select") return [{ label: q.label, value: q.options.find((o) => o.value === v)?.label ?? String(v) }];
    if (q.type === "number") return Number(v) ? [{ label: q.label, value: `${v}${q.unit ? ` ${q.unit}` : ""}` }] : [];
    return [{ label: q.label, value: v ? "Yes" : "No" }];
  });
}

export async function estimateProject(o: { service?: string | null; details?: string | null; zip?: string | null; photoUrls?: string[]; locale?: "en" | "es" }): Promise<ProjectEstimate> {
  const locale = o.locale ?? "en";
  const picked = o.service && getService(o.service) ? o.service : null;
  const note = [picked ? `Service the customer chose: ${getService(picked)!.name}` : "", o.details?.trim() ?? ""].filter(Boolean).join("\n");
  const ai = aiEnabled();
  const id = ai && (note.trim() || o.photoUrls?.length) ? await aiIdentifyJob({ photoUrls: o.photoUrls ?? [], note, locale }).catch(() => null) : null;

  const slug = picked ?? id?.service_slug ?? null;
  const name = (s: string) => serviceText(locale, s, getService(s)!).name;
  const alternatives = (id ? [id.service_slug, ...id.alternatives] : []).filter((s): s is string => Boolean(s && s !== slug && getService(s))).slice(0, 3).map((s) => ({ slug: s, name: name(s) }));
  const base = { alternatives, summary: id?.summary ?? null, notes: id?.notes ?? null, ai };
  if (!slug) return { ...base, service_slug: null, service_name: null, assumptions: [], answers: {}, price: null, site_visit: false, visit_reason: null, consult_only: false, tailored: false };

  const svc = getService(slug)!;
  // the AI's answers count only when it priced the same service we're quoting
  const tailored = Boolean(id && id.service_slug === slug);
  const answers: Answers = tailored ? id!.answers : defaultAnswers(svc);
  const common = { ...base, service_slug: slug, service_name: name(slug), assumptions: describe(slug, answers), answers, tailored };
  if (consultOnly(slug)) return { ...common, price: null, site_visit: true, visit_reason: siteVisitReason(slug, answers, null), consult_only: true };

  const zip = o.zip && /^\d{5}$/.test(o.zip) ? o.zip : null;
  const e = estimate({ slug, answers, region: zip ? await regionFactor(zip, slug) : 1 });
  const why = siteVisitReason(slug, answers, e.point);
  return { ...common, price: { point: e.point, low: e.low, high: e.high, items: e.items.map((i) => ({ label: i.label, amount: i.amount })) }, site_visit: Boolean(why), visit_reason: why, consult_only: false };
}
