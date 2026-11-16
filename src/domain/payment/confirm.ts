/**
 * Efeitos da confirmação de um pedido, na mesma transação que o confirma:
 * pedido pago, registro da aula (com hash do código presencial), mensagens
 * agendadas e tarefas enfileiradas (sala de vídeo, evento no calendário,
 * retrato da busca).
 */
import { sql, type Transaction } from 'kysely';
import type { Temporal } from 'temporal-polyfill';
import type { DB } from '@/db/types';
import { enqueue } from '@/worker/enqueue';
import type { Deps } from '../deps';
import { checkinCode, checkinHash } from '../lessons/checkin';
import { scheduleForConfirmedBooking } from '../notifications/schedule';

export async function onOrderConfirmed(
  deps: Deps,
  trx: Transaction<DB>,
  orderId: string,
  bookingIds: string[],
  now: Temporal.Instant,
): Promise<void> {
  await sql`UPDATE orders SET status = 'paid' WHERE id = ${orderId}`.execute(trx);
  const secret = deps.config.sessionSecret;
  const bookings = await trx.selectFrom('bookings').select(['id', 'modality', 'teacher_id'])
    .where('id', 'in', bookingIds).execute();
  for (const b of bookings) {
    const hash = b.modality === 'online' ? null : checkinHash(b.id, checkinCode(b.id, secret), secret);
    await sql`INSERT INTO lesson_sessions (booking_id, checkin_code_hash) VALUES (${b.id}, ${hash})
              ON CONFLICT (booking_id) DO NOTHING`.execute(trx);
    await scheduleForConfirmedBooking(trx, b.id, now);
    if (b.modality === 'online') {
      await enqueue(trx, 'video.create_room', { bookingId: b.id }, { jobKey: `room:${b.id}` });
    }
    const cal = await trx.selectFrom('calendar_connections').select('id')
      .where('teacher_id', '=', b.teacher_id).where('status', '=', 'active').executeTakeFirst();
    if (cal) await enqueue(trx, 'calendar.create_event', { bookingId: b.id }, { jobKey: `cal:${b.id}` });
  }
  const teacherId = bookings[0]?.teacher_id;
  if (teacherId) await enqueue(trx, 'search.refresh_teacher', { teacherId }, { jobKey: `refresh:${teacherId}` });
}
