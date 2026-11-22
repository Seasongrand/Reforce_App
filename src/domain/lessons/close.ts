/**
 * Desfecho da aula (§2.6), depois do fim mais uma folga de 10 minutos.
 * Online: os dois presentes, aula dada; só o professor, falta do aluno; só o
 * aluno ou professor que entrou depois de TEACHER_NO_SHOW_MINUTES, falta do
 * professor, com reembolso integral. Presencial: com código, aula dada.
 * Sem evidência, a aula fica para decisão da equipe no painel interno.
 */
import { sql, type Transaction } from 'kysely';
import type { Temporal } from 'temporal-polyfill';
import type { Db } from '@/db/client';
import type { DB } from '@/db/types';
import { instantFromDb } from '@/time/zoned';
import { enqueue } from '@/worker/enqueue';
import type { Deps } from '../deps';
import { DomainError } from '../errors';
import { scheduleNotice } from '../notifications/schedule';
import { createPayoutForBooking } from '../payouts/create';

export type Outcome = 'taught' | 'student_no_show' | 'teacher_no_show';
export const CLOSE_GRACE_MIN = 10;

interface Evidence {
  id: string;
  modality: string;
  starts_at: string;
  teacher_joined_at: string | null;
  student_joined_at: string | null;
  checked_in_at: string | null;
}

function evaluate(e: Evidence, noShowMin: number): { outcome: Outcome } | { reason: string } {
  if (e.modality !== 'online') return e.checked_in_at ? { outcome: 'taught' } : { reason: 'sem código presencial' };
  const limit = instantFromDb(e.starts_at).add({ minutes: noShowMin }).epochMilliseconds;
  const teacherOnTime = e.teacher_joined_at !== null && instantFromDb(e.teacher_joined_at).epochMilliseconds <= limit;
  if (e.student_joined_at && !teacherOnTime) return { outcome: 'teacher_no_show' };
  if (teacherOnTime && e.student_joined_at) return { outcome: 'taught' };
  if (teacherOnTime) return { outcome: 'student_no_show' };
  if (e.teacher_joined_at) return { reason: 'professor atrasado e aluno ausente' };
  return { reason: 'ninguém entrou na sala' };
}

const EVIDENCE = sql`
  SELECT b.id, b.modality, b.starts_at, ls.teacher_joined_at, ls.student_joined_at, ls.checked_in_at
    FROM bookings b JOIN lesson_sessions ls ON ls.booking_id = b.id`;

export async function closeLessons(deps: Deps, now: Temporal.Instant): Promise<{ closed: number; pending: number }> {
  const cutoff = now.subtract({ minutes: CLOSE_GRACE_MIN }).toString();
  const { rows } = await sql<{ id: string }>`
    SELECT id FROM bookings WHERE status = 'confirmed' AND ends_at <= ${cutoff}::timestamptz
     ORDER BY ends_at LIMIT 100`.execute(deps.db);
  let closed = 0;
  let pending = 0;
  for (const { id } of rows) {
    await deps.db.transaction().execute(async (trx) => {
      const ev = await sql<Evidence>`${EVIDENCE} WHERE b.id = ${id} AND b.status = 'confirmed' FOR UPDATE OF b SKIP LOCKED`
        .execute(trx);
      if (!ev.rows[0]) return;
      const r = evaluate(ev.rows[0], deps.config.teacherNoShowMinutes);
      if ('outcome' in r) {
        await applyOutcome(deps, trx, id, r.outcome, now, 'system');
        closed += 1;
      } else {
        pending += 1;
      }
    });
  }
  return { closed, pending };
}

export interface PendingLesson {
  bookingId: string;
  teacherName: string;
  studentFirstName: string;
  modality: string;
  startsAt: Temporal.Instant;
  reason: string;
}

/** Aulas encerradas sem evidência suficiente: a equipe decide no painel. */
export async function pendingDecisions(db: Db, now: Temporal.Instant, noShowMin = 15): Promise<PendingLesson[]> {
  const cutoff = now.subtract({ minutes: CLOSE_GRACE_MIN }).toString();
  const { rows } = await sql<Evidence & { teacher_name: string; first_name: string }>`
    SELECT b.id, b.modality, b.starts_at, ls.teacher_joined_at, ls.student_joined_at, ls.checked_in_at,
           t.display_name AS teacher_name, st.first_name
      FROM bookings b
      JOIN lesson_sessions ls ON ls.booking_id = b.id
      JOIN teachers t ON t.id = b.teacher_id
      JOIN students st ON st.id = b.student_id
     WHERE b.status = 'confirmed' AND b.ends_at <= ${cutoff}::timestamptz
     ORDER BY b.ends_at`.execute(db);
  return rows.flatMap((r) => {
    const e = evaluate(r, noShowMin);
    return 'reason' in e
      ? [{ bookingId: r.id, teacherName: r.teacher_name, studentFirstName: r.first_name, modality: r.modality,
           startsAt: instantFromDb(r.starts_at), reason: e.reason }]
      : [];
  });
}

/** Decisão da equipe sobre uma aula sem evidência; registra quem decidiu. */
export async function decideOutcome(
  deps: Deps,
  input: { bookingId: string; outcome: Outcome; staffId: string },
  now: Temporal.Instant,
): Promise<void> {
  await deps.db.transaction().execute(async (trx) => {
    const b = await trx.selectFrom('bookings').select(['status', 'ends_at']).where('id', '=', input.bookingId)
      .forUpdate().executeTakeFirst();
    if (!b || b.status !== 'confirmed') throw new DomainError('conflict', 'a aula não está aguardando decisão');
    if (instantFromDb(b.ends_at).epochMilliseconds > now.epochMilliseconds) {
      throw new DomainError('conflict', 'a aula ainda não terminou');
    }
    await applyOutcome(deps, trx, input.bookingId, input.outcome, now, `staff:${input.staffId}`);
  });
}

async function applyOutcome(
  deps: Deps,
  trx: Transaction<DB>,
  bookingId: string,
  outcome: Outcome,
  now: Temporal.Instant,
  actor: string,
) {
  await sql`SELECT set_config('app.actor', ${actor}, true)`.execute(trx);
  const status = outcome === 'taught' ? 'completed' : outcome === 'student_no_show' ? 'no_show' : 'cancelled';
  const upd = await sql<{ order_id: string; teacher_id: string }>`
    UPDATE bookings SET status = ${status}::booking_status WHERE id = ${bookingId} AND status = 'confirmed'
    RETURNING order_id, teacher_id`.execute(trx);
  const b = upd.rows[0];
  if (!b) return;
  await sql`UPDATE lesson_sessions SET outcome = ${outcome}, closed_at = ${now.toString()}::timestamptz
             WHERE booking_id = ${bookingId}`.execute(trx);

  if (outcome === 'taught') {
    await createPayoutForBooking(deps, trx, bookingId, 100);
    // pedido de avaliação à família, 1 hora depois do fechamento (sai só se ninguém avaliou até lá)
    await scheduleNotice(trx, bookingId, 'pedido_avaliacao_responsavel', now.add({ hours: 1 }));
  } else if (outcome === 'student_no_show') {
    const pct = deps.config.studentNoShowTeacherPct;
    const p = await createPayoutForBooking(deps, trx, bookingId, pct);
    const refund = p.priceCents - p.grossCents;
    if (refund > 0) {
      await enqueue(trx, 'payment.refund', { paymentId: p.paymentId, amountCents: refund }, { jobKey: `refund:${p.paymentId}` });
      await sql`UPDATE orders SET status = ${pct === 0 ? 'refunded' : 'partially_refunded'} WHERE id = ${b.order_id}`
        .execute(trx);
    }
  } else {
    const pay = await trx.selectFrom('payments').select('id').where('order_id', '=', b.order_id)
      .where('status', '=', 'paid').executeTakeFirst();
    await sql`UPDATE orders SET status = 'refunded' WHERE id = ${b.order_id}`.execute(trx);
    if (pay) await enqueue(trx, 'payment.refund', { paymentId: pay.id }, { jobKey: `refund:${pay.id}` });
    await scheduleNotice(trx, bookingId, 'falta_professor_reembolso', now);
  }
  await enqueue(trx, 'search.refresh_teacher', { teacherId: b.teacher_id }, { jobKey: `refresh:${b.teacher_id}` });
}
