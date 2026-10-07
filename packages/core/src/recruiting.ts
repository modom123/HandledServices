/*
 * FILE    : packages/core/src/recruiting.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-02_0006 UTC
 * PURPOSE : The pro recruiting pipeline, end to end, as plain rules the Hub, the daily sweep
 *           and the IEBC recruiting agents share:
 *             applied → screened → invited → onboarding → verifying → background → active
 *           (or rejected / dropped). Who gets invited automatically, when to follow up,
 *           and when someone is stuck.
 * UPDATED : 2026-10-05_0246 UTC — screening interview stages (interview / interviewed) and interview settings.
 */

export type PipelineStage = "applied" | "screened" | "interview" | "interviewed" | "invited" | "onboarding" | "verifying" | "background" | "active" | "rejected" | "dropped";

export const STAGE_LABEL: Record<PipelineStage, string> = {
  applied: "Applied",
  screened: "Screened — needs a decision",
  interview: "Interview link sent / in progress",
  interviewed: "Interviewed — needs a decision",
  invited: "Invited — hasn't started setup",
  onboarding: "Doing setup",
  verifying: "Documents being verified",
  background: "Background check",
  active: "Active",
  rejected: "Not a fit",
  dropped: "Dropped off",
};

/** Funnel order for the Hub. */
export const PIPELINE: PipelineStage[] = ["applied", "screened", "interview", "interviewed", "invited", "onboarding", "verifying", "background", "active"];

export interface RecruitingSettings {
  /** Invite strong applicants automatically (AI screen ≥ minScore and not "decline"). */
  autoInvite: boolean;
  minScore: number;
  /** Send every applicant who isn't a clear decline the screening interview before any invite. */
  interviewRequired: boolean;
  /** After an interview the AI scores as "advance", invite without waiting for staff (off: a person always decides). */
  autoInviteAfterInterview: boolean;
  /** Activate a pro as soon as every step is done, documents verified and background clear. */
  autoActivate: boolean;
  /** Days after the invite to send setup reminders. */
  reminderDays: number[];
  /** No progress for this many days after the last reminder → dropped (can be revived). */
  dropAfterDays: number;
  /** Alert ops when an application waits this long for a decision. */
  decisionHours: number;
}

export const RECRUITING_DEFAULTS: RecruitingSettings = {
  autoInvite: true,
  minScore: 70,
  interviewRequired: true,
  autoInviteAfterInterview: false,
  autoActivate: true,
  reminderDays: [1, 3, 7, 14],
  dropAfterDays: 30,
  decisionHours: 48,
};

export function mergeRecruiting(saved: Partial<RecruitingSettings> | null | undefined): RecruitingSettings {
  return { ...RECRUITING_DEFAULTS, ...(saved ?? {}) };
}

/** Should this applicant be invited without waiting for staff? */
export function autoInviteDecision(s: RecruitingSettings, screen: { recommendation: string; score: number } | null): { invite: boolean; why: string } {
  if (!s.autoInvite) return { invite: false, why: "auto-invite is off" };
  if (!screen) return { invite: false, why: "no AI screen — staff decides" };
  if (screen.recommendation === "decline") return { invite: false, why: "AI suggests declining — staff decides" };
  if (screen.score < s.minScore) return { invite: false, why: `AI score ${screen.score} is under ${s.minScore} — staff decides` };
  return { invite: true, why: `AI score ${screen.score}` };
}

/** Where someone is in the pipeline. */
export function pipelineStage(o: {
  appStage?: string | null;
  contractorStatus?: string | null;
  steps?: { key: string; done: boolean }[];
  pendingDocs?: number;
  backgroundStatus?: string | null;
  droppedAt?: string | null;
}): PipelineStage {
  if (o.appStage === "rejected" || o.appStage === "withdrawn") return "rejected";
  if (o.contractorStatus === "approved") return "active";
  if (o.droppedAt) return "dropped";
  if (!o.contractorStatus) return o.appStage === "interviewing" ? "interview" : o.appStage === "interviewed" ? "interviewed" : o.appStage === "screened" ? "screened" : "applied";
  const steps = o.steps ?? [];
  if (!steps.some((x) => x.done)) return "invited";
  const left = steps.filter((x) => !x.done && x.key !== "background");
  const isDoc = (k: string) => k === "coi" || k === "license" || k.startsWith("coverage:");
  if (!left.length) return steps.some((x) => x.key === "background" && !x.done) ? "background" : "verifying";
  if ((o.pendingDocs ?? 0) > 0 && left.every((x) => isDoc(x.key))) return "verifying";
  return "onboarding";
}

/** Next setup reminder due (index into reminderDays), or null when none is due now. */
export function reminderDue(s: RecruitingSettings, invitedAt: string | null | undefined, remindersSent: number, now = new Date()): number | null {
  if (!invitedAt || remindersSent >= s.reminderDays.length) return null;
  const days = (now.getTime() - new Date(invitedAt).getTime()) / 86400000;
  return days >= s.reminderDays[remindersSent] ? remindersSent : null;
}

/** No progress long after the last reminder → dropped. */
export function shouldDrop(s: RecruitingSettings, invitedAt: string | null | undefined, remindersSent: number, now = new Date()): boolean {
  if (!invitedAt || remindersSent < s.reminderDays.length) return false;
  return (now.getTime() - new Date(invitedAt).getTime()) / 86400000 >= s.dropAfterDays;
}
