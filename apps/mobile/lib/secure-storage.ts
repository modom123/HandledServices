/*
 * FILE    : apps/mobile/lib/secure-storage.ts
 * PROJECT : Handled (myhumanai)
 * CREATED : 2026-10-06_0726 UTC
 * PURPOSE : Where the sign-in session lives on the phone: the iOS Keychain / Android Keystore
 *           (expo-secure-store), encrypted by the OS, instead of plain AsyncStorage. Supabase sessions are
 *           larger than one secure entry allows, so values are split into chunks. A session saved by an
 *           older app version in AsyncStorage is moved over on first read (nobody gets signed out) and the
 *           plain copy is deleted. Web builds use secure-storage.web.ts.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";

const CHUNK = 1800;
const safeKey = (k: string) => k.replace(/[^A-Za-z0-9._-]/g, "_");
const opts: SecureStore.SecureStoreOptions = { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK };

async function readSecure(key: string): Promise<string | null> {
  const k = safeKey(key);
  const n = Number(await SecureStore.getItemAsync(`${k}.n`, opts));
  if (!n) return null;
  const parts: string[] = [];
  for (let i = 0; i < n; i++) {
    const p = await SecureStore.getItemAsync(`${k}.${i}`, opts);
    if (p == null) return null;
    parts.push(p);
  }
  return parts.join("");
}

async function writeSecure(key: string, value: string): Promise<void> {
  const k = safeKey(key);
  const old = Number(await SecureStore.getItemAsync(`${k}.n`, opts)) || 0;
  const n = Math.max(1, Math.ceil(value.length / CHUNK));
  for (let i = 0; i < n; i++) await SecureStore.setItemAsync(`${k}.${i}`, value.slice(i * CHUNK, (i + 1) * CHUNK), opts);
  await SecureStore.setItemAsync(`${k}.n`, String(n), opts);
  for (let i = n; i < old; i++) await SecureStore.deleteItemAsync(`${k}.${i}`, opts).catch(() => {});
}

async function removeSecure(key: string): Promise<void> {
  const k = safeKey(key);
  const n = Number(await SecureStore.getItemAsync(`${k}.n`, opts)) || 0;
  for (let i = 0; i < n; i++) await SecureStore.deleteItemAsync(`${k}.${i}`, opts).catch(() => {});
  await SecureStore.deleteItemAsync(`${k}.n`, opts).catch(() => {});
}

/** Supabase auth storage: getItem / setItem / removeItem backed by the OS keychain. */
export const secureStorage = {
  async getItem(key: string): Promise<string | null> {
    try {
      const v = await readSecure(key);
      if (v != null) return v;
      // one-time move from the old plain storage
      const legacy = await AsyncStorage.getItem(key);
      if (legacy != null) { await writeSecure(key, legacy); await AsyncStorage.removeItem(key); }
      return legacy;
    } catch {
      return null;
    }
  },
  async setItem(key: string, value: string): Promise<void> {
    try { await writeSecure(key, value); } catch { /* keychain unavailable: the user signs in again next time */ }
  },
  async removeItem(key: string): Promise<void> {
    try { await removeSecure(key); await AsyncStorage.removeItem(key); } catch { /* already gone */ }
  },
};
