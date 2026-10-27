/*
 * FILE    : apps/web/lib/pro-team.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-27_2300 UTC
 * PURPOSE : Office team for pro companies (contractor_members). The owner invites an office manager by email; they sign in
 *           with that email (web or app) and act for the company: offers, calendar, jobs, crew, customer messages.
 *           Money, tax, contracts, documents, prices and the team stay with the owner (lib/auth ownerOnly).
 *             listTeam    — the company's office team
 *             inviteTeam  — add someone and email them a one-click sign-in link
 *             removeTeam  — end their access right away
 *             leaveTeam   — the office manager deleted their own login
 */
import "server-only";
import { BRAND } from "@handled/core";
import { adminClient } from "./supabase/server";
import { sendEmail, siteUrl } from "./notify";
import { signInUrl } from "./recruiting";

const db = () => adminClient();
type R<T = object> = ({ ok: true } & T) | { ok: false; error: string };

export const TEAM_LIMIT = 5;

export interface TeamMember { id: string; email: string; full_name: string; phone: string | null; role: "office"; invited_at: string; accepted_at: string | null; last_seen_at: string | null }

export async function listTeam(contractorId: string): Promise<TeamMember[]> {
  const { data } = await db().from("contractor_members").select("id, email, full_name, phone, role, invited_at, accepted_at, last_seen_at")
    .eq("contractor_id", contractorId).eq("active", true).order("invited_at");
  return (data ?? []) as TeamMember[];
}

export async function inviteTeam(contractorId: string, m: { full_name: string; email: string; phone?: string | null; locale: "en" | "es" }, by: string): Promise<R<{ id: string }>> {
  const email = m.email.trim().toLowerCase();
  const { data: c } = await db().from("contractors").select("business_name, email").eq("id", contractorId).single();
  if (!c) return { ok: false, error: "Pro not found" };
  if (email === String(c.email).toLowerCase()) return { ok: false, error: "That's your own email — you're already the owner" };
  const { data: pro } = await db().from("contractors").select("id").ilike("email", email).maybeSingle();
  if (pro) return { ok: false, error: "That email has its own pro account. Use a different email for the office login." };
  if ((await listTeam(contractorId)).length >= TEAM_LIMIT) return { ok: false, error: `Up to ${TEAM_LIMIT} office logins` };
  const { data, error } = await db().from("contractor_members").insert({ contractor_id: contractorId, email, full_name: m.full_name.trim(), phone: m.phone || null, invited_by: by }).select("id").single();
  if (error || !data) return { ok: false, error: /duplicate|unique/i.test(error?.message ?? "") ? "That email already runs the office for a pro company" : error?.message ?? "Could not add" };
  const link = await signInUrl(email, "/pro");
  const first = m.full_name.trim().split(" ")[0];
  if (m.locale === "es") await sendEmail(email, `${c.business_name} le dio acceso a su cuenta de ${BRAND.name}`,
    `Hola ${first}:\n\n${c.business_name} le agregó como encargado(a) de oficina en ${BRAND.name}. Puede aceptar ofertas, manejar el calendario, elegir quién del equipo va a cada trabajo y escribir a los clientes.\n\nUn clic inicia su sesión:\n${link}\n\nTambién puede usar la app de ${BRAND.name} ("Soy profesional") con este correo.\n\n— ${BRAND.name}`).catch(() => false);
  else await sendEmail(email, `${c.business_name} gave you access to their ${BRAND.name} account`,
    `Hi ${first},\n\n${c.business_name} added you as an office manager on ${BRAND.name}. You can accept job offers, run the calendar, pick who on the crew goes to each job and message customers.\n\nOne click signs you in:\n${link}\n\nYou can also use the ${BRAND.name} app ("I'm a pro") with this email. Learn more: ${siteUrl()}/pros\n\n— ${BRAND.name}`).catch(() => false);
  return { ok: true, id: data.id as string };
}

export async function removeTeam(contractorId: string, id: string): Promise<R> {
  const { data } = await db().from("contractor_members").update({ active: false, removed_at: new Date().toISOString() }).eq("id", id).eq("contractor_id", contractorId).eq("active", true).select("id").maybeSingle();
  return data ? { ok: true } : { ok: false, error: "Not on your team" };
}

export async function leaveTeam(profileId: string) {
  await db().from("contractor_members").update({ active: false, removed_at: new Date().toISOString(), profile_id: null }).eq("profile_id", profileId).eq("active", true);
}
