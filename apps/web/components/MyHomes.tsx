/*
 * FILE    : apps/web/components/MyHomes.tsx
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-12_0005 UTC
 * PURPOSE : "My homes" on the customer account page (client): saved home profiles — address, how to get in, key /
 *           lockbox, who has a key, pets, parking and preferences — added, edited or removed through /api/account/homes.
 *           Bookings can start from a saved home. English / Spanish.
 */
"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export type SavedHome = { id: string; label: string; address: string; city: string; state: string; zip: string; entry_instructions: string | null; key_info: string | null; key_holder: string | null; pets: string | null; parking: string | null; preferences: string | null };
type Draft = Omit<SavedHome, "id"> & { id?: string };
const blank: Draft = { label: "Home", address: "", city: "", state: "MI", zip: "", entry_instructions: "", key_info: "", key_holder: "", pets: "", parking: "", preferences: "" };

export function MyHomes({ homes, es }: { homes: SavedHome[]; es: boolean }) {
  const router = useRouter();
  const [edit, setEdit] = useState<Draft | null>(null);
  const [msg, setMsg] = useState(""), [busy, setBusy] = useState(false);
  const L = (en: string, sp: string) => (es ? sp : en);
  const save = async () => {
    if (!edit) return;
    setBusy(true); setMsg("");
    const r = await fetch("/api/account/homes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(edit) });
    const j = (await r.json().catch(() => ({}))) as { error?: string };
    setBusy(false);
    if (!r.ok) return setMsg(j.error ?? L("Couldn't save", "No se pudo guardar"));
    setEdit(null); router.refresh();
  };
  const remove = async (h: SavedHome) => {
    if (!confirm(L(`Remove ${h.label}? Past bookings keep their address.`, `¿Eliminar ${h.label}? Las reservas anteriores conservan su dirección.`))) return;
    await fetch(`/api/account/homes?id=${h.id}`, { method: "DELETE" });
    router.refresh();
  };
  const field = (k: keyof Draft, label: string, hint = "", area = false) => (
    <label className="block text-sm"><span className="label">{label}</span>
      {area ? <textarea className="input min-h-16" placeholder={hint} value={(edit?.[k] as string) ?? ""} onChange={(e) => setEdit({ ...edit!, [k]: e.target.value })} />
        : <input className="input" placeholder={hint} value={(edit?.[k] as string) ?? ""} onChange={(e) => setEdit({ ...edit!, [k]: e.target.value })} />}
    </label>
  );
  return (
    <div className="mt-8">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-bold">🏠 {L("My homes", "Mis casas")}</h2>
        {!edit && <button className="text-sm font-semibold text-brand" onClick={() => setEdit({ ...blank })}>+ {L("Add a home", "Agregar una casa")}</button>}
      </div>
      <p className="mb-3 text-xs text-ink-soft">{L("Save how to get in, keys, pets and how you like things done — every booking at that home uses it. Entry details and lockbox codes go only to the pro assigned to your job, never to pros deciding whether to take it.", "Guarde cómo entrar, llaves, mascotas y cómo le gustan las cosas: cada reserva en esa casa lo usa. Los detalles de entrada y códigos solo los ve el profesional asignado a su trabajo.")}</p>
      {edit ? (
        <div className="card space-y-3">
          <div className="grid gap-3 sm:grid-cols-[1fr_2fr]">{field("label", L("Name", "Nombre"), L("Home, Mom's house, Lake cottage", "Casa, Casa de mamá"))}{field("address", L("Street address", "Dirección"))}</div>
          <div className="grid grid-cols-[1fr_70px_100px] gap-3">{field("city", L("City", "Ciudad"))}{field("state", L("State", "Estado"))}{field("zip", "ZIP")}</div>
          <p className="pt-2 text-xs font-semibold uppercase tracking-wide text-ink-soft">🔒 {L("Only for your assigned pro", "Solo para su profesional asignado")}</p>
          {field("entry_instructions", L("How to get in", "Cómo entrar"), L("Side door, gate code 1234, alarm code…", "Puerta lateral, código del portón…"), true)}
          <div className="grid gap-3 sm:grid-cols-2">{field("key_info", L("Key / lockbox", "Llave / caja de seguridad"), L("Lockbox on the back porch, code 4821", "Caja en el porche trasero, código 4821"))}{field("key_holder", L("Who has a key", "Quién tiene llave"), L("Neighbor Pat, (248) 555-0100", "Vecino Pat, (248) 555-0100"))}</div>
          <p className="pt-2 text-xs font-semibold uppercase tracking-wide text-ink-soft">{L("Every pro sees these before accepting", "Todos los profesionales ven esto antes de aceptar")}</p>
          <div className="grid gap-3 sm:grid-cols-2">{field("pets", L("Pets", "Mascotas"), L("Friendly dog — keep the gate shut", "Perro amigable — cierre el portón"))}{field("parking", L("Parking", "Estacionamiento"), L("Driveway is fine", "Puede usar la entrada"))}</div>
          {field("preferences", L("Preferences", "Preferencias"), L("Shoes off, unscented products, skip the office…", "Sin zapatos, productos sin aroma…"), true)}
          <div className="flex flex-wrap items-center gap-3">
            <button className="btn-primary" disabled={busy || edit.address.trim().length < 3 || !/^\d{5}/.test(edit.zip) || edit.city.trim().length < 2 || edit.state.trim().length !== 2} onClick={save}>{L("Save home", "Guardar casa")}</button>
            <button className="btn-ghost" onClick={() => { setEdit(null); setMsg(""); }}>{L("Cancel", "Cancelar")}</button>
            {msg && <span className="text-sm text-rose-700">{msg}</span>}
          </div>
        </div>
      ) : homes.length === 0 ? (
        <p className="card text-sm text-ink-soft">{L("No saved homes yet. Add one, or tick “Save this home” when you book.", "Aún no hay casas guardadas. Agregue una, o marque “Guardar esta casa” al reservar.")}</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">{homes.map((h) => (
          <div key={h.id} className="card space-y-1 text-sm">
            <div className="flex items-center justify-between gap-2"><b>{h.label}</b><span className="flex gap-3 text-xs"><button className="text-brand underline" onClick={() => setEdit({ ...h })}>{L("Edit", "Editar")}</button><button className="text-ink-soft underline" onClick={() => remove(h)}>{L("Remove", "Eliminar")}</button></span></div>
            <div className="text-ink-soft">{h.address}, {h.city}, {h.state} {h.zip}</div>
            <div className="text-xs text-ink-soft">{[h.entry_instructions || h.key_info ? `🔒 ${L("entry details saved", "detalles de entrada guardados")}` : null, h.key_holder ? `🔑 ${h.key_holder}` : null, h.pets ? `🐾 ${h.pets}` : null].filter(Boolean).join(" · ")}</div>
            <Link className="btn-primary mt-2 inline-block px-3 text-sm" href={`/book?home=${h.id}`}>{L("Book at this home", "Reservar en esta casa")}</Link>
          </div>
        ))}</div>
      )}
    </div>
  );
}
