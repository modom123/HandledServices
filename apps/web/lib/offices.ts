/*
 * FILE    : apps/web/lib/offices.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-11-17_2300 UTC
 * PURPOSE : Front Office → the executives' offices (owner, 2026-11-17):
 *             odom   — Mark Odom, CEO: email, Zoom, and the important ops tools (today, alerts, legal reviews, money)
 *             gulley — Cecilia Gulley, Chief Strategy / Recruiting: email, Zoom, and the recruiting tools
 *           Each office has its own mailbox on the company mail host and its own Zoom. Settings (Vercel → Environment
 *           Variables, never pasted in chat or email), per office KEY = ODOM or GULLEY:
 *             OFFICE_<KEY>_EMAIL      their mailbox address (e.g. mark@handledsvc.com)
 *             OFFICE_<KEY>_PASSWORD   that mailbox's password
 *             OFFICE_<KEY>_ZOOM_LINK  their Personal Meeting Room link (optional)
 *             OFFICE_<KEY>_ZOOM_USER  their Zoom login email, for scheduling meetings (defaults to OFFICE_<KEY>_EMAIL)
 *           Scheduling Zoom meetings also needs the company Zoom app (lib/zoom.ts).
 *           Offices are admin-only pages (personal mail).
 */
import "server-only";
import type { MailAccount } from "./mailbox";

export type OfficeTools = "ops" | "recruiting";
export interface Office { slug: string; key: string; name: string; first: string; title: string; tools: OfficeTools; icon: string }

export const OFFICES: Office[] = [
  { slug: "odom", key: "ODOM", name: "Mark Odom", first: "Mark", title: "CEO", tools: "ops", icon: "👔" },
  { slug: "gulley", key: "GULLEY", name: "Cecilia Gulley", first: "Cecilia", title: "Chief Strategy & Recruiting Officer", tools: "recruiting", icon: "🎯" },
];

export const officeBySlug = (slug: string) => OFFICES.find((o) => o.slug === slug) ?? null;
const env = (o: Office, k: string) => process.env[`OFFICE_${o.key}_${k}`]?.trim() || null;

export const officeEmail = (o: Office) => env(o, "EMAIL");
export const officeMail = (o: Office): MailAccount | null => {
  const user = env(o, "EMAIL"), pass = env(o, "PASSWORD");
  return user && pass ? { user, pass } : null;
};
export const officeZoomLink = (o: Office) => env(o, "ZOOM_LINK");
export const officeZoomUser = (o: Office) => env(o, "ZOOM_USER") ?? env(o, "EMAIL");
/** The sign-off on emails from an office. */
export const officeSignature = (o: Office) => `\n\n${o.name}\n${o.title}, Handled`;
