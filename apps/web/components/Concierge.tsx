/*
 * FILE    : apps/web/components/Concierge.tsx
 * PROJECT : Handled — AI-run home & business services
 * CREATED : 2026-10-01_1723 UTC
 * UPDATED : 2026-10-02_1405 UTC — English / Spanish.
 * PURPOSE : Floating AI concierge chat on every public page.
 */
"use client";

import { useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { t as tr, type Locale } from "@handled/core";

type Turn = { role: "user" | "assistant"; content: string };

export function Concierge({ locale = "en" }: { locale?: Locale }) {
  const t = (s: string) => tr(locale, s);
  const compact = (usePathname() ?? "").startsWith("/book");
  const [open, setOpen] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([{ role: "assistant", content: t("Hi! What can we take off your plate? Tell me the job and I’ll give you a price.") }]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim() || busy) return;
    const next = [...turns, { role: "user" as const, content: text.trim() }];
    setTurns(next);
    setText("");
    setBusy(true);
    const res = await fetch("/api/concierge", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages: next.slice(1) }) }).catch(() => null);
    const json = res ? await res.json().catch(() => ({})) : {};
    setTurns([...next, { role: "assistant", content: json.reply ?? t("Sorry, I couldn’t reach the server.") }]);
    setBusy(false);
    setTimeout(() => end.current?.scrollIntoView({ behavior: "smooth" }), 50);
  }

  return (
    <div className="fixed bottom-5 right-5 z-40">
      {open && (
        <div className="mb-3 flex h-[28rem] w-[22rem] max-w-[calc(100vw-2.5rem)] flex-col overflow-hidden rounded-2xl border border-line bg-white shadow-xl">
          <div className="flex items-center justify-between bg-brand-deep px-4 py-3 text-white">
            <div><div className="text-sm font-semibold">{t("Concierge")}</div><div className="text-xs text-white/60">{t("AI · instant prices · 24/7")}</div></div>
            <button onClick={() => setOpen(false)} aria-label="Close chat">✕</button>
          </div>
          <div className="flex-1 space-y-3 overflow-y-auto p-4 text-sm">
            {turns.map((m, i) => (
              <div key={i} className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2 ${m.role === "user" ? "ml-auto bg-brand text-white" : "bg-paper"}`}>
                {m.content.split(/(\/book\S*)/g).map((part, j) => (part.startsWith("/book") ? <a key={j} href={part} className="font-semibold underline">{part}</a> : part))}
              </div>
            ))}
            {busy && <div className="w-16 rounded-2xl bg-paper px-3.5 py-2 text-ink-soft">…</div>}
            <div ref={end} />
          </div>
          <form onSubmit={send} className="flex gap-2 border-t border-line p-3">
            <input className="input" placeholder={t("e.g. haul away an old couch")} value={text} onChange={(e) => setText(e.target.value)} maxLength={1000} />
            <button className="btn-primary px-4" disabled={busy}>{t("Send")}</button>
          </form>
        </div>
      )}
      {/* on phones, an icon only while booking, so it never covers the booking buttons */}
      <button onClick={() => setOpen(!open)} aria-label={t("Ask for a price")} className={`btn-dark ml-auto flex shadow-lg ${compact ? "h-12 w-12 p-0 sm:h-auto sm:w-auto sm:px-5 sm:py-3" : "px-5 py-3"}`}>💬<span className={compact ? "hidden sm:inline" : ""}> {t("Ask for a price")}</span></button>
    </div>
  );
}
