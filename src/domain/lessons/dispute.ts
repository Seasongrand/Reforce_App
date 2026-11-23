/**
 * Contestação da aula (§1, desvios; §2.6). Em até 24 horas depois do fim da aula
 * (a janela do repasse), o responsável conta o que deu errado. Enquanto a
 * contestação está aberta, o repasse não é liberado (CLAIM_DUE_PAYOUTS_SQL). A
 * equipe decide com o registro da sala ou do código: a favor do professor, o
 * repasse sai na varredura seguinte; a favor da família, a aula é devolvida.
 */
import { sql } from 'kysely';
import type { Temporal } from 'temporal-polyfill';
import type { Db } from '@/db/client';
import { instantFromDb } from '@/time/zoned';
import { subjectName } from '../catalog';
import type { Deps } from '../deps';
import { DomainError } from '../errors';
import { scheduleNotice } from '../notifications/schedule';
import { queueOrderRefund } from '../payment/order-refund';

export const DISPUTE_REASONS = {
  not_happened: 'A aula não aconteceu',
  ended_early: 'A aula foi bem mais curta que o combinado',
  wrong_outcome: 'O aluno participou, mas a aula ficou como falta',
  other: 'Outro motivo',
} as const;
export type DisputeReason = keyof typeof DISPUTE_REASONS;

export type DisputeStatus = 'open' | 'for_teacher' | 'for_guardian' | 'shared';

export interface DisputeState {
  /** Pode abrir agora: aula do responsável, encerrada, com repasse retido e ainda no prazo. */
  canOpen: boolean;
  /** Fim do prazo (24 horas depois da aula), quando há repasse retido. */
  openUntil: string | null;
  dispute: { status: DisputeStatus; reason: string; openedAt: string } | null;
}

interface LessonRow {
  status: string;
  ends_at: string;
  order_id: string;
  payout_status: string | null;
  release_after: string | null;
}

async function guardianLesson(db: Db, guardianId: string, bookingId: string): Promise<LessonRow | undefined> {
  return (await sql<LessonRow>`
    SELECT b.status, b.ends_at, b.order_id, po.status AS payout_status, po.release_after
      FROM bookings b
      JOIN orders o ON o.id = b.order_id
      LEFT JOIN payouts po ON po.booking_id = b.id
     WHERE b.id = ${bookingId} AND o.guardian_id = ${guardianId}`.execute(db)).rows[0];
}

const before = (iso: string | null, now: Temporal.Instant) =>
  iso !== null && now.epochMilliseconds < instantFromDb(iso).epochMilliseconds;

export async function disputeState(db: Db, guardianId: string, bookingId: string, now: Temporal.Instant): Promise<DisputeState> {
  const l = await guardianLesson(db, guardianId, bookingId);
  if (!l) return { canOpen: false, openUntil: null, dispute: null };
  const d = (await sql<{ status: DisputeStatus; reason: string; opened_at: string }>`
    SELECT status, reason, opened_at FROM disputes WHERE booking_id = ${bookingId} AND opened_by = 'guardian'`.execute(db)).rows[0];
  const openUntil = l.payout_status === 'held' && l.release_after ? instantFromDb(l.release_after).toString() : null;
  return {
    canOpen: !d && (l.status === 'completed' || l.status === 'no_show') && l.payout_status === 'held' && before(l.release_after, now),
    openUntil,
    dispute: d ? { status: d.status, reason: d.reason, openedAt: instantFromDb(d.opened_at).toString() } : null,
  };
}

export async function openDispute(
  deps: Deps,
  input: { guardianId: string; bookingId: string; reason: DisputeReason; details?: string },
  now: Temporal.Instant,
): Promise<void> {
  const label = DISPUTE_REASONS[input.reason];
  if (!label) throw new DomainError('invalid', 'escolha o motivo');
  const details = input.details?.trim().slice(0, 1000) ?? '';
  if (input.reason === 'other' && !details) throw new DomainError('invalid', 'conte o que aconteceu na aula');
  await deps.db.transaction().execute(async (trx) => {
    await sql`SELECT 1 FROM bookings WHERE id = ${input.bookingId} FOR UPDATE`.execute(trx);
    const l = await guardianLesson(trx, input.guardianId, input.bookingId);
    if (!l) throw new DomainError('not_found', 'aula não encontrada');
    const exists = await trx.selectFrom('disputes').select('id').where('booking_id', '=', input.bookingId)
      .where('opened_by', '=', 'guardian').executeTakeFirst();
    if (exists) throw new DomainError('conflict', 'esta aula já foi contestada');
    if (l.status !== 'completed' && l.status !== 'no_show') {
      throw new DomainError('conflict', 'a contestação abre só depois da aula, quando ela é encerrada');
    }
    if (l.payout_status !== 'held' || !before(l.release_after, now)) {
      throw new DomainError('conflict', 'o prazo para contestar esta aula acabou (24 horas depois do fim da aula)');
    }
    const reason = details ? `${label}: ${details}` : label;
    await sql`INSERT INTO disputes (booking_id, opened_by, reason, opened_at)
              VALUES (${input.bookingId}, 'guardian', ${reason}, ${now.toString()}::timestamptz)`.execute(trx);
    await scheduleNotice(trx, input.bookingId, 'contestacao_aberta_professor', now);
  });
}

export interface OpenDispute {
  id: string;
  bookingId: string;
  openedAt: Temporal.Instant;
  reason: string;
  startsAt: Temporal.Instant;
  endsAt: Temporal.Instant;
  teacherName: string;
  guardianName: string;
  studentFirstName: string;
  subject: string;
  modality: 'online' | 'at_teacher' | 'at_student';
  outcome: string | null;
  amountCents: number;
  evidence: { teacherSeconds: number; studentSeconds: number; checkedIn: boolean };
}

/** Fila da equipe: contestações abertas, as mais antigas primeiro, com a evidência da aula. */
export async function openDisputes(db: Db): Promise<OpenDispute[]> {
  const { rows } = await sql<{
    id: string; booking_id: string; opened_at: string; reason: string; starts_at: string; ends_at: string;
    teacher: string; guardian: string; student: string; subject: string; modality: OpenDispute['modality'];
    outcome: string | null; price: number; teacher_seconds: number | null; student_seconds: number | null; checked_in_at: string | null;
  }>`
    SELECT d.id, d.booking_id, d.opened_at, d.reason, b.starts_at, b.ends_at, t.display_name AS teacher, g.name AS guardian,
           st.first_name AS student, sv.subject, b.modality, ls.outcome, (o.total_cents / o.lessons)::int AS price,
           ls.teacher_seconds, ls.student_seconds, ls.checked_in_at
      FROM disputes d
      JOIN bookings b ON b.id = d.booking_id
      JOIN orders o ON o.id = b.order_id
      JOIN guardians g ON g.id = o.guardian_id
      JOIN teachers t ON t.id = b.teacher_id
      JOIN students st ON st.id = b.student_id
      JOIN services sv ON sv.id = b.service_id
      LEFT JOIN lesson_sessions ls ON ls.booking_id = b.id
     WHERE d.status = 'open'
     ORDER BY d.opened_at`.execute(db);
  return rows.map((r) => ({
    id: r.id,
    bookingId: r.booking_id,
    openedAt: instantFromDb(r.opened_at),
    reason: r.reason,
    startsAt: instantFromDb(r.starts_at),
    endsAt: instantFromDb(r.ends_at),
    teacherName: r.teacher,
    guardianName: r.guardian,
    studentFirstName: r.student,
    subject: subjectName(r.subject),
    modality: r.modality,
    outcome: r.outcome,
    amountCents: r.price,
    evidence: { teacherSeconds: r.teacher_seconds ?? 0, studentSeconds: r.student_seconds ?? 0, checkedIn: r.checked_in_at !== null },
  }));
}

export async function resolveDispute(
  deps: Deps,
  input: { disputeId: string; staffId: string; decision: 'for_teacher' | 'for_guardian'; note: string },
  now: Temporal.Instant,
): Promise<void> {
  const note = input.note.trim();
  if (!note) throw new DomainError('invalid', 'escreva o motivo da decisão: ele vai para a família e para o professor');
  await deps.db.transaction().execute(async (trx) => {
    const d = (await sql<{ booking_id: string; status: string }>`
      SELECT booking_id, status FROM disputes WHERE id = ${input.disputeId} FOR UPDATE`.execute(trx)).rows[0];
    if (!d) throw new DomainError('not_found', 'contestação não encontrada');
    if (d.status !== 'open') throw new DomainError('conflict', 'esta contestação já foi decidida');
    await sql`SELECT set_config('app.actor', ${`staff:${input.staffId}`}, true)`.execute(trx);
    await sql`UPDATE disputes SET status = ${input.decision}, decision_note = ${note}, resolved_by = ${input.staffId},
                                  resolved_at = ${now.toString()}::timestamptz
               WHERE id = ${input.disputeId}`.execute(trx);
    if (input.decision === 'for_guardian') {
      const po = (await sql<{ id: string; status: string; order_id: string }>`
        SELECT po.id, po.status, b.order_id FROM payouts po JOIN bookings b ON b.id = po.booking_id
         WHERE po.booking_id = ${d.booking_id} FOR UPDATE OF po`.execute(trx)).rows[0];
      if (!po || (po.status !== 'held' && po.status !== 'refunded')) {
        throw new DomainError('conflict', 'o repasse desta aula não está mais retido');
      }
      // já devolvido (o professor justificou a falta antes da decisão): só registra
      if (po.status === 'held') {
        await sql`UPDATE payouts SET status = 'refunded' WHERE id = ${po.id}`.execute(trx);
        await queueOrderRefund(trx, po.order_id);
      }
    }
    const which = input.decision === 'for_guardian' ? 'aceita' : 'negada';
    await scheduleNotice(trx, d.booking_id, `contestacao_${which}_responsavel`, now);
    await scheduleNotice(trx, d.booking_id, `contestacao_${which}_professor`, now);
  });
}
