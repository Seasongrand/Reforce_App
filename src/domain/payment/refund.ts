/** Devolução de uma cobrança paga pelo provedor (tarefa payment.refund). */
import { sql } from 'kysely';
import type { Temporal } from 'temporal-polyfill';
import type { Deps } from '../deps';

export async function refundPayment(deps: Deps, paymentId: string, _now: Temporal.Instant): Promise<void> {
  const p = await deps.db.selectFrom('payments').select(['provider_charge_id', 'status'])
    .where('id', '=', paymentId).executeTakeFirst();
  if (!p || p.status === 'refunded') return;
  await deps.providers.payment.refund(p.provider_charge_id);
  await sql`UPDATE payments SET status = 'refunded' WHERE id = ${paymentId} AND status <> 'refunded'`.execute(deps.db);
}
