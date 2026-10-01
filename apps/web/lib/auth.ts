/*
 * FILE    : apps/web/lib/auth.ts
 * PROJECT : Handled — AI-run home & business services
 * CREATED : 2026-10-01_1723 UTC
 * PURPOSE : Resolve who is calling. Web requests use the Supabase session cookie;
 *           the mobile app sends `Authorization: Bearer <supabase access token>`.
 */
import "server-only";
import type { Role } from "@handled/core";
import { serverClient, tokenClient } from "./supabase/server";
import { supabaseConfigured } from "./supabase/env";

export interface Viewer {
  userId: string;
  email: string;
  role: Role;
  fullName: string | null;
  contractorId: string | null;
  db: Awaited<ReturnType<typeof serverClient>> | ReturnType<typeof tokenClient>;
}

export async function getViewer(req?: Request): Promise<Viewer | null> {
  if (!supabaseConfigured) return null;
  const bearer = req?.headers.get("authorization")?.match(/^Bearer (.+)$/i)?.[1];
  const db = bearer ? tokenClient(bearer) : await serverClient();
  const { data } = bearer ? await db.auth.getUser(bearer) : await db.auth.getUser();
  const user = data.user;
  if (!user) return null;
  const [{ data: profile }, { data: contractor }] = await Promise.all([
    db.from("profiles").select("role, full_name").eq("id", user.id).maybeSingle(),
    db.from("contractors").select("id").eq("profile_id", user.id).maybeSingle(),
  ]);
  return {
    userId: user.id,
    email: user.email ?? "",
    role: (profile?.role as Role) ?? "customer",
    fullName: profile?.full_name ?? null,
    contractorId: contractor?.id ?? null,
    db,
  };
}

export const isStaff = (v: Viewer | null) => v?.role === "admin" || v?.role === "dispatcher";

export function deny(status = 403, message = "Not allowed") {
  return Response.json({ error: message }, { status });
}
