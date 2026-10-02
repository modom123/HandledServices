/*
 * FILE    : apps/web/app/(splash)/layout.tsx
 * PROJECT : Handled — AI-run home & business services
 * CREATED : 2026-10-02_0244 UTC
 * PURPOSE : Bare shell for the splash page — no site header, footer or chat bubble, so the
 *           introduction stands on its own.
 */
export default function SplashLayout({ children }: { children: React.ReactNode }) {
  return <main>{children}</main>;
}
