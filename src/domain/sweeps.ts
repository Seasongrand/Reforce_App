/**
 * Varreduras periódicas, como funções puras de (deps, agora). O worker as
 * chama a cada minuto; /dev e os testes as chamam diretamente.
 */
import { sql } from 'kysely';
import type { Temporal } from 'temporal-polyfill';
import { enqueue } from '@/worker/enqueue';
import type { Deps } from './deps';
import { sendDueNotifications } from './notifications/send';
import { retryDeferredWebhooks } from './payment/webhook';
import { closeLessons } from './lessons/close';
import { releaseDuePayouts } from './payouts/release';
import { reconcileReleasing } from './payouts/reconcile';

/** Reservas temporárias vencidas liberam o horário; a cobrança é cancelada (§1). */
export async function expireHolds(deps: Deps, now: Temporal.Instant): Promise<{ bookings: number; charges: number }> {
  const bookings = await deps.db.transaction().execute(async (trx) => {
    const { rows } = await sql<{ order_id: string; teacher_id: string }>`
      WITH gone AS (
        UPDATE bookings SET status = 'expired'
         WHERE status = 'held' AND hold_expires_at < ${now.toString()}::timestamptz
        RETURNING order_id, teacher_id),
      o AS (
        UPDATE orders SET status = 'expired'
         WHERE id IN (SELECT order_id FROM gone) AND status = 'awaiting_payment')
      SELECT order_id, teacher_id FROM gone`.execute(trx);
    for (const teacherId of new Set(rows.map((r) => r.teacher_id))) {
      await enqueue(trx, 'search.refresh_teacher', { teacherId }, { jobKey: `refresh:${teacherId}` });
    }
    return rows.length;
  });

  const pending = await sql<{ id: string; provider_charge_id: string }>`
    SELECT p.id, p.provider_charge_id FROM payments p JOIN orders o ON o.id = p.order_id
     WHERE p.status = 'pending' AND o.status = 'expired'`.execute(deps.db);
  let charges = 0;
  for (const p of pending.rows) {
    try {
      await deps.providers.payment.cancelCharge(p.provider_charge_id);
    } catch (err) {
      console.error(`[expireHolds] falha ao cancelar a cobrança ${p.provider_charge_id}:`, (err as Error).message);
      continue;
    }
    const r = await sql`UPDATE payments SET status = 'expired' WHERE id = ${p.id} AND status = 'pending'`.execute(deps.db);
    charges += Number(r.numAffectedRows ?? 0);
  }
  return { bookings, charges };
}

/** Tudo o que roda a cada minuto, em ordem. Cada etapa isolada: uma falha não para as outras. */
export async function runMinuteSweeps(deps: Deps, now: Temporal.Instant): Promise<Record<string, unknown>> {
  const steps: Array<[string, () => Promise<unknown>]> = [
    ['expireHolds', () => expireHolds(deps, now)],
    ['retryDeferredWebhooks', () => retryDeferredWebhooks(deps, now)],
    ['sendDueNotifications', () => sendDueNotifications(deps, now)],
    ['closeLessons', () => closeLessons(deps, now)],
    ['releaseDuePayouts', () => releaseDuePayouts(deps, now)],
    ['reconcileReleasing', () => reconcileReleasing(deps, now)],
  ];
  const out: Record<string, unknown> = {};
  for (const [name, fn] of steps) {
    try {
      out[name] = await fn();
    } catch (err) {
      console.error(`[varredura] ${name} falhou:`, err);
      out[name] = { error: (err as Error).message };
    }
  }
  return out;
}
