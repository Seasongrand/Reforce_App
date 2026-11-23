/**
 * Horário fixo semanal (decisão do dono, 22/11). A família liga o horário fixo a
 * partir de uma aula paga; a partir daí, a varredura reserva a aula da semana
 * seguinte para ela (reserva temporária que vai até 24 horas antes da aula),
 * gera o PIX 5 dias antes e avisa. Sem pagamento, a reserva vence e só aquela
 * semana se perde; três semanas seguidas sem pagar encerram o horário fixo.
 * As datas somam semanas na hora local do professor, nunca 168 horas (§2.1).
 */
import { sql } from 'kysely';
import { Temporal } from 'temporal-polyfill';
import type { Db } from '@/db/client';
import { instantFromDb } from '@/time/zoned';
import { subjectName } from '../catalog';
import type { Deps } from '../deps';
import { DomainError } from '../errors';
import { scheduleNotice } from '../notifications/schedule';
import { startPayment } from '../payment/charge';
import { holdSlots } from './hold';

/** A aula da semana fica reservada até este tanto antes dela; depois, sem pagamento, vence. */
export const PAY_UNTIL_HOURS = 24;
/** O PIX da semana sai este tanto antes da aula. */
export const CHARGE_LEAD_DAYS = 5;
/** Semanas seguidas sem pagamento que encerram o horário fixo. */
export const MAX_UNPAID_IN_ROW = 3;
/** Se uma semana ficou para trás (o professor não tinha o horário), reserva o que começa nestes próximos dias. */
const RESERVE_AHEAD_DAYS = 8;

export async function startWeeklySeries(
  deps: Deps,
  input: { guardianId: string; bookingId: string },
  _now: Temporal.Instant,
): Promise<string> {
  return deps.db.transaction().execute(async (trx) => {
    const b = (await sql<{ status: string; series_id: string | null; teacher_id: string; student_id: string; service_id: string;
      address_id: string | null; local_start: string; timezone: string }>`
      SELECT b.status, b.series_id, b.teacher_id, b.student_id, b.service_id, b.address_id, b.local_start::text, b.timezone
        FROM bookings b JOIN orders o ON o.id = b.order_id
       WHERE b.id = ${input.bookingId} AND o.guardian_id = ${input.guardianId}
       FOR UPDATE OF b`.execute(trx)).rows[0];
    if (!b) throw new DomainError('not_found', 'aula não encontrada');
    if (b.series_id) throw new DomainError('conflict', 'esta aula já é horário fixo');
    if (b.status !== 'confirmed') throw new DomainError('conflict', 'o horário fixo começa a partir de uma aula paga e marcada');
    const s = (await sql<{ id: string }>`
      INSERT INTO weekly_series (guardian_id, teacher_id, student_id, service_id, address_id, local_start, timezone)
      VALUES (${input.guardianId}, ${b.teacher_id}, ${b.student_id}, ${b.service_id}, ${b.address_id},
              ${b.local_start}::timestamp, ${b.timezone})
      RETURNING id`.execute(trx)).rows[0]!;
    await sql`UPDATE bookings SET series_id = ${s.id} WHERE id = ${input.bookingId}`.execute(trx);
    return s.id;
  });
}

export async function endWeeklySeries(
  deps: Deps,
  input: { guardianId: string; seriesId: string },
  now: Temporal.Instant,
): Promise<void> {
  await deps.db.transaction().execute(async (trx) => {
    const s = (await sql<{ status: string }>`
      SELECT status FROM weekly_series WHERE id = ${input.seriesId} AND guardian_id = ${input.guardianId} FOR UPDATE`
      .execute(trx)).rows[0];
    if (!s) throw new DomainError('not_found', 'horário fixo não encontrado');
    if (s.status !== 'active') throw new DomainError('conflict', 'este horário fixo já foi encerrado');
    await sql`UPDATE weekly_series SET status = 'ended', ended_reason = 'by_family', ended_at = ${now.toString()}::timestamptz
               WHERE id = ${input.seriesId}`.execute(trx);
    // a semana reservada e ainda não paga é liberada; a cobrança pendente é cancelada pela varredura (expireHolds)
    await sql`WITH gone AS (
                UPDATE bookings SET status = 'expired' WHERE series_id = ${input.seriesId} AND status = 'held'
                RETURNING order_id)
              UPDATE orders SET status = 'expired' WHERE id IN (SELECT order_id FROM gone) AND status = 'awaiting_payment'`
      .execute(trx);
  });
}

interface ActiveSeries {
  id: string; guardian_id: string; teacher_id: string; student_id: string; service_id: string; address_id: string | null;
}

/** Varredura (a cada minuto): encerra quem deixou de pagar, reserva a semana seguinte e gera o PIX da semana. */
export async function prepareWeeklySeries(deps: Deps, now: Temporal.Instant): Promise<{ reserved: number; charged: number; ended: number }> {
  const out = { reserved: 0, charged: 0, ended: 0 };
  const { rows: series } = await sql<ActiveSeries>`
    SELECT id, guardian_id, teacher_id, student_id, service_id, address_id FROM weekly_series WHERE status = 'active'`
    .execute(deps.db);
  for (const s of series) {
    try {
      if (await endIfUnpaid(deps, s.id, now)) {
        out.ended += 1;
        continue;
      }
      out.reserved += await reserveNext(deps, s, now);
      out.charged += await chargeDue(deps, s, now);
    } catch (err) {
      console.error(`[horário fixo] falha na série ${s.id}:`, (err as Error).message);
    }
  }
  return out;
}

async function endIfUnpaid(deps: Deps, seriesId: string, now: Temporal.Instant): Promise<boolean> {
  return deps.db.transaction().execute(async (trx) => {
    const { rows } = await sql<{ id: string; status: string }>`
      SELECT id, status FROM bookings WHERE series_id = ${seriesId} AND status <> 'cancelled'
       ORDER BY local_start DESC LIMIT ${MAX_UNPAID_IN_ROW}`.execute(trx);
    if (rows.length < MAX_UNPAID_IN_ROW || rows.some((r) => r.status !== 'expired')) return false;
    const upd = await sql`UPDATE weekly_series SET status = 'ended', ended_reason = 'unpaid', ended_at = ${now.toString()}::timestamptz
                           WHERE id = ${seriesId} AND status = 'active'`.execute(trx);
    if (Number(upd.numAffectedRows ?? 0) === 0) return false;
    await scheduleNotice(trx, rows[0]!.id, 'horario_fixo_encerrado', now);
    return true;
  });
}

async function reserveNext(deps: Deps, s: ActiveSeries, now: Temporal.Instant): Promise<number> {
  // semanas ainda sem aula da série, que começam nos próximos dias e ainda dão prazo de pagamento
  const { rows } = await sql<{ starts_at: string; local: string }>`
    SELECT occ AT TIME ZONE ws.timezone AS starts_at, occ::text AS local
      FROM weekly_series ws,
           LATERAL (SELECT ws.local_start + make_interval(days => 7 * k) AS occ FROM generate_series(1, 520) k) x
     WHERE ws.id = ${s.id}
       AND occ AT TIME ZONE ws.timezone > ${now.toString()}::timestamptz + make_interval(hours => ${PAY_UNTIL_HOURS})
       -- só a semana seguinte à última aula que já começou (ou à primeira da série, se nenhuma começou);
       -- se alguma semana ficou para trás, a que começa nos próximos dias
       AND occ AT TIME ZONE ws.timezone <= greatest(
             coalesce((SELECT max(b.starts_at) FROM bookings b WHERE b.series_id = ws.id AND b.starts_at <= ${now.toString()}::timestamptz),
                      (SELECT min(b.starts_at) FROM bookings b WHERE b.series_id = ws.id)) + interval '7 days',
             ${now.toString()}::timestamptz + make_interval(days => ${RESERVE_AHEAD_DAYS}))
       AND NOT EXISTS (SELECT 1 FROM bookings b WHERE b.series_id = ws.id AND b.local_start = x.occ)
     ORDER BY occ`.execute(deps.db);
  let reserved = 0;
  for (const r of rows) {
    const startsAt = instantFromDb(r.starts_at);
    const res = await holdSlots(deps, {
      teacherId: s.teacher_id, serviceId: s.service_id, guardianId: s.guardian_id, studentId: s.student_id,
      addressId: s.address_id, startsAt: [startsAt], idempotencyKey: `series:${s.id}:${r.local}`,
      holdUntil: startsAt.subtract({ hours: PAY_UNTIL_HOURS }), seriesId: s.id,
    }, now);
    // horário que o professor deixou de oferecer nesta semana: a família marca por fora; tenta de novo na próxima varredura
    if (res.ok) reserved += 1;
  }
  return reserved;
}

async function chargeDue(deps: Deps, s: ActiveSeries, now: Temporal.Instant): Promise<number> {
  const { rows } = await sql<{ booking_id: string; order_id: string }>`
    SELECT b.id AS booking_id, b.order_id FROM bookings b
     WHERE b.series_id = ${s.id} AND b.status = 'held' AND b.hold_expires_at > ${now.toString()}::timestamptz
       AND b.starts_at <= ${now.toString()}::timestamptz + make_interval(days => ${CHARGE_LEAD_DAYS})
       AND NOT EXISTS (SELECT 1 FROM payments p WHERE p.order_id = b.order_id)`.execute(deps.db);
  let charged = 0;
  for (const r of rows) {
    await startPayment(deps, { orderId: r.order_id, guardianId: s.guardian_id, method: 'pix' }, now);
    await deps.db.transaction().execute((trx) => scheduleNotice(trx, r.booking_id, 'horario_fixo_cobranca', now));
    charged += 1;
  }
  return charged;
}

export interface WeeklySeriesView {
  id: string;
  teacherName: string;
  teacherSlug: string;
  studentFirstName: string;
  subject: string;
  modality: 'online' | 'at_teacher' | 'at_student';
  /** Dia da semana ISO (1 = segunda) e hora, no fuso do professor. */
  weekday: number;
  time: string;
  timezone: string;
  /** A aula da semana reservada e ainda não paga. */
  nextToPay: { orderId: string; startsAt: string; payUntil: string } | null;
}

/** Horários fixos ativos do responsável, com a aula da semana a pagar. */
export async function weeklySeriesOf(db: Db, guardianId: string, now: Temporal.Instant): Promise<WeeklySeriesView[]> {
  const { rows } = await sql<{
    id: string; t_name: string; t_slug: string; s_name: string; subject: string; modality: WeeklySeriesView['modality'];
    local_start: string; timezone: string; order_id: string | null; starts_at: string | null; hold_expires_at: string | null;
  }>`
    SELECT ws.id, t.display_name AS t_name, t.slug AS t_slug, st.first_name AS s_name, sv.subject, sv.modality,
           ws.local_start::text, ws.timezone, nx.order_id, nx.starts_at, nx.hold_expires_at
      FROM weekly_series ws
      JOIN teachers t ON t.id = ws.teacher_id
      JOIN students st ON st.id = ws.student_id
      JOIN services sv ON sv.id = ws.service_id
      LEFT JOIN LATERAL (
        SELECT b.order_id, b.starts_at, b.hold_expires_at FROM bookings b
         WHERE b.series_id = ws.id AND b.status = 'held' AND b.hold_expires_at > ${now.toString()}::timestamptz
         ORDER BY b.starts_at LIMIT 1) nx ON true
     WHERE ws.guardian_id = ${guardianId} AND ws.status = 'active'
     ORDER BY ws.created_at`.execute(db);
  return rows.map((r) => {
    const local = Temporal.PlainDateTime.from(r.local_start.replace(' ', 'T'));
    return {
      id: r.id,
      teacherName: r.t_name,
      teacherSlug: r.t_slug,
      studentFirstName: r.s_name,
      subject: subjectName(r.subject),
      modality: r.modality,
      weekday: local.dayOfWeek,
      time: `${String(local.hour).padStart(2, '0')}:${String(local.minute).padStart(2, '0')}`,
      timezone: r.timezone,
      nextToPay: r.order_id && r.starts_at && r.hold_expires_at
        ? { orderId: r.order_id, startsAt: instantFromDb(r.starts_at).toString(), payUntil: instantFromDb(r.hold_expires_at).toString() }
        : null,
    };
  });
}
