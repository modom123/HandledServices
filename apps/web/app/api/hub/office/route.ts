/*
 * FILE    : apps/web/app/api/hub/office/route.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-11-17_2300 UTC
 * PURPOSE : Front Office → an executive's office (admins only). POST JSON, `office` = odom | gulley:
 *             { action: "compose", office, to, subject, text }                              — email from the office's mailbox
 *             { action: "reply", office, uid, to, subject, text, in_reply_to?, references? } — answer an email in it
 *             { action: "zoom", office, topic, start, minutes, invite?, note? }             — schedule a Zoom meeting on the
 *               office's Zoom; with `invite` (an email) the invitation goes out from the office's mailbox
 *             { action: "verify", office }                                                   — test the mailbox login
 * UPDATED : 2026-11-17_2300 UTC — the shared to-do list between the offices (lib/office-todos.ts), `office` = the desk acting:
 *             { action: "todo_add", office, to, title, details?, due_date?, priority? }
 *             { action: "todo_send", office, id, note? }        — over to the other office
 *             { action: "todo_done" | "todo_reopen", office, id, note? }
 *             { action: "todo_note", office, id, note }
 *             { action: "todo_delete", office, id }
 * UPDATED : 2026-11-17_2330 UTC — smoother email: the office page reads mail in place (no page change), so going back never
 *           leaves the office:  { action: "inbox", office, limit? }  { action: "read", office, uid }
 * UPDATED : 2026-11-20_1500 UTC — `box: "leads"` on compose / reply / inbox / read / verify uses the business-leads mailbox
 *           (mark@handledsvc.net, Mark's office only); reading one shows which business lead wrote.
 * UPDATED : 2026-11-24_1500 UTC — `box: "company"` = the company mailbox (info@handledsvc.com), Mark's office only. Reading an
 *           email there or in the business-leads box shows which business lead wrote; a lead's reply in info@ marks
 *           the lead replied (as the Email Center inbox does).
 * UPDATED : 2026-11-24_1600 UTC — `box: "net"` = the office's handledsvc.net mailbox (Cecilia: cece@handledsvc.net).
 * UPDATED : 2026-11-24_2345 UTC — { action: "ai_draft", office, box?, uid, instructions? }: ✨ Draft with AI for the email being read
 *           (business-lead replies use the sales agent's rule-checked draft; otherwise lib/ai/office-reply). Nothing is sent.
 */
import { z } from "zod";
import { ADMINS_ONLY, deny, getViewer, isAdmin } from "@/lib/auth";
import { leadsMail, officeBySlug, officeMail, officeNetMail, officeSignature, officeZoomUser } from "@/lib/offices";
import { adminClient } from "@/lib/supabase/server";
import { companyMail, listInbox, mailboxUser, readMessage, saveToSent, sendMail, verifyMailbox } from "@/lib/mailbox";
import { createZoomMeeting } from "@/lib/zoom";
import { addTodo, deleteTodo, noteTodo, sendTodo, setTodoDone } from "@/lib/office-todos";

const office = z.string().refine((s) => Boolean(officeBySlug(s)), "Unknown office");
const box = z.enum(["office", "leads", "company", "net"]).optional();
const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("compose"), office, box, to: z.string().email(), subject: z.string().trim().min(1).max(200), text: z.string().min(1).max(50000) }),
  z.object({ action: z.literal("reply"), office, box, uid: z.number().int(), to: z.string().email(), subject: z.string().min(1).max(200), text: z.string().min(1).max(50000),
    in_reply_to: z.string().max(500).nullable().optional(), references: z.string().max(5000).nullable().optional() }),
  z.object({ action: z.literal("zoom"), office, topic: z.string().trim().min(2).max(200), start: z.string().datetime({ offset: true }), minutes: z.number().int().min(10).max(480),
    invite: z.string().email().nullable().optional().or(z.literal("")), note: z.string().max(2000).nullable().optional() }),
  z.object({ action: z.literal("verify"), office, box }),
  z.object({ action: z.literal("inbox"), office, box, limit: z.number().int().min(1).max(100).optional() }),
  z.object({ action: z.literal("read"), office, box, uid: z.number().int().min(1) }),
  z.object({ action: z.literal("ai_draft"), office, box, uid: z.number().int().min(1), instructions: z.string().max(1000).nullable().optional() }),
  z.object({ action: z.literal("todo_add"), office, to: office, title: z.string().trim().min(2).max(200), details: z.string().max(4000).nullable().optional(),
    due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional().or(z.literal("")), priority: z.enum(["normal", "high"]).optional() }),
  z.object({ action: z.enum(["todo_send", "todo_done", "todo_reopen", "todo_delete"]), office, id: z.string().uuid(), note: z.string().max(2000).nullable().optional() }),
  z.object({ action: z.literal("todo_note"), office, id: z.string().uuid(), note: z.string().trim().min(1).max(2000) }),
]);

export async function POST(req: Request) {
  const v = await getViewer(req);
  if (!isAdmin(v)) return deny(403, ADMINS_ONLY);
  const b = Body.safeParse(await req.json().catch(() => null));
  if (!b.success) return deny(400, b.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "));
  const d = b.data;
  const o = officeBySlug(d.office)!;
  const which = "box" in d && d.box ? d.box : "office";
  const leads = which === "leads", company = which === "company", net = which === "net";
  if (leads && !o.leadsInbox) return deny(403, "This office has no business-leads inbox");
  if (company && !o.companyInbox) return deny(403, "This office has no company inbox");
  if (net && !o.netInbox) return deny(403, "This office has no handledsvc.net inbox");
  const acct = leads ? await leadsMail() : company ? companyMail() : net ? await officeNetMail(o) : await officeMail(o);
  const mailOff = leads ? "The business-leads mailbox isn't connected yet (OUTREACH_SMTP_USER and OUTREACH_SMTP_PASSWORD in Vercel)."
    : net ? `${o.first}'s handledsvc.net mailbox isn't connected yet (OFFICE_${o.key}_NET_EMAIL and OFFICE_${o.key}_NET_PASSWORD in Vercel).`
    : company ? `The company mailbox ${mailboxUser() ?? "(info@)"} isn't connected yet (SMTP_USER and SMTP_PASSWORD in Vercel).`
    : `${o.name}'s mailbox isn't connected yet (OFFICE_${o.key}_EMAIL and OFFICE_${o.key}_PASSWORD in Vercel).`;

  try {
    switch (d.action) {
      case "todo_add":
        return Response.json({ ok: true, todo: await addTodo({ office: d.office, to: d.to, title: d.title, details: d.details ?? null, due_date: d.due_date || null, priority: d.priority }, v!.email) });
      case "todo_send": await sendTodo(d.id, d.office, d.note ?? null, v!.email); return Response.json({ ok: true });
      case "todo_done": await setTodoDone(d.id, d.office, true, d.note ?? null, v!.email); return Response.json({ ok: true });
      case "todo_reopen": await setTodoDone(d.id, d.office, false, d.note ?? null, v!.email); return Response.json({ ok: true });
      case "todo_note": await noteTodo(d.id, d.office, d.note, v!.email); return Response.json({ ok: true });
      case "todo_delete": await deleteTodo(d.id); return Response.json({ ok: true });
      case "inbox":
        if (!acct) return deny(409, mailOff);
        return Response.json({ ok: true, items: await listInbox(d.limit ?? 25, acct) });
      case "read": {
        if (!acct) return deny(409, mailOff);
        const m = await readMessage(d.uid, acct);
        if (!m) return deny(404, "That email isn't in the inbox anymore");
        // business-leads and company inboxes: who this is on our lead list
        const lead = (leads || company) && m.from ? (await adminClient().from("biz_leads").select("id, business_name, status").ilike("email", m.from.replace(/[\\%_]/g, "\\$&")).limit(1).maybeSingle()).data : null;
        if (company && lead && ["queued", "emailing", "clicked", "new"].includes((lead as { status: string }).status)) {
          const { setBizLeadStatus } = await import("@/lib/biz-leads");
          await setBizLeadStatus((lead as { id: string }).id, "replied", "Replied by email (info@ inbox, Mark's office)", "office").catch(() => {});
        }
        return Response.json({ ok: true, message: m, lead });
      }
      case "ai_draft": {
        // ✨ Draft with AI: a business lead's reply in the leads inbox uses the sales agent's rule-checked draft; anything
        // else gets a reply drafted as this office's person. Nothing is sent here.
        if (!acct) return deny(409, mailOff);
        const m = await readMessage(d.uid, acct);
        if (!m) return deny(404, "That email isn't in the inbox anymore");
        const lead = (leads || company) && m.from ? (await adminClient().from("biz_leads").select("id, business_name, status, reply_text").ilike("email", m.from.replace(/[\\%_]/g, "\\$&")).limit(1).maybeSingle()).data as { id: string; business_name: string | null; status: string | null; reply_text: string | null } | null : null;
        if (leads && lead?.reply_text && !d.instructions?.trim()) {
          const r = await (await import("@/lib/biz-leads")).redraftOutreachReply(lead.id);
          if (r.ok && r.draft) return Response.json({ ok: true, draft: r.draft, note: "Drafted by the sales agent from their reply. Check every word.", leadId: lead.id });
        }
        const { draftOfficeReply } = await import("@/lib/ai/office-reply");
        const out = await draftOfficeReply({ sender: { name: o.name, title: o.title }, inbox: acct.user, email: { from: m.from, fromName: m.fromName, subject: m.subject, text: m.text }, lead, instructions: d.instructions ?? null });
        if (!out) return deny(503, "The AI couldn't draft this one (or ANTHROPIC_API_KEY isn't set). Write it yourself.");
        return Response.json({ ok: true, draft: out.reply, note: out.note, leadId: leads ? lead?.id ?? null : null });
      }
      case "verify":
        return Response.json({ ok: true, ...(await verifyMailbox(acct ?? { user: "", pass: "" })) });
      case "compose":
      case "reply": {
        if (!acct) return deny(409, mailOff);
        const text = `${d.text.trimEnd()}${officeSignature(o)}`;
        const reply = d.action === "reply" ? d : null;
        const id = await sendMail({ to: d.to, subject: d.subject, text, fromName: o.name, inReplyTo: reply?.in_reply_to ?? null, references: reply?.references ?? null }, acct);
        await saveToSent({ to: d.to, subject: d.subject, text, fromName: o.name, messageId: id, inReplyTo: reply?.in_reply_to ?? null }, acct).catch(() => {});
        return Response.json({ ok: true });
      }
      case "zoom": {
        const user = officeZoomUser(o);
        if (!user) return deny(409, `Set OFFICE_${o.key}_ZOOM_USER (${o.first}'s Zoom login email) in Vercel to schedule meetings.`);
        const m = await createZoomMeeting(user, { topic: d.topic, start: d.start, minutes: d.minutes, agenda: d.note ?? null });
        let invited = false;
        if (d.invite) {
          if (!acct) return Response.json({ ok: true, meeting: m, invited: false, warning: `Meeting made, but no invite sent: ${mailOff}` });
          const when = new Date(d.start).toLocaleString("en-US", { timeZone: "America/Detroit", weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" });
          const text = `Hi,\n\nHere's the Zoom link for "${d.topic}" on ${when} (${d.minutes} minutes).\n\nJoin: ${m.join_url}${m.password ? `\nPasscode: ${m.password}` : ""}${d.note ? `\n\n${d.note}` : ""}${officeSignature(o)}`;
          const id = await sendMail({ to: d.invite, subject: `Zoom: ${d.topic} — ${when}`, text, fromName: o.name }, acct);
          await saveToSent({ to: d.invite, subject: `Zoom: ${d.topic} — ${when}`, text, fromName: o.name, messageId: id }, acct).catch(() => {});
          invited = true;
        }
        return Response.json({ ok: true, meeting: m, invited });
      }
    }
  } catch (e) {
    return deny(502, (e as Error).message);
  }
}
