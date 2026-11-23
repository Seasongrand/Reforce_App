/**
 * Falta justificada: depois de uma aula em que o aluno faltou, o professor
 * pode devolver o valor ao responsável enquanto o repasse ainda está retido,
 * isto é, até o fim da janela de contestação (24 horas depois da aula). O
 * repasse passa a "refunded" (não é mais liberado), a cobrança é devolvida e o
 * responsável é avisado. Depois de liberado, o valor já é do professor.
 */
import { sql } from 'kysely';
import type { Temporal } from 'temporal-polyfill';
import { instantFromDb } from '@/time/zoned';
import type { Deps } from '../deps';
import { DomainError } from '../errors';
import { queueOrderRefund } from '../payment/order-refund';
import { scheduleNotice } from '../notifications/schedule';

export async function refundNoShowByTeacher(
  deps: Deps,
  input: { teacherId: string; bookingId: string },
  now: Temporal.Instant,
): Promise<void> {
  await deps.db.transaction().execute(async (trx) => {
    const b = (await sql<{ status: string; teacher_id: string; order_id: string }>`
      SELECT status, teacher_id, order_id FROM bookings WHERE id = ${input.bookingId} FOR UPDATE`.execute(trx)).rows[0];
    if (!b || b.teacher_id !== input.teacherId) throw new DomainError('not_found', 'aula não encontrada');
    if (b.status !== 'no_show') throw new DomainError('conflict', 'só dá para devolver o valor de aula em que o aluno faltou');

    const po = (await sql<{ id: string; status: string; release_after: string }>`
      SELECT id, status, release_after FROM payouts WHERE booking_id = ${input.bookingId} FOR UPDATE`.execute(trx)).rows[0];
    if (!po || po.status === 'refunded') throw new DomainError('conflict', 'o valor desta aula já foi devolvido');
    if (po.status !== 'held' || instantFromDb(po.release_after).epochMilliseconds <= now.epochMilliseconds) {
      throw new DomainError('conflict', 'o prazo para devolver acabou: o valor desta aula já foi liberado para você');
    }

    await sql`SELECT set_config('app.actor', ${`teacher:${input.teacherId}`}, true)`.execute(trx);
    await sql`UPDATE payouts SET status = 'refunded' WHERE id = ${po.id}`.execute(trx);

    await queueOrderRefund(trx, b.order_id);
    await scheduleNotice(trx, input.bookingId, 'falta_aluno_devolvida', now);
  });
}
