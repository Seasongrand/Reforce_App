/**
 * Conciliação de repasses parados em 'releasing' (§2.6): o Asaas pede que não
 * se repita o encerramento da mesma retenção e não avisa a liberação, então o
 * sistema consulta a retenção antes de tentar de novo.
 */
import { CompiledQuery, sql } from 'kysely';
import type { Temporal } from 'temporal-polyfill';
import type { Deps } from '../deps';
import { accountKey } from './account-key';
import { MARK_RELEASED_SQL } from './sql';

export async function reconcileReleasing(
  deps: Deps,
  now: Temporal.Instant,
  opts: { staleMinutes?: number } = {},
): Promise<{ checked: number; released: number; retried: number; refunded: number }> {
  const stale = now.subtract({ minutes: opts.staleMinutes ?? 10 }).toString();
  const claimed = await deps.db.transaction().execute(async (trx) =>
    (await sql<{ id: string; provider_escrow_id: string; account_key: Buffer | null }>`
      UPDATE payouts SET release_attempted_at = ${now.toString()}::timestamptz
       WHERE id IN (SELECT id FROM payouts
                     WHERE status = 'releasing'
                       AND (release_attempted_at IS NULL OR release_attempted_at <= ${stale}::timestamptz)
                     ORDER BY release_attempted_at NULLS FIRST
                     LIMIT 50
                     FOR UPDATE SKIP LOCKED)
      RETURNING id, provider_escrow_id,
                (SELECT a.api_key_ciphertext FROM teacher_payment_accounts a WHERE a.teacher_id = payouts.teacher_id) AS account_key`
      .execute(trx)).rows,
  );
  const out = { checked: claimed.length, released: 0, retried: 0, refunded: 0 };
  for (const p of claimed) {
    try {
      const key = accountKey(deps, p.account_key);
      const escrow = await deps.providers.payment.getEscrow(p.provider_escrow_id, key);
      if (escrow.status === 'refunded') {
        await sql`UPDATE payouts SET status = 'refunded' WHERE id = ${p.id} AND status = 'releasing'`.execute(deps.db);
        out.refunded += 1;
        continue;
      }
      if (escrow.status === 'held') {
        const r = await deps.providers.payment.releaseEscrow(p.provider_escrow_id, key);
        out.retried += 1;
        if (r.status !== 'released') continue;
      }
      const done = await deps.db.executeQuery(CompiledQuery.raw(MARK_RELEASED_SQL, [p.id, now.toString()]));
      out.released += done.rows.length;
    } catch (err) {
      console.error(`[conciliação] repasse ${p.id}:`, (err as Error).message);
    }
  }
  return out;
}
