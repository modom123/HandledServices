/*
 * FILE    : apps/web/components/EmailSignature.tsx
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-11-12_0005 UTC
 * PURPOSE : Hub → Email → Email signature. Fill in name, title, phone and email; see the signature as it will look;
 *           copy it in one click (formatted, for webmail / Gmail / Outlook) or as plain text (phones, plain-text email).
 *           Table-based HTML with inline styles only, so it looks the same in every mail app. Nothing is saved on the
 *           server; the last details typed are remembered in this browser.
 */
"use client";

import { useEffect, useMemo, useState } from "react";

type Sig = { name: string; title: string; phone: string; email: string; site: string; tagline: string; logo: string; booking: string };
const KEY = "handled.signature";
const esc = (v: string) => v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const telHref = (p: string) => `tel:${p.replace(/[^\d+]/g, "")}`;

function sigHtml(s: Sig) {
  const host = s.site.replace(/^https?:\/\//, "").replace(/\/$/, "");
  const line = (label: string, value: string, href: string) => value ? `<tr><td style="padding:1px 0;font:13px Arial,Helvetica,sans-serif;color:#4b5563"><span style="color:#0f6b50;font-weight:bold">${label}</span>&nbsp; <a href="${esc(href)}" style="color:#1f2937;text-decoration:none">${esc(value)}</a></td></tr>` : "";
  return `<table cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;font-family:Arial,Helvetica,sans-serif">
<tr>
${s.logo ? `<td style="padding:0 14px 0 0;vertical-align:top"><img src="${esc(s.logo)}" width="64" height="64" alt="Handled" style="display:block;border:0;border-radius:12px"></td>` : ""}
<td style="padding:0 0 0 14px;border-left:3px solid #0f6b50;vertical-align:top">
<table cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse">
<tr><td style="font:bold 16px Arial,Helvetica,sans-serif;color:#111827;padding:0">${esc(s.name || "Your name")}</td></tr>
${s.title ? `<tr><td style="font:13px Arial,Helvetica,sans-serif;color:#6b7280;padding:0 0 6px">${esc(s.title)} · Handled</td></tr>` : `<tr><td style="font:13px Arial,Helvetica,sans-serif;color:#6b7280;padding:0 0 6px">Handled</td></tr>`}
${line("P", s.phone, telHref(s.phone))}
${line("E", s.email, `mailto:${s.email}`)}
${line("W", host, s.site)}
${s.booking ? `<tr><td style="padding:8px 0 0"><a href="${esc(s.booking)}" style="display:inline-block;background:#0f6b50;color:#ffffff;font:bold 12px Arial,Helvetica,sans-serif;text-decoration:none;padding:7px 14px;border-radius:6px">Book a service →</a></td></tr>` : ""}
${s.tagline ? `<tr><td style="font:italic 12px Arial,Helvetica,sans-serif;color:#0f6b50;padding:8px 0 0">${esc(s.tagline)}</td></tr>` : ""}
</table>
</td>
</tr>
</table>`;
}

function sigText(s: Sig) {
  const host = s.site.replace(/^https?:\/\//, "").replace(/\/$/, "");
  return ["--", s.name || "Your name", s.title ? `${s.title} · Handled` : "Handled", s.phone && `P: ${s.phone}`, s.email && `E: ${s.email}`, host && `W: ${host}`, s.booking && `Book a service: ${s.booking}`, s.tagline].filter(Boolean).join("\n");
}

export function EmailSignature({ defaults }: { defaults: Sig }) {
  const [s, setS] = useState<Sig>(defaults);
  const [msg, setMsg] = useState("");
  useEffect(() => { try { const saved = JSON.parse(localStorage.getItem(KEY) || "null"); if (saved) setS({ ...defaults, ...saved }); } catch { /* private window */ } }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* ignore */ } }, [s]);
  const html = useMemo(() => sigHtml(s), [s]);
  const set = (k: keyof Sig) => (e: React.ChangeEvent<HTMLInputElement>) => setS({ ...s, [k]: e.target.value });
  const copyRich = async () => {
    try {
      await navigator.clipboard.write([new ClipboardItem({ "text/html": new Blob([html], { type: "text/html" }), "text/plain": new Blob([sigText(s)], { type: "text/plain" }) })]);
      setMsg("Copied ✓ — paste it into your mail app's signature box.");
    } catch {
      // older browsers: select the preview so it can be copied with Ctrl/Cmd+C
      const el = document.getElementById("sig-preview"); const r = document.createRange(); if (el) { r.selectNodeContents(el); const sel = window.getSelection(); sel?.removeAllRanges(); sel?.addRange(r); }
      setMsg("Selected — press Ctrl+C (Cmd+C on a Mac) to copy.");
    }
  };
  const copyText = async () => { try { await navigator.clipboard.writeText(sigText(s)); setMsg("Plain text copied ✓"); } catch { setMsg("Couldn't copy — select the text and copy it."); } };
  const copyCode = async () => { try { await navigator.clipboard.writeText(html); setMsg("HTML code copied ✓"); } catch { setMsg("Couldn't copy."); } };
  const field = (k: keyof Sig, label: string, ph = "") => <label className="block"><span className="label">{label}</span><input className="input" value={s[k]} placeholder={ph} onChange={set(k)} /></label>;
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
      <div className="card space-y-3">
        {field("name", "Name", "Mark Odom")}
        {field("title", "Title", "Owner · Operations · Pro Success…")}
        {field("phone", "Phone")}
        {field("email", "Email")}
        {field("site", "Website")}
        {field("booking", "“Book a service” button link (blank = no button)")}
        {field("tagline", "Tagline (blank = none)")}
        {field("logo", "Logo image link (blank = no logo)")}
      </div>
      <div className="space-y-4">
        <div className="card">
          <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-soft">Preview</div>
          <div id="sig-preview" className="rounded-xl border border-line bg-white p-4" dangerouslySetInnerHTML={{ __html: html }} />
          <div className="mt-4 flex flex-wrap gap-2">
            <button className="btn-primary" onClick={copyRich}>Copy signature</button>
            <button className="btn-ghost" onClick={copyText}>Copy plain text</button>
            <button className="btn-ghost" onClick={copyCode}>Copy HTML code</button>
          </div>
          {msg && <p role="status" className="mt-2 text-sm">{msg}</p>}
        </div>
        <div className="card text-sm">
          <div className="font-semibold">Where to paste it</div>
          <ul className="mt-2 space-y-1.5 text-ink-soft">
            <li><b className="text-ink">Hostinger webmail</b> (info@handledsvc.com): Settings → Signatures → new signature → paste → Save.</li>
            <li><b className="text-ink">Gmail</b>: Settings ⚙ → See all settings → General → Signature → Create new → paste → Save changes (bottom of the page).</li>
            <li><b className="text-ink">Outlook</b>: Settings → Mail → Compose and reply → Email signature → paste → Save.</li>
            <li><b className="text-ink">iPhone Mail</b>: Settings → Mail → Signature → paste the plain text.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
