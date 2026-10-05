/*
 * FILE    : apps/web/app/api/hub/bids/route.ts
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-05_1954 UTC
 * PURPOSE : Staff controls for the bid engine (Hub → Bids). POST JSON { action, … }:
 *             create · fields · go · upload_url · add_doc · doc_link · delete_doc · read (AI compliance matrix) ·
 *             req (add / edit / check off) · delete_req · lines (pricing + assumptions) · candidates · ask_pros ·
 *             quote_status · use_quotes · review · status · submit · result · benchmark
 *           The submit gate is enforced server-side (lib/bids.ts markSubmitted), not only on screen.
 * UPDATED : 2026-10-05_2043 UTC — archive: reopen (revise & resubmit), copy (next cycle), versioned uploads (replaces), solicitation type.
 */
import { z } from "zod";
import { BID_SOURCES, GO_NO_GO, REQ_KIND_LABEL, RESUBMIT_REASONS, REVIEW_CHECKS, SOLICITATION_TYPES } from "@handled/core";
import { deny, getViewer, isStaff } from "@/lib/auth";
import {
  addBenchmark, addDocument, askProsForPrices, candidatePros, createBid, deleteDocument, deleteRequirement, docLink, markSubmitted, readSolicitation,
  copyBid, recordResult, reopenForRevision, saveBidFields, saveLines, saveRequirement, setBidStatus, setGo, setQuoteStatus, signOffReview, uploadUrl, useBestQuotes,
} from "@/lib/bids";

export const maxDuration = 300;

const uuid = z.string().uuid();
const money = z.number().min(0).max(100_000_000);
const iso = z.string().datetime({ offset: true }).nullable().or(z.literal("").transform(() => null));
const source = z.enum(Object.keys(BID_SOURCES) as [string, ...string[]]);
const kind = z.enum(Object.keys(REQ_KIND_LABEL) as [string, ...string[]]);
const goAns = z.enum(["yes", "no", "unsure"]);
const stype = z.enum(Object.keys(SOLICITATION_TYPES) as [string, ...string[]]);

const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("create"), notice_id: z.string().max(120).nullable().optional(), title: z.string().trim().max(300).optional(), agency: z.string().trim().max(200).nullable().optional(), source: source.optional(), solicitation_type: stype.optional(), solicitation_number: z.string().trim().max(120).nullable().optional(), link: z.string().trim().url().nullable().optional().or(z.literal("").transform(() => null)), due_at: iso.optional() }),
  z.object({ action: z.literal("fields"), bid_id: uuid, title: z.string().trim().min(3).max(300).optional(), agency: z.string().trim().max(200).nullable().optional(), source: source.optional(), solicitation_type: stype.optional(), solicitation_number: z.string().trim().max(120).nullable().optional(), link: z.string().trim().max(500).nullable().optional(), due_at: iso.optional(), questions_due_at: iso.optional(), submit_method: z.string().trim().max(1000).nullable().optional(), term_years: z.number().min(0).max(30).nullable().optional(), notes: z.string().max(10000).nullable().optional() }),
  z.object({ action: z.literal("go"), bid_id: uuid, answers: z.record(z.string(), goAns).refine((a) => Object.keys(a).every((k) => GO_NO_GO.some((g) => g.id === k))), reason: z.string().max(2000).nullable().optional() }),
  z.object({ action: z.literal("upload_url"), bid_id: uuid, name: z.string().min(1).max(200) }),
  z.object({ action: z.literal("add_doc"), bid_id: uuid, kind: z.enum(["rfq", "addendum", "price_form", "draft", "confirmation", "other"]), name: z.string().min(1).max(200), path: z.string().min(5).max(400), size: z.number().int().min(0).nullable().optional(), replaces: uuid.nullable().optional(), note: z.string().max(500).nullable().optional() }),
  z.object({ action: z.literal("doc_link"), bid_id: uuid, doc_id: uuid }),
  z.object({ action: z.literal("delete_doc"), bid_id: uuid, doc_id: uuid }),
  z.object({ action: z.literal("read"), bid_id: uuid }),
  z.object({ action: z.literal("req"), bid_id: uuid, id: uuid.optional(), kind: kind.optional(), text: z.string().trim().min(2).max(1000).optional(), source_ref: z.string().max(120).nullable().optional(), response_ref: z.string().max(200).nullable().optional(), required: z.boolean().optional(), done: z.boolean().optional(), note: z.string().max(1000).nullable().optional() }),
  z.object({ action: z.literal("delete_req"), bid_id: uuid, id: uuid }),
  z.object({ action: z.literal("lines"), bid_id: uuid, lines: z.array(z.object({ id: uuid.optional(), item: z.string().trim().min(1).max(300), unit: z.string().trim().min(1).max(40), qty: z.number().min(0).max(1_000_000), years: z.number().min(0).max(30), pro_unit_cost: money.nullable(), materials_unit: money, benchmark: money.nullable(), slug: z.string().max(60).nullable().optional() })).max(100), removed: z.array(uuid).max(100), assumptions: z.record(z.string(), z.number().min(0).max(1000)).nullable(), margin_override: z.boolean().nullable() }),
  z.object({ action: z.literal("candidates"), bid_id: uuid }),
  z.object({ action: z.literal("ask_pros"), bid_id: uuid, contractor_ids: z.array(uuid).min(1).max(50) }),
  z.object({ action: z.literal("quote_status"), bid_id: uuid, quote_id: uuid, status: z.enum(["asked", "committed", "declined"]) }),
  z.object({ action: z.literal("use_quotes"), bid_id: uuid }),
  z.object({ action: z.literal("review"), bid_id: uuid, checks: z.record(z.string(), z.boolean()).refine((c) => Object.keys(c).every((k) => REVIEW_CHECKS.some((r) => r.id === k))) }),
  z.object({ action: z.literal("status"), bid_id: uuid, status: z.enum(["draft", "pricing", "review", "no_bid", "cancelled"]), reason: z.string().max(2000).nullable().optional() }),
  z.object({ action: z.literal("submit"), bid_id: uuid }),
  z.object({ action: z.literal("reopen"), bid_id: uuid, reason: z.enum(Object.keys(RESUBMIT_REASONS) as [string, ...string[]]), note: z.string().trim().min(5).max(2000) }),
  z.object({ action: z.literal("copy"), bid_id: uuid }),
  z.object({ action: z.literal("result"), bid_id: uuid, result: z.enum(["won", "lost"]), award_amount: money.nullable(), winning_price: money.nullable(), winner: z.string().max(200).nullable(), note: z.string().max(4000).nullable(), unit_awards: z.array(z.object({ line_id: uuid, price: money })).max(100) }),
  z.object({ action: z.literal("benchmark"), item: z.string().trim().min(2).max(300), unit: z.string().trim().min(1).max(40), price: money, agency: z.string().max(200).nullable(), source: z.string().max(200).nullable(), award_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(), note: z.string().max(1000).nullable() }),
]);

export async function POST(req: Request) {
  const v = await getViewer(req);
  if (!isStaff(v)) return deny();
  const b = Body.safeParse(await req.json().catch(() => null));
  if (!b.success) return deny(400, "Check the request");
  const d = b.data;
  const actor = v!.email ?? "staff";
  const ok = (extra: Record<string, unknown> = {}) => Response.json({ ok: true, ...extra });
  switch (d.action) {
    case "create": {
      const r = await createBid({ ...d, source: d.source as never, solicitation_type: d.solicitation_type as never }, actor);
      return Response.json(r, { status: r.ok ? 200 : 400 });
    }
    case "fields": { const { action: _a, bid_id, ...f } = d; await saveBidFields(bid_id, f as never); return ok(); }
    case "go": await setGo(d.bid_id, d.answers, d.reason ?? null); return ok();
    case "upload_url": { const r = await uploadUrl(d.bid_id, d.name); return Response.json(r, { status: r.ok ? 200 : 400 }); }
    case "add_doc": { const r = await addDocument(d.bid_id, d, actor); return Response.json(r, { status: r.ok ? 200 : 400 }); }
    case "doc_link": { const url = await docLink(d.bid_id, d.doc_id); return url ? ok({ url }) : deny(404, "Not found"); }
    case "delete_doc": { const r = await deleteDocument(d.bid_id, d.doc_id); return Response.json(r, { status: r.ok ? 200 : 400 }); }
    case "read": { const r = await readSolicitation(d.bid_id, actor); return Response.json(r, { status: r.ok ? 200 : 400 }); }
    case "req": { const { action: _a, bid_id, ...r } = d; if (!r.id && !r.text) return deny(400, "Write the requirement"); await saveRequirement(bid_id, r as never, actor); return ok(); }
    case "delete_req": await deleteRequirement(d.bid_id, d.id); return ok();
    case "lines": await saveLines(d.bid_id, d.lines, d.removed, d.assumptions, d.margin_override); return ok();
    case "candidates": return ok({ pros: await candidatePros(d.bid_id) });
    case "ask_pros": return ok(await askProsForPrices(d.bid_id, d.contractor_ids, actor));
    case "quote_status": await setQuoteStatus(d.bid_id, d.quote_id, d.status); return ok();
    case "use_quotes": return ok(await useBestQuotes(d.bid_id));
    case "review": return ok(await signOffReview(d.bid_id, d.checks, actor));
    case "status": await setBidStatus(d.bid_id, d.status, d.reason ?? null); return ok();
    case "reopen": { const r = await reopenForRevision(d.bid_id, d.reason as never, d.note, actor); return Response.json(r, { status: r.ok ? 200 : 400 }); }
    case "copy": { const r = await copyBid(d.bid_id, actor); return Response.json(r, { status: r.ok ? 200 : 400 }); }
    case "submit": { const r = await markSubmitted(d.bid_id, actor); return Response.json(r, { status: r.ok ? 200 : 400 }); }
    case "result": { const { action: _a, bid_id, ...r } = d; const out = await recordResult(bid_id, r, actor); return Response.json(out, { status: out.ok ? 200 : 400 }); }
    case "benchmark": { const { action: _a, ...bm } = d; await addBenchmark(bm, actor); return ok(); }
  }
}
