/*
 * FILE    : apps/mobile/lib/profile.ts
 * PROJECT : Handled (myhumanai)
 * CREATED : 2026-10-06_0645 UTC
 * PURPOSE : Remember the customer's name, email, phone and last service address on this phone, so the
 *           second booking takes seconds (like ride apps remember home and work). Stored only on the
 *           device; cleared on sign-out and account deletion.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";

export type SavedProfile = { contact_name: string; contact_email: string; contact_phone: string; address: string; city: string; state: string; zip: string };

const KEY = "handled_profile";

export async function loadProfile(): Promise<Partial<SavedProfile>> {
  try { const v = await AsyncStorage.getItem(KEY); return v ? (JSON.parse(v) as Partial<SavedProfile>) : {}; } catch { return {}; }
}

export async function saveProfile(p: SavedProfile): Promise<void> {
  try { await AsyncStorage.setItem(KEY, JSON.stringify(p)); } catch { /* not critical */ }
}

export async function clearProfile(): Promise<void> {
  try { await AsyncStorage.removeItem(KEY); } catch { /* not critical */ }
}
