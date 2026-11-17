/*
 * FILE    : apps/web/lib/office-todos.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-11-17_2300 UTC
 * PURPOSE : The shared to-do list between the Front Office offices (owner, 2026-11-17: "a to do list which goes back and
 *           forth between the 2 offices"). Each item sits on one office's desk; either office can send it across with a
 *           note, mark it done or reopen it. Every step is kept in the item's history, and the receiving office gets an
 *           email when something lands on their desk.
 *             listTodos(), addTodo(), sendTodo(), setTodoDone(), noteTodo(), deleteTodo()
 */
import "server-only";
import { adminClient } from "./supabase/server";
import { sendEmail, siteUrl } from "./notify";
import { officeBySlug, officeEmail, OFFICES } from "./offices";

export interface TodoStep { at: string; office: string; by: string | null; action: "created" | "sent" | "done" | "reopened" | "note"; note?: string | null }
export interface OfficeTodo {
  id: string; title: string; details: string | null; created_by_office: string; assigned_to: string; due_date: string | null;
  priority: "normal" | "high"; status: "open" | "done"; history: TodoStep[]; created_by: string | null; created_at: string; updated_at: string; done_at: string | null;
}

const db = () => adminClient();
export const otherOffice = (slug: string) => OFFICES.find((o) => o.slug !== slug)!.slug;
const step = (office: string, by: string | null, action: TodoStep["action"], note?: string | null): TodoStep => ({ at: new Date().toISOString(), office, by, action, note: note || null });

async function load(id: string) {
  const { data } = await db().from("office_todos").select("*").eq("id", id).maybeSingle();
  if (!data) throw new Error("To-do not found");
  return data as OfficeTodo;
}

/** Open items (high priority, then by due date) and the last 15 done. */
export async function listTodos(): Promise<{ open: OfficeTodo[]; done: OfficeTodo[]; error: string | null }> {
  const [o, d] = await Promise.all([
    db().from("office_todos").select("*").eq("status", "open").order("due_date", { ascending: true, nullsFirst: false }).order("created_at").limit(300),
    db().from("office_todos").select("*").eq("status", "done").order("done_at", { ascending: false }).limit(15),
  ]);
  const open = ((o.data ?? []) as OfficeTodo[]).sort((a, b) => (a.priority === b.priority ? 0 : a.priority === "high" ? -1 : 1));
  return { open, done: (d.data ?? []) as OfficeTodo[], error: o.error?.message ?? null };
}

async function tell(to: string, from: string, t: Pick<OfficeTodo, "title" | "due_date" | "priority">, note: string | null) {
  const o = officeBySlug(to), f = officeBySlug(from);
  const addr = o ? officeEmail(o) : null;
  if (!o || !f || !addr) return;
  await sendEmail(addr, `${t.priority === "high" ? "[High] " : ""}To-do from ${f.name}: ${t.title}`,
    `${f.name} put this on your desk:\n\n${t.title}${t.due_date ? `\nDue ${t.due_date}` : ""}${note ? `\n\n${note}` : ""}\n\nYour office: ${siteUrl()}/hub/office/${o.slug}`).catch(() => false);
}

export async function addTodo(o: { office: string; to: string; title: string; details?: string | null; due_date?: string | null; priority?: "normal" | "high" }, by: string | null) {
  const row = {
    title: o.title.trim(), details: o.details?.trim() || null, created_by_office: o.office, assigned_to: o.to, due_date: o.due_date || null,
    priority: o.priority ?? "normal", history: [step(o.office, by, "created", o.to !== o.office ? `for ${officeBySlug(o.to)?.name}` : null)], created_by: by,
  };
  const { data, error } = await db().from("office_todos").insert(row).select("*").single();
  if (error) throw new Error(error.message);
  if (o.to !== o.office) await tell(o.to, o.office, row, row.details);
  return data as OfficeTodo;
}

/** Send the item to the other office's desk, with an optional note (it goes back and forth as many times as needed). */
export async function sendTodo(id: string, office: string, note: string | null, by: string | null) {
  const t = await load(id);
  const to = otherOffice(t.assigned_to);
  const { error } = await db().from("office_todos").update({
    assigned_to: to, status: "open", done_at: null, updated_at: new Date().toISOString(), history: [...t.history, step(office, by, "sent", note ? `to ${officeBySlug(to)?.name}: ${note}` : `to ${officeBySlug(to)?.name}`)],
  }).eq("id", id);
  if (error) throw new Error(error.message);
  await tell(to, office, t, note);
}

export async function setTodoDone(id: string, office: string, done: boolean, note: string | null, by: string | null) {
  const t = await load(id);
  const now = new Date().toISOString();
  const { error } = await db().from("office_todos").update({
    status: done ? "done" : "open", done_at: done ? now : null, updated_at: now, history: [...t.history, step(office, by, done ? "done" : "reopened", note)],
  }).eq("id", id);
  if (error) throw new Error(error.message);
  // the other office asked for it: let them know it's done
  if (done && t.created_by_office !== office) await tell(t.created_by_office, office, { ...t, title: `Done — ${t.title}` }, note);
}

export async function noteTodo(id: string, office: string, note: string, by: string | null) {
  const t = await load(id);
  const { error } = await db().from("office_todos").update({ updated_at: new Date().toISOString(), history: [...t.history, step(office, by, "note", note)] }).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteTodo(id: string) {
  const { error } = await db().from("office_todos").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
