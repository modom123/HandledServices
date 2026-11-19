/*
 * FILE    : apps/web/lib/mail-text.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-11-19_1500 UTC
 * PURPOSE : Readable plain text for an incoming email (Email Center inbox and the Front Office mail).
 *           Marketing emails often come as HTML only, or with a broken plain-text part: stripping tags alone left their
 *           <style> CSS, &nbsp; codes and the invisible "preheader" filler characters on screen. readableMailText drops
 *           head/style/script/comments, turns block tags into line breaks, decodes entities, removes zero-width filler,
 *           and tidies the whitespace.
 */

const NAMED: Record<string, string> = { nbsp: " ", amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", copy: "©", reg: "®", trade: "™", hellip: "…", mdash: "—", ndash: "–", lsquo: "‘", rsquo: "’", ldquo: "“", rdquo: "”", bull: "•", middot: "·", zwnj: "", zwj: "", shy: "" };

function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);?/gi, (m, e: string) => {
    if (e[0] === "#") {
      const n = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : m;
    }
    const v = NAMED[e.toLowerCase()];
    return v ?? m;
  });
}

/** CSS rules (`selector{...}`, including nested @media blocks) that leaked into text. */
function stripCss(s: string): string {
  let prev = "";
  while (prev !== s) { prev = s; s = s.replace(/[^\n{}]*\{[^{}]*\}/g, ""); }
  return s;
}

function htmlToPlain(html: string): string {
  let s = html
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<(head|style|script|title|xml)\b[\s\S]*?<\/\1\s*>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<li\b[^>]*>/gi, "\n• ")
    .replace(/<\/(p|div|tr|table|h[1-6]|li|ul|ol|blockquote|section|header|footer)\s*>/gi, "\n")
    .replace(/<(p|div|tr|table|h[1-6]|blockquote)\b[^>]*>/gi, "\n")
    .replace(/<\/t[dh]\s*>/gi, " ")
    .replace(/<[^>]+>/g, "");
  s = decodeEntities(s);
  return s;
}

/** Zero-width and other invisible characters senders pad preheaders with. */
const INVISIBLE = /[​-‏⁠-⁤﻿͏­᠎឴឵]/g;

function tidy(s: string): string {
  return s
    .replace(INVISIBLE, "")
    .replace(/ /g, " ")
    .replace(/\r\n?/g, "\n")
    .split("\n").map((l) => l.replace(/[ \t]+/g, " ").trim()).join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const looksBroken = (t: string) => /@media|\{[^{}\n]*:[^{}\n]*\}|&(nbsp|zwnj|#\d+|#x[0-9a-f]+);/i.test(t) || /<\/?[a-z][^>]*>/i.test(t);

/** The best readable text for a parsed email: its plain-text part when it is clean, else its HTML converted. */
export function readableMailText(text: string | undefined | null, html: string | false | undefined | null): string {
  const t = (text ?? "").trim();
  const h = typeof html === "string" ? html : "";
  if (t && !looksBroken(t)) return tidy(t);
  if (h) return tidy(stripCss(htmlToPlain(h)));
  return tidy(stripCss(htmlToPlain(t)));
}
