/**
 * Cancelar e remarcar uma aula paga (regra do dono, 21/11):
 * - com 24 horas ou mais até a aula, a família cancela com devolução integral
 *   da aula, ou remarca;
 * - com menos de 24 horas, só remarca (sem devolução);
 * - cada aula pode ser remarcada até 2 vezes;
 * - o professor cancela aula paga a qualquer momento antes do início, com
 *   devolução integral para a família (especificação).
 * Tudo na trava do professor; a restrição de exclusão continua sendo a garantia
 * contra dois alunos no mesmo horário. Os avisos saem pela varredura de minuto
 * em minuto, e a devolução pela tarefa payment.refund.
 */
import { sql, type Transaction } from 'kysely';
import { Temporal } from 'temporal-polyfill';
import type { Db } from '@/db/client';
import type { DB } from '@/db/types';
import { isSlotTaken } from '@/db/errors';
import { instantFromDb, plainToDb, toLocal } from '@/time/zoned';
import { enqueue } from '@/worker/enqueue';
import { availableSlots } from '../availability';
import { syncCalendarBusy } from '../calendar/sync';
import type { Deps } from '../deps';
import { DomainError } from '../errors';
import { queueOrderRefund } from '../payment/order-refund';
import { scheduleForRescheduledBooking, scheduleNotice } from '../notifications/schedule';
import { checkinCode, checkinHash } from './checkin';

export const FREE_CANCEL_HOURS = 24;
export const MAX_RESCHEDULES = 2;
/** Mesma janela da página do professor. */
const SLOT_DAYS = 62;
const UUID = /^[0-9a-f-]{36}$/i;

interface LessonRow {
  id: string; order_id: string; teacher_id: string; service_id: string; student_id: string; address_id: string | null;
  modality: string; status: string; starts_at: string; guardian_id: string; total_cents: number; lessons: number;
}

async function lesson(db: Db | Transaction<DB>, bookingId: string, lock = false): Promise<LessonRow | undefined> {
  if (!UUID.test(bookingId)) return undefined;
  const { rows } = await sql<LessonRow>`
    SELECT b.id, b.order_id, b.teacher_id, b.service_id, b.student_id, b.address_id, b.modality, b.status, b.starts_at,
           o.guardian_id, o.total_cents, o.lessons
      FROM bookings b JOIN orders o ON o.id = b.order_id
     WHERE b.id = ${bookingId}
     ${lock ? sql`FOR UPDATE OF b` : sql``}`.execute(db);
  return rows[0];
}

const perLesson = (l: LessonRow) => Math.floor(l.total_cents / l.lessons);
const upcoming = (l: LessonRow, now: Temporal.Instant) =>
  l.status === 'confirmed' && instantFromDb(l.starts_at).epochMilliseconds > now.epochMilliseconds;
const freeCancelUntil = (l: LessonRow) => instantFromDb(l.starts_at).subtract({ hours: FREE_CANCEL_HOURS });

/** Quantas vezes esta aula já foi remarcada (a cadeia de "remarcada de"). */
async function timesRescheduled(db: Db | Transaction<DB>, bookingId: string): Promise<number> {
  const { rows } = await sql<{ n: number }>`
    WITH RECURSIVE chain AS (
      SELECT id, rescheduled_from FROM bookings WHERE id = ${bookingId}
      UNION ALL
      SELECT b.id, b.rescheduled_from FROM bookings b JOIN chain c ON b.id = c.rescheduled_from)
    SELECT (count(*) - 1)::int AS n FROM chain`.execute(db);
  return rows[0]?.n ?? 0;
}

export interface ChangeOptions {
  canCancel: boolean;
  canReschedule: boolean;
  refundCents: number;
  freeCancelUntil: Temporal.Instant;
  reschedulesLeft: number;
}

/** O que a família pode fazer com a aula agora; null se a aula não é dela ou não está por vir. */
export async function changeOptions(db: Db, guardianId: string, bookingId: string, now: Temporal.Instant): Promise<ChangeOptions | null> {
  const l = await lesson(db, bookingId);
  if (!l || l.guardian_id !== guardianId || !upcoming(l, now)) return null;
  const left = Math.max(0, MAX_RESCHEDULES - (await timesRescheduled(db, bookingId)));
  return {
    canCancel: now.epochMilliseconds <= freeCancelUntil(l).epochMilliseconds,
    canReschedule: left > 0,
    refundCents: perLesson(l),
    freeCancelUntil: freeCancelUntil(l),
    reschedulesLeft: left,
  };
}

/** Horários livres do mesmo professor e do mesmo tipo de aula para remarcar (vazio se não pode remarcar). */
export async function rescheduleSlots(deps: Deps, guardianId: string, bookingId: string, now: Temporal.Instant): Promise<Temporal.Instant[]> {
  const o = await changeOptions(deps.db, guardianId, bookingId, now);
  if (!o?.canReschedule) return [];
  const l = (await lesson(deps.db, bookingId))!;
  return availableSlots(deps, { teacherId: l.teacher_id, serviceId: l.service_id, days: SLOT_DAYS }, now);
}

const lockTeacher = (trx: Transaction<DB>, teacherId: string) =>
  sql`SELECT pg_advisory_xact_lock(hashtextextended('teacher:' || ${teacherId}, 0))`.execute(trx);
const actor = (trx: Transaction<DB>, who: string) => sql`SELECT set_config('app.actor', ${who}, true)`.execute(trx);

async function afterFreed(trx: Transaction<DB>, l: LessonRow): Promise<void> {
  await enqueue(trx, 'calendar.delete_event', { bookingId: l.id }, { jobKey: `caldel:${l.id}` });
  await enqueue(trx, 'search.refresh_teacher', { teacherId: l.teacher_id }, { jobKey: `refresh:${l.teacher_id}` });
}

export async function cancelByFamily(
  deps: Deps, input: { guardianId: string; bookingId: string }, now: Temporal.Instant,
): Promise<{ refundCents: number }> {
  const first = await lesson(deps.db, input.bookingId);
  if (!first || first.guardian_id !== input.guardianId) throw new DomainError('not_found', 'aula não encontrada');
  return deps.db.transaction().execute(async (trx) => {
    await lockTeacher(trx, first.teacher_id);
    const l = (await lesson(trx, input.bookingId, true))!;
    if (!upcoming(l, now)) throw new DomainError('conflict', 'esta aula não pode mais ser cancelada');
    if (now.epochMilliseconds > freeCancelUntil(l).epochMilliseconds) {
      throw new DomainError('conflict', 'com menos de 24 horas da aula, só dá para remarcar');
    }
    await actor(trx, `guardian:${input.guardianId}`);
    await sql`UPDATE bookings SET status = 'cancelled' WHERE id = ${l.id} AND status = 'confirmed'`.execute(trx);
    await queueOrderRefund(trx, l.order_id);
    await scheduleNotice(trx, l.id, 'cancelada_pela_familia', now);
    await scheduleNotice(trx, l.id, 'cancelamento_confirmado', now);
    await afterFreed(trx, l);
    return { refundCents: perLesson(l) };
  });
}

export async function cancelByTeacher(
  deps: Deps, input: { teacherId: string; bookingId: string }, now: Temporal.Instant,
): Promise<{ refundCents: number }> {
  const first = await lesson(deps.db, input.bookingId);
  if (!first || first.teacher_id !== input.teacherId) throw new DomainError('not_found', 'aula não encontrada');
  return deps.db.transaction().execute(async (trx) => {
    await lockTeacher(trx, first.teacher_id);
    const l = (await lesson(trx, input.bookingId, true))!;
    if (!upcoming(l, now)) throw new DomainError('conflict', 'esta aula não pode mais ser cancelada');
    await actor(trx, `teacher:${input.teacherId}`);
    await sql`UPDATE bookings SET status = 'cancelled' WHERE id = ${l.id} AND status = 'confirmed'`.execute(trx);
    await queueOrderRefund(trx, l.order_id);
    await scheduleNotice(trx, l.id, 'cancelada_pelo_professor', now);
    await afterFreed(trx, l);
    return { refundCents: perLesson(l) };
  });
}

export type RescheduleReason = 'ocupado' | 'indisponivel' | 'antecedencia' | 'limite_diario';

class Rejected extends Error {
  constructor(readonly reason: RescheduleReason) {
    super(reason);
  }
}

export async function rescheduleByFamily(
  deps: Deps,
  input: { guardianId: string; bookingId: string; startsAt: Temporal.Instant },
  now: Temporal.Instant,
): Promise<{ ok: true; bookingId: string } | { ok: false; reason: RescheduleReason }> {
  const first = await lesson(deps.db, input.bookingId);
  if (!first || first.guardian_id !== input.guardianId) throw new DomainError('not_found', 'aula não encontrada');
  if (!upcoming(first, now)) throw new DomainError('conflict', 'esta aula não pode mais ser remarcada');
  if ((await timesRescheduled(deps.db, input.bookingId)) >= MAX_RESCHEDULES) {
    throw new DomainError('conflict', `esta aula já foi remarcada ${MAX_RESCHEDULES} vezes`);
  }
  const svc = await deps.db.selectFrom('services').innerJoin('teachers', 'teachers.id', 'services.teacher_id')
    .select(['services.duration_min', 'services.buffer_before_min', 'services.buffer_after_min', 'teachers.timezone',
      'teachers.min_notice_min'])
    .where('services.id', '=', first.service_id).executeTakeFirstOrThrow();
  const start = input.startsAt;
  // fora da transação: livre/ocupado do calendário externo (nunca dentro dela), como na reserva
  await syncCalendarBusy(deps, first.teacher_id, {
    start: start.subtract({ minutes: svc.buffer_before_min }),
    end: start.add({ minutes: svc.duration_min + svc.buffer_after_min }),
  }, now);

  try {
    return await deps.db.transaction().execute(async (trx) => {
      await lockTeacher(trx, first.teacher_id);
      const l = (await lesson(trx, input.bookingId, true))!;
      if (!upcoming(l, now)) throw new DomainError('conflict', 'esta aula não pode mais ser remarcada');
      await actor(trx, `guardian:${input.guardianId}`);
      // a aula antiga sai da frente primeiro: se o novo horário falhar, a transação desfaz tudo
      await sql`UPDATE bookings SET status = 'rescheduled' WHERE id = ${l.id} AND status = 'confirmed'`.execute(trx);

      const local = plainToDb(toLocal(start, svc.timezone));
      const range = sql`tstzrange((${local}::timestamp AT TIME ZONE ${svc.timezone}) - make_interval(mins => ${svc.buffer_before_min}::int),
                                  (${local}::timestamp AT TIME ZONE ${svc.timezone}) + make_interval(mins => ${svc.duration_min + svc.buffer_after_min}::int), '[)')`;
      // reservas temporárias vencidas no caminho deixam de bloquear (como na reserva)
      await sql`WITH gone AS (
                  UPDATE bookings SET status = 'expired'
                   WHERE teacher_id = ${l.teacher_id} AND status = 'held'
                     AND hold_expires_at < ${now.toString()}::timestamptz AND blocked && ${range}
                  RETURNING order_id)
                UPDATE orders SET status = 'expired'
                 WHERE id IN (SELECT order_id FROM gone) AND status = 'awaiting_payment'`.execute(trx);
      const check = await sql<{ s: string; on_grid: boolean; busy: boolean; same_day: number; max_day: number | null }>`
        WITH t AS (SELECT * FROM teachers WHERE id = ${l.teacher_id}),
             x AS (SELECT (${local}::timestamp AT TIME ZONE t.timezone) AS s, ${local}::timestamp::date AS d FROM t)
        SELECT x.s, t.max_lessons_per_day AS max_day,
               EXISTS (SELECT 1 FROM free_slots(${l.teacher_id}, ${l.service_id}, x.d, x.d, ${now.toString()}::timestamptz) f
                        WHERE f = x.s) AS on_grid,
               EXISTS (SELECT 1 FROM bookings b
                        WHERE b.teacher_id = t.id AND b.blocked && ${range}
                          AND (b.status = 'confirmed' OR (b.status = 'held' AND b.hold_expires_at > ${now.toString()}::timestamptz))) AS busy,
               (SELECT count(*)::int FROM bookings b
                 WHERE b.teacher_id = t.id AND (b.starts_at AT TIME ZONE t.timezone)::date = x.d
                   AND (b.status = 'confirmed' OR (b.status = 'held' AND b.hold_expires_at > ${now.toString()}::timestamptz))) AS same_day
          FROM t, x`.execute(trx);
      const c = check.rows[0]!;
      if (!instantFromDb(c.s).equals(start)) throw new Rejected('indisponivel');
      if (Temporal.Instant.compare(start, now.add({ minutes: svc.min_notice_min })) < 0) throw new Rejected('antecedencia');
      if (c.max_day !== null && c.same_day >= c.max_day) throw new Rejected('limite_diario');
      if (c.busy) throw new Rejected('ocupado');
      if (!c.on_grid) throw new Rejected('indisponivel');

      const ins = await sql<{ id: string }>`
        INSERT INTO bookings (order_id, teacher_id, student_id, service_id, starts_at, ends_at, blocked,
                              local_start, timezone, status, modality, address_id, rescheduled_from)
        SELECT ${l.order_id}, t.id, ${l.student_id}, ${l.service_id},
               s, s + make_interval(mins => ${svc.duration_min}::int),
               tstzrange(s - make_interval(mins => ${svc.buffer_before_min}::int),
                         s + make_interval(mins => ${svc.duration_min + svc.buffer_after_min}::int), '[)'),
               ${local}::timestamp, t.timezone, 'confirmed', ${l.modality}, ${l.address_id}, ${l.id}
          FROM teachers t, LATERAL (SELECT ${local}::timestamp AT TIME ZONE t.timezone AS s) x
         WHERE t.id = ${l.teacher_id}
        RETURNING id`.execute(trx);
      const newId = ins.rows[0]!.id;
      const secret = deps.config.sessionSecret;
      const hash = l.modality === 'online' ? null : checkinHash(newId, checkinCode(newId, secret), secret);
      await sql`INSERT INTO lesson_sessions (booking_id, checkin_code_hash) VALUES (${newId}, ${hash})`.execute(trx);
      await scheduleForRescheduledBooking(trx, newId, now);
      if (l.modality === 'online') await enqueue(trx, 'video.create_room', { bookingId: newId }, { jobKey: `room:${newId}` });
      const cal = await trx.selectFrom('calendar_connections').select('id')
        .where('teacher_id', '=', l.teacher_id).where('status', '=', 'active').executeTakeFirst();
      if (cal) await enqueue(trx, 'calendar.create_event', { bookingId: newId }, { jobKey: `cal:${newId}` });
      await afterFreed(trx, l);
      return { ok: true as const, bookingId: newId };
    });
  } catch (err) {
    if (err instanceof Rejected) return { ok: false, reason: err.reason };
    if (isSlotTaken(err)) return { ok: false, reason: 'ocupado' };
    throw err;
  }
}
