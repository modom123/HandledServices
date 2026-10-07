/*
 * FILE    : apps/web/app/(site)/home/page.tsx
 * PROJECT : Handled — AI-run home & business services
 * CREATED : 2026-10-01_1723 UTC
 * UPDATED : 2026-10-07_0235 UTC — three switchable looks (lib/theme.ts): Modern uses components/home/HomeModern; Original and
 *           Green-white-gold share components/home/HomeClassic (colors come from the theme).
 * PURPOSE : Home page (the first page after the splash).
 */
import { getTheme } from "@/lib/theme";
import { HomeClassic } from "@/components/home/HomeClassic";
import { HomeModern } from "@/components/home/HomeModern";

export default async function Home() {
  return (await getTheme()) === "modern" ? <HomeModern /> : <HomeClassic />;
}
