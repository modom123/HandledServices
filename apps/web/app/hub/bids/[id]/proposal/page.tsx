/*
 * FILE    : apps/web/app/hub/bids/[id]/proposal/page.tsx
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-11-06_0400 UTC
 * PURPOSE : The proposal, ready to print or save as PDF: cover page (who we are, the solicitation, the date), contents,
 *           every section, and a compliance cross-reference (each requirement → where we answer it). [[NEEDS]] markers
 *           still in the text are highlighted, with a banner, so nothing unfinished goes out by accident.
 */
import { notFound } from "next/navigation";
import { needsInput } from "@handled/core";
import { loadBid } from "@/lib/bids";
import { listProfiles, loadSections } from "@/lib/proposals";
import { PrintButton } from "@/components/BidWorkspace";

export const dynamic = "force-dynamic";
export const metadata = { title: "Proposal" };

/** Light formatting the AI uses: "## " sub-headings, "- " bullets, **bold**, blank-line paragraphs; [[NEEDS]] highlighted. */
function Inline({ text }: { text: string }) {
  return <>{text.split(/(\*\*[^*]+\*\*|\[\[[^\]]*\]\])/g).map((p, i) => p.startsWith("**") ? <b key={i}>{p.slice(2, -2)}</b> : p.startsWith("[[") ? <mark key={i} className="bg-yellow-200">{p}</mark> : <span key={i}>{p}</span>)}</>;
}
function Body({ text }: { text: string }) {
  const blocks = text.replace(/\r/g, "").split(/\n{2,}/);
  return (
    <>
      {blocks.map((b, i) => {
        const lines = b.split("\n").filter((l) => l.trim());
        if (!lines.length) return null;
        if (lines.every((l) => /^\s*[-*•]\s+/.test(l))) return <ul key={i} className="my-2 list-disc pl-6">{lines.map((l, j) => <li key={j}><Inline text={l.replace(/^\s*[-*•]\s+/, "")} /></li>)}</ul>;
        if (lines.every((l) => /^\s*\d+[.)]\s+/.test(l))) return <ol key={i} className="my-2 list-decimal pl-6">{lines.map((l, j) => <li key={j}><Inline text={l.replace(/^\s*\d+[.)]\s+/, "")} /></li>)}</ol>;
        return lines.map((l, j) => /^#{2,4}\s+/.test(l)
          ? <h3 key={`${i}-${j}`} className="mt-4 text-base font-bold">{l.replace(/^#+\s+/, "")}</h3>
          : <p key={`${i}-${j}`} className="my-2"><Inline text={l} /></p>);
      })}
    </>
  );
}

export default async function ProposalPrint({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const [d, sections, profiles] = await Promise.all([loadBid(id), loadSections(id), listProfiles()]);
  if (!d) notFound();
  const b = d.bid as typeof d.bid & { profile_id?: string | null };
  const p = profiles.find((x) => x.id === b.profile_id) ?? profiles.find((x) => x.is_default) ?? profiles[0] ?? null;
  const open = sections.reduce((n, s) => n + needsInput(s.content).length, 0);
  const unapproved = sections.filter((s) => s.status !== "approved").length;
  const company = p?.legal_name ?? p?.name ?? "[[NEEDS: company name]]";
  return (
    <div className="mx-auto max-w-3xl bg-white text-[11pt] leading-relaxed text-black">
      <div className="mb-4 flex flex-wrap items-center gap-2 print:hidden">
        <a href={`/hub/bids/${id}`} className="text-sm text-brand">← Back to the bid</a>
        <span className="ml-auto"><PrintButton /></span>
      </div>
      {(open > 0 || unapproved > 0) && <p className="mb-4 rounded-lg bg-yellow-100 p-3 text-sm print:hidden">Not final: {open > 0 ? `${open} [[NEEDS]] item${open > 1 ? "s" : ""} still in the text` : ""}{open && unapproved ? " · " : ""}{unapproved > 0 ? `${unapproved} section${unapproved > 1 ? "s" : ""} not approved` : ""}. Finish them in the bid before you submit.</p>}
      {!sections.length && <p className="rounded-lg bg-paper p-3 text-sm">No proposal yet. Build the outline in the bid first.</p>}

      <section className="flex min-h-[9in] flex-col justify-center break-after-page border-b border-line pb-8 print:border-0">
        <div className="text-sm uppercase tracking-widest text-ink-soft">{(b.solicitation_type ?? "").replace("_", " ").toUpperCase()} response</div>
        <h1 className="mt-2 text-3xl font-bold">{b.title}</h1>
        <div className="mt-2 text-lg">{b.agency ?? ""}</div>
        {b.solicitation_number && <div className="mt-1">Solicitation {b.solicitation_number}</div>}
        {b.due_at && <div className="mt-1 text-sm">Due {new Date(b.due_at).toLocaleString("en-US", { timeZone: "America/Detroit", dateStyle: "long", timeStyle: "short" })}</div>}
        <div className="mt-10 text-sm">Submitted by</div>
        <div className="text-xl font-bold">{company}</div>
        <div className="mt-1 text-sm">
          {[p?.uei ? `UEI ${p.uei}` : null, p?.cage ? `CAGE ${p.cage}` : null, p?.business_size].filter(Boolean).join(" · ")}
          {p?.address && <div>{p.address}</div>}
          {(p?.poc_name || p?.email || p?.phone) && <div>{[p?.poc_name && `${p.poc_name}${p.poc_title ? `, ${p.poc_title}` : ""}`, p?.email, p?.phone].filter(Boolean).join(" · ")}</div>}
        </div>
        <div className="mt-6 text-sm">{new Date().toLocaleDateString("en-US", { timeZone: "America/Detroit", dateStyle: "long" })}</div>
      </section>

      {sections.length > 1 && (
        <section className="break-after-page py-6">
          <h2 className="text-xl font-bold">Contents</h2>
          <ol className="mt-3 list-decimal space-y-1 pl-6">{sections.map((s) => <li key={s.id}>{s.title}</li>)}{d.requirements.length > 0 && <li>Compliance cross-reference</li>}</ol>
        </section>
      )}

      {sections.map((s, i) => (
        <section key={s.id} className="py-4">
          <h2 className="border-b-2 border-black pb-1 text-xl font-bold">{i + 1}. {s.title}</h2>
          <Body text={s.content || "[[NEEDS: this section]]"} />
        </section>
      ))}

      {d.requirements.length > 0 && sections.length > 0 && (
        <section className="break-before-page py-4">
          <h2 className="border-b-2 border-black pb-1 text-xl font-bold">{sections.length + 1}. Compliance cross-reference</h2>
          <table className="mt-3 w-full border-collapse text-[9.5pt]">
            <thead><tr className="border-b border-black text-left"><th className="w-12 p-1">#</th><th className="p-1">Requirement</th><th className="w-28 p-1">Solicitation ref.</th><th className="w-48 p-1">Where we answer it</th></tr></thead>
            <tbody>{d.requirements.map((r, i) => ({ r, n: i + 1 })).filter(({ r }) => r.kind !== "question").map(({ r, n }) => (
              <tr key={r.id} className="border-b border-line align-top"><td className="p-1">R{n}</td><td className="p-1">{r.text}</td><td className="p-1">{r.source_ref ?? "—"}</td><td className="p-1">{r.response_ref ?? "—"}</td></tr>
            ))}</tbody>
          </table>
        </section>
      )}
    </div>
  );
}
