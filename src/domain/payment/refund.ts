/**
 * Devolução de uma cobrança pelo provedor (tarefa payment.refund).
 * `totalRefundCents` é quanto deve estar devolvido ao final (padrão: tudo).
 * Assim, repetir a tarefa não devolve duas vezes.
 */
import { sql } from 'kysely';
import type { Temporal } from 'temporal-polyfill';
import type { Deps } from '../deps';

export async function refundPayment(
  deps: Deps,
  paymentId: string,
  _now: Temporal.Instant,
  totalRefundCents?: number,
): Promise<void> {
  await deps.db.transaction().execute(async (trx) => {
    const p = await trx.selectFrom('payments')
      .select(['provider_charge_id', 'amount_cents', 'refunded_cents', 'status'])
      .where('id', '=', paymentId).forUpdate().executeTakeFirst();
    if (!p) return;
    const goal = Math.min(totalRefundCents ?? p.amount_cents, p.amount_cents);
    const delta = goal - p.refunded_cents;
    if (delta <= 0) return;
    await deps.providers.payment.refund(p.provider_charge_id, delta === p.amount_cents ? undefined : delta);
    await sql`UPDATE payments
                 SET refunded_cents = refunded_cents + ${delta},
                     status = CASE WHEN refunded_cents + ${delta} >= amount_cents THEN 'refunded' ELSE status END
               WHERE id = ${paymentId}`.execute(trx);
  });
}
