/**
 * Quanto deve estar devolvido de um pedido, e a tarefa payment.refund que leva
 * a cobrança até esse total (repetir não devolve duas vezes). Por aula do pedido:
 * cancelada ou com o repasse devolvido (falta justificada, contestação aceita):
 * a aula inteira; falta do aluno: o que não ficou com o professor.
 */
import { sql, type Transaction } from 'kysely';
import type { DB } from '@/db/types';
import { enqueue } from '@/worker/enqueue';

export async function queueOrderRefund(trx: Transaction<DB>, orderId: string): Promise<void> {
  const { rows } = await sql<{ payment_id: string; amount_cents: number; owed: number }>`
    SELECT p.id AS payment_id, p.amount_cents,
           coalesce(sum(CASE WHEN bk.status = 'cancelled' OR po.status = 'refunded' THEN o.total_cents / o.lessons
                             WHEN bk.status = 'no_show'
                             THEN (o.total_cents / o.lessons) - coalesce(po.gross_cents, 0)
                             ELSE 0 END), 0)::int AS owed
      FROM orders o
      JOIN payments p ON p.order_id = o.id AND p.status = 'paid'
      JOIN bookings bk ON bk.order_id = o.id
      LEFT JOIN payouts po ON po.booking_id = bk.id
     WHERE o.id = ${orderId}
     GROUP BY p.id, p.amount_cents`.execute(trx);
  const pay = rows[0];
  if (!pay) return;
  const goal = Math.min(pay.owed, pay.amount_cents);
  if (goal <= 0) return;
  await enqueue(trx, 'payment.refund', { paymentId: pay.payment_id, amountCents: goal }, { jobKey: `refund:${pay.payment_id}` });
  await sql`UPDATE orders SET status = ${goal >= pay.amount_cents ? 'refunded' : 'partially_refunded'} WHERE id = ${orderId}`.execute(trx);
}
