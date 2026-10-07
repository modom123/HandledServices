/*
 * FILE    : apps/web/app/(splash)/layout.tsx
 * PROJECT : Handled — AI-run home & business services
 * CREATED : 2026-10-02_0244 UTC
 * PURPOSE : Shell for the splash page: the site header with its dropdown menus (so every page has them), no footer or chat
 *           bubble, so the introduction stands on its own.
 * UPDATED : 2026-10-07_0205 UTC — added the site header and dropdown menus.
 */
import { SiteHeader } from "@/components/site";

export default function SplashLayout({ children }: { children: React.ReactNode }) {
  return <><SiteHeader /><main>{children}</main></>;
}
