/*
 * FILE    : apps/mobile/components/LiveMap.web.tsx
 * PROJECT : Handled (HandledServices)
 * CREATED : 2026-10-06_0708 UTC
 * PURPOSE : Web build: no native map; the ETA text is shown instead.
 */
import type { LatLng } from "react-native-maps";

export const mapsAvailable = false;

export function LiveMap(_: { pro: LatLng; home: LatLng; proLabel: string; homeLabel: string }) {
  return null;
}
