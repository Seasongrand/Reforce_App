/**
 * Liberação dos repasses vencidos (§2.6). A consulta reivindica com
 * FOR UPDATE SKIP LOCKED e passa a 'releasing' antes de chamar o provedor;
 * só depois da resposta o repasse vira 'released', de forma condicional.
 * Se a resposta se perder, o repasse fica em 'releasing' para a conciliação.
 */
import { CompiledQuery } from 'kysely';
import type { Temporal } from 'temporal-polyfill';
import type { Deps } from '../deps';
import { CLAIM_DUE_PAYOUTS_SQL, MARK_RELEASED_SQL } from './sql';

export async function releaseDuePayouts(
  deps: Deps,
  now: Temporal.Instant,
  limit = 50,
): Promise<{ claimed: number; released: number; failed: number }> {
  const claimed = await deps.db.transaction().execute((trx) =>
    trx.executeQuery<{ id: string; provider_escrow_id: string }>(
      CompiledQuery.raw(CLAIM_DUE_PAYOUTS_SQL, [now.toString(), limit]),
    ),
  );
  let released = 0;
  let failed = 0;
  for (const p of claimed.rows) {
    try {
      const r = await deps.providers.payment.releaseEscrow(p.provider_escrow_id);
      if (r.status === 'released') {
        const done = await deps.db.executeQuery(CompiledQuery.raw(MARK_RELEASED_SQL, [p.id, now.toString()]));
        released += done.rows.length;
      }
    } catch (err) {
      failed += 1;
      console.error(`[repasse] liberação de ${p.id} sem resposta; a conciliação confere depois:`, (err as Error).message);
    }
  }
  return { claimed: claimed.rows.length, released, failed };
}
