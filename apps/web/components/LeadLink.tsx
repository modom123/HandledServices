/*
 * FILE    : apps/web/components/LeadLink.tsx
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-11-17_2350 UTC
 * PURPOSE : A link that carries the sales-email lead (?lead= on this page, or the one Attribution remembered) to the next
 *           page, so a walkthrough or order from a static landing page still credits the lead.
 */
"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { readAttribution } from "@/lib/track";

export function LeadLink({ href, className, children }: { href: string; className?: string; children: ReactNode }) {
  const [to, setTo] = useState(href);
  useEffect(() => {
    try {
      const fromUrl = new URL(window.location.href).searchParams.get("lead");
      const lead = fromUrl && /^[a-z0-9]{8,40}$/.test(fromUrl) ? fromUrl : readAttribution()?.biz_lead;
      if (lead && /^[a-z0-9]{8,40}$/.test(lead)) setTo(`${href}${href.includes("?") ? "&" : "?"}lead=${lead}`);
    } catch { /* storage blocked */ }
  }, [href]);
  return <Link href={to} className={className}>{children}</Link>;
}
