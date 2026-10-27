/*
 * FILE    : apps/web/app/pro/team/page.tsx
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-27_2300 UTC
 * PURPOSE : Pro portal → Office team (owners only). Give an office manager their own login: they accept offers, run the
 *           calendar, pick crew and message customers for the company. Money, tax, contracts, documents, prices and
 *           this team stay with the owner. Remove someone and their access ends right away.
 */
import { getViewer } from "@/lib/auth";
import { getLocale } from "@/lib/locale";
import { listTeam, TEAM_LIMIT } from "@/lib/pro-team";
import { TeamInvite, TeamRemove } from "@/components/ProTeam";

export default async function TeamPage() {
  const v = await getViewer();
  if (!v?.contractorId) return null;
  const es = (await getLocale()) === "es";
  if (v.proRole !== "owner") return <div className="card max-w-xl text-sm">{es ? "Solo el dueño de la empresa maneja el equipo de oficina." : "Only the company owner manages the office team."}</div>;
  const team = await listTeam(v.contractorId);
  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{es ? "Equipo de oficina" : "Office team"}</h1>
        <p className="mt-1 text-sm text-ink-soft">{es
          ? "Dé a su encargado(a) de oficina su propio acceso con su correo. Puede aceptar ofertas, manejar el calendario, elegir quién del equipo va y escribir a los clientes en nombre de su empresa. Dinero, impuestos, contratos, documentos, precios y este equipo quedan con usted."
          : "Give your office manager their own login with their email. They can accept offers, run the calendar, pick who on your crew goes and message customers for your company. Money, tax, contracts, documents, prices and this team stay with you."}</p>
      </div>
      <div className="card">
        <div className="font-semibold">{es ? `Con acceso (${team.length}/${TEAM_LIMIT})` : `Who has access (${team.length}/${TEAM_LIMIT})`}</div>
        {!team.length && <p className="mt-2 text-sm text-ink-soft">{es ? "Nadie todavía." : "No one yet."}</p>}
        <ul className="mt-2 divide-y divide-line">
          {team.map((m) => (
            <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
              <div><b>{m.full_name}</b> · {es ? "Oficina" : "Office"}
                <div className="text-xs text-ink-soft">{m.email}{m.phone ? ` · ${m.phone}` : ""} · {m.accepted_at ? (es ? `entró ${(m.last_seen_at ?? m.accepted_at).slice(0, 10)}` : `last in ${(m.last_seen_at ?? m.accepted_at).slice(0, 10)}`) : es ? "invitación enviada" : "invite sent"}</div></div>
              <TeamRemove id={m.id} es={es} />
            </li>
          ))}
        </ul>
      </div>
      {team.length < TEAM_LIMIT && (
        <div className="card space-y-2">
          <div className="font-semibold">{es ? "Agregar a alguien" : "Add someone"}</div>
          <TeamInvite es={es} />
        </div>
      )}
    </div>
  );
}
