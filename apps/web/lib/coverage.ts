/*
 * FILE    : apps/web/lib/coverage.ts
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-06_1950 UTC
 * PURPOSE : Every job gets done (rules in @handled/core coverage.ts).
 *             lineUpBackups(job)   — after a pro accepts, ask the next 3 best pros to be backup #1–#3 ("can you cover if
 *                                    needed?"); they confirm or pass, and anyone who passes is replaced.
 *             handOff(job, …)      — the pro handed it back or no-showed: tell the customer (same time, nothing to do),
 *                                    then call the backups in order (callNextBackup), then everyone.
 *             callNextBackup(job)  — an urgent offer to the next backup with a short answer window; if it lapses or they
 *                                    pass, the next one is called (from redispatchExpired / declineOffer).
 *             releaseBackups(job)  — job done or cancelled: standbys are freed.
 *             coverageSweep()      — every 10 min: jobs in the next 3 days missing backups get them; jobs inside 6 hours
 *                                    with nobody on them raise a critical alert.
 *           Credit follows the work: whoever completes the job is paid, rated and credited (tier, Rewards); a backup
 *           who takes it gets their own tier pay.
 */
import "server-only";
import { BACKUPS, BRAND, TIME_WINDOW_LABEL, backupAnswerMinutes, getService, hoursUntilWindow, money, nextBackup, openBackupRanks, proTier, rankContractors, tierPayout, type BackupRow, type Contractor, type Job } from "@handled/core";
import { adminClient } from "./supabase/server";
import { siteUrl } from "./notify";
import { notify } from "./push";
import { addEvent, dispatchJob, getJob, raiseAlert } from "./jobs";

const db = () => adminClient();

const whenOf = (job: Job) => `${job.scheduled_date ? new Date(`${job.scheduled_date}T12:00:00`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }) : "the scheduled day"} · ${TIME_WINDOW_LABEL[job.time_window] ?? job.time_window}`;

async function backupsOf(jobId: string): Promise<(BackupRow & { id: string })[]> {
  const { data } = await db().from("job_backups").select("id, contractor_id, rank, status").eq("job_id", jobId);
  return (data ?? []) as (BackupRow & { id: string })[];
}

/** Ask the best available pros (not the assigned one, not anyone who already passed) to stand by as backup #1–#3. */
export async function lineUpBackups(jobId: string): Promise<number> {
  const job = await getJob(jobId);
  if (!job?.contractor_id || !["assigned", "scheduled"].includes(job.status) || !job.scheduled_date) return 0;
  if (hoursUntilWindow(job) < 1) return 0;
  const rows = await backupsOf(jobId);
  const ranks = openBackupRanks(rows);
  if (!ranks.length) return 0;
  const { data: tried } = await db().from("job_offers").select("contractor_id, status").eq("job_id", jobId).in("status", ["declined", "expired"]);
  const skip = new Set<string>([job.contractor_id, ...rows.map((r) => r.contractor_id), ...((tried ?? []) as { contractor_id: string }[]).map((t) => t.contractor_id)]);
  const { data: pros } = await db().from("contractors").select("*").eq("status", "approved");
  const { data: sameDay } = await db().from("jobs").select("contractor_id").eq("scheduled_date", job.scheduled_date).not("contractor_id", "is", null);
  const load: Record<string, number> = {};
  for (const r of (sameDay ?? []) as { contractor_id: string }[]) load[r.contractor_id] = (load[r.contractor_id] ?? 0) + 1;
  const picks = rankContractors((pros ?? []) as Contractor[], job, load).filter((c) => !skip.has(c.contractor.id)).slice(0, ranks.length);
  if (!picks.length) {
    if (!rows.some((r) => ["asked", "standby"].includes(r.status))) await raiseAlert("no_backups", "warn", `${job.ref}: no backup pros available`, `Nobody else eligible to stand by for ${job.service_slug} in ${job.zip} on ${job.scheduled_date}. Recruit or ask a pro directly.`, job.id);
    return 0;
  }
  const svc = getService(job.service_slug);
  let n = 0;
  for (const [i, p] of picks.entries()) {
    const rank = ranks[i];
    const { data: row } = await db().from("job_backups").insert({ job_id: job.id, contractor_id: p.contractor.id, rank }).select("id").single();
    if (!row) continue;
    n++;
    const pay = tierPayout(job.price_final, job.contractor_payout, proTier(p.contractor));
    await notify(p.contractor.profile_id, {
      title: `Standby request: backup #${rank}`,
      body: `${svc?.icon ?? ""} ${svc?.name} · ${job.city} ${job.zip} · ${whenOf(job)} · ${money(pay)} if you're called. Can you cover?`,
      data: { type: "pro_home" },
      email: { to: p.contractor.email, subject: `Can you be backup #${rank}? ${svc?.name} · ${job.zip} · ${job.scheduled_date}`,
        text: `A pro is booked for this job. We line up backups so customers are never left waiting.\n\n${svc?.name} · ${job.city} ${job.zip}\n${whenOf(job)}\nPays ${money(pay)} if you're called and do the job.\n\nIf the booked pro can't make it, you get the first call (backup #${rank}). No obligation now — confirm if you can keep that time open, or pass.\n\nAnswer: ${siteUrl()}/pro#standby\n\n— ${BRAND.name}` },
      es: {
        title: `Solicitud de respaldo: respaldo n.º ${rank}`,
        body: `${svc?.name} · ${job.city} ${job.zip} · ${job.scheduled_date} · ${money(pay)} si lo llamamos. ¿Puede cubrir?`,
        subject: `¿Puede ser el respaldo n.º ${rank}? ${svc?.name} · ${job.zip} · ${job.scheduled_date}`,
        text: `Hay un profesional reservado para este trabajo. Tenemos respaldos para que el cliente nunca se quede esperando.\n\n${svc?.name} · ${job.city} ${job.zip} · ${job.scheduled_date}\nPaga ${money(pay)} si lo llamamos y hace el trabajo.\n\nSi el profesional no puede ir, usted recibe la primera llamada (respaldo n.º ${rank}). Sin obligación ahora: confirme si puede dejar ese horario libre, o pase.\n\nResponda: ${siteUrl()}/pro#standby\n\n— ${BRAND.name}`,
      },
    });
  }
  await addEvent(job.id, "backups", `Backups asked: ${picks.map((p, i) => `#${ranks[i]} ${p.contractor.business_name}`).join(", ")}`, "system", false);
  return n;
}

/** A backup answers a standby request. Passing is always free; the spot goes to the next pro. */
export async function answerStandby(backupId: string, contractorId: string, yes: boolean) {
  const { data: row } = await db().from("job_backups").update({ status: yes ? "standby" : "declined", responded_at: new Date().toISOString() })
    .eq("id", backupId).eq("contractor_id", contractorId).in("status", ["asked", "standby"]).select("job_id, rank").maybeSingle();
  if (!row) return { ok: false, error: "This request is no longer open" };
  await addEvent(row.job_id, "backups", `Backup #${row.rank} ${yes ? "confirmed they can cover" : "passed"}`, "pro", false);
  if (!yes) await lineUpBackups(row.job_id).catch((e) => console.error("[backups]", e));
  return { ok: true };
}

/** The assigned pro is off the job (handed back or no-show): keep the customer informed and get the backups going. */
export async function handOff(jobId: string, fromContractorId: string, why: "released" | "no_show") {
  const job = await getJob(jobId);
  if (!job) return;
  await db().from("jobs").update({ handoffs: Number((job as Job & { handoffs?: number }).handoffs ?? 0) + 1 }).eq("id", jobId);
  // the pro who left is never their own backup
  await db().from("job_backups").update({ status: "released" }).eq("job_id", jobId).eq("contractor_id", fromContractorId);
  const svc = getService(job.service_slug);
  const when = whenOf(job);
  await notify(job.customer_id, {
    title: "A quick update on your booking",
    body: `Your pro for ${svc?.name} (${when}) had to step away. A backup pro is being confirmed now — same time, nothing for you to do.`,
    data: { type: "job", jobId: job.id },
    sms: { to: job.contact_phone, body: `${BRAND.name}: quick update on ${job.ref} — your pro had to step away, so we're confirming your backup pro now. Same time (${when}), nothing for you to do. We'll text you their name. ${siteUrl()}/account/jobs/${job.id}` },
    email: { to: job.contact_email, subject: `Update on your booking ${job.ref} — same time, new pro`, text: `A quick heads-up: the pro booked for your ${svc?.name} on ${when} had to step away${why === "no_show" ? "" : " ahead of time"}.\n\nEvery booking has backup pros lined up, and we're confirming yours now. Your time stays the same and there's nothing you need to do — we'll send their name as soon as they're confirmed.\n\nTrack it: ${siteUrl()}/account/jobs/${job.id}\nQuestions? Reply to this email or call ${BRAND.supportPhone}.\n\n— ${BRAND.name}` },
    locale: job.locale,
    es: {
      title: "Una actualización sobre su reserva",
      body: `Su profesional para ${svc?.name} (${job.scheduled_date}) tuvo que retirarse. Estamos confirmando un profesional de respaldo — misma hora, no tiene que hacer nada.`,
      sms: `${BRAND.name}: actualización de ${job.ref} — su profesional tuvo que retirarse y estamos confirmando a su profesional de respaldo. Misma hora, no tiene que hacer nada. Le enviaremos su nombre. ${siteUrl()}/account/jobs/${job.id}`,
      subject: `Actualización de su reserva ${job.ref} — misma hora, nuevo profesional`,
      text: `Un aviso: el profesional reservado para su ${svc?.name} tuvo que retirarse.\n\nCada reserva tiene profesionales de respaldo y estamos confirmando el suyo. Su horario no cambia y no tiene que hacer nada — le enviaremos su nombre en cuanto esté confirmado.\n\nSígala: ${siteUrl()}/account/jobs/${job.id}\n\n— ${BRAND.name}`,
    },
  });
  await callNextBackup(jobId, [fromContractorId]);
}

/** Call the next backup in line (urgent offer, short answer window); when none are left, offer it to everyone. */
export async function callNextBackup(jobId: string, exclude: string[] = []): Promise<{ called: string | null }> {
  const job = await getJob(jobId);
  if (!job || job.contractor_id || !["dispatched", "scheduled", "assigned"].includes(job.status)) return { called: null };
  const rows = await backupsOf(jobId);
  const { data: tried } = await db().from("job_offers").select("contractor_id").eq("job_id", jobId).in("status", ["declined", "expired", "taken"]);
  const skip = [...exclude, ...((tried ?? []) as { contractor_id: string }[]).map((t) => t.contractor_id), ...rows.filter((r) => ["called", "passed", "declined", "released"].includes(r.status)).map((r) => r.contractor_id)];
  const next = nextBackup(rows, skip);
  if (!next) {
    await addEvent(jobId, "dispatch", "No backups left — offering to all nearby pros", "system", false);
    await dispatchJob(jobId, { exclude: [...new Set([...skip, ...rows.map((r) => r.contractor_id)])] }).catch((e) => console.error("[coverage]", e));
    const left = hoursUntilWindow(job);
    if (left < 24) await raiseAlert("coverage", left < 6 ? "critical" : "warn", `${job.ref}: backups exhausted, ${Math.max(0, Math.round(left))}h to go`, "All backups passed or didn't answer. Offered to every nearby pro — call pros directly if nobody accepts soon, and keep the customer posted.", jobId);
    return { called: null };
  }
  const { data: pro } = await db().from("contractors").select("*").eq("id", next.contractor_id).single();
  if (!pro || (pro as Contractor).status !== "approved") {
    await db().from("job_backups").update({ status: "released" }).eq("job_id", jobId).eq("contractor_id", next.contractor_id);
    return callNextBackup(jobId, [...exclude, next.contractor_id]);
  }
  const hoursLeft = hoursUntilWindow(job);
  const minutes = backupAnswerMinutes(hoursLeft);
  const pay = tierPayout(job.price_final, job.contractor_payout, proTier(pro as Contractor));
  const expires = new Date(Date.now() + minutes * 60000).toISOString();
  const { data: offer } = await db().from("job_offers").upsert({ job_id: jobId, contractor_id: next.contractor_id, kind: "backup", payout: pay, ai_reason: `Backup #${next.rank}`, status: "offered", offered_at: new Date().toISOString(), expires_at: expires, terms_accepted_at: null, work_order_version: null }, { onConflict: "job_id,contractor_id" }).select("id").single();
  await db().from("job_backups").update({ status: "called", called_at: new Date().toISOString() }).eq("job_id", jobId).eq("contractor_id", next.contractor_id);
  await db().from("jobs").update({ status: "dispatched" }).eq("id", jobId);
  await addEvent(jobId, "dispatch", `Backup #${next.rank} called (${minutes} min to answer)`, "system", false);
  const svc = getService(job.service_slug);
  const p = pro as Contractor;
  await notify(p.profile_id, {
    title: `🚨 Backup call: you're up (#${next.rank})`,
    body: `${svc?.name} · ${job.city} ${job.zip} · ${whenOf(job)} · ${money(pay)}. Accept within ${minutes} min.`,
    data: { type: "offer", offerId: offer?.id },
    channel: "offers",
    sms: { to: p.phone, body: `${BRAND.name} BACKUP CALL: the booked pro can't make ${svc?.name} in ${job.city} ${job.zip}, ${whenOf(job)}. ${money(pay)}. You're backup #${next.rank} — accept within ${minutes} min: ${siteUrl()}/pro/offers/${offer?.id}` },
    email: { to: p.email, subject: `Backup call: ${svc?.name} · ${job.zip} · ${money(pay)} — answer within ${minutes} min`, text: `You're backup #${next.rank} and the booked pro can't make it.\n\n${svc?.name} · ${job.city} ${job.zip}\n${whenOf(job)}\nPays ${money(pay)}\n\nAccept within ${minutes} minutes or it goes to the next backup:\n${siteUrl()}/pro/offers/${offer?.id}\n\n— ${BRAND.name}` },
    es: {
      title: `🚨 Llamada de respaldo: le toca (n.º ${next.rank})`,
      body: `${svc?.name} · ${job.city} ${job.zip} · ${job.scheduled_date} · ${money(pay)}. Acepte en ${minutes} min.`,
      sms: `${BRAND.name} LLAMADA DE RESPALDO: el profesional reservado no puede ir a ${svc?.name} en ${job.city} ${job.zip}, ${job.scheduled_date}. ${money(pay)}. Es el respaldo n.º ${next.rank} — acepte en ${minutes} min: ${siteUrl()}/pro/offers/${offer?.id}`,
      subject: `Llamada de respaldo: ${svc?.name} · ${job.zip} · ${money(pay)} — responda en ${minutes} min`,
      text: `Usted es el respaldo n.º ${next.rank} y el profesional reservado no puede ir.\n\n${svc?.name} · ${job.city} ${job.zip} · ${job.scheduled_date}\nPaga ${money(pay)}\n\nAcepte en ${minutes} minutos o pasa al siguiente respaldo:\n${siteUrl()}/pro/offers/${offer?.id}\n\n— ${BRAND.name}`,
    },
  });
  return { called: next.contractor_id };
}

/** A backup passed on (or let lapse) their call: mark it and call the next one. */
export async function backupPassed(jobId: string, contractorId: string) {
  await db().from("job_backups").update({ status: "passed", responded_at: new Date().toISOString() }).eq("job_id", jobId).eq("contractor_id", contractorId);
  await callNextBackup(jobId, [contractorId]);
}

/** A backup took the job: mark them promoted, then refill the backups behind them. */
export async function backupPromoted(jobId: string, contractorId: string) {
  await db().from("job_backups").update({ status: "promoted", responded_at: new Date().toISOString() }).eq("job_id", jobId).eq("contractor_id", contractorId);
  await lineUpBackups(jobId).catch((e) => console.error("[backups]", e));
}

/** Job done or cancelled: everyone on standby is free. */
export async function releaseBackups(jobId: string) {
  await db().from("job_backups").update({ status: "released" }).eq("job_id", jobId).in("status", ["asked", "standby", "called"]);
}

/** Every 10 minutes: fill missing backups for the next 3 days; flag jobs about to start with nobody on them. */
export async function coverageSweep() {
  const today = new Date().toISOString().slice(0, 10);
  const in3 = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);
  const { data: jobs } = await db().from("jobs").select("id, ref, status, contractor_id, scheduled_date, time_window").gte("scheduled_date", today).lte("scheduled_date", in3).in("status", ["assigned", "scheduled", "dispatched"]).limit(500);
  let filled = 0, flagged = 0;
  for (const j of (jobs ?? []) as Pick<Job, "id" | "ref" | "status" | "contractor_id" | "scheduled_date" | "time_window">[]) {
    const left = hoursUntilWindow(j);
    if (left < 0) continue;
    if (j.contractor_id) {
      const rows = await backupsOf(j.id);
      if (openBackupRanks(rows).length && rows.filter((r) => ["asked", "standby", "called"].includes(r.status)).length < BACKUPS.count) filled += await lineUpBackups(j.id).catch(() => 0);
    } else if (left < 6) {
      const { count } = await db().from("ops_alerts").select("id", { count: "exact", head: true }).eq("job_id", j.id).eq("kind", "uncovered").eq("resolved", false);
      if (!count) { await raiseAlert("uncovered", "critical", `${j.ref}: starts in ${Math.max(0, Math.round(left))}h with no pro`, "Call backups and nearby pros directly now, and update the customer.", j.id); flagged++; }
    }
  }
  return { filled, flagged };
}

/** A pro's open standby requests, with what they need to decide (no customer address until they're called and accept). */
export async function standbyFor(contractorId: string) {
  const { data: rows } = await db().from("job_backups").select("id, job_id, rank, status").eq("contractor_id", contractorId).in("status", ["asked", "standby"]);
  const list = (rows ?? []) as { id: string; job_id: string; rank: number; status: "asked" | "standby" }[];
  if (!list.length) return [];
  const { data: jobs } = await db().from("jobs").select("id, ref, service_slug, city, zip, scheduled_date, time_window, price_final, contractor_payout, status").in("id", list.map((r) => r.job_id));
  const { data: me } = await db().from("contractors").select("*").eq("id", contractorId).single();
  const byId = new Map(((jobs ?? []) as Job[]).map((j) => [j.id, j]));
  return list.flatMap((r) => {
    const j = byId.get(r.job_id);
    if (!j || !j.scheduled_date || j.scheduled_date < new Date().toISOString().slice(0, 10)) return [];
    return [{ id: r.id, rank: r.rank, status: r.status, ref: j.ref, service_slug: j.service_slug, city: j.city, zip: j.zip, scheduled_date: j.scheduled_date, time_window: j.time_window, pay: me ? tierPayout(j.price_final, j.contractor_payout, proTier(me as Contractor)) : Number(j.contractor_payout ?? 0) }];
  }).sort((a, b) => a.scheduled_date.localeCompare(b.scheduled_date));
}
